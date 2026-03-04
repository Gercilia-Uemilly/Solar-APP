import { saveAs } from "file-saver";
import {
  Document, Packer, Paragraph, TextRun, ImageRun, AlignmentType,
  Footer, BorderStyle,
  Table, TableRow, TableCell, WidthType, VerticalAlign,
  convertMillimetersToTwip, SectionType, PageBreak,
} from "docx";

import logoCamaraImport from "@/assets/logo-camara-docx.jpeg";
import logoFabaoImport from "@/assets/logo-fabao-docx.png";
import assinaturaImport from "@/assets/assinatura-fabao-clean.png";

async function fetchImageBuffer(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Falha ao carregar imagem: ${url}`);
  return resp.arrayBuffer();
}

// ── Dados ───────────────────────────────────────────────────────────────────
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

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `Uberlândia, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
}

function buildFileName(numero: string, ano: string, telefone?: string): string {
  const numLimpo = numero.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const telSufixo = telefone ? telefone.replace(/\D/g, '').slice(-4) : '';
  const parts = [`GVF-${numLimpo}`, ano];
  if (telSufixo) parts.push(telSufixo);
  return parts.join('-');
}

const FONT = "Arial";
const FONT_SIZE = 22; // half-points = 11pt
const RODAPE_TEXT = "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG";

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function buildHeaderTable(logoCamaraBuf: ArrayBuffer, logoFabaoBuf: ArrayBuffer): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                children: [
                  new ImageRun({ data: logoCamaraBuf, transformation: { width: 160, height: 65 }, type: "jpg" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new ImageRun({ data: logoFabaoBuf, transformation: { width: 160, height: 65 }, type: "png" }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function buildFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
        spacing: { before: 120 },
        children: [
          new TextRun({ text: RODAPE_TEXT, font: FONT, size: 16, color: "444444" }),
        ],
      }),
    ],
  });
}

// ── Build Word blob programaticamente ───────────────────────────────────────
async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
  } = data;

  const [logoCamaraBuf, logoFabaoBuf, assinaturaBuf] = await Promise.all([
    fetchImageBuffer(logoCamaraImport),
    fetchImageBuffer(logoFabaoImport),
    fetchImageBuffer(assinaturaImport),
  ]);

  const hoje = new Date();
  const dataFormatada = formatDate(dataGeracao);
  const numeroFormatado = numero
    ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
    : "___";

  // Assunto com bairro
  let assuntoFormatado = assunto || "___";
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";
  if (bairroFormatado) {
    assuntoFormatado = `${assunto} – ${bairroFormatado}`;
  }

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;

  // Parse body paragraphs
  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

  const footer = buildFooter();

  // ── PAGE 1: Ofício content ─────────────────────────────────────────────
  const page1Children: (Paragraph | Table)[] = [];

  // Header logos
  page1Children.push(buildHeaderTable(logoCamaraBuf, logoFabaoBuf));

  // Date (right-aligned)
  page1Children.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 200, after: 480 },
    children: [new TextRun({ text: dataFormatada, font: FONT, size: FONT_SIZE })],
  }));

  // Ofício number
  page1Children.push(new Paragraph({
    spacing: { after: 480 },
    children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: FONT, size: FONT_SIZE, bold: true })],
  }));

  // DESTINATÁRIO
  page1Children.push(new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text: `DESTINATÁRIO: ${destinatarioCompleto}`, font: FONT, size: FONT_SIZE, bold: true })],
  }));

  // ASSUNTO
  page1Children.push(new Paragraph({
    spacing: { after: 600 },
    children: [new TextRun({ text: `ASSUNTO: ${assuntoFormatado}`, font: FONT, size: FONT_SIZE, bold: true })],
  }));

  // Saudação
  page1Children.push(new Paragraph({
    indent: { firstLine: convertMillimetersToTwip(12.5) },
    spacing: { after: 600 },
    children: [new TextRun({ text: "Excelentíssimo(a) Senhor(a) Secretário(a),", font: FONT, size: FONT_SIZE })],
  }));

  // Body paragraphs
  for (const p of paragraphs) {
    page1Children.push(new Paragraph({
      indent: { firstLine: convertMillimetersToTwip(12.5) },
      spacing: { after: 200 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text: p, font: FONT, size: FONT_SIZE })],
    }));
  }

  // Atenciosamente
  page1Children.push(new Paragraph({
    indent: { firstLine: convertMillimetersToTwip(12.5) },
    spacing: { before: 600, after: 200 },
    children: [new TextRun({ text: "Atenciosamente,", font: FONT, size: FONT_SIZE })],
  }));

  // ── PAGE 2: Signature page ────────────────────────────────────────────
  const page2Children: (Paragraph | Table)[] = [];

  // Header logos (repeated)
  page2Children.push(buildHeaderTable(logoCamaraBuf, logoFabaoBuf));

  // Spacer
  page2Children.push(new Paragraph({ spacing: { before: 2400 }, children: [] }));

  // Assinatura image (centered)
  page2Children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new ImageRun({
        data: assinaturaBuf,
        transformation: { width: 250, height: 100 },
        type: "png",
      }),
    ],
  }));

  // Line under signature
  page2Children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [new TextRun({ text: "___________________________________", font: FONT, size: FONT_SIZE })],
  }));

  // FABÃO
  page2Children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "FABÃO", font: FONT, size: FONT_SIZE, bold: true })],
  }));

  // Vereador
  page2Children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: "Vereador", font: FONT, size: FONT_SIZE })],
  }));

  const pageMargins = {
    top: convertMillimetersToTwip(30),
    right: convertMillimetersToTwip(20),
    bottom: convertMillimetersToTwip(20),
    left: convertMillimetersToTwip(30),
  };

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: pageMargins } },
        children: page1Children,
        footers: { default: footer },
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { margin: pageMargins },
        },
        children: page2Children,
        footers: { default: footer },
      },
    ],
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
  const fileName = buildFileName(data.numero, ano, data.telefone);
  saveAs(blob, `${fileName}.docx`);
  return blob;
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

// ── Export PDF ───────────────────────────────────────────────────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const ano = new Date().getFullYear().toString();
  const fileName = buildFileName(data.numero, ano, data.telefone);

  let wordBlob = await buildWordBlob(data);

  if (data.imagens && data.imagens.length > 0) {
    wordBlob = await addAnexoImages(wordBlob, data.imagens);
  }

  const pdfBlob = await convertWordToPdf(wordBlob, `${fileName}.docx`);
  saveAs(pdfBlob, `${fileName}.pdf`);
}

// ── Print via Word→PDF (iframe to avoid popup blockers) ─────────────────────
export async function printOficioViaPdf(data: OficioData): Promise<void> {
  let wordBlob = await buildWordBlob(data);
  const pdfBlob = await convertWordToPdf(wordBlob, "oficio.docx");
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.src = pdfUrl;
  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.print();
    } catch {
      saveAs(pdfBlob, "oficio.pdf");
    }
    setTimeout(() => {
      document.body.removeChild(iframe);
      URL.revokeObjectURL(pdfUrl);
    }, 60000);
  };
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
