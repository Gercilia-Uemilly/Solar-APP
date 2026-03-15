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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authErr } = await sb.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, message, connection_id } = await req.json();

    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: "conversation_id e message são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation details
    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conversation } = await adminSb
      .from("whatsapp_conversations")
      .select("*, whatsapp_connections(*)")
      .eq("id", conversation_id)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conn = conversation.whatsapp_connections;
    if (!conn?.api_url || !conn?.api_key) {
      return new Response(
        JSON.stringify({ error: "Conexão WhatsApp não configurada. Configure a URL e API Key da Evolution API." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send message via Evolution API
    const evolutionUrl = `${conn.api_url}/message/sendText/${conn.instance_name}`;
    const evolutionResponse = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: conn.api_key,
      },
      body: JSON.stringify({
        number: conversation.remote_jid.replace("@s.whatsapp.net", ""),
        text: message,
      }),
    });

    const evolutionData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error("Evolution API error:", evolutionData);
      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem", details: evolutionData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save outgoing message
    await adminSb.from("whatsapp_messages").insert({
      conversation_id,
      message_id: evolutionData?.key?.id || crypto.randomUUID(),
      direction: "outgoing",
      content: message,
      status: "sent",
      sent_by: userData.user.id,
    });

    // Update conversation
    await adminSb
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, data: evolutionData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Send WhatsApp error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
