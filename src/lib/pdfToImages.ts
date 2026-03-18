import * as pdfjsLib from "pdfjs-dist";

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
    data = pdfSource.buffer.slice(
      pdfSource.byteOffset,
      pdfSource.byteOffset + pdfSource.byteLength
    ) as ArrayBuffer;
  } else {
    data = pdfSource;
  }

  const pdfData = new Uint8Array(data);

  // Força processamento sem worker para evitar falhas de carregamento
  // (CDN/rede/CORS) durante a exportação de anexos.
  const pdf = await pdfjsLib.getDocument({ data: pdfData, disableWorker: true } as any).promise;

  const files: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2; // 2x for high quality
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

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
