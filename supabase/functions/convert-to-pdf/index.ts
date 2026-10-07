import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sanitizeDocxFilename(name?: string): string {
  const raw = (name || "oficio.docx").trim();
  const cleaned = raw
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");

  const withFallback = cleaned || "oficio.docx";
  return withFallback.toLowerCase().endsWith(".docx")
    ? withFallback
    : `${withFallback}.docx`;
}

function isPdfBytes(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 5) return false;
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D; // %PDF-
}

function ensurePdfBytes(bytes: Uint8Array, provider: string): Uint8Array {
  if (!isPdfBytes(bytes)) {
    throw new Error(`${provider}: resposta inválida (não-PDF)`);
  }
  return bytes;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function toBase64Url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").trim();
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

type GoogleServiceAccountKey = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function parseServiceAccountKey(raw: string): GoogleServiceAccountKey {
  const candidates = [raw.trim()];

  try {
    const decoded = new TextDecoder().decode(decodeBase64(raw.trim()));
    candidates.push(decoded);
  } catch {
    // Not base64, continue with raw JSON candidate
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as GoogleServiceAccountKey;
      if (parsed?.client_email && parsed?.private_key) {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY inválida: informe o JSON da chave de serviço.");
}

function pemPrivateKeyToArrayBuffer(privateKeyPem: string): ArrayBuffer {
  const normalizedPem = privateKeyPem.replace(/\\n/g, "\n");
  const base64 = normalizedPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const bytes = decodeBase64(base64);
  return new Uint8Array(bytes).buffer;
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  const rawServiceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!rawServiceAccountKey) return null;

  const serviceAccount = parseServiceAccountKey(rawServiceAccountKey);
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const jwtPayload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const unsignedToken = `${toBase64Url(JSON.stringify(jwtHeader))}.${toBase64Url(JSON.stringify(jwtPayload))}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemPrivateKeyToArrayBuffer(serviceAccount.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const assertion = `${unsignedToken}.${toBase64Url(new Uint8Array(signature))}`;

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Google service account token error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  if (!data?.access_token) {
    throw new Error(`Google service account token sem access_token: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

// ── Google Drive conversion helpers ──────────────────────────────────────────
async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
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

  return resp.json();
}

async function getUserGoogleAccessToken(
  supabaseAdmin: any,
  userId: string
): Promise<{ accessToken: string; googleEmail: string } | null> {
  const { data: tokenData } = await supabaseAdmin
    .from("user_drive_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenData) return null;

  let accessToken = tokenData.access_token as string;
  const tokenExpiry = new Date(tokenData.token_expiry as string);

  // Refresh if expired (with 5 min buffer)
  if (tokenExpiry.getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshGoogleToken(tokenData.refresh_token as string);
      accessToken = refreshed.access_token;
      const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from("user_drive_tokens")
        .update({
          access_token: accessToken,
          token_expiry: newExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      // Token revogado/expirado permanentemente: trata como desconectado
      if (/invalid_grant|expired or revoked/i.test(message)) {
        await supabaseAdmin.from("user_drive_tokens").delete().eq("user_id", userId);
        return null;
      }

      throw e;
    }
  }

  return {
    accessToken,
    googleEmail: (tokenData.google_email as string) || "",
  };
}

function buildMultipartRelatedBody(
  metadata: Record<string, unknown>,
  fileBytes: Uint8Array,
  fileMimeType: string,
  boundary: string
): Uint8Array {
  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const fileHeader = encoder.encode(
    `--${boundary}\r\nContent-Type: ${fileMimeType}\r\n\r\n`
  );
  const footer = encoder.encode(`\r\n--${boundary}--`);

  const totalLength = metadataPart.length + fileHeader.length + fileBytes.length + footer.length;
  const body = new Uint8Array(totalLength);

  let offset = 0;
  body.set(metadataPart, offset);
  offset += metadataPart.length;

  body.set(fileHeader, offset);
  offset += fileHeader.length;

  body.set(fileBytes, offset);
  offset += fileBytes.length;

  body.set(footer, offset);
  return body;
}

async function uploadDocxAsGoogleDoc(
  accessToken: string,
  docxBytes: Uint8Array,
  filename: string
): Promise<string> {
  const boundary = `===BOUNDARY_${crypto.randomUUID()}===`;
  const metadata = {
    name: `tmp_convert_${filename.replace(/\.docx$/i, "")}_${Date.now()}`,
    mimeType: "application/vnd.google-apps.document",
  };

  const body = buildMultipartRelatedBody(
    metadata,
    docxBytes,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    boundary
  );

  const resp = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType",
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
    throw new Error(`GoogleDrive upload error: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  if (!data?.id) {
    throw new Error(`GoogleDrive upload sem id: ${JSON.stringify(data)}`);
  }

  return data.id as string;
}

async function exportGoogleDocToPdf(accessToken: string, fileId: string): Promise<Uint8Array> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent("application/pdf")}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GoogleDrive export error: ${resp.status} ${errText}`);
  }

  const pdfBytes = new Uint8Array(await resp.arrayBuffer());
  return ensurePdfBytes(pdfBytes, "GoogleDrive");
}

async function removeGoogleDriveFile(accessToken: string, fileId: string): Promise<void> {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    console.error("GoogleDrive cleanup failed:", e);
  }
}

// Clean up old temporary conversion files from Drive to free quota
async function cleanupOldTempFiles(accessToken: string): Promise<void> {
  try {
    const query = encodeURIComponent("name contains 'tmp_convert_' and trashed = false");
    const resp = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,createdTime)&pageSize=100&orderBy=createdTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resp.ok) return;
    const data = await resp.json();
    const files = data.files || [];
    if (files.length === 0) return;
    console.log(`[cleanup] Found ${files.length} temp files in Drive, deleting...`);
    for (const file of files) {
      await removeGoogleDriveFile(accessToken, file.id);
    }
    console.log(`[cleanup] Deleted ${files.length} temp files`);
  } catch (e) {
    console.error("[cleanup] Failed to clean temp files:", e);
  }
}

