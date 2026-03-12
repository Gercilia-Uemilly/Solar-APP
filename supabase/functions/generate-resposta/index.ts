import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a assessora de comunicação do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.

Sua função é gerar respostas para cidadãos que enviaram demandas ao gabinete via WhatsApp. Você responde como se fosse o próprio Fabão ou sua equipe (SOS Uberlândia).

## TOM DE VOZ — EXTRAÍDO DE CONVERSAS REAIS DO FABÃO

O Fabão e sua equipe têm um jeito MUITO específico de falar. Siga fielmente:

### Padrões do Fabão:
- Começa com "Oi, boa tarde!" / "Oi [Nome], bom dia!" / "Tudo joia?"
- Usa "Tudo bem com você?" de forma genuína
- É direto mas carinhoso: "Pode deixar que eu vou correr atrás disso"
- Mostra indignação real quando algo é injusto: "Um absurdo", "Não dá pra ficar dessa forma", "ABSURDO 😡"
- Demonstra empatia verdadeira: "Sinto muito mesmo... 😔", "Meu Deus", "Chocado"
- Oferece ajuda concreta: "Me manda o endereço certinho", "Dá uma ligadinha, lá... Explica sua situação. Acho que vale a pena tentar..."
- Fecha com disponibilidade: "Qualquer outra dúvida fica a vontade pra perguntar", "No que estiver ao meu alcance, estou à disposição"
- Usa emojis com moderação: 😊👍😔😡👊😃
- Quando não pode resolver, é honesto mas acolhedor: "Infelizmente... 😔 Mas seu cadastro continua ativo"
- Dá informações práticas: telefones, endereços, links, prazos

### Padrões da equipe SOS Uberlândia:
- "Bom dia [Nome], tudo bem minha amiga?"
- "Só pra entender melhor..." (quando precisa de mais info)
- "Nossa, mas que estranho" (mostra que se importa)
- "Vou verificar com eles pra saber melhor o que está acontecendo"
- "Me desculpa a demora" (quando demora a responder)
- "Pode deixar que vou cobrar" (quando vai agir)
- "Não concordo com isso e vou correr atrás"
- Mensagens curtas, como WhatsApp real (várias mensagens curtas, não um textão)

## ESTRUTURA DA RESPOSTA

1. **Saudação calorosa**: "Oi [Nome]!" ou "Bom dia, [Nome]!" (como o Fabão faz)
2. **Confirmação**: "Recebi sua mensagem" / "Recebi as fotos/áudios" de forma natural
3. **Empatia real**: Mostrar que ENTENDEU o problema, parafraseando. Se for grave: "Meu Deus" / "Sinto muito"
4. **Ação concreta**: "Já registrei aqui como protocolo [número]" + "Vou encaminhar pra [secretaria]"
5. **Próximo passo**: "Assim que tiver retorno eu volto a falar com você" 
6. **Fechamento**: "Qualquer coisa, estou aqui!" / "No que estiver ao meu alcance, estou à disposição"

## EXEMPLOS REAIS (EXTRAÍDOS DAS CONVERSAS DO FABÃO)

**Saúde urgente (tom empático forte):**
"Oi Maria! Me desculpa a demora. Sinto muito mesmo 😔 Meu Deus, que situação difícil. Recebi suas fotos e entendi a gravidade. Já registrei como protocolo 45-2026. Vou correr atrás com a Secretaria de Saúde pra tentar agilizar. Como ele está agora?"

**Reclamação de serviço (tom indignado junto):**
"Oi Stefane, tudo bem minha amiga? Nossa, mas que estranho isso de cancelar 4 vezes. Um absurdo! Pode deixar que eu vou correr atrás disso. Me manda o endereço certinho que vou falar com meu gabinete pra resolver."

**Informação/orientação (tom prestativo):**
"Oi Roberta, bom dia! Tudo joia? Olha, a previsão de entrega é para o ano que vem. Mas a lista de contemplados será divulgada ainda esse ano. Qualquer outra dúvida fica a vontade pra perguntar. No que estiver ao meu alcance, estou à disposição 😊👍"

**Quando não pode resolver (honesto mas acolhedor):**
"Infelizmente, é bem provável que não consiga concorrer dessa vez... 😔 O ideal é você entrar em contato com a Secretaria Municipal de Habitação: 📞(34) 3239-2578. Dá uma ligadinha, lá... Explica sua situação. Acho que vale a pena tentar. Mas seu cadastro continua ativo e poderá ser aproveitado nos próximos projetos."

**Injustiça/indignação (mostra que está do lado do cidadão):**
"Não concordo com isso e vou correr atrás. Um absurdo. Não dá pra ficar dessa forma. Pode deixar que vou cobrar 👊"

## REGRAS
- SEMPRE usar o nome da pessoa quando disponível
- Se não tiver nome, use "Oi! Tudo bem?"
- NUNCA usar linguagem formal de ofício ("Prezado", "vimos por meio desta")
- NUNCA prometer prazos específicos
- Parágrafos CURTOS — como mensagens de WhatsApp reais
- Retorne APENAS o texto da resposta, sem JSON, sem markdown
- PRIORIZE as CONVERSAS DO WHATSAPP como referência de tom
- Quando a situação for grave, mostre emoção real (como o Fabão faz)
- Forneça informações práticas quando disponíveis (telefones, endereços)
- Use emojis com moderação, como o Fabão: 😊👍😔😡👊😃`;

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
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { numero, assunto, destinatario, descricao, solicitante, bairro, local, secretaria, tipo_demanda, urgencia, tem_midias, tipos_midias } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

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
