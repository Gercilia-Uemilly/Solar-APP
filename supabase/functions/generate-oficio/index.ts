import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `
Você é um redator parlamentar da assessoria do vereador Fabão.

Gere o corpo de um ofício parlamentar.

Estrutura:

1º parágrafo — introdução com solicitação  
2º parágrafo — relato do solicitante  
3º parágrafo — consequências do problema  
4º parágrafo — solicitação formal  

Use linguagem formal.

Use <strong> para destacar ruas, bairros e problemas.

Retorne JSON no formato:

{
 "oficio": "...",
 "assunto_sugerido": "...",
 "secretaria_identificada": "...",
 "tipo_demanda": "...",
 "urgencia": "normal",
 "sugestoes_melhoria": []
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY não configurada");
    }

    const prompt = `
SECRETARIA: ${tipo || "Não informada"}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "Cidadão"}
ENDEREÇO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO: ${assunto || "Gerar automaticamente"}
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: SYSTEM_PROMPT }, { text: prompt }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();

      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed;

    try {
      const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        oficio: content,
        assunto_sugerido: "",
        secretaria_identificada: tipo || "",
        tipo_demanda: "Solicitação",
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        sugestoes_melhoria: [],
      };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erro interno ao gerar ofício" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
