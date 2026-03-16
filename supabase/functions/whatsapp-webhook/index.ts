import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const parseJsonSafe = (raw: string) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return { raw };
  }
};

const normalizeText = (value: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Synonym groups to expand matching
const SYNONYMS: Record<string, string[]> = {
  dinheiro: ["dinheiro", "grana", "empresta", "emprestimo", "sem dinheiro", "ajuda financeira", "real", "reais", "pagar", "fome", "passagem", "onibus", "aluguel", "conta", "doacao", "ajuda"],
  castração: ["castracao", "castrar", "castramóvel", "castramovel", "cachorro", "gato", "animal"],
  habitacao: ["casa popular", "casas populares", "habitacao", "apartamento", "moradia", "cheque moradia", "aluguel social"],
  iluminacao: ["poste", "poste apagado", "iluminacao", "luz", "lampada", "escuro"],
  buraco: ["buraco", "asfalto", "pavimentacao", "rua esburacada", "cratera"],
  agua: ["agua", "esgoto", "dmae", "vazamento", "falta de agua", "sem agua"],
  energia: ["energia", "cemig", "luz", "sem luz", "queda de energia"],
  saude: ["saude", "ubs", "hospital", "uai", "consulta", "medico", "exame"],
  escola: ["escola", "creche", "educacao", "matricula", "vaga"],
  emprego: ["emprego", "vaga", "trabalho", "curriculo", "desempregado"],
  transporte: ["transporte", "onibus", "tarifa", "passe", "tarifa zero"],
  capina: ["capina", "mato", "terreno", "limpeza", "roçar", "rocar"],
  animal: ["animal", "cachorro", "gato", "maus tratos", "abandono", "mordida"],
  lixo: ["lixo", "entulho", "coleta", "limpeza"],
};

const expandWithSynonyms = (text: string): string => {
  const normalized = normalizeText(text);
  const extra: string[] = [];
  for (const [, synonyms] of Object.entries(SYNONYMS)) {
    const matched = synonyms.some((s) => normalized.includes(normalizeText(s)));
    if (matched) {
      extra.push(...synonyms.map((s) => normalizeText(s)));
    }
  }
  return normalized + " " + extra.join(" ");
};

const scoreMatch = (userText: string, title = "", tags: string[] = [], content = "") => {
  const expandedUser = expandWithSynonyms(userText);
  let score = 0;

  const normalizedTitle = normalizeText(title);
  if (normalizedTitle && expandedUser.includes(normalizedTitle)) score += 8;

  for (const tag of tags || []) {
    const t = normalizeText(tag || "");
    if (t.length >= 3 && expandedUser.includes(t)) score += 5;
  }

  const titleWords = normalizedTitle.split(" ").filter((w) => w.length >= 3);
  for (const w of titleWords) {
    if (expandedUser.includes(w)) score += 2;
  }

  const contentWords = normalizeText(content).split(" ").filter((w) => w.length >= 4).slice(0, 30);
  for (const w of contentWords) {
    if (expandedUser.includes(w)) score += 0.5;
  }

  return score;
};

const resolveZapiSendUrl = (instanceRaw?: string | null, tokenRaw?: string | null) => {
  const inst = (instanceRaw || "").trim();
  const tok = (tokenRaw || "").trim();
  if (!inst || !tok) return "";
  if (/^https?:\/\//i.test(inst)) {
    try {
      const u = new URL(inst);
      const m = u.pathname.match(/\/instances\/([^/]+)\/token\/([^/]+)/i);
      if (m) return `${u.protocol}//${u.host}/instances/${m[1]}/token/${m[2]}/send-text`;
    } catch { /* fallthrough */ }
  }
  return `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
};

const buildZapiHeaders = (withToken = false) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withToken) {
    const clientToken = (Deno.env.get("ZAPI_CLIENT_TOKEN") || "").trim();
    if (clientToken) headers["Client-Token"] = clientToken;
  }
  return headers;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const event = body.event || body.type;

    // Handle Z-API message format (text, audio, image)
    const isZapiMessage = body.phone && (body.text || body.message || body.body || body.audio || body.image);

    if (isZapiMessage) {
      const phone = body.phone?.replace(/\D/g, "") || "";
      const senderName = body.senderName || body.chatName || body.name || "";
      let msgContent =
        body.text?.message ||
        body.body ||
        (typeof body.message === "string" ? body.message : body.message?.conversation) ||
        "";
      
      // Handle audio messages - transcribe via Gemini
      const audioUrl = body.audio?.audioUrl || body.audioMessage?.url || "";
      let mediaType: string | null = null;
      let mediaUrl: string | null = null;

      if (audioUrl && !msgContent) {
        mediaType = "audio";
        mediaUrl = audioUrl;
        try {
          const transcription = await transcribeAudio(audioUrl);
          if (transcription) {
            msgContent = `[ÁUDIO TRANSCRITO]: ${transcription}`;
            console.log("Audio transcribed:", transcription.slice(0, 100));
          } else {
            msgContent = "[Áudio recebido - não foi possível transcrever]";
          }
        } catch (e: any) {
          console.error("Audio transcription error:", e.message);
          msgContent = "[Áudio recebido - erro na transcrição]";
        }
      }

      // Handle image messages
      const imageUrl = body.image?.imageUrl || body.imageMessage?.url || "";
      if (imageUrl && !msgContent) {
        mediaType = "image";
        mediaUrl = imageUrl;
        msgContent = body.image?.caption || "[Imagem recebida]";
      }
      const messageId = body.messageId || body.id?.id || crypto.randomUUID();
      const isFromMe = body.fromMe === true;
      const remoteJid = `${phone}@s.whatsapp.net`;

      if (body.isGroup) {
        return new Response(JSON.stringify({ ok: true, skipped: "group" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find or use the first connection
      const { data: connections } = await sb
        .from("whatsapp_connections")
        .select("id")
        .eq("status", "connected")
        .limit(1);

      let connId: string;
      if (connections?.[0]?.id) {
        connId = connections[0].id;
      } else {
        const { data: allConns } = await sb.from("whatsapp_connections").select("id").limit(1);
        if (!allConns?.length) {
          console.error("No WhatsApp connection found");
          return new Response(JSON.stringify({ error: "No connection" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        connId = allConns[0].id;
      }

      // Upsert conversation
      const { data: existingConv } = await sb
        .from("whatsapp_conversations")
        .select("id, unread_count")
        .eq("connection_id", connId)
        .eq("remote_jid", remoteJid)
        .single();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
        await sb.from("whatsapp_conversations").update({
          contact_name: senderName || undefined,
          contact_phone: phone || undefined,
          last_message_at: new Date().toISOString(),
          unread_count: isFromMe ? existingConv.unread_count : (existingConv.unread_count || 0) + 1,
        }).eq("id", conversationId);
      } else {
        const { data: newConv } = await sb.from("whatsapp_conversations").insert({
          connection_id: connId,
          remote_jid: remoteJid,
          contact_name: senderName,
          contact_phone: phone,
          last_message_at: new Date().toISOString(),
          unread_count: isFromMe ? 0 : 1,
        }).select("id").single();
        conversationId = newConv!.id;
      }

      // Insert message (dedup by message_id)
      const { data: existingMsg } = await sb.from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("message_id", messageId)
        .limit(1);

      if (existingMsg?.length) {
        console.log("Skipping duplicate message:", messageId);
        return new Response(JSON.stringify({ ok: true, skipped: "duplicate_message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        message_id: messageId,
        direction: isFromMe ? "outgoing" : "incoming",
        content: msgContent,
        sender_name: senderName,
        sender_phone: phone,
        status: isFromMe ? "sent" : "received",
        media_type: mediaType,
        media_url: mediaUrl,
      });

      // If incoming, process AI agent
      if (!isFromMe && msgContent) {
        await handleAIAgent(sb, conversationId, msgContent, senderName, phone);
      }

      return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Legacy Evolution API format
    if (event === "connection.update" || event === "status.instance") {
      const instanceName = body.instance?.instanceName || body.instanceName;
      const state = body.data?.state || body.state || "unknown";
      if (instanceName) {
        await sb.from("whatsapp_connections")
          .update({ status: state === "open" ? "connected" : state })
          .eq("instance_name", instanceName);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "qrcode.updated") {
      const instanceName = body.instance?.instanceName || body.instanceName;
      const qrCode = body.data?.qrcode?.base64 || body.qrcode;
      if (instanceName && qrCode) {
        await sb.from("whatsapp_connections")
          .update({ qr_code: qrCode, status: "qr_ready" })
          .eq("instance_name", instanceName);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "messages.upsert" || event === "message") {
      const instanceName = body.instance?.instanceName || body.instanceName;
      const messageData = body.data?.message || body.message || body.data;
      if (!messageData || !instanceName) {
        return new Response(JSON.stringify({ ok: true, skipped: "no message data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: connection } = await sb.from("whatsapp_connections")
        .select("id").eq("instance_name", instanceName).single();
      if (!connection) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const remoteJid = messageData.key?.remoteJid || messageData.remoteJid || "";
      const fromMe = messageData.key?.fromMe || false;
      const msgContent = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || messageData.body || "";
      const senderName = messageData.pushName || messageData.senderName || "";
      const senderPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const messageId = messageData.key?.id || messageData.id || crypto.randomUUID();
      if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) {
        return new Response(JSON.stringify({ ok: true, skipped: "broadcast/group" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existingConv } = await sb.from("whatsapp_conversations")
        .select("id, unread_count").eq("connection_id", connection.id).eq("remote_jid", remoteJid).single();
      let conversationId: string;
      if (existingConv) {
        conversationId = existingConv.id;
        await sb.from("whatsapp_conversations").update({
          contact_name: senderName || undefined,
          contact_phone: senderPhone || undefined,
          last_message_at: new Date().toISOString(),
          unread_count: fromMe ? existingConv.unread_count : (existingConv.unread_count || 0) + 1,
        }).eq("id", conversationId);
      } else {
        const { data: newConv } = await sb.from("whatsapp_conversations").insert({
          connection_id: connection.id, remote_jid: remoteJid,
          contact_name: senderName, contact_phone: senderPhone,
          last_message_at: new Date().toISOString(), unread_count: fromMe ? 0 : 1,
        }).select("id").single();
        conversationId = newConv!.id;
      }
      const { data: existingMsgLegacy } = await sb.from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("message_id", messageId)
        .limit(1);

      if (existingMsgLegacy?.length) {
        console.log("Skipping duplicate legacy message:", messageId);
      } else {
        await sb.from("whatsapp_messages").insert({
          conversation_id: conversationId, message_id: messageId,
          direction: fromMe ? "outgoing" : "incoming", content: msgContent,
          sender_name: senderName, sender_phone: senderPhone,
          status: fromMe ? "sent" : "received",
        });

        if (!fromMe && msgContent) {
          await handleAIAgent(sb, conversationId, msgContent, senderName, senderPhone);
        }
      }
      return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, event: event || "unknown" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── AI Agent ──
async function handleAIAgent(
  sb: any,
  conversationId: string,
  content: string,
  senderName: string,
  senderPhone: string
) {
  try {
    const buildFallbackAnalysis = () => ({
      problema: content.slice(0, 180),
      endereco: "", bairro: "", secretaria: "",
      tipo_demanda: "Solicitação", urgencia: "Normal",
      resposta: `Olá${senderName ? ` ${senderName}` : ""}, tudo bem?\n\nRecebi sua mensagem e já estou verificando essa situação para você.\n\nAssim que eu tiver mais informações ou um retorno sobre isso, aviso por aqui.\n\nSe precisar enviar mais detalhes também pode me mandar por aqui.`,
      registrar_demanda: false, origem: "fallback",
    });

    // 1. Conversation history
    const { data: history } = await sb.from("whatsapp_messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }).limit(20);

    const historyText = (history || [])
      .map((m: any) => `[${m.direction === "incoming" ? "Cidadão" : "Gabinete"}]: ${m.content || ""}`)
      .join("\n");

    // 2. Previous demands
    const { data: prevDemandas } = await sb.from("oficios")
      .select("assunto, destinatario, status, bairro, created_at")
      .or(`solicitante.ilike.%${senderName}%,contato_solicitante.eq.${senderPhone}`)
      .order("created_at", { ascending: false }).limit(5);

    const demandasText = (prevDemandas || [])
      .map((d: any) => `- ${d.assunto} → ${d.destinatario} (${d.status}) ${d.bairro || ""}`)
      .join("\n");

    // 3. Knowledge base
    const { data: knowledge } = await sb.from("base_conhecimento")
      .select("titulo, descricao, orgao, bairro, palavras_chave").limit(30);

    const knowledgeText = (knowledge || [])
      .map((k: any) => `- ${k.titulo}: ${k.descricao?.slice(0, 100) || ""} (${k.orgao || "N/A"})`)
      .join("\n");

    // 4. Fetch model responses AND audio transcriptions for style reference
    const { data: modelResponses } = await sb.from("base_conhecimento")
      .select("titulo, descricao")
      .eq("modelo", true).limit(10);

    // 5. Fetch audio transcriptions (the vereador's real voice/style)
    const { data: audioTranscriptions } = await sb.from("base_conhecimento")
      .select("titulo, descricao")
      .eq("categoria", "Áudio")
      .not("descricao", "is", null)
      .order("created_at", { ascending: false }).limit(5);

    // 6. Fetch exported WhatsApp conversations for style reference
    const { data: exportedConversations } = await sb.from("base_conhecimento")
      .select("titulo, descricao")
      .eq("categoria", "Conversa WhatsApp")
      .eq("modelo", true)
      .not("descricao", "is", null)
      .order("created_at", { ascending: false }).limit(5);

    const modelText = (modelResponses || [])
      .map((r: any) => `- ${r.titulo}: ${r.descricao?.slice(0, 300) || ""}`)
      .join("\n");

    const audioStyleText = (audioTranscriptions || [])
      .map((a: any) => {
        const desc = a.descricao || "";
        const transcOnly = desc.split("RESUMO")[0].replace("TRANSCRIÇÃO:", "").trim();
        return transcOnly.slice(0, 400);
      })
      .filter((t: string) => t.length > 50)
      .join("\n---\n");

    // Extract only the Gabinete/Fabão responses from exported conversations
    const convStyleText = (exportedConversations || [])
      .map((c: any) => {
        const desc = c.descricao || "";
        // Extract lines that are from Fabão/Gabinete (outgoing responses)
        const lines = desc.split("\n");
        const gabineteLines = lines
          .filter((l: string) => /Fabão|Gabinete|Solar Labs/i.test(l) && l.length > 20)
          .slice(0, 5)
          .map((l: string) => l.replace(/^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}\s-\s[^:]+:\s*/, "").trim())
          .filter((l: string) => l.length > 10);
        return gabineteLines.join("\n");
      })
      .filter((t: string) => t.length > 20)
      .join("\n---\n");

    // Determine current greeting based on Brasília time (UTC-3)
    const now = new Date();
    const brasiliaHour = (now.getUTCHours() - 3 + 24) % 24;
    let saudacao = "Boa noite";
    if (brasiliaHour >= 5 && brasiliaHour < 12) saudacao = "Bom dia";
    else if (brasiliaHour >= 12 && brasiliaHour < 18) saudacao = "Boa tarde";

    // Check if last message from citizen was > 1 hour ago
    const lastIncoming = (history || []).filter((m: any) => m.direction === "incoming");
    const previousMsg = lastIncoming.length > 1 ? lastIncoming[lastIncoming.length - 2] : null;
    let delayNote = "";
    if (previousMsg) {
      const diff = Date.now() - new Date(previousMsg.created_at).getTime();
      if (diff > 3600000) delayNote = "A última mensagem do cidadão foi enviada há mais de 1 hora. Peça desculpa pela demora de forma natural.";
    }

    // 7. Fetch scripts for priority matching
    const { data: scripts } = await sb.from("scripts")
      .select("titulo, conteudo, categoria, tags")
      .order("favorito", { ascending: false }).limit(30);

    const scriptsText = (scripts || [])
      .map((s: any) => `[${s.categoria}] ${s.titulo}: ${s.conteudo?.slice(0, 300) || ""}`)
      .join("\n");

    // 8. Fetch audio entries for possible audio responses
    const { data: audioEntries } = await sb.from("base_conhecimento")
      .select("titulo, descricao, link, palavras_chave")
      .eq("categoria", "Áudio")
      .not("link", "is", null)
      .order("created_at", { ascending: false }).limit(20);

    const audioScriptsText = (audioEntries || [])
      .map((a: any) => `- ${a.titulo} (palavras-chave: ${(a.palavras_chave || []).join(", ")}): ${a.descricao?.slice(0, 100) || ""}`)
      .join("\n");

    const matchedScript = (scripts || [])
      .map((s: any) => ({
        ...s,
        match_score: scoreMatch(content, s.titulo || "", s.tags || [], s.conteudo || ""),
      }))
      .sort((a: any, b: any) => b.match_score - a.match_score)[0];

    const matchedAudio = (audioEntries || [])
      .map((a: any) => ({
        ...a,
        match_score: scoreMatch(content, a.titulo || "", a.palavras_chave || [], a.descricao || ""),
      }))
      .sort((a: any, b: any) => b.match_score - a.match_score)[0];

    const selectedScript = matchedScript?.match_score >= 3 ? matchedScript : null;
    const selectedAudio = matchedAudio?.match_score >= 3 ? matchedAudio : null;

    if (selectedScript) {
      console.log("Script matched:", selectedScript.titulo, "score:", selectedScript.match_score);
    } else {
      console.log("No script matched for:", content);
    }

    if (selectedAudio) {
      console.log("Audio matched:", selectedAudio.titulo, "score:", selectedAudio.match_score);
    }

    const systemPrompt = `Você é o assessor do gabinete do Vereador Fabão de Uberlândia. Conversa pelo WhatsApp como gente de verdade — igual o Fabão fala nos áudios e conversas dele.

JEITO DE FALAR:
- Fala como mineiro: "ô", "viu?", "tá?", "né?", "deixa eu te falar", "olha só"
- Frases CURTAS. Máximo 2-3 frases por mensagem
- Tom de amigo que trabalha no gabinete, não de robô
- NUNCA use palavras formais tipo "compreendo", "certamente", "entendo sua curiosidade", "prezado"
- USE emojis naturalmente: 😊 🙏 😔 ❤️ 🙌
- Pode usar "kkk" se for adequado ao contexto

EXEMPLOS DO JEITO CERTO (baseado nas conversas reais do Fabão):
- "Oi, ${saudacao.toLowerCase()}! 😊 Tudo bem com você? Como posso te ajudar?"
- "Então, colega, que situação difícil 😔 Deixa eu ver o que a gente consegue fazer, tá?"
- "Entendi! Me passa o endereço certinho que eu já encaminho aqui pro pessoal 🙏"
- "Ô, pode deixar! Vou registrar aqui e encaminhar pro setor responsável, viu? 😊"
- "Olha só, a gente tá nessa briga já tem tempo, viu?"

EXEMPLOS DO JEITO ERRADO (NUNCA fale assim):
- "Entendo sua curiosidade" ❌
- "Compreendo sua situação" ❌
- "Certamente irei verificar" ❌
- "Entendo. Você pode me passar o endereço?" ❌ (muito seco)

---

HORÁRIO: ${brasiliaHour}h → "${saudacao}"

PRIMEIRA MENSAGEM: "${saudacao}, tudo bem? 😊 Como posso te ajudar?"

CONVERSA JÁ COMEÇOU: NÃO cumprimente de novo. Continue natural.

${delayNote ? `ATRASO: ${delayNote}\nExemplo: "Oi! Desculpa a demora, viu? 🙏 Tava resolvendo umas coisas aqui..."` : ""}

NOME: Use só o primeiro nome. Se não tem, pergunte: "Me fala seu nome? 😊"

---

PRIORIDADE MÁXIMA: SCRIPTS E ÁUDIOS

${selectedScript ? `⚠️ SCRIPT ENCONTRADO: "${selectedScript.titulo}"
VOCÊ DEVE usar o conteúdo deste script como base da resposta. Adapte o tom pra ficar natural, mas USE o conteúdo.` : "Nenhum script encontrado para esta mensagem."}

${selectedAudio ? `⚠️ ÁUDIO ENCONTRADO: "${selectedAudio.titulo}"
Coloque o título exato no campo "audio_sugerido" do JSON.` : ""}

TODOS OS SCRIPTS:
${scriptsText || "Nenhum"}

ÁUDIOS DISPONÍVEIS:
${audioScriptsText || "Nenhum"}

---

EMPATIA: Sempre ANTES de dar informação. Exemplos:
- "Então, colega, imagino como tá difícil 😔"
- "Nossa, fulano/fulana, que situação complicada..."
- "Então, deixa eu te falar, isso é complicado mesmo"

NUNCA mande a pessoa procurar órgão por conta própria. O gabinete ACOLHE e ENCAMINHA.

PEDIDOS SENSÍVEIS (dinheiro, comida, etc):
- Seja empático e humano
- Se tiver script → use o script
- Se tiver áudio → mande o áudio
- Nunca responda seco

COLETA DE INFO: Peça uma coisa por vez — endereço, bairro, foto. Não tudo junto.

REGISTRO: Você NÃO cria ofício. Registra e encaminha.

PROIBIÇÕES: Não invente, não ignore scripts, não repita saudação, não crie ofício, não diga que é IA, não seja formal.

---

SECRETARIAS:
Buraco/asfalto → Obras | Poste → DMAE/Iluminação | Lixo → Serviços Urbanos | Árvore → Meio Ambiente | Saúde → Sec. Saúde | Escola → Sec. Educação | Trânsito → SETTRAN | Água → DMAE

HISTÓRICO (não repita perguntas já respondidas):
${historyText || "Primeira mensagem"}

Demandas anteriores: ${demandasText || "Nenhuma"}

Base de conhecimento: ${knowledgeText || "Sem dados"}

Respostas modelo: ${modelText || "Nenhum"}

ESTILO REAL DO FABÃO (áudios transcritos):
${audioStyleText || "Sem referência"}

CONVERSAS REAIS DO GABINETE:
${convStyleText || "Sem referência"}

REGISTRO: "registrar_demanda": true SOMENTE quando já tiver endereço/bairro e detalhes suficientes.

Responda em JSON:
{
  "problema": "descrição curta",
  "endereco": "se mencionado",
  "bairro": "se mencionado",
  "secretaria": "se identificada",
  "tipo_demanda": "Solicitação|Reclamação|Denúncia|Sugestão|Informação",
  "urgencia": "Normal|Urgente",
  "resposta": "sua resposta CURTA e NATURAL ao cidadão (max 3 frases)",
  "registrar_demanda": true/false,
  "audio_sugerido": "título exato do áudio ou vazio"
}`;
    const userMessage = `Nome: ${senderName || "Não informado"}\nTelefone: ${senderPhone}\n\nMensagem:\n${content}`;

    let analysis: any = null;

    if (selectedScript?.conteudo) {
      // When we have a matched script, still call AI but with a focused prompt to adapt the script naturally
      const firstName = (senderName || "").split(" ")[0] || "";
      try {
        const OPENAI_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
        if (OPENAI_KEY) {
          const adaptRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: `Você é assessor do vereador Fabão de Uberlândia. Adapte o script abaixo para uma resposta natural de WhatsApp.
Regras:
- Comece com empatia ("Então, colega...", "Então, fulano...", "Nossa...")
- Use linguagem informal mineira: "viu?", "tá?", "né?", "deixa eu te falar"
- Máximo 3 frases curtas
- Use emojis: 😊 🙏 😔
- ${firstName ? `Chame a pessoa de "${firstName}"` : "Não use nome"}
- NÃO use: "compreendo", "certamente", "entendo sua curiosidade"
- Adapte o conteúdo mas mantenha a informação essencial

SCRIPT ORIGINAL:
${selectedScript.conteudo}

MENSAGEM DO CIDADÃO:
${content}

Responda APENAS o texto adaptado, sem JSON.` },
              ],
              temperature: 0.9,
              max_tokens: 300,
            }),
          });
          if (adaptRes.ok) {
            const adaptData = await adaptRes.json();
            const adapted = adaptData.choices?.[0]?.message?.content?.trim() || "";
            if (adapted) {
              analysis = {
                problema: content.slice(0, 180),
                endereco: "", bairro: "", secretaria: "",
                tipo_demanda: "Informação", urgencia: "Normal",
                resposta: adapted,
                registrar_demanda: false,
                audio_sugerido: selectedAudio?.titulo || "",
                origem: "script_bank_adapted",
              };
              console.log("Using adapted script:", selectedScript.titulo);
            }
          }
        }
      } catch (e: any) {
        console.error("Script adaptation error:", e.message);
      }

      // Fallback: use script directly if adaptation failed
      if (!analysis?.resposta) {
        analysis = {
          problema: content.slice(0, 180),
          endereco: "", bairro: "", secretaria: "",
          tipo_demanda: "Informação", urgencia: "Normal",
          resposta: selectedScript.conteudo.trim(),
          registrar_demanda: false,
          audio_sugerido: selectedAudio?.titulo || "",
          origem: "script_bank",
        };
      }
      console.log("Script bank used:", selectedScript.titulo);
    }

    // Call OpenAI only when there is no script match
    if (!analysis?.resposta) {
      try {
        const OPENAI_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
        if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY not configured");

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.8,
            max_tokens: 1024,
            response_format: { type: "json_object" },
          }),
        });

        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          throw new Error(`OpenAI ${openaiRes.status}: ${errText.slice(0, 200)}`);
        }

        const openaiData = await openaiRes.json();
        const rawText = openaiData.choices?.[0]?.message?.content || "";
        const cleaned = rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        try {
          const parsed = JSON.parse(cleaned);
          analysis = {
            problema: parsed?.problema || content.slice(0, 180),
            endereco: parsed?.endereco || "",
            bairro: parsed?.bairro || "",
            secretaria: parsed?.secretaria || "",
            tipo_demanda: parsed?.tipo_demanda || "Solicitação",
            urgencia: parsed?.urgencia || "Normal",
            resposta: parsed?.resposta || "",
            registrar_demanda: Boolean(parsed?.registrar_demanda),
            audio_sugerido: parsed?.audio_sugerido || selectedAudio?.titulo || "",
          };
          console.log("OpenAI agent response OK");
        } catch {
          console.warn("OpenAI returned invalid JSON:", cleaned.slice(0, 180));
        }
      } catch (aiErr: any) {
        console.error("OpenAI API error:", aiErr.message);
      }
    }

    if (!analysis?.resposta) {
      analysis = {
        ...buildFallbackAnalysis(),
        audio_sugerido: selectedAudio?.titulo || "",
      };
    }

    // 5. Update message with AI analysis
    const { data: msgs } = await sb.from("whatsapp_messages")
      .select("id").eq("conversation_id", conversationId)
      .eq("direction", "incoming").order("created_at", { ascending: false }).limit(1);

    if (msgs?.[0]) {
      await sb.from("whatsapp_messages").update({
        ai_suggested_response: analysis.resposta,
        ai_analysis: analysis,
      }).eq("id", msgs[0].id);
    }

    // 6. Auto-respond via Z-API
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const zapiUrl = resolveZapiSendUrl(ZAPI_INSTANCE_ID, ZAPI_TOKEN);

    if (zapiUrl && analysis.resposta) {
      const zapiPayload = JSON.stringify({ phone: senderPhone, message: analysis.resposta });
      console.log("Z-API send URL:", zapiUrl.replace(/\/token\/[^/]+/i, "/token/***"));

      let sendRes = await fetch(zapiUrl, { method: "POST", headers: buildZapiHeaders(false), body: zapiPayload });
      let sendText = await sendRes.text();
      let sendData = parseJsonSafe(sendText);
      console.log("Z-API response:", sendRes.status, sendText.slice(0, 300));

      if (!sendRes.ok && sendData?.error) {
        console.log("Retrying with Client-Token...");
        sendRes = await fetch(zapiUrl, { method: "POST", headers: buildZapiHeaders(true), body: zapiPayload });
        sendText = await sendRes.text();
        sendData = parseJsonSafe(sendText);
        console.log("Z-API retry response:", sendRes.status, sendText.slice(0, 300));
      }

      if (sendRes.ok && !sendData?.error) {
        await sb.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          message_id: sendData?.messageId || crypto.randomUUID(),
          direction: "outgoing",
          content: analysis.resposta,
          status: "sent",
          sender_name: "Agente IA",
          sender_phone: senderPhone,
        });

        await sb.from("whatsapp_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);

        console.log("Auto-response sent successfully");

        // Send audio if suggested
        if (analysis.audio_sugerido) {
          const matchedAudio = (audioEntries || []).find(
            (a: any) => a.titulo?.toLowerCase().includes(analysis.audio_sugerido.toLowerCase()) ||
                         analysis.audio_sugerido.toLowerCase().includes(a.titulo?.toLowerCase() || "")
          );
          if (matchedAudio?.link) {
            const audioUrl = matchedAudio.link.startsWith("http") 
              ? matchedAudio.link 
              : `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/midias/${matchedAudio.link}`;
            
            const sendAudioUrl = zapiUrl.replace("/send-text", "/send-audio");
            const audioPayload = JSON.stringify({ phone: senderPhone, audio: audioUrl });
            
            let audioRes = await fetch(sendAudioUrl, { method: "POST", headers: buildZapiHeaders(false), body: audioPayload });
            if (!audioRes.ok) {
              audioRes = await fetch(sendAudioUrl, { method: "POST", headers: buildZapiHeaders(true), body: audioPayload });
            }
            const audioResText = await audioRes.text();
            console.log("Audio send result:", audioRes.status, audioResText.slice(0, 200));
          } else {
            console.log("Audio suggested but not found in bank:", analysis.audio_sugerido);
          }
        }
      } else {
        console.error("Z-API send failed:", sendRes.status, sendData);
      }
    }

    // 7. Auto-register demand if applicable
    if (analysis.registrar_demanda) {
      const { data: adminRole } = await sb.from("user_roles")
        .select("user_id").eq("role", "admin").limit(1).single();

      if (adminRole) {
        await sb.from("oficios").insert({
          author_id: adminRole.user_id,
          assunto: analysis.problema || content.slice(0, 100),
          destinatario: analysis.secretaria || "Prefeitura Municipal de Uberlândia",
          conteudo: `Demanda recebida via WhatsApp.\n\nCidadão: ${senderName || "Não informado"}\nTelefone: ${senderPhone}\n\nRelato:\n${content}`,
          solicitante: senderName || "Cidadão via WhatsApp",
          contato_solicitante: senderPhone,
          bairro: analysis.bairro || null,
          local_demanda: analysis.endereco || null,
          secretaria_identificada: analysis.secretaria || null,
          tipo_demanda: analysis.tipo_demanda || "Solicitação",
          urgencia: analysis.urgencia?.toLowerCase() || "normal",
          origem: "WhatsApp IA",
          status: "Rascunho",
        });
        console.log("Demand auto-registered:", analysis.problema?.slice(0, 60));
      }
    }
  } catch (e) {
    console.error("AI agent error:", e);
  }
}

// ── Audio Transcription via OpenAI GPT-4o-mini (multimodal) ──
async function transcribeAudio(audioUrl: string): Promise<string | null> {
  const OPENAI_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
  if (!OPENAI_KEY) {
    console.error("No OPENAI_API_KEY for audio transcription");
    return null;
  }

  // Download audio
  const audioRes = await fetch(audioUrl);
  if (!audioRes.ok) {
    console.error("Failed to download audio:", audioRes.status);
    return null;
  }

  const audioBuffer = await audioRes.arrayBuffer();
  const audioBytes = new Uint8Array(audioBuffer);
  
  // Convert to base64 in chunks to avoid stack overflow
  let base64 = "";
  const chunkSize = 8192;
  for (let i = 0; i < audioBytes.length; i += chunkSize) {
    const chunk = audioBytes.slice(i, i + chunkSize);
    base64 += String.fromCharCode(...chunk);
  }
  const audioBase64 = btoa(base64);

  const mimeType = audioRes.headers.get("content-type") || "audio/ogg";

  try {
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${audioBase64}` },
              },
              {
                type: "text",
                text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem formatação, sem aspas, sem explicações.",
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.warn(`Audio transcription failed (${openaiRes.status}): ${errText.slice(0, 100)}`);
      return null;
    }

    const data = await openaiRes.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";
    if (text) {
      console.log("Audio transcribed via OpenAI");
      return text;
    }
  } catch (e: any) {
    console.warn(`Audio transcription error: ${e.message}`);
  }

  return null;
}
