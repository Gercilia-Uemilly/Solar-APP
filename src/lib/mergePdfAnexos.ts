import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";

/**
 * Merge the main ofício PDF with all attachment files (PDFs and images)
 * into a single PDF document.
 */
export async function mergePdfWithAnexos(
  oficioPdfBytes: Uint8Array | ArrayBuffer,
  anexoFiles: File[]
): Promise<Uint8Array> {
  if (!anexoFiles || anexoFiles.length === 0) {
    return new Uint8Array(oficioPdfBytes);
  }

  const docFinal = await PDFDocument.load(oficioPdfBytes);

  for (const anexo of anexoFiles) {
    const arrayBuffer = await anexo.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const mimeType = anexo.type || inferMimeFromName(anexo.name);

    try {
      if (mimeType === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf")) {
        // Merge PDF pages
        const pdfAnexo = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const paginas = await docFinal.copyPages(pdfAnexo, pdfAnexo.getPageIndices());
        paginas.forEach((p) => docFinal.addPage(p));
      } else if (mimeType.startsWith("image/")) {
        // Embed image as a full A4 page
        let img;
        if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
          img = await docFinal.embedJpg(bytes);
        } else if (mimeType === "image/png") {
          img = await docFinal.embedPng(bytes);
        } else {
          // Try JPEG first, then PNG
          try {
            img = await docFinal.embedJpg(bytes);
          } catch {
            img = await docFinal.embedPng(bytes);
          }
        }

        if (img) {
          // A4 dimensions in points
          const pageWidth = 595.28;
          const pageHeight = 841.89;
          const margin = 20;
          const maxW = pageWidth - margin * 2;
          const maxH = pageHeight - margin * 2;

          const scaled = img.scaleToFit(maxW, maxH);
          const page = docFinal.addPage([pageWidth, pageHeight]);
          page.drawImage(img, {
            x: (pageWidth - scaled.width) / 2,
            y: (pageHeight - scaled.height) / 2,
            width: scaled.width,
            height: scaled.height,
          });
        }
      }
    } catch (e) {
      console.error(`[mergePdfAnexos] Erro ao processar anexo "${anexo.name}":`, e);
    }
  }

  return docFinal.save();
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
