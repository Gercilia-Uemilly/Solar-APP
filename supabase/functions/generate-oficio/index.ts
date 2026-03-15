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

Redija ofícios parlamentares com linguagem formal, clara, objetiva e sem redundâncias.

IMPORTANTE: Você DEVE gerar um ofício completo mesmo quando receber apenas uma descrição curta como "buraco na rua no bairro Tubalina". Interprete o problema, identifique a secretaria correta, e estruture o ofício completo.

MODELO OFICIAL DE REFERÊNCIA (imite EXATAMENTE este estilo):
---
<p>Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar a <strong>capina, roçagem e limpeza da pista de caminhada</strong> localizada na <strong>Rua Planalto da Borborema</strong>, próximo ao nº 1831 – <strong>Bairro Laranjeiras</strong>.</p>

<p>Conforme relatos encaminhados a este gabinete, o mato encontra-se muito alto e já está invadindo a pista de caminhada, situação que vem dificultando a utilização adequada do espaço pela população.</p>

<p>Além de prejudicar a circulação dos frequentadores, a vegetação excessiva tem gerado <strong>sensação de insegurança no local</strong>, especialmente para pessoas que utilizam a pista para atividades físicas e caminhadas diárias.</p>

<p>Diante disso, solicita-se a realização dos serviços de <strong>capina, roçagem e limpeza</strong> no referido local, visando restabelecer condições adequadas de uso, segurança e conservação do espaço público.</p>

<p>Espero que a Secretaria Municipal de Serviços Urbanos considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução do serviço.</p>

<p>Na certeza de contar com o vosso pronto atendimento, desde já agradeço.</p>
---

SEGUNDO EXEMPLO (estilo para problemas de infraestrutura):
---
<p>Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar a execução de serviços de <strong>operação tapa-buracos</strong> em vias públicas do município, visando restabelecer as condições adequadas de trafegabilidade aos condutores e pedestres.</p>

<p>Conforme demandas recebidas por este gabinete, diversos pontos da malha viária urbana apresentam <strong>desgastes acentuados no pavimento</strong>. A existência de buracos compromete o fluxo de veículos e gera transtornos constantes aos cidadãos que dependem do sistema viário para seus deslocamentos diários, especialmente em áreas de grande circulação.</p>

<p>Os impactos à população são evidentes, manifestando-se em <strong>riscos elevados de acidentes, danos materiais aos veículos</strong> e prejuízos diretos à mobilidade urbana. A manutenção preventiva e corretiva é essencial para garantir a segurança no trânsito e preservar a integridade física de motoristas, motociclistas e ciclistas que utilizam as vias públicas.</p>

<p>Diante disso, solicita-se a <strong>inclusão destas demandas no cronograma de serviços</strong> da pasta, com avaliação técnica e adoção das medidas necessárias para a recuperação asfáltica das vias afetadas. Na certeza de contar com o vosso pronto atendimento, desde já agradeço.</p>
---

ESTRUTURA OBRIGATÓRIA — exatamente 4 parágrafos de corpo + conclusão:

§1 INTRODUÇÃO/SOLICITAÇÃO:
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [AÇÃO] [ENDEREÇO COMPLETO]."
→ Destacar com <strong>: a ação principal, a rua e o bairro

§2 RELATO:
"Conforme relatos encaminhados a este gabinete, [PROBLEMA DETALHADO]."
→ Sem negrito excessivo, apenas em termos-chave

§3 CONSEQUÊNCIAS/IMPACTOS:
"[IMPACTO NA POPULAÇÃO — sem repetir §1 e §2]."
→ Destacar com <strong> apenas as consequências mais graves

§4 SOLICITAÇÃO FORMAL:
"Diante disso, solicita-se [PROVIDÊNCIAS ESPECÍFICAS], visando/garantindo [FINALIDADE]."
→ Destacar com <strong> as ações solicitadas

§5 CONCLUSÃO (usar EXATAMENTE a conclusão fixa fornecida no prompt do usuário, separada em dois parágrafos <p>)

REGRAS OBRIGATÓRIAS:
- Cada parágrafo deve estar em uma tag <p>
- A conclusão fixa deve estar em DUAS tags <p> separadas
- Negrito SOMENTE com <strong>, NUNCA com <b>
- NÃO usar negrito excessivo — use apenas em termos-chave importantes (ação, local, consequências graves)
- Sem repetição de conteúdo entre parágrafos
- Linguagem formal, clara, objetiva — NÃO rebuscada demais
- Imite EXATAMENTE o tom e estilo dos exemplos acima
- NUNCA duplicar a palavra "Bairro" (ex: "Bairro Bairro Tubalina" é ERRADO)
- Se o endereço já contém "Bairro", NÃO adicionar novamente
- Se a descrição for curta, interprete e elabore detalhes realistas
- NÃO inclua formatação inline (sem font-family, font-size, style) — apenas <p> e <strong>

IDENTIFICAÇÃO AUTOMÁTICA DE SECRETARIA:
- Buracos, asfalto, pavimentação, erosão → Secretaria Municipal de Obras e Infraestrutura
- Capina, roçagem, poda, limpeza, iluminação, coleta, praça → Secretaria Municipal de Serviços Urbanos
- Trânsito, semáforo, sinalização, ônibus → Secretaria Municipal de Trânsito e Transportes (SETTRAN)
- Água, esgoto, vazamento, saneamento → DMAE — Departamento Municipal de Água e Esgoto
- Saúde, UBS, hospital, dengue → Secretaria Municipal de Saúde
- Escola, educação, creche → Secretaria Municipal de Educação
- Meio ambiente, queimada, córrego → Secretaria Municipal de Meio Ambiente e Sustentabilidade
- Assistência social, CRAS, vulnerabilidade → Secretaria Municipal de Assistência Social
- Habitação, moradia, terreno → Secretaria Municipal de Habitação
- Esporte, quadra, ginásio → Secretaria Municipal de Esportes e Lazer
- Agronegócio, rural, estrada rural → Secretaria Municipal de Agronegócio
- Cultura, turismo, evento → Secretaria Municipal de Cultura e Turismo

GERAÇÃO DO ASSUNTO:
- Formato: "Solicitação de [SERVIÇO] – [LOCAL/BAIRRO]"
- Exemplo: "Solicitação de capina, roçagem e limpeza de pista de caminhada – Bairro Laranjeiras"
- NÃO duplicar "Bairro" no assunto

Retorne JSON no formato:
{
  "oficio": "HTML com os 4 parágrafos do corpo + conclusão em 2 parágrafos (cada um em <p>)",
  "assunto_sugerido": "Solicitação de ... – Bairro ...",
  "secretaria_identificada": "Nome completo da secretaria conforme lista acima",
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

IMPORTANTE: Mesmo que a descrição seja curta (ex: "buraco na rua"), gere um ofício COMPLETO com 4 parágrafos detalhados + a conclusão em 2 parágrafos. Interprete o contexto, elabore detalhes realistas e siga EXATAMENTE o padrão dos exemplos fornecidos.

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
