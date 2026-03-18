import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer, Header, PageNumber, BorderStyle } from "docx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";


// ── Assets ──────────────────────────────────────────────────────────────────
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaClean from "@/assets/assinatura-fabao-clean.png";

// ── FIXED signature dimensions — NEVER change these ─────────────────────────
const ASSINATURA_LARGURA = 227; // ~6cm at 96dpi
const ASSINATURA_ALTURA = 113;  // ~3cm proportional

import { generateOperatorCode, formatDateOficio as formatDate, cleanNumero, buildVocativo, extrairBairro } from "@/lib/oficioUtils";
export { generateOperatorCode };

function buildFileName(numero: string, solicitante?: string, codigoZ?: string, contatoSolicitante?: string): string {
  const cleanedNumero = cleanNumero(numero || "");
  const numPart = cleanedNumero.replace(/\//, '-').replace(/[^0-9a-zA-Z\-\s]/g, '').trim() || 'rascunho';
  
  // If codigoZ is provided (Zap Emprego), format as "2026 - Z 4567"
  if (codigoZ) {
    const digits = (contatoSolicitante || "").replace(/\D/g, '');
    const last4 = digits.length >= 4 ? digits.slice(-4) : digits;
    // numPart already has the year part, append Z + last4
    const zPart = last4 ? `${codigoZ} ${last4}` : codigoZ;
    return `${numPart} ${zPart}`;
  }
  
  // Extract the solicitante code (first word, e.g. "R12649" from "R12649 Maria")
  const solicitanteCode = (solicitante || "").trim().split(/\s+/)[0] || "";
  
  if (solicitanteCode) {
    return `${numPart} ${solicitanteCode}`;
  }
  
  return numPart;
}

// buildVocativo and cleanNumero now imported from oficioUtils

// ── Dados comuns ─────────────────────────────────────────────────────────────
export interface OficioData {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  logoCamaraUrl?: string;
  logoFabaoUrl?: string;
  cargoDestinatario?: string;
  assinaturaUrl?: string;
  dataGeracao?: string;
  operadorNome?: string;
  operadorEmail?: string;
  telefone?: string;
  imagens?: File[];
  solicitante?: string;
  secretaria?: string;
  codigoZ?: string;
  contatoSolicitante?: string;
  formatOptions?: {
    fontSize?: number;
    lineSpacing?: number;
    fontFamily?: string;
  };
}

// ── Parse HTML content into styled text runs ────────────────────────────────
interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  break?: number;
  fontSize?: number; // in pt
  fontFamily?: string;
}

interface ParsedImageRun {
  image: Uint8Array;
  width: number;
  height: number;
  imageType: string;
}

type ParsedRun = StyledRun | ParsedImageRun;

