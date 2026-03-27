import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Call OpenAI API for all file types (supports multimodal)
async function callOpenAI(base64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const model = "gpt-4o-mini";
  const url = "https://api.openai.com/v1/chat/completions";

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000);
      await new Promise((r) => setTimeout(r, delay));
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
        max_tokens: 8192,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }

    const errText = await response.text();
    console.error(`OpenAI error (attempt ${attempt + 1}):`, response.status, errText);

    if (response.status === 429) {
      lastError = Object.assign(new Error("Limite de requisições excedido. Tentando novamente..."), { status: 429 });
      continue; // retry
    }

    // Non-retryable error
    throw Object.assign(new Error(`Erro AI: ${response.status}`), { status: response.status });
  }

  throw lastError || new Error("Falha após múltiplas tentativas");
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

    // Use OpenAI API for all file types (multimodal support)
    resultText = await callOpenAI(base64, mimeType, prompt);

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
