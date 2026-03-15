import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, toGeminiMultimodal } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { systemInstruction, messages } = toGeminiMultimodal([
      { inlineData: { mimeType, data: base64 } },
      { text: prompt },
    ]);

    const result = await callGemini({ systemInstruction, messages });

    return new Response(
      JSON.stringify({ text: result.text, type: fileType }),
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
