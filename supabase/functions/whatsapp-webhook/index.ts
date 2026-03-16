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

const resolveZapiSendUrls = (instanceRaw?: string | null, tokenRaw?: string | null) => {
  const instanceInput = (instanceRaw || "").trim();
  const tokenInput = (tokenRaw || "").trim();

  let instanceId = instanceInput;
  let token = tokenInput;

  if (/^https?:\/\//i.test(instanceInput)) {
    try {
      const parsed = new URL(instanceInput);
      const pathMatch = parsed.pathname.match(/\/instances\/([^/]+)(?:\/token\/([^/]+))?/i);
      if (pathMatch?.[1]) instanceId = decodeURIComponent(pathMatch[1]);
      if (!token && pathMatch?.[2]) token = decodeURIComponent(pathMatch[2]);
    } catch {
      // ignore malformed URL and keep raw value
    }
  }

  if (!instanceId || !token) {
    return [] as string[];
  }

  const base = `https://api.z-api.io/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}`;
  return [`${base}/send-text`, `${base}/send-message`];
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

    // ── Z-API format ──
    // Z-API sends: { phone, message, ... } or { event, ... }
    // Also support legacy Evolution API format for backwards compat

    const event = body.event || body.type;

    // Handle Z-API message received format
    // Z-API sends: { phone: "55...", message: { ... }, isGroup: false, ... }
    // or text shorthand: { phone: "55...", text: { message: "..." }, ... }
    const isZapiMessage =
      body.phone && (body.text || body.message || body.body);

    if (isZapiMessage) {
      const phone = body.phone?.replace(/\D/g, "") || "";
      const senderName = body.senderName || body.chatName || body.name || "";
      const msgContent =
        body.text?.message ||
        body.body ||
        (typeof body.message === "string" ? body.message : body.message?.conversation) ||
        "";
      const messageId = body.messageId || body.id?.id || crypto.randomUUID();
      const isFromMe = body.fromMe === true;
      const remoteJid = `${phone}@s.whatsapp.net`;

      // Skip groups
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

      const connectionId = connections?.[0]?.id;
      if (!connectionId) {
        // Auto-create a default connection record if none exists
        const { data: allConns } = await sb
          .from("whatsapp_connections")
          .select("id")
          .limit(1);

        if (!allConns?.length) {
          console.error("No WhatsApp connection found");
          return new Response(JSON.stringify({ error: "No connection" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Use whatever connection exists
        var connId = allConns[0].id;
      } else {
        var connId = connectionId;
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
        await sb
          .from("whatsapp_conversations")
          .update({
            contact_name: senderName || undefined,
            contact_phone: phone || undefined,
            last_message_at: new Date().toISOString(),
            unread_count: isFromMe
              ? existingConv.unread_count
              : (existingConv.unread_count || 0) + 1,
          })
          .eq("id", conversationId);
      } else {
        const { data: newConv } = await sb
          .from("whatsapp_conversations")
          .insert({
            connection_id: connId,
            remote_jid: remoteJid,
            contact_name: senderName,
            contact_phone: phone,
            last_message_at: new Date().toISOString(),
            unread_count: isFromMe ? 0 : 1,
          })
          .select("id")
          .single();

        conversationId = newConv!.id;
      }

      // Insert message
      await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        message_id: messageId,
        direction: isFromMe ? "outgoing" : "incoming",
        content: msgContent,
        sender_name: senderName,
        sender_phone: phone,
        status: isFromMe ? "sent" : "received",
      });

      // If incoming, process AI agent before returning (more reliable)
      if (!isFromMe && msgContent) {
        await handleAIAgent(sb, conversationId, msgContent, senderName, phone);
      }

      return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Legacy Evolution API format support ──
    if (event === "connection.update" || event === "status.instance") {
      const instanceName = body.instance?.instanceName || body.instanceName;
      const state = body.data?.state || body.state || "unknown";
      if (instanceName) {
        await sb
          .from("whatsapp_connections")
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
        await sb
          .from("whatsapp_connections")
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
      const { data: connection } = await sb
        .from("whatsapp_connections")
        .select("id")
        .eq("instance_name", instanceName)
        .single();
      if (!connection) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const remoteJid = messageData.key?.remoteJid || messageData.remoteJid || "";
      const fromMe = messageData.key?.fromMe || false;
      const msgContent =
        messageData.message?.conversation ||
        messageData.message?.extendedTextMessage?.text ||
        messageData.body || "";
      const senderName = messageData.pushName || messageData.senderName || "";
      const senderPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const messageId = messageData.key?.id || messageData.id || crypto.randomUUID();
      if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) {
        return new Response(JSON.stringify({ ok: true, skipped: "broadcast/group" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: existingConv } = await sb
        .from("whatsapp_conversations")
        .select("id, unread_count")
        .eq("connection_id", connection.id)
        .eq("remote_jid", remoteJid)
        .single();
      let conversationId: string;
      if (existingConv) {
        conversationId = existingConv.id;
        await sb
          .from("whatsapp_conversations")
          .update({
            contact_name: senderName || undefined,
            contact_phone: senderPhone || undefined,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? existingConv.unread_count : (existingConv.unread_count || 0) + 1,
          })
          .eq("id", conversationId);
      } else {
        const { data: newConv } = await sb
          .from("whatsapp_conversations")
          .insert({
            connection_id: connection.id,
            remote_jid: remoteJid,
            contact_name: senderName,
            contact_phone: senderPhone,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : 1,
          })
          .select("id")
          .single();
        conversationId = newConv!.id;
      }
      await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        message_id: messageId,
        direction: fromMe ? "outgoing" : "incoming",
        content: msgContent,
        sender_name: senderName,
        sender_phone: senderPhone,
        status: fromMe ? "sent" : "received",
      });
      if (!fromMe && msgContent) {
        await handleAIAgent(sb, conversationId, msgContent, senderName, senderPhone);
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── AI Agent: auto-analyze + auto-respond + auto-register demand ──
async function handleAIAgent(
  sb: any,
  conversationId: string,
  content: string,
  senderName: string,
  senderPhone: string
) {
  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    const buildFallbackAnalysis = () => ({
      problema: content.slice(0, 180),
      endereco: "",
      bairro: "",
      secretaria: "",
      tipo_demanda: "Solicitação",
      urgencia: "Normal",
      resposta: `Oi ${senderName || "colega"}, tudo bem? Recebi sua mensagem e já vou correr atrás disso pra você. Assim que eu tiver retorno te aviso por aqui. 👍`,
      registrar_demanda: false,
      origem: "fallback",
    });

    // 1. Fetch conversation history for context
    const { data: history } = await sb
      .from("whatsapp_messages")
      .select("direction, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    const historyText = (history || [])
      .map((m: any) => `[${m.direction === "incoming" ? "Cidadão" : "Gabinete"}]: ${m.content || ""}`)
      .join("\n");

    // 2. Fetch previous demands from this citizen
    const { data: prevDemandas } = await sb
      .from("oficios")
      .select("assunto, destinatario, status, bairro, created_at")
      .or(`solicitante.ilike.%${senderName}%,contato_solicitante.eq.${senderPhone}`)
      .order("created_at", { ascending: false })
      .limit(5);

    const demandasText = (prevDemandas || [])
      .map((d: any) => `- ${d.assunto} → ${d.destinatario} (${d.status}) ${d.bairro || ""}`)
      .join("\n");

    // 3. Fetch knowledge base for context
    const { data: knowledge } = await sb
      .from("base_conhecimento")
      .select("titulo, descricao, orgao, bairro, palavras_chave")
      .limit(30);

    const knowledgeText = (knowledge || [])
      .map((k: any) => `- ${k.titulo}: ${k.descricao?.slice(0, 100) || ""} (${k.orgao || "N/A"})`)
      .join("\n");

    // 4. Call Gemini AI directly
    const systemPrompt = `Você é o Vereador Fabão (gabinete do Vereador Fabão, Câmara Municipal de Uberlândia). Responda COMO SE FOSSE O PRÓPRIO FABÃO, usando o tom de voz dele.

TOM DE VOZ DO FABÃO (extraído de conversas reais):
- Começa cumprimentando pelo nome: "Oi [Nome]", "Bom dia [Nome]", "Oi Colega"
- Usa "tudo bem?", "tudo joia?" de forma natural
- Demonstra empatia genuína: "Meu Deus", "Sinto muito mesmo 😔", "Nossa, mas que estranho"
- Quando vai ajudar: "Pode deixar que eu vou correr atrás disso", "Vou verificar pra saber melhor"
- Indignação com injustiças: "Um absurdo", "Não concordo com isso e vou correr atrás", "ABSURDO 😡", "Não dá pra ficar dessa forma"
- Pede informações extras: "Só pra entender melhor...", "Me manda o endereço certinho"
- Oferece ajuda: "No que estiver ao meu alcance, estou à disposição", "Qualquer outra dúvida fica a vontade pra perguntar"
- Fornece dados úteis com emojis: 📞 telefones, 📍 endereços de secretarias
- Pede para salvar contato: "Peço que você salve este número nos seus contatos"
- Usa emojis com moderação: 😊👍 😔 😡 👊
- É BREVE e direto, como mensagens reais de WhatsApp
- NUNCA é formal demais, NUNCA usa "Prezado(a)", "Vossa Senhoria" etc.
- Fala como um amigo que se importa de verdade

EXEMPLOS REAIS DO FABÃO:
- "Bom dia Stefane, tudo bem minha amiga? Só pra entender melhor, qual é o motivo dos cancelamentos?"
- "Pode deixar que eu vou correr atrás disso. Me manda o endereço certinho."
- "Sinto muito mesmo que não tenha dado certo... 😔"
- "Infelizmente é uma resolução da prefeitura. Não concordo com isso e vou correr atrás. Um absurdo. Pode deixar que vou cobrar."
- "Vou salvar seu número aqui, e peço que você salve o meu também, por gentileza. Assim facilita a nossa comunicação."

CONTEXTO:

Histórico da conversa:
${historyText || "Primeira mensagem"}

Demandas anteriores deste cidadão:
${demandasText || "Nenhuma demanda anterior"}

Base de conhecimento:
${knowledgeText || "Sem dados na base"}

IMPORTANTE: Responda em JSON com esta estrutura exata:
{
  "problema": "descrição do problema",
  "endereco": "endereço se mencionado",
  "bairro": "bairro se mencionado",
  "secretaria": "secretaria responsável",
  "tipo_demanda": "Solicitação|Reclamação|Denúncia|Sugestão|Informação",
  "urgencia": "Normal|Urgente",
  "resposta": "sua resposta como Fabão",
  "registrar_demanda": true ou false
}`;

    const userMessage = `Nome: ${senderName || "Não informado"}\nTelefone: ${senderPhone}\n\nMensagem:\n${content}`;

    let analysis: any = null;

    if (GOOGLE_AI_API_KEY) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_AI_API_KEY}`;

      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.7,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (rawText) {
          try {
            analysis = JSON.parse(rawText);
          } catch {
            console.error("Failed to parse AI JSON:", rawText.slice(0, 200));
          }
        }
      } else {
        const errText = await response.text();
        console.error("Gemini AI failed:", response.status, errText);
      }
    } else {
      console.warn("GOOGLE_AI_API_KEY not set, using fallback auto-response");
    }

    if (!analysis?.resposta) {
      analysis = buildFallbackAnalysis();
    }

    // 5. Update message with AI analysis
    const { data: msgs } = await sb
      .from("whatsapp_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("direction", "incoming")
      .order("created_at", { ascending: false })
      .limit(1);

    if (msgs?.[0]) {
      await sb
        .from("whatsapp_messages")
        .update({
          ai_suggested_response: analysis.resposta,
          ai_analysis: analysis,
        })
        .eq("id", msgs[0].id);
    }

    // 6. Auto-respond via Z-API
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    const zapiUrls = resolveZapiSendUrls(ZAPI_INSTANCE_ID, ZAPI_TOKEN);

    if (zapiUrls.length && analysis.resposta) {
      const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (ZAPI_CLIENT_TOKEN) zapiHeaders["Client-Token"] = ZAPI_CLIENT_TOKEN;

      let sendData: any = null;
      let sent = false;
      let lastStatus = 500;

      for (const zapiUrl of zapiUrls) {
        const sendRes = await fetch(zapiUrl, {
          method: "POST",
          headers: zapiHeaders,
          body: JSON.stringify({ phone: senderPhone, message: analysis.resposta }),
        });

        const sendText = await sendRes.text();
        const parsedData = parseJsonSafe(sendText);

        if (sendRes.ok && !parsedData?.error) {
          sendData = parsedData;
          sent = true;
          break;
        }

        lastStatus = sendRes.status;
        sendData = parsedData;

        const isMethodNotFound =
          parsedData?.error === "NOT_FOUND" ||
          /matching target resource method/i.test(String(parsedData?.message || parsedData?.raw || ""));

        if (!isMethodNotFound) {
          break;
        }
      }

      if (sent) {
        await sb.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          message_id: sendData?.messageId || crypto.randomUUID(),
          direction: "outgoing",
          content: analysis.resposta,
          status: "sent",
          sender_name: "Agente IA",
          sender_phone: senderPhone,
        });

        await sb
          .from("whatsapp_conversations")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", conversationId);

        console.log("Auto-response sent", { phone: senderPhone, messageId: sendData?.messageId || null });
      } else {
        console.error("Z-API send failed:", lastStatus, sendData);
      }
    }

    // 7. Auto-register demand if applicable
    if (analysis.registrar_demanda) {
      const { data: adminRole } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1)
        .single();

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
      }
    }
  } catch (e) {
    console.error("AI agent error:", e);
  }
}

declare const EdgeRuntime: { waitUntil?: (promise: Promise<any>) => void } | undefined;
