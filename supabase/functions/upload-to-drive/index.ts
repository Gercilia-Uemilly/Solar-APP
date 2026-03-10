import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_DRIVE_FOLDER_ID = "1cdmdMwU9VV5aMosW9z03AUDXqidr-LvD";

// ── Refresh a Google OAuth token ────────────────────────────────────
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

// ── Get access token for a specific user ────────────────────────────
async function getUserAccessToken(
  supabaseAdmin: any,
  userId: string
): Promise<{ accessToken: string; folderId: string | null; googleEmail: string } | null> {
  const { data: tokenData } = await supabaseAdmin
    .from("user_drive_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return null;

  let accessToken = tokenData.access_token;
  const tokenExpiry = new Date(tokenData.token_expiry);

  // Refresh if expired (with 5 min buffer)
  if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    console.log("Token expired, refreshing...");
    const refreshed = await refreshGoogleToken(tokenData.refresh_token);
    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from("user_drive_tokens")
      .update({ access_token: accessToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
  }

  return {
    accessToken,
    folderId: tokenData.drive_folder_id,
    googleEmail: tokenData.google_email,
  };
}

// ── Fallback: service account token via app_settings ────────────────
async function getServiceAccountToken(supabaseAdmin: any): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single();

  if (error || !data?.value) {
    throw new Error("Google Drive não autorizado. Conecte seu Google Drive em Configurações.");
  }

  const refreshed = await refreshGoogleToken(data.value);
  return refreshed.access_token;
}

// ── Google Drive Upload ─────────────────────────────────────────────
async function uploadToDrive(
  accessToken: string,
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
  folderId: string | null,
  description?: string,
  operadorNome?: string,
  operadorEmail?: string,
): Promise<{ id: string; webViewLink: string }> {
  const targetFolder = folderId || DEFAULT_DRIVE_FOLDER_ID;

  const metadata: Record<string, unknown> = {
    name: fileName,
    description: description || "",
    parents: [targetFolder],
  };

  if (operadorNome || operadorEmail) {
    metadata.properties = {
      ...(operadorNome ? { operador_nome: operadorNome } : {}),
      ...(operadorEmail ? { operador_email: operadorEmail } : {}),
    };
  }

  const boundary = "===BOUNDARY===";
  const metadataPart = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  const parts = [
    encoder.encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataPart}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    fileBytes,
    encoder.encode(`\r\n--${boundary}--`),
  ];

  const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  const resp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Drive upload error: ${resp.status} ${errText}`);
  }

  return resp.json();
}

// ── Main Handler ────────────────────────────────────────────────────
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

    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Try to get user's personal Drive token first, fallback to service account
    let accessToken: string;
    let userFolderId: string | null = null;
    let uploadMode = "service_account";

    const userToken = await getUserAccessToken(supabaseAdmin, userId);
    if (userToken) {
      accessToken = userToken.accessToken;
      userFolderId = userToken.folderId;
      uploadMode = "personal";
      console.log(`Using personal Drive token for user ${userId} (${userToken.googleEmail})`);
    } else {
      console.log("No personal token, falling back to service account...");
      accessToken = await getServiceAccountToken(supabaseAdmin);
    }

    // Parse request body
    const contentType = req.headers.get("content-type") || "";
    let fileBytes: Uint8Array;
    let fileName = "oficio.pdf";
    let mimeType = "application/pdf";
    let metadata: Record<string, string> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fileName = file.name || "oficio.pdf";
      mimeType = file.type || "application/pdf";
      fileBytes = new Uint8Array(await file.arrayBuffer());
      const metaStr = formData.get("metadata") as string | null;
      if (metaStr) {
        try { metadata = JSON.parse(metaStr); } catch { /* ignore */ }
      }
    } else {
      const body = await req.json();
      const base64Data = body.file;
      fileName = body.fileName || "oficio.pdf";
      mimeType = body.mimeType || "application/pdf";
      metadata = body.metadata || {};
      fileBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    }

    const operadorNome = metadata.operadorNome || "";
    const operadorEmail = metadata.operadorEmail || "";
    const description = metadata.description || (operadorNome ? `Criado por: ${operadorNome}${operadorEmail ? ` (${operadorEmail})` : ""}` : "");

    console.log(`Uploading ${fileName} to Drive (mode: ${uploadMode}, operator: ${operadorNome})`);
    const driveResult = await uploadToDrive(accessToken, fileBytes, fileName, mimeType, userFolderId, description, operadorNome, operadorEmail);
    console.log(`Uploaded! File ID: ${driveResult.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        driveFileId: driveResult.id,
        driveLink: driveResult.webViewLink,
        uploadMode,
        message: uploadMode === "personal"
          ? "Arquivo salvo no seu Google Drive pessoal!"
          : "Arquivo salvo no Drive do gabinete!",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("upload-to-drive error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
