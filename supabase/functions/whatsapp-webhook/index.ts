import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Handle connection status updates
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

    // Handle QR code updates
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

    // Handle incoming messages
    if (event === "messages.upsert" || event === "message") {
      const instanceName = body.instance?.instanceName || body.instanceName;
      const messageData = body.data?.message || body.message || body.data;

      if (!messageData || !instanceName) {
        return new Response(JSON.stringify({ ok: true, skipped: "no message data" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find connection
      const { data: connection } = await sb
        .from("whatsapp_connections")
        .select("id")
        .eq("instance_name", instanceName)
        .single();

      if (!connection) {
        console.error("Connection not found for instance:", instanceName);
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
        messageData.body ||
        "";
      const senderName = messageData.pushName || messageData.senderName || "";
      const senderPhone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const messageId = messageData.key?.id || messageData.id || crypto.randomUUID();

      // Skip status broadcasts and group messages for now
      if (remoteJid === "status@broadcast" || remoteJid.endsWith("@g.us")) {
        return new Response(JSON.stringify({ ok: true, skipped: "broadcast/group" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upsert conversation
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

      // Insert message
      await sb.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        message_id: messageId,
        direction: fromMe ? "outgoing" : "incoming",
        content: msgContent,
        sender_name: senderName,
        sender_phone: senderPhone,
        status: fromMe ? "sent" : "received",
      });

      // If incoming message, trigger AI analysis (async, don't block webhook)
      if (!fromMe && msgContent) {
        // Fire-and-forget AI analysis
        EdgeRuntime?.waitUntil?.(
          analyzeWithAI(sb, conversationId, msgContent, senderName, senderPhone)
        );
      }

      return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: acknowledge unknown events
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

// AI analysis helper
async function analyzeWithAI(
  sb: any,
  conversationId: string,
  content: string,
  senderName: string,
  senderPhone: string
) {
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY not set, skipping AI analysis");
      return;
    }

    const systemPrompt = `Você é a assessora de comunicação do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.

Analise a mensagem do cidadão e extraia as seguintes informações em formato JSON:
- problema: descrição do problema relatado
- endereco: endereço ou local mencionado (se houver)
- bairro: bairro mencionado (se houver)
- secretaria: secretaria municipal responsável (inferir com base no problema)
- tipo_demanda: classificação (Solicitação, Reclamação, Denúncia, Sugestão, Informação)
- urgencia: nível de urgência (Normal, Urgente)
- resposta_sugerida: resposta empática e natural para WhatsApp, no estilo do gabinete

A resposta sugerida deve:
- Cumprimentar pelo nome quando disponível
- Demonstrar empatia
- Confirmar recebimento
- Informar encaminhamento ao órgão responsável
- Ser curta e natural (estilo WhatsApp)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Nome do cidadão: ${senderName || "Não informado"}\nTelefone: ${senderPhone}\n\nMensagem:\n${content}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_message",
              description: "Analisa a mensagem do cidadão e retorna dados estruturados",
              parameters: {
                type: "object",
                properties: {
                  problema: { type: "string" },
                  endereco: { type: "string" },
                  bairro: { type: "string" },
                  secretaria: { type: "string" },
                  tipo_demanda: { type: "string", enum: ["Solicitação", "Reclamação", "Denúncia", "Sugestão", "Informação"] },
                  urgencia: { type: "string", enum: ["Normal", "Urgente"] },
                  resposta_sugerida: { type: "string" },
                },
                required: ["problema", "resposta_sugerida"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_message" } },
      }),
    });

    if (!response.ok) {
      console.error("AI analysis failed:", response.status);
      return;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall?.function?.arguments) {
      const analysis = JSON.parse(toolCall.function.arguments);

      // Get the latest message for this conversation and update it
      const { data: messages } = await sb
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("direction", "incoming")
        .order("created_at", { ascending: false })
        .limit(1);

      if (messages?.[0]) {
        await sb
          .from("whatsapp_messages")
          .update({
            ai_suggested_response: analysis.resposta_sugerida,
            ai_analysis: analysis,
          })
          .eq("id", messages[0].id);
      }
    }
  } catch (e) {
    console.error("AI analysis error:", e);
  }
}

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: { waitUntil?: (promise: Promise<any>) => void } | undefined;
