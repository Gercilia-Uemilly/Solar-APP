import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente de comunicação do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.

Sua função é gerar respostas empáticas, cordiais e profissionais para cidadãos que enviaram demandas ao gabinete.

## TOM DE VOZ
- Empático e acolhedor, mas NUNCA informal
- Cordial e profissional
- Transmitir confiança e seriedade no atendimento
- Demonstrar que a demanda foi ouvida e compreendida

## ESTRUTURA DA RESPOSTA

1. **Saudação**: "Olá [Nome]," (ou "Prezado(a) [Nome]," se nome disponível)
2. **Agradecimento**: Agradecer pelo contato com o Gabinete do Vereador Fabão
3. **Compreensão**: Demonstrar que entendeu o problema descrito, resumindo-o brevemente
4. **Registro**: Informar que a demanda foi registrada com o número de protocolo
5. **Mídias**: Se houver anexos (imagens, áudios, vídeos), mencionar que foram recebidos e serão considerados
6. **Encaminhamento**: Informar que será encaminhado ao órgão competente
7. **Expectativa**: Dar expectativa de retorno
8. **Fechamento**: Encerrar de forma cordial

## EXEMPLO DE RESPOSTA

"Olá Maria, agradecemos por entrar em contato com o Gabinete do Vereador Fabão. Recebemos sua mensagem e as imagens anexadas sobre os buracos na Rua Oscar Alvim, Bairro Fundinho. Compreendemos sua preocupação com a segurança dos moradores e pedestres da região.

Sua solicitação foi registrada sob o protocolo 23/2026/GVF e será encaminhada à Secretaria Municipal de Infraestrutura Urbana para as devidas providências.

Em breve retornaremos com mais informações sobre o andamento da sua demanda. Agradecemos pela colaboração e confiança no nosso trabalho."

## REGRAS
- NUNCA usar gírias ou linguagem coloquial
- NUNCA prometer prazos específicos (use "em breve", "assim que possível")
- SEMPRE mencionar o órgão/secretaria quando identificado
- Se não houver nome do solicitante, usar "Prezado(a) cidadão(ã)"
- Manter entre 3-4 parágrafos curtos
- Retorne APENAS o texto da resposta, sem JSON, sem markdown extra`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, assunto, destinatario, descricao, solicitante, bairro, local, secretaria, tipo_demanda, urgencia, tem_midias, tipos_midias } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch relevant knowledge base for context
    let kbContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const searchTerms = [assunto, bairro, tipo_demanda].filter(Boolean).join(" ").split(/\s+/).slice(0, 3).join("%25");
      
      const kbResp = await fetch(
        `${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,fonte&or=(titulo.ilike.%25${searchTerms}%25,descricao.ilike.%25${searchTerms}%25)&limit=3`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (kbResp.ok) {
        const kbData = await kbResp.json();
        if (kbData.length > 0) {
          kbContext = "\n\nINFORMAÇÕES RELEVANTES DA BASE DE CONHECIMENTO (use para contextualizar a resposta):\n" +
            kbData.map((k: any) => `- ${k.titulo}: ${k.descricao?.substring(0, 200) || ""}`).join("\n");
        }
      }
    } catch (e) {
      console.error("KB fetch error (non-fatal):", e);
    }

    const midiasInfo = tem_midias
      ? `\nMÍDIAS ANEXADAS: Sim (${tipos_midias || "imagens/documentos"}). Mencione que as mídias foram recebidas e serão consideradas na análise.`
      : "\nMÍDIAS ANEXADAS: Não";

    const userPrompt = `Gere uma resposta empática para o cidadão com base nas seguintes informações:

PROTOCOLO/NÚMERO: ${numero || "Não atribuído ainda"}
SOLICITANTE: ${solicitante || "Cidadão(ã)"}
ASSUNTO: ${assunto || "Não informado"}
DESCRIÇÃO DA DEMANDA: ${descricao || "Não detalhada"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA/ÓRGÃO RESPONSÁVEL: ${secretaria || destinatario || "A ser identificado"}
TIPO DE DEMANDA: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}
${midiasInfo}${kbContext}

Gere a resposta empática seguindo a estrutura e tom definidos.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erro ao gerar resposta");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";

    return new Response(
      JSON.stringify({ resposta: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-resposta error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
