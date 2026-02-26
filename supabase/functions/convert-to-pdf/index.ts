import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info",
};

// Converte um .docx para PDF usando a API do CloudConvert
// Alternativa gratuita: usar a API do LibreOffice Online (Collabora) ou CloudConvert
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      filename = file.name;
      docxBytes = new Uint8Array(await file.arrayBuffer());
    } else {
      // Recebe o arquivo como body binário
      docxBytes = new Uint8Array(await req.arrayBuffer());
    }

    // ── Tentativa 1: CloudConvert API ────────────────────────────────────────
    const CLOUDCONVERT_API_KEY = Deno.env.get("CLOUDCONVERT_API_KEY");
    
    console.log("CloudConvert key present:", !!CLOUDCONVERT_API_KEY);
    console.log("CloudConvert key length:", CLOUDCONVERT_API_KEY?.length || 0);
    console.log("CloudConvert key starts with:", CLOUDCONVERT_API_KEY?.substring(0, 10) || "N/A");

    if (CLOUDCONVERT_API_KEY) {
      const pdfBytes = await convertWithCloudConvert(docxBytes, filename, CLOUDCONVERT_API_KEY);
      return new Response(pdfBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename.replace(".docx", ".pdf")}"`,
        },
      });
    }

    // ── Tentativa 2: Gotenberg (self-hosted, se disponível) ──────────────────
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
  // Try production first, then sandbox
  const baseUrls = [
    "https://api.cloudconvert.com/v2",
    "https://api.sandbox.cloudconvert.com/v2",
  ];

  let lastError = "";

  for (const baseUrl of baseUrls) {
    try {
      console.log(`Trying CloudConvert at: ${baseUrl}`);

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
              engine: "libreoffice",
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
        const err = await jobResp.text();
        console.log(`CloudConvert ${baseUrl} error: ${err}`);
        lastError = err;
        continue; // try next URL
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
      uploadForm.append("file", new Blob([docxBytes]), filename);

      const uploadResp = await fetch(form.url, {
        method: "POST",
        body: uploadForm,
      });

      if (!uploadResp.ok) {
        throw new Error(`CloudConvert upload error: ${uploadResp.status}`);
      }

      // 3. Aguardar conclusão do job
      let pdfUrl = "";
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusResp = await fetch(`${baseUrl}/jobs/${job.data.id}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const status = await statusResp.json();
        const exportTask = status.data.tasks.find((t: { name: string }) => t.name === "export-file");

        if (exportTask?.status === "finished") {
          pdfUrl = exportTask.result.files[0].url;
          break;
        }
        if (status.data.status === "error") {
          throw new Error("CloudConvert: erro na conversão");
        }
      }

      if (!pdfUrl) throw new Error("CloudConvert: timeout aguardando conversão");

      // 4. Baixar o PDF gerado
      const pdfResp = await fetch(pdfUrl);
      if (!pdfResp.ok) throw new Error("CloudConvert: erro ao baixar PDF");
      return new Uint8Array(await pdfResp.arrayBuffer());

    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.log(`CloudConvert ${baseUrl} failed: ${lastError}`);
      continue;
    }
  }

  throw new Error(`CloudConvert job error: ${lastError}`);
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

  return new Uint8Array(await resp.arrayBuffer());
}