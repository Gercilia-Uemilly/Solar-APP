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

    const { action, api_url, api_key, instance_name } = await req.json();

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Action: create - Create/update connection and instance
    if (action === "create") {
      if (!api_url || !api_key || !instance_name) {
        return new Response(
          JSON.stringify({ error: "api_url, api_key e instance_name são obrigatórios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create instance on Evolution API
      const createUrl = `${api_url}/instance/create`;
      const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-webhook`;

      const createRes = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: api_key },
        body: JSON.stringify({
          instanceName: instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          webhook: {
            url: webhookUrl,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
              "MESSAGES_UPSERT",
              "CONNECTION_UPDATE",
              "QRCODE_UPDATED",
            ],
          },
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        console.error("Evolution create error:", createData);
        return new Response(
          JSON.stringify({ error: "Falha ao criar instância", details: createData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert connection record
      const { error: upsertErr } = await adminSb
        .from("whatsapp_connections")
        .upsert(
          {
            user_id: userData.user.id,
            instance_name,
            instance_id: createData?.instance?.instanceId || null,
            api_url,
            api_key,
            status: "connecting",
            qr_code: createData?.qrcode?.base64 || null,
          },
          { onConflict: "user_id" }
        );

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
        return new Response(JSON.stringify({ error: "Falha ao salvar conexão" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          ok: true,
          qr_code: createData?.qrcode?.base64 || null,
          instance: createData?.instance,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: status - Check connection status
    if (action === "status") {
      const { data: conn } = await adminSb
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (!conn) {
        return new Response(JSON.stringify({ status: "not_configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Optionally check live status from Evolution
      if (conn.api_url && conn.api_key) {
        try {
          const statusRes = await fetch(
            `${conn.api_url}/instance/connectionState/${conn.instance_name}`,
            { headers: { apikey: conn.api_key } }
          );
          const statusData = await statusRes.json();
          const liveStatus = statusData?.instance?.state || conn.status;

          if (liveStatus !== conn.status) {
            await adminSb
              .from("whatsapp_connections")
              .update({ status: liveStatus === "open" ? "connected" : liveStatus })
              .eq("id", conn.id);
            conn.status = liveStatus === "open" ? "connected" : liveStatus;
          }
        } catch {
          // Use cached status
        }
      }

      return new Response(JSON.stringify({ status: conn.status, connection: conn }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: disconnect
    if (action === "disconnect") {
      const { data: conn } = await adminSb
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (conn?.api_url && conn?.api_key) {
        try {
          await fetch(`${conn.api_url}/instance/logout/${conn.instance_name}`, {
            method: "DELETE",
            headers: { apikey: conn.api_key },
          });
        } catch {
          // Best effort
        }
      }

      await adminSb
        .from("whatsapp_connections")
        .update({ status: "disconnected", qr_code: null })
        .eq("user_id", userData.user.id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: qrcode - Get fresh QR code
    if (action === "qrcode") {
      const { data: conn } = await adminSb
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", userData.user.id)
        .single();

      if (!conn?.api_url || !conn?.api_key) {
        return new Response(JSON.stringify({ error: "Conexão não configurada" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const qrRes = await fetch(
        `${conn.api_url}/instance/connect/${conn.instance_name}`,
        { headers: { apikey: conn.api_key } }
      );
      const qrData = await qrRes.json();

      const qrCode = qrData?.base64 || qrData?.qrcode?.base64 || conn.qr_code;

      if (qrCode) {
        await adminSb
          .from("whatsapp_connections")
          .update({ qr_code: qrCode, status: "qr_ready" })
          .eq("id", conn.id);
      }

      return new Response(JSON.stringify({ qr_code: qrCode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("WhatsApp connect error:", e);
    return new Response(JSON.stringify({ error: e.message || "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
