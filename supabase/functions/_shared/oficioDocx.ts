// Monta o DOCX do ofício no servidor — porta de buildWordBlob() de src/lib/exportOficio.ts
// (mesmo cabeçalho, rodapé, margens, fonte, tamanhos automáticos, assinatura e "FABÃO / Vereador").
// Diferenças do navegador: HTML lido com deno-dom (sem `el.style`, o estilo vem do atributo),
// imagens do timbrado embutidas em _shared/oficioAssets.ts (assinatura já achatada em branco).
// Se o layout mudar em exportOficio.ts, mude aqui também (paridade com a exportação da tela).
import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer, Header, PageNumber, LevelFormat } from "npm:docx@9.5.3";
import JSZip from "npm:jszip@3.10.1";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { formatDateOficio as formatDate, cleanNumero, getDestinatario, getVocativo, extrairBairro, normalizarConteudoOficio } from "./oficioUtils.ts";
import { LOGO_CAMARA_JPG_B64, LOGO_FABAO_PNG_B64, ASSINATURA_PNG_B64 } from "./oficioAssets.ts";

const ASSINATURA_LARGURA = 227;
const ASSINATURA_ALTURA = 113;
const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export interface OficioDocxData {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  cargoDestinatario?: string;
  dataGeracao?: string;
  secretaria?: string;
  vocativo?: string;
  fechamento?: string;
}

const b64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// deno-dom: um <div> raiz com o HTML dentro
// deno-lint-ignore no-explicit-any
function htmlRoot(html: string): any {
  const doc = new DOMParser().parseFromString(`<div id="__raiz">${html}</div>`, "text/html");
  return doc!.getElementById("__raiz");
}
// deno-lint-ignore no-explicit-any
function novoElemento(tag: string): any {
  const doc = new DOMParser().parseFromString(`<${tag}></${tag}>`, "text/html");
  return doc!.querySelector(tag);
}

