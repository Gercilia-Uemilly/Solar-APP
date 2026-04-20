import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECRETARIA_MAP: Record<string, string[]> = {
  "Serviços Urbanos": ["capina","roçagem","limpeza","poda","árvore","iluminação","poste","lâmpada","coleta","lixo","entulho","bueiro","calçada","praça","parque"],
  "Infraestrutura": ["buraco","asfalto","pavimentação","tapa-buraco","recapeamento","erosão","obra","ponte","viaduto","estrada"],
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

const VOCATIVO_MAP: Record<string, string> = {
  'ARESAN': 'Excelentíssimo(a) Senhor(a) Diretor(a) Presidente,',
  'DMAE': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'FUTEL': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'IPREMU': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'EMAM': 'Excelentíssimo(a) Senhor(a) Diretor(a) Geral,',
  'FERUB': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'PRODAUB': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
  'Polícia Militar (PMMG)': 'Senhor(a) Comandante,',
  'CEMIG': 'Prezado(a) Senhor(a),',
  'Conservatório Estadual de Música Cora Pavan Capparelli': 'Excelentíssimo(a) Senhor(a) Diretor(a),',
};

function normalizeSecretariaInput(s: string): string {
  return (s || '').replace(/^Secretaria Municipal de\s+/i, '').trim();
}

function getVocativoForSecretaria(s: string): string {
  const normalized = normalizeSecretariaInput(s);
  return VOCATIVO_MAP[s] || VOCATIVO_MAP[normalized] || 'Excelentíssimo(a) Senhor(a) Secretário(a),';
}

function getNomeOrgaoForSecretaria(s: string): string {
  const normalized = normalizeSecretariaInput(s);
  const m: Record<string, string> = {
    'DMAE': 'Departamento Municipal de Água e Esgoto',
    'ARESAN': 'Agência de Regulação dos Serviços de Saneamento Básico de Uberlândia',
    'FUTEL': 'Fundação Uberlandense do Turismo, Esporte e Lazer',
    'IPREMU': 'Instituto de Previdência dos Servidores Públicos do Município de Uberlândia',
    'EMAM': 'Empresa Municipal de Apoio e Manutenção',
    'FERUB': 'Fundação de Excelência Rural de Uberlândia',
    'PRODAUB': 'Processamento de Dados de Uberlândia',
    'HC/UFU': 'Hospital de Clínicas da Universidade Federal de Uberlândia',
    'SETTRAN': 'Secretaria Municipal de Trânsito e Transportes',
    'Trânsito e Transportes (SETTRAN)': 'Secretaria Municipal de Trânsito e Transportes',
    'Trânsito e Transportes': 'Secretaria Municipal de Trânsito e Transportes',
    'Gestão Ambiental e Sustentabilidade': 'Secretaria Municipal de Meio Ambiente e Sustentabilidade',
    'PMMG': 'Polícia Militar de Minas Gerais',
    'Polícia Militar (PMMG)': 'Polícia Militar de Minas Gerais',
    'CEMIG': 'Companhia Energética de Minas Gerais',
    'PROCON': 'PROCON Municipal de Uberlândia',
    'DNIT': 'Departamento Nacional de Infraestrutura de Transportes',
    'DER-MG': 'Departamento de Edificações e Estradas de Rodagem de Minas Gerais',
    'Conservatório Estadual de Música Cora Pavan Capparelli': 'Conservatório Estadual de Música Cora Pavan Capparelli',
  };
  if (m[s]) return m[s];
  if (m[normalized]) return m[normalized];
  // Strip parenthetical abbreviations before building the full name
  const cleanName = normalized.replace(/\s*\([^)]+\)\s*/g, '').trim();
  if (cleanName) return `Secretaria Municipal de ${cleanName}`;
  return normalized;
}

