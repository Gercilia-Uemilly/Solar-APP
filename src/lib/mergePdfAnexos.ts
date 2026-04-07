import { PDFDocument } from "pdf-lib";

// ── A4 dimensions in points ──────────────────────────────────────────────────
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Margins in points (1cm ≈ 28.35pt)
const MARGIN_TOP = 141.73;    // 5cm
const MARGIN_BOTTOM = 113.39; // 4cm
const MARGIN_LEFT = 85.04;    // 3cm
const MARGIN_RIGHT = 56.69;   // 2cm

const GAP = 14; // gap between images in points (~5mm)

const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const CONTENT_HEIGHT = A4_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

/**
 * Merge the main ofício PDF with all attachment files (PDFs and images)
 * into a single PDF document with smart image grid layout.
 */
export async function mergePdfWithAnexos(
  oficioPdfBytes: Uint8Array | ArrayBuffer,
  anexoFiles: File[]
): Promise<Uint8Array> {
  if (!anexoFiles || anexoFiles.length === 0) {
    return new Uint8Array(oficioPdfBytes);
  }

  const docFinal = await PDFDocument.load(oficioPdfBytes);

  // Separate PDFs from images
  const pdfFiles: File[] = [];
  const imageFiles: File[] = [];

  for (const anexo of anexoFiles) {
    const mimeType = anexo.type || inferMimeFromName(anexo.name);
    if (mimeType === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf")) {
      pdfFiles.push(anexo);
    } else if (mimeType.startsWith("image/")) {
      imageFiles.push(anexo);
    }
  }

  // Embed images with dynamic grid layout
  if (imageFiles.length > 0) {
    await addImagesWithLayout(docFinal, imageFiles);
  }

  // Merge PDF pages
  for (const pdfFile of pdfFiles) {
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfAnexo = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const paginas = await docFinal.copyPages(pdfAnexo, pdfAnexo.getPageIndices());
      paginas.forEach((p) => docFinal.addPage(p));
    } catch (e) {
      console.error(`[mergePdfAnexos] Erro ao processar PDF "${pdfFile.name}":`, e);
    }
  }

  return docFinal.save();
}

// ── Embed image into pdf-lib ────────────────────────────────────────────────
async function embedImage(doc: PDFDocument, file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const mimeType = file.type || inferMimeFromName(file.name);

  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return doc.embedJpg(bytes);
  } else if (mimeType === "image/png") {
    return doc.embedPng(bytes);
  } else {
    try {
      return await doc.embedJpg(bytes);
    } catch {
      return await doc.embedPng(bytes);
    }
  }
}

// ── Layout slot definition ──────────────────────────────────────────────────
interface Slot {
  x: number;
  y: number; // bottom-left y in PDF coords
  w: number;
  h: number;
}

/**
 * Calculate slots for N images on the current page.
 * Returns array of {x, y, w, h} in PDF coordinate space.
 */
function calculateSlots(count: number): Slot[] {
  if (count === 1) {
    // Single image: centered in full content area
    return [{
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM,
      w: CONTENT_WIDTH,
      h: CONTENT_HEIGHT,
    }];
  }

  if (count === 2) {
    // 2 images: stacked vertically, full width, equal height
    const slotH = (CONTENT_HEIGHT - GAP) / 2;
    return [
      { x: MARGIN_LEFT, y: MARGIN_BOTTOM + slotH + GAP, w: CONTENT_WIDTH, h: slotH },
      { x: MARGIN_LEFT, y: MARGIN_BOTTOM, w: CONTENT_WIDTH, h: slotH },
    ];
  }

  if (count === 3) {
    // 3 images: uniform 2x2 grid layout (one slot empty for consistency)
    const cellW = (CONTENT_WIDTH - GAP) / 2;
    const cellH = (CONTENT_HEIGHT - GAP) / 2;
    return [
      { x: MARGIN_LEFT, y: MARGIN_BOTTOM + cellH + GAP, w: cellW, h: cellH },
      { x: MARGIN_LEFT + cellW + GAP, y: MARGIN_BOTTOM + cellH + GAP, w: cellW, h: cellH },
      // Third image centered on bottom row
      { x: MARGIN_LEFT + (CONTENT_WIDTH - cellW) / 2, y: MARGIN_BOTTOM, w: cellW, h: cellH },
    ];
  }

  // 4 images — 2x2 grid, all cells identical
  const cellW = (CONTENT_WIDTH - GAP) / 2;
  const cellH = (CONTENT_HEIGHT - GAP) / 2;
  return [
    { x: MARGIN_LEFT, y: MARGIN_BOTTOM + cellH + GAP, w: cellW, h: cellH },
    { x: MARGIN_LEFT + cellW + GAP, y: MARGIN_BOTTOM + cellH + GAP, w: cellW, h: cellH },
    { x: MARGIN_LEFT, y: MARGIN_BOTTOM, w: cellW, h: cellH },
    { x: MARGIN_LEFT + cellW + GAP, y: MARGIN_BOTTOM, w: cellW, h: cellH },
  ];
}

/**
 * Draw an image centered in a slot using "cover" behavior —
 * scale to fill the slot, crop overflow, maintain aspect ratio.
 */
function drawImageCover(
  page: ReturnType<PDFDocument["addPage"]>,
  img: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
  slot: Slot
) {
  // Unfortunately pdf-lib doesn't support clipping paths natively,
  // so we use "contain" (scaleToFit) instead to avoid distortion
  // while keeping the image fully visible
  const scaled = img.scaleToFit(slot.w, slot.h);
  const centeredX = slot.x + (slot.w - scaled.width) / 2;
  const centeredY = slot.y + (slot.h - scaled.height) / 2;

  page.drawImage(img, {
    x: centeredX,
    y: centeredY,
    width: scaled.width,
    height: scaled.height,
  });
}

/**
 * Add images to the PDF with dynamic grid layout.
 * - 1 image: full page
 * - 2 images: stacked vertically
 * - 3 images: 1 top + 2 bottom
 * - 4 images: 2x2 grid
 * - 5+ images: 4 per page, continuing on next pages
 */
async function addImagesWithLayout(doc: PDFDocument, imageFiles: File[]) {
  // Embed all images first
  const embeddedImages: Awaited<ReturnType<typeof embedImage>>[] = [];
  for (const file of imageFiles) {
    try {
      const img = await embedImage(doc, file);
      embeddedImages.push(img);
    } catch (e) {
      console.error(`[mergePdfAnexos] Erro ao incorporar imagem "${file.name}":`, e);
    }
  }

  if (embeddedImages.length === 0) return;

  const total = embeddedImages.length;

  if (total <= 4) {
    // Single page with appropriate layout
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    const slots = calculateSlots(total);
    for (let i = 0; i < total; i++) {
      drawImageCover(page, embeddedImages[i], slots[i]);
    }
  } else {
    // Multiple pages, 4 images per page
    let idx = 0;
    while (idx < total) {
      const remaining = total - idx;
      const onThisPage = Math.min(4, remaining);
      const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
      const slots = calculateSlots(onThisPage);
      for (let i = 0; i < onThisPage; i++) {
        drawImageCover(page, embeddedImages[idx + i], slots[i]);
      }
      idx += onThisPage;
    }
  }
}

function inferMimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
  };
  return map[ext] || "application/octet-stream";
}
