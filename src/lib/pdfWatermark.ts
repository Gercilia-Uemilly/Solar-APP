import { PDFDocument, rgb, degrees } from "pdf-lib";

/**
 * Add a subtle diagonal watermark with operator name and date to all PDF pages.
 */
export async function adicionarMarcaDagua(pdfBytes: Uint8Array, operador: string): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(pdfBytes);
    const pages = doc.getPages();
    const texto = `${operador} — ${new Date().toLocaleDateString("pt-BR")}`;

    for (const page of pages) {
      const { width, height } = page.getSize();
      page.drawText(texto, {
        x: width / 2 - 150,
        y: height / 2,
        size: 28,
        color: rgb(0.85, 0.85, 0.85),
        opacity: 0.15,
        rotate: degrees(45),
      });
    }

    return doc.save();
  } catch {
    // If watermark fails, return original
    return pdfBytes;
  }
}
