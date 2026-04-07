import { PDFDocument } from "pdf-lib";

// ── A4 dimensions in points ──────────────────────────────────────────────────
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Margins in points (1cm ≈ 28.35pt)
const MARGIN_TOP = 85.04;     // 3cm
const MARGIN_BOTTOM = 56.69;  // 2cm
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

// ── Layout types ──────────────────────────────────────────────────
interface Slot {
  x: number;
  y: number; // bottom-left y in PDF coords
  w: number;
  h: number;
}

function isLandscape(w: number, h: number): boolean {
  return w >= h;
}

/**
 * Calculate slots for N images based on their orientations.
 * - 1 image: full page
 * - 2 landscape: stacked vertically (full width, half height each)
 * - 2 portrait: side by side (half width, full height)
 * - 2 mixed: stacked vertically
 * - 3-4: 2x2 grid
 */
function calculateSlots(
  images: { width: number; height: number }[]
): Slot[] {
  const count = images.length;

  if (count === 1) {
    return [{
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM,
      w: CONTENT_WIDTH,
      h: CONTENT_HEIGHT,
    }];
  }

  if (count === 2) {
    const landscapeCount = images.filter(i => isLandscape(i.width, i.height)).length;

    if (landscapeCount === 0) {
      // Both portrait → side by side
      const slotW = (CONTENT_WIDTH - GAP) / 2;
      return [
        { x: MARGIN_LEFT, y: MARGIN_BOTTOM, w: slotW, h: CONTENT_HEIGHT },
        { x: MARGIN_LEFT + slotW + GAP, y: MARGIN_BOTTOM, w: slotW, h: CONTENT_HEIGHT },
      ];
    } else {
      // Both landscape or mixed → stacked vertically
      const slotH = (CONTENT_HEIGHT - GAP) / 2;
      return [
        { x: MARGIN_LEFT, y: MARGIN_BOTTOM + slotH + GAP, w: CONTENT_WIDTH, h: slotH },
        { x: MARGIN_LEFT, y: MARGIN_BOTTOM, w: CONTENT_WIDTH, h: slotH },
      ];
    }
  }

  if (count === 3) {
    const cellW = (CONTENT_WIDTH - GAP) / 2;
    const cellH = (CONTENT_HEIGHT - GAP) / 2;
    return [
      { x: MARGIN_LEFT, y: MARGIN_BOTTOM + cellH + GAP, w: cellW, h: cellH },
      { x: MARGIN_LEFT + cellW + GAP, y: MARGIN_BOTTOM + cellH + GAP, w: cellW, h: cellH },
      // Third image centered on bottom row
      { x: MARGIN_LEFT + (CONTENT_WIDTH - cellW) / 2, y: MARGIN_BOTTOM, w: cellW, h: cellH },
    ];
  }

  // 4 images — 2x2 grid
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
 * Draw an image filling the slot uniformly (cover behavior).
 * Scale to fill, center-crop overflow.
 */
function drawImageCover(
  page: ReturnType<PDFDocument["addPage"]>,
  img: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
  slot: Slot
) {
  const scaleX = slot.w / img.width;
  const scaleY = slot.h / img.height;
  const scale = Math.max(scaleX, scaleY);

  const drawW = img.width * scale;
  const drawH = img.height * scale;

  const drawX = slot.x + (slot.w - drawW) / 2;
  const drawY = slot.y + (slot.h - drawH) / 2;

  page.drawImage(img, {
    x: drawX,
    y: drawY,
    width: drawW,
    height: drawH,
  });
}

/**
 * Add images to the PDF with orientation-aware grid layout.
 */
async function addImagesWithLayout(doc: PDFDocument, imageFiles: File[]) {
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
    // Single page with orientation-aware layout
    const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
    const imgDims = embeddedImages.map(img => ({ width: img.width, height: img.height }));
    const slots = calculateSlots(imgDims);
    for (let i = 0; i < total; i++) {
      drawImageCover(page, embeddedImages[i], slots[i]);
    }
  } else {
    // Multiple pages, 4 images per page
    let idx = 0;
    while (idx < total) {
      const remaining = total - idx;
      const onThisPage = Math.min(4, remaining);
      const pageImages = embeddedImages.slice(idx, idx + onThisPage);
      const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
      const imgDims = pageImages.map(img => ({ width: img.width, height: img.height }));
      const slots = calculateSlots(imgDims);
      for (let i = 0; i < onThisPage; i++) {
        drawImageCover(page, pageImages[i], slots[i]);
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
