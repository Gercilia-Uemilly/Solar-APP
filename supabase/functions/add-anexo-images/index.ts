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

  // ── Add images with orientation-aware grid layout ───────────────────────
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

  // Build pages — up to 4 per page
  let cursor = 0;
  while (cursor < imageEntries.length) {
    const remaining = imageEntries.length - cursor;
    const perPage = Math.min(4, remaining);
    const pageGroup = imageEntries.slice(cursor, cursor + perPage);
    cursor += perPage;

    annexParagraphs.push(...buildImagePageXml(pageGroup, W, WP, A_NS, PIC_NS, true));
  }

  // ── Add PDFs as altChunk ─────────────────────
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

  // ── Insert annexes before final section properties ─────────────────────
  // Word expects <w:sectPr> to remain the last child of <w:body>.
  // Appending annex paragraphs after it can create phantom blank pages.
  const anexoBlock = annexParagraphs.join("\n");
  const sectPrMatch = docXml.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/);
  const newDocXml = sectPrMatch
    ? docXml.replace(sectPrMatch[0], `${anexoBlock}\n${sectPrMatch[0]}`)
    : docXml.replace("</w:body>", `${anexoBlock}</w:body>`);
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
const MAX_SINGLE_HEIGHT = 5_400_000;  // ~15cm max for single image (not full page)
const MAX_STACK_HEIGHT = 3_600_000;   // ~10cm max per image when stacked (2 images)
const MAX_SIDE_WIDTH = 2_700_000;     // ~7.5cm per image side by side
const MAX_SIDE_HEIGHT = 5_400_000;    // ~15cm max height for side by side
const MAX_GRID_HEIGHT = 3_240_000;    // ~9cm max per image in grid
const IMG_GAP_EMU = 144_000;          // 0.4cm gap

/**
 * Detect if an image is landscape (wider than tall).
 */
function isLandscape(w: number, h: number): boolean {
  return w >= h;
}

/**
 * Scale image to fit within a box while maintaining aspect ratio (contain behavior).
 * Returns the actual cx, cy to use.
 */
function containFit(
  imgW: number, imgH: number, maxCx: number, maxCy: number
): { cx: number; cy: number } {
  const imgRatio = imgW / imgH;
  const boxRatio = maxCx / maxCy;
  
  if (imgRatio > boxRatio) {
    // Image is wider relative to box → fit to width
    const cx = maxCx;
    const cy = Math.round(maxCx / imgRatio);
    return { cx, cy };
  } else {
    // Image is taller relative to box → fit to height
    const cy = maxCy;
    const cx = Math.round(maxCy * imgRatio);
    return { cx, cy };
  }
}

/**
 * Determine the best layout for a group of images based on their orientations.
 */
function getOrientationAwareLayout(
  images: { width: number; height: number }[]
): { maxCx: number; maxCy: number; layout: "single" | "stack" | "side" | "grid22" } {
  const count = images.length;

  if (count === 1) {
    return { maxCx: CONTENT_WIDTH_EMU, maxCy: MAX_SINGLE_HEIGHT, layout: "single" };
  }

  if (count === 2) {
    const landscapeCount = images.filter(i => isLandscape(i.width, i.height)).length;
    
    if (landscapeCount >= 2) {
      // Both landscape → stack vertically
      return { maxCx: CONTENT_WIDTH_EMU, maxCy: MAX_STACK_HEIGHT, layout: "stack" };
    } else if (landscapeCount === 0) {
      // Both portrait → side by side
      return { maxCx: MAX_SIDE_WIDTH, maxCy: MAX_SIDE_HEIGHT, layout: "side" };
    } else {
      // Mixed → stack vertically
      return { maxCx: CONTENT_WIDTH_EMU, maxCy: MAX_STACK_HEIGHT, layout: "stack" };
    }
  }

  // 3 or 4 images: 2x2 grid
  const cx = Math.floor((CONTENT_WIDTH_EMU - IMG_GAP_EMU) / 2);
  return { maxCx: cx, maxCy: MAX_GRID_HEIGHT, layout: "grid22" };
}

