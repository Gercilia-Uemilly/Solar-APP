import * as pdfjsLib from "pdfjs-dist";

// Configure worker from CDN for off-main-thread processing (much faster)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Convert a PDF file/blob into an array of image Files (one per page).
 * Uses JPEG at 1.5x scale for fast processing while keeping good quality.
 */
export async function pdfToImageFiles(
  pdfSource: File | Blob | ArrayBuffer | Uint8Array,
  baseFileName = "pdf-page"
): Promise<File[]> {
  let data: ArrayBuffer;

  if (pdfSource instanceof File || pdfSource instanceof Blob) {
    data = await pdfSource.arrayBuffer();
  } else if (pdfSource instanceof Uint8Array) {
    data = pdfSource.buffer.slice(
      pdfSource.byteOffset,
      pdfSource.byteOffset + pdfSource.byteLength
    ) as ArrayBuffer;
  } else {
    data = pdfSource;
  }

  const pdfData = new Uint8Array(data);

  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    // Try with worker first (fast, off main thread)
    pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
  } catch {
    // Fallback to no worker if CDN fails
    pdf = await pdfjsLib.getDocument({ data: pdfData, disableWorker: true } as any).promise;
  }

  const files: File[] = [];
  const scale = 1.5; // 1.5x — good balance of quality vs speed

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    // JPEG is ~5x faster to encode than PNG
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );

    if (blob) {
      files.push(
        new File([blob], `${baseFileName}_p${i}.jpg`, { type: "image/jpeg" })
      );
    }

    // Clean up canvas to free memory
    canvas.width = 0;
    canvas.height = 0;
  }

  return files;
}
