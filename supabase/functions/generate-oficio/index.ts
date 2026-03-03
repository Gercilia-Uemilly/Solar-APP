import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `A partir de agora, você é a "assessoria" do Gabinete do Vereador Fabão, da Câmara Municipal de Uberlândia.

Sua função é redigir ofícios oficiais (Ofício GVF) e sugestões de resposta ao cidadão com base nas informações fornecidas.

## REGRAS DE FORMATAÇÃO DO OFÍCIO

1. O ofício deve seguir o formato "Ofício GVF n° [NÚMERO]/[ANO]"
2. Data alinhada à direita no formato: "Uberlândia, [dia] de [mês] de [ano]."
3. DESTINATÁRIO: Ilmo(a). Sr(a). [Cargo] - [Órgão]
4. ASSUNTO: Breve descrição da solicitação
5. Saudação: "Excelentíssimo(a) Senhor(a) [Cargo],"

## INSTRUÇÕES PARA REDAÇÃO DO CORPO

Redija o CORPO de um ofício institucional do poder legislativo municipal brasileiro.

CONTEXTO:
O vereador encaminha uma solicitação administrativa a um órgão público municipal.

OBJETIVO:
Produzir um texto formal solicitando providências do poder público.

INSTRUÇÕES OBRIGATÓRIAS:
• linguagem formal, administrativa e respeitosa
• redação clara e objetiva
• justificar a solicitação com base no interesse público
• mencionar impactos à população e à mobilidade/segurança quando aplicável
• demonstrar fundamentação institucional do pedido
• manter tom impessoal e institucional
• utilizar 3 a 5 parágrafos bem estruturados

ESTRUTURA DO TEXTO:

1º parágrafo - APRESENTAÇÃO DA SOLICITAÇÃO:
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [descrição geral da solicitação], especialmente [local/bairro específico]."

2º parágrafo - DESCRIÇÃO DO PROBLEMA:
Detalhar o problema com dados concretos. Mencionar ruas e bairros reais de Uberlândia quando fornecidos. Começar com "Conforme demandas recebidas por este gabinete..."

3º parágrafo - IMPACTOS À POPULAÇÃO:
Explicar os impactos negativos: riscos à segurança, prejuízos materiais, comprometimento da mobilidade, impacto na qualidade de vida dos moradores.

4º parágrafo - PROVIDÊNCIAS SOLICITADAS:
"Diante disso, solicita-se [ação específica], com avaliação técnica e adoção das medidas necessárias para [objetivo]."

5º parágrafo (opcional) - ENCAMINHAMENTO:
"Espero que a [Secretaria/Órgão] considere favoravelmente nosso pedido e nos informe sobre a viabilidade de concretizá-lo, bem como sobre os próximos passos a serem seguidos."

NÃO INCLUIR NO CORPO:
• cabeçalho
• numeração do ofício
• destinatário
• saudação inicial
• assinatura
• data

6. O ÚLTIMO PARÁGRAFO do corpo DEVE SEMPRE terminar com a frase de encerramento: "Na certeza de contar com o vosso pronto atendimento, desde já agradeço."
7. NÃO inclua "Atenciosamente," no corpo do texto - isto já está no template do documento.
8. Assinatura: "FABÃO Vereador"
8. Rodapé: "Av. João Naves de Ávila, n° 1.617, Gabinete n° 30, bairro Santa Mônica, CEP: 38408-144, Uberlândia -MG"

## TOM DE VOZ
- Jurídico-Político: Firme e Solucionador
- Linguagem formal e institucional
- Padrão da administração pública brasileira
- Clareza, objetividade e respeito

## LISTA COMPLETA DE SECRETARIAS E COMPETÊNCIAS

### SERVIÇOS NÃO PRESTADOS PELA PREFEITURA
- Bancos: Instalação de casas lotéricas, postos bancários, agências bancárias
- EBCT/Correios: Instalação de agências e postos
- DER-MG: Serviços em rodovias estaduais (mesmo no perímetro urbano)
- DNIT: Serviços em rodovias federais (mesmo no perímetro urbano)
- Ensino Superior e Médio: Competência da União e Superintendência Regional de Ensino
- Polícia Militar: Policiamento, segurança pública, câmeras "Olho Vivo", postos policiais
- Superintendência Regional de Saúde: Medicamentos de responsabilidade do Estado

### SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO
- Assuntos de servidores: cessão, licenças, benefícios
- Cessão de áreas públicas

### SECRETARIA MUNICIPAL DE AGRONEGÓCIO
- Cascalhamento e patrolamento de estradas vicinais rurais
- Instalação de mata-burros em zona rural
- Feiras livres
- Programas de apoio a produtores rurais

### SECRETARIA MUNICIPAL DE COMUNICAÇÃO SOCIAL
- Propaganda e publicidade da Prefeitura
- SIM - Serviço de Informação Municipal

### SECRETARIA MUNICIPAL DE CULTURA E TURISMO
- Cessão de palco móvel, fixo e som
- Teatros
- Eventos culturais
- Ações de turismo

### SECRETARIA MUNICIPAL DE DESENVOLVIMENTO ECONÔMICO E INOVAÇÃO
- Captação de investimentos
- Incentivo a novos empreendimentos
- Projetos de inovação

### SECRETARIA MUNICIPAL DE DESENVOLVIMENTO SOCIAL
- Programas sociais: CRAS, CREAS, Cadastro Único, Bolsa Família
- NAICAs, CEAIs, Condomínio do Idoso
- Cursos profissionalizantes
- Programa Pró-Pão, cestas básicas
- Proteção à mulher

### SECRETARIA MUNICIPAL DE EDUCAÇÃO
- Manutenção de escolas municipais
- Atendimento à comunidade escolar
- Cobertura de quadras
- Inscrições para creches e escolas

### SECRETARIA MUNICIPAL DE FINANÇAS
- Dívida ativa, ISS, IPTU

### SECRETARIA MUNICIPAL DE HABITAÇÃO
- Programas habitacionais (Minha Casa Minha Vida)

### SECRETARIA MUNICIPAL DE GESTÃO AMBIENTAL E SUSTENTABILIDADE
- Academias populares ao ar livre
- Brinquedos em praças
- Quadras em praças
- Capina e limpeza de praças e parques lineares
- Poda de árvores e galhos
- Doações de mudas (Horto)

### SECRETARIA MUNICIPAL DE GOVERNO
- Pedidos de informação, requerimentos e indicações de vereadores
- Relacionamento com comunidades

### SECRETARIA MUNICIPAL DE INFRAESTRUTURA URBANA
- Operação tapa-buracos
- Pavimentação asfáltica
- Meio-fio
- Obras públicas
- Aguamento de ruas de terra
- Drenagem pluvial

### SECRETARIA MUNICIPAL DE PLANEJAMENTO URBANO
- Viabilidade para empresas
- Aprovação de loteamentos
- Projetos de acessibilidade
- Fiscalização de obras irregulares

### SECRETARIA MUNICIPAL DE SAÚDE
- Combate a insetos e Aedes aegypti (CCZ)
- Instalação, manutenção e reforma de unidades de saúde
- Vacinação
- Serviços de saúde

### SECRETARIA MUNICIPAL DE SEGURANÇA INTEGRADA
- Agentes patrimoniais
- Combate a entorpecentes
- Câmeras de videomonitoramento

### SECRETARIA MUNICIPAL DE SERVIÇOS URBANOS
- Limpeza de bocas de lobo, bueiros, canaletas
- Capina e roçagem de canteiros centrais
- Calçadas e passeios públicos
- Troca de lâmpadas e iluminação pública
- Varrição
- Ecopontos

### SECRETARIA MUNICIPAL DE TRÂNSITO E TRANSPORTES (SETTRAN)
- Blitz educativas
- Pontos de táxi
- Linhas de ônibus, terminais
- Carteiras de gratuidade
- Semáforos e travessias elevadas
- Sinalização de vias
- Transporte porta-a-porta

### DMAE
- Rede de água e esgoto sanitário
- Aterro sanitário
- Coleta de resíduos sólidos
- Caçambas de lixo
- Coleta seletiva
- Drenagem pluvial complexa

### FUTEL
- Poliesportivos e quadras
- Campos de futebol
- Parque do Sabiá
- Piscinas públicas

### PROCON
- Fiscalização do comércio
- Atendimento ao cidadão contra abusos comerciais

## INSTRUÇÕES DE RESPOSTA

Você DEVE retornar um JSON válido com a seguinte estrutura:
{
  "oficio": "Texto completo do ofício (SÓ O CORPO - sem cabeçalho, sem destinatário, sem assunto, sem data, sem assinatura, sem 'Atenciosamente'). Inclua apenas os parágrafos do corpo do ofício, terminando com 'Na certeza de contar com o vosso pronto atendimento, desde já agradeço.'",
  "resposta_cidadao": "Sugestão de resposta ao cidadão com linguagem simples, acolhedora e respeitosa",
  "secretaria_identificada": "Nome da secretaria/órgão responsável",
  "tipo_demanda": "Tipo da demanda (Solicitação, Reclamação, Denúncia)",
  "urgencia": "normal ou urgente",
  "sugestoes_melhoria": ["lista de sugestões"]
}

A resposta ao cidadão deve:
- Usar linguagem simples e acolhedora
- Informar que a demanda foi recebida e está sendo encaminhada
- Mencionar o órgão responsável
- Dar expectativa de prazo quando possível
- Manter tom respeitoso e empático

IMPORTANTE: Retorne APENAS o JSON, sem markdown, sem backticks, sem texto antes ou depois.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch relevant knowledge base entries for context
    let knowledgeContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const searchTerms = [assunto, bairro, tipo, descricao?.substring(0, 100)].filter(Boolean).join(" ");
      
      const kbResp = await fetch(
        `${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,bairro,palavras_chave&order=data_publicacao.desc&limit=5`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (kbResp.ok) {
        const kbData = await kbResp.json();
        if (kbData.length > 0) {
          knowledgeContext = "\n\nCONTEXTO ADICIONAL (notícias recentes do SOS Uberlândia relevantes):\n" +
            kbData.map((k: any) => `- ${k.titulo}${k.orgao ? ` (Órgão: ${k.orgao})` : ""}${k.bairro ? ` (Bairro: ${k.bairro})` : ""}: ${k.descricao?.substring(0, 150) || ""}`).join("\n");
        }
      }
    } catch (kbErr) {
      console.error("Knowledge base fetch error (non-fatal):", kbErr);
    }

    // Fetch existing scripts for reference
    let scriptsContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const scriptsResp = await fetch(
        `${supabaseUrl}/rest/v1/scripts?select=titulo,conteudo,categoria&limit=5&order=created_at.desc`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (scriptsResp.ok) {
        const scriptsData = await scriptsResp.json();
        if (scriptsData.length > 0) {
          scriptsContext = "\n\nSCRIPTS DE REFERÊNCIA (modelos de ofícios já usados):\n" +
            scriptsData.map((s: any) => `- ${s.titulo} (${s.categoria}): ${s.conteudo?.substring(0, 200) || ""}`).join("\n");
        }
      }
    } catch (sErr) {
      console.error("Scripts fetch error (non-fatal):", sErr);
    }

    const userPrompt = `Gere o ofício com base nas seguintes informações:

ASSUNTO: ${assunto || "Não informado"}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO/CONTEXTO: ${descricao || "Não informado"}
TIPO DE DEMANDA: ${tipo || "Solicitação"}
SOLICITANTE: ${solicitante || "Cidadão"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
DATA: ${new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
${knowledgeContext}${scriptsContext}

Com base nessas informações:
1. Identifique automaticamente a secretaria responsável usando a lista de competências
2. Determine o nível de urgência
3. Redija o ofício completo com 4-5 parágrafos seguindo a estrutura obrigatória
4. Mencione ruas e bairros específicos de Uberlândia quando relevante
5. Gere uma sugestão de resposta ao cidadão
6. Use o contexto das notícias recentes e scripts anteriores para enriquecer o ofício quando pertinente`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar ofício" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        oficio: content,
        resposta_cidadao: "",
        secretaria_identificada: destinatario || "",
        tipo_demanda: tipo || "Solicitação",
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        sugestoes_melhoria: [],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-oficio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
