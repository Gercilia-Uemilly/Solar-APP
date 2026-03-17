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
  saude: ["saude", "ubs", "hospital", "uai", "consulta", "medico", "exame", "urgente", "cirurgia", "internacao"],
  dengue: ["dengue", "mosquito", "aedes", "foco", "agua parada", "criadouro"],
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

// ── AI Agent (optimized — parallel DB + Lovable AI) ──
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
      resposta: `Olá${senderName ? ` ${senderName.split(" ")[0]}` : ""}, tudo bem?\n\nRecebi sua mensagem e já estou verificando.\n\nSe quiser enviar mais detalhes, manda por aqui.`,
      registrar_demanda: false, origem: "fallback",
    });

    // ── PARALLEL DB FETCH (all at once) ──
    const startDb = Date.now();
    const [
      historyRes,
      prevDemandasRes,
      knowledgeRes,
      scriptsRes,
      audioEntriesRes,
      adminRes,
    ] = await Promise.all([
      sb.from("whatsapp_messages")
        .select("direction, content, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true }).limit(20),
      sb.from("oficios")
        .select("assunto, destinatario, status, bairro, created_at")
        .or(`solicitante.ilike.%${senderName}%,contato_solicitante.eq.${senderPhone}`)
        .order("created_at", { ascending: false }).limit(5),
      sb.from("base_conhecimento")
        .select("titulo, descricao, orgao, bairro, palavras_chave, categoria, link")
        .order("created_at", { ascending: false }).limit(50),
      sb.from("scripts")
        .select("id, titulo, conteudo, categoria, tags")
        .order("favorito", { ascending: false }).limit(200),
      sb.from("base_conhecimento")
        .select("titulo, descricao, link, palavras_chave, categoria")
        .eq("categoria", "Áudio")
        .not("link", "is", null)
        .order("created_at", { ascending: false }).limit(20),
      sb.from("user_roles")
        .select("user_id").eq("role", "admin").limit(1).single(),
    ]);
    console.log(`DB parallel fetch: ${Date.now() - startDb}ms`);

    const history = historyRes.data || [];
    const scripts = scriptsRes.data || [];
    const audioEntries = audioEntriesRes.data || [];
    const knowledge = knowledgeRes.data || [];
    const prevDemandas = prevDemandasRes.data || [];
    const adminUserId = adminRes.data?.user_id;

    const historyText = history
      .map((m: any) => `[${m.direction === "incoming" ? "Cidadão" : "Gabinete"}]: ${m.content || ""}`)
      .join("\n");

    const demandasText = prevDemandas
      .map((d: any) => `- ${d.assunto} → ${d.destinatario} (${d.status}) ${d.bairro || ""}`)
      .join("\n");

    // Score knowledge
    const topKnowledge = knowledge
      .map((k: any) => ({ ...k, relevance: scoreMatch(content, k.titulo || "", k.palavras_chave || [], k.descricao || "") }))
      .sort((a: any, b: any) => b.relevance - a.relevance)
      .slice(0, 10);

    const knowledgeText = topKnowledge
      .map((k: any) => `- [${k.categoria || "Info"}] ${k.titulo}: ${(k.descricao || "").slice(0, 150)}${k.link ? ` Link: ${k.link}` : ""}`)
      .join("\n");

    // Score scripts
    const scoredScripts = scripts
      .map((s: any) => ({ ...s, match_score: scoreMatch(content, s.titulo || "", s.tags || [], s.conteudo || "") }))
      .sort((a: any, b: any) => b.match_score - a.match_score);

    const selectedScript = scoredScripts[0]?.match_score >= 3 ? scoredScripts[0] : null;

    // Score audio
    const incomingCount = history.filter((m: any) => m.direction === "incoming").length;
    const conversationAdvanced = incomingCount >= 3;

    const scoredAudios = audioEntries
      .map((a: any) => ({ ...a, match_score: scoreMatch(content, a.titulo || "", a.palavras_chave || [], a.descricao || "") }))
      .sort((a: any, b: any) => b.match_score - a.match_score);

    const candidateAudio = scoredAudios[0]?.match_score >= 5 ? scoredAudios[0] : null;
    let selectedAudio: any = null;
    if (candidateAudio && conversationAdvanced && selectedScript) {
      const audioKws = (candidateAudio.palavras_chave || []).map((k: string) => normalizeText(k));
      const scriptTags = (selectedScript.tags || []).map((t: string) => normalizeText(t));
      const tagOverlap = audioKws.some((kw: string) => scriptTags.includes(kw));
      if (tagOverlap) selectedAudio = candidateAudio;
    }

    if (selectedScript) console.log("Script matched:", selectedScript.titulo, "score:", selectedScript.match_score);
    else console.log("No script matched for:", content);

    // ── Greeting ──
    const brasiliaHour = (new Date().getUTCHours() - 3 + 24) % 24;
    const saudacao = brasiliaHour >= 5 && brasiliaHour < 12 ? "Bom dia" : brasiliaHour < 18 ? "Boa tarde" : "Boa noite";
    const isFirst = history.filter((m: any) => m.direction === "incoming").length <= 1;

    // Detect continuity responses (user answering a previous question)
    const continuityWords = ["sim", "não", "nao", "ainda não", "ainda nao", "ok", "pode", "quero", "já", "ja", "entendi", "beleza", "blz", "tá", "ta", "uhum", "aham"];
    const isContinuity = !isFirst && continuityWords.some(w => normalizeText(content).split(" ").length <= 4 && normalizeText(content).includes(w));

    // Get last topic from history for continuity
    const lastOutgoing = history.filter((m: any) => m.direction === "outgoing").slice(-1)[0];
    const lastTopic = lastOutgoing?.content || "";

    // ── COMPACT SYSTEM PROMPT ──
    const systemPrompt = `Você é assessor do Vereador Fabão de Uberlândia. Atende WhatsApp como humano — empático, natural, mineiro.

REGRAS DE TOM:
- Máximo 2-3 frases curtas por mensagem
- Fale como mineiro: "viu?", "tá?", "né?", "deixa eu te falar"
- Emojis: 😊 🙏 😕 😔. PROIBIDO: 👍
- PROIBIDO: "se precisar é só avisar", "qualquer coisa estou aqui", "posso ajudar em algo mais", "estou à disposição"
- NÃO use: "compreendo", "certamente", "prezado"
- NUNCA finalize atendimento. SEMPRE termine com pergunta útil

${isFirst ? "PRIMEIRA MSG: Apenas cumprimente natural. Ex: '" + saudacao + (senderName ? ", " + senderName.split(" ")[0] : "") + ", tudo bem? 😊' — SÓ ISSO. NÃO pergunte 'como posso te ajudar'. Deixe a pessoa falar." : "NÃO cumprimente de novo. NÃO repita o nome. Continue direto no assunto."}

${isContinuity ? `⚠️ CONTINUIDADE DETECTADA — o usuário respondeu "${content}" à sua última mensagem.
Sua última mensagem foi: "${lastTopic.slice(0, 300)}"
REGRA: Continue o fluxo anterior. NÃO busque novo script. NÃO mude de assunto. Avance para o PRÓXIMO PASSO do atendimento baseado no contexto.
Se a pessoa disse "sim" ou "já" → avance (envie link, informação, próximo passo)
Se disse "não" ou "ainda não" → ajude a pessoa a fazer (envie link, explique como)
SEMPRE termine com pergunta para continuar.` : ""}

${!isContinuity && selectedScript ? (() => {
  const urlRegex = /https?:\/\/[^\s),]+/g;
  const contentLinks = (selectedScript.conteudo || "").match(urlRegex) || [];
  const scriptKws = (selectedScript.tags || []).map((t: string) => normalizeText(t));
  const relatedKb = topKnowledge.find((k: any) => {
    if (!k.link) return false;
    const kKws = (k.palavras_chave || []).map((p: string) => normalizeText(p));
    return scriptKws.some((sk: string) => kKws.includes(sk) || normalizeText(k.titulo || "").includes(sk));
  });
  if (relatedKb?.link && !contentLinks.includes(relatedKb.link)) contentLinks.push(relatedKb.link);
  
  const linkBlock = contentLinks.length > 0
    ? `\n\n🔗 LINKS (OBRIGATÓRIO incluir na resposta):\n${contentLinks.map((l: string) => `→ ${l}`).join("\n")}\nEnvie assim: "Consigo te mandar o link aqui 😊👇\n[link]"\nNÃO incluir link = ERRO GRAVE.`
    : "";

  return `⚠️ SCRIPT ENCONTRADO NO BANCO (OBRIGATÓRIO USAR)

SCRIPT: "${selectedScript.titulo}"
CONTEÚDO:
${selectedScript.conteudo?.slice(0, 600) || ""}

REGRA DE FIDELIDADE (CRÍTICA):
- Sua resposta DEVE reproduzir o script_base acima com adaptação LEVE de tom
- NÃO invente nova resposta. NÃO mude o sentido. Apenas adapte levemente para tom mineiro
- Se tem link → SEMPRE incluir na resposta (ex: "Te mando o link aqui 😊👇\n[link]")
- NÃO incluir link quando existe = ERRO GRAVE
- Se não veio script → pedir mais informação ao cidadão
- Termine com pergunta${linkBlock}`;
})() : !isContinuity ? `Sem script encontrado. Processo:
1. Busque na BASE DE CONHECIMENTO abaixo
2. Se encontrar info com link → inclua o link
3. Se não encontrar → acolha e pergunte mais
4. NUNCA invente informação` : ""}

${selectedAudio ? `ÁUDIO VALIDADO: "${selectedAudio.titulo}"` : "Sem áudio validado."}

SCRIPTS TOP:
${scoredScripts.slice(0, 10).map((s: any) => `[${s.categoria}] ${s.titulo}: ${(s.conteudo || "").slice(0, 150)}`).join("\n")}

BASE:
${knowledgeText || "Sem dados"}

HISTÓRICO:
${historyText || "Primeira mensagem"}

Demandas: ${demandasText || "Nenhuma"}

Responda JSON: {"problema":"","endereco":"","bairro":"","secretaria":"","tipo_demanda":"Solicitação|Reclamação|Denúncia|Sugestão|Informação","urgencia":"Normal|Urgente","resposta":"texto curto","registrar_demanda":false,"audio_sugerido":""}`;

    const userMessage = `Nome: ${senderName || "Não informado"}\nTelefone: ${senderPhone}\nMensagem: ${content}`;

    // ── AI CALL (single, using Lovable AI gateway) ──
    let analysis: any = null;
    const startAi = Date.now();

    try {
      const LOVABLE_KEY = (Deno.env.get("LOVABLE_API_KEY") || "").trim();
      const OPENAI_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();

      let aiRes: Response;
      if (LOVABLE_KEY) {
        aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.8,
            max_tokens: 512,
          }),
        });
      } else if (OPENAI_KEY) {
        aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            temperature: 0.8,
            max_tokens: 512,
            response_format: { type: "json_object" },
          }),
        });
      } else {
        throw new Error("No AI key configured");
      }

      console.log(`AI call: ${Date.now() - startAi}ms`);

      if (aiRes!.ok) {
        const aiData = await aiRes!.json();
        const rawText = aiData.choices?.[0]?.message?.content || "";
        const cleaned = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
        try {
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
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
          console.log("AI response OK");
        } catch {
          console.warn("AI returned invalid JSON:", cleaned.slice(0, 150));
        }
      } else {
        const errText = await aiRes!.text();
        console.error("AI error:", aiRes!.status, errText.slice(0, 200));
      }
    } catch (aiErr: any) {
      console.error("AI call error:", aiErr.message);
    }

    if (!analysis?.resposta) {
      analysis = { ...buildFallbackAnalysis(), audio_sugerido: selectedAudio?.titulo || "" };
    }

    // ── UPDATE + SEND in parallel ──
    const { data: msgs } = await sb.from("whatsapp_messages")
      .select("id").eq("conversation_id", conversationId)
      .eq("direction", "incoming").order("created_at", { ascending: false }).limit(1);

    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const zapiUrl = resolveZapiSendUrl(ZAPI_INSTANCE_ID, ZAPI_TOKEN);

    // Update AI analysis on message + send Z-API in parallel
    const updatePromise = msgs?.[0]
      ? sb.from("whatsapp_messages").update({ ai_suggested_response: analysis.resposta, ai_analysis: analysis }).eq("id", msgs[0].id)
      : Promise.resolve();

    let sendPromise = Promise.resolve(null as any);
    if (zapiUrl && analysis.resposta) {
      const zapiPayload = JSON.stringify({ phone: senderPhone, message: analysis.resposta });
      console.log("Z-API send URL:", zapiUrl.replace(/\/token\/[^/]+/i, "/token/***"));

      sendPromise = (async () => {
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
        return { ok: sendRes.ok, data: sendData, status: sendRes.status };
      })();
    }

    const [, sendResult] = await Promise.all([updatePromise, sendPromise]);

    if (sendResult?.ok && !sendResult.data?.error) {
      // Insert outgoing message + update conversation in parallel
      await Promise.all([
        sb.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          message_id: sendResult.data?.messageId || crypto.randomUUID(),
          direction: "outgoing",
          content: analysis.resposta,
          status: "sent",
          sender_name: "Agente IA",
          sender_phone: senderPhone,
        }),
        sb.from("whatsapp_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId),
      ]);
      console.log("Auto-response sent successfully");

      // Send audio if validated
      if (analysis.audio_sugerido && selectedAudio && conversationAdvanced && selectedScript) {
        const matchedAudioEntry = audioEntries.find(
          (a: any) => normalizeText(a.titulo || "") === normalizeText(selectedAudio.titulo || "")
        );
        if (matchedAudioEntry?.link) {
          const audioUrl = matchedAudioEntry.link.startsWith("http")
            ? matchedAudioEntry.link
            : `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/midias/${matchedAudioEntry.link}`;
          const sendAudioUrl = zapiUrl.replace("/send-text", "/send-audio");
          let audioRes = await fetch(sendAudioUrl, { method: "POST", headers: buildZapiHeaders(false), body: JSON.stringify({ phone: senderPhone, audio: audioUrl }) });
          if (!audioRes.ok) {
            audioRes = await fetch(sendAudioUrl, { method: "POST", headers: buildZapiHeaders(true), body: JSON.stringify({ phone: senderPhone, audio: audioUrl }) });
          }
          await audioRes.text();
          console.log("Audio sent:", matchedAudioEntry.titulo);
        }
      }
    } else if (sendResult) {
      console.error("Z-API send failed:", sendResult.status, sendResult.data);
    }

    // Auto-register demand
    if (analysis.registrar_demanda && adminUserId) {
      await sb.from("oficios").insert({
        author_id: adminUserId,
        assunto: analysis.problema || content.slice(0, 100),
        destinatario: analysis.secretaria || "Prefeitura Municipal de Uberlândia",
        conteudo: `Demanda via WhatsApp.\nCidadão: ${senderName || "N/I"}\nTelefone: ${senderPhone}\nRelato: ${content}`,
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
    }

    // Passive Learning — fire and forget (non-blocking)
    if (incomingCount > 0 && incomingCount % 5 === 0) {
      passiveLearning(sb, conversationId, historyText, scripts, adminUserId).catch(
        (e) => console.error("Passive learning error:", e)
      );
    }
  } catch (e) {
    console.error("AI agent error:", e);
  }
}