function buildImagePageXml(
  images: { rId: string; idx: number; width: number; height: number }[],
  W: string,
  WP: string,
  A_NS: string,
  PIC_NS: string,
  pageBreakBeforeFirst = false,
): string[] {
  const paragraphs: string[] = [];
  const layoutInfo = getOrientationAwareLayout(images);
  const { maxCx, maxCy, layout } = layoutInfo;

  if (layout === "single") {
    const img = images[0];
    const fit = containFit(img.width, img.height, maxCx, maxCy);
    paragraphs.push(makeImageRowXml(
      [makeImageRunXml(img.rId, fit.cx, fit.cy, img.idx, A_NS, PIC_NS)],
        W, WP, A_NS, PIC_NS, pageBreakBeforeFirst
    ));
  } else if (layout === "stack") {
    // Each image on its own centered paragraph
    for (const [index, img] of images.entries()) {
      const fit = containFit(img.width, img.height, maxCx, maxCy);
      paragraphs.push(makeImageRowXml(
        [makeImageRunXml(img.rId, fit.cx, fit.cy, img.idx, A_NS, PIC_NS)],
        W, WP, A_NS, PIC_NS, pageBreakBeforeFirst && index === 0
      ));
    }
  } else if (layout === "side") {
    // Both images side by side in one paragraph
    const runs = images.map(img => {
      const fit = containFit(img.width, img.height, maxCx, maxCy);
      return makeImageRunXml(img.rId, fit.cx, fit.cy, img.idx, A_NS, PIC_NS);
    });
    paragraphs.push(makeImageRowXml(runs, W, WP, A_NS, PIC_NS, pageBreakBeforeFirst));
  } else {
    // grid22: rows of 2
    for (let i = 0; i < images.length; i += 2) {
      const pair = images.slice(i, i + 2);
      const runs = pair.map(img => {
        const fit = containFit(img.width, img.height, maxCx, maxCy);
        return makeImageRunXml(img.rId, fit.cx, fit.cy, img.idx, A_NS, PIC_NS);
      });
      paragraphs.push(makeImageRowXml(runs, W, WP, A_NS, PIC_NS, pageBreakBeforeFirst && i === 0));
    }
  }

  return paragraphs;
}

function makeImageRowXml(runs: string[], W: string, WP: string, A_NS: string, PIC_NS: string, pageBreakBefore = false): string {
  const spacer = '<w:r><w:t xml:space="preserve"> </w:t></w:r>';
  return `
<w:p xmlns:w="${W}" xmlns:wp="${WP}" xmlns:a="${A_NS}" xmlns:pic="${PIC_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:pPr>
    ${pageBreakBefore ? '<w:pageBreakBefore/>' : ''}
    <w:jc w:val="center"/>
    <w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
  </w:pPr>
  ${runs.join(spacer)}
</w:p>`;
}

function makeImageRunXml(
  rId: string,
  cx: number,
  cy: number,
  idx: number,
  crop: { l: number; t: number; r: number; b: number },
  A_NS: string,
  PIC_NS: string,
): string {
  const hasCrop = crop.l > 0 || crop.t > 0 || crop.r > 0 || crop.b > 0;
  const srcRect = hasCrop
    ? `<a:srcRect l="${crop.l}" t="${crop.t}" r="${crop.r}" b="${crop.b}"/>`
    : "";

  return `
<w:r>
  <w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${cx}" cy="${cy}"/>
      <wp:effectExtent l="0" t="0" r="0" b="0"/>
      <wp:docPr id="${idx + 100}" name="Imagem${idx}"/>
      <wp:cNvGraphicFramePr>
        <a:graphicFrameLocks xmlns:a="${A_NS}" noChangeAspect="0"/>
      </wp:cNvGraphicFramePr>
      <a:graphic xmlns:a="${A_NS}">
        <a:graphicData uri="${PIC_NS}">
          <pic:pic xmlns:pic="${PIC_NS}">
            <pic:nvPicPr>
              <pic:cNvPr id="${idx + 100}" name="Imagem${idx}"/>
              <pic:cNvPicPr><a:picLocks noChangeAspect="0"/></pic:cNvPicPr>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="${rId}"/>
              ${srcRect}
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
