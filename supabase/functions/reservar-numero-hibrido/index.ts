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

// ── Get max number from a Google Docs document ──────────────────────
// Reads the full document body and extracts numbers from all tables
// and paragraphs. Looks for patterns like "366", "366/2026", "Ofício 366"
async function getMaxNumeroFromDocs(accessToken: string, documentId: string): Promise<number> {
  try {
    const url = `https://docs.googleapis.com/v1/documents/${documentId}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`Google Docs API error: ${resp.status} ${errText}`);
      return 0;
    }
    const doc = await resp.json();
    let maxNum = 0;

    // Recursively extract text content from document elements
    const extractText = (elements: any[]): string[] => {
      const texts: string[] = [];
      if (!elements) return texts;
      for (const el of elements) {
        // Paragraphs
        if (el.paragraph?.elements) {
          for (const pe of el.paragraph.elements) {
            if (pe.textRun?.content) {
              texts.push(pe.textRun.content);
            }
          }
        }
        // Tables — iterate rows and cells
        if (el.table) {
          for (const row of el.table.tableRows || []) {
            for (const cell of row.tableCells || []) {
              if (cell.content) {
                texts.push(...extractText(cell.content));
              }
            }
          }
        }
        // Sections
        if (el.sectionBreak) continue;
        if (el.tableOfContents?.content) {
          texts.push(...extractText(el.tableOfContents.content));
        }
      }
      return texts;
    };

    const allTexts = extractText(doc.body?.content || []);

    // Extract numbers from all text fragments
    for (const text of allTexts) {
      // Match patterns: "366", "366/2026", "Ofício 366", "nº 366", "#366"
      const matches = text.matchAll(/(?:^|[^\d])(\d{1,4})(?:\/\d{4})?(?:$|[^\d])/g);
      for (const match of matches) {
        const n = parseInt(match[1], 10);
        // Only consider reasonable ofício numbers (1-9999)
        if (n > 0 && n < 10000 && n > maxNum) {
          maxNum = n;
        }
      }
    }

    console.log(`Google Docs max number found: ${maxNum}`);
    return maxNum;
  } catch (e) {
    console.warn("Error reading Google Docs:", e);
    return 0;
  }
}

// ── Optionally append the new number to the Google Doc ───────────────
async function appendNumeroToDoc(
  accessToken: string,
  documentId: string,
  numero: number,
  ano: number,
  userName: string
): Promise<void> {
  try {
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const textToAppend = `\n${numero}/${ano} — ${userName} — ${now} — Sistema Solar`;

    const url = `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              // endOfSegmentLocation inserts at the end of the body
              endOfSegmentLocation: {},
              text: textToAppend,
            },
          },
        ],
      }),
    });
  } catch (e) {
    console.warn("Error appending to Google Docs (non-fatal):", e);
  }
}

// ── Get a valid Google access token ──────────────────────────────────
async function getGoogleAccessToken(supabaseAdmin: any, userId: string): Promise<string | null> {
  const { data: tokenData } = await supabaseAdmin
    .from("user_drive_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!tokenData) return null;

  let accessToken = tokenData.access_token;
  const tokenExpiry = new Date(tokenData.token_expiry);

  if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshGoogleToken(tokenData.refresh_token);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("user_drive_tokens")
        .update({ access_token: accessToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
        .eq("id", tokenData.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (/invalid_grant|expired or revoked/i.test(message)) {
        await supabaseAdmin.from("user_drive_tokens").delete().eq("id", tokenData.id);
        return null;
      }
      throw e;
    }
  }

  return accessToken;
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
    const checkOnly: boolean = body.check_only === true;
    const markUsed: boolean = body.mark_used === true;
    const usedNumero: number = body.used_numero || 0;

    // ── Step 1: Try to get max number from Google Docs ───────────────
    let maxFromDocs = 0;
    let accessToken: string | null = null;
    let docsEnabled = false;

    // Get app settings for Google Docs config
    const { data: settings } = await supabaseAdmin
      .from("app_settings")
      .select("key, value")
      .in("key", ["numeracao_doc_id", "numeracao_doc_enabled"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });

    const documentId = settingsMap["numeracao_doc_id"];
    docsEnabled = settingsMap["numeracao_doc_enabled"] !== "false"; // enabled by default if doc_id exists

    if (documentId && docsEnabled) {
      accessToken = await getGoogleAccessToken(supabaseAdmin, userId);

      if (accessToken) {
        try {
          maxFromDocs = await getMaxNumeroFromDocs(accessToken, documentId);
          console.log(`Max number from Google Docs: ${maxFromDocs}`);
        } catch (e) {
          console.warn("Google Docs access failed (continuing with DB only):", e);
        }
      } else {
        console.warn("No Google token available — using DB only");
      }
    }

    // ── Check-only mode: return sync info without reserving ──────────
    if (checkOnly) {
      return new Response(
        JSON.stringify({
          check_only: true,
          docs_sync: !!(documentId && docsEnabled && accessToken),
          docs_enabled: docsEnabled,
          docs_configured: !!documentId,
          max_from_docs: maxFromDocs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 2: Reserve the next number using the DB function ────────
    const { data: reservedNum, error: rpcError } = await supabaseAdmin.rpc("reservar_proximo_numero", {
      p_ano: ano,
      p_user_id: userId,
      p_user_nome: userName,
      p_min_numero: maxFromDocs,
    });

    if (rpcError || !reservedNum) {
      return new Response(
        JSON.stringify({ error: "Não foi possível reservar número", details: rpcError?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Step 3: Optionally write back to Google Doc ──────────────────
    if (documentId && docsEnabled && accessToken) {
      await appendNumeroToDoc(accessToken, documentId, reservedNum, ano, userName);
    }

    const origem = documentId && docsEnabled ? "docs" : "sistema";

    return new Response(
      JSON.stringify({
        numero: reservedNum,
        ano,
        numero_completo: `${reservedNum}/${ano}`,
        origem,
        docs_sync: !!(documentId && docsEnabled && accessToken),
        max_from_docs: maxFromDocs,
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
