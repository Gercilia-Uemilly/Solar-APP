import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Mapeamento completo de secretarias com palavras-chave para classificação automática
const SECRETARIA_MAP: Record<string, string[]> = {
  "Secretaria Municipal de Serviços Urbanos": [
    "capina", "roçagem", "limpeza", "poda", "árvore", "galho", "mato", "iluminação",
    "poste", "lâmpada", "luz", "coleta", "lixo", "entulho", "bueiro", "boca de lobo",
    "calçada", "passeio", "pista de caminhada", "praça", "parque", "jardim"
  ],
  "Secretaria Municipal de Obras e Infraestrutura": [
    "buraco", "buracos", "asfalto", "pavimentação", "tapa-buraco", "tapa-buracos",
    "recapeamento", "erosão", "cratera", "obra", "infraestrutura", "ponte", "viaduto",
    "via", "rua danificada", "estrada"
  ],
  "Secretaria Municipal de Saúde": [
    "saúde", "UBS", "hospital", "posto de saúde", "médico", "dengue", "fumacê",
    "epidemia", "vacina", "ambulância", "SAMU", "UPA"
  ],
  "Secretaria Municipal de Trânsito e Transportes (SETTRAN)": [
    "trânsito", "semáforo", "sinalização", "faixa de pedestre", "lombada",
    "estacionamento", "ônibus", "transporte", "radar", "velocidade", "placa"
  ],
  "Secretaria Municipal de Meio Ambiente e Sustentabilidade": [
    "meio ambiente", "ambiental", "desmatamento", "queimada", "poluição",
    "córrego", "nascente", "APP", "fauna", "flora", "animal"
  ],
  "Secretaria Municipal de Educação": [
    "escola", "educação", "creche", "EMEI", "EMEF", "professor", "ensino",
    "merenda", "transporte escolar"
  ],
  "Secretaria Municipal de Assistência Social": [
    "assistência social", "CRAS", "CREAS", "vulnerabilidade", "moradia",
    "população de rua", "abrigo"
  ],
  "Secretaria Municipal de Agronegócio": [
    "agronegócio", "rural", "agricultura", "fazenda", "zona rural",
    "estrada rural", "produtor"
  ],
  "DMAE — Departamento Municipal de Água e Esgoto": [
    "água", "esgoto", "saneamento", "vazamento", "falta de água", "DMAE",
    "rede de esgoto", "tratamento", "abastecimento"
  ],
  "Secretaria Municipal de Habitação": [
    "habitação", "moradia", "conjunto habitacional", "regularização fundiária",
    "terreno", "lote", "invasão"
  ],
  "Secretaria Municipal de Cultura e Turismo": [
    "cultura", "turismo", "evento", "teatro", "museu", "patrimônio histórico"
  ],
  "Secretaria Municipal de Esportes e Lazer": [
    "esporte", "lazer", "quadra", "campo", "ginásio", "piscina", "academia ao ar livre"
  ],
};

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
    const secretariaDetectada = tipo || detectSecretaria(textoCompleto) || "Secretaria Municipal de Serviços Urbanos";

    const nomeOrgao = {
      'DMAE': 'Departamento Municipal de Água e Esgoto',
      'DMAE — Departamento Municipal de Água e Esgoto': 'Departamento Municipal de Água e Esgoto',
      'UFU — Universidade Federal de Uberlândia': 'Universidade Federal de Uberlândia',
      'Secretaria Municipal de Trânsito e Transportes (SETTRAN)': 'Secretaria Municipal de Trânsito e Transportes',
    }[secretariaDetectada] || secretariaDetectada || 'órgão competente';

    // Conclusão adaptada ao órgão - seguindo exatamente o modelo de referência
    const conclusao = `Espero que ${nomeOrgao.startsWith('Departamento') || nomeOrgao.startsWith('Universidade') ? 'o' : 'a'} ${nomeOrgao} considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução do serviço.\n\nNa certeza de contar com o vosso pronto atendimento, desde já agradeço.`;

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
