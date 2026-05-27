import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { data: { user: _u } } = await _sb.auth.getUser();
    if (!_u) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY nao configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const oficio = body.oficio;

    if (!oficio) {
      return new Response(
        JSON.stringify({ error: "Dados do oficio nao informados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um revisor profissional de ofícios parlamentares do gabinete do Vereador Fabão em Uberlândia-MG.

Analise o ofício e retorne APENAS JSON válido (sem markdown, sem \`\`\`).

## REGRAS DE REVISÃO:

1. **ASSUNTO**: Formato "Solicitação de [serviço] na [Rua/Logradouro] - [Bairro]", máximo 80 caracteres.
2. **DESTINATÁRIO**: Deve corresponder à secretaria/órgão correto.
3. **VOCATIVO**: 
   - Secretarias municipais: "Excelentíssimo(a) Senhor(a) Secretário(a),"
   - DMAE: "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,"
   - Prefeito: "Excelentíssimo Senhor Prefeito,"
   - Câmara: "Excelentíssimo(a) Senhor(a) Presidente,"
4. **ENDEREÇO**: Deve ser mencionado no corpo do texto.
5. **TEXTO**: Verificar palavras repetidas, frases mal construídas, coerência.
6. **GRAMÁTICA**: Erros de ortografia, concordância, pontuação, acentuação.
7. **NÚMERO**: Formato XXX/2026.
8. **CONCLUSÃO**: Deve terminar com frase padrão "Assim, encaminha-se o presente para apreciação d[o/a] [órgão]...".
9. **ORGÃO**: O nome do órgão na conclusão deve usar nome por extenso (nunca sigla isolada).

## REGRAS CRÍTICAS PARA O CAMPO "correcao":

- Para campos simples (assunto, destinatario, vocativo, numero): o campo "correcao" deve conter o valor correto final pronto para substituição direta.
- Para campos de texto (texto, gramatica, conclusao): o campo "correcao" deve conter o TEXTO COMPLETO DO CORPO DO OFÍCIO já corrigido em HTML, preservando TODA a formatação HTML existente (tags <p>, <strong>, <br>, etc). NÃO retorne apenas a frase corrigida — retorne o corpo inteiro com a correção aplicada.
- Se não souber como corrigir, deixe "correcao" como string vazia "".

## FORMATO DE SAÍDA:

{
  "aprovado": boolean,
  "erros": [
    {
      "campo": "assunto" | "destinatario" | "vocativo" | "texto" | "endereco" | "numero" | "conclusao" | "gramatica",
      "gravidade": "erro" | "aviso" | "sugestao",
      "descricao": "Explicação do problema encontrado",
      "correcao": "Valor corrigido pronto para uso (corpo HTML completo para texto/gramatica/conclusao)"
    }
  ],
  "resumo": "Resumo geral da análise"
}

Se não houver erros, retorne erros como array vazio e aprovado true.
IMPORTANTE: Agrupe erros de gramática e texto em UMA ÚNICA entrada com o corpo completo corrigido. Não crie múltiplas entradas para o mesmo campo.`;

    const userPrompt = `Revise este ofício:
NÚMERO: ${oficio.numero || "não informado"}
SECRETARIA: ${oficio.secretaria || "não informada"}
DESTINATÁRIO: ${oficio.destinatario || "não informado"}
ASSUNTO: ${oficio.assunto || "não informado"}
ENDEREÇO: ${oficio.endereco_completo || "não informado"}
VOCATIVO: ${oficio.vocativo || "não informado"}

TEXTO COMPLETO DO CORPO (HTML):
${oficio.conteudo || "vazio"}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const erro = await response.text();
      console.error("OpenAI error:", response.status, erro);

      if (response.status === 402 || response.status === 429) {
        return new Response(
          JSON.stringify({
            aprovado: true,
            erros: [],
            resumo: "Créditos de IA esgotados. Você pode exportar normalmente.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          aprovado: true,
          erros: [],
          resumo: "Revisão indisponível no momento. Você pode exportar normalmente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const texto = data.choices[0].message.content;
    const cleaned = texto.replace(/```json/g, "").replace(/```/g, "").trim();

    let resultado;
    try {
      resultado = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response:", cleaned);
      resultado = {
        aprovado: true,
        erros: [],
        resumo: "Não foi possível analisar. Verifique manualmente.",
      };
    }

    // Validate corrections for body fields - ensure they contain HTML
    if (resultado.erros && Array.isArray(resultado.erros)) {
      for (const erro of resultado.erros) {
        if (["texto", "gramatica", "conclusao"].includes(erro.campo) && erro.correcao) {
          // If correction doesn't contain HTML tags, it's just a description - clear it
          if (!erro.correcao.includes("<") && oficio.conteudo?.includes("<")) {
            erro.correcao = "";
            erro.descricao += " (Corrija manualmente no editor)";
          }
        }
      }
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("revisar-oficio error:", error);
    return new Response(
      JSON.stringify({
        aprovado: true,
        erros: [],
        resumo: "Erro interno. Você pode exportar normalmente.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// deploy v4 - full body corrections