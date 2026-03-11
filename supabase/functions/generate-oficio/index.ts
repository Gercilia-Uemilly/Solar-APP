import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um redator parlamentar experiente da assessoria do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia. Sua especialidade é redigir ofícios oficiais de alta qualidade técnica e institucional.

## MODELO OFICIAL OBRIGATÓRIO

### Formatação
- Fonte: Arial, tamanho 11pt, cor preta sólida
- Espaçamento entre linhas: 1,5
- Margens: Superior 3cm, Esquerda 3cm, Inferior 2cm, Direita 2cm
- Texto justificado
- Recuo de 1,25 cm na primeira linha de cada parágrafo

### Estrutura do Documento (NÃO incluir no corpo gerado)
- Cabeçalho, data, número do ofício, DESTINATÁRIO, Assunto, saudação e "Atenciosamente," são inseridos automaticamente pelo sistema. NÃO os inclua.

## INSTRUÇÕES PARA REDAÇÃO DO CORPO

Gere APENAS o corpo do ofício (parágrafos entre a saudação e o fecho).

### QUALIDADE TEXTUAL EXIGIDA:
- Cada parágrafo deve ter NO MÍNIMO 3-4 frases completas e bem articuladas
- Use conectivos e transições entre parágrafos: "Nesse contexto", "Diante do exposto", "Cumpre ressaltar", "Importa destacar", "Vale salientar"
- Redação DENSA e FUNDAMENTADA — nunca superficial ou genérica
- Vocabulário rico e variado do universo jurídico-administrativo
- Evite repetição de palavras e estruturas frasais
- Cada parágrafo deve agregar informação nova e relevante

### ESTRUTURA OBRIGATÓRIA DO TEXTO (5 partes):

**PARTE 1 — INTRODUÇÃO INSTITUCIONAL (1 parágrafo robusto):**
Comece com: "Este parlamentar, no uso de suas prerrogativas legais e regimentais, previstas na Lei Orgânica do Município de Uberlândia e no Regimento Interno da Câmara Municipal, vem respeitosamente à presença de Vossa Excelência para solicitar [AÇÃO PRINCIPAL detalhada]."
Complemente com a motivação institucional do pedido, mencionando o compromisso do mandato com a comunidade.

**PARTE 2 — RELATO CIRCUNSTANCIADO (1-2 parágrafos detalhados):**
"Conforme relatos encaminhados a este gabinete por moradores e frequentadores da região, [DESCREVER A SITUAÇÃO com riqueza de detalhes: localização exata (rua, número, bairro, referências), há quanto tempo o problema persiste, tentativas anteriores de resolução, e como o problema se manifesta no cotidiano da população]."
Se houver um segundo parágrafo, aprofunde com detalhes adicionais, observações técnicas ou relatos específicos.

**PARTE 3 — FUNDAMENTAÇÃO DOS PREJUÍZOS E IMPACTOS (1 parágrafo consistente):**
"A situação descrita acarreta sérios transtornos à população local, comprometendo [detalhar impactos específicos e concretos: riscos à segurança física dos pedestres e motoristas, prejuízos à saúde pública, danos à infraestrutura, impacto na mobilidade urbana, prejuízo à qualidade de vida]. Cumpre destacar que [mencionar grupos vulneráveis afetados: idosos, crianças, pessoas com deficiência, gestantes, trabalhadores]. A persistência dessa situação configura risco iminente de [consequências possíveis: acidentes, agravamento de doenças, deterioração patrimonial]."

**PARTE 4 — SOLICITAÇÃO FORMAL E FUNDAMENTADA (1 parágrafo):**
"Diante do exposto, e considerando a competência dessa Secretaria para atuar sobre a matéria, solicita-se formalmente a adoção das seguintes providências: [DETALHAR as ações específicas solicitadas: realização de vistoria técnica in loco, elaboração de cronograma de execução, manutenção corretiva/preventiva, instalação de equipamentos, etc.], com o objetivo de [FINALIDADE detalhada: restabelecer condições adequadas de segurança, garantir a integridade física dos munícipes, melhorar a qualidade do serviço público prestado, etc.]."

**PARTE 5 — CONCLUSÃO INSTITUCIONAL (gerar EXATAMENTE assim, substituindo apenas o nome da secretaria):**
"Espero que [NOME COMPLETO DA SECRETARIA] considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução das providências necessárias."
(pular uma linha)
"Na certeza de contar com o vosso pronto atendimento, desde já agradeço."

### REGRAS DE DESTAQUE EM NEGRITO:
- Use tags <strong> para destacar: nomes de ruas, bairros, tipos de problema, órgãos, ações solicitadas
- NÃO coloque parágrafos inteiros em negrito
- NÃO coloque frases inteiras em negrito — apenas termos-chave

## EXEMPLO DE CORPO BEM REDIGIDO (USE COMO REFERÊNCIA DE QUALIDADE):

"Este parlamentar, no uso de suas prerrogativas legais e regimentais, previstas na Lei Orgânica do Município de Uberlândia e no Regimento Interno da Câmara Municipal, vem respeitosamente à presença de Vossa Excelência para solicitar a <strong>realização de manutenção emergencial da iluminação pública</strong> na <strong>Rua das Acácias</strong>, <strong>Bairro Luizote de Freitas IV</strong>, nesta cidade.

