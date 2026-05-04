import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_REDIRECT_URI = "https://solar-ia.lovable.app/auth/google/callback";

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

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { action } = body;

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── GET AUTH URL ────────────────────────────────────────────
    if (action === "get_auth_url") {
      // ALWAYS use production domain — Google Console only has this URI registered
      const redirectUri = "https://solar-ia.lovable.app/auth/google/callback";
      const state = `${userId}:${crypto.randomUUID()}`;

      console.log("[OAuth] redirect_uri being used:", redirectUri);

      // Store state + redirect_uri for CSRF validation and callback
      await supabaseAdmin
        .from("app_settings")
        .upsert(
          { key: `google_oauth_state_${userId}`, value: JSON.stringify({ state, redirect_uri: redirectUri }), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      // Full Drive permission is required because uploads are saved into an existing
      // gabinete folder; drive.file only works reliably for files/folders created or
      // explicitly opened by this app and can return SCOPE_INSUFFICIENT on upload.
      authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/documents.readonly");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);

      console.log("[OAuth] Full auth URL redirect_uri param:", authUrl.searchParams.get("redirect_uri"));

      return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EXCHANGE CODE ───────────────────────────────────────────
    if (action === "exchange_code") {
      const { code, state } = body;

      if (!code || !state) {
        throw new Error("Parâmetros code/state ausentes.");
      }

      // Verify CSRF state matches the user and recover redirect_uri
      const { data: storedStateRow } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", `google_oauth_state_${userId}`)
        .single();

      let storedState: string;
      let storedRedirectUri: string = DEFAULT_REDIRECT_URI;
      try {
        const parsed = JSON.parse(storedStateRow?.value || "");
        storedState = parsed.state;
        storedRedirectUri = parsed.redirect_uri || DEFAULT_REDIRECT_URI;
      } catch {
        storedState = storedStateRow?.value || "";
      }

      if (!storedState || storedState !== state) {
        throw new Error("Estado OAuth inválido. Possível ataque CSRF.");
      }

      // Clear used state
      await supabaseAdmin.from("app_settings").delete().eq("key", `google_oauth_state_${userId}`);

      console.log("[OAuth exchange] Using redirect_uri:", storedRedirectUri);

      // Exchange code for tokens — use the SAME redirect_uri from the auth step
      const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: storedRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        throw new Error(`Token exchange failed: ${tokenResp.status} ${errText}`);
      }

      const tokens = await tokenResp.json();

      if (!tokens.refresh_token) {
        throw new Error("Nenhum refresh_token retornado. Tente novamente.");
      }

      // Get Google user email
      const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResp.json();
      const googleEmail = userInfo.email || "desconhecido";

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

      return new Response(JSON.stringify({ success: true, email: googleEmail }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISCONNECT ──────────────────────────────────────────────
    if (action === "disconnect") {
      const { data: tokenRow } = await supabaseAdmin
        .from("user_drive_tokens")
        .select("access_token, refresh_token")
        .eq("user_id", userId)
        .single();

      const tokenToRevoke = tokenRow?.refresh_token || tokenRow?.access_token;
      if (tokenToRevoke) {
        try {
          await fetch("https://oauth2.googleapis.com/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: tokenToRevoke }),
          });
        } catch (revokeError) {
          console.warn("Falha ao revogar token Google; removendo vínculo local mesmo assim:", revokeError);
        }
      }

      await supabaseAdmin
        .from("user_drive_tokens")
        .delete()
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET STATUS ──────────────────────────────────────────────
    if (action === "status") {
      const { data } = await supabaseAdmin
        .from("user_drive_tokens")
        .select("google_email, drive_folder_id")
        .eq("user_id", userId)
        .single();

      return new Response(
        JSON.stringify({
          connected: !!data,
          google_email: data?.google_email || null,
          drive_folder_id: data?.drive_folder_id || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE FOLDER ───────────────────────────────────────────
    if (action === "update_folder") {
      const { folder_id } = body;
      await supabaseAdmin
        .from("user_drive_tokens")
        .update({ drive_folder_id: folder_id || null, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-user-oauth error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
