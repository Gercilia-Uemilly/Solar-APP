import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

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
  const telSufixo = telefone ? telefone.replace(/\D/g, '').slice(-4) : '';
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

  // Debug: find all template tags
  const xmlContent = zip.file("word/document.xml")?.asText() || "";
  // Debug: check raw XML for tag fragments
  const rawXml = xmlContent.slice(0, 3000);
  console.log("[exportOficio] XML snippet (first 3000):", rawXml);
  
  // Check for fragmented tags
  const hasCurly = xmlContent.includes("{") || xmlContent.includes("}");
  console.log("[exportOficio] Has curly braces in XML:", hasCurly);
  console.log("[exportOficio] Has 'texto' in XML:", xmlContent.includes("texto"));
  console.log("[exportOficio] Has 'numero' in XML:", xmlContent.includes("numero"));
  console.log("[exportOficio] Has 'assunto' in XML:", xmlContent.includes("assunto"));

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

  const renderData = {
    data: formatDate(dataGeracao),
    numero: numero || "___",
    destinatario: destinatarioCompleto,
    assunto: assunto || "___",
    bairro: bairroFormatado,
    texto: conteudo || "",
    marca_dagua: marcaDagua,
  };

  console.log("[exportOficio] render data:", JSON.stringify(renderData).slice(0, 500));
  console.log("[exportOficio] conteudo length:", conteudo?.length, "first 200 chars:", conteudo?.slice(0, 200));

  doc.render(renderData);

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

// ── Export PDF (via Word→PDF conversion for identical output) ────────────────
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

// ── Print via Word→PDF conversion (iframe to avoid popup blockers) ───────────
export async function printOficioViaPdf(data: OficioData): Promise<void> {
  let wordBlob = await buildWordBlob(data);
  const pdfBlob = await convertWordToPdf(wordBlob, "oficio.docx");
  const pdfUrl = URL.createObjectURL(pdfBlob);

  // Use hidden iframe to avoid ERR_BLOCKED_BY_CLIENT from popup blockers
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
      // Fallback: download the PDF directly
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