Conforme relatos encaminhados a este gabinete por moradores e frequentadores da região, a referida via encontra-se em situação de completa escuridão há aproximadamente três semanas, em razão do não funcionamento de diversas luminárias públicas instaladas ao longo de toda a sua extensão. De acordo com os cidadãos que procuraram este mandato, a situação persiste mesmo após registros de reclamação junto aos canais de atendimento da Prefeitura, sem que até o momento qualquer providência tenha sido adotada para a resolução do problema. Os moradores relatam, ainda, que o trecho mais crítico situa-se nas proximidades da <strong>Praça do Jardim Europa</strong>, onde a escuridão é total durante o período noturno.

A situação descrita acarreta sérios transtornos à população local, comprometendo sobremaneira a <strong>segurança pública</strong> e a <strong>mobilidade urbana</strong> na região. A ausência de iluminação adequada expõe pedestres, ciclistas e motoristas a riscos elevados de <strong>acidentes de trânsito</strong> e de <strong>violência urbana</strong>, especialmente no período noturno. Cumpre destacar que a região é frequentada por grande número de <strong>idosos, crianças em idade escolar e trabalhadores</strong> que retornam de seus afazeres no fim do dia. A persistência dessa situação configura risco iminente de ocorrências graves que poderiam ser evitadas com a devida manutenção do sistema de iluminação.

Diante do exposto, e considerando a competência dessa Secretaria para atuar sobre a matéria, solicita-se formalmente a adoção das seguintes providências: <strong>realização de vistoria técnica</strong> no local para avaliação do estado das luminárias, seguida da <strong>manutenção corretiva imediata</strong> dos equipamentos danificados e, caso necessário, a <strong>substituição das lâmpadas e reatores</strong> que se encontrem inoperantes, com o objetivo de restabelecer as condições adequadas de iluminação e garantir a segurança e o bem-estar dos munícipes que residem e transitam pela região.

Espero que a Secretaria Municipal de Serviços Urbanos considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução das providências necessárias.

Na certeza de contar com o vosso pronto atendimento, desde já agradeço."

## MEMÓRIA E APRENDIZADO

Quando OFÍCIOS ANTERIORES são fornecidos como contexto:
- Analise o estilo, vocabulário e estrutura dos ofícios anteriores
- Adapte o tom e as expressões para manter consistência
- Use padrões recorrentes como referência
- Reutilize estruturas que funcionaram bem em temas similares
- O exemplo acima é o PADRÃO DE QUALIDADE MÍNIMO

## LISTA COMPLETA DE SECRETARIAS E COMPETÊNCIAS

### SERVIÇOS NÃO PRESTADOS PELA PREFEITURA
- Bancos, EBCT/Correios, DER-MG, DNIT, Ensino Superior/Médio, Polícia Militar, Superintendência Regional de Saúde

### SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO
- Assuntos de servidores, cessão de áreas públicas

### SECRETARIA MUNICIPAL DE AGRONEGÓCIO
- Estradas vicinais rurais, mata-burros, feiras livres, apoio a produtores

### SECRETARIA MUNICIPAL DE COMUNICAÇÃO SOCIAL
- Propaganda e publicidade da Prefeitura, SIM

### SECRETARIA MUNICIPAL DE CULTURA E TURISMO
- Palco móvel/fixo, teatros, eventos culturais, turismo

### SECRETARIA MUNICIPAL DE DESENVOLVIMENTO ECONÔMICO E INOVAÇÃO
- Captação de investimentos, inovação

### SECRETARIA MUNICIPAL DE DESENVOLVIMENTO SOCIAL
- CRAS, CREAS, Cadastro Único, Bolsa Família, NAICAs, CEAIs, cursos profissionalizantes

### SECRETARIA MUNICIPAL DE EDUCAÇÃO
- Manutenção de escolas municipais, cobertura de quadras, creches

### SECRETARIA MUNICIPAL DE FINANÇAS
- Dívida ativa, ISS, IPTU

### SECRETARIA MUNICIPAL DE HABITAÇÃO
- Programas habitacionais (Minha Casa Minha Vida)

### SECRETARIA MUNICIPAL DE GESTÃO AMBIENTAL E SUSTENTABILIDADE
- Academias ao ar livre, brinquedos/quadras em praças, capina/limpeza de praças, poda de árvores

### SECRETARIA MUNICIPAL DE GOVERNO
- Pedidos de informação, requerimentos e indicações de vereadores

### SECRETARIA MUNICIPAL DE INFRAESTRUTURA URBANA
- Tapa-buracos, pavimentação, meio-fio, obras públicas, drenagem pluvial

### SECRETARIA MUNICIPAL DE PLANEJAMENTO URBANO
- Viabilidade para empresas, loteamentos, acessibilidade, fiscalização de obras

### SECRETARIA MUNICIPAL DE SAÚDE
- Combate a insetos (CCZ), unidades de saúde, vacinação

