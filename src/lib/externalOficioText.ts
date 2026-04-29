import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const textToEditorHtml = (text: string) => {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return paragraphs.length
    ? paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    : "";
};

async function extractPdfText(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);
  let pdf: pdfjsLib.PDFDocumentProxy;

  try {
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch {
    pdf = await pdfjsLib.getDocument({ data, disableWorker: true } as any).promise;
  }

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item?.str || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

async function extractDocxText(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) return "";

  const xml = new DOMParser().parseFromString(documentXml, "application/xml");
  const paragraphs = Array.from(xml.getElementsByTagName("w:p"))
    .map((paragraph) => {
      const parts: string[] = [];
      paragraph.childNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        Array.from(node.getElementsByTagName("w:t")).forEach((textNode) => parts.push(textNode.textContent || ""));
        Array.from(node.getElementsByTagName("w:tab")).forEach(() => parts.push("\t"));
        Array.from(node.getElementsByTagName("w:br")).forEach(() => parts.push("\n"));
      });
      return parts.join("").trim();
    })
    .filter(Boolean);

  return paragraphs.join("\n\n").trim();
}

function detectExternalType(nameOrUrl?: string, explicitType?: string) {
  const source = `${explicitType || ""} ${nameOrUrl || ""}`.toLowerCase();
  if (source.includes("docx") || source.endsWith(".docx")) return "docx";
  if (source.includes("pdf") || source.endsWith(".pdf")) return "pdf";
  return "";
}

export async function extractExternalOficioFileToHtml(file: File) {
  const type = detectExternalType(file.name, file.type);
  const text = type === "docx" ? await extractDocxText(file) : await extractPdfText(file);
  return textToEditorHtml(text);
}

export async function extractExternalOficioUrlToHtml(url: string, name?: string, explicitType?: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const type = detectExternalType(name || url, explicitType || blob.type);
  const text = type === "docx" ? await extractDocxText(blob) : await extractPdfText(blob);
  return textToEditorHtml(text);
}