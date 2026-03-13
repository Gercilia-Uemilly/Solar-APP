import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `
Você é um redator parlamentar do gabinete do Vereador Fabão.

Escreva ofícios oficiais com estrutura:

1º parágrafo — introdução com solicitação  
2º parágrafo — relato do solicitante  
3º parágrafo — consequências do problema  
4º parágrafo — solicitação formal  

Depois finalize com a conclusão institucional.

Use <strong> para destacar:
- ruas
- bairros
- problemas
- ações solicitadas

Retorne apenas JSON neste formato:

{
 "oficio": "texto do oficio",
 "assunto_sugerido": "assunto",
 "secretaria_identificada": "secretaria",
 "tipo_demanda": "Solicitação",
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
Gerar ofício parlamentar com base nos dados:

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
              role: "user",
              parts: [{ text: SYSTEM_PROMPT }, { text: prompt }],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Gemini error:", text);

      return new Response(JSON.stringify({ error: "Erro Gemini API" }), {
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
        secretaria_identificada: destinatario || "",
        tipo_demanda: tipo || "Solicitação",
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        sugestoes_melhoria: [],
      };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Erro função:", error);

    return new Response(JSON.stringify({ error: "Erro interno ao gerar ofício" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
