import { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Footer, Header, PageNumber, NumberFormat } from "docx";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

async function loadImage(src: string): Promise<ArrayBuffer> {
  const resp = await fetch(src);
  return resp.arrayBuffer();
}

// Convert cm to twips (1 cm = 567 twips)
const cmToTwips = (cm: number) => Math.round(cm * 567);

export async function exportToWord(data: {
  numero: string;
  destinatario: string;
  assunto: string;
  conteudo: string;
  logoCamaraUrl: string;
  logoFabaoUrl: string;
  cargoDestinatario?: string;
}) {
  const { numero, destinatario, assunto, conteudo, logoCamaraUrl, logoFabaoUrl, cargoDestinatario } = data;
  const hoje = new Date();
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  let logoCamara: ArrayBuffer, logoFabao: ArrayBuffer;
  try {
    [logoCamara, logoFabao] = await Promise.all([loadImage(logoCamaraUrl), loadImage(logoFabaoUrl)]);
  } catch {
    logoCamara = new ArrayBuffer(0);
    logoFabao = new ArrayBuffer(0);
  }

  const paragraphs = conteudo.split("\n").map(p => p.trim()).filter(Boolean);
  const children: Paragraph[] = [];

  // Date - right aligned
  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
      children: [new TextRun({ text: dataFormatada, font: "Times New Roman", size: 24 })],
    })
  );

  // Number - left aligned, bold
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [new TextRun({ text: `Ofício GVF n° ${numero || "___"}/2026`, bold: true, font: "Times New Roman", size: 24 })],
    })
  );

  // Destinatário
  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: "DESTINATÁRIO: ", bold: true, font: "Times New Roman", size: 24 }),
        new TextRun({ text: `${cargoDestinatario || "Ilmo. Sr."} ${destinatario || "___"}`, bold: true, font: "Times New Roman", size: 24 }),
      ],
    })
  );

  // Assunto
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({ text: "ASSUNTO: ", bold: true, font: "Times New Roman", size: 24 }),
        new TextRun({ text: assunto || "___", bold: true, font: "Times New Roman", size: 24 }),
      ],
    })
  );

  // Greeting
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: "Excelentíssimo Senhor Secretário,", font: "Times New Roman", size: 24 })],
    })
  );

  // Body paragraphs - justified, first-line indent, line spacing 1.5 (360 twips)
  paragraphs.forEach(p => {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 709 },
        spacing: { after: 200, line: 360 },
        children: [new TextRun({ text: p, font: "Times New Roman", size: 24 })],
      })
    );
  });

  // Closing
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: 709 },
      spacing: { before: 300, after: 200 },
      children: [new TextRun({ text: "Na certeza de contar com o vosso pronto atendimento, desde já agradeço.", font: "Times New Roman", size: 24 })],
    })
  );

  // Atenciosamente
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 600 },
      children: [new TextRun({ text: "Atenciosamente,", font: "Times New Roman", size: 24 })],
    })
  );

  // Digital signature text block
  const sigDate = `${new Date().toISOString().split("T")[0].replace(/-/g, ".")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({ text: "FABIO DIAS QUEIROZ ZAVITOSKI:27500005806", font: "Courier New", size: 18 }),
      ],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `Assinado de forma digital por FABIO DIAS QUEIROZ ZAVITOSKI:27500005806 — Dados: ${sigDate} -03'00'`, font: "Courier New", size: 14, color: "666666" }),
      ],
    })
  );
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: "FABÃO", bold: true, font: "Times New Roman", size: 24 })] })
  );
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Vereador", font: "Times New Roman", size: 24 })] })
  );

  // Build header with logos (repeats on every page)
  const headerChildren: Paragraph[] = [];
  if (logoCamara.byteLength > 0 && logoFabao.byteLength > 0) {
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new ImageRun({ data: logoCamara, transformation: { width: 160, height: 80 }, type: "png" }),
          new TextRun("          "),
          new ImageRun({ data: logoFabao, transformation: { width: 140, height: 72 }, type: "png" }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: cmToTwips(3),
              bottom: cmToTwips(2),
              left: cmToTwips(3),
              right: cmToTwips(2),
            },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({ children: headerChildren }),
        },
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 100 },
                children: [
                  new TextRun({
                    text: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG",
                    font: "Times New Roman",
                    size: 16,
                    color: "333333",
                    italics: true,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 50 },
                children: [
                  new TextRun({ text: "Pág. ", font: "Times New Roman", size: 16, color: "333333" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", size: 16, color: "333333" }),
                ],
              }),
            ],
          }),
        },
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

  let heightLeft = imgHeight;
  let position = 0;
  let pageNum = 1;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);

  const totalPages = Math.ceil(imgHeight / pageHeight);
  if (totalPages > 1) {
    pdf.setFontSize(8);
    pdf.setTextColor(51, 51, 51);
    pdf.text(`Pág. ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pageNum++;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    if (totalPages > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(51, 51, 51);
      pdf.text(`Pág. ${pageNum}`, pageWidth / 2, pageHeight - 8, { align: "center" });
    }
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
