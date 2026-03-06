import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DRIVE_FOLDER_ID = "1cdmdMwU9VV5aMosW9z03AUDXqidr-LvD";
const SPREADSHEET_ID = "1fpwxcbeim-1UsH8YopTtbAiWoHgXitXLPQTfygz8pKc";

// ── OAuth: get access token via refresh token ───────────────────────

async function getAccessTokenViaRefreshToken(): Promise<string> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "google_refresh_token")
    .single();

  if (error || !data?.value) {
    throw new Error(
      "Google Drive não autorizado. Vá em Configurações e clique em 'Autorizar Google Drive'."
    );
  }

  const refreshToken = data.value;
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurados.");
  }

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

  const tokens = await resp.json();
  return tokens.access_token;
}

// ── Google Drive Upload ─────────────────────────────────────────────

async function uploadToDrive(
  accessToken: string,
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata: Record<string, unknown> = {
    name: fileName,
  };
  if (DRIVE_FOLDER_ID) {
    metadata.parents = [DRIVE_FOLDER_ID];
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
    console.log("Getting access token via OAuth refresh token...");
    const accessToken = await getAccessTokenViaRefreshToken();
    console.log("Access token obtained successfully!");

    const contentType = req.headers.get("content-type") || "";

    let fileBytes: Uint8Array;
    let fileName = "oficio.pdf";
    let mimeType = "application/pdf";
    let metadata: Record<string, string> = {};

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "Nenhum arquivo enviado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      fileName = file.name || "oficio.pdf";
      mimeType = file.type || "application/pdf";
      fileBytes = new Uint8Array(await file.arrayBuffer());

      const metaStr = formData.get("metadata") as string | null;
      if (metaStr) {
        try { metadata = JSON.parse(metaStr); } catch {}
      }
    } else {
      const body = await req.json();
      const base64Data = body.file;
      fileName = body.fileName || "oficio.pdf";
      mimeType = body.mimeType || "application/pdf";
      metadata = body.metadata || {};
      fileBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    }

    // Upload to Google Drive
    console.log(`Uploading ${fileName} to Drive...`);
    const driveResult = await uploadToDrive(accessToken, fileBytes, fileName, mimeType);
    console.log(`Uploaded! File ID: ${driveResult.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        driveFileId: driveResult.id,
        driveLink: driveResult.webViewLink,
        message: "Arquivo enviado ao Drive e registrado na planilha!",
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