function sanitizeConteudoParaExport(html: string, data: Partial<OficioDocxData>): string {
  if (!html) return html;
  const root = htmlRoot(html);
  const paragraphs = Array.from(root.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, blockquote"));
  const vocativo = data.vocativo || (data.secretaria ? getVocativo(data.secretaria) : "");
  const vocClean = vocativo ? vocativo.replace(/[(),]/g, "").trim().split(/\s+/).slice(0, 3).join(" ") : "";
  // deno-lint-ignore no-explicit-any
  const toRemove: any[] = [];
  // deno-lint-ignore no-explicit-any
  paragraphs.forEach((p: any) => {
    const text = (p.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    if (vocClean.length > 5 && text.includes(vocClean) && text.length < vocativo.length + 30) { toRemove.push(p); return; }
    if (/^Atenciosamente[,.]?\s*$/i.test(text)) { toRemove.push(p); return; }
    if (/^FAB[AÃ]O$/i.test(text) || /^Vereador$/i.test(text)) { toRemove.push(p); return; }
    if (/^Of[ií]cio\s+GVF\s+n[°º]/i.test(text) && text.length < 40) { toRemove.push(p); return; }
    if (/^DESTINAT[AÁ]RIO\s*:/i.test(text) && text.length < 120) { toRemove.push(p); return; }
    if (/^ASSUNTO\s*:/i.test(text) && text.length < 120) { toRemove.push(p); return; }
  });
  toRemove.forEach((el) => el.remove());
  return root.innerHTML;
}

interface StyledRun { text: string; bold?: boolean; italic?: boolean; underline?: boolean; break?: number; fontSize?: number; fontFamily?: string }
interface ParsedImageRun { image: Uint8Array; width: number; height: number; imageType: string }
type ParsedRun = StyledRun | ParsedImageRun;
interface ParsedParagraph { runs: ParsedRun[]; listReference?: string; listLevel?: number; listStart?: number }

// lê "font-weight: bold; font-size: 11pt" do atributo style
function estilo(attr: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const parte of String(attr || "").split(";")) {
    const i = parte.indexOf(":");
    if (i > 0) out[parte.slice(0, i).trim().toLowerCase()] = parte.slice(i + 1).trim();
  }
  return out;
}

function parseHtmlToParagraphs(html: string): ParsedParagraph[] {
  if (!html) return [];
  if (!html.includes("<")) {
    return html.split(/\n\s*\n+/).map((p) => p.replace(/\n+/g, " ").trim()).filter(Boolean)
      .filter((p) => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i)).map((p) => ({ runs: [{ text: p }] }));
  }
  const hasExplicitBlocks = /<(p|div|li|h[1-6]|blockquote|ul|ol)\b/i.test(html);
  let inner: string;
  if (hasExplicitBlocks) inner = html;
  else {
    const chunks = html.split(/\n\s*\n+/).map((c) => c.trim()).filter(Boolean);
    inner = chunks.length > 1 ? chunks.map((c) => `<p>${c.replace(/\n/g, "<br/>")}</p>`).join("") : html.replace(/\n/g, "<br/>");
  }
  const root = htmlRoot(inner);
  const blockTags = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);
  const containerTags = new Set(["div", "section", "article", "main"]);
  // deno-lint-ignore no-explicit-any
  const paragraphNodes: Array<{ node: any; listReference?: string; listLevel?: number; listStart?: number }> = [];
  // deno-lint-ignore no-explicit-any
  let inlineBuffer: any[] = [];
  let listSequence = 0;

  const flushInlineBuffer = () => {
    const hasContent = inlineBuffer.some((n) => {
      if (n.nodeType === TEXT_NODE) return !!(n.textContent || "").trim();
      if (n.nodeType !== ELEMENT_NODE) return false;
      if (String(n.tagName).toLowerCase() === "img") return true;
      return !!(n.textContent || "").trim();
    });
    if (!hasContent) { inlineBuffer = []; return; }
    const p = novoElemento("p");
    inlineBuffer.forEach((n) => p.appendChild(n.cloneNode(true)));
    paragraphNodes.push({ node: p });
    inlineBuffer = [];
  };

  // deno-lint-ignore no-explicit-any
  const processNode = (node: any, listReference?: string, listLevel = 0, listStart?: number) => {
    if (node.nodeType === TEXT_NODE) { if ((node.textContent || "").trim()) inlineBuffer.push(node.cloneNode(true)); return; }
    if (node.nodeType !== ELEMENT_NODE) return;
    const tag = String(node.tagName).toLowerCase();
    if (tag === "br") { inlineBuffer.push(node.cloneNode(true)); return; }
    if (tag === "ul" || tag === "ol") {
      flushInlineBuffer();
      const ref = `${tag === "ol" ? "oficio-numbered" : "oficio-bullets"}-${listSequence++}`;
      const start = tag === "ol" ? Number.parseInt(node.getAttribute("start") || "1", 10) || 1 : undefined;
      // deno-lint-ignore no-explicit-any
      Array.from(node.children).forEach((child: any) => processNode(child, ref, listLevel, start));
      return;
    }
    if (blockTags.has(tag)) {
      flushInlineBuffer();
      paragraphNodes.push({ node: node.cloneNode(true), listReference: tag === "li" ? listReference : undefined, listLevel: tag === "li" ? listLevel : undefined, listStart: tag === "li" ? listStart : undefined });
      return;
    }
    if (containerTags.has(tag)) {
      // deno-lint-ignore no-explicit-any
      const hasNestedBlocks = Array.from(node.childNodes).some((child: any) => {
        if (child.nodeType !== ELEMENT_NODE) return false;
        const ct = String(child.tagName).toLowerCase();
        return blockTags.has(ct) || containerTags.has(ct) || ct === "ul" || ct === "ol";
      });
      if (hasNestedBlocks) {
        flushInlineBuffer();
        // deno-lint-ignore no-explicit-any
        Array.from(node.childNodes).forEach((child: any) => processNode(child, listReference, listLevel));
      } else inlineBuffer.push(node.cloneNode(true));
      return;
    }
    inlineBuffer.push(node.cloneNode(true));
  };

  // deno-lint-ignore no-explicit-any
  Array.from(root.childNodes).forEach((n: any) => processNode(n));
  flushInlineBuffer();

  const paragraphs: ParsedParagraph[] = [];
  const processedImageSrcs = new Set<string>();
  const decodeBase64Image = (src: string): ParsedImageRun | null => {
    try {
      const mimeMatch = src.match(/^data:image\/([\w+]+);/);
      const imageType = mimeMatch ? (mimeMatch[1] === "jpeg" || mimeMatch[1] === "jpg" ? "jpg" : "png") : "png";
      return { image: b64ToBytes(src.split(",")[1]), width: 480, height: 360, imageType };
    } catch { return null; }
  };
  // deno-lint-ignore no-explicit-any
  const extractRuns = (node: any, inherited: Omit<StyledRun, "text">): ParsedRun[] => {
    const runs: ParsedRun[] = [];
    // deno-lint-ignore no-explicit-any
    Array.from(node.childNodes).forEach((child: any) => {
      if (child.nodeType === TEXT_NODE) { const text = child.textContent || ""; if (text) runs.push({ text, ...inherited }); return; }
      if (child.nodeType !== ELEMENT_NODE) return;
      const tag = String(child.tagName).toLowerCase();
      if (tag === "br") { runs.push({ text: "", break: 1, ...inherited }); return; }
      if (tag === "img") {
        const src = child.getAttribute("src") || "";
        if (src.startsWith("data:") && !processedImageSrcs.has(src)) { processedImageSrcs.add(src); const d = decodeBase64Image(src); if (d) runs.push(d); }
        return;
      }
      const style = { ...inherited };
      const st = estilo(child.getAttribute("style") || "");
      const styleAttr = String(child.getAttribute("style") || "").toLowerCase();
      if (tag === "strong" || tag === "b" || /font-weight\s*:\s*(bold|[6-9]00)/.test(styleAttr)) style.bold = true;
      if (tag === "em" || tag === "i" || /font-style\s*:\s*italic/.test(styleAttr)) style.italic = true;
      if (tag === "u" || /text-decoration[^;]*underline/.test(styleAttr) || /text-decoration-line\s*:\s*underline/.test(styleAttr)) style.underline = true;
      if (st["font-size"]) {
        const pt = st["font-size"].match(/([\d.]+)\s*pt/i); const px = st["font-size"].match(/([\d.]+)\s*px/i);
        if (pt) style.fontSize = parseFloat(pt[1]); else if (px) style.fontSize = Math.round(parseFloat(px[1]) * 0.75);
      }
      if (st["font-family"]) style.fontFamily = st["font-family"].replace(/['"]/g, "").split(",")[0].trim();
      runs.push(...extractRuns(child, style));
    });
    return runs;
  };

  paragraphNodes.forEach(({ node, listReference, listLevel, listStart }) => {
    const runs = extractRuns(node, {});
    const textOnly = runs.filter((r) => "text" in r && !(r as StyledRun).break).map((r) => (r as StyledRun).text).join("").trim();
    const hasRenderableContent = runs.some((r) => ("image" in r) || !!((r as StyledRun).text || "").trim());
    if (hasRenderableContent && !textOnly.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i)) {
      const textRuns: ParsedRun[] = []; const imageRuns: ParsedImageRun[] = [];
      for (const r of runs) { if ("image" in r) imageRuns.push(r as ParsedImageRun); else textRuns.push(r); }
      if (textRuns.some((r) => "text" in r && (r as StyledRun).text.trim())) paragraphs.push({ runs: textRuns, listReference, listLevel, listStart });
      for (const img of imageRuns) paragraphs.push({ runs: [img] });
    }
  });
  return paragraphs;
}

