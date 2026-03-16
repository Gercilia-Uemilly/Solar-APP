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

    const { data: userData, error: authErr } = await sb.auth.getUser();
    if (authErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { conversation_id, message } = await req.json();

    if (!conversation_id || !message) {
      return new Response(JSON.stringify({ error: "conversation_id e message são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    const zapiUrls = resolveZapiSendUrls(ZAPI_INSTANCE_ID, ZAPI_TOKEN);
    if (!zapiUrls.length) {
      return new Response(
        JSON.stringify({
          error: "Credenciais Z-API inválidas. Verifique ZAPI_INSTANCE_ID e ZAPI_TOKEN.",
          hint: "Você pode informar só o instance id, ou a URL completa da instância.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get conversation details
    const { data: conversation } = await adminSb
      .from("whatsapp_conversations")
      .select("*")
      .eq("id", conversation_id)
      .single();

    if (!conversation) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract phone from remote_jid
    const phone = conversation.remote_jid
      .replace("@s.whatsapp.net", "")
      .replace("@g.us", "");

    // Send message via Z-API (com fallback de endpoint)
    const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (ZAPI_CLIENT_TOKEN) zapiHeaders["Client-Token"] = ZAPI_CLIENT_TOKEN;

    let zapiData: any = null;
    let sent = false;
    let lastStatus = 500;

    for (const zapiUrl of zapiUrls) {
      const zapiResponse = await fetch(zapiUrl, {
        method: "POST",
        headers: zapiHeaders,
        body: JSON.stringify({ phone, message }),
      });

      const zapiText = await zapiResponse.text();
      const parsedData = parseJsonSafe(zapiText);

      if (zapiResponse.ok && !parsedData?.error) {
        zapiData = parsedData;
        sent = true;
        break;
      }

      lastStatus = zapiResponse.status;
      zapiData = parsedData;

      const isMethodNotFound =
        parsedData?.error === "NOT_FOUND" ||
        /matching target resource method/i.test(String(parsedData?.message || parsedData?.raw || ""));

      if (!isMethodNotFound) {
        break;
      }
    }

    if (!sent) {
      console.error("Z-API error:", { status: lastStatus, data: zapiData });
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

    // Update conversation
    await adminSb
      .from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation_id);

    return new Response(JSON.stringify({ ok: true, data: zapiData }), {
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
