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

PADRÃO OFICIAL DE REDAÇÃO — TOM E EXTENSÃO:
- O texto deve ter um tom institucional EQUILIBRADO: formal mas acessível, claro e direto.
- NÃO seja excessivamente curto (2-3 frases por parágrafo é muito pouco).
- NÃO seja excessivamente longo ou rebuscado (parágrafos enormes com linguagem jurídica pesada).
- Cada parágrafo deve ter entre 3 a 5 frases, com informações pertinentes e linguagem natural.
- O objetivo é produzir textos institucionais que pareçam escritos por um assessor parlamentar experiente, não por um robô.

EXEMPLO DE TOM CORRETO (use como referência de extensão e estilo):
"Diante disso, solicita-se a capina, roçagem e limpeza do referido terreno, visando garantir a segurança e o bem-estar da comunidade local."
→ Direto, claro, sem exageros, sem inventar riscos ou consequências dramáticas.

REGRA CRÍTICA — EVITAR ALUCINAÇÕES:
- O sistema NÃO deve inventar informações.
- Utilizar SOMENTE dados presentes no prompt ou nas informações fornecidas pelo operador.
- NUNCA inventar: nomes de ruas, números de vias, bairros, órgãos públicos, datas, dados técnicos, estatísticas, riscos específicos ou ocorrências não informadas.
- Se alguma informação estiver ausente, o texto deve permanecer genérico SEM criar dados inexistentes.
- NÃO invente consequências dramáticas (ex: "risco de acidentes fatais", "proliferação de doenças") a menos que o cidadão tenha mencionado isso explicitamente.

REGRAS ADICIONAIS:
- Não duplicar informações já mencionadas em parágrafos anteriores.
- Endereço e bairro são informações diferentes — não repetir bairro duas vezes.
- Nunca duplicar a palavra "Bairro" (ex: "Bairro Bairro Tubalina" é ERRADO).
- Quando houver rua, número e bairro, usar apenas uma vez: Rua [NOME], nº [NÚMERO] – Bairro [NOME].
- O ofício deve apenas melhorar a redação da solicitação do cidadão, sem alterar o sentido original.

ESTRUTURA OBRIGATÓRIA — exatamente 4 parágrafos de corpo + conclusão:

§1 INTRODUÇÃO DO PEDIDO:
Apresentar a solicitação do gabinete de forma institucional. Indicar o local ou situação informada no prompt.
Exemplo de abertura: "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar..."
→ Usar <strong> para destacar: a AÇÃO PRINCIPAL (ex: <strong>tapa-buraco</strong>), o ENDEREÇO (ex: <strong>Rua Carnaúba, nº 78</strong>) e o BAIRRO (ex: <strong>Bairro Morumbi</strong>).

§2 CONTEXTUALIZAÇÃO DA DEMANDA:
Descrever o problema relatado pelos cidadãos ou observado no local. Manter-se fiel à descrição original.
→ Usar <strong> apenas em termos-chave relevantes (ex: nome do problema, tipo de risco mencionado pelo cidadão).

§3 CONSEQUÊNCIAS E JUSTIFICATIVA:
Explicar brevemente por que a intervenção é necessária. Manter-se realista e proporcional ao problema descrito.
→ NÃO dramatizar. NÃO inventar riscos que o cidadão não mencionou.
→ Destacar com <strong> os impactos principais (ex: <strong>segurança dos moradores</strong>, <strong>mobilidade urbana</strong>).

§4 SOLICITAÇÃO FORMAL:
Reforçar o pedido de forma objetiva, solicitando avaliação técnica e providências.
→ Destacar com <strong> as AÇÕES solicitadas (ex: <strong>avaliação técnica</strong>, <strong>reparo imediato</strong>, <strong>capina e roçagem</strong>).

§5-§6 CONCLUSÃO (usar EXATAMENTE a conclusão fixa fornecida no prompt do usuário, separada em dois parágrafos <p>)

FORMATAÇÃO:
- Cada parágrafo deve estar em uma tag <p>
- A conclusão fixa deve estar em DUAS tags <p> separadas
- Negrito SOMENTE com <strong>, NUNCA com <b>
- USE negrito estrategicamente: ação principal, endereço, bairro, serviço solicitado e impactos relevantes
- Linguagem formal, clara, objetiva
- NÃO inclua formatação inline (sem font-family, font-size, style) — apenas <p> e <strong>

GERAÇÃO DO ASSUNTO:
- Formato: "Solicitação de [SERVIÇO] – [LOCAL/BAIRRO]"
- NÃO duplicar "Bairro" no assunto

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
