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

Sua solicitação foi registrada sob o protocolo 23-2026 e será encaminhada à Secretaria Municipal de Infraestrutura Urbana para as devidas providências.

Em breve retornaremos com mais informações sobre o andamento da sua demanda. Agradecemos pela colaboração e confiança no nosso trabalho."

## REGRAS
- NUNCA usar gírias ou linguagem coloquial
- NUNCA prometer prazos específicos (use "em breve", "assim que possível")
- SEMPRE mencionar o órgão/secretaria quando identificado
- Se não houver nome do solicitante, usar "Prezado(a) cidadão(ã)"
- Manter entre 3-4 parágrafos curtos
- Retorne APENAS o texto da resposta, sem JSON, sem markdown extra
- Use os SCRIPTS DE ATENDIMENTO fornecidos como referência de tom e linguagem
- Use as RESPOSTAS ANTERIORES de ofícios similares como referência de estilo
- Use as CONVERSAS DO WHATSAPP para entender o contexto real das interações com cidadãos
- Use as NOTÍCIAS E INFORMAÇÕES da base de conhecimento para contextualizar a resposta`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, assunto, destinatario, descricao, solicitante, bairro, local, secretaria, tipo_demanda, urgencia, tem_midias, tipos_midias } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

    const searchTerms = [assunto, bairro, tipo_demanda].filter(Boolean).join(" ").split(/\s+/).slice(0, 3).join("%25");

    // Fetch all context sources in parallel
    const [kbResp, scriptsResp, oficiosResp, whatsappResp] = await Promise.all([
      // 1. Knowledge base (SOS, Instagram, uploads)
      fetch(
        `${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,fonte,categoria&or=(titulo.ilike.%25${searchTerms}%25,descricao.ilike.%25${searchTerms}%25)&limit=5`,
        { headers }
      ).catch(() => null),

      // 2. Scripts de atendimento
      fetch(
        `${supabaseUrl}/rest/v1/scripts?select=titulo,conteudo,categoria&limit=5&order=favorito.desc,updated_at.desc`,
        { headers }
      ).catch(() => null),

      // 3. Respostas de ofícios anteriores similares
      fetch(
        `${supabaseUrl}/rest/v1/oficios?select=assunto,resposta_cidadao,secretaria_identificada,bairro,tipo_demanda&resposta_cidadao=not.is.null&or=(assunto.ilike.%25${searchTerms}%25,bairro.ilike.%25${searchTerms}%25)&limit=5&order=created_at.desc`,
        { headers }
      ).catch(() => null),

      // 4. Conversas WhatsApp (from base_conhecimento with categoria=WhatsApp)
      fetch(
        `${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao&categoria=eq.WhatsApp&limit=5&order=created_at.desc`,
        { headers }
      ).catch(() => null),
    ]);

    // Process knowledge base
    let kbContext = "";
    try {
      if (kbResp?.ok) {
        const kbData = await kbResp.json();
        if (kbData.length > 0) {
          kbContext = "\n\nBASE DE CONHECIMENTO (notícias, Instagram, informações relevantes):\n" +
            kbData.map((k: any) => `- [${k.fonte || k.categoria}] ${k.titulo}: ${k.descricao?.substring(0, 300) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("KB error:", e); }

    // Process scripts
    let scriptsContext = "";
    try {
      if (scriptsResp?.ok) {
        const scriptsData = await scriptsResp.json();
        if (scriptsData.length > 0) {
          scriptsContext = "\n\nSCRIPTS DE ATENDIMENTO (use como referência de tom e linguagem):\n" +
            scriptsData.map((s: any) => `- [${s.categoria}] ${s.titulo}: ${s.conteudo?.substring(0, 400) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("Scripts error:", e); }

    // Process previous oficio responses
    let oficiosContext = "";
    try {
      if (oficiosResp?.ok) {
        const oficiosData = await oficiosResp.json();
        if (oficiosData.length > 0) {
          oficiosContext = "\n\nRESPOSTAS ANTERIORES A CIDADÃOS (use como referência de estilo):\n" +
            oficiosData.map((o: any) => `- Assunto: ${o.assunto} | Bairro: ${o.bairro || "?"} | Resposta: ${o.resposta_cidadao?.substring(0, 400) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("Oficios error:", e); }

    // Process WhatsApp conversations
    let whatsappContext = "";
    try {
      if (whatsappResp?.ok) {
        const whatsappData = await whatsappResp.json();
        if (whatsappData.length > 0) {
          whatsappContext = "\n\nCONVERSAS EXPORTADAS DO WHATSAPP (contexto real de interações):\n" +
            whatsappData.map((w: any) => `- ${w.titulo}: ${w.descricao?.substring(0, 500) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("WhatsApp error:", e); }

    const midiasInfo = tem_midias
      ? `\nMÍDIAS ANEXADAS: Sim (${tipos_midias || "imagens/documentos"}). Mencione que as mídias foram recebidas e serão consideradas na análise.`
      : "\nMÍDIAS ANEXADAS: Não";

    const userPrompt = `Gere uma resposta para o cidadão com base nas seguintes informações:

PROTOCOLO/NÚMERO: ${numero || "Não atribuído ainda"}
SOLICITANTE: ${solicitante || "Cidadão(ã)"}
ASSUNTO: ${assunto || "Não informado"}
DESCRIÇÃO DA DEMANDA: ${descricao || "Não detalhada"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA/ÓRGÃO RESPONSÁVEL: ${secretaria || destinatario || "A ser identificado"}
TIPO DE DEMANDA: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}
${midiasInfo}${kbContext}${scriptsContext}${oficiosContext}${whatsappContext}

Gere a resposta seguindo a estrutura e tom definidos, utilizando todo o contexto disponível acima.`;

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
