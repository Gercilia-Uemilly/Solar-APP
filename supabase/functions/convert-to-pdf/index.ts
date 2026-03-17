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

// Converte um .docx para PDF usando a API do CloudConvert
// Alternativa gratuita: usar a API do LibreOffice Online (Collabora) ou CloudConvert
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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await _sb.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
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

    // ── Tentativa 1: ConvertAPI (primário) ───────────────────────────────────
    const CONVERTAPI_SECRET = Deno.env.get("CONVERTAPI_SECRET");
    if (CONVERTAPI_SECRET) {
      try {
        const pdfBytes = await convertWithConvertApi(docxBytes, filename, CONVERTAPI_SECRET);
        return new Response(pdfBytes, { headers: pdfHeaders });
      } catch (e) {
        console.error("ConvertAPI failed, trying next provider:", e);
      }
    }

    // ── Tentativa 2: CloudConvert API ────────────────────────────────────────
    const CLOUDCONVERT_API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (CLOUDCONVERT_API_KEY) {
      try {
        const pdfBytes = await convertWithCloudConvert(docxBytes, filename, CLOUDCONVERT_API_KEY);
        return new Response(pdfBytes, { headers: pdfHeaders });
      } catch (e) {
        console.error("CloudConvert failed, trying next provider:", e);
      }
    }

    // ── Tentativa 3: Api2PDF (LibreOffice) ───────────────────────────────────
    const API2PDF_KEY = Deno.env.get("API2PDF_API_KEY");
    if (API2PDF_KEY) {
      let tempUpload: { bucket: string; path: string; publicUrl: string } | null = null;
      try {
        tempUpload = await uploadTempDocxAndGetPublicUrl(docxBytes, filename);
        const pdfBytes = await convertWithApi2Pdf(tempUpload.publicUrl, filename, API2PDF_KEY);
        return new Response(pdfBytes, { headers: pdfHeaders });
      } catch (e) {
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
      const pdfBytes = await convertWithGotenberg(docxBytes, filename, GOTENBERG_URL);
      return new Response(pdfBytes, { headers: pdfHeaders });
    }

    // ── Fallback: retorna erro informativo ───────────────────────────────────
    return new Response(
      JSON.stringify({
        error: "Nenhum serviço de conversão configurado. Configure CLOUDCONVERT_API_KEY ou GOTENBERG_URL nas variáveis de ambiente do Supabase.",
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
    uploadForm.append("file", new Blob([docxBytes], {
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
  form.append("files", new Blob([docxBytes], {
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