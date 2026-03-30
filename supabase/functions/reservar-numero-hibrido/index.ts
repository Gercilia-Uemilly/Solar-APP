import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Refresh Google token ─────────────────────────────────────────────
async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados.");

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google OAuth refresh error: ${resp.status} ${errText}`);
  }
  return resp.json();
}

// ── Get max number from Google Sheets ────────────────────────────────
async function getMaxNumeroFromSheet(accessToken: string, spreadsheetId: string, sheetRange: string): Promise<number> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      console.warn(`Sheets API error: ${resp.status}`);
      await resp.text();
      return 0;
    }
    const data = await resp.json();
    const values: string[][] = data.values || [];
    let maxNum = 0;
    for (const row of values) {
      for (const cell of row) {
        // Extract number from cells like "366", "366/2026", etc.
        const match = String(cell).trim().match(/^(\d+)/);
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      }
    }
    return maxNum;
  } catch (e) {
    console.warn("Error reading Google Sheets:", e);
    return 0;
  }
}

// ── Optionally write the new number back to the sheet ────────────────
async function appendNumeroToSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  numero: number,
  ano: number,
  userName: string
): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [[numero, `${numero}/${ano}`, userName, now, "Sistema Solar"]],
      }),
    });
  } catch (e) {
    console.warn("Error appending to Google Sheets (non-fatal):", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const ano: number = body.ano || new Date().getFullYear();
    const userName: string = body.user_nome || "";

    // ── Step 1: Try to get max number from Google Sheets ─────────────
    let maxFromSheet = 0;
    let accessToken: string | null = null;

    // Get app settings for spreadsheet config
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["numeracao_spreadsheet_id", "numeracao_sheet_range", "numeracao_sheet_name"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const spreadsheetId = settingsMap["numeracao_spreadsheet_id"];
    const sheetRange = settingsMap["numeracao_sheet_range"] || "Página1!A:A";
    const sheetName = settingsMap["numeracao_sheet_name"] || "Página1";

    if (spreadsheetId) {
      // Try to get a Google token from any user with drive connected
      const { data: tokenData } = await supabaseAdmin
        .from("user_drive_tokens")
        .select("*")
        .limit(1)
        .single();

      if (tokenData) {
        try {
          accessToken = tokenData.access_token;
          const tokenExpiry = new Date(tokenData.token_expiry);

          if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
            const refreshed = await refreshGoogleToken(tokenData.refresh_token);
            accessToken = refreshed.access_token;
            const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
            await supabaseAdmin
              .from("user_drive_tokens")
              .update({ access_token: accessToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
              .eq("id", tokenData.id);
          }

          maxFromSheet = await getMaxNumeroFromSheet(accessToken, spreadsheetId, sheetRange);
          console.log(`Max number from Google Sheets: ${maxFromSheet}`);
        } catch (e) {
          console.warn("Google Sheets access failed (continuing with DB only):", e);
        }
      }
    }

    // ── Step 2: Reserve the next number using the DB function ────────
    // Pass maxFromSheet so the DB can fill in any gaps
    const { data: reservedNum, error: rpcError } = await supabaseAdmin.rpc("reservar_proximo_numero", {
      p_ano: ano,
      p_user_id: userId,
      p_user_nome: userName,
      p_min_numero: maxFromSheet,
    });

    if (rpcError || !reservedNum) {
      return new Response(
        JSON.stringify({ error: "Não foi possível reservar número", details: rpcError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Optionally write back to sheet ──────────────────────
    if (spreadsheetId && accessToken) {
      await appendNumeroToSheet(accessToken, spreadsheetId, sheetName, reservedNum, ano, userName);
    }

    return new Response(
      JSON.stringify({
        numero: reservedNum,
        ano,
        numero_completo: `${reservedNum}/${ano}`,
        origem: spreadsheetId ? "hibrido" : "sistema",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("reservar-numero-hibrido error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
