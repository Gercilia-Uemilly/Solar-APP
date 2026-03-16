import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const parseJsonSafe = (raw: string) => {
  try { return raw ? JSON.parse(raw) : null; } catch { return { raw }; }
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authErr } = await sb.auth.getUser();
    if (authErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { conversation_id, message } = await req.json();
    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: "conversation_id e message são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = (Deno.env.get("ZAPI_CLIENT_TOKEN") || "").trim();

    const zapiUrl = resolveZapiSendUrl(ZAPI_INSTANCE_ID, ZAPI_TOKEN);
    if (!zapiUrl) {
      return new Response(
        JSON.stringify({ error: "Credenciais Z-API inválidas." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Z-API URL:", zapiUrl.replace(/\/token\/[^/]+/i, "/token/***"));

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conversation } = await adminSb
      .from("whatsapp_conversations").select("*").eq("id", conversation_id).single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = conversation.remote_jid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // Try WITHOUT Client-Token first
    console.log("Sending to phone:", phone);

    const zapiPayload = JSON.stringify({ phone, message });
    let zapiResponse = await fetch(zapiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: zapiPayload });
    let zapiText = await zapiResponse.text();
    let zapiData = parseJsonSafe(zapiText);
    console.log("Z-API response:", zapiResponse.status, zapiText.slice(0, 300));

    // If auth error, retry WITH Client-Token
    if (!zapiResponse.ok && zapiData?.error && ZAPI_CLIENT_TOKEN) {
      console.log("Retrying with Client-Token...");
      zapiResponse = await fetch(zapiUrl, { method: "POST", headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN }, body: zapiPayload });
      zapiText = await zapiResponse.text();
      zapiData = parseJsonSafe(zapiText);
      console.log("Z-API retry response:", zapiResponse.status, zapiText.slice(0, 300));
    }

    if (!zapiResponse.ok || zapiData?.error) {
      return new Response(
        JSON.stringify({ error: "Falha ao enviar mensagem", details: zapiData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save outgoing message
    await adminSb.from("whatsapp_messages").insert({
      conversation_id,
      message_id: zapiData?.messageId || crypto.randomUUID(),
      direction: "outgoing",
      content: message,
      status: "sent",
      sent_by: userId,
    });

    await adminSb.from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, data: zapiData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Send WhatsApp error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
