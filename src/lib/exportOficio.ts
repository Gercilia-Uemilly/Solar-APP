import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, BorderStyle, Footer, Header, PageNumber } from "docx";
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

function generateOperatorCode(name: string, email?: string): string {
  const parts = (name || "").trim().split(/\s+/);
  const first = (parts[0] || "").toLowerCase();
  const lastInitial = parts.length > 1
    ? parts[parts.length - 1][0]?.toLowerCase() || ""
    : (email || "").split("@")[0]?.[0]?.toLowerCase() || "";
  return first ? `${first}.${lastInitial}` : email?.split("@")[0]?.toLowerCase() || "usr";
}

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `Uberlândia, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
}

function buildFileName(numero: string, solicitante?: string): string {
  const numLimpo = numero.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '').trim();
  const base = numLimpo || 'rascunho';
  if (solicitante?.trim()) {
    const code = solicitante.trim().split(/\s+/)[0].replace(/[<>:"/\\|?*]/g, '').substring(0, 30);
    if (code) return `${base} ${code}`;
  }
  return base;
}

/** Build vocativo — removes "Ilmo(a). Sr(a)." prefix and "Municipal" / "da Secretaria..." */
function buildVocativo(cargo?: string): string {
  if (!cargo) return "Excelentíssimo(a) Senhor(a) Secretário(a),";
  const cleaned = cargo
    .replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "")
    .replace(/\s*Municipal\b/i, "")
    .replace(/\s*da Secretaria.*$/i, "")
    .trim();
  return `Excelentíssimo(a) Senhor(a) ${cleaned},`;
}

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
}

// ── Parse HTML content into styled text runs ────────────────────────────────
interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

function parseHtmlToParagraphs(html: string): StyledRun[][] {
  if (!html || !html.includes("<")) {
    return html.split("\n").map(p => p.trim()).filter(Boolean)
      .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i))
      .map(p => [{ text: p }]);
  }

  const div = document.createElement("div");
  div.innerHTML = html;
  const paragraphs: StyledRun[][] = [];

  const extractRuns = (node: Node, inherited: { bold?: boolean; italic?: boolean; underline?: boolean }): StyledRun[] => {
    const runs: StyledRun[] = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent || "";
        if (text) runs.push({ text, ...inherited });
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const style = { ...inherited };
        if (tag === "strong" || tag === "b") style.bold = true;
        if (tag === "em" || tag === "i") style.italic = true;
        if (tag === "u") style.underline = true;
        runs.push(...extractRuns(el, style));
      }
    });
    return runs;
  };

  const blockEls = div.querySelectorAll("p, div, li, h1, h2, h3");
  if (blockEls.length > 0) {
    blockEls.forEach(el => {
      const runs = extractRuns(el, {});
      const text = runs.map(r => r.text).join("").trim();
      if (text && !text.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i)) {
        paragraphs.push(runs);
      }
    });
  } else {
    const runs = extractRuns(div, {});
    const text = runs.map(r => r.text).join("").trim();
    if (text) paragraphs.push(runs);
  }

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

// ── Fetch image as Uint8Array ───────────────────────────────────────────────
async function fetchImageBytes(src: string): Promise<Uint8Array> {
  const resp = await fetch(src);
  return new Uint8Array(await resp.arrayBuffer());
}

// ── Get user session token ──────────────────────────────────────────────────
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

// ── Build Word blob programmatically ────────────────────────────────────────
/** Strip any "Ofício GVF n° " prefix already in the numero string */
function cleanNumero(raw: string): string {
  return raw.replace(/^(Ofício GVF n°\s*)+/i, "").trim();
}

async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
    operadorNome, operadorEmail,
  } = data;

  const [logoCamaraBytes, logoFabaoBytes, assinaturaBytes] = await Promise.all([
    fetchImageBytes(logoCamaraSrc),
    fetchImageBytes(logoFabaoSrc),
    fetchImageBytes(assinaturaClean),
  ]);

  const hoje = new Date();
  const numeroCleaned = cleanNumero(numero || "");
  const numeroFormatado = numeroCleaned
    ? (numeroCleaned.includes("/") ? numeroCleaned : `${numeroCleaned}/${hoje.getFullYear()}`)
    : "___";

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a). Secretário(a) Municipal"} ${destinatario || ""}`.trim();
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";

  let assuntoFormatado = assunto || "___";
  if (bairroFormatado) {
    assuntoFormatado = `${assunto} – ${bairroFormatado}`;
  }

  const vocativo = buildVocativo(cargoDestinatario);

  const styledParagraphs = parseHtmlToParagraphs(conteudo);

  const fontSize = 22; // 11pt in half-points
  const fontName = "Arial";

  // Adaptive line spacing
  const contentParagraphCount = styledParagraphs.length + 6;
  const estimatedHeight1_5 = contentParagraphCount * 18 * 1.5;
  const estimatedHeight1_15 = contentParagraphCount * 18 * 1.15;

  let lineSpacing: number;
  if (estimatedHeight1_5 <= 620) {
    lineSpacing = 360; // 1.5 lines
  } else if (estimatedHeight1_15 <= 620) {
    lineSpacing = 276; // 1.15 lines
  } else {
    lineSpacing = 240; // 1.0 lines
  }

  const operadorMarca = operadorNome
    ? operadorNome.split(' ')[0].toLowerCase()
    : operadorEmail?.split('@')[0].toLowerCase() || 'sistema';

  // Body paragraphs — after:0, before:0, line:lineSpacing, indent 1.25cm (709 twips)
  const bodyParagraphs = styledParagraphs.map((runs, idx) => {
    const isLastTwo = idx >= styledParagraphs.length - 2;
    return new Paragraph({
      indent: { firstLine: 709 },
      alignment: AlignmentType.JUSTIFIED,
      children: runs.map(r => new TextRun({
        text: r.text,
        font: fontName,
        size: fontSize,
        bold: r.bold,
        italics: r.italic,
        underline: r.underline ? {} : undefined,
      })),
      spacing: { before: 0, after: 0, line: lineSpacing },
      keepNext: isLastTwo,
    });
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
                new TextRun({ text: "    ", font: fontName, size: fontSize }),
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
                font: fontName,
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
                font: fontName,
                size: 18, // 9pt
                color: "444444",
              })],
              spacing: { before: 0, after: 0 },
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({
                text: operadorMarca,
                font: fontName,
                size: 12,
                color: "E8E8E8",
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
          children: [new TextRun({ text: formatDate(dataGeracao), font: fontName, size: fontSize })],
          spacing: { before: 120, after: 360, line: lineSpacing },
        }),

        // Ofício GVF n° — bold, after: 240
        new Paragraph({
          children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 240, line: lineSpacing },
        }),

        // DESTINATÁRIO — after: 0
        new Paragraph({
          children: [
            new TextRun({ text: "DESTINATÁRIO: ", font: fontName, size: fontSize, bold: true }),
            new TextRun({ text: destinatarioCompleto, font: fontName, size: fontSize, bold: true }),
          ],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // Assunto — after: 240
        new Paragraph({
          children: [
            new TextRun({ text: "Assunto: ", font: fontName, size: fontSize, bold: true }),
            new TextRun({ text: assuntoFormatado, font: fontName, size: fontSize, bold: true }),
          ],
          spacing: { before: 0, after: 240, line: lineSpacing },
        }),

        // Vocativo — LEFT aligned, after: 240, indent 1.25cm
        new Paragraph({
          alignment: AlignmentType.LEFT,
          indent: { firstLine: 709 },
          children: [new TextRun({ text: vocativo, font: fontName, size: fontSize })],
          spacing: { before: 0, after: 240, line: lineSpacing },
        }),

        // Body paragraphs
        ...bodyParagraphs,

        // Closing paragraph 1 — secretaria
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: `Espero que a ${data.secretaria || "Secretaria"} considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução.`, font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
          alignment: AlignmentType.JUSTIFIED,
        }),

        // Closing paragraph 2 — fixed
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: "Na certeza de contar com o vosso pronto atendimento, desde já agradeço.", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
          alignment: AlignmentType.JUSTIFIED,
        }),

        // Atenciosamente — before: 240, after: 480, indent 1.25cm
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: "Atenciosamente,", font: fontName, size: fontSize })],
          spacing: { before: 240, after: 480, line: lineSpacing },
        }),

        // Signature image
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
        }),


        // FABÃO — bold, centered, simple line spacing (240)
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FABÃO", font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: 240 },
          keepNext: true,
          keepLines: true,
        }),

        // Vereador — centered, simple line spacing (240)
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Vereador", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: 240 },
          keepLines: true,
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

// ── Export Word ──────────────────────────────────────────────────────────────
export async function exportToWord(data: OficioData): Promise<Blob> {
  let blob = await buildWordBlob(data);

  if (data.imagens && data.imagens.length > 0) {
    blob = await addAnexoImages(blob, data.imagens);
  }

  const fileName = buildFileName(data.numero, data.solicitante);
  saveAs(blob, `${fileName}.docx`);
  return blob;
}

// ── Export PDF ───────────────────────────────────────────────────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const fileName = buildFileName(data.numero, data.solicitante);

  try {
    let wordBlob = await buildWordBlob(data);
    if (data.imagens && data.imagens.length > 0) {
      wordBlob = await addAnexoImages(wordBlob, data.imagens);
    }
    const pdfBlob = await convertWordToPdf(wordBlob, `${fileName}.docx`);
    saveAs(pdfBlob, `${fileName}.pdf`);
  } catch (e) {
    console.warn("PDF conversion via server failed, opening print dialog:", e);
    const { printOficio } = await import("@/lib/printOficio");
    await printOficio(data);
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

  return resp.blob();
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