### SECRETARIA MUNICIPAL DE SEGURANÇA INTEGRADA
- Agentes patrimoniais, combate a entorpecentes, videomonitoramento

### SECRETARIA MUNICIPAL DE SERVIÇOS URBANOS
- Bocas de lobo, bueiros, capina de canteiros, calçadas, iluminação pública, varrição, ecopontos

### SECRETARIA MUNICIPAL DE TRÂNSITO E TRANSPORTES (SETTRAN)
- Blitz educativas, táxis, ônibus, terminais, semáforos, sinalização, transporte porta-a-porta

### DMAE
- Água, esgoto, aterro sanitário, coleta de resíduos, caçambas, coleta seletiva, drenagem pluvial

### FUTEL
- Poliesportivos, quadras, campos de futebol, Parque do Sabiá, piscinas públicas

### PROCON
- Fiscalização do comércio, defesa do consumidor

## INSTRUÇÕES DE RESPOSTA

Retorne um JSON válido com a seguinte estrutura:
{
  "oficio": "Texto completo do corpo do ofício (5 partes). Use tags <strong> para negrito seletivo. Texto ROBUSTO e COESO, seguindo o padrão de qualidade do exemplo.",
  "assunto_sugerido": "Solicitação de [AÇÃO] – [LOCAL/BAIRRO]",
  "resposta_cidadao": "Sugestão de resposta ao cidadão com linguagem simples e acolhedora",
  "secretaria_identificada": "Nome da secretaria/órgão responsável",
  "tipo_demanda": "Solicitação, Reclamação ou Denúncia",
  "urgencia": "normal ou urgente",
  "sugestoes_melhoria": ["lista de sugestões"]
}

Exemplos de "assunto_sugerido":
- "Solicitação de manutenção da iluminação pública em praça – Bairro Luizote IV"
- "Solicitação de instalação de cobertura e banco em ponto de ônibus – Bairro Luizote IV"

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

    // Fetch context in parallel
    const [kbResp, scriptsResp, oficiosResp] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,bairro,palavras_chave&order=data_publicacao.desc&limit=5`, { headers }).catch(() => null),
      fetch(`${supabaseUrl}/rest/v1/scripts?select=titulo,conteudo,categoria&limit=5&order=created_at.desc`, { headers }).catch(() => null),
      fetch(`${supabaseUrl}/rest/v1/oficios?select=numero,assunto,destinatario,conteudo,secretaria_identificada,tipo_demanda,bairro&order=created_at.desc&limit=10&conteudo=not.is.null`, { headers }).catch(() => null),
    ]);

    let knowledgeContext = "";
    try {
      if (kbResp?.ok) {
        const kbData = await kbResp.json();
        if (kbData.length > 0) {
          knowledgeContext = "\n\nCONTEXTO ADICIONAL:\n" +
            kbData.map((k: any) => `- ${k.titulo}${k.orgao ? ` (${k.orgao})` : ""}${k.bairro ? ` (${k.bairro})` : ""}: ${k.descricao?.substring(0, 150) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("KB error:", e); }

    let scriptsContext = "";
    try {
      if (scriptsResp?.ok) {
        const scriptsData = await scriptsResp.json();
        if (scriptsData.length > 0) {
          scriptsContext = "\n\nSCRIPTS DE REFERÊNCIA:\n" +
            scriptsData.map((s: any) => `- ${s.titulo} (${s.categoria}): ${s.conteudo?.substring(0, 200) || ""}`).join("\n");
        }
      }
    } catch (e) { console.error("Scripts error:", e); }

    let previousOficiosContext = "";
    try {
      if (oficiosResp?.ok) {
        const oficiosData = await oficiosResp.json();
        if (oficiosData.length > 0) {
          previousOficiosContext = "\n\nOFÍCIOS ANTERIORES (use como referência de estilo):\n" +
            oficiosData.map((o: any, i: number) =>
              `--- Ofício ${i + 1} (nº ${o.numero || 's/n'}) ---\nAssunto: ${o.assunto}\nDestinatário: ${o.destinatario}\nSecretaria: ${o.secretaria_identificada || 'N/I'}\nBairro: ${o.bairro || 'N/I'}\nCorpo: ${o.conteudo?.substring(0, 400) || 'N/A'}\n`
            ).join("\n");
        }
      }
    } catch (e) { console.error("Oficios error:", e); }

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

INSTRUÇÕES:
1. Identifique a secretaria responsável usando a lista de competências
2. Determine o nível de urgência
3. Redija o corpo seguindo a ESTRUTURA OBRIGATÓRIA de 5 partes
4. Gere o campo "assunto_sugerido" no formato "Solicitação de [AÇÃO] – [LOCAL/BAIRRO]"
5. Use tags <strong> para destacar em negrito termos relevantes (nomes de ruas, bairros, problemas, ações)
6. O texto deve caber em UMA página A4 (Arial 11pt, margens 3cm/2cm, espaçamento 1,5)
7. Gere uma sugestão de resposta ao cidadão
8. Se houver ofícios anteriores similares, APRENDA com o estilo`;

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar ofício" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        oficio: content,
        assunto_sugerido: "",
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
