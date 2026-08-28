/**
 * Centralized utility functions for Ofício documents.
 * Used by: exportOficio.ts, printOficio.ts, OficioPreview.tsx, Oficios.tsx, MeusOficios.tsx
 */

// ═══════════════════════════════════════════════════════════
// MAPEAMENTO OFICIAL DE SECRETARIAS, DESTINATÁRIOS E VOCATIVOS
// ═══════════════════════════════════════════════════════════

export interface SecretariaConfig {
  destinatario: string;
  vocativo: string;
}

export const SECRETARIAS_CONFIG: Record<string, SecretariaConfig> = {
  // ═══ SECRETARIAS MUNICIPAIS ═══
  'Administração': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Administração',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Agronegócio': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Agronegócio',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Comunicação': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Comunicação',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Controladoria-Geral do Município': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Controladoria-Geral do Município',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Cultura e Turismo': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Cultura e Turismo',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Desenvolvimento Econômico e Inovação': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Desenvolvimento Econômico e Inovação',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Desenvolvimento Social': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Desenvolvimento Social',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Educação': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Educação',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Finanças': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Finanças',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Gestão Ambiental e Sustentabilidade': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Gestão Ambiental e Sustentabilidade',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Gestão Estratégica': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Gestão Estratégica',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Governo': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Governo',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Habitação': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Habitação',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Infraestrutura': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Infraestrutura',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Juventude': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Juventude',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Planejamento Urbano': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Planejamento Urbano',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Procuradoria-Geral do Município': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Procuradoria-Geral do Município',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Saúde': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Saúde',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Segurança Integrada': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Segurança Integrada',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Serviços Urbanos': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Serviços Urbanos',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },
  'Trânsito e Transportes (SETTRAN)': {
    destinatario: 'Ilmo(a). Sr(a). Secretário(a) Municipal de Trânsito e Transportes',
    vocativo: 'Excelentíssimo(a) Senhor(a) Secretário(a),'
  },

  // ═══ ÓRGÃOS PÚBLICOS ═══
  'ARESAN': {
    destinatario: 'Sr(a). Diretor(a) Presidente da Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia (ARESAN)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,'
  },
  'DMAE': {
    destinatario: 'Sr(a). Diretor(a) Geral do Departamento Municipal de Água e Esgoto (DMAE)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'
  },
  'FUTEL': {
    destinatario: 'Sr(a). Diretor(a) Geral da Fundação Uberlandense do Turismo (FUTEL)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'
  },
  'IPREMU': {
    destinatario: 'Sr(a). Diretor(a) Geral do Instituto de Previdência dos Servidores Públicos do Município de Uberlândia (IPREMU)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'
  },
  'EMAM': {
    destinatario: 'Sr(a). Diretor(a) Geral da Empresa Municipal de Apoio e Manutenção (EMAM)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,'
  },
  'FERUB': {
    destinatario: 'Sr(a). Diretor(a) da Fundação de Excelência Rural de Uberlândia (FERUB)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a),'
  },
  'PRODAUB': {
    destinatario: 'Sr(a). Diretor(a) da PRODAUB',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a),'
  },
  'DETRAN-MG': {
    destinatario: 'Sr(a). Diretor(a) do Departamento Estadual de Trânsito de Minas Gerais (DETRAN-MG)',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a),'
  },
  'PROCON': {
    destinatario: 'Sr(a). Superintendente do PROCON',
    vocativo: 'Excelentíssimo(a) Senhor(a) Superintendente,'
  },
  'HC/UFU': {
    destinatario: 'Diretor(a) e Superintendente do Hospital de Clínicas da Universidade Federal de Uberlândia (HC/UFU)',
    vocativo: 'Prezados(as) Senhores(as),'
  },
  'DER-MG': {
    destinatario: 'Sr(a). Coordenador(a) do Departamento de Estradas de Rodagem de Minas Gerais (DER-MG) – 11ª Unidade Regional – Uberlândia',
    vocativo: 'Prezados(a) Senhores(a) Coordenador(a),'
  },
  'DNIT': {
    destinatario: 'Sr(a). Chefe de Serviço do Departamento Nacional de Infraestrutura de Transportes (DNIT) – Unidade Local de Uberlândia',
    vocativo: 'Prezado(a) Senhor(a),'
  },
  'Conservatório Estadual de Música Cora Pavan Capparelli': {
    destinatario: 'Sr(a). Diretor(a) do Conservatório Estadual de Música Cora Pavan Capparelli',
    vocativo: 'Excelentíssimo(a) Senhor(a) Diretor(a),'
  },
  'Polícia Militar (PMMG)': {
    destinatario: 'Senhor(a) Comandante do Batalhão da Polícia Militar de Minas Gerais (PMMG)',
    vocativo: 'Senhor(a) Comandante,'
  },
  'Superintendência Regional de Saúde': {
    destinatario: 'Responsável legal da Superintendência Regional de Saúde',
    vocativo: 'Prezado(a) Senhor(a),'
  },
  'CEMIG': {
    destinatario: 'Responsável legal da CEMIG em Uberlândia',
    vocativo: 'Prezado(a) Senhor(a),'
  },
  'Superintendência Regional de Ensino': {
    destinatario: 'Senhor(a) Diretor(a) da Superintendência Regional de Ensino',
    vocativo: 'Senhor(a) Diretor(a),'
  },
  'Ministério Público de Minas Gerais': {
    destinatario: 'Exmo(a) Sr(a) Promotor(a) de Justiça do Ministério Público de Minas Gerais',
    vocativo: 'Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,'
  },
  // ═══ OUTROS ═══
  'Prefeitura Municipal (Gabinete do Prefeito)': {
    destinatario: 'Excelentíssimo Senhor Prefeito Municipal',
    vocativo: 'Excelentíssimo Senhor Prefeito,'
  },
  'Câmara Municipal de Uberlândia': {
    destinatario: 'Excelentíssimo(a) Senhor(a) Presidente da Câmara Municipal',
    vocativo: 'Excelentíssimo(a) Senhor(a) Vereador(a),'
  },
};

