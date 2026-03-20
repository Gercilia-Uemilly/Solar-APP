import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapeamento completo de secretarias com palavras-chave para classificação automática
const SECRETARIA_MAP: Record<string, string[]> = {
  "Serviços Urbanos": [
    "capina", "roçagem", "limpeza", "poda", "árvore", "galho", "mato", "iluminação",
    "poste", "lâmpada", "luz", "coleta", "lixo", "entulho", "bueiro", "boca de lobo",
    "calçada", "passeio", "pista de caminhada", "praça", "parque", "jardim"
  ],
  "Infraestrutura": [
    "buraco", "buracos", "asfalto", "pavimentação", "tapa-buraco", "tapa-buracos",
    "recapeamento", "erosão", "cratera", "obra", "infraestrutura", "ponte", "viaduto",
    "via", "rua danificada", "estrada"
  ],
  "Saúde": [
    "saúde", "UBS", "hospital", "posto de saúde", "médico", "dengue", "fumacê",
    "epidemia", "vacina", "ambulância", "SAMU", "UPA"
  ],
  "Trânsito e Transportes (SETTRAN)": [
    "trânsito", "semáforo", "sinalização", "faixa de pedestre", "lombada",
    "estacionamento", "ônibus", "transporte", "radar", "velocidade", "placa"
  ],
  "Gestão Ambiental e Sustentabilidade": [
    "meio ambiente", "ambiental", "desmatamento", "queimada", "poluição",
    "córrego", "nascente", "APP", "fauna", "flora", "animal"
  ],
  "Educação": [
    "escola", "educação", "creche", "EMEI", "EMEF", "professor", "ensino",
    "merenda", "transporte escolar"
  ],
  "Desenvolvimento Social": [
    "assistência social", "CRAS", "CREAS", "vulnerabilidade", "moradia",
    "população de rua", "abrigo"
  ],
  "Agronegócio": [
    "agronegócio", "rural", "agricultura", "fazenda", "zona rural",
    "estrada rural", "produtor"
  ],
  "DMAE": [
    "água", "esgoto", "saneamento", "vazamento", "falta de água", "DMAE",
    "rede de esgoto", "tratamento", "abastecimento"
  ],
  "Habitação": [
    "habitação", "moradia", "conjunto habitacional", "regularização fundiária",
    "terreno", "lote", "invasão"
  ],
  "Cultura e Turismo": [
    "cultura", "turismo", "evento", "teatro", "museu", "patrimônio histórico"
  ],
  "Juventude": [
    "esporte", "lazer", "quadra", "campo", "ginásio", "piscina", "academia ao ar livre", "juventude"
  ],
};

// Vocativos por secretaria/órgão (espelha oficioUtils.ts)
const VOCATIVO_MAP: Record<string, string> = {
  'ARESAN': 'Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,',
  'DMAE': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'FUTEL': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'IPREMU': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'EMAM': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'FERUB': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'PRODAUB': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'DETRAN-MG': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'PROCON': 'Excelentíssimo(a) Senhor(a) Superintendente,',
  'HC/UFU': 'Prezados(as) Senhores(as),',
  'DER-MG': 'Prezado(a) Senhor(a) Coordenador(a),',
  'DNIT': 'Prezado(a) Senhor(a),',
  'Polícia Militar (PMMG)': 'Senhor(a) Comandante,',
  'Superintendência Regional de Saúde': 'Prezado(a) Senhor(a),',
  'CEMIG': 'Prezado(a) Senhor(a),',
  'Superintendência Regional de Ensino': 'Senhor(a) Diretor(a),',
  'Ministério Público de Minas Gerais': 'Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,',
};

function getVocativoForSecretaria(secretaria: string): string {
  return VOCATIVO_MAP[secretaria] || 'Excelentíssimo(a) Senhor(a) Secretário(a),';
}

