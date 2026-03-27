import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// OpenAI Vision for images only
async function callOpenAIVision(base64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI Vision error:", response.status, errText);
    if (response.status === 429) throw Object.assign(new Error("Limite de requisições excedido."), { status: 429 });
    throw Object.assign(new Error(`Erro OpenAI Vision: ${response.status}`), { status: response.status });
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// OpenAI Whisper for audio transcription
async function callWhisper(file: File): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");
  formData.append("language", "pt");
  formData.append("response_format", "text");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Whisper error:", response.status, errText);
    if (response.status === 429) throw Object.assign(new Error("Limite de requisições excedido."), { status: 429 });
    throw Object.assign(new Error(`Erro Whisper: ${response.status}`), { status: response.status });
  }

  return await response.text();
}

// After Whisper transcription, use GPT to organize for ofício
async function organizeTranscription(transcription: string, mediaType: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return transcription;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Você é um assistente de gabinete parlamentar. Organize transcrições de áudio/vídeo para auxiliar na criação de ofícios legislativos municipais.",
        },
        {
          role: "user",
          content: `Organize esta transcrição de ${mediaType} para criar um ofício legislativo municipal.

TRANSCRIÇÃO:
${transcription}

Retorne no formato:
TRANSCRIÇÃO:
[transcrição limpa e organizada]

RESUMO PARA OFÍCIO:
- Demanda/problema relatado
- Localização mencionada (ruas, bairros)
- Nome do solicitante (se mencionado)
- Detalhes específicos do problema`,
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("GPT organize error:", response.status, errText);
    // Fallback: return raw transcription
    return `TRANSCRIÇÃO:\n${transcription}`;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || transcription;
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

    let resultText: string;

    if (fileType === "audio" || fileType === "video") {
      // Use Whisper API for audio/video transcription
      const transcription = await callWhisper(file);
      // Then organize with GPT
      resultText = await organizeTranscription(transcription, fileType === "video" ? "vídeo" : "áudio");
    } else {
      // Images: use OpenAI Vision
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";

      const prompt = fileType === "image"
        ? `Analise esta imagem e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Textos visíveis (placas, documentos, cartazes)
- Problemas urbanos visíveis (buracos, falta de iluminação, lixo, esgoto, etc.)
- Localização (ruas, bairros, referências)
- Condições gerais da situação fotografada

Retorne um texto descritivo claro e objetivo com todas as informações extraídas. Se houver texto legível na imagem, transcreva-o integralmente.`
        : `Analise este documento e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Conteúdo textual completo
- Dados de localização (endereços, bairros)
- Problemas ou demandas relatadas
- Nomes de solicitantes ou envolvidos

Retorne um texto descritivo claro e objetivo com todas as informações extraídas.`;

      resultText = await callOpenAIVision(base64, mimeType, prompt);
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