function parseHtmlToParagraphs(html: string): ParsedRun[][] {
  if (!html) return [];

  if (!html.includes("<")) {
    return html
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\n+/g, " ").trim())
      .filter(Boolean)
      .filter((p) => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i))
      .map((p) => [{ text: p }]);
  }

  const root = document.createElement("div");
  const hasExplicitBlocks = /<(p|div|li|h[1-6]|blockquote|ul|ol)\b/i.test(html);
  if (hasExplicitBlocks) {
    root.innerHTML = html;
  } else {
    const chunks = html
      .split(/\n\s*\n+/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (chunks.length > 1) {
      root.innerHTML = chunks.map((chunk) => `<p>${chunk.replace(/\n/g, "<br/>")}</p>`).join("");
    } else {
      root.innerHTML = html.replace(/\n/g, "<br/>");
    }
  }

  const blockTags = new Set(["p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"]);
  const containerTags = new Set(["div", "section", "article", "main"]);

  const paragraphNodes: HTMLElement[] = [];
  let inlineBuffer: Node[] = [];

  const flushInlineBuffer = () => {
    const hasContent = inlineBuffer.some((n) => {
      if (n.nodeType === Node.TEXT_NODE) return !!(n.textContent || "").trim();
      if (n.nodeType !== Node.ELEMENT_NODE) return false;
      const tag = (n as HTMLElement).tagName.toLowerCase();
      if (tag === "img") return true;
      return !!(n.textContent || "").trim();
    });

    if (!hasContent) {
      inlineBuffer = [];
      return;
    }

    const p = document.createElement("p");
    inlineBuffer.forEach((n) => p.appendChild(n.cloneNode(true)));
    paragraphNodes.push(p);
    inlineBuffer = [];
  };

  const processNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      if ((node.textContent || "").trim()) {
        inlineBuffer.push(node.cloneNode(true));
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === "br") {
      inlineBuffer.push(el.cloneNode(true));
      return;
    }

    if (tag === "ul" || tag === "ol") {
      flushInlineBuffer();
      Array.from(el.children).forEach((child) => processNode(child));
      return;
    }

    if (blockTags.has(tag)) {
      flushInlineBuffer();
      paragraphNodes.push(el.cloneNode(true) as HTMLElement);
      return;
    }

    if (containerTags.has(tag)) {
      const hasNestedBlocks = Array.from(el.childNodes).some((child) => {
        if (child.nodeType !== Node.ELEMENT_NODE) return false;
        const childTag = (child as HTMLElement).tagName.toLowerCase();
        return blockTags.has(childTag) || containerTags.has(childTag) || childTag === "ul" || childTag === "ol";
      });

      if (hasNestedBlocks) {
        flushInlineBuffer();
        Array.from(el.childNodes).forEach((child) => processNode(child));
      } else {
        inlineBuffer.push(el.cloneNode(true));
      }
      return;
    }

    inlineBuffer.push(el.cloneNode(true));
  };

  Array.from(root.childNodes).forEach((node) => processNode(node));
  flushInlineBuffer();

  const paragraphs: ParsedRun[][] = [];
  const processedImageSrcs = new Set<string>(); // Deduplicate images

  const decodeBase64Image = (src: string): ParsedImageRun | null => {
    try {
      const base64 = src.split(",")[1];
      const mimeMatch = src.match(/^data:image\/([\w+]+);/);
      const imageType = mimeMatch ? (mimeMatch[1] === "jpeg" || mimeMatch[1] === "jpg" ? "jpg" : "png") : "png";
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      return { image: bytes, width: 480, height: 360, imageType };
    } catch {
      return null;
    }
  };

  const extractRuns = (
    node: Node,
    inherited: { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: number; fontFamily?: string },
  ): ParsedRun[] => {
    const runs: ParsedRun[] = [];

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || "";
        if (text) runs.push({ text, ...inherited });
        return;
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (tag === "br") {
        runs.push({ text: "", break: 1, ...inherited });
        return;
      }

      if (tag === "img") {
        const src = el.getAttribute("src") || "";
        if (src.startsWith("data:") && !processedImageSrcs.has(src)) {
          processedImageSrcs.add(src);
          const decoded = decodeBase64Image(src);
          if (decoded) runs.push(decoded);
        }
        return;
      }

      const style = { ...inherited };
      const styleAttr = (el.getAttribute("style") || "").toLowerCase();
      const fontWeight = (el.style.fontWeight || "").toLowerCase();

      const isBoldByStyle = /font-weight\s*:\s*(bold|[6-9]00)/.test(styleAttr)
        || ["bold", "600", "700", "800", "900"].includes(fontWeight);
      const isItalicByStyle = /font-style\s*:\s*italic/.test(styleAttr) || el.style.fontStyle.toLowerCase() === "italic";
      const isUnderlineByStyle = /text-decoration[^;]*underline/.test(styleAttr)
        || /text-decoration-line\s*:\s*underline/.test(styleAttr)
        || el.style.textDecoration.toLowerCase().includes("underline");

      if (tag === "strong" || tag === "b" || isBoldByStyle) style.bold = true;
      if (tag === "em" || tag === "i" || isItalicByStyle) style.italic = true;
      if (tag === "u" || isUnderlineByStyle) style.underline = true;

      // Extract inline font-size and font-family
      const inlineFontSize = el.style.fontSize;
      if (inlineFontSize) {
        const ptMatch = inlineFontSize.match(/([\d.]+)\s*pt/i);
        const pxMatch = inlineFontSize.match(/([\d.]+)\s*px/i);
        if (ptMatch) style.fontSize = parseFloat(ptMatch[1]);
        else if (pxMatch) style.fontSize = Math.round(parseFloat(pxMatch[1]) * 0.75);
      }
      const inlineFontFamily = el.style.fontFamily;
      if (inlineFontFamily) {
        style.fontFamily = inlineFontFamily.replace(/['"]/g, "").split(",")[0].trim();
      }

      runs.push(...extractRuns(el, style));
    });

    return runs;
  };

  paragraphNodes.forEach((node) => {
    const runs = extractRuns(node, {});
    const textOnly = runs
      .filter((r) => "text" in r && !(r as StyledRun).break)
      .map((r) => (r as StyledRun).text)
      .join("")
      .trim();

    const hasRenderableContent = runs.some((r) => {
      if ("image" in r) return true;
      return !!(r.text || "").trim();
    });

    if (hasRenderableContent && !textOnly.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i)) {
      // Separate images into their own paragraphs for proper spacing
      const textRuns: ParsedRun[] = [];
      const imageRuns: ParsedImageRun[] = [];
      
      for (const r of runs) {
        if ('image' in r) {
          imageRuns.push(r as ParsedImageRun);
        } else {
          textRuns.push(r);
        }
      }
      
      // Add text paragraph if it has content
      const hasText = textRuns.some(r => 'text' in r && (r as StyledRun).text.trim());
      if (hasText) {
        paragraphs.push(textRuns);
      }
      
      // Add each image as its own paragraph (for proper spacing)
      for (const imgRun of imageRuns) {
        paragraphs.push([imgRun]);
      }
    }
  });

  return paragraphs;
}

