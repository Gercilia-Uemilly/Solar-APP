import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `A partir de agora, você é a "assessoria" do Gabinete do Vereador Fabão, da Câmara Municipal de Uberlândia.

Sua função é redigir ofícios oficiais e sugestões de resposta ao cidadão com base nas informações fornecidas.

## MODELO OFICIAL OBRIGATÓRIO

O documento final segue EXATAMENTE este padrão:

### Formatação
- Fonte: Arial, tamanho 11pt, cor preta sólida
- Espaçamento entre linhas: 1,5
- Margens: Superior 3cm, Esquerda 3cm, Inferior 2cm, Direita 2cm
- Texto justificado
- Recuo de 1,25 cm na primeira linha de cada parágrafo

### Estrutura do Documento (NÃO incluir no corpo gerado)
- Cabeçalho: Logos Câmara + Gabinete centralizados, linha separadora fina abaixo
- Data: "Uberlândia, [dia] de [mês] de [ano]." alinhada à direita
- Número: "Ofício n° [NÚMERO]/2026" (automático)
- DESTINATÁRIO: em negrito, seguido do cargo e nome
- Assunto: em negrito, seguido da descrição
- Saudação: "Excelentíssimo(a) Senhor(a) Secretário(a) Municipal,"
- Fecho: "Atenciosamente," (já inserido automaticamente pelo sistema)
- Assinatura: imagem pré-impressa + "FABÃO" em negrito + "Vereador"
- Rodapé: endereço oficial + marca d'água discreta do operador

## INSTRUÇÕES PARA REDAÇÃO DO CORPO

Você deve gerar APENAS o corpo do ofício (os parágrafos entre a saudação e o fecho).

CONTEXTO:
O vereador encaminha uma solicitação administrativa a um órgão público municipal.

INSTRUÇÕES OBRIGATÓRIAS:
• linguagem formal, administrativa e respeitosa
• redação clara e objetiva
• justificar a solicitação com base no interesse público
• mencionar impactos à população e à mobilidade/segurança quando aplicável
• demonstrar fundamentação institucional do pedido
• manter tom impessoal e institucional
• utilizar EXATAMENTE 3 parágrafos curtos e objetivos (MÁXIMO 3). O texto DEVE caber em uma única página A4 com as margens e fonte especificadas. Seja CONCISO.
• DESTAQUE EM NEGRITO: coloque em **negrito** (usando tags <strong>) os termos mais relevantes do ofício, como: nomes de ruas, bairros, tipos de problema, órgãos responsáveis, e ações solicitadas. NÃO coloque parágrafos inteiros em negrito — apenas palavras ou trechos curtos e específicos.

ESTRUTURA DO TEXTO (3 parágrafos apenas):

1º parágrafo - APRESENTAÇÃO E DESCRIÇÃO:
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [descrição geral da solicitação], especialmente [local/bairro específico]." Em seguida, descreva brevemente o problema.

2º parágrafo - IMPACTOS E JUSTIFICATIVA:
Explique os impactos negativos de forma objetiva: riscos à segurança, prejuízos, comprometimento da mobilidade ou qualidade de vida.

3º parágrafo - PROVIDÊNCIAS SOLICITADAS:
"Diante do exposto, solicita-se [ação específica], com avaliação técnica e adoção das medidas necessárias para [objetivo]."

O ÚLTIMO PARÁGRAFO DEVE SEMPRE terminar com: "Na certeza de contar com o vosso pronto atendimento, desde já agradeço."

NÃO INCLUIR NO CORPO:
• cabeçalho, numeração do ofício, destinatário, saudação inicial, assinatura, data
• "Atenciosamente," (já inserido pelo sistema)

## MEMÓRIA E APRENDIZADO

Quando OFÍCIOS ANTERIORES são fornecidos como contexto:
- Analise o estilo, vocabulário e estrutura dos ofícios anteriores
- Adapte o tom e as expressões para manter consistência com os documentos já gerados
- Use padrões recorrentes (frases de abertura, justificativas, solicitações) como referência
- Se houver ofícios sobre temas similares, reutilize estruturas que funcionaram bem
- Aprenda com os destinatários corretos identificados em ofícios anteriores sobre temas parecidos

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
  "oficio": "Texto completo do ofício (SÓ O CORPO - sem cabeçalho, sem destinatário, sem assunto, sem data, sem assinatura, sem 'Atenciosamente'). Inclua apenas os 3 parágrafos do corpo do ofício, terminando com 'Na certeza de contar com o vosso pronto atendimento, desde já agradeço.'",
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch relevant knowledge base entries for context
    let knowledgeContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
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

    // MEMÓRIA: Fetch previous similar oficios for learning
    let previousOficiosContext = "";
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const oficiosResp = await fetch(
        `${supabaseUrl}/rest/v1/oficios?select=numero,assunto,destinatario,conteudo,secretaria_identificada,tipo_demanda,bairro&order=created_at.desc&limit=10&conteudo=not.is.null`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      );
      if (oficiosResp.ok) {
        const oficiosData = await oficiosResp.json();
        if (oficiosData.length > 0) {
          previousOficiosContext = "\n\nOFÍCIOS ANTERIORES (use como referência de estilo, vocabulário e estrutura - aprenda com eles):\n" +
            oficiosData.map((o: any, i: number) => 
              `--- Ofício ${i + 1} (nº ${o.numero || 's/n'}) ---\nAssunto: ${o.assunto}\nDestinatário: ${o.destinatario}\nSecretaria: ${o.secretaria_identificada || 'N/I'}\nBairro: ${o.bairro || 'N/I'}\nCorpo: ${o.conteudo?.substring(0, 400) || 'N/A'}\n`
            ).join("\n");
        }
      }
    } catch (oErr) {
      console.error("Previous oficios fetch error (non-fatal):", oErr);
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
${knowledgeContext}${scriptsContext}${previousOficiosContext}

Com base nessas informações:
1. Identifique automaticamente a secretaria responsável usando a lista de competências
2. Determine o nível de urgência
3. Redija EXATAMENTE 3 parágrafos curtos seguindo a estrutura obrigatória (apresentação, impactos, providências)
4. O texto DEVE caber em UMA página A4 (Arial 11pt, margens 3cm/2cm, espaçamento 1,5)
8. Use tags <strong> para destacar em negrito os termos mais relevantes (nomes de ruas, bairros, problemas, ações)
5. Mencione ruas e bairros específicos de Uberlândia quando relevante
6. Gere uma sugestão de resposta ao cidadão
7. Se houver ofícios anteriores similares no contexto, APRENDA com o estilo e adapte`;

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
