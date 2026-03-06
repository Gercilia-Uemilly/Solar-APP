import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, BorderStyle, Footer, Header, Tab, TabStopType, TabStopPosition, PageNumber } from "docx";
import { saveAs } from "file-saver";

// ── Assets ──────────────────────────────────────────────────────────────────
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaSrc1 from "@/assets/assinatura-fabao-clean.png";
import assinaturaSrc2 from "@/assets/assinatura-fabao.png";

const SIGNATURE_SOURCES = [assinaturaSrc1, assinaturaSrc2];

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

function buildFileName(numero: string, ano: string, codigo?: string): string {
  const numLimpo = numero.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const parts = [numLimpo || 'rascunho', ano];
  if (codigo) parts.push(codigo);
  return parts.join('-');
}

// ── Dados comuns ─────────────────────────────────────────────────────────────
interface OficioData {
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
    // Plain text fallback
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

// ── Fetch image as Uint8Array ───────────────────────────────────────────────
async function fetchImageBytes(src: string): Promise<Uint8Array> {
  const resp = await fetch(src);
  return new Uint8Array(await resp.arrayBuffer());
}

// ── Build Word blob programmatically ────────────────────────────────────────
async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
    operadorNome, operadorEmail, telefone,
  } = data;

  // Randomly pick a signature
  const signatureSrc = SIGNATURE_SOURCES[Math.floor(Math.random() * SIGNATURE_SOURCES.length)];

  // Fetch images
  const [logoCamaraBytes, logoFabaoBytes, assinaturaBytes] = await Promise.all([
    fetchImageBytes(logoCamaraSrc),
    fetchImageBytes(logoFabaoSrc),
    fetchImageBytes(signatureSrc),
  ]);

  const hoje = new Date();
  const numeroFormatado = numero
    ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
    : "___";

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";

  let assuntoFormatado = assunto || "___";
  if (bairroFormatado) {
    assuntoFormatado = `${assunto} – ${bairroFormatado}`;
  }

  // Parse content - supports HTML with bold/italic
  const styledParagraphs = parseHtmlToParagraphs(conteudo);

  const fontSize = 22; // 11pt in half-points
  const fontName = "Arial";
  const lineSpacing = 360; // 1.5 lines

  // Build marca d'água text - operator name in lowercase
  const operadorMarca = operadorNome
    ? operadorNome.split(' ')[0].toLowerCase()
    : operadorEmail?.split('@')[0].toLowerCase() || 'sistema';

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
            // Page number - only visible on multi-page
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
            // Operator watermark - extremely small and discrete
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({
                text: operadorMarca,
                font: fontName,
                size: 12, // 6pt
                color: "E8E8E8", // very light gray ≈5% opacity effect
              })],
              spacing: { before: 0, after: 0 },
            }),
          ],
        }),
      },
      children: [
        // ── Linha em branco após cabeçalho ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Data alinhada à direita ──
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: formatDate(dataGeracao), font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Número do ofício ──
        new Paragraph({
          children: [new TextRun({ text: `Ofício n° ${numeroFormatado}`, font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Destinatário ──
        new Paragraph({
          children: [
            new TextRun({ text: "DESTINATÁRIO: ", font: fontName, size: fontSize, bold: true }),
            new TextRun({ text: destinatarioCompleto, font: fontName, size: fontSize }),
          ],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Assunto ──
        new Paragraph({
          children: [
            new TextRun({ text: "Assunto: ", font: fontName, size: fontSize, bold: true }),
            new TextRun({ text: assuntoFormatado, font: fontName, size: fontSize }),
          ],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Saudação ──
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: "Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Parágrafos do corpo com formatação preservada ──
        ...styledParagraphs.map(runs => new Paragraph({
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
        })),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Fecho ──
        new Paragraph({
          indent: { firstLine: 709 },
          children: [new TextRun({ text: "Atenciosamente,", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Linhas em branco antes da assinatura ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Assinatura (imagem) ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: assinaturaBytes,
              transformation: { width: 200, height: 80 },
              type: "png",
            }),
          ],
          spacing: { before: 0, after: 0 },
        }),

        // ── Linha separadora ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, space: 1, color: "000000" },
          },
          children: [new TextRun({ text: "                              ", font: fontName, size: 2 })],
          spacing: { before: 0, after: 0 },
        }),

        // ── Nome ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FABÃO", font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Cargo ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Vereador", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),
      ],
    }],
  });

  return await Packer.toBlob(doc);
}

// ── Enviar docx + imagens para edge function add-anexo-images ───────────────
async function addAnexoImages(docxBlob: Blob, imagens: File[]): Promise<Blob> {
  const formData = new FormData();
  formData.append("docx", docxBlob, "oficio.docx");
  imagens.forEach((img, i) => {
    formData.append(`imagem_${i}`, img, img.name);
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const resp = await fetch(`${supabaseUrl}/functions/v1/add-anexo-images`, {
    method: "POST",
    headers: { Authorization: `Bearer ${supabaseKey}` },
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

  const ano = new Date().getFullYear().toString();
  const codigo = data.operadorNome ? generateOperatorCode(data.operadorNome, data.operadorEmail) : undefined;
  const fileName = buildFileName(data.numero, ano, codigo);
  saveAs(blob, `${fileName}.docx`);
  return blob;
}

// ── Export PDF (via Word→PDF conversion, with HTML fallback) ────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const ano = new Date().getFullYear().toString();
  const codigo = data.operadorNome ? generateOperatorCode(data.operadorNome, data.operadorEmail) : undefined;
  const fileName = buildFileName(data.numero, ano, codigo);

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
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const formData = new FormData();
  formData.append("file", docxBlob, filename);

  const resp = await fetch(`${supabaseUrl}/functions/v1/convert-to-pdf`, {
    method: "POST",
    headers: { Authorization: `Bearer ${supabaseKey}` },
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
  profiles?: { full_name?: string };
}>) {
  const header = "Número,Assunto,Destinatário,Status,Data,Autor";
  const rows = oficios.map(o =>
    `"${o.numero || ""}","${o.assunto}","${o.destinatario}","${o.status}","${new Date(o.created_at).toLocaleDateString("pt-BR")}","${o.profiles?.full_name || ""}"`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "oficios_lista.csv");
}