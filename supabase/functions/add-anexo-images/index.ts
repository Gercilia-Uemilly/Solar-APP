import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const docxFile = formData.get("docx") as File;
    if (!docxFile) {
      return new Response(JSON.stringify({ error: "DOCX não enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const images: { name: string; data: Uint8Array; type: string }[] = [];
    const pdfs: { name: string; data: Uint8Array }[] = [];

    for (const [key, value] of formData.entries()) {
      if (key === "docx") continue;
      if (!(value instanceof File)) continue;

      const arrayBuffer = await value.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      if (key.startsWith("imagem_")) {
        images.push({ name: value.name, data: bytes, type: value.type || "image/jpeg" });
      } else if (key.startsWith("pdf_")) {
        pdfs.push({ name: value.name, data: bytes });
      }
    }

    if (images.length === 0 && pdfs.length === 0) {
      const blob = await docxFile.arrayBuffer();
      return new Response(blob, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      });
    }

    const docxBytes = new Uint8Array(await docxFile.arrayBuffer());
    const result = await addAnexoToDocx(docxBytes, images, pdfs);

    return new Response(result, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    });
  } catch (err) {
    console.error("[add-anexo-images] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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

  // ── Add images with uniform grid layout ───────────────────────────
  const imageEntries: { rId: string; idx: number; width: number; height: number }[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const ext = img.type.includes("png") ? "png" : "jpeg";
    const mediaName = `word/media/anexo_img_${i + 1}.${ext}`;
    fileMap.set(mediaName, img.data);

    const rId = `rIdAnexo${nextRid}`;
    newRels += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/anexo_img_${i + 1}.${ext}"/>`;
    nextRid++;

    const dims = getImageDimensions(img.data, img.type);
    imageEntries.push({
      rId,
      idx: i + 1,
      width: dims?.width ?? 1600,
      height: dims?.height ?? 1200,
    });
  }

  // Build pages with uniform image sizing
  let cursor = 0;
  while (cursor < imageEntries.length) {
    const remaining = imageEntries.length - cursor;
    let perPage = Math.min(4, remaining);

    // Use 3 per page if images are very panoramic/vertical
    if (perPage === 4) {
      const probe = imageEntries.slice(cursor, cursor + 4);
      const hasExtremeAspect = probe.some((img) => {
        const ratio = img.width / Math.max(1, img.height);
        return ratio > 2.0 || ratio < 0.5;
      });
      if (hasExtremeAspect) perPage = 3;
    }

    const pageGroup = imageEntries.slice(cursor, cursor + perPage);
    cursor += perPage;

    annexParagraphs.push(`<w:p xmlns:w="${W}"><w:r><w:br w:type="page"/></w:r></w:p>`);
    annexParagraphs.push(...buildImagePageXml(pageGroup, W, WP, A_NS, PIC_NS));
  }

  // ── Add PDFs as altChunk (embedded sub-documents) ─────────────────────
  for (let i = 0; i < pdfs.length; i++) {
    const pdf = pdfs[i];
    const chunkPath = `word/anexo_pdf_${i + 1}.pdf`;
    fileMap.set(chunkPath, pdf.data);

    const rId = `rIdPdf${nextRid}`;
    newRels += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="anexo_pdf_${i + 1}.pdf"/>`;
    nextRid++;

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

// Extract image dimensions from binary data (JPEG/PNG headers)
function getImageDimensions(data: Uint8Array, type: string): { width: number; height: number } | null {
  try {
    if (type.includes("png") && data.length > 24) {
      const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
      const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
      if (width > 0 && height > 0) return { width, height };
    }
    
    if ((type.includes("jpeg") || type.includes("jpg")) && data.length > 2) {
      let i = 2;
      while (i < data.length - 9) {
        if (data[i] === 0xFF) {
          const marker = data[i + 1];
          if (marker >= 0xC0 && marker <= 0xC3) {
            const height = (data[i + 5] << 8) | data[i + 6];
            const width = (data[i + 7] << 8) | data[i + 8];
            if (width > 0 && height > 0) return { width, height };
          }
          const segLen = (data[i + 2] << 8) | data[i + 3];
          i += 2 + segLen;
        } else {
          i++;
        }
      }
    }
  } catch { /* ignore parse errors */ }
  return null;
}

// ── A4 content area in EMU ──────────────────────────────────────────────────
// A4 = 21cm x 29.7cm, margins: left 3cm, right 2cm, top 3cm, bottom 2cm
// Content: 16cm wide x 24.7cm tall
// 1cm = 360,000 EMU
const CONTENT_WIDTH_EMU = 5_760_000;  // 16cm
const CONTENT_HEIGHT_EMU = 8_892_000; // 24.7cm
const IMG_GAP_EMU = 180_000;          // 0.5cm gap between images

/**
 * Calculate UNIFORM slot dimensions for N images on a page.
 * All images in the same layout get the SAME box size for perfect alignment.
 */
function getUniformSlotSize(count: number): { cx: number; cy: number; cols: number; rows: number } {
  if (count === 1) {
    // Single image: full content area
    return { cx: CONTENT_WIDTH_EMU, cy: CONTENT_HEIGHT_EMU, cols: 1, rows: 1 };
  }
  if (count === 2) {
    // 2 images: stacked vertically, full width each
    const cy = Math.floor((CONTENT_HEIGHT_EMU - IMG_GAP_EMU) / 2);
    return { cx: CONTENT_WIDTH_EMU, cy, cols: 1, rows: 2 };
  }
  if (count === 3) {
    // 3 images: 2 on top row + 1 on bottom (all same box size for uniformity)
    const cx = Math.floor((CONTENT_WIDTH_EMU - IMG_GAP_EMU) / 2);
    const cy = Math.floor((CONTENT_HEIGHT_EMU - IMG_GAP_EMU) / 2);
    return { cx, cy, cols: 2, rows: 2 };
  }
  // 4 images: 2x2 grid
  const cx = Math.floor((CONTENT_WIDTH_EMU - IMG_GAP_EMU) / 2);
  const cy = Math.floor((CONTENT_HEIGHT_EMU - IMG_GAP_EMU) / 2);
  return { cx, cy, cols: 2, rows: 2 };
}

/**
 * Fit image to a uniform box while maintaining aspect ratio.
 * The box size is FIXED - the image scales to fit inside it.
 */
function fitToUniformBox(widthPx: number, heightPx: number, boxCx: number, boxCy: number): { cx: number; cy: number } {
  const pxToEmu = 9525;
  const rawCx = Math.max(1, widthPx) * pxToEmu;
  const rawCy = Math.max(1, heightPx) * pxToEmu;
  const scale = Math.min(boxCx / rawCx, boxCy / rawCy, 1);
  return {
    cx: Math.max(700000, Math.round(rawCx * scale)),
    cy: Math.max(700000, Math.round(rawCy * scale)),
  };
}

function buildImagePageXml(
  images: { rId: string; idx: number; width: number; height: number }[],
  W: string,
  WP: string,
  A_NS: string,
  PIC_NS: string,
): string[] {
  const rows: string[] = [];
  const slot = getUniformSlotSize(images.length);

  if (images.length === 1) {
    const fit = fitToUniformBox(images[0].width, images[0].height, slot.cx, slot.cy);
    rows.push(makeImageRowXml([makeImageRunXml(images[0].rId, fit.cx, fit.cy, images[0].idx, A_NS, PIC_NS)], W, WP, A_NS, PIC_NS));
    return rows;
  }

  if (images.length === 2) {
    // Stacked: each image on its own row, same uniform box
    for (const img of images) {
      const fit = fitToUniformBox(img.width, img.height, slot.cx, slot.cy);
      rows.push(makeImageRowXml([makeImageRunXml(img.rId, fit.cx, fit.cy, img.idx, A_NS, PIC_NS)], W, WP, A_NS, PIC_NS));
    }
    return rows;
  }

  // 3 or 4 images: pairs per row, uniform sizing
  for (let i = 0; i < images.length; i += slot.cols) {
    const pair = images.slice(i, i + slot.cols);
    const runs = pair.map((img) => {
      const fit = fitToUniformBox(img.width, img.height, slot.cx, slot.cy);
      return makeImageRunXml(img.rId, fit.cx, fit.cy, img.idx, A_NS, PIC_NS);
    });
    rows.push(makeImageRowXml(runs, W, WP, A_NS, PIC_NS));
  }

  return rows;
}

function makeImageRowXml(runs: string[], W: string, WP: string, A_NS: string, PIC_NS: string): string {
  const spacer = '<w:r><w:t xml:space="preserve">   </w:t></w:r>';
  return `
<w:p xmlns:w="${W}" xmlns:wp="${WP}" xmlns:a="${A_NS}" xmlns:pic="${PIC_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="60" w:after="60"/>
  </w:pPr>
  ${runs.join(spacer)}
</w:p>`;
}

function makeImageRunXml(rId: string, cx: number, cy: number, idx: number, A_NS: string, PIC_NS: string): string {
  return `
<w:r>
  <w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
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
</w:r>`;
}
