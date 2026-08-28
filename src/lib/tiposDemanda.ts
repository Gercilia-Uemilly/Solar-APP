// Classificação do TIPO DE DEMANDA a partir do assunto/conteúdo do ofício.
// Obs.: a coluna `tipo_demanda` no banco foi historicamente preenchida com a
// SECRETARIA, por isso os relatórios não devem usá-la como tipo de demanda.

const normalizar = (t: string) =>
  (t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

type Regra = { tipo: string; termos: string[] };

const REGRAS: Regra[] = [
  { tipo: "Tapa-buraco / Pavimentação", termos: ["tapa buraco", "tapa-buraco", "buraco", "asfalt", "recapea", "recomposicao asfaltica", "reparo asfaltico", "pavimenta", "pavimento", "operacao tapa", "nivelamento", "cascalhamento", "patrolamento", "via nao pavimentada", "rua de terra"] },
  { tipo: "Iluminação pública", termos: ["iluminac", "lampada", "poste", "luminaria", "led", "escuro", "sem luz"] },
  { tipo: "Limpeza urbana / Capina", termos: ["capina", "roçada", "rocada", "mato alto", "limpeza", "varricao", "varrição", "entulho", "lixo", "residuo", "podas", "poda de arvore", "poda", "umectac", "poeira", "lote sujo", "terreno baldio"] },
  { tipo: "Água e esgoto", termos: ["esgoto", "agua", "vazamento", "dmae", "rede de agua", "boca de lobo", "galeria", "drenagem", "alagamento", "enchente", "caixa-d", "caixa d agua", "hidrometro", "erosao"] },
  { tipo: "Trânsito e mobilidade", termos: ["semaforo", "faixa de pedestre", "lombada", "quebra-mola", "sinalizac", "sinalizacao viaria", "transito", "estacionamento", "onibus", "linha de onibus", "frota", "ponto de onibus", "abrigo de onibus", "transporte", "velocidade", "seguranca viaria", "mobilidade", "itinerario", "tarifa"] },
  { tipo: "Saúde", termos: ["saude", "ubs", "posto de saude", "consulta", "exame", "cirurgia", "medicament", "remedio", "hospital", "uai", "caps", "vacina", "dentista", "fisioterapia", "samu", "leito", "mg", "farmacia"] },
  { tipo: "Educação", termos: ["escola", "creche", "emei", "educac", "vaga escolar", "merenda", "professor", "uniforme escolar", "toldo na escola", "quadra escolar"] },
  { tipo: "Assistência social", termos: ["cras", "creas", "cesta basica", "assistencia social", "beneficio", "aluguel social", "populacao de rua", "abrigo", "vulnerabilidade"] },
  { tipo: "Segurança pública", termos: ["seguranca", "guarda municipal", "policia", "camera", "videomonitoramento", "furto", "roubo", "vandalismo", "linha ferrea", "trilho"] },
  { tipo: "Meio ambiente / Animais", termos: ["meio ambiente", "animal", "animais", "zoonoses", "castrac", "arvore caida", "descarte irregular", "queimada", "arborizac", "cavalo solto"] },
  { tipo: "Praças, parques e esporte", termos: ["praca", "parque", "quadra", "academia ao ar livre", "playground", "brinquedo", "revitalizac", "campo de futebol", "esporte", "ginasio", "pista de caminhada"] },
  { tipo: "Obras e infraestrutura", termos: ["calcada", "meio-fio", "meio fio", "guia", "sarjeta", "muro", "ponte", "passarela", "obra", "reforma", "construc", "cobertura", "toldo", "acessibilidade", "rampa"] },
  { tipo: "Fiscalização e notificação", termos: ["fiscalizac", "notificac", "irregularidade", "denuncia", "apurac", "vistoria", "autuac", "perturbacao", "som alto", "invasao"] },
  { tipo: "Habitação e regularização", termos: ["habitac", "moradia", "regulariza", "loteamento", "escritura", "terreno", "usucapi"] },
  { tipo: "Acidente de trânsito", termos: ["acidente", "atropelamento", "colisao"] },
  { tipo: "Convite / Agenda", termos: ["convite", "convida", "evento", "audiencia publica", "reuniao", "homenagem", "mocao"] },
  { tipo: "Solicitação de informação", termos: ["solicita informac", "pedido de informac", "solicitacao de informac", "esclareciment", "requerimento de informac", "estudo tecnico", "avaliacao tecnica", "laudo"] },
];

export const TIPO_DEMANDA_OUTROS = "Outros / Não classificado";

export function classificarTipoDemanda(...textos: (string | null | undefined)[]): string {
  const texto = normalizar(textos.filter(Boolean).join(" "));
  if (!texto.trim()) return TIPO_DEMANDA_OUTROS;
  let melhor: { tipo: string; score: number } | null = null;
  for (const regra of REGRAS) {
    let score = 0;
    for (const termo of regra.termos) {
      if (texto.includes(normalizar(termo))) score += termo.length;
    }
    if (score > 0 && (!melhor || score > melhor.score)) melhor = { tipo: regra.tipo, score };
  }
  return melhor?.tipo || TIPO_DEMANDA_OUTROS;
}
