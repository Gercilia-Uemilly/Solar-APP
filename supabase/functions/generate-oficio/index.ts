import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um redator parlamentar experiente da assessoria do Gabinete do Vereador Fabão.

Redija o corpo de ofícios oficiais.

Estrutura obrigatória:
1º parágrafo — introdução com solicitação
2º parágrafo — relato do solicitante
3º parágrafo — consequências
4º parágrafo — solicitação formal

Finalize com a conclusão institucional.

Use <strong> para destacar ruas, bairros, problemas e ações solicitadas.

Retorne apenas JSON.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY não configurada");
    }

    const userPrompt = `Gerar ofício parlamentar:

SECRETARIA: ${tipo || "Não informada"}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "Cidadão"}
ENDEREÇO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO: ${assunto || "Gerar automaticamente"}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Claude error:", text);

      return new Response(JSON.stringify({ error: "Erro Claude API" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    const content = data.content?.[0]?.text || "";

    return new Response(JSON.stringify({ oficio: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro função:", error);

    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