// Also empty trash to actually free quota
async function emptyDriveTrash(accessToken: string): Promise<void> {
  try {
    await fetch("https://www.googleapis.com/drive/v3/files/trash", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (_) {
    // ignore
  }
}

async function convertWithGoogleDrive(
  docxBytes: Uint8Array,
  filename: string,
  accessToken: string
): Promise<Uint8Array> {
  let tempFileId: string | null = null;
  try {
    tempFileId = await uploadDocxAsGoogleDoc(accessToken, docxBytes, filename);
    return await exportGoogleDocToPdf(accessToken, tempFileId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // ⚠️ Quando dá storageQuotaExceeded (típico em service account com lixeira cheia
    //   de arquivos antigos tmp_convert_*), tentamos limpar e fazer UMA retry. Se
    //   continuar falhando, propagamos para o próximo provider.
    if (msg.includes("storageQuotaExceeded") || msg.includes("quotaExceeded")) {
      console.log("[convertWithGoogleDrive] Quota exceeded — tentando limpar lixeira/temp e retry uma vez");
      try {
        await cleanupOldTempFiles(accessToken);
        await emptyDriveTrash(accessToken);
        tempFileId = await uploadDocxAsGoogleDoc(accessToken, docxBytes, filename);
        return await exportGoogleDocToPdf(accessToken, tempFileId);
      } catch (retryErr) {
        const rmsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.log("[convertWithGoogleDrive] Retry após cleanup também falhou:", rmsg);
        throw retryErr;
      }
    }
    throw e;
  } finally {
    if (tempFileId) {
      // fire-and-forget para não gastar CPU em cleanup quando já vamos cair fora
      removeGoogleDriveFile(accessToken, tempFileId).catch(() => {});
    }
  }
}

// Converte um .docx para PDF usando provedores em cascata
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await _sb.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const contentType = req.headers.get("content-type") || "";

    let docxBytes: Uint8Array;
    let filename = "oficio.docx";

    if (contentType.includes("multipart/form-data")) {
      // Recebe o arquivo via FormData
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return new Response(
          JSON.stringify({ error: "Nenhum arquivo enviado" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      filename = sanitizeDocxFilename(file.name);
      docxBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      // Recebe o arquivo como body binário
      docxBytes = new Uint8Array(await req.arrayBuffer());
    }

    const pdfHeaders = {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename.replace(".docx", ".pdf")}"`,
    };

    const configuredProviders: string[] = [];
    const providerErrors: string[] = [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    // ── Tentativa 0: Google Drive do usuário (sem crédito pago) ──────────────
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        const googleAuth = await getUserGoogleAccessToken(supabaseAdmin, user.id);

        if (googleAuth) {
          configuredProviders.push("GoogleDrive");
          try {
            const pdfBytes = await convertWithGoogleDrive(docxBytes, filename, googleAuth.accessToken);
            return new Response(new Uint8Array(pdfBytes).buffer, { headers: pdfHeaders });
          } catch (e) {
            const msg = getErrorMessage(e);
            providerErrors.push(`GoogleDrive: ${msg}`);
            console.error("GoogleDrive failed, trying next provider:", e);
            // Token com escopo insuficiente (usuário conectou antes de incluirmos
            // drive.file) fica zumbi e sempre falha. Removemos para forçar nova
            // autorização da próxima vez.
            if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions|insufficient.+scope/i.test(msg)) {
              try {
                const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
                await supabaseAdmin.from("user_drive_tokens").delete().eq("user_id", user.id);
                console.log(`[convert-to-pdf] Token Drive do usuário ${user.id} removido (escopo insuficiente).`);
              } catch (delErr) {
                console.warn("Falha ao remover token Drive zumbi:", delErr);
              }
            }
          }
        }
      } catch (e) {
        const msg = getErrorMessage(e);
        providerErrors.push(`GoogleDriveAuth: ${msg}`);
        console.error("GoogleDrive auth/token lookup failed:", e);
      }
    }

    // ── Tentativa 0.5: Google Service Account (rápido e sem créditos) ───────
    try {
      const serviceAccessToken = await getServiceAccountAccessToken();
      if (serviceAccessToken) {
        configuredProviders.push("GoogleServiceAccount");
        try {
          const pdfBytes = await convertWithGoogleDrive(docxBytes, filename, serviceAccessToken);
          return new Response(new Uint8Array(pdfBytes).buffer, { headers: pdfHeaders });
        } catch (e) {
          const msg = getErrorMessage(e);
          providerErrors.push(`GoogleServiceAccount: ${msg}`);
          console.error("GoogleServiceAccount failed, trying next provider:", e);
        }
      }
    } catch (e) {
      const msg = getErrorMessage(e);
      providerErrors.push(`GoogleServiceAccountAuth: ${msg}`);
      console.error("GoogleServiceAccount token failed:", e);
    }

    // ── Tentativa 1: ConvertAPI (chaves em cascata) ──────────────────────────
    // Ordem: CONVERTAPI_SECRET_3 (mais recente) → CONVERTAPI_SECRET → CONVERTAPI_SECRET_2
    const convertApiKeys: Array<{ name: string; value: string }> = [];
    for (const name of ["CONVERTAPI_SECRET_3", "CONVERTAPI_SECRET", "CONVERTAPI_SECRET_2"]) {
      const value = Deno.env.get(name);
      if (value && !convertApiKeys.some((k) => k.value === value)) {
        convertApiKeys.push({ name, value });
      }
    }

    for (const key of convertApiKeys) {
      configuredProviders.push(`ConvertAPI(${key.name})`);
      try {
        console.log(`[convert-to-pdf] 🔑 Tentando ConvertAPI com ${key.name}`);
        const pdfBytes = await convertWithConvertApi(docxBytes, filename, key.value);
        console.log(`[convert-to-pdf] ✅ Sucesso com ${key.name}`);
        return new Response(new Uint8Array(pdfBytes).buffer, { headers: pdfHeaders });
      } catch (e) {
        const msg = getErrorMessage(e);
        providerErrors.push(`ConvertAPI(${key.name}): ${msg}`);
        if (/4035|No conversions remaining|trial plan has expired/i.test(msg)) {
          console.warn(`[convert-to-pdf] ⚠️ ${key.name} sem créditos (4035) — tentando próxima chave`);
        } else {
          console.error(`[convert-to-pdf] ❌ ${key.name} falhou (não-4035):`, msg);
        }
      }
    }


    // ── Tentativa 2: CloudConvert API ────────────────────────────────────────
    const CLOUDCONVERT_API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY");
    // ⚠️ CloudConvert/Api2PDF realizam upload pesado dentro da edge function
    // e frequentemente excedem o limite de CPU (WORKER_RESOURCE_LIMIT) quando
    // o documento contém anexos. Só usamos como último recurso, e apenas se
    // nenhum provedor "leve" (Drive/ConvertAPI) estiver configurado.
    const heavyProvidersAllowed = configuredProviders.length === 0;
    if (CLOUDCONVERT_API_KEY && heavyProvidersAllowed) {
      configuredProviders.push("CloudConvert");
      try {
        const pdfBytes = await convertWithCloudConvert(docxBytes, filename, CLOUDCONVERT_API_KEY);
        return new Response(new Uint8Array(pdfBytes).buffer, { headers: pdfHeaders });
      } catch (e) {
        const msg = getErrorMessage(e);
        providerErrors.push(`CloudConvert: ${msg}`);
        console.error("CloudConvert failed, trying next provider:", e);
      }
    }

    // ── Tentativa 3: Api2PDF (LibreOffice) ───────────────────────────────────
    const API2PDF_KEY = Deno.env.get("API2PDF_API_KEY");
    if (API2PDF_KEY && heavyProvidersAllowed) {
      configuredProviders.push("Api2PDF");
      let tempUpload: { bucket: string; path: string; publicUrl: string } | null = null;
      try {
        tempUpload = await uploadTempDocxAndGetPublicUrl(docxBytes, filename);
        const pdfBytes = await convertWithApi2Pdf(tempUpload.publicUrl, filename, API2PDF_KEY);
        return new Response(new Uint8Array(pdfBytes).buffer, { headers: pdfHeaders });
      } catch (e) {
        const msg = getErrorMessage(e);
        providerErrors.push(`Api2PDF: ${msg}`);
        console.error("Api2PDF failed, trying next provider:", e);
      } finally {
        if (tempUpload) {
          await removeTempUpload(tempUpload.bucket, tempUpload.path);
        }
      }
    }

    // ── Tentativa 4: Gotenberg (self-hosted, se disponível) ──────────────────
    const GOTENBERG_URL = Deno.env.get("GOTENBERG_URL");
    if (GOTENBERG_URL) {
      configuredProviders.push("Gotenberg");
      try {
        const pdfBytes = await convertWithGotenberg(docxBytes, filename, GOTENBERG_URL);
        return new Response(new Uint8Array(pdfBytes).buffer, { headers: pdfHeaders });
      } catch (e) {
        const msg = getErrorMessage(e);
        providerErrors.push(`Gotenberg: ${msg}`);
        console.error("Gotenberg failed, trying next provider:", e);
      }
    }

    // ── Fallback: serviços configurados, mas todos falharam ──────────────────
    if (configuredProviders.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível gerar o PDF: os conversores externos estão sem créditos ou com cota excedida. Conecte seu Google Drive pessoal em Configurações → Google Drive para gerar PDFs ilimitados, ou exporte como Word.",
          fallback: true,
          configuredProviders,
          details: providerErrors,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Fallback: nenhum provedor configurado ────────────────────────────────
    return new Response(
      JSON.stringify({
        error: "Nenhum serviço de conversão configurado. Configure ao menos um: Drive conectado do usuário, GOOGLE_SERVICE_ACCOUNT_KEY, CONVERTAPI_SECRET, CONVERTAPI_SECRET_2, CLOUDCONVERT_API_KEY, API2PDF_API_KEY ou GOTENBERG_URL.",
        fallback: true,
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("convert-to-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── CloudConvert ─────────────────────────────────────────────────────────────
async function convertWithCloudConvert(
  docxBytes: Uint8Array,
  filename: string,
  apiKey: string
): Promise<Uint8Array> {
  const productionBaseUrl = "https://api.cloudconvert.com/v2";
  const sandboxBaseUrl = "https://api.sandbox.cloudconvert.com/v2";

  const runConversion = async (baseUrl: string): Promise<Uint8Array> => {
    // 1. Criar job de conversão
    const jobResp = await fetch(`${baseUrl}/jobs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tasks: {
          "upload-file": {
            operation: "import/upload",
          },
          "convert-file": {
            operation: "convert",
            input: "upload-file",
            input_format: "docx",
            output_format: "pdf",
            engine: "office",
          },
          "export-file": {
            operation: "export/url",
            input: "convert-file",
          },
        },
        tag: "oficio-pdf",
      }),
    });

    if (!jobResp.ok) {
      const errText = await jobResp.text();
      throw new Error(`CloudConvert job creation error (${baseUrl}): ${errText}`);
    }

    const job = await jobResp.json();
    const uploadTask = job.data.tasks.find((t: { name: string }) => t.name === "upload-file");

    if (!uploadTask?.result?.form) {
      throw new Error("CloudConvert: upload task sem form");
    }

    // 2. Fazer upload do arquivo
    const form = uploadTask.result.form;
    const uploadForm = new FormData();
    for (const [key, value] of Object.entries(form.parameters as Record<string, string>)) {
      uploadForm.append(key, value);
    }
    uploadForm.append("file", new Blob([new Uint8Array(docxBytes).buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }), filename);

    const uploadResp = await fetch(form.url, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadResp.ok) {
      const uploadErr = await uploadResp.text();
      throw new Error(`CloudConvert upload error: ${uploadResp.status} ${uploadErr}`);
    }

    // 3. Aguardar conclusão do job
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const statusResp = await fetch(`${baseUrl}/jobs/${job.data.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!statusResp.ok) {
        const errText = await statusResp.text();
        throw new Error(`CloudConvert status error (${baseUrl}): ${errText}`);
      }

      const status = await statusResp.json();
      const tasks = status?.data?.tasks ?? [];
      const exportTask = tasks.find((t: { name?: string }) => t.name === "export-file");
      const convertTask = tasks.find((t: { name?: string; operation?: string }) => t.name === "convert-file" || t.operation === "convert");

      if (exportTask?.status === "finished") {
        const pdfUrl = exportTask.result.files[0].url;

        // 4. Baixar o PDF gerado
        const pdfResp = await fetch(pdfUrl);
        if (!pdfResp.ok) throw new Error("CloudConvert: erro ao baixar PDF");
        const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
        return ensurePdfBytes(pdfBytes, "CloudConvert");
      }

      if (status?.data?.status === "error") {
        const failedTasks = tasks.filter((t: { status?: string }) => t.status === "error");
        const failedDetails = failedTasks
          .map((t: { name?: string; operation?: string; message?: string; code?: string; result?: { error?: string } }) => {
            const taskName = t.name || t.operation || "task";
            const taskError = t.message || t.result?.error || t.code || "erro desconhecido";
            return `${taskName}: ${taskError}`;
          })
          .join(" | ");

        const detailedMessage =
          failedDetails ||
          convertTask?.message ||
          convertTask?.result?.error ||
          exportTask?.message ||
          "Erro na conversão";

        throw new Error(`CloudConvert conversion error: ${detailedMessage}`);
      }
    }

    throw new Error("CloudConvert: timeout aguardando conversão");
  };

  try {
    // Produção primeiro (chave padrão)
    return await runConversion(productionBaseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Só tenta sandbox se de fato for erro de autenticação
    if (message.includes("UNAUTHENTICATED") || /Unauthenticated/i.test(message)) {
      return await runConversion(sandboxBaseUrl);
    }

    throw error;
  }
}

// ── Gotenberg (LibreOffice self-hosted) ──────────────────────────────────────
async function convertWithGotenberg(
  docxBytes: Uint8Array,
  filename: string,
  gotenbergUrl: string
): Promise<Uint8Array> {
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(docxBytes).buffer], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }), filename);

  const resp = await fetch(`${gotenbergUrl}/forms/libreoffice/convert`, {
    method: "POST",
    body: form,
  });

  if (!resp.ok) {
    throw new Error(`Gotenberg error: ${resp.status} ${await resp.text()}`);
  }

  const pdfBytes = new Uint8Array(await resp.arrayBuffer());
  return ensurePdfBytes(pdfBytes, "Gotenberg");
}

// ── ConvertAPI ───────────────────────────────────────────────────────────────
async function convertWithConvertApi(
  docxBytes: Uint8Array,
  filename: string,
  secret: string
): Promise<Uint8Array> {
  // ConvertAPI accepts base64-encoded file content
  // Chunk the conversion to avoid "Maximum call stack size exceeded"
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < docxBytes.length; i += chunkSize) {
    const chunk = docxBytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  const base64 = btoa(binary);

  const resp = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Parameters: [
        { Name: "File", FileValue: { Name: filename, Data: base64 } },
        { Name: "StoreFile", Value: true },
        { Name: "ImageResolution", Value: 300 },
        { Name: "ImageQuality", Value: 100 },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ConvertAPI error: ${resp.status} ${errText}`);
  }

  const result = await resp.json();
  const pdfFileUrl = result?.Files?.[0]?.Url;
  if (!pdfFileUrl) throw new Error("ConvertAPI: no PDF URL in response");

  const pdfResp = await fetch(pdfFileUrl);
  if (!pdfResp.ok) throw new Error("ConvertAPI: failed to download PDF");

  const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
  return ensurePdfBytes(pdfBytes, "ConvertAPI");
}

// ── Api2PDF helpers ──────────────────────────────────────────────────────────
async function uploadTempDocxAndGetPublicUrl(docxBytes: Uint8Array, filename: string): Promise<{ bucket: string; path: string; publicUrl: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing backend credentials for temporary upload");
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const bucket = "midias";
  const path = `temp/pdf-convert/${crypto.randomUUID()}-${sanitizeDocxFilename(filename)}`;

  const { error } = await admin.storage.from(bucket).upload(path, docxBytes, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload temporary DOCX: ${error.message}`);
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Failed to generate temporary public URL");
  }

  return { bucket, path, publicUrl: data.publicUrl };
}

async function removeTempUpload(bucket: string, path: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) return;
    const admin = createClient(supabaseUrl, serviceRoleKey);
    await admin.storage.from(bucket).remove([path]);
  } catch (e) {
    console.error("Failed to cleanup temporary upload:", e);
  }
}

// ── Api2PDF (LibreOffice via API) ────────────────────────────────────────────
async function convertWithApi2Pdf(
  sourceUrl: string,
  filename: string,
  apiKey: string
): Promise<Uint8Array> {
  const resp = await fetch("https://v2.api2pdf.com/libreoffice/any-to-pdf", {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: sourceUrl,
      fileName: filename.replace(".docx", ".pdf"),
      inlinePdf: false,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Api2PDF error: ${resp.status} ${errText}`);
  }

  const result = await resp.json();

  if (!result.FileUrl) {
    throw new Error(`Api2PDF: no FileUrl in response — ${JSON.stringify(result)}`);
  }

  const pdfResp = await fetch(result.FileUrl);
  if (!pdfResp.ok) throw new Error("Api2PDF: failed to download PDF");

  const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
  return ensurePdfBytes(pdfBytes, "Api2PDF");
}
