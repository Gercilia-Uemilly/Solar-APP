import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer, Header, PageNumber } from "docx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";
import { pdfToImageFiles } from "@/lib/pdfToImages";
import { mergePdfWithAnexos } from "@/lib/mergePdfAnexos";


// ── Assets ──────────────────────────────────────────────────────────────────
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaClean from "@/assets/assinatura-fabao-clean.png";

// ── FIXED signature dimensions — NEVER change these ─────────────────────────
const ASSINATURA_LARGURA = 227; // ~6cm at 96dpi
const ASSINATURA_ALTURA = 113;  // ~3cm proportional

import { generateOperatorCode, formatDateOficio as formatDate, cleanNumero, getDestinatario, getVocativo, extrairBairro } from "@/lib/oficioUtils";
export { generateOperatorCode };

function buildFileName(numero: string, solicitante?: string, codigoZ?: string, contatoSolicitante?: string, origem?: string): string {
  const cleanedNumero = cleanNumero(numero || "");
  const numPart = cleanedNumero.replace(/\//, '-').replace(/[^0-9a-zA-Z\-\s]/g, '').trim() || 'rascunho';
  
  const ORIGENS_COM_Z = ["Zap", "Conecta Jovem", "Empregador", "DI"];
  const isOrigemComZ = ORIGENS_COM_Z.includes(origem || "");
  
  if (codigoZ && isOrigemComZ) {
    const digits = (contatoSolicitante || "").replace(/\D/g, '');
    const last4 = digits.length >= 4 ? digits.slice(-4) : digits;
    const zPart = last4 ? `Z${codigoZ} ${last4}` : `Z${codigoZ}`;
    
    // All Z-code origins: numero + Z + last4 only (no solicitante name)
    return `${numPart} ${zPart}`;
  }
  
  // Non-Z origins: standard format
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
  origem?: string;
  descricaoAnexos?: string;
  vocativo?: string;
  fechamento?: string;
  oficioId?: string;
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

// ── Fetch image as Uint8Array with in-memory cache ─────────────────────────
type FetchImageOptions = { flattenWhite?: boolean };
const _imageCache = new Map<string, Uint8Array>();

async function fetchImageBytes(src: string, options?: FetchImageOptions): Promise<Uint8Array> {
  const cacheKey = `${src}__${options?.flattenWhite ? "flat" : "raw"}`;
  const cached = _imageCache.get(cacheKey);
  if (cached) return cached;

  let bytes: Uint8Array;

  if (!options?.flattenWhite) {
    const resp = await fetch(src);
    bytes = new Uint8Array(await resp.arrayBuffer());
  } else {
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
      bytes = new Uint8Array(await blob.arrayBuffer());
    } catch {
      const resp = await fetch(src);
      bytes = new Uint8Array(await resp.arrayBuffer());
    }
  }

  _imageCache.set(cacheKey, bytes);
  return bytes;
}

// ── Get user session token ──────────────────────────────────────────────────
async function getAuthToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!error && session?.access_token) {
    return session.access_token;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError || !refreshed.session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  return refreshed.session.access_token;
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

  // Strip HTML tags from fields that may contain rich-text from contentEditable
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();

  const hoje = new Date();
  const numeroCleaned = cleanNumero(stripHtml(numero || ""));
  const numeroFormatado = numeroCleaned
    ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`)
    : "___";

  // Priority: manual edit (cargoDestinatario) > direct destinatario > secretaria auto-fill
  const rawDestinatario = stripHtml(cargoDestinatario || destinatario || (data.secretaria ? getDestinatario(data.secretaria) : "___"));
  const destinatarioCompleto = rawDestinatario || "___";
  const bairroExtraido = bairro ? (extrairBairro(bairro) || bairro) : "";
  const bairroFormatado = bairroExtraido
    ? (bairroExtraido.toLowerCase().startsWith("bairro") || bairroExtraido.toLowerCase().includes("bairro ") ? bairroExtraido : `Bairro ${bairroExtraido}`)
    : "";

  // Use assunto exactly as provided — bairro is already included by the AI or user
  const assuntoFormatado = stripHtml(assunto) || "___";

  const vocativo = data.vocativo || (data.secretaria ? getVocativo(data.secretaria) : "Excelentíssimo(a) Senhor(a) Secretário(a),");

  const styledParagraphs = parseHtmlToParagraphs(conteudo);

  // Auto-adjust font size and line spacing based on content length (half-points)
  const contentLength = (conteudo || "").replace(/<[^>]+>/g, "").length;
  const calcularFonteEspacamento = (chars: number) => {
    if (chars < 400) return { size: 24, line: 480 };  // 12pt equivalent in half-points
    if (chars < 600) return { size: 22, line: 440 };  // 11pt
    if (chars < 900) return { size: 21, line: 400 };  // 10.5pt
    if (chars < 1200) return { size: 20, line: 360 }; // 10pt
    if (chars < 1800) return { size: 20, line: 340 }; // 10pt
    return { size: 20, line: 320 };                    // 10pt — long text, 2+ pages
  };
  const autoCalc = calcularFonteEspacamento(contentLength);

  // If user set explicit format options, use them (capped at 12pt=24 half-points), otherwise auto
  const defaultFontSize = data.formatOptions?.fontSize
    ? Math.min(data.formatOptions.fontSize * 2, 24)
    : autoCalc.size;
  const defaultFontName = data.formatOptions?.fontFamily || "Arial";

  const lineSpacing = data.formatOptions?.lineSpacing
    ? Math.round(data.formatOptions.lineSpacing * 240)
    : autoCalc.line;

  // operadorMarca removed — operator name no longer appears in document

  // Body paragraphs — handle both text runs and inline images
  const bodyParagraphs: Paragraph[] = [];
  
  // Collect all inline images separately for grid layout
  const inlineImages: ParsedImageRun[] = [];
  
  styledParagraphs.forEach((runs) => {
    const isImageOnly = runs.length > 0 && runs.every(r => 'image' in r);
    
    if (isImageOnly) {
      // Collect images for batched grid layout
      for (const r of runs) {
        if ('image' in r) inlineImages.push(r as ParsedImageRun);
      }
      return;
    }
    
    const children: (TextRun | ImageRun)[] = [];
    for (const r of runs) {
      if ('image' in r) {
        inlineImages.push(r as ParsedImageRun);
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

    if (children.length > 0) {
      bodyParagraphs.push(new Paragraph({
        indent: { firstLine: 709 },
        alignment: AlignmentType.JUSTIFIED,
        children,
        spacing: { before: 0, after: 0, line: lineSpacing },
      }));
    }
  });
  
  // Group inline images with dynamic grid layout
  if (inlineImages.length > 0) {
    const totalImgs = inlineImages.length;
    const calcDims = (count: number) => {
      if (count === 1) return { w: 454, h: 340, cols: 1 };
      if (count === 2) return { w: 284, h: 213, cols: 2 };
      if (count === 3) return { w: 182, h: 137, cols: 3 };
      if (count === 4) return { w: 284, h: 213, cols: 2 };
      if (count <= 6) return { w: 182, h: 150, cols: 3 };
      return { w: 136, h: 120, cols: 4 };
    };
    const dims = calcDims(totalImgs);

    for (let i = 0; i < inlineImages.length; i += dims.cols) {
      const group = inlineImages.slice(i, i + dims.cols);
      
      const imageRuns: ImageRun[] = group.map(r => new ImageRun({
        data: r.image,
        transformation: { width: dims.w, height: dims.h },
        type: ('imageType' in r ? r.imageType : "png") as "png" | "jpg" | "gif" | "bmp",
      }));
      
      bodyParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: imageRuns,
        spacing: { before: 80, after: 80, line: lineSpacing },
      }));
    }
  }

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

        // Parágrafo de descrição dos anexos (antes do Atenciosamente)
        ...(data.descricaoAnexos && data.imagens && data.imagens.length > 0 ? [
          new Paragraph({
            indent: { firstLine: 709 },
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({
              text: `Destaca-se que seguem anexos a este ofício ${data.descricaoAnexos}.`,
              font: defaultFontName,
              size: defaultFontSize,
            })],
            spacing: { before: 0, after: 0, line: lineSpacing },
            keepNext: true,
            keepLines: true,
          }),
        ] : []),

        // Atenciosamente + assinatura sempre juntos
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: data.fechamento || "Atenciosamente,", font: defaultFontName, size: defaultFontSize })],
          spacing: { before: 180, after: 180, line: lineSpacing },
          keepNext: true,
          keepLines: true,
        }),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: assinaturaBytes,
              transformation: { width: ASSINATURA_LARGURA, height: ASSINATURA_ALTURA },
              type: "png",
            }),
            new TextRun({ text: "FABÃO", font: defaultFontName, size: defaultFontSize, bold: true, break: 1 }),
            new TextRun({ text: "Vereador", font: defaultFontName, size: defaultFontSize, break: 1 }),
          ],
          spacing: { before: 0, after: 0, line: 240 },
          keepLines: true,
        }),
      ],
    }],
  });

  const rawBlob = await Packer.toBlob(doc);
  return await fixDocxRelationshipIds(rawBlob);
}

// ── Helpers de anexos ───────────────────────────────────────────────────────
const PDF_EXTENSIONS = new Set(["pdf"]);
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);

function getFileExtension(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function normalizeAttachmentMime(fileName: string, ...candidates: Array<string | null | undefined>): string {
  const normalizedCandidates = candidates
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean);

  const extension = getFileExtension(fileName);

  if (normalizedCandidates.some((value) => value.includes("pdf")) || PDF_EXTENSIONS.has(extension)) {
    return "application/pdf";
  }

  const imageCandidate = normalizedCandidates.find((value) => value.startsWith("image/"));
  if (imageCandidate) return imageCandidate;

  if (IMAGE_EXTENSIONS.has(extension)) {
    const ext = extension === "jpg" ? "jpeg" : extension;
    return `image/${ext}`;
  }

  return normalizedCandidates[0] || "application/octet-stream";
}

// ── Enviar docx + anexos para edge function add-anexo-images ───────────────
async function addAnexoImages(docxBlob: Blob, imagens: File[]): Promise<Blob> {
  console.log(`[addAnexoImages] Processando ${imagens.length} anexo(s)`);
  const formData = new FormData();
  formData.append("docx", docxBlob, "oficio.docx");

  let anexoIndex = 0;

  for (const anexo of imagens) {
    const mimeType = normalizeAttachmentMime(anexo.name, anexo.type);
    console.log(`[addAnexoImages] Anexo: ${anexo.name}, tipo: ${mimeType}, tamanho: ${anexo.size}`);

    if (mimeType === "application/pdf") {
      console.log(`[addAnexoImages] Anexando PDF "${anexo.name}" diretamente (sem converter em imagens)`);
      formData.append(`pdf_${anexoIndex++}`, anexo, anexo.name);
      continue;
    }

    if (mimeType.startsWith("image/")) {
      formData.append(`imagem_${anexoIndex++}`, anexo, anexo.name);
      continue;
    }

    console.warn("[addAnexoImages] Tipo de anexo não suportado, ignorando:", {
      nome: anexo.name,
      tipo: anexo.type,
    });
  }

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

// ── Fetch saved anexos from storage as File[] ───────────────────────────────
export async function fetchSavedImages(oficioId: string): Promise<File[]> {
  try {
    console.log(`[fetchSavedImages] Buscando anexos para ofício ${oficioId}`);
    const { data: anexos, error: dbError } = await supabase
      .from("oficio_anexos" as any)
      .select("*")
      .eq("oficio_id", oficioId)
      .order("created_at", { ascending: true });

    if (dbError) {
      console.error("[fetchSavedImages] Erro ao buscar anexos do banco:", dbError);
      return [];
    }

    if (!anexos || anexos.length === 0) {
      console.log("[fetchSavedImages] Nenhum anexo encontrado no banco.");
      return [];
    }

    console.log(`[fetchSavedImages] ${anexos.length} anexo(s) encontrado(s), baixando...`);
    const files: File[] = [];
    for (const a of anexos as any[]) {
      try {
        // Use authenticated download instead of public URL fetch
        const { data: blob, error: dlError } = await supabase.storage
          .from("midias")
          .download(a.storage_path);

        if (dlError || !blob) {
          console.warn(`[fetchSavedImages] Falha ao baixar ${a.file_name}:`, dlError?.message);
          continue;
        }

        const fileName = a.file_name || "anexo";
        const mimeType = normalizeAttachmentMime(fileName, a.mime_type, blob.type);

        files.push(new File([blob], fileName, { type: mimeType }));
        console.log(`[fetchSavedImages] ✓ ${fileName} (${mimeType}, ${blob.size} bytes)`);
      } catch (err) {
        console.error(`[fetchSavedImages] Erro ao baixar anexo ${a.file_name}:`, err);
      }
    }

    console.log(`[fetchSavedImages] ${files.length} arquivo(s) prontos para exportação.`);
    return files;
  } catch (err) {
    console.error("[fetchSavedImages] Erro geral:", err);
    return [];
  }
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

  const fileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante, (data as any).origem);
  saveAs(blob, `${fileName}.docx`);

  // Auto-update status
  await autoUpdateStatus(data.oficioId, "Exportado");

  return blob;
}

// ── Auto-update oficio status after export ──────────────────────────────────
async function autoUpdateStatus(oficioId?: string, newStatus = "Exportado") {
  if (!oficioId) return;
  try {
    await supabase.from("oficios").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", oficioId);
  } catch (e) {
    console.warn("[autoUpdateStatus] Falha ao atualizar status:", e);
  }
}

// ── Export PDF ───────────────────────────────────────────────────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const fileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante, (data as any).origem);

  // Build Word WITH images embedded via edge function
  const wordBlob = await buildWordBlobForExport(data);

  try {
    const pdfBlob = await convertWordToPdf(wordBlob, `${fileName}.docx`);

    // Only merge PDF attachments (images are already embedded in the Word)
    const pdfAnexos = (data.imagens || []).filter(f => {
      const mime = normalizeAttachmentMime(f.name, f.type);
      return mime === "application/pdf";
    });

    if (pdfAnexos.length > 0) {
      const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
      const mergedBytes = await mergePdfWithAnexos(pdfBytes, pdfAnexos);
      const mergedBlob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      saveAs(mergedBlob, `${fileName}.pdf`);
    } else {
      saveAs(pdfBlob, `${fileName}.pdf`);
    }

    // Auto-update status
    await autoUpdateStatus((data as any).oficioId, "Exportado");
  } catch (e: any) {
    console.error("PDF conversion failed:", e);
    const message = e?.message || "Não foi possível gerar o PDF agora. Tente novamente em instantes.";
    if (message.includes("Todos os serviços de conversão falharam")) {
      throw new Error("Falha na conversão de PDF: serviços externos sem créditos/instáveis no momento. O Word continua disponível.");
    }
    throw new Error(message);
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

// ── Build merged PDF blob (for Drive upload) ───────────────────────────────
export async function buildMergedPdfBlob(data: OficioData): Promise<Blob> {
  const wordBlob = await buildWordBlobForExport(data);
  const pdfBlob = await convertWordToPdf(wordBlob, "oficio.docx");

  // Only merge PDF attachments (images already embedded in Word)
  const pdfAnexos = (data.imagens || []).filter(f => {
    const mime = normalizeAttachmentMime(f.name, f.type);
    return mime === "application/pdf";
  });

  if (pdfAnexos.length > 0) {
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const mergedBytes = await mergePdfWithAnexos(pdfBytes, pdfAnexos);
    return new Blob([mergedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  }

  return pdfBlob;
}

// ── Print via Word→PDF conversion ───────────────────────────────────────────
export async function printOficioViaPdf(data: OficioData): Promise<void> {
  const wordBlob = await buildWordBlobForExport(data);
  const pdfBlob = await convertWordToPdf(wordBlob, "oficio.docx");

  // Only merge PDF attachments (images already embedded in Word)
  const pdfAnexos = (data.imagens || []).filter(f => {
    const mime = normalizeAttachmentMime(f.name, f.type);
    return mime === "application/pdf";
  });

  let finalBlob = pdfBlob;
  if (pdfAnexos.length > 0) {
    const pdfBytes = new Uint8Array(await pdfBlob.arrayBuffer());
    const mergedBytes = await mergePdfWithAnexos(pdfBytes, pdfAnexos);
    finalBlob = new Blob([mergedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
  }

  const pdfUrl = URL.createObjectURL(finalBlob);
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
