import { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, ImageRun, BorderStyle, TabStopPosition, TabStopType } from "docx";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import oficioHeaderImg from "@/assets/oficio-header-oficial.png";

async function loadImageAsBuffer(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  return resp.arrayBuffer();
}

function formatDate(): string {
  const hoje = new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;
}

export async function exportToWord(data: {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  cargoDestinatario?: string;
  logoCamaraUrl?: string;
  logoFabaoUrl?: string;
  assinaturaUrl?: string;
}) {
  const { numero, destinatario, assunto, conteudo, cargoDestinatario } = data;
  const hoje = new Date();
  const ano = hoje.getFullYear().toString();
  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;

  // Load header image
  let headerImageBuffer: ArrayBuffer;
  try {
    headerImageBuffer = await loadImageAsBuffer(oficioHeaderImg);
  } catch {
    headerImageBuffer = new ArrayBuffer(0);
  }

  // Build body paragraphs from content
  const bodyParagraphs = conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .map(
      (text) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: 360, after: 120 },
          indent: { firstLine: 709 }, // 1.25cm
          children: [
            new TextRun({
              text,
              font: "Times New Roman",
              size: 24, // 12pt
            }),
          ],
        })
    );

  const children: Paragraph[] = [];

  // Header image
  if (headerImageBuffer.byteLength > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({
            data: headerImageBuffer,
            transformation: { width: 500, height: 100 },
            type: "png",
          }),
        ],
      })
    );
  }

  // Date - right aligned
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: formatDate(),
          font: "Times New Roman",
          size: 24,
        }),
      ],
    })
  );

  // Document number
  children.push(
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Ofício GVF n° ${numero || "___"}${!numero?.includes("/") ? `/${ano}` : ""}`,
          font: "Times New Roman",
          size: 24,
          bold: true,
        }),
      ],
    })
  );

  // Destinatário
  children.push(
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: `DESTINATÁRIO: ${destinatarioCompleto}`,
          font: "Times New Roman",
          size: 24,
          bold: true,
        }),
      ],
    })
  );

  // Assunto
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `ASSUNTO: ${assunto || "___"}`,
          font: "Times New Roman",
          size: 24,
          bold: true,
        }),
      ],
    })
  );

  // Body paragraphs
  children.push(...bodyParagraphs);

  // Signature block
  children.push(
    new Paragraph({ spacing: { before: 600 } }), // spacing
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({ text: "________________________________________", font: "Times New Roman", size: 24 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({ text: "FABÃO", font: "Times New Roman", size: 24 }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 },
      children: [
        new TextRun({ text: "Vereador", font: "Times New Roman", size: 24 }),
      ],
    })
  );

  // Footer
  const footerParagraph = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG",
        font: "Times New Roman",
        size: 16, // 8pt
        color: "333333",
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 567,   // ~1cm top (header handles rest)
              bottom: 567,
              left: 1701,  // 3cm
              right: 1134, // 2cm
            },
          },
        },
        footers: {
          default: new Footer({ children: [footerParagraph] }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Oficio_GVF_${numero || "rascunho"}.docx`);
}

export async function exportToPDF(element: HTMLElement, numero: string) {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const totalPages = Math.ceil(imgHeight / pageHeight);
  let heightLeft = imgHeight;
  let position = 0;

  for (let page = 1; page <= totalPages; page++) {
    if (page > 1) {
      pdf.addPage();
      position -= pageHeight;
    }
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    pdf.setFont("times", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(51, 51, 51);
    pdf.text(`Pág. ${page}`, pageWidth / 2, pageHeight - 5, { align: "center" });
    heightLeft -= pageHeight;
  }

  pdf.save(`Oficio_GVF_${numero || "rascunho"}.pdf`);
}

export function exportToCSV(oficios: Array<{ numero?: string; assunto: string; destinatario: string; status: string; created_at: string; profiles?: { full_name?: string } }>) {
  const header = "Número,Assunto,Destinatário,Status,Data,Autor";
  const rows = oficios.map(o =>
    `"${o.numero || ""}","${o.assunto}","${o.destinatario}","${o.status}","${new Date(o.created_at).toLocaleDateString("pt-BR")}","${o.profiles?.full_name || ""}"`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  saveAs(blob, "oficios_lista.csv");
}