async function fixDocxRelationshipIds(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const zip = await JSZip.loadAsync(bytes);
    const relsFiles: string[] = [];
    zip.forEach((path: string) => { if (path.endsWith(".rels")) relsFiles.push(path); });
    let modified = false;
    for (const relsPath of relsFiles) {
      const file = zip.file(relsPath); if (!file) continue;
      let relsXml = await file.async("string");
      if (!relsXml.includes('"rId0"')) continue;
      modified = true;
      const idMatches = [...relsXml.matchAll(/Id="rId(\d+)"/g)];
      const newId = Math.max(0, ...idMatches.map((m) => parseInt(m[1], 10))) + 1;
      relsXml = relsXml.replace(/Id="rId0"/g, `Id="rId${newId}"`);
      zip.file(relsPath, relsXml);
      const xmlPath = relsPath.replace("/_rels/", "/").replace(".xml.rels", ".xml");
      const xmlFile = zip.file(xmlPath);
      if (xmlFile) {
        let xml = await xmlFile.async("string");
        xml = xml.replace(/r:embed="rId0"/g, `r:embed="rId${newId}"`).replace(/r:id="rId0"/g, `r:id="rId${newId}"`);
        zip.file(xmlPath, xml);
      }
    }
    if (!modified) return bytes;
    return await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  } catch (err) {
    console.error("[oficioDocx] fixDocxRelationshipIds:", err);
    return bytes;
  }
}

