import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
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

// ── Export PDF (client-side via html2canvas + jsPDF) ─────────────────────────
// Renderiza o ofício em HTML oculto, captura com html2canvas e gera PDF A4.
// A assinatura fica na página 2.
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

  const bodyParagraphs = paragraphs
    .map(p => `<p style="text-indent:1.25cm;margin-bottom:10px;font-size:12pt;line-height:1.5">${p}</p>`)
    .join("");

  // Página única com todo o conteúdo
  const singlePageContent = `
    <div style="width:210mm;min-height:297mm;padding:30mm 20mm 20mm 30mm;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;color:#000;background:#fff;box-sizing:border-box;position:relative;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 20px;">
        <img src="${logoCamaraImg}" style="height:65px;width:auto;object-fit:contain" crossorigin="anonymous" />
        <img src="${logoFabaoImg}" style="height:65px;width:auto;object-fit:contain" crossorigin="anonymous" />
      </div>
      <p style="text-align:right;margin-bottom:24px;margin-top:10px">${dataFormatada}</p>
      <p style="font-weight:bold;font-size:12pt;margin-bottom:24px">Ofício GVF n° ${numeroFormatado}</p>
      <p style="font-weight:bold;font-size:12pt;margin-bottom:8px">DESTINATÁRIO: ${data.cargoDestinatario || "Ilmo(a). Sr(a)."} ${data.destinatario || "___"}</p>
      <p style="font-weight:bold;font-size:12pt;margin-bottom:30px">ASSUNTO: ${assuntoFormatado}</p>
      <p style="font-size:12pt;margin-bottom:30px;text-indent:1.25cm">Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,</p>
      ${bodyParagraphs}
      <p style="text-indent:1.25cm;margin-top:20px;margin-bottom:30px;font-size:12pt">Atenciosamente,</p>
      <div style="margin-top:40px;text-align:center;display:flex;flex-direction:column;align-items:center;">
        <img src="${assinaturaImg}" style="height:180px;width:auto;object-fit:contain;margin-bottom:-8px;display:block;max-width:80%;" crossorigin="anonymous" />
        <div style="width:300px;border-bottom:1px solid #000;margin-bottom:4px"></div>
        <p style="font-size:12pt;margin-bottom:0;font-weight:bold">FABÃO</p>
        <p style="font-size:12pt;margin-top:0">Vereador</p>
      </div>
      <div style="font-size:8pt;color:#444;text-align:center;border-top:1px solid #ccc;padding-top:6px;padding-bottom:6px;position:absolute;bottom:20mm;left:30mm;right:20mm;">
        Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG
      </div>
    </div>
  `;

  // Renderiza off-screen
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.innerHTML = singlePageContent;
  document.body.appendChild(container);

  // Espera imagens carregarem
  const images = container.querySelectorAll("img");
  await Promise.all(
    Array.from(images).map(
      img =>
        new Promise<void>(resolve => {
          if (img.complete) return resolve();
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );

  try {
    const pageDiv = container.querySelector<HTMLDivElement>(":scope > div")!;
    const canvas = await html2canvas(pageDiv, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: pageDiv.scrollWidth,
      height: pageDiv.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdfWidth = 210;
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeight = 297;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Se o conteúdo cabe em uma página
    if (pdfHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    } else {
      // Divide em múltiplas páginas
      let yOffset = 0;
      let page = 0;
      while (yOffset < pdfHeight) {
        if (page > 0) pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, -yOffset, pdfWidth, pdfHeight);
        yOffset += pageHeight;
        page++;
      }
    }

    pdf.save(`${fileName}.pdf`);
  } finally {
    document.body.removeChild(container);
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
