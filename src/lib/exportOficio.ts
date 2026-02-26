import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, Footer, Header, PageNumber, NumberFormat,
  HeadingLevel, TabStopPosition, TabStopType,
  convertMillimetersToTwip, Table, TableRow, TableCell,
  WidthType, BorderStyle, VerticalAlign,
} from "docx";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import logoCamaraSrc from "@/assets/logo-camara-docx.jpeg";
import logoFabaoSrc from "@/assets/logo-fabao-docx.png";
import assinaturaFabaoSrc from "@/assets/assinatura-fabao.png";

// ── helpers ──────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `Uberlândia, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
}

async function fetchImageBuffer(src: string): Promise<ArrayBuffer> {
  const resp = await fetch(src);
  return resp.arrayBuffer();
}

// ── build Word blob ──────────────────────────────────────

async function buildWordBlob(data: {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  logradouro?: string;
  numeroEnd?: string;
  cargoDestinatario?: string;
  dataGeracao?: string;
}): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, logradouro, numeroEnd,
    cargoDestinatario, dataGeracao,
  } = data;

  // Fetch logo images in parallel
  const [logoCamaraBuf, logoFabaoBuf, assinaturaBuf] = await Promise.all([
    fetchImageBuffer(logoCamaraSrc),
    fetchImageBuffer(logoFabaoSrc),
    fetchImageBuffer(assinaturaFabaoSrc),
  ]);

  const hoje = new Date();
  const numeroFormatado = numero
    ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
    : "___";

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;

  let assuntoFormatado = assunto || "___";
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";

  // Monta a linha do ASSUNTO com logradouro e bairro integrados (como no modelo)
  if (logradouro && numeroEnd && bairroFormatado) {
    assuntoFormatado = `${assunto} – ${logradouro}, nº ${numeroEnd} – ${bairroFormatado}`;
  } else if (logradouro && bairroFormatado) {
    assuntoFormatado = `${assunto} – ${logradouro} – ${bairroFormatado}`;
  } else if (logradouro && numeroEnd) {
    assuntoFormatado = `${assunto} – ${logradouro}, nº ${numeroEnd}`;
  } else if (logradouro) {
    assuntoFormatado = `${assunto} – ${logradouro}`;
  } else if (bairroFormatado) {
    assuntoFormatado = `${assunto} – ${bairroFormatado}`;
  }

  // Parse body paragraphs - remove duplicate saudação if present
  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

  // Common text style
  const FONT = "Arial";
  const SIZE = 25; // half-points → 12.5pt
  const LINE_SPACING = 360; // 1.5 × 240 = 360
  const FIRST_LINE_INDENT = convertMillimetersToTwip(12.5); // 1.25cm

  // Build body paragraphs
  const bodyParagraphs = paragraphs.map(
    (text) =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { line: LINE_SPACING, after: 120 },
        indent: { firstLine: FIRST_LINE_INDENT },
        children: [
          new TextRun({ text, font: FONT, size: SIZE }),
        ],
      })
  );

  // Header with logos using a Table for reliable side-by-side layout
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  const headerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new ImageRun({
                    data: logoCamaraBuf,
                    transformation: { width: 250, height: 85 },
                    type: "jpg",
                  }),
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
                  new ImageRun({
                    data: logoFabaoBuf,
                    transformation: { width: 200, height: 85 },
                    type: "png",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(30),     // 3cm (ABNT)
              bottom: convertMillimetersToTwip(20),  // 2cm
              left: convertMillimetersToTwip(30),    // 3cm (ABNT)
              right: convertMillimetersToTwip(20),   // 2cm
            },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: SIZE, color: "000000" }),
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
                spacing: { before: 100 },
                border: { top: { style: "single" as any, size: 1, color: "CCCCCC", space: 4 } },
                children: [
                  new TextRun({
                    text: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG",
                    font: FONT,
                    size: 16,
                    color: "444444",
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Logos no topo do documento (compatível com Google Docs)
          headerTable,

          // Espaço após logos
          new Paragraph({ spacing: { after: 80 }, children: [] }),

          // Data - alinhada à direita
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 400, before: 100 },
            children: [
              new TextRun({ text: formatDate(dataGeracao), font: FONT, size: SIZE }),
            ],
          }),

          // Número do ofício
          new Paragraph({
            spacing: { after: 360 },
            children: [
              new TextRun({ text: `Ofício GVF n° ${numeroFormatado}`, font: FONT, size: SIZE, bold: true }),
            ],
          }),

          // Destinatário
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({ text: `DESTINATÁRIO: ${destinatarioCompleto}`, font: FONT, size: SIZE, bold: true }),
            ],
          }),

          // Assunto
          new Paragraph({
            spacing: { after: 480 },
            children: [
              new TextRun({ text: `ASSUNTO: ${assuntoFormatado}`, font: FONT, size: SIZE, bold: true }),
            ],
          }),

          // Saudação (com recuo de parágrafo)
          new Paragraph({
            spacing: { after: 480 },
            indent: { firstLine: FIRST_LINE_INDENT },
            children: [
              new TextRun({ text: `Excelentíssimo(a) Senhor(a) ${(cargoDestinatario || "Secretário(a)").replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "")},`, font: FONT, size: SIZE }),
            ],
          }),

          // Corpo do texto
          ...bodyParagraphs,

          // Atenciosamente (com recuo, alinhado à esquerda como parágrafo)
          new Paragraph({
            spacing: { before: 200, after: 0 },
            indent: { firstLine: FIRST_LINE_INDENT },
            children: [
              new TextRun({ text: "Atenciosamente,", font: FONT, size: SIZE }),
            ],
          }),

          // Imagem da assinatura (centralizada, acima da linha)
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [
              new ImageRun({
                data: assinaturaBuf,
                transformation: { width: 220, height: 80 },
                type: "png",
              }),
            ],
          }),

          // Linha de assinatura
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [
              new TextRun({ text: "___________________________________", font: FONT, size: SIZE }),
            ],
          }),

          // FABÃO
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 20 },
            children: [
              new TextRun({ text: "FABÃO", font: FONT, size: SIZE, bold: true }),
            ],
          }),

          // Vereador
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Vereador", font: FONT, size: SIZE }),
            ],
          }),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

