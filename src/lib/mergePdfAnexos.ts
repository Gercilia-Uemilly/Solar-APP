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
  /** Horizontal alignment of the image inside the slot */
  alignH?: "left" | "center" | "right";
  /** Vertical alignment of the image inside the slot */
  alignV?: "top" | "center" | "bottom";
}

function isLandscape(w: number, h: number): boolean {
  return w >= h;
}

/**
 * Calculate slots for N images based on their orientations.
 * Landscape images get full-width rows; portrait images share columns.
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

  // Mesma regra do Word: paisagem ocupa a linha inteira; retratos em pares;
  // todas as linhas com a mesma altura para alinhamento uniforme.
  const rows: number[][] = [];
  let pending: number | null = null;
  images.forEach((img, i) => {
    if (isLandscape(img.width, img.height)) {
      if (pending !== null) { rows.push([pending]); pending = null; }
      rows.push([i]);
    } else if (pending === null) {
      pending = i;
    } else {
      rows.push([pending, i]);
      pending = null;
    }
  });
  if (pending !== null) rows.push([pending]);

  const slots: Slot[] = new Array(count);
  const rowH = (CONTENT_HEIGHT - GAP * (rows.length - 1)) / rows.length;
  const halfW = (CONTENT_WIDTH - GAP) / 2;
  rows.forEach((row, r) => {
    const y = MARGIN_BOTTOM + (rows.length - 1 - r) * (rowH + GAP);
    if (row.length === 2) {
      slots[row[0]] = { x: MARGIN_LEFT, y, w: halfW, h: rowH, alignH: "center", alignV: "center" };
      slots[row[1]] = { x: MARGIN_LEFT + halfW + GAP, y, w: halfW, h: rowH, alignH: "center", alignV: "center" };
    } else {
      const lone = images[row[0]];
      const w = isLandscape(lone.width, lone.height) ? CONTENT_WIDTH : halfW;
      slots[row[0]] = { x: MARGIN_LEFT + (CONTENT_WIDTH - w) / 2, y, w, h: rowH, alignH: "center", alignV: "center" };
    }
  });
  return slots;
}

/**
 * Draw an image in a slot.
 * - contain mode: fit entirely (no crop), preserving aspect ratio
 * - cover mode: fill the slot, center-cropping overflow
 */
function drawImageInSlot(
  page: ReturnType<PDFDocument["addPage"]>,
  img: Awaited<ReturnType<PDFDocument["embedJpg"]>>,
  slot: Slot,
) {
  // Always contain: fit entirely preserving aspect ratio, centered in slot
  const scaleX = slot.w / img.width;
  const scaleY = slot.h / img.height;
  const scale = Math.min(scaleX, scaleY);

  const drawW = img.width * scale;
  const drawH = img.height * scale;

  const alignH = slot.alignH ?? "center";
  const alignV = slot.alignV ?? "center";

  let drawX: number;
  if (alignH === "left") drawX = slot.x;
  else if (alignH === "right") drawX = slot.x + (slot.w - drawW);
  else drawX = slot.x + (slot.w - drawW) / 2;

  // PDF coords: y grows upward, slot.y is the bottom-left of the slot
  let drawY: number;
  if (alignV === "top") drawY = slot.y + (slot.h - drawH);
  else if (alignV === "bottom") drawY = slot.y;
  else drawY = slot.y + (slot.h - drawH) / 2;

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
      drawImageInSlot(page, embeddedImages[i], slots[i]);
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
        drawImageInSlot(page, pageImages[i], slots[i]);
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