/** Ordered list of all secretaria keys for select dropdowns */
export const LISTA_SECRETARIAS = Object.keys(SECRETARIAS_CONFIG);

/** Get destinatario string for a secretaria key */
const normalizeSecretariaNome = (secretaria: string): string => {
  return secretaria
    .replace(/^Ilmo\(a\)\.\s*Sr\(a\)\.\s*/i, "")
    .replace(/^Secret[aá]rio\(a\)\s+Municipal\s+de\s+/i, "")
    .replace(/^Secretaria\s+Municipal\s+de\s+/i, "")
    .trim();
};

export const normalizarNomeOrgao = (nome: string): string => {
  return nome
    .replace(/Secretaria Municipal de\s+Secretaria Municipal de\s+/gi, "Secretaria Municipal de ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

export const normalizarConteudoOficio = (conteudo: string): string => {
  if (!conteudo) return conteudo;
  return conteudo.replace(
    /Secretaria Municipal de\s+Secretaria Municipal de\s+/gi,
    "Secretaria Municipal de ",
  );
};

/**
 * Mapeia nomes/órgãos completos retornados pela IA (ex: "Departamento Municipal de Água e Esgoto")
 * de volta para a chave canônica em SECRETARIAS_CONFIG (ex: "DMAE").
 */
const ORGAO_ALIAS_MAP: Record<string, string> = {
  'departamento municipal de água e esgoto': 'DMAE',
  'departamento municipal de agua e esgoto': 'DMAE',
  'dmae': 'DMAE',
  'agência de regulação dos serviços de saneamento básico de uberlândia': 'ARESAN',
  'aresan': 'ARESAN',
  'fundação uberlandense do turismo': 'FUTEL',
  'fundação uberlandense do turismo, esporte e lazer': 'FUTEL',
  'futel': 'FUTEL',
  'instituto de previdência dos servidores públicos do município de uberlândia': 'IPREMU',
  'ipremu': 'IPREMU',
  'empresa municipal de apoio e manutenção': 'EMAM',
  'emam': 'EMAM',
  'fundação de excelência rural de uberlândia': 'FERUB',
  'ferub': 'FERUB',
  'prodaub': 'PRODAUB',
  'processamento de dados de uberlândia': 'PRODAUB',
  'detran-mg': 'DETRAN-MG',
  'departamento estadual de trânsito de minas gerais': 'DETRAN-MG',
  'procon': 'PROCON',
  'procon municipal de uberlândia': 'PROCON',
  'hc/ufu': 'HC/UFU',
  'hospital de clínicas da universidade federal de uberlândia': 'HC/UFU',
  'der-mg': 'DER-MG',
  'departamento de estradas de rodagem de minas gerais': 'DER-MG',
  'dnit': 'DNIT',
  'departamento nacional de infraestrutura de transportes': 'DNIT',
  'pmmg': 'Polícia Militar (PMMG)',
  'polícia militar de minas gerais': 'Polícia Militar (PMMG)',
  'cemig': 'CEMIG',
  'companhia energética de minas gerais': 'CEMIG',
  'settran': 'Trânsito e Transportes (SETTRAN)',
  'secretaria municipal de trânsito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'trânsito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'servicos urbanos e transito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'servicos urbanos transito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'secretaria municipal de servicos urbanos e transito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'secretaria municipal de transito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'transito e transportes': 'Trânsito e Transportes (SETTRAN)',
  'secretaria municipal de meio ambiente e sustentabilidade': 'Gestão Ambiental e Sustentabilidade',
  'ministério público de minas gerais': 'Ministério Público de Minas Gerais',
  'superintendência regional de ensino': 'Superintendência Regional de Ensino',
  'superintendência regional de saúde': 'Superintendência Regional de Saúde',
  'conservatório estadual de música cora pavan capparelli': 'Conservatório Estadual de Música Cora Pavan Capparelli',
};

const resolveAliasKey = (s: string): string | null => {
  if (!s) return null;
  const key = s.toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return ORGAO_ALIAS_MAP[key] || null;
};

/** Remove acentos e normaliza espaços para comparação tolerante */
const slug = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // separa palavras coladas em camelCase/PascalCase (ex: "eTransportes" -> "e Transportes")
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9\/\- ]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Converte qualquer nome de órgão (vindo da IA, do n8n ou de um ofício antigo)
 * na chave canônica de SECRETARIAS_CONFIG, para que o Select de Secretaria
 * consiga exibir o valor automaticamente. Retorna "" quando não há match.
 */
export const resolverChaveSecretaria = (nome: string): string => {
  if (!nome) return '';
  if (SECRETARIAS_CONFIG[nome]) return nome;

  const normalized = normalizeSecretariaNome(nome);
  if (SECRETARIAS_CONFIG[normalized]) return normalized;

  const aliasKey = resolveAliasKey(nome) || resolveAliasKey(normalized);
  if (aliasKey && SECRETARIAS_CONFIG[aliasKey]) return aliasKey;

  const alvo = slug(normalized) || slug(nome);
  if (!alvo) return '';

  // Match sem acento contra as chaves conhecidas
  const exato = LISTA_SECRETARIAS.find((k) => slug(k) === alvo);
  if (exato) return exato;

  // Match sem acento contra o alias map
  const aliasHit = Object.keys(ORGAO_ALIAS_MAP).find((k) => slug(k) === alvo);
  if (aliasHit && SECRETARIAS_CONFIG[ORGAO_ALIAS_MAP[aliasHit]]) return ORGAO_ALIAS_MAP[aliasHit];

  // Match por conteúdo (ex.: "Secretaria de Serviços Urbanos de Uberlândia")
  const parcial = LISTA_SECRETARIAS.find((k) => {
    const ks = slug(k);
    return ks.length >= 4 && (alvo.includes(ks) || ks.includes(alvo));
  });
  return parcial || '';
};

export const getDestinatario = (secretaria: string): string => {
  const normalized = normalizeSecretariaNome(secretaria);
  if (SECRETARIAS_CONFIG[secretaria]) return SECRETARIAS_CONFIG[secretaria].destinatario;
  if (SECRETARIAS_CONFIG[normalized]) return SECRETARIAS_CONFIG[normalized].destinatario;
  const aliasKey = resolveAliasKey(secretaria) || resolveAliasKey(normalized);
  if (aliasKey && SECRETARIAS_CONFIG[aliasKey]) return SECRETARIAS_CONFIG[aliasKey].destinatario;
  return `Ilmo(a). Sr(a). Secretário(a) Municipal de ${normalized}`;
};

/** Get vocativo string for a secretaria key */
export const getVocativo = (secretaria: string): string => {
  if (SECRETARIAS_CONFIG[secretaria]) return SECRETARIAS_CONFIG[secretaria].vocativo;
  const normalized = normalizeSecretariaNome(secretaria);
  if (SECRETARIAS_CONFIG[normalized]) return SECRETARIAS_CONFIG[normalized].vocativo;
  const aliasKey = resolveAliasKey(secretaria) || resolveAliasKey(normalized);
  if (aliasKey && SECRETARIAS_CONFIG[aliasKey]) return SECRETARIAS_CONFIG[aliasKey].vocativo;
  return 'Excelentíssimo(a) Senhor(a) Secretário(a),';
};

/** Extract the organ name from a secretaria key (for AI conclusion text) */
export const getNomeOrgao = (secretaria: string): string => {
  const normalized = normalizeSecretariaNome(secretaria);
  const dest = SECRETARIAS_CONFIG[secretaria]?.destinatario || SECRETARIAS_CONFIG[normalized]?.destinatario || '';
  if (dest.includes('Municipal de ')) {
    return normalizarNomeOrgao('Secretaria Municipal de ' + dest.split('Municipal de ')[1]);
  }
  return normalizarNomeOrgao(normalized);
};

/**
 * Mapeamento completo vocativo → nome do órgão + artigo (do/da).
 * Usado para gerar o encerramento dinâmico do ofício.
 */
export const VOCATIVO_ORGAO_MAP: Record<string, { nomeOrgao: string; artigo: string }> = {
  'Excelentíssimo(a) Senhor(a) Secretário(a),': { nomeOrgao: '', artigo: 'a' },
  'Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,': { nomeOrgao: 'Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia (ARESAN)', artigo: 'a' },
  'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,': { nomeOrgao: '', artigo: 'o' },
  'Excelentíssimo(a) Senhor(a) Diretor(a),': { nomeOrgao: '', artigo: 'a' },
  'Senhor(a) Comandante,': { nomeOrgao: 'Batalhão da Polícia Militar de Minas Gerais (PMMG)', artigo: 'o' },
  'Prezado(a) Senhor(a),': { nomeOrgao: '', artigo: 'a' },
  'Prezados(as) Senhores(as),': { nomeOrgao: 'Hospital de Clínicas da Universidade Federal de Uberlândia (HC/UFU)', artigo: 'o' },
  'Prezados(a) Senhores(a) Coordenador(a),': { nomeOrgao: 'Departamento de Estradas de Rodagem de Minas Gerais (DER-MG)', artigo: 'o' },
  'Excelentíssimo(a) Senhor(a) Superintendente,': { nomeOrgao: 'PROCON', artigo: 'o' },
  'Senhor(a) Diretor(a),': { nomeOrgao: 'Superintendência Regional de Ensino', artigo: 'a' },
  'Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,': { nomeOrgao: 'Ministério Público de Minas Gerais', artigo: 'o' },
  'Excelentíssimo Senhor Prefeito,': { nomeOrgao: 'Prefeitura Municipal de Uberlândia', artigo: 'a' },
  'Excelentíssimo(a) Senhor(a) Vereador(a),': { nomeOrgao: 'Câmara Municipal de Uberlândia', artigo: 'a' },
  'Superintendência Regional de Saúde': { nomeOrgao: 'Superintendência Regional de Saúde', artigo: 'a' },
};

export function gerarEncerramentoDinamico(secretaria?: string, vocativo?: string): string {
  let nomeOrgao = '';
  let artigo = 'a';

  if (secretaria) {
    const config = SECRETARIAS_CONFIG[secretaria] || SECRETARIAS_CONFIG[normalizeSecretariaNome(secretaria)];
    if (config) {
      nomeOrgao = normalizarNomeOrgao(getNomeOrgao(secretaria));
      if (nomeOrgao.startsWith('Departamento') || nomeOrgao.startsWith('Instituto') || nomeOrgao.startsWith('PROCON') || nomeOrgao.startsWith('Ministério') || nomeOrgao.startsWith('Hospital') || nomeOrgao.startsWith('Batalhão')) {
        artigo = 'o';
      } else {
        artigo = 'a';
      }
    }
  }

  if (!nomeOrgao && vocativo) {
    const mapped = VOCATIVO_ORGAO_MAP[vocativo];
    if (mapped && mapped.nomeOrgao) {
      nomeOrgao = normalizarNomeOrgao(mapped.nomeOrgao);
      artigo = mapped.artigo;
    }
  }

  if (!nomeOrgao) {
    nomeOrgao = secretaria ? normalizarNomeOrgao(`Secretaria Municipal de ${normalizeSecretariaNome(secretaria)}`) : 'Secretaria';
    artigo = 'a';
  }

  return `Assim, encaminha-se o presente para apreciação d${artigo} ${nomeOrgao}, solicitando-se a análise do pleito e a manifestação quanto à sua viabilidade, bem como a indicação de eventual previsão para execução do serviço.`;
}

/** Lista de todos os vocativos únicos disponíveis no sistema */
export const LISTA_VOCATIVOS: string[] = Array.from(
  new Set(Object.values(SECRETARIAS_CONFIG).map(c => c.vocativo))
).sort();

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

/** Strip any "Ofício GVF n° " prefix already in the numero string */
export function cleanNumero(raw: string): string {
  return raw.replace(/^(Ofício GVF n°\s*)+/i, "").trim();
}

/** Build vocativo based on cargo/role — DEPRECATED: prefer getVocativo(secretaria) */
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
  editing_by?: string | null;
  editing_by_name?: string | null;
  editing_since?: string | null;
}