// ── exports ──────────────────────────────────────────────

export async function exportToWord(data: {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  logradouro?: string;
  numeroEnd?: string;
  logoCamaraUrl?: string;
  logoFabaoUrl?: string;
  cargoDestinatario?: string;
  assinaturaUrl?: string;
  dataGeracao?: string;
}): Promise<Blob> {
  const blob = await buildWordBlob(data);
  saveAs(blob, `Oficio_GVF_${data.numero || "rascunho"}.docx`);
  return blob;
}

export async function exportToPDF(data: {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  bairro?: string;
  logradouro?: string;
  numeroEnd?: string;
  cargoDestinatario?: string;
  dataGeracao?: string;
}): Promise<void> {
  const { numero: num, destinatario, assunto, conteudo, bairro, logradouro, numeroEnd, cargoDestinatario, dataGeracao } = data;
  const numero = num || "rascunho";

  // Load images as base64
  const toBase64 = async (src: string): Promise<string> => {
    const resp = await fetch(src);
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const [logoCamaraB64, logoFabaoB64, assinaturaB64] = await Promise.all([
    toBase64(logoCamaraSrc),
    toBase64(logoFabaoSrc),
    toBase64(assinaturaFabaoSrc),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const marginL = 30;
  const marginR = 20;
  const marginT = 30;
  const contentW = pageW - marginL - marginR;
  const fontSize = 12;
  const lineHeight = fontSize * 0.45; // ~5.4mm per line
  const pageH = 297;
  const marginB = 20;
  const maxY = pageH - marginB - 15; // leave room for footer

  let y = marginT;

  const addPageIfNeeded = (needed: number) => {
    if (y + needed > maxY) {
      // Footer on current page
      addFooter(doc);
      doc.addPage();
      y = marginT;
      addPageNumber(doc);
    }
  };

  const addFooter = (d: jsPDF) => {
    d.setFontSize(8);
    d.setTextColor(100);
    d.setDrawColor(200);
    d.line(marginL, pageH - marginB - 2, pageW - marginR, pageH - marginB - 2);
    d.text("Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG", pageW / 2, pageH - marginB + 2, { align: "center" });
    d.setTextColor(0);
  };

  const addPageNumber = (d: jsPDF) => {
    d.setFontSize(fontSize);
    d.setTextColor(0);
    const pg = d.getNumberOfPages();
    d.text(String(pg), pageW - marginR, 15, { align: "right" });
  };

  // Page number on first page
  addPageNumber(doc);

  // Logos
  try { doc.addImage(logoCamaraB64, "JPEG", marginL, y, 45, 15); } catch {}
  try { doc.addImage(logoFabaoB64, "PNG", pageW - marginR - 38, y, 38, 15); } catch {}
  y += 20;

  // Date
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.text(formatDate(dataGeracao), pageW - marginR, y, { align: "right" });
  y += lineHeight * 2.5;

  // Numero
  const hoje = new Date();
  const numeroFormatado = numero !== "rascunho"
    ? (numero.includes("/") ? numero : `${numero}/${hoje.getFullYear()}`)
    : "___";
  doc.setFont("helvetica", "bold");
  doc.text(`Ofício GVF n° ${numeroFormatado}`, marginL, y);
  y += lineHeight * 2.5;

  // Destinatario
  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;
  doc.text(`DESTINATÁRIO: ${destinatarioCompleto}`, marginL, y);
  y += lineHeight * 1.2;

  // Assunto
  let assuntoFormatado = assunto || "___";
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";
  if (logradouro && numeroEnd && bairroFormatado) {
    assuntoFormatado = `${assunto} – ${logradouro}, nº ${numeroEnd} – ${bairroFormatado}`;
  } else if (logradouro && bairroFormatado) {
    assuntoFormatado = `${assunto} – ${logradouro} – ${bairroFormatado}`;
  } else if (bairroFormatado) {
    assuntoFormatado = `${assunto} – ${bairroFormatado}`;
  }
  const assuntoLines = doc.splitTextToSize(`ASSUNTO: ${assuntoFormatado}`, contentW);
  doc.text(assuntoLines, marginL, y);
  y += assuntoLines.length * lineHeight + lineHeight * 2;

  // Saudação
  doc.setFont("helvetica", "normal");
  const cargoSaudacao = (cargoDestinatario || "Secretário(a)").replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "");
  const saudacao = `Excelentíssimo(a) Senhor(a) ${cargoSaudacao},`;
  const indentMM = 12.5;
  doc.text(saudacao, marginL + indentMM, y);
  y += lineHeight * 2.5;

  // Body paragraphs
  const paragraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, contentW - indentMM);
    addPageIfNeeded(lines.length * lineHeight + 3);
    // First line indented
    if (lines.length > 0) {
      doc.text(lines[0], marginL + indentMM, y);
      y += lineHeight;
    }
    // Remaining lines justified left
    for (let i = 1; i < lines.length; i++) {
      addPageIfNeeded(lineHeight);
      doc.text(lines[i], marginL, y);
      y += lineHeight;
    }
    y += 2; // paragraph spacing
  }

  // Atenciosamente
  y += lineHeight;
  addPageIfNeeded(lineHeight * 8);
  doc.text("Atenciosamente,", marginL + indentMM, y);
  y += lineHeight * 4;

  // Signature image
  addPageIfNeeded(35);
  try {
    const sigW = 50;
    const sigH = 18;
    doc.addImage(assinaturaB64, "PNG", pageW / 2 - sigW / 2, y, sigW, sigH);
    y += sigH - 2;
  } catch {}

  // Signature line
  const lineW = 70;
  doc.line(pageW / 2 - lineW / 2, y, pageW / 2 + lineW / 2, y);
  y += 5;

  // Name
  doc.setFont("helvetica", "bold");
  doc.text("FABÃO", pageW / 2, y, { align: "center" });
  y += lineHeight;
  doc.setFont("helvetica", "normal");
  doc.text("Vereador", pageW / 2, y, { align: "center" });

  // Footer on last page
  addFooter(doc);

  doc.save(`Oficio_GVF_${numero}.pdf`);
}

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
