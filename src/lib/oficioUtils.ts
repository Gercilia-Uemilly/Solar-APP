/**
 * Centralized utility functions for Ofício documents.
 * Used by: exportOficio.ts, printOficio.ts, OficioPreview.tsx, Oficios.tsx, MeusOficios.tsx
 */

/** Strip any "Ofício GVF n° " prefix already in the numero string */
export function cleanNumero(raw: string): string {
  return raw.replace(/^(Ofício GVF n°\s*)+/i, "").trim();
}

/** Build vocativo based on cargo/role */
export function buildVocativo(cargo?: string): string {
  if (!cargo) return "Excelentíssimo(a) Senhor(a) Secretário(a),";
  const lower = cargo.toLowerCase();
  if (lower.includes("diretor") || lower.includes("diretora")) return "Excelentíssimo(a) Senhor(a) Diretor(a),";
  if (lower.includes("reitor") || lower.includes("reitora")) return "Magnífico(a) Reitor(a),";
  return "Excelentíssimo(a) Senhor(a) Secretário(a),";
}

/** Format date in official document format */
export function formatDateOficio(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `Uberlândia, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}.`;
}

/** Extract only the bairro name from a full address string */
export function extrairBairro(endereco: string): string {
  if (!endereco) return "";
  
  // Try "Bairro XYZ" pattern first
  const matchBairro = endereco.match(/bairro\s+([A-Za-zÀ-ÿ\s]+?)(?:\s*[,\-–]|$)/i);
  if (matchBairro) return matchBairro[1].trim();
  
  // Try "- BairroName, Cidade" pattern (e.g. "Av. X, 123 - Santa Mônica, Uberlândia")
  const matchDash = endereco.match(/[-–]\s*([A-Za-zÀ-ÿ\s]+?)\s*[,\-–]/);
  if (matchDash) {
    const candidate = matchDash[1].trim();
    // Exclude city/state names
    if (!candidate.match(/^(Uberlândia|MG|Minas Gerais)$/i)) return candidate;
  }
  
  // Fallback: second-to-last comma-separated part
  const partes = endereco.split(",").map(p => p.trim());
  if (partes.length >= 3) {
    const candidate = partes[partes.length - 2].replace(/[-–].*/, "").trim();
    if (candidate && !candidate.match(/^(Uberlândia|MG|Minas Gerais|nº?\s*\d+)$/i)) return candidate;
  }
  
  return "";
}


export function generateOperatorCode(name: string, email?: string): string {
  const parts = (name || "").trim().split(/\s+/);
  const first = (parts[0] || "").toLowerCase();
  const lastInitial = parts.length > 1
    ? parts[parts.length - 1][0]?.toLowerCase() || ""
    : (email || "").split("@")[0]?.[0]?.toLowerCase() || "";
  return first ? `${first}.${lastInitial}` : email?.split("@")[0]?.toLowerCase() || "usr";
}

/** Common OficioRow interface used across pages */
export interface OficioRow {
  id: string;
  numero: string | null;
  assunto: string;
  destinatario: string;
  status: string;
  conteudo: string | null;
  resposta_cidadao: string | null;
  secretaria_identificada?: string | null;
  tipo_demanda?: string | null;
  urgencia?: string | null;
  author_id: string;
  created_at: string;
  updated_at?: string;
  solicitante?: string | null;
  bairro?: string | null;
  contato_solicitante?: string | null;
  operador_nome?: string | null;
  link_pdf_drive?: string | null;
  cargo_destinatario?: string | null;
  local_demanda?: string | null;
  data_geracao?: string | null;
  linha_telefonica?: string | null;
  ano?: number | null;
  marcador?: string | null;
  endereco_completo?: string | null;
  codigo_z?: string | null;
  origem?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_name?: string | null;
  last_edited_by?: string | null;
  last_edited_by_name?: string | null;
  last_edited_at?: string | null;
  uploaded_at?: string | null;
  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;
}
