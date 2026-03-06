import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DRIVE_FOLDER_ID = "11PsuRSq3QpU2GrWZxHW-cZOTxCvYgIcC";
const SPREADSHEET_ID = "1fpwxcbeim-1UsH8YopTtbAiWoHgXitXLPQTfygz8pKc";

// ── Google Auth via Service Account JWT ──────────────────────────────

function base64url(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJWT(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)));
  const claimB64 = base64url(encoder.encode(JSON.stringify(claim)));
  const signInput = `${headerB64}.${claimB64}`;

  // Import private key
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signInput)
  );

  const sigB64 = base64url(new Uint8Array(signature));
  return `${signInput}.${sigB64}`;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJWT(serviceAccount);
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google OAuth error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  return data.access_token;
}

// ── Google Drive Upload ─────────────────────────────────────────────

async function uploadToDrive(
  accessToken: string,
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID],
  };

  // Note: driveId is NOT set in metadata — parents alone is sufficient
  // supportsAllDrives=true in the URL handles shared drive support

  // Multipart upload
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

  // Combine parts
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

// ── Google Sheets Append ────────────────────────────────────────────

async function appendToSheet(
  accessToken: string,
  row: string[]
): Promise<void> {
  const range = "Página1!A:Z";
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Sheets append error: ${resp.status} ${errText}`);
  }
}

// ── Main Handler ────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not configured");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

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

      // Extract metadata from form
      const metaStr = formData.get("metadata") as string | null;
      if (metaStr) {
        try { metadata = JSON.parse(metaStr); } catch {}
      }
    } else {
      const body = await req.json();
      // Base64 encoded file
      const base64Data = body.file;
      fileName = body.fileName || "oficio.pdf";
      mimeType = body.mimeType || "application/pdf";
      metadata = body.metadata || {};
      fileBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    }

    // 1. Upload to Google Drive
    console.log(`Uploading ${fileName} to Drive...`);
    const driveResult = await uploadToDrive(accessToken, fileBytes, fileName, mimeType);
    console.log(`Uploaded! File ID: ${driveResult.id}`);

    // 2. Append metadata to Google Sheets
    const now = new Date();
    const dataFormatada = now.toLocaleDateString("pt-BR");
    const horaFormatada = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const row = [
      metadata.numero || "",
      dataFormatada,
      horaFormatada,
      metadata.assunto || "",
      metadata.destinatario || "",
      metadata.secretaria || "",
      metadata.bairro || "",
      metadata.solicitante || "",
      metadata.contato_solicitante || "",
      metadata.tipo_demanda || "",
      metadata.urgencia || "",
      metadata.operador || "",
      metadata.status || "Gerado",
      driveResult.webViewLink || "",
      driveResult.id || "",
    ];

    console.log("Appending to Sheets...");
    await appendToSheet(accessToken, row);
    console.log("Sheet updated!");

    // 3. Return result
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
