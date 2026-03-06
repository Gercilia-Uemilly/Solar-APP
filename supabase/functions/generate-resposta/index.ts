import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a assessora de comunicação do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.

Sua função é gerar respostas para cidadãos que enviaram demandas ao gabinete via WhatsApp. O tom deve ser como o de uma assessora experiente: **acolhedor, humano e profissional, mas sem formalidade excessiva**. Imagine que você está respondendo pelo WhatsApp mesmo.

## TOM DE VOZ (PRIORIDADE MÁXIMA — baseie-se nas CONVERSAS EXPORTADAS)
- Natural e próximo, como uma conversa real de WhatsApp
- Empático — demonstre que entendeu de verdade o problema
- Profissional sem ser burocrático
- Use expressões naturais como: "assim que tivermos retorno", "fico no aguardo", "qualquer novidade a gente volta aqui", "vou deixando anotado", "recebi sim", "entendi perfeitamente"
- NUNCA use linguagem de ofício formal (nada de "Prezado(a)", "vimos por meio desta", "para as devidas providências")
- Use "você" e não "Vossa Senhoria"
- Parágrafos curtos e diretos, como mensagens de WhatsApp

## ESTRUTURA DA RESPOSTA

1. **Saudação calorosa**: "Bom dia/Boa tarde, [Nome]!" (com ponto de exclamação, ser simpático)
2. **Confirmação de recebimento**: Confirmar que recebeu a mensagem e mídias de forma natural
3. **Demonstração de compreensão**: Parafrasear a demanda com suas palavras, mostrando que realmente leu e entendeu
4. **Registro**: Informar o protocolo de forma natural (não burocrática): "Já registrei aqui como protocolo [número]"
5. **Próximos passos**: Dizer o que vai fazer (encaminhar para secretaria X) de forma conversacional
6. **Fechamento natural**: Fechar como assessora que se importa: "Qualquer coisa, estou aqui!", "Obrigada pela paciência!"

## EXEMPLOS DE REFERÊNCIA

**Quando tem nome e demanda clara:**
"Bom dia, Maria! Recebi sua mensagem e as fotos da Rua Oscar Alvim. Entendi perfeitamente sua preocupação com os buracos, realmente está complicado por lá. Já registrei sua solicitação aqui como protocolo 45-2026-MARIA123. Vou encaminhar pra Secretaria de Obras e assim que tiver retorno eu volto a falar com você, ok?"

**Quando precisa de mais informações:**
"Olá, João! Tudo bem? Agradeço pelo contato e pelas imagens enviadas. Só pra conseguir encaminhar direitinho, você sabe me dizer se esse terreno fica antes ou depois daquela escolinha? Isso ajuda a localizar certinho no sistema da prefeitura. Fico no aguardo e já vou deixando anotado aqui."

**Quando já tem histórico:**
"Oi, Carla! Vi aqui que você já tinha falado sobre a iluminação da Praça Central. Recebi as novas fotos e realmente a situação piorou. Reforcei sua demanda com a Secretaria de Serviços Urbanos e coloquei prioridade. Qualquer novidade a gente volta aqui. Obrigada pela paciência!"

## REGRAS
- SEMPRE usar o nome da pessoa quando disponível (com "!" na saudação)
- Se não tiver nome, use "Olá! Tudo bem?"
- NUNCA prometer prazos específicos
- SEMPRE mencionar a secretaria/órgão quando identificado
- Mencionar mídias recebidas de forma natural ("recebi as fotos", "ouvi o áudio")
- Manter entre 3-5 frases/parágrafos curtos
- Retorne APENAS o texto da resposta, sem JSON, sem markdown
- PRIORIZE as CONVERSAS DO WHATSAPP como referência principal de tom e linguagem
- Use os SCRIPTS como referência complementar
- Use as NOTÍCIAS para contextualizar se relevante`;

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
    const [whatsappResp, kbResp, scriptsResp, oficiosResp] = await Promise.all([
      // 1. WhatsApp conversations (PRIORITY — main style reference)
      fetch(
        `${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao&categoria=eq.WhatsApp&limit=10&order=created_at.desc`,
        { headers }
      ).catch(() => null),

      // 2. Knowledge base (SOS, Instagram, uploads)
      fetch(
        `${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,fonte,categoria&categoria=neq.WhatsApp&or=(titulo.ilike.%25${searchTerms}%25,descricao.ilike.%25${searchTerms}%25)&limit=5`,
        { headers }
      ).catch(() => null),

      // 3. Scripts de atendimento
      fetch(
        `${supabaseUrl}/rest/v1/scripts?select=titulo,conteudo,categoria&limit=5&order=favorito.desc,updated_at.desc`,
        { headers }
      ).catch(() => null),

      // 4. Respostas de ofícios anteriores (modelo=true prioritários)
      fetch(
        `${supabaseUrl}/rest/v1/oficios?select=assunto,resposta_cidadao,secretaria_identificada,bairro,tipo_demanda&resposta_cidadao=not.is.null&or=(assunto.ilike.%25${searchTerms}%25,bairro.ilike.%25${searchTerms}%25)&limit=5&order=created_at.desc`,
        { headers }
      ).catch(() => null),
    ]);

    // Process WhatsApp conversations (PRIORITY)
    let whatsappContext = "";
    try {
      if (whatsappResp?.ok) {
        const whatsappData = await whatsappResp.json();
        if (whatsappData.length > 0) {
          whatsappContext = "\n\n🔴 CONVERSAS EXPORTADAS DO WHATSAPP (PRIORIDADE MÁXIMA — use como referência principal de tom, linguagem e estilo):\n" +
            whatsappData.map((w: any) => `---\n${w.titulo}:\n${w.descricao?.substring(0, 800) || ""}\n---`).join("\n");
        }
      }
    } catch (e) { console.error("WhatsApp error:", e); }

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
          scriptsContext = "\n\nSCRIPTS DE ATENDIMENTO:\n" +
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
          oficiosContext = "\n\nRESPOSTAS ANTERIORES A CIDADÃOS:\n" +
            oficiosData.map((o: any) => `- ${o.assunto} | ${o.bairro || "?"} | ${o.resposta_cidadao?.substring(0, 400) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("Oficios error:", e); }

    const midiasInfo = tem_midias
      ? `\nMÍDIAS ANEXADAS: Sim (${tipos_midias || "imagens/documentos"}). Mencione de forma natural que recebeu as mídias (ex: "recebi as fotos", "ouvi o áudio").`
      : "\nMÍDIAS ANEXADAS: Não";

    const protocolo = numero ? `${numero}` : "ainda não atribuído";

    const userPrompt = `Gere uma resposta para o cidadão via WhatsApp com base nas seguintes informações:

PROTOCOLO: ${protocolo}
NOME DO SOLICITANTE: ${solicitante || "Não informado"}
ASSUNTO: ${assunto || "Não informado"}
DEMANDA COMPLETA: ${descricao || "Não detalhada"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA/ÓRGÃO: ${secretaria || destinatario || "A ser identificado"}
TIPO: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}
${midiasInfo}${whatsappContext}${kbContext}${scriptsContext}${oficiosContext}

IMPORTANTE: Use o tom natural das conversas do WhatsApp como referência principal. A resposta deve soar como uma mensagem real de assessora, não como um documento oficial.`;

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
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
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