// ── Fix rId0 in DOCX rels files ─────────────────────────────────────────────
async function fixDocxRelationshipIds(blob: Blob): Promise<Blob> {
  try {
    const zip = await JSZip.loadAsync(blob);
    const relsFiles: string[] = [];
    zip.forEach((path) => { if (path.endsWith(".rels")) relsFiles.push(path); });

    let modified = false;
    for (const relsPath of relsFiles) {
      const file = zip.file(relsPath);
      if (!file) continue;
      let relsXml = await file.async("string");
      if (!relsXml.includes('"rId0"')) continue;
      modified = true;
      const idMatches = [...relsXml.matchAll(/Id="rId(\d+)"/g)];
      const maxId = Math.max(0, ...idMatches.map(m => parseInt(m[1], 10)));
      const newId = maxId + 1;
      relsXml = relsXml.replace(/Id="rId0"/g, `Id="rId${newId}"`);
      zip.file(relsPath, relsXml);
      const xmlPath = relsPath.replace("/_rels/", "/").replace(".xml.rels", ".xml");
      const xmlFile = zip.file(xmlPath);
      if (xmlFile) {
        let xml = await xmlFile.async("string");
        xml = xml.replace(/r:embed="rId0"/g, `r:embed="rId${newId}"`);
        xml = xml.replace(/r:id="rId0"/g, `r:id="rId${newId}"`);
        zip.file(xmlPath, xml);
      }
    }

    if (!modified) return blob;
    return await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (err) {
    console.error("[fixDocxRIds] Error:", err);
    return blob;
  }
}

// ── Fetch image as Uint8Array (optional white background flatten) ───────────
type FetchImageOptions = { flattenWhite?: boolean };

async function fetchImageBytes(src: string, options?: FetchImageOptions): Promise<Uint8Array> {
  if (!options?.flattenWhite) {
    const resp = await fetch(src);
    return new Uint8Array(await resp.arrayBuffer());
  }

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Falha ao carregar imagem"));
      el.src = src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context indisponível");

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error("Falha ao converter imagem"));
      }, "image/png");
    });

    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    const resp = await fetch(src);
    return new Uint8Array(await resp.arrayBuffer());
  }
}

