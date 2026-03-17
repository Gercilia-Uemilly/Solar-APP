import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, toGeminiMultimodal } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Call Gemini API directly for audio/video — OpenAI doesn't support these MIME types
async function callGeminiDirect(base64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY não configurada");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", response.status, errText);
    if (response.status === 429) throw Object.assign(new Error("Limite de requisições excedido."), { status: 429 });
    throw Object.assign(new Error(`Erro Gemini: ${response.status}`), { status: response.status });
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("type") as string;

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const mimeType = file.type || (fileType === "audio" ? "audio/ogg" : fileType === "video" ? "video/mp4" : "image/jpeg");

    let prompt: string;
    if (fileType === "audio" || fileType === "video") {
      prompt = `Analise este ${fileType === "video" ? "vídeo" : "áudio"} e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Transcreva o conteúdo integralmente e organize:
- Qual é a demanda/problema relatado
- Localização mencionada (ruas, bairros)
- Nome do solicitante (se mencionado)
- Detalhes específicos do problema

Formato da resposta:
TRANSCRIÇÃO:
[transcrição completa]

RESUMO PARA OFÍCIO:
[informações organizadas para criação do ofício]`;
    } else if (fileType === "image") {
      prompt = `Analise esta imagem e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Textos visíveis (placas, documentos, cartazes)
- Problemas urbanos visíveis (buracos, falta de iluminação, lixo, esgoto, etc.)
- Localização (ruas, bairros, referências)
- Condições gerais da situação fotografada

Retorne um texto descritivo claro e objetivo com todas as informações extraídas. Se houver texto legível na imagem, transcreva-o integralmente.`;
    } else {
      prompt = `Analise este documento e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Conteúdo textual completo
- Dados de localização (endereços, bairros)
- Problemas ou demandas relatadas
- Nomes de solicitantes ou envolvidos

Retorne um texto descritivo claro e objetivo com todas as informações extraídas.`;
    }

    let resultText: string;

    // Audio/video → use Gemini API directly (supports multimodal audio/video)
    // Images/docs → use OpenAI via shared helper
    if (fileType === "audio" || fileType === "video") {
      resultText = await callGeminiDirect(base64, mimeType, prompt);
    } else {
      const { systemInstruction, messages } = toGeminiMultimodal([
        { inlineData: { mimeType, data: base64 } },
        { text: prompt },
      ]);
      const result = await callGemini({ systemInstruction, messages });
      resultText = result.text;
    }

    return new Response(
      JSON.stringify({ text: resultText, type: fileType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("process-file error:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