// ── Passive Learning — silently improves scripts from real conversations ──
async function passiveLearning(
  sb: any,
  conversationId: string,
  historyText: string,
  existingScripts: any[],
  userId?: string
) {
  if (!historyText || historyText.length < 50) return;

  const apiKey = (Deno.env.get("GOOGLE_AI_API_KEY") || "").trim();
  if (!apiKey) return;

  const scriptsSummary = existingScripts
    .map((s: any) => `[${s.categoria}] ${s.titulo} | tags: ${(s.tags || []).join(",")}`)
    .join("\n");

  const prompt = `Analise esta conversa real de WhatsApp de um gabinete político e decida se deve CRIAR um novo script ou MELHORAR um existente.

SCRIPTS EXISTENTES (${existingScripts.length}):
${scriptsSummary}

CONVERSA:
${historyText}

REGRAS:
- Só sugira algo se a conversa revelar um padrão NOVO ou uma melhoria CLARA
- Script deve ser curto, estilo WhatsApp, primeiro passo da conversa
- SEMPRE terminar com pergunta
- Se não há nada novo para aprender, retorne []

Retorne JSON array (sem markdown):
[{"action":"create","titulo":"...","categoria":"...","palavras_chave":["..."],"script_base":"..."}]
ou
[{"action":"update","existing_script_id":"uuid","titulo":"...","script_base":"texto melhorado"}]
ou [] se nada novo`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: "Você é um sistema de aprendizado que melhora scripts de atendimento com base em conversas reais. Seja conservador: só sugira mudanças quando há um padrão claro." }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.3 },
    }),
  });

  if (!res.ok) return;

  const data = await res.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

  let suggestions: any[];
  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  } catch {
    return;
  }

  if (!suggestions?.length) return;

  const authorId = userId || (await sb.from("user_roles").select("user_id").eq("role", "admin").limit(1).single())?.data?.user_id;
  if (!authorId) return;

  for (const s of suggestions) {
    if (s.action === "update" && s.existing_script_id) {
      await sb.from("scripts").update({
        conteudo: s.script_base,
        tags: s.palavras_chave || [],
      }).eq("id", s.existing_script_id);
      console.log("📚 Script UPDATED by learning:", s.titulo);
    } else if (s.action === "create" && s.titulo) {
      await sb.from("scripts").insert({
        titulo: s.titulo,
        conteudo: s.script_base || "",
        categoria: s.categoria || "Outros",
        tags: s.palavras_chave || [],
        author_id: authorId,
      });
      console.log("📚 Script CREATED by learning:", s.titulo);
    }
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