// ── Get user session token ──────────────────────────────────────────────────
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

// ── Build Word blob programmatically ────────────────────────────────────────
// cleanNumero imported from oficioUtils

async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
    operadorNome, operadorEmail,
  } = data;

  const [logoCamaraBytes, logoFabaoBytes, assinaturaBytes] = await Promise.all([
    fetchImageBytes(logoCamaraSrc),
    fetchImageBytes(logoFabaoSrc),
    fetchImageBytes(assinaturaClean, { flattenWhite: true }),
  ]);

  const hoje = new Date();
  const numeroCleaned = cleanNumero(numero || "");
  const numeroFormatado = numeroCleaned
    ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`)
    : "___";

  const destinatarioCompleto = cargoDestinatario || `Ilmo(a). Sr(a). Secretário(a) Municipal${destinatario ? ` ${destinatario}` : ""}`;
  const bairroExtraido = bairro ? (extrairBairro(bairro) || bairro) : "";
  const bairroFormatado = bairroExtraido
    ? (bairroExtraido.toLowerCase().startsWith("bairro") || bairroExtraido.toLowerCase().includes("bairro ") ? bairroExtraido : `Bairro ${bairroExtraido}`)
    : "";

  // Use assunto exactly as provided — bairro is already included by the AI or user
  const assuntoFormatado = assunto || "___";

  const vocativo = buildVocativo(cargoDestinatario);

  const styledParagraphs = parseHtmlToParagraphs(conteudo);

  const defaultFontSizePt = data.formatOptions?.fontSize || 11;
  const defaultFontSize = defaultFontSizePt * 2; // half-points
  const defaultFontName = data.formatOptions?.fontFamily || "Arial";

  const lineSpacingMultiplier = data.formatOptions?.lineSpacing || 1.5;
  const lineSpacing = Math.round(lineSpacingMultiplier * 240); // 240 twips per line

  // operadorMarca removed — operator name no longer appears in document

  // Body paragraphs — handle both text runs and inline images
  const bodyParagraphs: Paragraph[] = [];
  styledParagraphs.forEach((runs, idx) => {
    const isLastTwo = idx >= styledParagraphs.length - 2;
    const isImageOnly = runs.length > 0 && runs.every(r => 'image' in r);
    const children: (TextRun | ImageRun)[] = [];
    
    for (const r of runs) {
      if ('image' in r) {
        children.push(new ImageRun({
          data: r.image,
          transformation: { width: r.width, height: r.height },
          type: ('imageType' in r ? r.imageType : "png") as "png" | "jpg" | "gif" | "bmp",
        }));
      } else {
        children.push(new TextRun({
          text: r.text,
          break: r.break,
          font: defaultFontName,
          size: defaultFontSize,
          bold: r.bold,
          italics: r.italic,
          underline: r.underline ? {} : undefined,
        }));
      }
    }
    
    bodyParagraphs.push(new Paragraph({
      indent: isImageOnly ? undefined : { firstLine: 709 },
      alignment: isImageOnly ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
      children,
      spacing: isImageOnly 
        ? { before: 400, after: 400, line: lineSpacing }
        : { before: 0, after: 0, line: lineSpacing },
      keepNext: isLastTwo,
    }));
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1701,    // 3cm
            right: 1134,  // 2cm
            bottom: 1134, // 2cm
            left: 1701,   // 3cm
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: logoCamaraBytes,
                  transformation: { width: 240, height: 70 },
                  type: "jpg",
                }),
                new TextRun({ text: "    ", font: defaultFontName, size: defaultFontSize }),
                new ImageRun({
                  data: logoFabaoBytes,
                  transformation: { width: 140, height: 70 },
                  type: "png",
                }),
              ],
              spacing: { before: 0, after: 0 },
            }),
            // Page number — right aligned, Arial 9pt
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({
                children: [PageNumber.CURRENT],
                font: defaultFontName,
                size: 18, // 9pt
              })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                text: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG",
                font: defaultFontName,
                size: 18, // 9pt
                color: "444444",
              })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },
      children: [
        // Date — after: 240
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: formatDate(dataGeracao), font: defaultFontName, size: defaultFontSize })],
          spacing: { before: 120, after: 360, line: lineSpacing },
        }),

        // Ofício GVF n° — bold, after: 240
        new Paragraph({
          children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: defaultFontName, size: defaultFontSize, bold: true })],
          spacing: { before: 0, after: 240, line: lineSpacing },
        }),

        // DESTINATÁRIO — completo em negrito
        new Paragraph({
          children: [
            new TextRun({ text: "DESTINATÁRIO: ", font: defaultFontName, size: defaultFontSize, bold: true }),
            new TextRun({ text: destinatarioCompleto, font: defaultFontName, size: defaultFontSize, bold: true }),
          ],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ASSUNTO — completo em negrito (como modelo)
        new Paragraph({
          children: [
            new TextRun({ text: "ASSUNTO: ", font: defaultFontName, size: defaultFontSize, bold: true }),
            new TextRun({ text: assuntoFormatado, font: defaultFontName, size: defaultFontSize, bold: true }),
          ],
          spacing: { before: 0, after: 240, line: lineSpacing },
        }),

        // Vocativo — LEFT aligned, after: 240, indent 1.25cm, BOLD
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { firstLine: 709 },
          children: [new TextRun({ text: vocativo, font: defaultFontName, size: defaultFontSize, bold: false })],
          spacing: { before: 0, after: 240, line: lineSpacing },
        }),

        // Body paragraphs
        ...bodyParagraphs,



        // Atenciosamente — before: 240, after: 480, indent 1.25cm
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: "Atenciosamente,", font: defaultFontName, size: defaultFontSize })],
          spacing: { before: 240, after: 480, line: lineSpacing },
        }),

        // Signature image — NO borders
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: assinaturaBytes,
              transformation: { width: ASSINATURA_LARGURA, height: ASSINATURA_ALTURA },
              type: "png",
            }),
          ],
          spacing: { before: 0, after: 0 },
          keepNext: true,
          keepLines: true,
          border: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
        }),


        // FABÃO — bold, centered, simple line spacing (240), NO borders
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FABÃO", font: defaultFontName, size: defaultFontSize, bold: true })],
          spacing: { before: 0, after: 0, line: 240 },
          keepNext: true,
          keepLines: true,
          border: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
        }),

        // Vereador — centered, simple line spacing (240), NO borders
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Vereador", font: defaultFontName, size: defaultFontSize })],
          spacing: { before: 0, after: 0, line: 240 },
          keepLines: true,
          border: {
            top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
          },
        }),
      ],
    }],
  });

  const rawBlob = await Packer.toBlob(doc);
  return await fixDocxRelationshipIds(rawBlob);
}

// ── Enviar docx + imagens para edge function add-anexo-images ───────────────
async function addAnexoImages(docxBlob: Blob, imagens: File[]): Promise<Blob> {
  const formData = new FormData();
  formData.append("docx", docxBlob, "oficio.docx");
  imagens.forEach((img, i) => {
    formData.append(`imagem_${i}`, img, img.name);
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = await getAuthToken();

  const resp = await fetch(`${supabaseUrl}/functions/v1/add-anexo-images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao adicionar anexo de imagens");
  }

  return resp.blob();
}

