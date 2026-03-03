import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

// ── Assets (importados como módulos para funcionar no build) ─────────────────
import logoCamaraImg from "@/assets/logo-camara-docx.jpeg";
import logoFabaoImg from "@/assets/logo-fabao-docx.png";
import assinaturaImg from "@/assets/assinatura-fabao-clean.png";

const TEMPLATES = [
  "/templates/modelo_oficio_assin_1.docx",
  "/templates/modelo_oficio_assin_2.docx",
  "/templates/modelo_oficio_assin_3.docx",
];

async function loadTemplate(): Promise<ArrayBuffer> {
  const idx = Math.floor(Math.random() * TEMPLATES.length);
  const resp = await fetch(TEMPLATES[idx]);
  if (!resp.ok) throw new Error("Falha ao carregar template do ofício");
  return resp.arrayBuffer();
}

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
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

// ── Build Word blob via Docxtemplater ────────────────────────────────────────
async function buildWordBlob(data: OficioData): Promise<Blob> {
  const {
    numero, destinatario, assunto, conteudo,
    bairro, cargoDestinatario, dataGeracao,
    operadorNome, operadorEmail, telefone,
  } = data;

  const templateBuffer = await loadTemplate();
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";

  const agora = new Date();
  const dataHora = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  const iniciais = operadorNome
    ? operadorNome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 3)
    : operadorEmail?.split('@')[0].slice(0, 6).toUpperCase() || 'SIS';
  const telSufixo = telefone ? telefone.replace(/\D/g, '').slice(-4) : '';
  const marcaDagua = `${iniciais}${telSufixo ? '-' + telSufixo : ''} • ${dataHora}`;

  doc.render({
    data: formatDate(dataGeracao),
    numero: numero || "___",
    destinatario: destinatarioCompleto,
    assunto: assunto || "___",
    bairro: bairroFormatado,
    texto: conteudo || "",
    marca_dagua: marcaDagua,
  });

  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
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

// ── Helper: load image as base64 data URL ───────────────────────────────────
async function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

// ── Export PDF (jsPDF nativo – texto real + imagens) ─────────────────────────
export async function exportToPDF(data: OficioData): Promise<void> {
  const ano = new Date().getFullYear().toString();
  const fileName = buildFileName(data.numero, ano, data.telefone);

  const hoje = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataFormatada = `Uberlândia, ${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}.`;

  const numeroFormatado = data.numero
    ? (data.numero.includes("/") ? data.numero : `${data.numero}/${hoje.getFullYear()}`)
    : "___";

  const bairroFormatado = data.bairro ? `Bairro ${data.bairro}` : "";
  let assuntoFormatado = data.assunto || "___";
  if (bairroFormatado) assuntoFormatado = `${data.assunto} – ${bairroFormatado}`;

  const paragraphs = data.conteudo
    .split("\n")
    .map(p => p.trim())
    .filter(Boolean)
    .filter(p => !p.match(/^Excelentíssimo\(a\)\s+Senhor\(a\)/i));

  // Load images
  const [logoCamaraData, logoFabaoData, assinaturaData] = await Promise.all([
    loadImageAsDataUrl(logoCamaraImg),
    loadImageAsDataUrl(logoFabaoImg),
    loadImageAsDataUrl(assinaturaImg),
  ]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const marginLeft = 30;
  const marginRight = 20;
  const marginTop = 25;
  const marginBottom = 25;
  const contentW = pageW - marginLeft - marginRight;
  let y = marginTop;

  const footerText = "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG";

  function addFooter() {
    pdf.setDrawColor(200);
    pdf.line(marginLeft, pageH - 18, pageW - marginRight, pageH - 18);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(100);
    pdf.text(footerText, pageW / 2, pageH - 14, { align: "center" });
    pdf.setTextColor(0);
  }

  function getImageDimensions(dataUrl: string): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
  }

  async function addHeaderAsync() {
    const targetH = 16; // mm
    const [dimCamara, dimFabao] = await Promise.all([
      getImageDimensions(logoCamaraData),
      getImageDimensions(logoFabaoData),
    ]);
    const wCamara = (dimCamara.w / dimCamara.h) * targetH;
    const wFabao = (dimFabao.w / dimFabao.h) * targetH;
    pdf.addImage(logoCamaraData, "PNG", marginLeft + 5, marginTop, wCamara, targetH);
    pdf.addImage(logoFabaoData, "PNG", pageW - marginRight - wFabao - 5, marginTop, wFabao, targetH);
    return marginTop + 20;
  }

  function checkPageBreak(needed: number): void {
    if (y + needed > pageH - marginBottom) {
      addFooter();
      pdf.addPage();
      y = marginTop;
    }
  }

  // ── Wrap text helper ──
  function wrapText(text: string, maxWidth: number): string[] {
    return pdf.splitTextToSize(text, maxWidth) as string[];
  }

  // ── PAGE 1: Header ──
  y = await addHeaderAsync();
  y += 5;

  // Data
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.text(dataFormatada, pageW - marginRight, y, { align: "right" });
  y += 12;

  // Número
  pdf.setFont("helvetica", "bold");
  pdf.text(`Ofício GVF n° ${numeroFormatado}`, marginLeft, y);
  y += 10;

  // Destinatário
  const destText = `DESTINATÁRIO: ${data.cargoDestinatario || "Ilmo(a). Sr(a)."} ${data.destinatario || "___"}`;
  const destLines = wrapText(destText, contentW);
  destLines.forEach(line => {
    checkPageBreak(6);
    pdf.text(line, marginLeft, y);
    y += 6;
  });
  y += 4;

  // Assunto
  const assuntoText = `Assunto: ${assuntoFormatado}`;
  const assuntoLines = wrapText(assuntoText, contentW);
  assuntoLines.forEach(line => {
    checkPageBreak(6);
    pdf.text(line, marginLeft, y);
    y += 6;
  });
  y += 10;

  // Saudação
  pdf.setFont("helvetica", "normal");
  checkPageBreak(8);
  pdf.text("Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,", marginLeft + 12, y);
  y += 12;

  // ── CORPO ──
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");

  for (const para of paragraphs) {
    const lines = wrapText(para, contentW - 12); // Account for indent
    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(6);
      const x = i === 0 ? marginLeft + 12 : marginLeft;
      pdf.text(lines[i], x, y);
      y += 6;
    }
    y += 3; // Spacing between paragraphs
  }

  // ── FECHAMENTO + ASSINATURA (manter juntos na mesma página) ──
  const closingBlockHeight = 8 + 6 + 10 + 10 + 30 + 4 + 5 + 5 + 20; // ~98mm total
  checkPageBreak(closingBlockHeight);

  y += 8;
  pdf.text("Atenciosamente,", marginLeft + 12, y);
  y += 10;

  // ── ASSINATURA ──
  y += 10;
  const sigW = 55;
  const sigH = 30;
  const sigX = (pageW - sigW) / 2;
  pdf.addImage(assinaturaData, "PNG", sigX, y, sigW, sigH);
  y += sigH - 1;

  // Linha
  const lineX = (pageW - 60) / 2;
  pdf.setDrawColor(0);
  pdf.line(lineX, y, lineX + 60, y);
  y += 4;

  // Nome e cargo
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("FABÃO", pageW / 2, y, { align: "center" });
  y += 5;
  pdf.setFont("helvetica", "normal");
  pdf.text("Vereador", pageW / 2, y, { align: "center" });

  // Footer on last page
  addFooter();

  pdf.save(`${fileName}.pdf`);
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
