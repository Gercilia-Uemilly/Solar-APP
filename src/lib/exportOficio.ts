import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, BorderStyle, Footer, Header, Tab, TabStopType, TabStopPosition } from "docx";
import { saveAs } from "file-saver";

// ── Assets ──────────────────────────────────────────────────────────────────
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaSrc from "@/assets/assinatura-fabao-clean.png";

const TEMPLATES = [
  "/templates/modelo_oficio_assin_1.docx",
  "/templates/modelo_oficio_assin_2.docx",
  "/templates/modelo_oficio_assin_3.docx",
];

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `Uberlândia, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
}

function buildFileName(numero: string, ano: string, telefone?: string): string {
  const numLimpo = numero.replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const telSufixo = telefone
    ? telefone.replace(/\D/g, '').slice(-4)
    : '';
  const parts = [`GVF-${numLimpo}`, ano];
  if (telSufixo) parts.push(telSufixo);
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

  // Fetch images
  const [logoCamaraBytes, logoFabaoBytes, assinaturaBytes] = await Promise.all([
    fetchImageBytes(logoCamaraSrc),
    fetchImageBytes(logoFabaoSrc),
    fetchImageBytes(assinaturaSrc),
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

  // Parse content paragraphs (same logic as preview)
  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

  const fontSize = 22; // 11pt in half-points (11 * 2)
  const fontName = "Arial";
  const lineSpacing = 360; // 1.5 lines (240 twips per line * 1.5)

  // Build marca d'água text
  const agora = new Date();
  const dataHora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const iniciais = operadorNome
    ? operadorNome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3)
    : operadorEmail?.split('@')[0].slice(0, 6).toUpperCase() || 'SIS';
  const telSufixo = telefone ? telefone.replace(/\D/g, '').slice(-4) : '';
  const marcaDagua = `${iniciais}${telSufixo ? '-' + telSufixo : ''} • ${dataHora}`;

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
              children: [
                new ImageRun({
                  data: logoCamaraBytes,
                  transformation: { width: 240, height: 70 },
                  type: "jpg",
                }),
                new TextRun({ text: "\t", font: fontName, size: fontSize }),
                new ImageRun({
                  data: logoFabaoBytes,
                  transformation: { width: 140, height: 70 },
                  type: "png",
                }),
              ],
              tabStops: [{
                type: TabStopType.RIGHT,
                position: TabStopPosition.MAX,
              }],
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
              border: {
                top: { style: BorderStyle.SINGLE, size: 1, space: 4, color: "CCCCCC" },
              },
              children: [new TextRun({
                text: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG",
                font: fontName,
                size: 16,
                color: "444444",
              })],
              spacing: { before: 0, after: 0 },
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                text: marcaDagua,
                font: fontName,
                size: 12,
                color: "CCCCCC",
              })],
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

        // ── Data ──
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
          children: [new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Destinatário ──
        new Paragraph({
          children: [new TextRun({ text: `DESTINATÁRIO: ${destinatarioCompleto}`, font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Assunto ──
        new Paragraph({
          children: [new TextRun({ text: `Assunto: ${assuntoFormatado}`, font: fontName, size: fontSize, bold: true })],
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

        // ── Parágrafos do corpo ──
        ...paragraphs.map(p => new Paragraph({
          indent: { firstLine: 709 },
          alignment: AlignmentType.JUSTIFIED,
          children: [new TextRun({ text: p, font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        })),

        // ── Linha em branco ──
        new Paragraph({
          children: [new TextRun({ text: "", font: fontName, size: fontSize })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Atenciosamente ──
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
          children: [new TextRun({ text: "                                                              ", font: fontName, size: 2 })],
          spacing: { before: 0, after: 0 },
        }),

        // ── Nome (abaixo da assinatura) ──
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "FABÃO", font: fontName, size: fontSize, bold: true })],
          spacing: { before: 0, after: 0, line: lineSpacing },
        }),

        // ── Cargo (abaixo do nome) ──
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

  // Se houver imagens, enviar para edge function para adicionar anexo
  if (data.imagens && data.imagens.length > 0) {
    blob = await addAnexoImages(blob, data.imagens);
  }

  const ano = new Date().getFullYear().toString();
  const fileName = buildFileName(data.numero, ano, data.telefone);
  saveAs(blob, `${fileName}.docx`);
  return blob;
}



// ── Export PDF (via Word→PDF conversion, with HTML fallback) ────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const ano = new Date().getFullYear().toString();
  const fileName = buildFileName(data.numero, ano, data.telefone);

  try {
    // 1. Generate the Word blob (same as Word export)
    let wordBlob = await buildWordBlob(data);

    // 2. If there are images, add them
    if (data.imagens && data.imagens.length > 0) {
      wordBlob = await addAnexoImages(wordBlob, data.imagens);
    }

    // 3. Convert Word to PDF via edge function
    const pdfBlob = await convertWordToPdf(wordBlob, `${fileName}.docx`);
    saveAs(pdfBlob, `${fileName}.pdf`);
  } catch (e) {
    console.warn("PDF conversion via server failed, opening print dialog for Save as PDF:", e);
    // Fallback: open HTML print view so user can "Save as PDF" from browser
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
  // 1. Generate Word blob
  let wordBlob = await buildWordBlob(data);

  // 2. Convert to PDF
  const pdfBlob = await convertWordToPdf(wordBlob, "oficio.docx");

  // 3. Open PDF in new tab for printing
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