function detectSecretaria(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null, bestScore = 0;
  for (const [sec, kws] of Object.entries(SECRETARIA_MAP)) {
    let score = 0;
    for (const kw of kws) if (lower.includes(kw.toLowerCase())) score++;
    if (score > bestScore) { bestScore = score; best = sec; }
  }
  return best;
}

function isMudancaDirecaoRua(text: string): boolean {
  const lower = (text || '').toLowerCase();
  const palavrasChave = [
    'mudança de direção', 'mudanca de direcao',
    'mudança de sentido', 'mudanca de sentido',
    'mudança de mão', 'mudanca de mao',
    'inverter o sentido', 'inverter sentido',
    'mão única', 'mao unica',
    'sentido único', 'sentido unico',
    'mão dupla', 'mao dupla',
    'sentido da via', 'sentido da rua',
    'mudar o sentido', 'mudar a direção', 'mudar a direcao',
    'alterar o sentido', 'alterar a direção',
    'direção da rua', 'direcao da rua',
    'direção da via', 'direcao da via',
  ];
  return palavrasChave.some((kw) => lower.includes(kw));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();
    const textoCompleto = `${descricao || ""} ${assunto || ""} ${bairro || ""} ${local || ""}`;
    const tipoNormalizado = typeof tipo === "string" ? tipo.trim() : "";
    const tipoValidoComoSecretaria = tipoNormalizado && !["solicitação", "reclamação", "requerimento"].includes(tipoNormalizado.toLowerCase());
    const secretariaDetectada = (tipoValidoComoSecretaria ? tipoNormalizado : "") || detectSecretaria(textoCompleto) || "Serviços Urbanos";
    const nomeOrgao = getNomeOrgaoForSecretaria(secretariaDetectada);
    const vocativo = getVocativoForSecretaria(secretariaDetectada);
    // "do" for masculine nouns (Departamento, Instituto, Hospital, Processamento, PROCON, DNIT, Ministério, Batalhão)
    // "da" for feminine nouns (Secretaria, Companhia, Agência, Fundação, Empresa, Polícia)
    const masculineStarts = ['Departamento', 'Instituto', 'PROCON', 'Ministério', 'Batalhão', 'Hospital', 'Processamento', 'DNIT'];
    const artigo = masculineStarts.some(p => nomeOrgao.startsWith(p)) ? 'o' : 'a';
    const conclusao = `Assim, encaminha-se o presente para apreciação d${artigo} ${nomeOrgao}, solicitando-se a análise do pleito e a manifestação quanto à sua viabilidade, bem como a indicação de eventual previsão para execução do serviço.\n\nNa certeza de contar com o vosso pronto atendimento, desde já agradeço.`;

    const ehMudancaDirecao = isMudancaDirecaoRua(textoCompleto);

    const TEMPLATE_MUDANCA_DIRECAO = `MODELO OBRIGATÓRIO PARA PEDIDOS DE MUDANÇA DE DIREÇÃO/SENTIDO DE RUA:
Use EXATAMENTE a estrutura abaixo, adaptando APENAS o nome da rua, bairro e ponto de referência (ex.: escola, comércio) com base nos dados fornecidos. NÃO altere o tom, a ordem dos parágrafos nem invente fatos. Mantenha <strong> nos locais e pontos críticos.

<p>Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar a realização de estudos técnicos e a adoção de medidas viárias cabíveis na <strong>[NOME DA RUA/VIA]</strong>, localizada no <strong>Bairro [NOME DO BAIRRO]</strong>[, em frente à <strong>[PONTO DE REFERÊNCIA]</strong> — incluir somente se houver].</p>
<p>Conforme relatos encaminhados a este gabinete, o tráfego na referida via tem causado <strong>transtornos significativos</strong>[, especialmente nos horários de entrada e saída dos alunos — incluir somente se houver escola/creche]. A atual configuração do local tem resultado em <strong>congestionamentos frequentes</strong>, dificuldades para a <strong>travessia segura de pedestres</strong> e problemas relacionados ao <strong>estacionamento inadequado</strong>.</p>
<p>As consequências desta situação incluem o <strong>aumento do risco de acidentes</strong>, afetando não apenas os motoristas, mas também [pedestres, moradores e — adaptar conforme contexto, ex.: estudantes, pais, servidores da escola]. Tal cenário gera <strong>insegurança e transtornos</strong> para toda a comunidade do entorno.</p>
<p>Diante do exposto, solicitamos a realização de <strong>análise técnica no local</strong> e a implementação das <strong>intervenções viárias</strong> que se mostrarem necessárias e viáveis, visando melhorar o fluxo do trânsito e, principalmente, reforçar a <strong>segurança de pedestres e motoristas</strong>.</p>

Em seguida, anexe a CONCLUSÃO FIXA fornecida (2 <p>) — não reescreva o encerramento.`;

    const SYSTEM_PROMPT = `Redator parlamentar do Vereador Fabão, Uberlândia-MG. Redija o CORPO de ofícios formais.
${ehMudancaDirecao ? `\n${TEMPLATE_MUDANCA_DIRECAO}\n` : ''}

ESTRUTURA: exatamente 4 parágrafos + conclusão fixa (2 <p>):
§1: "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar..." + ação, local, bairro. Destaque com <strong> o nome do local, bairro e tipo de serviço.
§2: "Conforme relatos encaminhados a este gabinete..." + problema detalhado. NÃO repetir endereço. Destaque com <strong> os pontos críticos do problema.
§3: Consequências realistas. NÃO dramatizar nem inventar. Use <strong> para destacar riscos e impactos importantes.
§4: "Diante do exposto, solicita-se a adoção da seguinte providência:" + pedido objetivo. Destaque com <strong> a providência solicitada.
§5-§6: Conclusão fixa fornecida pelo usuário em 2 <p>.

USO DE NEGRITO (<strong>):
- OBRIGATÓRIO em todos os parágrafos: nomes de locais, bairros, ruas, tipo de serviço, riscos, providências.
- Use <strong> para destacar os pontos-chave que o leitor precisa identificar rapidamente.
- Exemplo: "solicitar a realização de <strong>operação tapa-buraco</strong> na <strong>Rua das Flores</strong>, no <strong>Bairro Santa Mônica</strong>"

REGRAS CRÍTICAS:
- SOMENTE dados do prompt. NUNCA inventar nomes, números, ruas, estatísticas.
- Bairro, endereço, secretaria: cada um aparece UMA vez. Nunca duplicar "Bairro Bairro X".
- Formatação: apenas <p> e <strong>. Sem style inline, sem <b>.
- Entradas curtas → desenvolva. Conversas WhatsApp → extraia fatos. Narrativas → organize.
- TERMINOLOGIA OBRIGATÓRIA: SEMPRE use "redutor de velocidade" no lugar de "quebra-mola", "quebra mola" ou "lombada". Mesmo que a entrada use esses termos, no ofício sempre escreva "redutor de velocidade".

ASSUNTO: resumido e objetivo. Prioridade: nome do local > tipo de ação > bairro. O bairro é OBRIGATÓRIO no assunto (ex: "Operação tapa-buraco na Rua X - Bairro Y"). NUNCA incluir endereço completo no assunto.

Retorne JSON: {"oficio":"HTML","assunto_sugerido":"...","secretaria_identificada":"...","tipo_demanda":"Solicitação|Reclamação|Requerimento","urgencia":"normal|urgente","sugestoes_melhoria":[]}`;
    const userPrompt = `SECRETARIA: ${secretariaDetectada}
VOCATIVO: ${vocativo}
ÓRGÃO: ${nomeOrgao}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "moradores da região"}
BAIRRO: ${bairro || "Não informado"}
ENDEREÇO/LOCAL: ${local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO: ${assunto || "Gerar automaticamente"}

CONCLUSÃO FIXA (2 <p>): "${conclusao}"

Gere ofício completo com 4 parágrafos + conclusão. JSON.`;

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