export async function buildOficioDocx(data: OficioDocxData): Promise<Uint8Array> {
  const conteudo = sanitizeConteudoParaExport(normalizarConteudoOficio(data.conteudo || ""), data);
  const { numero, destinatario, assunto, bairro, cargoDestinatario, dataGeracao } = data;
  const logoCamaraBytes = b64ToBytes(LOGO_CAMARA_JPG_B64);
  const logoFabaoBytes = b64ToBytes(LOGO_FABAO_PNG_B64);
  const assinaturaBytes = b64ToBytes(ASSINATURA_PNG_B64);
  const stripHtml = (s: string) => String(s || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

  const hoje = new Date();
  const numeroCleaned = cleanNumero(stripHtml(numero || ""));
  const numeroFormatado = numeroCleaned ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`) : "___";
  const rawDestinatario = stripHtml(cargoDestinatario || destinatario || (data.secretaria ? getDestinatario(data.secretaria) : "___"));
  const destinatarioCompleto = rawDestinatario.replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim() || "___";
  void bairro; void extrairBairro; // o modelo atual nao imprime o bairro (igual a exportacao da tela)
  const assuntoFormatado = stripHtml(assunto).replace(/^(?:ASSUNTO\s*:\s*)+/i, "").trim() || "___";
  const vocativo = data.vocativo || (data.secretaria ? getVocativo(data.secretaria) : "Excelentíssimo(a) Senhor(a) Secretário(a),");
  const styledParagraphs = parseHtmlToParagraphs(conteudo);

  const contentLength = (conteudo || "").replace(/<[^>]+>/g, "").length;
  const autoCalc = contentLength < 400 ? { size: 24, line: 480 } : contentLength < 600 ? { size: 22, line: 440 } : contentLength < 900 ? { size: 21, line: 400 } : contentLength < 1200 ? { size: 20, line: 360 } : contentLength < 1800 ? { size: 20, line: 340 } : { size: 20, line: 320 };
  const defaultFontSize = autoCalc.size;
  const defaultFontName = "Arial";
  const lineSpacing = autoCalc.line;

  const bodyParagraphs: Paragraph[] = [];
  const inlineImages: ParsedImageRun[] = [];
  styledParagraphs.forEach(({ runs, listReference, listLevel }) => {
    if (runs.length > 0 && runs.every((r) => "image" in r)) { for (const r of runs) inlineImages.push(r as ParsedImageRun); return; }
    const children: TextRun[] = [];
    for (const r of runs) {
      if ("image" in r) inlineImages.push(r as ParsedImageRun);
      else children.push(new TextRun({ text: r.text, break: r.break, font: defaultFontName, size: defaultFontSize, bold: r.bold, italics: r.italic, underline: r.underline ? {} : undefined }));
    }
    if (children.length > 0) {
      bodyParagraphs.push(new Paragraph({ indent: listReference ? undefined : { firstLine: 709 }, alignment: AlignmentType.JUSTIFIED, children, spacing: { before: 0, after: 0, line: lineSpacing }, numbering: listReference ? { reference: listReference, level: listLevel || 0 } : undefined }));
    }
  });
  if (inlineImages.length > 0) {
    const n = inlineImages.length;
    const dims = n === 1 ? { w: 480, h: 360, cols: 1 } : n === 2 ? { w: 420, h: 280, cols: 1 } : n <= 4 ? { w: 260, h: 195, cols: 2 } : n <= 6 ? { w: 260, h: 170, cols: 2 } : { w: 180, h: 135, cols: 3 };
    for (let i = 0; i < n; i += dims.cols) {
      const group = inlineImages.slice(i, i + dims.cols);
      bodyParagraphs.push(new Paragraph({ alignment: AlignmentType.CENTER, children: group.map((r) => new ImageRun({ data: r.image, transformation: { width: dims.w, height: dims.h }, type: r.imageType as "png" | "jpg" })), spacing: { before: 80, after: 80, line: lineSpacing } }));
    }
  }
  const listDefinitions = Array.from(new Map(styledParagraphs.filter((p) => Boolean(p.listReference)).map((p) => [p.listReference!, { reference: p.listReference!, start: p.listStart || 1 }])).values());

  const doc = new Document({
    numbering: { config: listDefinitions.map(({ reference, start }) => ({ reference, levels: [{ level: 0, start, format: reference.startsWith("oficio-numbered") ? LevelFormat.DECIMAL : LevelFormat.BULLET, text: reference.startsWith("oficio-numbered") ? "%1." : "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 709, hanging: 360 } } } }] })) },
    sections: [{
      properties: { page: { margin: { top: 1701, right: 1134, bottom: 1134, left: 1701 } } },
      headers: { default: new Header({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new ImageRun({ data: logoCamaraBytes, transformation: { width: 240, height: 70 }, type: "jpg" }),
          new TextRun({ text: "    ", font: defaultFontName, size: defaultFontSize }),
          new ImageRun({ data: logoFabaoBytes, transformation: { width: 140, height: 70 }, type: "png" }),
        ], spacing: { before: 0, after: 0 } }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: defaultFontName, size: 18 })], spacing: { before: 0, after: 0 } }),
      ] }) },
      footers: { default: new Footer({ children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG", font: defaultFontName, size: 18, color: "444444" })], spacing: { before: 0, after: 0 } }),
      ] }) },
      children: [
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: formatDate(dataGeracao), font: defaultFontName, size: defaultFontSize })], spacing: { before: 120, after: 360, line: lineSpacing } }),
        new Paragraph({ children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: defaultFontName, size: defaultFontSize, bold: true })], spacing: { before: 0, after: 240, line: lineSpacing } }),
        new Paragraph({ children: [new TextRun({ text: "DESTINATÁRIO: ", font: defaultFontName, size: defaultFontSize, bold: true }), new TextRun({ text: destinatarioCompleto, font: defaultFontName, size: defaultFontSize, bold: true })], spacing: { before: 0, after: 0, line: lineSpacing } }),
        new Paragraph({ children: [new TextRun({ text: "ASSUNTO: ", font: defaultFontName, size: defaultFontSize, bold: true }), new TextRun({ text: assuntoFormatado, font: defaultFontName, size: defaultFontSize, bold: true })], spacing: { before: 0, after: 240, line: lineSpacing } }),
        new Paragraph({ alignment: AlignmentType.LEFT, indent: { firstLine: 709 }, children: [new TextRun({ text: vocativo, font: defaultFontName, size: defaultFontSize, bold: false })], spacing: { before: 0, after: 240, line: lineSpacing } }),
        ...bodyParagraphs,
        new Paragraph({ indent: { firstLine: 709 }, children: [new TextRun({ text: data.fechamento || "Atenciosamente,", font: defaultFontName, size: defaultFontSize })], spacing: { before: 180, after: 180, line: lineSpacing }, keepNext: true, keepLines: true }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new ImageRun({ data: assinaturaBytes, transformation: { width: ASSINATURA_LARGURA, height: ASSINATURA_ALTURA }, type: "png" }),
          new TextRun({ text: "FABÃO", font: defaultFontName, size: defaultFontSize, bold: true, break: 1 }),
          new TextRun({ text: "Vereador", font: defaultFontName, size: defaultFontSize, break: 1 }),
        ], spacing: { before: 0, after: 0, line: 240 }, keepLines: true }),
      ],
    }],
  });
  const raw = new Uint8Array(await Packer.toBuffer(doc));
  return await fixDocxRelationshipIds(raw);
}

// DOCX -> PDF pelo ConvertAPI (mesmas chaves e ordem do convert-to-pdf)
export async function docxToPdfConvertApi(docxBytes: Uint8Array, filename: string): Promise<Uint8Array> {
  const keys: string[] = [];
  for (const name of ["CONVERTAPI_SECRET_3", "CONVERTAPI_SECRET", "CONVERTAPI_SECRET_2"]) {
    const v = Deno.env.get(name); if (v && !keys.includes(v)) keys.push(v);
  }
  if (!keys.length) throw new Error("Nenhuma chave do ConvertAPI configurada");
  let binary = "";
  for (let i = 0; i < docxBytes.length; i += 8192) binary += String.fromCharCode(...docxBytes.subarray(i, i + 8192));
  const base64 = btoa(binary);
  const erros: string[] = [];
  for (const secret of keys) {
    try {
      const resp = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${secret}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Parameters: [{ Name: "File", FileValue: { Name: filename, Data: base64 } }, { Name: "StoreFile", Value: true }, { Name: "ImageResolution", Value: 300 }, { Name: "ImageQuality", Value: 100 }] }),
      });
      if (!resp.ok) throw new Error(`ConvertAPI ${resp.status} ${(await resp.text()).slice(0, 200)}`);
      const url = (await resp.json())?.Files?.[0]?.Url;
      if (!url) throw new Error("ConvertAPI sem URL do PDF");
      const pdf = new Uint8Array(await (await fetch(url)).arrayBuffer());
      if (pdf.length < 5 || String.fromCharCode(...pdf.subarray(0, 4)) !== "%PDF") throw new Error("ConvertAPI devolveu algo que nao e PDF");
      return pdf;
    } catch (e) { erros.push(String((e as Error)?.message || e)); }
  }
  throw new Error("ConvertAPI falhou: " + erros.join(" | "));
}
