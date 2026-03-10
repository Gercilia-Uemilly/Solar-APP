import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      throw new Error(`Google OAuth error: ${error}`);
    }

    if (!code || !state) {
      throw new Error("Parâmetros inválidos.");
    }

    // Extract userId from state (format: userId:uuid)
    const userId = state.split(":")[0];
    if (!userId) throw new Error("Estado inválido.");

    // Verify CSRF state
    const { data: storedStateRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", `google_oauth_state_${userId}`)
      .single();

    if (!storedStateRow?.value || storedStateRow.value !== state) {
      throw new Error("Estado OAuth inválido. Possível ataque CSRF.");
    }

    // Clear used state
    await supabaseAdmin.from("app_settings").delete().eq("key", `google_oauth_state_${userId}`);

    // Exchange code for tokens
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-user-oauth-callback`;

    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      throw new Error(`Token exchange failed: ${tokenResp.status} ${errText}`);
    }

    const tokens = await tokenResp.json();

    if (!tokens.refresh_token) {
      throw new Error("Nenhum refresh_token retornado. Tente novamente com prompt=consent.");
    }

    // Get Google user email
    const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResp.json();
    const googleEmail = userInfo.email || "desconhecido";

    // Save tokens linked to user
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("user_drive_tokens")
      .upsert(
        {
          user_id: userId,
          google_email: googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      throw new Error(`Erro ao salvar tokens: ${upsertError.message}`);
    }

    console.log(`Google Drive connected for user ${userId} as ${googleEmail}`);

    const html = `<!DOCTYPE html>
<html><head><title>Google Drive Conectado</title></head>
<body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0f9ff;">
<div style="text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
<h1 style="color:#16a34a;">✅ Google Drive conectado!</h1>
<p>Conectado como: <strong>${googleEmail}</strong></p>
<p style="color:#666;">Você pode fechar esta janela e voltar ao sistema.</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'google-drive-connected', email: '${googleEmail}' }, '*');
  }
  setTimeout(() => window.close(), 3000);
</script>
</div></body></html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("google-user-oauth-callback error:", e);
    const html = `<!DOCTYPE html>
<html><head><title>Erro</title></head>
<body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fef2f2;">
<div style="text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
<h1 style="color:#dc2626;">❌ Erro na conexão</h1>
<p>${e instanceof Error ? e.message : "Erro desconhecido"}</p>
<script>setTimeout(() => window.close(), 5000);</script>
</div></body></html>`;
    return new Response(html, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
