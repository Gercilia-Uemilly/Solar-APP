import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECRETARIA_MAP: Record<string, string[]> = {
  "Serviços Urbanos": ["capina","roçagem","limpeza","poda","árvore","iluminação","poste","lâmpada","coleta","lixo","entulho","bueiro","calçada","praça","parque","buraco","tapa-buraco","tapa buraco","asfalto","pavimentação","recapeamento"],
  "Infraestrutura": ["erosão","obra","ponte","viaduto","estrada"],
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
  'PMMG': 'Senhor(a) Comandante,',
  'CEMIG': 'Prezado(a) Senhor(a),',
  'PROCON': 'Excelentíssimo(a) Senhor(a) Superintendente,',
  'HC/UFU': 'Prezados(as) Senhores(as),',
  'Hospital de Clínicas da Universidade Federal de Uberlândia': 'Prezados(as) Senhores(as),',
  'DER-MG': 'Prezado(a) Senhor(a) Coordenador(a),',
  'DNIT': 'Prezado(a) Senhor(a),',
  'Departamento Nacional de Infraestrutura de Transportes': 'Prezado(a) Senhor(a),',
  'Superintendência Regional de Saúde': 'Excelentíssimo(a) Senhor(a) Superintendente,',
  'Superintendência Regional de Ensino': 'Senhor(a) Diretor(a),',
  'MPMG': 'Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,',
  'Ministério Público de Minas Gerais': 'Excelentíssimo(a) Senhor(a) Promotor(a) de Justiça,',
  'Gabinete do Prefeito': 'Excelentíssimo Senhor Prefeito,',
  'Prefeitura': 'Excelentíssimo Senhor Prefeito,',
  'Câmara Municipal': 'Excelentíssimo(a) Senhor(a) Vereador(a),',
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
    'Gestão Ambiental e Sustentabilidade': 'Secretaria Municipal de Gestão Ambiental e Sustentabilidade',
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
  // If the name already represents a non-secretaria public organ, return as-is
  // (avoid prefixing "Secretaria Municipal de" to Hospital, CEMIG, DMAE etc.)
  const nonSecretariaPrefixes = [
    'Hospital', 'Departamento', 'Companhia', 'Polícia', 'Policia',
    'Agência', 'Agencia', 'Fundação', 'Fundacao', 'Instituto', 'Empresa',
    'Conservatório', 'Conservatorio', 'Câmara', 'Camara', 'Gabinete',
    'Prefeitura', 'Ministério', 'Ministerio', 'Superintendência', 'Superintendencia',
    'Batalhão', 'Batalhao', 'Processamento', 'PROCON', 'DNIT', 'DER',
    'CEMIG', 'HC/UFU', 'PMMG', 'ARESAN', 'DMAE', 'FUTEL', 'IPREMU',
    'EMAM', 'FERUB', 'PRODAUB', 'MPMG', 'Universidade'
  ];
  if (cleanName && nonSecretariaPrefixes.some(p => cleanName.startsWith(p))) {
    return cleanName;
  }
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
    // Auth: require valid Supabase JWT (operador autenticado) OU service role (chamadas internas, ex.: auto-generate-oficio-whatsapp)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRole || token !== serviceRole) {
      const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user: _u } } = await _sb.auth.getUser();
      if (!_u) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    // ═══════════════════════════════════════════════════
    // VALIDAÇÃO DE ENTRADA OBRIGATÓRIA
    // Não gerar ofício sem texto/comando válido.
    // ═══════════════════════════════════════════════════
    const descricaoLimpa = (descricao || "").trim();
    if (descricaoLimpa.length < 10) {
      return new Response(
        JSON.stringify({
          error:
            "Entrada inválida. Informe um texto institucional pronto ou um comando direto descrevendo a demanda (mínimo 10 caracteres).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textoCompleto = `${descricao || ""} ${assunto || ""} ${bairro || ""} ${local || ""}`;

    // ═══════════════════════════════════════════════════
    // EXTRAÇÃO DE NÚMERO DE LOGRADOURO
    // Busca padrões "nº 123", "n. 123", "número 123" ou "Rua X, 123" no campo
    // local + descrição para garantir que a IA preserve o número exato.
    // ═══════════════════════════════════════════════════
    function extrairNumeroLogradouro(texto: string): string | null {
      if (!texto) return null;
      // Padrões: "nº 123", "n° 123", "n. 123", "numero 123", "número 123"
      const m1 = texto.match(/n[º°o\.]\s*(\d{1,6})/i);
      if (m1) return m1[1];
      // Padrão "Rua/Av/Avenida/Travessa NOME, 123"
      const m2 = texto.match(/(?:rua|av\.?|avenida|travessa|alameda|praça|estrada|rodovia)[^,]{2,80},\s*(\d{1,6})\b/i);
      if (m2) return m2[1];
      return null;
    }
    const numeroLogradouro = extrairNumeroLogradouro(`${local || ""} ${descricao || ""}`);

    // ═══════════════════════════════════════════════════
    // EXTRAÇÃO DE DATAS (para validação pós-geração)
    // Padrões suportados: "DD de mês [de AAAA]" e "DD/MM[/AAAA]".
    // Cada data é normalizada em "DD/MM" (+ ano quando presente) para
    // comparar o que a IA gerou com o que existe no texto original.
    // ═══════════════════════════════════════════════════
    const MESES_PT: Record<string, string> = {
      janeiro: "01", fevereiro: "02", "março": "03", marco: "03",
      abril: "04", maio: "05", junho: "06", julho: "07",
      agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12",
    };
    function extrairDatas(texto: string): Set<string> {
      const out = new Set<string>();
      if (!texto) return out;
      const limpo = texto.replace(/<[^>]+>/g, " ");
      // "DD de mês [de AAAA]"
      const re1 = /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?\b/gi;
      let m: RegExpExecArray | null;
      while ((m = re1.exec(limpo)) !== null) {
        const dia = m[1].padStart(2, "0");
        const mes = MESES_PT[m[2].toLowerCase()] || "";
        if (mes) {
          out.add(m[3] ? `${dia}/${mes}/${m[3]}` : `${dia}/${mes}`);
        }
      }
      // "DD/MM[/AAAA]" ou "DD-MM[-AAAA]"
      const re2 = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g;
      while ((m = re2.exec(limpo)) !== null) {
        const dia = m[1].padStart(2, "0");
        const mes = m[2].padStart(2, "0");
        if (Number(dia) < 1 || Number(dia) > 31) continue;
        if (Number(mes) < 1 || Number(mes) > 12) continue;
        let ano = m[3];
        if (ano && ano.length === 2) ano = (Number(ano) > 50 ? "19" : "20") + ano;
        out.add(ano ? `${dia}/${mes}/${ano}` : `${dia}/${mes}`);
      }
      return out;
    }
    function datasDivergentes(orig: Set<string>, geradas: Set<string>): string[] {
      const divergencias: string[] = [];
      // Índice das datas do original ignorando o ano (para comparar "DD/MM").
      const origDM = new Set<string>();
      for (const d of orig) origDM.add(d.split("/").slice(0, 2).join("/"));
      for (const g of geradas) {
        const dm = g.split("/").slice(0, 2).join("/");
        if (!origDM.has(dm)) divergencias.push(g);
      }
      return divergencias;
    }
    const datasOriginais = extrairDatas(`${descricao || ""} ${assunto || ""} ${local || ""}`);

    const tipoNormalizado = typeof tipo === "string" ? tipo.trim() : "";
    const tipoValidoComoSecretaria = tipoNormalizado && !["solicitação", "reclamação", "requerimento"].includes(tipoNormalizado.toLowerCase());
    const secretariaDetectada = (tipoValidoComoSecretaria ? tipoNormalizado : "") || detectSecretaria(textoCompleto) || "Serviços Urbanos";
    const nomeOrgao = getNomeOrgaoForSecretaria(secretariaDetectada);
    const vocativo = getVocativoForSecretaria(secretariaDetectada);
    // "do" for masculine nouns; "da" for feminine
    const masculineStarts = ['Departamento', 'Instituto', 'PROCON', 'Ministério', 'Batalhão', 'Hospital', 'Processamento', 'DNIT'];
    const artigo = masculineStarts.some(p => nomeOrgao.startsWith(p)) ? 'o' : 'a';
    // Conclusão fixa padronizada (parte estática que segue ao §4) — encaminhamento + agradecimento
    const conclusaoEncaminhamento = `Assim, encaminha-se o presente para apreciação d${artigo} ${nomeOrgao}, solicitando-se a análise do pleito e a manifestação quanto à sua viabilidade, bem como a indicação de eventual previsão para execução do serviço.\n\nNa certeza de contar com o vosso pronto atendimento, desde já agradeço.`;

    const ehMudancaDirecao = isMudancaDirecaoRua(textoCompleto);

    const TEMPLATE_MUDANCA_DIRECAO = `MODELO OBRIGATÓRIO PARA PEDIDOS DE MUDANÇA DE DIREÇÃO/SENTIDO DE RUA:
Use EXATAMENTE a estrutura abaixo, adaptando APENAS o nome da rua, bairro e ponto de referência (ex.: escola, comércio) com base nos dados fornecidos. NÃO altere o tom, a ordem dos parágrafos nem invente fatos. Mantenha <strong> nos locais e pontos críticos.

<p>Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar a realização de estudos técnicos e a adoção de medidas viárias cabíveis na <strong>[NOME DA RUA/VIA]</strong>, localizada no <strong>Bairro [NOME DO BAIRRO]</strong>[, em frente à <strong>[PONTO DE REFERÊNCIA]</strong> — incluir somente se houver].</p>
<p>Conforme relatos encaminhados a este gabinete, o tráfego na referida via tem causado <strong>transtornos significativos</strong>[, especialmente nos horários de entrada e saída dos alunos — incluir somente se houver escola/creche]. A atual configuração do local tem resultado em <strong>congestionamentos frequentes</strong>, dificuldades para a <strong>travessia segura de pedestres</strong> e problemas relacionados ao <strong>estacionamento inadequado</strong>.</p>
<p>As consequências desta situação incluem o <strong>aumento do risco de acidentes</strong>, afetando não apenas os motoristas, mas também [pedestres, moradores e — adaptar conforme contexto, ex.: estudantes, pais, servidores da escola]. Tal cenário gera <strong>insegurança e transtornos</strong> para toda a comunidade do entorno.</p>
<p>Diante do exposto, solicitamos a realização de <strong>análise técnica no local</strong> e a implementação das <strong>intervenções viárias</strong> que se mostrarem necessárias e viáveis, visando melhorar o fluxo do trânsito e, principalmente, reforçar a <strong>segurança de pedestres e motoristas</strong>.</p>

Em seguida, anexe a CONCLUSÃO FIXA fornecida (2 <p>) — não reescreva o encerramento.`;

    const SYSTEM_PROMPT = `Redator parlamentar institucional do Vereador Fabão, Uberlândia-MG.
Sua função: TRANSFORMAR o conteúdo recebido (mesmo que esteja incompleto, mal escrito, coloquial, em formato de comando ou desorganizado) em um ofício formal de alta qualidade.
${ehMudancaDirecao ? `\n${TEMPLATE_MUDANCA_DIRECAO}\n` : ''}

═══ REGRAS CRÍTICAS NÃO NEGOCIÁVEIS ═══
1. NUNCA usar linguagem coloquial, gírias ou tom de conversa.
2. NUNCA copiar frases literais do usuário — sempre reescrever em linguagem institucional.
3. NUNCA mencionar o solicitante (não citar nome, "morador X disse", "a senhora fulana", etc).
4. NUNCA repetir bairro, endereço ou logradouro — cada informação aparece UMA ÚNICA vez, somente no §1.
5. NUNCA inventar dados, nomes, números de casa, estatísticas, datas ou fatos não fornecidos. Se algo não foi mencionado no CONTEÚDO RECEBIDO ou nos campos estruturados, NÃO ESCREVA. Prefira omitir a inventar.
6. NUNCA fugir da estrutura de 4 parágrafos.
7. NUNCA alterar o texto da conclusão fixa fornecida.
8. SEMPRE use "redutor de velocidade" no lugar de "quebra-mola", "quebra mola" ou "lombada".
9. PRESERVE LITERALMENTE números de logradouro (nº/número da casa). Se o endereço informado contiver "nº 1234" ou ", 1234", esse número DEVE aparecer EXATAMENTE igual no §1, no formato "nº 1234". NUNCA arredonde, omita ou altere o número.
10. PRESERVE LITERALMENTE nomes de ruas, bairros e pontos de referência fornecidos. Não traduza, não abrevie, não complete com palavras adicionais.
11. NUNCA mude o TEMA/ASSUNTO do CONTEÚDO RECEBIDO. Se o operador descreveu "acidente de trânsito", o ofício trata de acidente de trânsito — não de travessia de pedestres, fluxo intenso, semáforo, iluminação ou qualquer outro tema que NÃO tenha sido citado. É PROIBIDO substituir o problema descrito por um problema "parecido" do mesmo bairro/rua.
12. NUNCA acrescente causas, agravantes, estatísticas ("fluxo alto", "horário de pico", "grande número de pedestres", "escolas próximas", "idosos", "crianças") que NÃO estejam explicitamente no CONTEÚDO RECEBIDO.
13. Se o CONTEÚDO RECEBIDO for curto ou pouco detalhado, escreva um ofício também curto e fiel — NUNCA preencha espaço com fatos inventados.

═══ ESTRUTURA OBRIGATÓRIA — EXATAMENTE 4 PARÁGRAFOS + CONCLUSÃO FIXA ═══
§1 (INTRODUÇÃO COM SOLICITAÇÃO): Iniciar com "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar...". Citar a ação, o local (rua + número quando informado) e o bairro UMA ÚNICA VEZ. Quando houver número de logradouro, escreva no formato "Rua XXX, nº NNNN". Destacar com <strong> o tipo de serviço, a rua (com número) e o bairro.
§2 (RELATO): Iniciar OBRIGATORIAMENTE com "Conforme relatos encaminhados a este gabinete,...". Descrever o problema de forma objetiva e institucional. NÃO repetir o endereço nem o bairro. Destacar com <strong> os pontos críticos.
§3 (CONSEQUÊNCIAS): Descrever consequências realistas e proporcionais — sem dramatizar, sem inventar. Destacar com <strong> os riscos e impactos relevantes. NÃO repetir endereço/bairro.
§4 (SOLICITAÇÃO FORMAL — PRIMEIRO PARÁGRAFO DA CONCLUSÃO FIXA): Escrever EXATAMENTE no formato: "Diante do exposto, solicita-se a adoção da seguinte providência: <strong>[AÇÃO ESPECÍFICA EXTRAÍDA DO CONTEXTO]</strong>, a fim de garantir <strong>[FINALIDADE PERTINENTE]</strong>." Substituir [AÇÃO ESPECÍFICA] e [FINALIDADE] com base no contexto fornecido. NÃO repetir endereço/bairro.
§5 e §6 (ENCAMINHAMENTO + AGRADECIMENTO): Reproduzir LITERALMENTE, sem qualquer alteração, os 2 parágrafos fornecidos no campo "ENCAMINHAMENTO FIXO" do prompt do usuário.

═══ USO DE NEGRITO (<strong>) ═══
Obrigatório nos §1, §2, §3 e §4 para destacar: tipo de serviço, rua/local, bairro, riscos, providência solicitada e finalidade.

═══ FORMATAÇÃO ═══
Apenas tags <p> e <strong>. Sem style inline, sem <b>, sem <div>, sem listas. Cada parágrafo é um <p>.

═══ ASSUNTO ═══
Resumido e objetivo. Prioridade: tipo de ação > rua > bairro. Inclua o bairro APENAS se ele tiver sido informado. NUNCA incluir endereço completo no assunto.
PROIBIDO escrever "Bairro não informado", "bairro a definir", "[BAIRRO]" ou qualquer marcador equivalente — no assunto OU no corpo. Se o bairro não foi informado, simplesmente OMITA a menção ao bairro em todo o documento.

═══ FIDELIDADE ÀS INFORMAÇÕES RECEBIDAS ═══
Todas as informações concretas presentes no CONTEÚDO RECEBIDO (locais, datas, números, nomes, pedidos, queixas) DEVEM aparecer no ofício. É PROIBIDO descartar a informação principal do relato para deixar o texto mais curto ou mais elegante. Antes de finalizar, confira mentalmente item por item do conteúdo recebido e garanta que nenhum foi omitido.

═══ TRATAMENTO DE ENTRADAS RUINS ═══
Se a entrada for curta, confusa, coloquial ou em formato de comando: interpretar a intenção, completar de forma coerente e reescrever em linguagem institucional formal. Nunca reproduzir texto original como está.
ATENÇÃO: "completar de forma coerente" significa preencher conectivos institucionais — NÃO significa inventar dados factuais (números, datas, nomes, quantidades, horários). Se um dado factual não foi fornecido, simplesmente não cite.

RETORNE APENAS JSON VÁLIDO: {"oficio":"HTML","assunto_sugerido":"...","secretaria_identificada":"...","tipo_demanda":"Solicitação|Reclamação|Requerimento","urgencia":"normal|urgente","sugestoes_melhoria":[]}`;

    const userPrompt = `SECRETARIA: ${secretariaDetectada}
VOCATIVO: ${vocativo}
ÓRGÃO: ${nomeOrgao}
DESTINATÁRIO: ${destinatario || "A identificar"}
CONTEÚDO RECEBIDO (texto institucional ou comando do operador): ${descricaoLimpa}
${bairro ? `BAIRRO: ${bairro}` : `BAIRRO: não informado — NÃO citar bairro em lugar nenhum, NÃO escrever "Bairro não informado"`}
${local ? `ENDEREÇO/LOCAL: ${local}` : `ENDEREÇO/LOCAL: não informado — NÃO inventar endereço`}
${numeroLogradouro ? `NÚMERO DO LOGRADOURO (OBRIGATÓRIO usar EXATAMENTE este valor no §1, no formato "nº ${numeroLogradouro}"): ${numeroLogradouro}` : "NÚMERO DO LOGRADOURO: não informado — NÃO inventar"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO: ${assunto || "Gerar automaticamente"}

ENCAMINHAMENTO FIXO (use LITERALMENTE como §5 e §6, em 2 tags <p> separadas): "${conclusaoEncaminhamento}"

Gere o ofício completo com EXATAMENTE 4 parágrafos institucionais + 2 parágrafos do encaminhamento fixo. NÃO mencione solicitante. NÃO repita bairro/endereço fora do §1. NÃO invente dados não fornecidos. ${numeroLogradouro ? `O número "${numeroLogradouro}" DEVE aparecer no §1.` : ""} Retorne apenas JSON válido.`;

    const { systemInstruction, messages } = toGeminiMessages(SYSTEM_PROMPT, userPrompt);
    // gpt-5.5: modelo mais atual, reduz alucinação e melhora fidelidade ao CONTEÚDO RECEBIDO.
    let result = await callGemini({ model: "gpt-5.5", systemInstruction, messages });

    if (!result.text || result.text.trim().length < 20) {
      console.error("IA retornou resposta vazia. Raw:", JSON.stringify(result.raw)?.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "A IA não retornou conteúdo. Tente novamente em instantes." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed: any;
    const cleaned = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback robusto: extrai os campos via regex para evitar que o JSON cru vaze no conteúdo do ofício.
      const oficioMatch = cleaned.match(/"oficio"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const assuntoMatch = cleaned.match(/"assunto_sugerido"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const secMatch = cleaned.match(/"secretaria_identificada"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const tipoMatch = cleaned.match(/"tipo_demanda"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const urgMatch = cleaned.match(/"urgencia"\s*:\s*"((?:\\.|[^"\\])*)"/);
      const unescape = (s: string) => s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
      parsed = {
        oficio: oficioMatch ? unescape(oficioMatch[1]) : cleaned.replace(/^\{.*?"oficio"\s*:\s*"/s, "").replace(/",\s*"assunto_sugerido".*$/s, ""),
        assunto_sugerido: assuntoMatch ? unescape(assuntoMatch[1]) : "",
        secretaria_identificada: secMatch ? unescape(secMatch[1]) : secretariaDetectada,
        tipo_demanda: tipoMatch ? unescape(tipoMatch[1]) : "Solicitação",
        urgencia: urgMatch ? unescape(urgMatch[1]) : (prioridade === "Urgente" ? "urgente" : "normal"),
        sugestoes_melhoria: [],
      };
    }

    // Sanitiza: se o oficio ainda contém vestígios do JSON ({"oficio": ou ,"assunto_sugerido"), limpa.
    if (typeof parsed.oficio === "string") {
      parsed.oficio = parsed.oficio
        .replace(/^\s*\{\s*"oficio"\s*:\s*"/, "")
        .replace(/"\s*,\s*"assunto_sugerido"[\s\S]*$/, "")
        .replace(/,?\s*"assunto_sugerido"[\s\S]*$/, "")
        .replace(/,?\s*"secretaria_identificada"[\s\S]*$/, "")
        .replace(/,?\s*"tipo_demanda"[\s\S]*$/, "")
        .replace(/,?\s*"urgencia"[\s\S]*$/, "")
        .replace(/,?\s*"sugestoes_melhoria"[\s\S]*$/, "")
        .replace(/\}\s*$/, "");
      // Remove qualquer cauda solta tipo: ","  ou  "} ao final
      parsed.oficio = parsed.oficio.replace(/["}\s,]+$/g, "").trim();
    }

    if (!parsed.secretaria_identificada && secretariaDetectada) {
      parsed.secretaria_identificada = secretariaDetectada;
    }

    // ═══════════════════════════════════════════════════
    // VALIDAÇÃO PÓS-GERAÇÃO: número do logradouro foi preservado?
    // Se o usuário informou um número e a IA o omitiu, injeta no §1.
    // ═══════════════════════════════════════════════════
    if (numeroLogradouro && typeof parsed.oficio === "string" && !parsed.oficio.includes(numeroLogradouro)) {
      console.warn(`[generate-oficio] IA omitiu número "${numeroLogradouro}". Injetando no §1.`);
      parsed.oficio = parsed.oficio.replace(
        /(<strong>[^<]*?(?:Rua|Avenida|Av\.|Travessa|Alameda|Praça|Estrada|Rodovia)[^<]*?)(<\/strong>)/i,
        `$1, nº ${numeroLogradouro}$2`
      );
      // Fallback: se o regex acima não casou, anexa aviso visível
      if (!parsed.oficio.includes(numeroLogradouro)) {
        parsed.sugestoes_melhoria = parsed.sugestoes_melhoria || [];
        parsed.sugestoes_melhoria.push(`⚠️ O número "${numeroLogradouro}" do logradouro não foi incluído pela IA. Adicione manualmente no §1.`);
      }
    }

    // ═══════════════════════════════════════════════════
    // VALIDAÇÃO PÓS-GERAÇÃO: DATAS
    // Se a IA gerou alguma data (DD/MM ou "DD de mês") que NÃO existe no texto
    // original, regenera UMA vez usando o texto de referência como fonte única
    // de verdade. Se ainda assim divergir, registra aviso em sugestoes_melhoria.
    // ═══════════════════════════════════════════════════
    if (typeof parsed.oficio === "string" && datasOriginais.size >= 0) {
      const datasGeradas = extrairDatas(parsed.oficio);
      const divergentes = datasDivergentes(datasOriginais, datasGeradas);
      if (divergentes.length > 0) {
        console.warn(`[generate-oficio] Datas divergentes detectadas: ${JSON.stringify(divergentes)}. Datas no original: ${JSON.stringify([...datasOriginais])}. Regenerando...`);
        const datasListadas = [...datasOriginais].join(", ") || "(nenhuma data explícita informada)";
        const reforcoPrompt = `${userPrompt}

═══ ATENÇÃO — CORREÇÃO OBRIGATÓRIA DE DATAS ═══
Na geração anterior você inseriu a(s) data(s) ${divergentes.join(", ")} que NÃO existe(m) no CONTEÚDO RECEBIDO.
O CONTEÚDO RECEBIDO é a ÚNICA FONTE DE VERDADE.
Datas encontradas no original: ${datasListadas}.
Regras:
- Use SOMENTE datas literalmente presentes no CONTEÚDO RECEBIDO.
- NUNCA altere dia, mês ou ano (ex.: "02 de dezembro" jamais pode virar "02 de novembro").
- Se nenhuma data for necessária ao entendimento, OMITA a data — não invente.
Regenere o ofício respeitando estas regras.`;
        const retry = toGeminiMessages(SYSTEM_PROMPT, reforcoPrompt);
        try {
          const result2 = await callGemini({ model: "gpt-5.5", systemInstruction: retry.systemInstruction, messages: retry.messages });
          const cleaned2 = (result2.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
          let parsed2: any;
          try { parsed2 = JSON.parse(cleaned2); } catch { parsed2 = null; }
          if (parsed2?.oficio && typeof parsed2.oficio === "string") {
            parsed2.oficio = parsed2.oficio
              .replace(/^\s*\{\s*"oficio"\s*:\s*"/, "")
              .replace(/["}\s,]+$/g, "")
              .trim();
            const divergentes2 = datasDivergentes(datasOriginais, extrairDatas(parsed2.oficio));
            if (divergentes2.length === 0) {
              parsed = { ...parsed, ...parsed2 };
            } else {
              parsed.sugestoes_melhoria = parsed.sugestoes_melhoria || [];
              parsed.sugestoes_melhoria.push(`⚠️ Datas possivelmente divergentes do original: ${divergentes2.join(", ")}. Confira antes de enviar.`);
            }
          }
        } catch (e) {
          console.error("[generate-oficio] Falha ao regenerar por divergência de datas:", e);
          parsed.sugestoes_melhoria = parsed.sugestoes_melhoria || [];
          parsed.sugestoes_melhoria.push(`⚠️ Datas possivelmente divergentes do original: ${divergentes.join(", ")}. Confira antes de enviar.`);
        }
      }
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
