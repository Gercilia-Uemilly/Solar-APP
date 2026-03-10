import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, BorderStyle, Footer, Header, PageNumber } from "docx";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

// ── Assets ──────────────────────────────────────────────────────────────────
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaClean from "@/assets/assinatura-fabao-clean.png";

// ── FIXED signature dimensions — NEVER change these ─────────────────────────
// 6cm = 2160000 EMU, 3cm = 1080000 EMU  (1cm = 360000 EMU)
// In pixels at 96dpi: 6cm ≈ 227px, 3cm ≈ 113px
const ASSINATURA_LARGURA = 227; // ~6cm at 96dpi — IMMUTABLE
const ASSINATURA_ALTURA = 113;  // ~3cm proportional — IMMUTABLE

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

/** Build file name: [numero com ano] [código solicitante] — numero já contém /ANO */
function buildFileName(numero: string, solicitante?: string): string {
  const numLimpo = numero.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '').trim();
  const base = numLimpo || 'rascunho';
  if (solicitante?.trim()) {
    const code = solicitante.trim().split(/\s+/)[0].replace(/[<>:"/\\|?*]/g, '').substring(0, 30);
    if (code) return `${base} ${code}`;
  }
  return base;
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

// ── Fix rId0 in DOCX rels files (OOXML requires rId >= 1) ───────────────────
async function fixDocxRelationshipIds(blob: Blob): Promise<Blob> {
  try {
    const zip = await JSZip.loadAsync(blob);
    const relsFiles: string[] = [];

    zip.forEach((path) => {
      if (path.endsWith(".rels")) relsFiles.push(path);
    });

    let modified = false;
    for (const relsPath of relsFiles) {
      const file = zip.file(relsPath);
      if (!file) continue;
      let relsXml = await file.async("string");
      if (!relsXml.includes('"rId0"')) continue;

      console.log(`[fixDocxRIds] Found rId0 in ${relsPath}`);
      modified = true;

      const idMatches = [...relsXml.matchAll(/Id="rId(\d+)"/g)];
      const maxId = Math.max(0, ...idMatches.map(m => parseInt(m[1], 10)));
      const newId = maxId + 1;

      relsXml = relsXml.replace(/Id="rId0"/g, `Id="rId${newId}"`);
      zip.file(relsPath, relsXml);

      // Fix corresponding XML references
      const xmlPath = relsPath.replace("/_rels/", "/").replace(".xml.rels", ".xml");
      const xmlFile = zip.file(xmlPath);
      if (xmlFile) {
        let xml = await xmlFile.async("string");
        xml = xml.replace(/r:embed="rId0"/g, `r:embed="rId${newId}"`);
        xml = xml.replace(/r:id="rId0"/g, `r:id="rId${newId}"`);
        zip.file(xmlPath, xml);
      }
    }

    if (!modified) {
      console.log("[fixDocxRIds] No rId0 found, returning original blob");
      return blob;
    }

    return await zip.generateAsync({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      compression: "DEFLATE",
    });
  } catch (err) {
    console.error("[fixDocxRIds] Error during post-processing, returning original:", err);
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
async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
    operadorNome, operadorEmail,
  } = data;

  const signatureSrc = assinaturaClean;

  const [logoCamaraBytes, logoFabaoBytes, assinaturaBytes] = await Promise.all([
    fetchImageBytes(logoCamaraSrc),
    fetchImageBytes(logoFabaoSrc),
    fetchImageBytes(signatureSrc),
  ]);

  const hoje = new Date();
  const numeroFormatado = numero
    ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
    : "___";

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a). Secretário(a) Municipal"} ${destinatario || "___"}`;
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";

  let assuntoFormatado = assunto || "___";
  if (bairroFormatado) {
    assuntoFormatado = `${assunto} – ${bairroFormatado}`;
  }

  const styledParagraphs = parseHtmlToParagraphs(conteudo);

  const fontSize = 22; // 11pt in half-points
  const fontName = "Arial";

  // ── Adaptive line spacing: reduce spacing to fit on 1 page, NEVER reduce signature ──
  // Approximate: each paragraph ~1 line, usable page height ~700pt (A4 minus margins/header/footer)
  const contentParagraphCount = styledParagraphs.length + 6; // body + header elements
  const estimatedHeight1_5 = contentParagraphCount * 18 * 1.5; // 18pt line * 1.5
  const estimatedHeight1_15 = contentParagraphCount * 18 * 1.15;

  let lineSpacing: number;
  if (estimatedHeight1_5 <= 620) {
    lineSpacing = 360; // 1.5 lines
  } else if (estimatedHeight1_15 <= 620) {
    lineSpacing = 276; // 1.15 lines
  } else {
    lineSpacing = 240; // 1.0 lines — minimum, let it flow to page 2 if needed
  }

  const operadorMarca = operadorNome
    ? operadorNome.split(' ')[0].toLowerCase()
    : operadorEmail?.split('@')[0].toLowerCase() || 'sistema';

  // Body paragraphs
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
      keepNext: isLastTwo,  // keep last 2 paragraphs with signature
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
                size: 16,
                color: "444444",
              })],
              spacing: { before: 0, after: 40 },
            }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({
                children: [PageNumber.CURRENT],
                font: fontName,
                size: 14,
                color: "888888",
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
        // Date
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: formatDate(dataGeracao), font: fontName, size: fontSize })],
          spacing: { before: 120, after: 0, line: lineSpacing },
        }),

        // Ofício number
        new Paragraph({
          children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: fontName, size: fontSize, bold: true })],
          spacing: { before: 160, after: 0, line: lineSpacing },
        }),

        // Destinatário
        new Paragraph({
          children: [
            new TextRun({ text: "DESTINATÁRIO: ", font: fontName, size: fontSize, bold: true }),
            new TextRun({ text: destinatarioCompleto, font: fontName, size: fontSize }),
          ],
          spacing: { before: 160, after: 0, line: lineSpacing },
        }),

        // Assunto
        new Paragraph({
          children: [
            new TextRun({ text: "Assunto: ", font: fontName, size: fontSize, bold: true }),
            new TextRun({ text: assuntoFormatado, font: fontName, size: fontSize }),
          ],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // Greeting
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: cargoDestinatario
            ? `Excelentíssimo(a) Senhor(a) ${cargoDestinatario.replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "").trim()},`
            : "Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,", font: fontName, size: fontSize })],
          spacing: { before: 200, after: 100, line: lineSpacing },
        }),

        // Body paragraphs (NO keepNext on body — only signature block keeps together)
        ...bodyParagraphs,

        // Closing
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: "Atenciosamente,", font: fontName, size: fontSize })],
          spacing: { before: 160, after: 0, line: lineSpacing },
        }),

        // Signature image — inline, no background, transparent PNG
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: assinaturaBytes,
              transformation: { width: ASSINATURA_LARGURA, height: ASSINATURA_ALTURA },
              type: "png",
            }),
          ],
          spacing: { before: 80, after: 0 },
          keepNext: true,
          keepLines: true,
        }),

        // Signature line
        new Paragraph({
          alignment: AlignmentType.CENTER,
          indent: { left: 4540, right: 4540 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, space: 1, color: "000000" },
          },
          children: [new TextRun({ text: " ", font: fontName, size: 2 })],
          spacing: { before: 0, after: 0 },
          keepNext: true,
          keepLines: true,
        }),

        // Name
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FABÃO", font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: lineSpacing },
          keepNext: true,
          keepLines: true,
        }),

        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Vereador", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
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

// ── Export PDF (via Word→PDF conversion, with print fallback) ───────────────
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
    console.warn("PDF conversion via server failed, opening print dialog for Save as PDF:", e);
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
