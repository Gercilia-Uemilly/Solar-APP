// Mapeamento ZAP/REQ → telefone (Planilha do Gabinete).
// Mantenha em sincronia com src/data/zapReqContatos.ts.
export interface ContatoPlanilha {
  origem: "Zap" | "Requerimento" | "Conecta Jovem" | "Empregador" | "Agenda" | "Relações Políticas" | "DI";
  codigo: string; // "1".."10" ou identificador
  nome: string;
  telefone: string; // formato livre — normalizar antes de comparar
}

export const CONTATOS_ZAP_REQ: ContatoPlanilha[] = [
  { origem: "Zap", codigo: "1", nome: "Monyê",     telefone: "(34) 98418-5325" },
  { origem: "Zap", codigo: "2", nome: "Joana",     telefone: "(34) 98435-6242" },
  { origem: "Zap", codigo: "3", nome: "Monyê",     telefone: "(34) 98431-5324" },
  { origem: "Zap", codigo: "4", nome: "Joana",     telefone: "(34) 98431-1657" },
  { origem: "Zap", codigo: "5", nome: "Monyê",     telefone: "(34) 98439-5505" },
  { origem: "Zap", codigo: "6", nome: "Joana",     telefone: "(34) 98430-0587" },
  { origem: "Zap", codigo: "7", nome: "Gercilia",  telefone: "(34) 98425-7665" },
  { origem: "Conecta Jovem", codigo: "1", nome: "João",      telefone: "(34) 99102-7957" },
  { origem: "Empregador",    codigo: "1", nome: "Georgeane", telefone: "(34) 98406-0364" },
  { origem: "Agenda",        codigo: "1", nome: "Gabriela",  telefone: "(34) 98427-3897" },
  { origem: "Relações Políticas", codigo: "1", nome: "Diego", telefone: "(34) 98441-9523" },
  { origem: "Requerimento", codigo: "1", nome: "Marielle", telefone: "(34) 98401-8068" },
  { origem: "Requerimento", codigo: "2", nome: "Kellen",   telefone: "(34) 98440-0624" },
  { origem: "Requerimento", codigo: "3", nome: "Águeda",   telefone: "(34) 98423-7647" },
  { origem: "Requerimento", codigo: "4", nome: "Maria",    telefone: "(34) 97400-8012" },
  { origem: "Requerimento", codigo: "5", nome: "Kellen",   telefone: "(34) 99974-5336" },
  { origem: "Requerimento", codigo: "6", nome: "Daiane",   telefone: "(34) 98832-5694" },
  { origem: "Requerimento", codigo: "7", nome: "Águeda",   telefone: "(34) 99725-3482" },
  { origem: "Requerimento", codigo: "8", nome: "Maria",    telefone: "(34) 98433-2617" },
];

export function normalizePhoneBR(raw: string | null | undefined): string {
  if (!raw) return "";
  let d = raw.replace(/\D/g, "");
  if (!d) return "";
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return d.length >= 12 ? d : "";
}

export function buscarContatoPorOrigemCodigo(origem: string | null | undefined, codigo: string | null | undefined): ContatoPlanilha | null {
  if (!origem || !codigo) return null;
  const origemNormalizada = String(origem).trim().toLowerCase();
  const c = String(codigo).replace(/\D/g, "");
  return CONTATOS_ZAP_REQ.find((x) => x.origem.toLowerCase() === origemNormalizada && x.codigo === c) || null;
}

export function buscarContatoPorTelefone(telefone: string | null | undefined): ContatoPlanilha | null {
  const alvo = normalizePhoneBR(telefone);
  if (!alvo) return null;
  return CONTATOS_ZAP_REQ.find((x) => normalizePhoneBR(x.telefone) === alvo) || null;
}

export function buscarTelefonePorOrigemCodigo(origem: string | null | undefined, codigo: string | null | undefined): string | null {
  const found = buscarContatoPorOrigemCodigo(origem, codigo);
  return found ? normalizePhoneBR(found.telefone) : null;
}