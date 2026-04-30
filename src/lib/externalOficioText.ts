import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ExtractedExternalOficio {
  html: string;
  rawText: string;
  numero?: string;
  dataGeracao?: string;
  destinatario?: string;
  assunto?: string;
  vocativo?: string;
}

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

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const cleanField = (value?: string) =>
  (value || "")
    .replace(/\s+/g, " ")
    .replace(/^(?:DESTINAT[ÁA]RIO|ASSUNTO)\s*:\s*/i, "")
    .trim();

const parseDate = (text: string) => {
  const match = text.match(/Uberl[âa]ndia,\s*(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (!match) return undefined;
  const meses: Record<string, string> = {
    janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04", maio: "05", junho: "06",
    julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
  };
  const mes = meses[match[2].toLowerCase()];
  if (!mes) return undefined;
  return `${match[3]}-${mes}-${match[1].padStart(2, "0")}`;
};

const isNoiseLine = (line: string) => {
  const normalized = line.trim();
  return (
    /^\d+$/.test(normalized) ||
    /^(CÂMARA|CAMARA)\s+MUNICIPAL/i.test(normalized) ||
    /^FAB[ÃA]O\b/i.test(normalized) ||
    /^-\s*vereador\s*-$/i.test(normalized) ||
    /^Av\.\s*Jo[ãa]o\s+Naves/i.test(normalized)
  );
};

function parseExternalOficioText(rawText: string): ExtractedExternalOficio {
  const lines = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const joined = lines.join(" ");
  const numero = joined.match(/Of[ií]cio\s+GVF\s*n[°ºo]?\s*([0-9]{1,5}\s*\/\s*[0-9]{4})/i)?.[1]?.replace(/\s+/g, "");
  const dataGeracao = parseDate(joined);

  const destStart = lines.findIndex((line) => /DESTINAT[ÁA]RIO\s*:/i.test(line));
  const assuntoStart = lines.findIndex((line) => /ASSUNTO\s*:/i.test(line));
  const vocativoStart = lines.findIndex((line, index) =>
    index > Math.max(destStart, assuntoStart) &&
    /(Excelent[ií]ssim|Ilustr[ií]ssim|Senhor\(a\)|Senhor\s+|Prez(a|ado|ada))/i.test(line)
  );

  let destinatario = "";
  if (destStart >= 0) {
    const end = assuntoStart > destStart ? assuntoStart : destStart + 1;
    destinatario = cleanField(lines.slice(destStart, end).join(" "));
  }

  let assunto = "";
  if (assuntoStart >= 0) {
    const end = vocativoStart > assuntoStart ? vocativoStart : assuntoStart + 1;
    assunto = cleanField(lines.slice(assuntoStart, end).join(" "));
  }

  const vocativo = vocativoStart >= 0 ? lines[vocativoStart] : undefined;
  let bodyLines = vocativoStart >= 0
    ? lines.slice(vocativoStart + 1)
    : assuntoStart >= 0
      ? lines.slice(assuntoStart + 1)
      : lines;

  const closingIndex = bodyLines.findIndex((line) => {
    const normalized = line.replace(/\s+/g, " ").trim();
    return (
      /^Atenciosamente[,.]?$/i.test(normalized) ||
      /^Respeitosamente[,.]?$/i.test(normalized) ||
      /^FAB[ÃA]O\b/i.test(normalized)
    );
  });
  if (closingIndex >= 0) bodyLines = bodyLines.slice(0, closingIndex);

  bodyLines = bodyLines.filter((line) => !isNoiseLine(line));
  const bodyText = bodyLines.join("\n").trim();

  return {
    html: textToEditorHtml(bodyText || rawText),
    rawText,
    numero,
    dataGeracao,
    destinatario: destinatario || undefined,
    assunto: assunto || undefined,
    vocativo,
  };
}

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
    const items = (content.items as any[])
      .map((item: any) => ({
        text: String(item?.str || "").trim(),
        x: Number(item?.transform?.[4] || 0),
        y: Number(item?.transform?.[5] || 0),
      }))
      .filter((item) => item.text);

    const grouped: Array<{ y: number; items: Array<{ x: number; text: string }> }> = [];
    items
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .forEach((item) => {
        const line = grouped.find((group) => Math.abs(group.y - item.y) <= 3);
        if (line) line.items.push({ x: item.x, text: item.text });
        else grouped.push({ y: item.y, items: [{ x: item.x, text: item.text }] });
      });

    const pageText = grouped
      .sort((a, b) => b.y - a.y)
      .map((line) => line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
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
  return (await extractExternalOficioFileData(file)).html;
}

export async function extractExternalOficioFileData(file: File): Promise<ExtractedExternalOficio> {
  const type = detectExternalType(file.name, file.type);
  const text = type === "docx" ? await extractDocxText(file) : await extractPdfText(file);
  return parseExternalOficioText(text);
}

export async function extractExternalOficioUrlToHtml(url: string, name?: string, explicitType?: string) {
  return (await extractExternalOficioUrlData(url, name, explicitType)).html;
}

export async function extractExternalOficioUrlData(url: string, name?: string, explicitType?: string): Promise<ExtractedExternalOficio> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const type = detectExternalType(name || url, explicitType || blob.type);
  const text = type === "docx" ? await extractDocxText(blob) : await extractPdfText(blob);
  return parseExternalOficioText(text);
}