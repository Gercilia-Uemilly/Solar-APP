import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  Header, Footer, AlignmentType, TabStopType, TabStopPosition,
  PageBreak, BorderStyle,
  convertMillimetersToTwip as mmToTwip,
} from "docx";
import { saveAs } from "file-saver";

// ── Assets ──────────────────────────────────────────────────────────────────
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaSrc from "@/assets/assinatura-fabao-clean.png";

// ── Types ───────────────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────────────
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

async function fetchImageBuffer(src: string): Promise<ArrayBuffer> {
  const resp = await fetch(src);
  return resp.arrayBuffer();
}

function buildMarcaDagua(operadorNome?: string, operadorEmail?: string, telefone?: string): string {
  const agora = new Date();
  const dataHora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const iniciais = operadorNome
    ? operadorNome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3)
    : operadorEmail?.split('@')[0].slice(0, 6).toUpperCase() || 'SIS';
  const telSufixo = telefone ? telefone.replace(/\D/g, '').slice(-4) : '';
  return `${iniciais}${telSufixo ? '-' + telSufixo : ''} • ${dataHora}`;
}

// ── Build Word Document ─────────────────────────────────────────────────────
async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
    operadorNome, operadorEmail, telefone,
  } = data;

  // Load images
  const [logoCamaraBuf, logoFabaoBuf, assinaturaBuf] = await Promise.all([
    fetchImageBuffer(logoCamaraSrc),
    fetchImageBuffer(logoFabaoSrc),
    fetchImageBuffer(assinaturaSrc),
  ]);

  const hoje = new Date();
  const numeroFormatado = numero
    ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
    : "___";

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;

  let assuntoFormatado = assunto || "___";
  if (bairro) assuntoFormatado += ` – Bairro ${bairro}`;

  const marcaDagua = buildMarcaDagua(operadorNome, operadorEmail, telefone);

  // Parse body paragraphs
  const bodyParagraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

  const FONT = "Arial";
  const FONT_SIZE = 22; // 11pt in half-points
  const INDENT = mmToTwip(12.5); // 1.25cm

  // Build body sections
  const bodyParas: Paragraph[] = bodyParagraphs.map(text =>
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: INDENT },
      spacing: { after: 120 },
      children: [new TextRun({ text, font: FONT, size: FONT_SIZE })],
    })
  );

  const FOOTER_TEXT = "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG";

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: mmToTwip(30),
            right: mmToTwip(20),
            bottom: mmToTwip(25),
            left: mmToTwip(30),
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
                  data: logoCamaraBuf,
                  transformation: { width: 180, height: 65 },
                  type: "jpg",
                }),
                new TextRun({ text: "\t", font: FONT }),
                new TextRun({ text: "\t", font: FONT }),
                new ImageRun({
                  data: logoFabaoBuf,
                  transformation: { width: 180, height: 65 },
                  type: "png",
                }),
              ],
              tabStops: [
                { type: TabStopType.CENTER, position: TabStopPosition.MAX / 2 },
                { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC", space: 4 },
              },
              children: [
                new TextRun({ text: FOOTER_TEXT, font: FONT, size: 16, color: "444444" }),
              ],
            }),
          ],
        }),
      },
      children: [
        // Date
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 300 },
          children: [new TextRun({ text: formatDate(dataGeracao), font: FONT, size: FONT_SIZE })],
        }),
        // Número
        new Paragraph({
          spacing: { after: 300 },
          children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: FONT, size: FONT_SIZE, bold: true })],
        }),
        // Destinatário
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: `DESTINATÁRIO: ${destinatarioCompleto}`, font: FONT, size: FONT_SIZE, bold: true })],
        }),
        // Assunto
        new Paragraph({
          spacing: { after: 400 },
          children: [new TextRun({ text: `Assunto: ${assuntoFormatado}`, font: FONT, size: FONT_SIZE, bold: true })],
        }),
        // Saudação
        new Paragraph({
          indent: { firstLine: INDENT },
          spacing: { after: 400 },
          children: [new TextRun({ text: "Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,", font: FONT, size: FONT_SIZE })],
        }),
        // Body
        ...bodyParas,
        // Fechamento
        new Paragraph({
          indent: { firstLine: INDENT },
          spacing: { before: 300, after: 400 },
          children: [new TextRun({ text: "Atenciosamente,", font: FONT, size: FONT_SIZE })],
        }),
        // Signature
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 500 },
          children: [
            new ImageRun({
              data: assinaturaBuf,
              transformation: { width: 250, height: 80 },
              type: "png",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000", space: 1 },
          },
          children: [],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FABÃO", font: FONT, size: FONT_SIZE, bold: true })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Vereador", font: FONT, size: FONT_SIZE })],
        }),
        // Marca d'água
        new Paragraph({
          spacing: { before: 200 },
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: marcaDagua, font: FONT, size: 12, color: "CCCCCC" })],
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

// ── Print via Word→PDF ──────────────────────────────────────────────────────
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
