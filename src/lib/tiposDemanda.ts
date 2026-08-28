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
  { tipo: "Tapa-buraco / Pavimentação", termos: ["tapa buraco", "tapa-buraco", "buraco", "asfalt", "recapea", "pavimenta", "operacao tapa"] },
  { tipo: "Iluminação pública", termos: ["iluminac", "lampada", "poste", "luminaria", "led", "escuro"] },
  { tipo: "Limpeza urbana / Capina", termos: ["capina", "roçada", "rocada", "mato alto", "limpeza", "varricao", "varrição", "entulho", "lixo", "podas", "poda de arvore", "poda"] },
  { tipo: "Água e esgoto", termos: ["esgoto", "agua", "vazamento", "dmae", "rede de agua", "boca de lobo", "galeria", "drenagem", "alagamento", "enchente"] },
  { tipo: "Trânsito e mobilidade", termos: ["semaforo", "faixa de pedestre", "lombada", "quebra-mola", "sinalizac", "transito", "estacionamento", "onibus", "ponto de onibus", "abrigo de onibus", "transporte", "velocidade"] },
  { tipo: "Saúde", termos: ["saude", "ubs", "posto de saude", "consulta", "exame", "cirurgia", "medicament", "hospital", "uai", "caps", "vacina", "dentista", "fisioterapia"] },
  { tipo: "Educação", termos: ["escola", "creche", "emei", "educac", "vaga escolar", "merenda", "professor", "uniforme escolar"] },
  { tipo: "Assistência social", termos: ["cras", "creas", "cesta basica", "assistencia social", "beneficio", "aluguel social", "populacao de rua", "abrigo"] },
  { tipo: "Segurança pública", termos: ["seguranca", "guarda municipal", "policia", "camera", "videomonitoramento", "furto", "roubo", "vandalismo"] },
  { tipo: "Meio ambiente / Animais", termos: ["meio ambiente", "animal", "animais", "zoonoses", "castrac", "arvore caida", "descarte irregular", "queimada"] },
  { tipo: "Praças, parques e esporte", termos: ["praca", "parque", "quadra", "academia ao ar livre", "playground", "campo de futebol", "esporte", "ginasio"] },
  { tipo: "Obras e infraestrutura", termos: ["calcada", "meio-fio", "meio fio", "guia", "sarjeta", "muro", "ponte", "passarela", "obra", "reforma", "construc"] },
  { tipo: "Habitação e regularização", termos: ["habitac", "moradia", "regulariza", "loteamento", "escritura", "terreno"] },
  { tipo: "Acidente de trânsito", termos: ["acidente", "atropelamento", "colisao"] },
  { tipo: "Convite / Agenda", termos: ["convite", "convida", "evento", "audiencia publica", "reuniao"] },
  { tipo: "Solicitação de informação", termos: ["solicita informac", "pedido de informac", "esclareciment", "requerimento de informac"] },
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
