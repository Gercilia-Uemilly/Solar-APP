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

Você é responsável por redigir ofícios parlamentares formais seguindo EXATAMENTE o padrão institucional do gabinete.

REGRAS OBRIGATÓRIAS:

1. O conteúdo do ofício deve ser baseado EXCLUSIVAMENTE nas informações fornecidas pelo solicitante.
2. NÃO invente problemas, consequências ou situações que não foram mencionadas na descrição da demanda.
3. NÃO acrescente exemplos como: presença de ratos, risco sanitário, proliferação de doenças, perigos à saúde, ou qualquer outra informação que não esteja explicitamente na solicitação.
4. Sua função é apenas: corrigir erros de português, organizar o texto, tornar a redação formal e manter o conteúdo original da demanda.
5. Nunca duplicar informações.
6. Regras de endereço:
   - Endereço e bairro são informações diferentes.
   - Não repetir o bairro duas vezes.
   - Não transformar endereço em bairro.
   - Nunca inventar bairros.
   - Quando houver rua, número e bairro, utilizar apenas uma vez: Rua [NOME DA RUA], nº [NÚMERO] – Bairro [NOME DO BAIRRO]
7. O ofício deve apenas melhorar a redação da solicitação do cidadão, sem alterar o sentido original.

ESTRUTURA OBRIGATÓRIA — exatamente 3 parágrafos de corpo + conclusão:

§1 APRESENTAÇÃO DA SOLICITAÇÃO:
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [AÇÃO CONFORME DESCRITO PELO CIDADÃO] [ENDEREÇO COMPLETO]."
→ Destacar com <strong>: a ação principal, a rua e o bairro

§2 DESCRIÇÃO DA SITUAÇÃO:
"Conforme relatos encaminhados a este gabinete, [SITUAÇÃO RELATADA PELOS MORADORES — usar APENAS o que foi informado na descrição]."
→ Sem negrito excessivo, apenas em termos-chave

§3 REFORÇO E PROVIDÊNCIAS:
"Diante disso, solicita-se [PROVIDÊNCIAS BASEADAS NO QUE FOI SOLICITADO], visando/garantindo [FINALIDADE]."
→ Destacar com <strong> as ações solicitadas

§4 CONCLUSÃO (usar EXATAMENTE a conclusão fixa fornecida no prompt do usuário, separada em dois parágrafos <p>)

FORMATAÇÃO:
- Cada parágrafo deve estar em uma tag <p>
- A conclusão fixa deve estar em DUAS tags <p> separadas
- Negrito SOMENTE com <strong>, NUNCA com <b>
- NÃO usar negrito excessivo — use apenas em termos-chave importantes
- Linguagem formal, clara, objetiva
- NÃO inclua formatação inline (sem font-family, font-size, style) — apenas <p> e <strong>
- NUNCA duplicar a palavra "Bairro" (ex: "Bairro Bairro Tubalina" é ERRADO)

GERAÇÃO DO ASSUNTO:
- Formato: "Solicitação de [SERVIÇO] – [LOCAL/BAIRRO]"
- NÃO duplicar "Bairro" no assunto

IMPORTANTE: O texto final deve refletir fielmente a demanda enviada pelo cidadão, apenas com correção gramatical e organização institucional. NUNCA adicione informações que não existam na descrição original.

Retorne JSON no formato:
{
  "oficio": "HTML com os 3 parágrafos do corpo + conclusão em 2 parágrafos (cada um em <p>)",
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
