// Adivinha a secretaria pelas palavras da demanda. Só é usado quando o
// operador/Agente JR não informou um destinatário conhecido.

const SECRETARIA_MAP: Record<string, string[]> = {
  "Serviços Urbanos": ["capina","roçagem","limpeza","poda","árvore","iluminação","poste","lâmpada","coleta","lixo","entulho","bueiro","calçada","praça","parque","buraco","tapa-buraco","tapa buraco"],
  "Infraestrutura": ["erosão","obra","ponte","viaduto","estrada","recapeamento","recapear","asfalto","asfáltico","asfáltica","pavimentação","pavimentar"],
  "Saúde": ["saúde","UBS","hospital","posto de saúde","médico","dengue","fumacê","vacina","ambulância","SAMU","UPA"],
  "Trânsito e Transportes (SETTRAN)": ["trânsito","semáforo","sinalização","faixa de pedestre","lombada","quebra-mola","quebra mola","redutor de velocidade","ônibus","transporte"],
  "Gestão Ambiental e Sustentabilidade": ["meio ambiente","ambiental","desmatamento","queimada","poluição","córrego","nascente"],
  "Educação": ["escola","educação","creche","EMEI","EMEF","professor","ensino","merenda"],
  "Desenvolvimento Social": ["assistência social","CRAS","CREAS","vulnerabilidade","moradia","população de rua"],
  "Agronegócio": ["agronegócio","rural","agricultura","fazenda","zona rural","estrada rural","produtor"],
  "DMAE": ["água","esgoto","saneamento","vazamento","falta de água","DMAE","abastecimento"],
  "Habitação": ["habitação","moradia","conjunto habitacional","regularização fundiária","terreno"],
  "Cultura e Turismo": ["cultura","turismo","evento","teatro","museu","patrimônio histórico"],
  "Juventude": ["esporte","lazer","quadra","campo","ginásio","piscina","juventude"],
};

// Termos que decidem sozinhos, antes da contagem de palavras.
const REGRAS_FORTES: { secretaria: string; termos: string[] }[] = [
  // Recapeamento/asfalto é da Infraestrutura, mesmo que o texto cite calçada, limpeza etc.
  { secretaria: "Infraestrutura", termos: ["recape", "recapea", "asfaltic", "pavimentac", "pavimentar"] },
];

const semAcento = (t: string) =>
  (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function detectSecretaria(text: string): string | null {
  const lower = semAcento(text);
  for (const regra of REGRAS_FORTES) {
    if (regra.termos.some((t) => lower.includes(t))) return regra.secretaria;
  }
  let best: string | null = null, bestScore = 0;
  for (const [sec, kws] of Object.entries(SECRETARIA_MAP)) {
    let score = 0;
    for (const kw of kws) if (lower.includes(semAcento(kw))) score++;
    if (score > bestScore) { bestScore = score; best = sec; }
  }
  return best;
}
