import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Convert a PDF file/blob into an array of image Files (one per page).
 * Each page is rendered at 2x scale for good quality in Word/PDF exports.
 */
export async function pdfToImageFiles(
  pdfSource: File | Blob | ArrayBuffer | Uint8Array,
  baseFileName = "pdf-page"
): Promise<File[]> {
  let data: ArrayBuffer;

  if (pdfSource instanceof File || pdfSource instanceof Blob) {
    data = await pdfSource.arrayBuffer();
  } else if (pdfSource instanceof Uint8Array) {
    data = pdfSource.buffer as ArrayBuffer;
  } else {
    data = pdfSource;
  }

  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const files: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2; // 2x for high quality
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );

    if (blob) {
      files.push(
        new File([blob], `${baseFileName}_p${i}.png`, { type: "image/png" })
      );
    }
  }

  return files;
}
