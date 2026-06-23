import JSZip from "jszip";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";

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
  const numero =
    joined.match(/Of[ií]cio\s+GVF\s*n[°ºo.]?\s*([0-9]{1,5}\s*\/\s*[0-9]{4})/i)?.[1]?.replace(/\s+/g, "") ||
    joined.match(/Of[ií]cio\s+n[°ºo.]?\s*([0-9]{1,5}\s*\/\s*[0-9]{4})/i)?.[1]?.replace(/\s+/g, "");
  const dataGeracao = parseDate(joined);

  // Find DESTINATÁRIO — may or may not have colon
  const destStart = lines.findIndex((line) => /^DESTINAT[ÁA]RIO\s*:?/i.test(line));
  // Find ASSUNTO — may or may not have colon
  const assuntoStart = lines.findIndex((line) => /^ASSUNTO\s*:?/i.test(line));

  // Find vocativo — greeting line after header fields
  const headerEnd = Math.max(destStart, assuntoStart);
  const vocativoStart = lines.findIndex((line, index) =>
    index > headerEnd &&
    /(Excelent[ií]ssim|Ilustr[ií]ssim|Senhor\(a\)|Senhor\s+|Prez(a|ado|ada)|Sr\.\s|Sra\.\s)/i.test(line)
  );

  let destinatario = "";
  if (destStart >= 0) {
    // Collect lines until ASSUNTO or vocativo or next header-like line
    const endDest = assuntoStart > destStart
      ? assuntoStart
      : vocativoStart > destStart
        ? vocativoStart
        : destStart + 3; // collect up to 3 lines
    destinatario = cleanField(lines.slice(destStart, Math.min(endDest, destStart + 5)).join(" "));
  }

  let assunto = "";
  if (assuntoStart >= 0) {
    const endAssunto = vocativoStart > assuntoStart
      ? vocativoStart
      : assuntoStart + 3;
    assunto = cleanField(lines.slice(assuntoStart, Math.min(endAssunto, assuntoStart + 5)).join(" "));
  }

  // If we didn't find DESTINATÁRIO/ASSUNTO with labels, try to extract from nearby lines
  if (!destinatario && !assunto) {
    // Look for "A Sua Excelência" or similar patterns as destinatário
    const aSuaIdx = lines.findIndex((l) => /^A\s+Su[au]\s+Excelência/i.test(l));
    if (aSuaIdx >= 0) {
      destinatario = lines.slice(aSuaIdx, aSuaIdx + 3).join(" ").trim();
    }
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

interface PdfRichSpan {
  text: string;
  bold: boolean;
  italic: boolean;
}

interface PdfRichLine {
  spans: PdfRichSpan[];
  text: string;
}

async function extractPdfRich(blob: Blob): Promise<PdfRichLine[][]> {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await pdfjsLib.getDocument({ data }).promise;
  } catch {
    pdf = await pdfjsLib.getDocument({ data, disableWorker: true } as any).promise;
  }

  const pages: PdfRichLine[][] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const styles: Record<string, any> = (content as any).styles || {};

    const items = (content.items as any[])
      .map((item: any) => {
        const fontName: string = item?.fontName || "";
        const fontFamily: string = styles[fontName]?.fontFamily || fontName || "";
        const fontKey = `${fontName} ${fontFamily}`;
        return {
          text: String(item?.str || ""),
          x: Number(item?.transform?.[4] || 0),
          y: Number(item?.transform?.[5] || 0),
          bold: /bold|black|heavy|semibold/i.test(fontKey),
          italic: /italic|oblique/i.test(fontKey),
        };
      })
      .filter((item) => item.text && item.text.trim());

    const grouped: Array<{ y: number; items: typeof items }> = [];
    items
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .forEach((item) => {
        const line = grouped.find((group) => Math.abs(group.y - item.y) <= 3);
        if (line) line.items.push(item);
        else grouped.push({ y: item.y, items: [item] });
      });

    const lines: PdfRichLine[] = grouped
      .sort((a, b) => b.y - a.y)
      .map((line) => {
        const sorted = line.items.sort((a, b) => a.x - b.x);
        const spans: PdfRichSpan[] = [];
        sorted.forEach((it, idx) => {
          const prev = spans[spans.length - 1];
          const sep = idx === 0 ? "" : " ";
          if (prev && prev.bold === it.bold && prev.italic === it.italic) {
            prev.text += sep + it.text;
          } else {
            spans.push({ text: (prev ? sep : "") + it.text, bold: it.bold, italic: it.italic });
          }
        });
        spans.forEach((s) => { s.text = s.text.replace(/\s+/g, " "); });
        const text = spans.map((s) => s.text).join("").trim();
        return { spans, text };
      })
      .filter((line) => line.text);

    pages.push(lines);
  }

  return pages;
}