// ── Fetch saved images from storage as File[] ──────────────────────────────
export async function fetchSavedImages(oficioId: string): Promise<File[]> {
  try {
    const { data: anexos } = await supabase.from("oficio_anexos" as any).select("*").eq("oficio_id", oficioId);
    if (!anexos || anexos.length === 0) return [];

    const files: File[] = [];
    for (const a of anexos as any[]) {
      try {
        const { data: urlData } = supabase.storage.from("midias").getPublicUrl(a.storage_path);
        const resp = await fetch(urlData.publicUrl);
        if (!resp.ok) continue;
        const blob = await resp.blob();
        const mimeType = a.mime_type || blob.type;

        // If it's a PDF, convert all pages to images
        if (mimeType === "application/pdf") {
          try {
            const pdfImages = await pdfToImageFiles(blob, a.file_name?.replace(/\.pdf$/i, "") || "pdf");
            files.push(...pdfImages);
          } catch (e) {
            console.error("Failed to convert PDF to images:", e);
          }
        } else {
          files.push(new File([blob], a.file_name, { type: mimeType }));
        }
      } catch { /* skip failed downloads */ }
    }
    return files;
  } catch { return []; }
}

// ── Build Word blob without saving (for external use) ───────────────────────
export async function buildWordBlobForExport(data: OficioData): Promise<Blob> {
  let blob = await buildWordBlob(data);
  if (data.imagens && data.imagens.length > 0) {
    blob = await addAnexoImages(blob, data.imagens);
  }
  return blob;
}

