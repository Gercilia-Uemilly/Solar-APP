import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ):
    }

    const { oficio } = await req.json();

    if (!oficio) {
      return new Response(
        JSON.stringify({ error: "Dados do ofício não informados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é revisor de ofícios parlamentares do gabinete do Vereador Fabão em Uberlândia-MG.

Analise o ofício e retorne APENAS JSON válido sem markdown nem texto adicional.

Verificar:
1. ASSUNTO: formato "Solicitação de X – Local Y", máximo 80 caracteres, sem endereço completo
2. DESTINATÁRIO: bate com a secretaria selecionada?
3. VOCATIVO: correto para o destinatário?
   - Secretarias municipais → "Excelentíssimo(a) Senhor(a) Secretário(a),"
   - DMAE/FUTEL/IPREMU/EMAM → "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,"
   - Ministério Público → "Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,"
   - Polícia Militar → "Senhor(a) Comandante,"
4. ENDEREÇO: mencionado no primeiro parágrafo?
5. TEXTO: palavras repetidas ou frases duplicadas?
6. GRAMÁTICA: erros óbvios de português
7. CAMPOS VAZIOS: assunto, secretaria ou endereço em branco ou "não informado"?
8. NÚMERO: formato correto "XXX/2026"?
9. CONCLUSÃO: termina com frase padrão do gabinete?
10. NOME DO ÓRGÃO: nome na conclusão bate com a secretaria?

Retornar APENAS este JSON sem nenhum texto fora dele:
{
  "aprovado": true,
  "pontuacao": 85,
  "erros": [
    {
      "campo": "vocativo",
      "gravidade": "erro",
      "descricao": "explicação simples do problema",
      "correcao": "texto correto para substituir",
      "correcao_automatica": "texto correto"
    }
  ],
  "resumo": "texto curto dizendo se está ok ou não"
}

gravidade: "erro" | "aviso" | "sugestao"
Se não houver erros, retornar erros como array vazio [].`;

    const userPrompt = `Revise este ofício:

NÚMERO: ${oficio.numero || "não informado"}
SECRETARIA: ${oficio.secretaria || "não informada"}
DESTINATÁRIO: ${oficio.destinatario || "não informado"}
ASSUNTO: ${oficio.assunto || "não informado"}
ENDEREÇO: ${oficio.endereco_completo || "não informado"}
VOCATIVO: ${oficio.vocativo || "não informado"}

TEXTO DO OFÍCIO:
${oficio.conteudo || "vazio"}`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1000,
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      }
    );

    if (!response.ok) {
      const erro = await response.text();
      console.error("OpenAI error:", response.status, erro);
      return new Response(
        JSON.stringify({ error: "Erro ao chamar OpenAI: " + response.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || "";
    const cleaned = texto.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let resultado;
    try {
      resultado = JSON.parse(cleaned);
    } catch (e) {
      console.error("Erro ao parsear resposta:", cleaned);
      resultado = {
        aprovado: true,
        pontuacao: 70,
        erros: [],
        resumo: "Não foi possível analisar. Verifique manualmente.",
      };
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("revisar-oficio error:", error);
    return new Response(
      JSON.stringify({
        aprovado: true,
        pontuacao: 0,
        erros: [],
        resumo: "Erro interno: " + (error?.message || "desconhecido"),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
