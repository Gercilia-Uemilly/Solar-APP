import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { transcription } = await req.json();
    if (!transcription) {
      return new Response(JSON.stringify({ error: "Transcrição não fornecida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um assistente de um gabinete parlamentar. Analise a transcrição de um áudio e retorne informações estruturadas.`;

    const userPrompt = `Analise esta transcrição e extraia informações estruturadas:

"${transcription.substring(0, 3000)}"

Retorne SOMENTE um JSON válido (sem markdown, sem backticks) com esta estrutura exata:
{
  "titulo": "título curto e descritivo do tema principal do áudio (max 80 chars)",
  "resumo": "resumo de 1-2 frases do conteúdo principal",
  "tags": ["tag1", "tag2", "tag3"],
  "tema_principal": "categoria principal (ex: Mobilidade, Segurança, Saúde, Educação, Infraestrutura, Política Pública, Meio Ambiente, Cultura, Esporte, Habitação, Assistência Social, Economia)"
}`;

    const { systemInstruction, messages } = toGeminiMessages(systemPrompt, userPrompt);
    const result = await callGemini({ systemInstruction, messages });

    let parsed;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
    } catch {
      parsed = {
        titulo: transcription.substring(0, 80).replace(/\n/g, " ").trim(),
        resumo: transcription.substring(0, 200),
        tags: [],
        tema_principal: "Geral",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-audio error:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
