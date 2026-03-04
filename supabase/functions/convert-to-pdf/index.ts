import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    let docxBytes: Uint8Array;
    let filename = "oficio.docx";

    if (contentType.includes("multipart/form-data")) {
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
      docxBytes = new Uint8Array(await req.arrayBuffer());
    }

    // ── Tentativa 1: ConvertAPI ──────────────────────────────────────────────
    const CONVERTAPI_SECRET = Deno.env.get("CONVERTAPI_SECRET");
    if (CONVERTAPI_SECRET) {
      try {
        const pdfBytes = await convertWithConvertApi(docxBytes, filename, CONVERTAPI_SECRET);
        return new Response(pdfBytes, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename.replace(".docx", ".pdf")}"`,
          },
        });
      } catch (e) {
        console.error("ConvertAPI failed, trying next:", e);
      }
    }

    // ── Tentativa 2: CloudConvert API ────────────────────────────────────────
    const CLOUDCONVERT_API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY");
    if (CLOUDCONVERT_API_KEY) {
      try {
        const pdfBytes = await convertWithCloudConvert(docxBytes, filename, CLOUDCONVERT_API_KEY);
        return new Response(pdfBytes, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename.replace(".docx", ".pdf")}"`,
          },
        });
      } catch (e) {
        console.error("CloudConvert failed, trying next:", e);
      }
    }

    // ── Tentativa 3: Gotenberg ───────────────────────────────────────────────
    const GOTENBERG_URL = Deno.env.get("GOTENBERG_URL");
    if (GOTENBERG_URL) {
      const pdfBytes = await convertWithGotenberg(docxBytes, filename, GOTENBERG_URL);
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename.replace(".docx", ".pdf")}"`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        error: "Nenhum serviço de conversão disponível. Configure CONVERTAPI_SECRET, CLOUDCONVERT_API_KEY ou GOTENBERG_URL.",
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

// ── ConvertAPI (250 conversões/mês grátis) ───────────────────────────────────
async function convertWithConvertApi(
  docxBytes: Uint8Array,
  filename: string,
  secret: string
): Promise<Uint8Array> {
  // Convert to base64
  const base64 = btoa(String.fromCharCode(...docxBytes));

  const resp = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      Parameters: [
        { Name: "File", FileValue: { Name: filename, Data: base64 } },
        { Name: "StoreFile", Value: true },
      ],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`ConvertAPI error: ${resp.status} ${errText}`);
  }

  const result = await resp.json();
  const fileData = result.Files?.[0]?.FileData;
  if (!fileData) throw new Error("ConvertAPI: no file data in response");

  // Decode base64 response
  const binary = atob(fileData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── CloudConvert ─────────────────────────────────────────────────────────────
async function convertWithCloudConvert(
  docxBytes: Uint8Array,
  filename: string,
  apiKey: string
): Promise<Uint8Array> {
  const baseUrl = "https://api.cloudconvert.com/v2";

  const jobResp = await fetch(`${baseUrl}/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tasks: {
        "upload-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "upload-file",
          input_format: "docx",
          output_format: "pdf",
          engine: "office",
        },
        "export-file": { operation: "export/url", input: "convert-file" },
      },
      tag: "oficio-pdf",
    }),
  });

  if (!jobResp.ok) {
    const errText = await jobResp.text();
    throw new Error(`CloudConvert error: ${errText}`);
  }

  const job = await jobResp.json();
  const uploadTask = job.data.tasks.find((t: { name: string }) => t.name === "upload-file");
  if (!uploadTask?.result?.form) throw new Error("CloudConvert: upload task sem form");

  const form = uploadTask.result.form;
  const uploadForm = new FormData();
  for (const [key, value] of Object.entries(form.parameters as Record<string, string>)) {
    uploadForm.append(key, value);
  }
  uploadForm.append("file", new Blob([docxBytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }), filename);

  const uploadResp = await fetch(form.url, { method: "POST", body: uploadForm });
  if (!uploadResp.ok) throw new Error(`CloudConvert upload error: ${uploadResp.status}`);

  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusResp = await fetch(`${baseUrl}/jobs/${job.data.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!statusResp.ok) throw new Error(`CloudConvert status error`);
    const status = await statusResp.json();
    const tasks = status?.data?.tasks ?? [];
    const exportTask = tasks.find((t: { name?: string }) => t.name === "export-file");
    if (exportTask?.status === "finished") {
      const pdfResp = await fetch(exportTask.result.files[0].url);
      if (!pdfResp.ok) throw new Error("CloudConvert: erro ao baixar PDF");
      return new Uint8Array(await pdfResp.arrayBuffer());
    }
    if (status?.data?.status === "error") {
      throw new Error("CloudConvert conversion error");
    }
  }
  throw new Error("CloudConvert: timeout");
}

// ── Gotenberg ────────────────────────────────────────────────────────────────
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

  if (!resp.ok) throw new Error(`Gotenberg error: ${resp.status} ${await resp.text()}`);
  return new Uint8Array(await resp.arrayBuffer());
}
