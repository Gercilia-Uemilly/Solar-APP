import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");

    if (!code) {
      // === STEP 1: Initiate OAuth — require admin auth ===
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Não autorizado. Faça login primeiro." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: userData, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Token inválido." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check admin role
      const { data: isAdmin } = await supabaseAdmin.rpc("is_admin", { _user_id: userData.user.id });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Apenas administradores podem autorizar o Google Drive." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate CSRF state token and store it
      const state = crypto.randomUUID();
      await supabaseAdmin
        .from("app_settings")
        .upsert(
          { key: "google_oauth_state", value: state, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );

      const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
      const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;
      const scope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets";

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scope);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      // Return the auth URL for the frontend to open (instead of 302 redirect)
      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === STEP 2: Google callback with code — verify state ===
    // Verify CSRF state
    const { data: storedStateRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "google_oauth_state")
      .single();

    const storedState = (storedStateRow as any)?.value;

    if (!returnedState || !storedState || returnedState !== storedState) {
      throw new Error("Estado OAuth inválido. Possível ataque CSRF. Tente novamente.");
    }

    // Clear the used state token
    await supabaseAdmin
      .from("app_settings")
      .delete()
      .eq("key", "google_oauth_state");

    // Exchange code for tokens
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

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
    console.log("Token exchange successful, refresh_token present:", !!tokens.refresh_token);

    if (!tokens.refresh_token) {
      throw new Error("No refresh_token returned. Make sure prompt=consent and access_type=offline.");
    }

    // Store refresh token
    const { error: upsertError } = await supabaseAdmin
      .from("app_settings")
      .upsert(
        { key: "google_refresh_token", value: tokens.refresh_token, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );

    if (upsertError) {
      throw new Error(`Failed to store refresh token: ${upsertError.message}`);
    }

    const html = `<!DOCTYPE html>
<html><head><title>Autorização concluída</title></head>
<body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f0f9ff;">
<div style="text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
<h1 style="color:#16a34a;">✅ Google Drive autorizado com sucesso!</h1>
<p>Você pode fechar esta janela e voltar ao sistema.</p>
</div></body></html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (e) {
    console.error("google-oauth-callback error:", e);
    const html = `<!DOCTYPE html>
<html><head><title>Erro</title></head>
<body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fef2f2;">
<div style="text-align:center;padding:2rem;background:white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
<h1 style="color:#dc2626;">❌ Erro na autorização</h1>
<p>${e instanceof Error ? e.message : "Erro desconhecido"}</p>
</div></body></html>`;
    return new Response(html, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});
