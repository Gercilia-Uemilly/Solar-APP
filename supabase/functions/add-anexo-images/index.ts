import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const formData = await req.formData();
    const docxFile = formData.get("docx") as File | null;
    if (!docxFile) {
      return new Response(JSON.stringify({ error: "docx não enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect images and PDFs
    const images: { name: string; data: Uint8Array; type: string }[] = [];
    const pdfs: { name: string; data: Uint8Array }[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("imagem_") && value instanceof File) {
        images.push({
          name: value.name,
          data: new Uint8Array(await value.arrayBuffer()),
          type: value.type,
        });
      }
      if (key.startsWith("pdf_") && value instanceof File) {
        pdfs.push({
          name: value.name,
          data: new Uint8Array(await value.arrayBuffer()),
        });
      }
    }

    if (images.length === 0 && pdfs.length === 0) {
      const docxBytes = await docxFile.arrayBuffer();
      return new Response(docxBytes, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    }

    const docxBytes = new Uint8Array(await docxFile.arrayBuffer());
    const resultBytes = await addAnexoToDocx(docxBytes, images, pdfs);

    return new Response(resultBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="oficio_com_anexo.docx"`,
      },
    });

  } catch (e) {
    console.error("add-anexo-images error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Manipulação do DOCX (ZIP) ────────────────────────────────────────────────
async function addAnexoToDocx(
  docxBytes: Uint8Array,
  images: { name: string; data: Uint8Array; type: string }[],
  pdfs: { name: string; data: Uint8Array }[]
): Promise<Uint8Array> {

  const { ZipReader, ZipWriter, Uint8ArrayReader, Uint8ArrayWriter }
    = await import("https://deno.land/x/zipjs@v2.7.52/index.js");

  // ── Read original docx files ───────────────────────────────────────
  const zipReader = new ZipReader(new Uint8ArrayReader(docxBytes));
  const entries = await zipReader.getEntries();

  const fileMap = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (!entry.getData) continue;
    const writer = new Uint8ArrayWriter();
    const data = await entry.getData(writer);
    fileMap.set(entry.filename, data);
  }
  await zipReader.close();

  // ── Read document.xml and rels ─────────────────────────────────────────────
  const docXml = new TextDecoder().decode(fileMap.get("word/document.xml")!);
  const relsXml = new TextDecoder().decode(fileMap.get("word/_rels/document.xml.rels")!);
  const contentTypesXml = new TextDecoder().decode(fileMap.get("[Content_Types].xml")!);

  const W  = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
  const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
  const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  let newRels = relsXml.replace("</Relationships>", "");
  let nextRid = 20;
  const annexParagraphs: string[] = [];

  // ── Add images ────────────────────────────────────────────────────────
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.type.includes("png") ? "png" : "jpeg";
    const mediaName = `word/media/anexo_img_${i + 1}.${ext}`;
    fileMap.set(mediaName, img.data);

    const rId = `rIdAnexo${nextRid}`;
    newRels += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/anexo_img_${i + 1}.${ext}"/>`;
    nextRid++;

    const maxCx = 2340000;
    const cx = maxCx;
    const cy = Math.round(maxCx * 0.75);

    annexParagraphs.push(makeImageXml(rId, cx, cy, i + 1, W, WP, A_NS, PIC_NS));
  }

  // ── Add PDFs as altChunk (embedded sub-documents) ─────────────────────
  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    const chunkPath = `word/anexo_pdf_${i + 1}.pdf`;
    fileMap.set(chunkPath, pdf.data);

    const rId = `rIdPdf${nextRid}`;
    newRels += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="anexo_pdf_${i + 1}.pdf"/>`;
    nextRid++;

    // Add a page break before each PDF, then the altChunk reference
    annexParagraphs.push(`
<w:p xmlns:w="${W}">
  <w:pPr><w:spacing w:before="200" w:after="100"/><w:jc w:val="left"/></w:pPr>
  <w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>Anexo: ${escapeXml(pdf.name)}</w:t></w:r>
</w:p>
<w:altChunk xmlns:w="${W}" xmlns:r="${R_NS}" r:id="${rId}"/>`);
  }

  newRels += "</Relationships>";
  fileMap.set("word/_rels/document.xml.rels", new TextEncoder().encode(newRels));

  // ── Insert annexes before </w:body> ───────────
  const anexoBlock = annexParagraphs.join("\n");
  const newDocXml = docXml.replace("</w:body>", `${anexoBlock}</w:body>`);
  fileMap.set("word/document.xml", new TextEncoder().encode(newDocXml));

  // ── Update Content_Types ─────────────────────────
  let newCT = contentTypesXml;
  if (!newCT.includes('Extension="jpeg"')) {
    newCT = newCT.replace("</Types>", '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>');
  }
  if (!newCT.includes('Extension="png"')) {
    newCT = newCT.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>');
  }
  if (!newCT.includes('Extension="pdf"')) {
    newCT = newCT.replace("</Types>", '<Default Extension="pdf" ContentType="application/pdf"/></Types>');
  }
  fileMap.set("[Content_Types].xml", new TextEncoder().encode(newCT));

  // ── Repack ZIP ──────────────────────────────────────────────────────
  const zipWriter = new ZipWriter(new Uint8ArrayWriter());
  for (const [filename, data] of fileMap.entries()) {
    await zipWriter.add(filename, new Uint8ArrayReader(data));
  }
  return await zipWriter.close();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function makeImageXml(rId: string, cx: number, cy: number, idx: number, W: string, WP: string, A_NS: string, PIC_NS: string): string {
  return `
<w:p xmlns:w="${W}" xmlns:wp="${WP}" xmlns:a="${A_NS}" xmlns:pic="${PIC_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="200" w:after="200"/>
    <w:keepLines/>
  </w:pPr>
  <w:r>
    <w:drawing>
      <wp:inline distT="0" distB="114300" distL="0" distR="0">
        <wp:extent cx="${cx}" cy="${cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${idx + 100}" name="Imagem${idx}"/>
        <wp:cNvGraphicFramePr>
          <a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="1"/>
        </wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="${A_NS}">
          <a:graphicData uri="${PIC_NS}">
            <pic:pic xmlns:pic="${PIC_NS}">
              <pic:nvPicPr>
                <pic:cNvPr id="${idx + 100}" name="Imagem${idx}"/>
                <pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>
              </pic:nvPicPr>
              <pic:blipFill>
                <a:blip r:embed="${rId}"/>
                <a:stretch><a:fillRect/></a:stretch>
              </pic:blipFill>
              <pic:spPr>
                <a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline>
    </w:drawing>
  </w:r>
</w:p>`;
}
