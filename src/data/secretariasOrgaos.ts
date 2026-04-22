/**
 * Relação oficial das Secretarias Municipais e Órgãos Públicos
 * com os respectivos pronomes de tratamento (destinatário) e vocativos.
 * Fonte: documento institucional do Gabinete (SECRETARIAS_2.docx).
 * Use para conferir os ofícios gerados pelo sistema.
 */
export interface OrgaoReferencia {
  nome: string;
  sigla?: string;
  destinatario: string;
  vocativo: string;
  categoria: "Secretaria Municipal" | "Órgão Público";
}

const SECRETARIAS_NOMES = [
  "Administração",
  "Agronegócio",
  "Comunicação",
  "Controladoria-Geral do Município",
  "Cultura e Turismo",
  "Desenvolvimento Econômico e Inovação",
  "Desenvolvimento Social",
  "Educação",
  "Finanças",
  "Gestão Ambiental e Sustentabilidade",
  "Gestão Estratégica",
  "Governo",
  "Habitação",
  "Infraestrutura",
  "Juventude",
  "Planejamento Urbano",
  "Procuradoria-Geral do Município",
  "Saúde",
  "Segurança Integrada",
  "Serviços Urbanos",
  "Trânsito e Transportes",
];

const SECRETARIAS: OrgaoReferencia[] = SECRETARIAS_NOMES.map((nome) => ({
  nome: `Secretaria Municipal de ${nome}`,
  destinatario: `Ilmo(a). Sr(a). Secretário(a) Municipal de ${nome}`,
  vocativo: "Excelentíssimo(a) Senhor(a) Secretário(a),",
  categoria: "Secretaria Municipal",
}));

const ORGAOS: OrgaoReferencia[] = [
  {
    nome: "Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia",
    sigla: "ARESAN",
    destinatario: "Sr(a). Diretor(a) Presidente da ARESAN",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,",
    categoria: "Órgão Público",
  },
  {
    nome: "Departamento Municipal de Água e Esgoto",
    sigla: "DMAE",
    destinatario: "Sr(a). Diretor(a) Geral do DMAE",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,",
    categoria: "Órgão Público",
  },
  {
    nome: "Fundação Uberlandense do Turismo",
    sigla: "FUTEL",
    destinatario: "Sr(a). Diretor(a) Geral da FUTEL",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,",
    categoria: "Órgão Público",
  },
  {
    nome: "Instituto de Previdência dos Servidores Públicos do Município de Uberlândia",
    sigla: "IPREMU",
    destinatario: "Sr(a). Diretor(a) Geral do IPREMU",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,",
    categoria: "Órgão Público",
  },
  {
    nome: "Empresa Municipal de Apoio e Manutenção",
    sigla: "EMAM",
    destinatario: "Sr(a). Diretor(a) Geral da EMAM",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,",
    categoria: "Órgão Público",
  },
  {
    nome: "Fundação de Excelência Rural de Uberlândia",
    sigla: "FERUB",
    destinatario: "Sr(a). Diretor(a) Geral da FERUB",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a) Geral,",
    categoria: "Órgão Público",
  },
  {
    nome: "PRODAUB",
    destinatario: "Sr(a). Diretor(a) da PRODAUB",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a),",
    categoria: "Órgão Público",
  },
  {
    nome: "Departamento Estadual de Trânsito de Minas Gerais",
    sigla: "DETRAN-MG",
    destinatario: "Sr(a). Diretor(a) do DETRAN-MG",
    vocativo: "Excelentíssimo(a) Senhor(a) Diretor(a),",
    categoria: "Órgão Público",
  },
  {
    nome: "PROCON",
    destinatario: "Sr(a). Superintendente do PROCON",
    vocativo: "Excelentíssimo(a) Senhor(a) Superintendente,",
    categoria: "Órgão Público",
  },
  {
    nome: "Hospital de Clínicas da Universidade Federal de Uberlândia",
    sigla: "HC/UFU",
    destinatario: "Ilmo(a). Sr(a). Diretor(a) e Superintendente do HC/UFU",
    vocativo: "Prezados(as) Senhores(as),",
    categoria: "Órgão Público",
  },
  {
    nome: "Departamento de Estradas de Rodagem de Minas Gerais — 11ª Unidade Regional Uberlândia",
    sigla: "DER-MG",
    destinatario: "Sr(a). Coordenador(a) do DER-MG",
    vocativo: "Prezado(a) Senhor(a) Coordenador(a),",
    categoria: "Órgão Público",
  },
  {
    nome: "Batalhão da Polícia Militar de Minas Gerais",
    sigla: "PMMG",
    destinatario: "Senhor(a) Comandante do Batalhão da PMMG",
    vocativo: "Senhor(a) Comandante,",
    categoria: "Órgão Público",
  },
  {
    nome: "Superintendência Regional de Saúde",
    destinatario: "Sr(a). Superintendente da Superintendência Regional de Saúde",
    vocativo: "Excelentíssimo(a) Senhor(a) Superintendente,",
    categoria: "Órgão Público",
  },
  {
    nome: "CEMIG em Uberlândia",
    sigla: "CEMIG",
    destinatario: "Responsável legal da CEMIG em Uberlândia",
    vocativo: "Prezado(a) Senhor(a),",
    categoria: "Órgão Público",
  },
  {
    nome: "Superintendência Regional de Ensino",
    destinatario: "Senhor(a) Diretor(a) da Superintendência Regional de Ensino",
    vocativo: "Senhor(a) Diretor(a),",
    categoria: "Órgão Público",
  },
  {
    nome: "Ministério Público de Minas Gerais",
    sigla: "MPMG",
    destinatario: "Exmo(a). Sr(a). Promotor(a) de Justiça do MPMG",
    vocativo: "Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,",
    categoria: "Órgão Público",
  },
];

export const ORGAOS_REFERENCIA: OrgaoReferencia[] = [...SECRETARIAS, ...ORGAOS];

export const RECADO_INSTITUCIONAL =
  "Pessoal, este documento traz a relação das Secretarias Municipais e demais órgãos públicos para os quais enviamos ofícios. Ele também contém os pronomes de tratamento e vocativos corretos de cada autoridade. Assim, vocês conseguem conferir se o ofício gerado pelo sistema está com os dados certos, tanto em relação ao destinatário quanto na finalização do documento.";