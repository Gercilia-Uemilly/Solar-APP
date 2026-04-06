import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um especialista em transformar conversas reais de WhatsApp em scripts estruturados para atendimento automático de um gabinete político.

REGRAS:
- O script deve ser CURTO (estilo WhatsApp real)
- Deve ser o PRIMEIRO PASSO da conversa (não resposta completa)
- Deve SEMPRE puxar continuidade com uma pergunta
- Linguagem humana, simples, estilo mineiro (uso de "viu?", "né?", "tá?")
- NÃO pode encerrar atendimento
- NÃO pode dar solução completa de uma vez
- Use emojis com moderação: 😊, 🙏, 😔, 😕
- Proibido: 👍
- Proibido frases de encerramento como "estou à disposição"

Retorne EXATAMENTE em JSON com esta estrutura (sem markdown, sem código):
{
  "titulo": "Título curto descritivo do script",
  "categoria": "Categoria (ex: Habitação, Emprego, Saúde, Infraestrutura, Denúncia, Transporte, Documentos, Educação, Segurança, Outros)",
  "palavras_chave": ["palavra1", "palavra2", "palavra3"],
  "script_base": "Texto do script curto e conversacional com pergunta no final",
  "observacao": "Nota breve sobre contexto ou uso do script"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversa } = await req.json();
    if (!conversa || typeof conversa !== "string" || conversa.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Envie o texto da conversa" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { systemInstruction, messages } = toGeminiMessages(SYSTEM_PROMPT, `Conversa de WhatsApp:\n\n${conversa}`);
    const result = await callGemini({ systemInstruction, messages });

    let parsed: any;
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.text);
    } catch {
      parsed = {
        titulo: "Script gerado",
        categoria: "Outros",
        palavras_chave: [],
        script_base: result.text,
        observacao: "",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-script error:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
