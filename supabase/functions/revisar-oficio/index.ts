import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { oficio } = await req.json();
    if (!oficio) throw new Error("Missing oficio data");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é revisor de ofícios parlamentares do gabinete do Vereador Fabão em Uberlândia-MG.

Analise o ofício e retorne APENAS JSON válido com os problemas encontrados.

Verificar:
1. ASSUNTO: formato correto? "Solicitação de X – Bairro/Local Y". Máximo 80 caracteres. Sem endereço completo.
2. DESTINATÁRIO: bate com a secretaria selecionada? Ex: se secretaria é Saúde, destinatário deve mencionar Saúde.
3. VOCATIVO: está correto para o destinatário?
   - Secretarias → "Excelentíssimo(a) Senhor(a) Secretário(a),"
   - DMAE → "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,"
   - FUTEL/IPREMU/EMAM → "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,"
   - Ministério Público → "Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,"
4. ENDEREÇO: está mencionado no primeiro parágrafo do texto?
5. TEXTO: tem palavras repetidas ou frases duplicadas?
6. ERROS GRAMATICAIS: erros óbvios de português.
7. CAMPOS VAZIOS: assunto, secretaria ou endereço estão em branco ou com "não informado"?
8. NÚMERO: está no formato correto "XXX/2026" (ou ano atual)?
9. CONCLUSÃO: termina com frase padrão de encaminhamento ao órgão?
10. NOME DO ÓRGÃO: o nome da secretaria na conclusão bate com a secretaria selecionada?

Retornar JSON:
{
  "aprovado": true/false,
  "pontuacao": 0-100,
  "erros": [
    {
      "campo": "assunto|destinatario|vocativo|texto|endereco|numero|conclusao|gramatica",
      "gravidade": "erro|aviso|sugestao",
      "descricao": "explicação simples do problema",
      "correcao": "como corrigir ou texto corrigido"
    }
  ],
  "resumo": "texto curto dizendo se está ok ou não"
}

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem \`\`\`json, sem texto adicional.`
          },
          {
            role: "user",
            content: `Revise este ofício:

NÚMERO: ${oficio.numero || "(não informado)"}
SECRETARIA: ${oficio.secretaria || "(não informada)"}
DESTINATÁRIO: ${oficio.destinatario || "(não informado)"}
ASSUNTO: ${oficio.assunto || "(não informado)"}
ENDEREÇO: ${oficio.endereco_completo || "(não informado)"}
VOCATIVO: ${oficio.vocativo || "(não informado)"}

TEXTO DO OFÍCIO:
${oficio.conteudo || "(vazio)"}`
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erro na API de IA");
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || "";
    const cleaned = texto.replace(/```json\s*|```\s*/g, "").trim();
    
    let resultado;
    try {
      resultado = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", cleaned);
      resultado = {
        aprovado: true,
        pontuacao: 70,
        erros: [],
        resumo: "Não foi possível analisar completamente. Verifique manualmente."
      };
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("revisar-oficio error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
