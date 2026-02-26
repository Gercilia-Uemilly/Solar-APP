import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

const TEMPLATE_URL = "/templates/modelo_oficio_OFICIAL_PRONTO.docx";

async function loadTemplate(): Promise<ArrayBuffer> {
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error("Falha ao carregar template do ofício");
  return resp.arrayBuffer();
}

function formatDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
}

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

  const templateBuffer = await loadTemplate();
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  const destinatarioCompleto = `${cargoDestinatario || "Ilmo(a). Sr(a)."} ${destinatario || "___"}`;

  // Monta assunto no formato: "Tipo – Logradouro, nº X –"
  let assuntoFormatado = assunto || "___";
  if (logradouro && numeroEnd) {
    assuntoFormatado = `${assunto} – ${logradouro}, nº ${numeroEnd} –`;
  } else if (logradouro) {
    assuntoFormatado = `${assunto} – ${logradouro} –`;
  }

  // Bairro como "Bairro X" na linha separada
  const bairroFormatado = bairro ? `Bairro ${bairro}` : "";

  doc.render({
    data: formatDate(dataGeracao),
    numero: numero || "___",
    destinatario: destinatarioCompleto,
    assunto: assuntoFormatado,
    bairro: bairroFormatado,
    texto: conteudo || "",
  });

  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

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
  const wordBlob = await buildWordBlob(data);
  const numero = data.numero || "rascunho";

  try {
    const formData = new FormData();
    formData.append("file", wordBlob, `Oficio_GVF_${numero}.docx`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const resp = await fetch(`${supabaseUrl}/functions/v1/convert-to-pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: formData,
    });

    if (resp.ok) {
      const pdfBlob = await resp.blob();
      saveAs(pdfBlob, `Oficio_GVF_${numero}.pdf`);
      return;
    }

    const errJson = await resp.json().catch(() => ({}));
    if (errJson.fallback) {
      // Serviço não configurado — fallback para download do Word
      saveAs(wordBlob, `Oficio_GVF_${numero}.docx`);
      alert(
        "O servidor de conversão PDF não está configurado.\n\n" +
        "O arquivo Word foi baixado. Abra-o e use 'Arquivo → Salvar como → PDF' para gerar o PDF."
      );
      return;
    }

    throw new Error(errJson.error || "Erro na conversão");
  } catch (e) {
    // Fallback final: baixa o Word e instrui o usuário
    saveAs(wordBlob, `Oficio_GVF_${numero}.docx`);
    alert(
      "Não foi possível gerar o PDF automaticamente.\n\n" +
      "O arquivo Word foi baixado. Abra-o e use 'Arquivo → Salvar como → PDF'."
    );
  }
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