function getNomeOrgaoForSecretaria(secretaria: string): string {
  // Órgãos especiais
  const orgaoMap: Record<string, string> = {
    'DMAE': 'Departamento Municipal de Água e Esgoto',
    'ARESAN': 'Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia',
    'FUTEL': 'Fundação Uberlandense do Turismo',
    'IPREMU': 'Instituto de Previdência dos Servidores Públicos do Município de Uberlândia',
    'EMAM': 'Empresa Municipal de Apoio e Manutenção',
    'FERUB': 'Fundação de Excelência Rural de Uberlândia',
  };
  if (orgaoMap[secretaria]) return orgaoMap[secretaria];
  // Secretarias municipais
  if (!secretaria.includes('(') && !secretaria.includes('–')) {
    return `Secretaria Municipal de ${secretaria}`;
  }
  return secretaria;
}

function detectSecretaria(text: string): string | null {
  const lower = text.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [secretaria, keywords] of Object.entries(SECRETARIA_MAP)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = secretaria;
    }
  }

  return bestMatch;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    // Detectar secretaria automaticamente se não informada
    const textoCompleto = `${descricao || ""} ${assunto || ""} ${bairro || ""} ${local || ""}`;
    const secretariaDetectada = tipo || detectSecretaria(textoCompleto) || "Serviços Urbanos";

    const nomeOrgao = getNomeOrgaoForSecretaria(secretariaDetectada);
    const vocativo = getVocativoForSecretaria(secretariaDetectada);

    // Conclusão adaptada ao órgão - seguindo exatamente o modelo de referência
    const artigo = nomeOrgao.startsWith('Departamento') || nomeOrgao.startsWith('Instituto') || nomeOrgao.startsWith('Hospital') ? 'o' : 'a';
    const conclusao = `Espero que ${artigo} ${nomeOrgao} considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução do serviço.\n\nNa certeza de contar com o vosso pronto atendimento, desde já agradeço.`;

    const SYSTEM_PROMPT = `Você é redator parlamentar do gabinete do Vereador Fabão em Uberlândia-MG.

Você é responsável por redigir o CORPO de ofícios parlamentares formais seguindo EXATAMENTE o padrão institucional do gabinete.

OFÍCIO DE REFERÊNCIA (siga EXATAMENTE este estilo, tom e estrutura):
---
§1: "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar análise e revisão das recentes mudanças implementadas na EMEI Profª. Izildinha Mª. M. do Amaral, localizada na R. Osvaldo Samora, nº 2, no bairro Luizote de Freitas, visando garantir a manutenção da qualidade do ensino ofertado à comunidade."

§2: "Conforme relatos encaminhados a este gabinete, as alterações mencionadas incluíram a demissão de três professoras e o fechamento de duas salas de aula. Essa reestruturação resultou em uma redistribuição dos alunos, sobrecarregando os professores remanescentes e aumentando significativamente o número de crianças por turma."

§3: "Tal situação resulta em um ambiente de ensino desfavorável, com salas superlotadas que dificultam o acompanhamento individualizado dos alunos e comprometem o processo de aprendizagem. A sobrecarga de trabalho imposta aos professores gera um desgaste profissional que pode impactar diretamente a qualidade pedagógica e a atenção dispensada às crianças."

§4: "Diante do exposto, solicita-se a adoção da seguinte providência: a reavaliação do quadro de pessoal e da estrutura de salas da referida unidade de ensino, com o objetivo de restabelecer um ambiente educacional adequado e garantir que o padrão de qualidade do ensino não seja prejudicado."
---

OBSERVE O PADRÃO:
- Tom institucional EQUILIBRADO: formal mas acessível, claro e direto
- Cada parágrafo tem 2-3 frases BEM DESENVOLVIDAS (não curtas demais, não longas demais)
- §1 abre com "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar..."
- §2 abre com "Conforme relatos encaminhados a este gabinete..."
- §3 descreve consequências REALISTAS e PROPORCIONAIS (sem dramatizar)
- §4 abre com "Diante do exposto, solicita-se a adoção da seguinte providência:" e detalha o pedido
- NÃO invente dados, riscos ou consequências não mencionadas pelo cidadão

REGRA CRÍTICA — EVITAR ALUCINAÇÕES:
- Utilizar SOMENTE dados presentes no prompt ou nas informações fornecidas pelo operador.
- NUNCA inventar: nomes de ruas, números, bairros, órgãos, datas, estatísticas, riscos.
- Se informação estiver ausente, manter genérico SEM criar dados inexistentes.

REGRAS DE NÃO-DUPLICAÇÃO (OBRIGATÓRIO):
- O bairro deve aparecer apenas UMA vez no corpo do texto (no §1).
- O endereço completo (rua, número) deve aparecer apenas UMA vez (no §1).
- A secretaria/órgão destinatário deve aparecer apenas UMA vez.
- NUNCA repita informações já mencionadas em parágrafos anteriores.
- Nunca duplicar "Bairro" (ex: "Bairro Bairro Tubalina" é ERRADO).

ESTRUTURA OBRIGATÓRIA — exatamente 4 parágrafos de corpo + conclusão:

§1 INTRODUÇÃO DO PEDIDO:
Abertura: "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar..."
Incluir: ação principal, local/endereço e bairro. Usar <strong> para destacar ação, endereço e bairro.

§2 CONTEXTUALIZAÇÃO DA DEMANDA:
Abertura OBRIGATÓRIA: "Conforme relatos encaminhados a este gabinete..."
Descrever o problema fielmente. NÃO repetir endereço/bairro.

§3 CONSEQUÊNCIAS E JUSTIFICATIVA:
Explicar por que a intervenção é necessária. Realista e proporcional.
NÃO dramatizar. NÃO inventar riscos.

§4 SOLICITAÇÃO FORMAL:
Abertura: "Diante do exposto, solicita-se a adoção da seguinte providência:"
Detalhar o pedido de forma objetiva.

§5-§6 CONCLUSÃO (usar EXATAMENTE a conclusão fixa fornecida no prompt do usuário, separada em dois parágrafos <p>)

REGRAS DE NÃO-DUPLICAÇÃO (OBRIGATÓRIO):
- O bairro deve aparecer apenas UMA vez no corpo do texto.
- O endereço completo (rua, número) deve aparecer apenas UMA vez.
- A secretaria/órgão destinatário deve aparecer apenas UMA vez.
- NUNCA repita informações já mencionadas em parágrafos anteriores.

FORMATAÇÃO:
- Cada parágrafo deve estar em uma tag <p>
- A conclusão fixa deve estar em DUAS tags <p> separadas
- Negrito SOMENTE com <strong>, NUNCA com <b>
- USE negrito estrategicamente: ação principal, endereço, bairro, serviço solicitado e impactos relevantes
- Linguagem formal, clara, objetiva
- NÃO inclua formatação inline (sem font-family, font-size, style) — apenas <p> e <strong>

GERAÇÃO DO ASSUNTO (EXTREMAMENTE IMPORTANTE):
O assunto deve ser RESUMIDO e OBJETIVO, baseado no CONTEXTO — NÃO copiar endereço completo.

PRIORIDADE DO ASSUNTO:
1º → Nome do local (se existir): Escola, UBS, Praça, etc.
2º → Tipo de ação: limpeza, reparo, tapa-buraco, etc.
3º → Bairro (APENAS se necessário e NÃO duplicado)

REGRAS:
- NUNCA incluir endereço completo (rua, número, complemento) no assunto
- NUNCA duplicar "Bairro" (ex: "Bairro Bairro Tubalina" é ERRADO)
- NUNCA repetir informação no assunto
- Se houver nome de local → priorizar o local, bairro entre parênteses se necessário
- Se NÃO houver local claro → tipo de ação + bairro
- Se NÃO houver bairro → NÃO inventar, usar apenas tipo de ação + local

Exemplos CORRETOS:
✔ "Solicitação de limpeza – Escola Municipal José da Costa"
✔ "Solicitação de reparos – UBS Morumbi"
✔ "Solicitação de tapa-buraco – Bairro Martins"
✔ "Solicitação de limpeza urbana – Bairro Martins"

Exemplos ERRADOS:
❌ "Solicitação de limpeza – Escola Municipal José da Costa, Rua X nº 123 Bairro Martins"
❌ "Solicitação – Rua X Bairro Martins Bairro Martins"
❌ "Solicitação de limpeza – Rua João Naves nº 123, Bairro Martins"

IMPORTANTE: O texto final deve refletir fielmente a demanda enviada pelo cidadão, apenas com correção gramatical e organização institucional. NUNCA adicione informações que não existam na descrição original.

INTERPRETAÇÃO INTELIGENTE DE ENTRADAS:
A descrição pode vir em diferentes formatos — você DEVE interpretar corretamente TODOS:

1. PROMPT CURTO (ex: "buraco na rua tal", "falta iluminação no bairro X"):
   → Desenvolva um ofício completo com os 4 parágrafos, inferindo consequências realistas e proporcionais ao problema descrito.

2. CONVERSA COLADA DO WHATSAPP (ex: mensagens com horários, nomes, "bom dia", "pode ajudar?"):
   → Extraia: o problema real, localização, nome do solicitante, detalhes relevantes.
   → IGNORE: saudações, emojis, mensagens de agradecimento, confirmações genéricas.
   → Use as informações extraídas para gerar o ofício formal completo.

3. DESCRIÇÃO NARRATIVA DETALHADA:
   → Organize e formalize o conteúdo mantendo fidelidade aos fatos relatados.

Em TODOS os casos, gere um ofício COMPLETO com 4 parágrafos + conclusão. Nunca retorne texto incompleto ou genérico demais.

Retorne JSON no formato:
{
  "oficio": "HTML com os 4 parágrafos do corpo + conclusão em 2 parágrafos (cada um em <p>)",
  "assunto_sugerido": "Solicitação de ... – Bairro ...",
  "secretaria_identificada": "Nome completo da secretaria",
  "tipo_demanda": "Solicitação|Reclamação|Requerimento",
  "urgencia": "normal|urgente",
  "sugestoes_melhoria": []
}`;
    const userPrompt = `SECRETARIA/ÓRGÃO: ${secretariaDetectada}
SECRETARIA/ÓRGÃO: ${secretariaDetectada}
VOCATIVO OBRIGATÓRIO: ${vocativo}
NOME DO ÓRGÃO NA CONCLUSÃO: ${nomeOrgao}
DESTINATÁRIO: ${destinatario || "A identificar automaticamente"}
DESCRIÇÃO DO PROBLEMA: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "moradores da região"}
ENDEREÇO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO (se já informado): ${assunto || "Gerar automaticamente"}

CONCLUSÃO FIXA (incluir como os dois últimos parágrafos <p> do corpo):
"${conclusao}"

IMPORTANTE: Mesmo que a descrição seja curta (ex: "buraco na rua"), gere um ofício COMPLETO com 4 parágrafos detalhados + a conclusão em 2 parágrafos. Desenvolva o texto com equilíbrio — não seja excessivamente curto nem excessivamente longo. Siga EXATAMENTE o padrão dos 4 parágrafos obrigatórios. Use SOMENTE informações fornecidas, NÃO invente dados.

Gere o ofício parlamentar em JSON.`;

    const { systemInstruction, messages } = toGeminiMessages(SYSTEM_PROMPT, userPrompt);
    const result = await callGemini({ systemInstruction, messages });

    let parsed;
    try {
      const cleaned = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        oficio: result.text,
        assunto_sugerido: "",
        secretaria_identificada: secretariaDetectada,
        tipo_demanda: "Solicitação",
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        sugestoes_melhoria: [],
      };
    }

    // Se a IA não identificou a secretaria, usar a detecção por palavras-chave
    if (!parsed.secretaria_identificada && secretariaDetectada) {
      parsed.secretaria_identificada = secretariaDetectada;
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("generate-oficio error:", error);
    const status = error.status || 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno ao gerar ofício" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
