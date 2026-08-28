/**
 * Normalização e identificação de bairros de Uberlândia.
 *
 * Muitos ofícios chegam com o campo `bairro` preenchido com endereço
 * ("Rua Rio Grande do Norte, nº 105") ou vazio. Este módulo tenta descobrir
 * o bairro real cruzando `bairro`, `endereco_completo`, `local_demanda`,
 * `assunto` e `conteudo` contra o dicionário oficial de bairros.
 */

export const BAIRROS_UBERLANDIA: string[] = [
  "Alto Umuarama", "Alvorada", "Aclimação", "Alto Independência", "Aparecida",
  "Bom Jesus", "Bosque dos Buritis", "Brasil", "Buritis", "Canaã",
  "Carajás", "Cazeca", "Centro", "Chácaras Tubalina", "Cidade Jardim",
  "Copacabana", "Custódio Pereira", "Daniel Fonseca", "Distrito Industrial",
  "Dom Almir", "Dona Zulmira", "Fundinho", "Gávea", "Granada", "Granja Marileusa",
  "Gran Ville", "Grand Ville", "Guarani", "Jaraguá", "Jardim Botânico",
  "Jardim Brasília", "Jardim Canaã", "Jardim Holanda", "Jardim Inconfidência",
  "Jardim Ipanema", "Jardim das Palmeiras", "Jardim Patrícia", "Jardim Sul",
  "Joana Darc", "Kennedy", "Laranjeiras", "Liberdade", "Lídice", "Loanda",
  "Luizote de Freitas", "Maravilha", "Mansões Aeroporto", "Mansour",
  "Marta Helena", "Martins", "Minas Gerais", "Mirante", "Monte Hebron",
  "Morada da Colina", "Morada do Sol", "Morada Nova", "Morumbi", "Nossa Senhora Aparecida",
  "Nova Uberlândia", "Novo Mundo", "Osvaldo Rezende", "Panorama", "Pacaembu",
  "Panorama Parque", "Patrimônio", "Pampulha", "Pequis", "Planalto",
  "Portal do Vale", "Presidente Roosevelt", "Prosperidade", "Res. Integração",
  "Residencial Integração", "Roosevelt", "Saraiva", "Santa Luzia", "Santa Mônica",
  "Santa Rosa", "Santa Maria", "São Jorge", "São Gabriel", "São Vicente de Paulo",
  "Segismundo Pereira", "Seringueiras", "Shopping Park", "Segismundo",
  "Taiaman", "Tabajaras", "Tibery", "Tocantins", "Tubalina", "Umuarama",
  "Vigilato Pereira", "Vila Marielza", "Zona Leste", "Glória", "Nova Gávea",
  "Alto Novo Mundo", "Chácaras Panorama", "Cidade Verde", "Élisson Prieto",
  "Integração", "Jardim Europa", "Jardim América", "Nossa Senhora das Graças",
  "Novo Umuarama", "Parque do Sabiá", "Sucupira", "Tapuirama", "Cruzeiro dos Peixotos",
  "Martinésia", "Miraporanga",
];

/** Grafias erradas / variações → bairro canônico */
const ALIASES: Record<string, string> = {
  "masour": "Mansour",
  "mansour iii": "Mansour",
  "mansour ii": "Mansour",
  "canaa": "Canaã",
  "cana": "Canaã",
  "luizote": "Luizote de Freitas",
  "luizote iii": "Luizote de Freitas",
  "luizote iv": "Luizote de Freitas",
  "parque municipal luizote de freitas": "Luizote de Freitas",
  "taiamam": "Taiaman",
  "industrial - taiaman": "Taiaman",
  "osvaldo resende": "Osvaldo Rezende",
  "shopping park": "Shopping Park",
  "zona leste": "Zona Leste",
  "roosevelt": "Presidente Roosevelt",
  "res. integracao": "Residencial Integração",
  "res integracao": "Residencial Integração",
  "integracao": "Residencial Integração",
  "gran ville": "Granville",
  "grand ville": "Granville",
  "granville": "Granville",
  "sao jorge": "São Jorge",
  "gloria": "Glória",
  "jardim gloria": "Glória",
  "terminal novo mundo": "Novo Mundo",
  "terminal santa luzia": "Santa Luzia",
  "alto umuarama": "Alto Umuarama",
};

export const BAIRRO_NAO_IDENTIFICADO = "Não identificado";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Índice: forma normalizada → nome canônico (ordenado do mais longo para o mais curto) */
const INDEX: { key: string; canonical: string }[] = (() => {
  const map = new Map<string, string>();
  for (const b of BAIRROS_UBERLANDIA) map.set(norm(b), b);
  for (const [alias, canonical] of Object.entries(ALIASES)) map.set(norm(alias), canonical);
  return Array.from(map.entries())
    .map(([key, canonical]) => ({ key, canonical }))
    .sort((a, b) => b.key.length - a.key.length);
})();

const PREFIXO_LOGRADOURO =
  /^(rua|r\.|av|av\.|avenida|praca|praça|alameda|al\.|travessa|rodovia|rod\.|br[- ]?\d|mgc|anel|viaduto|trevo|via|estrada|passarela|rotatoria|rotatória|terminal|condominio|condomínio)\b/i;

/** Um valor de bairro que na verdade é um endereço/logradouro? */
export function pareceLogradouro(valor: string): boolean {
  const v = valor.trim();
  if (!v) return false;
  if (PREFIXO_LOGRADOURO.test(v)) return true;
  // "Fulano de Tal, 123" ou termina com número de casa
  if (/,\s*n?º?\s*\d+/i.test(v) || /\s\d{2,5}$/.test(v)) return true;
  return false;
}

export interface OficioBairroFonte {
  bairro?: string | null;
  endereco_completo?: string | null;
  local_demanda?: string | null;
  assunto?: string | null;
  conteudo?: string | null;
}

/**
 * Descobre o bairro real de um ofício.
 * Ordem: campo bairro limpo → busca do dicionário dentro de bairro/endereço/local/assunto.
 */
export function resolverBairro(o: OficioBairroFonte): string {
  const bruto = (o.bairro || "").trim();

  if (bruto && !pareceLogradouro(bruto)) {
    const direto = INDEX.find((i) => i.key === norm(bruto.replace(/^bairro\s+/i, "")));
    if (direto) return direto.canonical;
  }

  const textos = [bruto, o.endereco_completo, o.local_demanda, o.assunto, o.conteudo]
    .filter(Boolean)
    .join(" | ");
  if (textos.trim()) {
    const alvo = ` ${norm(textos)} `;
    for (const { key, canonical } of INDEX) {
      if (key.length < 4) continue;
      const re = new RegExp(`(^|[^a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(alvo)) return canonical;
    }
  }

  // Nome curto não reconhecido, mas que não é logradouro: aceita como bairro informado
  if (bruto && !pareceLogradouro(bruto) && bruto.length <= 35 && !/^(teste|x|\d+)$/i.test(bruto)) {
    return bruto.replace(/^bairro\s+/i, "").trim();
  }

  return BAIRRO_NAO_IDENTIFICADO;
}

/** Ranking de bairros a partir de uma lista de ofícios */
export function rankearBairros<T extends OficioBairroFonte>(
  oficios: T[]
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const o of oficios) {
    const b = resolverBairro(o);
    map.set(b, (map.get(b) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