function richSpansToHtml(spans: PdfRichSpan[]): string {
  return spans
    .map((s) => {
      let html = escapeHtml(s.text);
      if (s.bold) html = `<strong>${html}</strong>`;
      if (s.italic) html = `<em>${html}</em>`;
      return html;
    })
    .join("");
}

const BULLET_RE = /^([•●◦▪■\-*·])\s+(.*)$/;
const NUMBERED_RE = /^(\d{1,3}[.)]|[a-zA-Z][.)])\s+(.*)$/;

function pdfRichToHtml(pages: PdfRichLine[][]): string {
  const allLines: PdfRichLine[] = [];
  pages.forEach((p, i) => {
    if (i > 0) allLines.push({ spans: [], text: "" });
    allLines.push(...p);
  });

  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of allLines) {
    if (!line.text) {
      closeList();
      continue;
    }
    if (isNoiseLine(line.text)) continue;

    const bulletMatch = line.text.match(BULLET_RE);
    const numberedMatch = !bulletMatch && line.text.match(NUMBERED_RE);

    if (bulletMatch || numberedMatch) {
      const wanted: "ul" | "ol" = bulletMatch ? "ul" : "ol";
      if (listType !== wanted) {
        closeList();
        out.push(`<${wanted}>`);
        listType = wanted;
      }
      // Rebuild spans dropping the bullet/number prefix from the first span
      const prefix = (bulletMatch || numberedMatch)![0].slice(0, (bulletMatch || numberedMatch)![0].length - (bulletMatch || numberedMatch)![2].length);
      const spans = line.spans.length ? [...line.spans] : [{ text: line.text, bold: false, italic: false }];
      let remaining = prefix.length;
      const trimmed: PdfRichSpan[] = [];
      for (const s of spans) {
        if (remaining <= 0) { trimmed.push(s); continue; }
        if (s.text.length <= remaining) { remaining -= s.text.length; continue; }
        trimmed.push({ ...s, text: s.text.slice(remaining) });
        remaining = 0;
      }
      out.push(`<li>${richSpansToHtml(trimmed).trim() || escapeHtml((bulletMatch || numberedMatch)![2])}</li>`);
    } else {
      closeList();
      const inner = line.spans.length ? richSpansToHtml(line.spans) : escapeHtml(line.text);
      out.push(`<p>${inner}</p>`);
    }
  }
  closeList();
  return out.join("");
}

async function extractPdfHtml(blob: Blob): Promise<{ html: string; text: string }> {
  try {
    const pages = await extractPdfRich(blob);
    const text = pages
      .map((lines) => lines.map((l) => l.text).join("\n"))
      .join("\n\n")
      .trim();
    const html = pdfRichToHtml(pages);
    return { html, text };
  } catch {
    const text = await extractPdfText(blob);
    return { html: "", text };
  }
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

async function extractDocxHtml(blob: Blob): Promise<string> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        styleMap: [
          "p[style-name='Title'] => h1:fresh",
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "b => strong",
          "i => em",
          "u => u",
        ],
      } as any,
    );
    return (result?.value || "").trim();
  } catch {
    return "";
  }
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
  if (type === "docx") {
    const [richHtml, text] = await Promise.all([extractDocxHtml(file), extractDocxText(file)]);
    const parsed = parseExternalOficioText(text);
    return { ...parsed, html: richHtml || parsed.html };
  }
  const { html: richHtml, text } = await extractPdfHtml(file);
  const parsed = parseExternalOficioText(text);
  return { ...parsed, html: richHtml || parsed.html };
}

export async function extractExternalOficioUrlToHtml(url: string, name?: string, explicitType?: string) {
  return (await extractExternalOficioUrlData(url, name, explicitType)).html;
}

export async function extractExternalOficioUrlData(url: string, name?: string, explicitType?: string): Promise<ExtractedExternalOficio> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const blob = await response.blob();
  const type = detectExternalType(name || url, explicitType || blob.type);
  if (type === "docx") {
    const [richHtml, text] = await Promise.all([extractDocxHtml(blob), extractDocxText(blob)]);
    const parsed = parseExternalOficioText(text);
    return { ...parsed, html: richHtml || parsed.html };
  }
  const { html: richHtml, text } = await extractPdfHtml(blob);
  const parsed = parseExternalOficioText(text);
  return { ...parsed, html: richHtml || parsed.html };
}