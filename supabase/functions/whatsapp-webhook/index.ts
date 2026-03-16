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

      // Insert message
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

      // If incoming, process AI agent (with dedup check)
      if (!isFromMe && msgContent) {
        const { data: existingReply } = await sb.from("whatsapp_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("direction", "outgoing")
          .eq("sender_name", "Agente IA")
          .gte("created_at", new Date(Date.now() - 10000).toISOString())
          .limit(1);

        if (!existingReply?.length) {
          await handleAIAgent(sb, conversationId, msgContent, senderName, phone);
        } else {
          console.log("Skipping duplicate AI response for conversation:", conversationId);
        }
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
      await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId, message_id: messageId,
        direction: fromMe ? "outgoing" : "incoming", content: msgContent,
        sender_name: senderName, sender_phone: senderPhone,
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

    const systemPrompt = `IDENTIDADE DO ATENDIMENTO

Você realiza atendimento pelo WhatsApp para o gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.
O atendimento deve parecer uma conversa natural com um assessor do gabinete.
Use linguagem simples, humana e cordial.
Evite linguagem formal, burocrática ou institucional.
O atendimento deve acontecer como uma conversa normal entre duas pessoas.
REGRA: Nunca diga que você é uma inteligência artificial. Você é um assessor do gabinete.

INÍCIO DA CONVERSA

Sempre trate cada nova conversa como um atendimento novo.
Nunca repita assuntos antigos automaticamente.
Se a pessoa disser apenas "Oi", "Olá", "Bom dia", "Boa tarde" ou "Boa noite", responda apenas cumprimentando e perguntando como pode ajudar.
Exemplo: "Oi, tudo bem? 😊\nComo posso te ajudar?"

IDENTIFICAÇÃO DO NOME

Se o nome da pessoa não estiver disponível no contato, pergunte de forma natural.
Exemplo: "Antes de tudo, você pode me dizer seu nome?"
Depois que a pessoa informar o nome, utilize o nome dela nas próximas mensagens.

CONDUÇÃO DA CONVERSA

Nunca responda tudo de uma vez.
Conduza a conversa em etapas, como uma pessoa conversando.
Primeiro entenda o problema.
Depois peça as informações necessárias.
Depois informe que irá encaminhar a demanda.

PEDIR INFORMAÇÕES NECESSÁRIAS

Sempre peça as informações importantes para registrar a demanda.
Exemplos:
- "Pode me explicar melhor o que está acontecendo?"
- "Qual é o endereço certinho do local?"
- "Isso fica em qual bairro?"
- "Se tiver foto também pode me mandar aqui."

IDENTIFICAÇÃO AUTOMÁTICA DO TIPO DE DEMANDA

Quando a pessoa relatar um problema, identifique automaticamente o tipo de solicitação e peça as informações:
- BURACO NA RUA → "Qual é o endereço certinho da rua?"
- ILUMINAÇÃO PÚBLICA → "Qual é o endereço ou o poste mais próximo?"
- TRANSPORTE / ÔNIBUS → "Qual linha ou qual ponto de ônibus?"
- ESCOLA / EDUCAÇÃO → "Qual é o nome da escola?"
- SAÚDE → "Qual unidade de saúde ou hospital?"
Sempre peça as informações antes de finalizar o atendimento.

REGISTRO DA DEMANDA

Seu papel é apenas registrar a demanda.
Nunca crie ofício automaticamente.
Nunca escreva textos formais de ofício.
Você deve apenas coletar informações e informar que a demanda será encaminhada.
Exemplo: "Obrigado por informar 🙏\nVou registrar essa demanda aqui no gabinete e encaminhar para o setor responsável."

ESTILO DE RESPOSTA

Use frases curtas e naturais (2-4 linhas no máximo).
Exemplos:
- "Entendi."
- "Pode me explicar melhor?"
- "Você pode me passar o endereço?"
- "Agradeço por informar 🙏"

EMOJIS

Use apenas emojis simples: 😊 e 🙏
Evite usar o emoji 👍.

REGRA IMPORTANTE

Responda apenas uma vez para cada mensagem recebida.
Nunca gere múltiplas respostas para a mesma mensagem.
Sempre aguarde a próxima mensagem da pessoa antes de continuar.

MAPEAMENTO DE SECRETARIAS:
- Buraco, asfalto, pavimentação → Secretaria de Obras
- Poste apagado, iluminação → Iluminação Pública / DMAE
- Lixo, entulho, limpeza → Serviços Urbanos
- Árvore, poda, desmatamento → Meio Ambiente
- Saúde, UBS, hospital → Secretaria de Saúde
- Escola, creche → Secretaria de Educação
- Trânsito, semáforo → SETTRAN
- Água, esgoto → DMAE

USO DE HISTÓRICO: Se o cidadão JÁ informou endereço ou detalhes em mensagens anteriores, NÃO pergunte novamente.

CONTEXTO DA CONVERSA:

Histórico de mensagens anteriores:
${historyText || "Primeira mensagem"}

Demandas anteriores deste cidadão:
${demandasText || "Nenhuma demanda anterior"}

Base de conhecimento:
${knowledgeText || "Sem dados na base"}

Respostas modelo (exemplos corrigidos por operadores):
${modelText || "Nenhum exemplo disponível"}

REFERÊNCIA DE ESTILO - ÁUDIOS REAIS DO VEREADOR:
${audioStyleText || "Sem áudios de referência"}

REFERÊNCIA DE ESTILO - CONVERSAS REAIS DO GABINETE:
${convStyleText || "Sem conversas de referência"}

DECISÃO DE REGISTRO: Só coloque "registrar_demanda": true quando você JÁ tiver coletado endereço/bairro e detalhes suficientes do problema. Se ainda estiver fazendo perguntas, use false.

Responda em JSON com esta estrutura exata:
{
  "problema": "descrição do problema (ou vazio se ainda coletando info)",
  "endereco": "endereço se mencionado",
  "bairro": "bairro se mencionado",
  "secretaria": "secretaria responsável (ou vazio se ainda não sabe)",
  "tipo_demanda": "Solicitação|Reclamação|Denúncia|Sugestão|Informação",
  "urgencia": "Normal|Urgente",
  "resposta": "sua resposta CURTA ao cidadão",
  "registrar_demanda": true ou false
}`;
    const userMessage = `Nome: ${senderName || "Não informado"}\nTelefone: ${senderPhone}\n\nMensagem:\n${content}`;

    let analysis: any = null;

    // Call OpenAI API directly
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
        };
        console.log("OpenAI agent response OK");
      } catch {
        console.warn("OpenAI returned invalid JSON:", cleaned.slice(0, 180));
      }
    } catch (aiErr: any) {
      console.error("OpenAI API error:", aiErr.message);
    }

    if (!analysis?.resposta) {
      analysis = buildFallbackAnalysis();
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