// ── Build file name (exported for external use) ─────────────────────────────
export { buildFileName };


export async function exportToWord(data: OficioData): Promise<Blob> {
  let blob = await buildWordBlob(data);

  if (data.imagens && data.imagens.length > 0) {
    blob = await addAnexoImages(blob, data.imagens);
  }

  const fileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante);
  saveAs(blob, `${fileName}.docx`);
  return blob;
}

// ── Export PDF ───────────────────────────────────────────────────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const fileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante);

  let wordBlob = await buildWordBlob(data);
  if (data.imagens && data.imagens.length > 0) {
    wordBlob = await addAnexoImages(wordBlob, data.imagens);
  }

  try {
    const pdfBlob = await convertWordToPdf(wordBlob, `${fileName}.docx`);
    saveAs(pdfBlob, `${fileName}.pdf`);
  } catch (e: any) {
    console.error("PDF conversion failed:", e);
    throw new Error("Não foi possível gerar o PDF agora. Tente novamente em instantes.");
  }
}

// ── Convert Word blob to PDF via edge function ──────────────────────────────
async function convertWordToPdf(docxBlob: Blob, filename: string): Promise<Blob> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const token = await getAuthToken();

  const formData = new FormData();
  formData.append("file", docxBlob, filename);

  const resp = await fetch(`${supabaseUrl}/functions/v1/convert-to-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Erro ao converter para PDF");
  }

  const blob = await resp.blob();
  const contentType = (resp.headers.get("content-type") || "").toLowerCase();
  const pdfHeader = await blob.slice(0, 5).text();
  const isPdf = contentType.includes("application/pdf") || pdfHeader.startsWith("%PDF-");

  if (!isPdf) {
    throw new Error("A conversão não retornou um PDF válido. Tente novamente.");
  }

  return blob;
}

// ── Print via Word→PDF conversion ───────────────────────────────────────────
export async function printOficioViaPdf(data: OficioData): Promise<void> {
  let wordBlob = await buildWordBlob(data);
  const pdfBlob = await convertWordToPdf(wordBlob, "oficio.docx");
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(pdfUrl, "_blank");
  if (printWindow) {
    printWindow.addEventListener("afterprint", () => URL.revokeObjectURL(pdfUrl));
  }
}

// ── Export CSV ───────────────────────────────────────────────────────────────
export function exportToCSV(oficios: Array<{
  numero?: string;
  assunto: string;
  destinatario: string;
  status: string;
  created_at: string;
  operador_nome?: string;
  profiles?: { full_name?: string };
}>) {
  const header = "Número,Assunto,Destinatário,Status,Data,Autor";
  const rows = oficios.map(o =>
    `"${o.numero || ""}","${o.assunto}","${o.destinatario}","${o.status}","${new Date(o.created_at).toLocaleDateString("pt-BR")}","${o.operador_nome || o.profiles?.full_name || ""}"`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "oficios_lista.csv");
}
