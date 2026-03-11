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
- Cabeçalho: Logos Câmara + Gabinete centralizados
- Data: "Uberlândia, [dia] de [mês] de [ano]." alinhada à direita
- Número: "Ofício GVF n° [NÚMERO]/2026" (automático)
- DESTINATÁRIO: em negrito, seguido do cargo e nome
- Assunto: em negrito, seguido da descrição
- Saudação: "Excelentíssimo(a) Senhor(a) Secretário(a) Municipal," (NÃO em negrito)
- Fecho: "Atenciosamente," (já inserido automaticamente pelo sistema)
- Assinatura: imagem pré-impressa + "FABÃO" em negrito + "Vereador"

## INSTRUÇÕES PARA REDAÇÃO DO CORPO

Você deve gerar APENAS o corpo do ofício (os parágrafos entre a saudação e o fecho).

CONTEXTO:
O vereador encaminha uma solicitação administrativa a um órgão público municipal.

INSTRUÇÕES OBRIGATÓRIAS:
• linguagem formal, administrativa e respeitosa
• redação clara e objetiva
• justificar a solicitação com base no interesse público
• mencionar impactos à população quando aplicável
• demonstrar fundamentação institucional do pedido
• manter tom impessoal e institucional
• DESTAQUE EM NEGRITO: coloque em **negrito** (usando tags <strong>) os termos mais relevantes: nomes de ruas, bairros, tipos de problema, órgãos, ações solicitadas. NÃO coloque parágrafos inteiros em negrito.
• SEMPRE mencionar rua, bairro, número quando informados
• SEMPRE mencionar quem é afetado (moradores, usuários, idosos, crianças, etc.)
• NUNCA gerar texto genérico ou vago

ESTRUTURA OBRIGATÓRIA DO TEXTO (5 partes):

PARTE 1 — INTRODUÇÃO (1 parágrafo):
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [AÇÃO PRINCIPAL resumida em uma linha]."

PARTE 2 — RELATO DO SOLICITANTE (1-2 parágrafos):
"Conforme relatos encaminhados a este gabinete, [DESCREVER A SITUAÇÃO exatamente como foi relatada, com detalhes do local, rua, bairro, número se houver]."

PARTE 3 — EXPLICAÇÃO DO PREJUÍZO (1 parágrafo):
"[Descrever o impacto negativo na população: segurança, saúde, mobilidade, qualidade de vida, quem é afetado — idosos, crianças, moradores, etc]."

PARTE 4 — SOLICITAÇÃO FORMAL (1 parágrafo):
"Diante disso, solicita-se [AÇÃO ESPECÍFICA pedida: vistoria técnica, manutenção, instalação, estudo, etc], com o objetivo de [FINALIDADE: garantir segurança, melhorar condições, restabelecer serviço, etc]."

PARTE 5 — CONCLUSÃO (2 linhas fixas — gerar EXATAMENTE assim, substituindo apenas o nome da secretaria):
"Espero que [NOME DA SECRETARIA] considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução das providências necessárias."
(pular uma linha)
"Na certeza de contar com o vosso pronto atendimento, desde já agradeço."

NÃO INCLUIR NO CORPO:
• cabeçalho, numeração do ofício, destinatário, saudação inicial, assinatura, data
• "Atenciosamente," (já inserido pelo sistema)

## MEMÓRIA E APRENDIZADO

Quando OFÍCIOS ANTERIORES são fornecidos como contexto:
- Analise o estilo, vocabulário e estrutura dos ofícios anteriores
- Adapte o tom e as expressões para manter consistência
- Use padrões recorrentes como referência
- Reutilize estruturas que funcionaram bem em temas similares

## TOM DE VOZ
- Jurídico-Político: Firme e Solucionador
- Linguagem formal e institucional
- Padrão da administração pública brasileira
- Clareza, objetividade e respeito

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

Você DEVE retornar um JSON válido com a seguinte estrutura:
{
  "oficio": "Texto completo do corpo do ofício (5 partes conforme estrutura obrigatória). Inclua as 5 partes. Use tags <strong> para negrito seletivo nos termos relevantes.",
  "assunto_sugerido": "Assunto no formato: Solicitação de [AÇÃO] – [LOCAL/BAIRRO]",
  "resposta_cidadao": "Sugestão de resposta ao cidadão com linguagem simples e acolhedora",
  "secretaria_identificada": "Nome da secretaria/órgão responsável",
  "tipo_demanda": "Tipo da demanda (Solicitação, Reclamação, Denúncia)",
  "urgencia": "normal ou urgente",
  "sugestoes_melhoria": ["lista de sugestões"]
}

O campo "assunto_sugerido" deve seguir o formato:
- "Solicitação de manutenção da iluminação pública em praça – Bairro Luizote IV"
- "Solicitação de instalação de cobertura e banco em ponto de ônibus – Bairro Luizote IV"
- "Solicitação de estudos técnicos para melhorias no trânsito – proximidades da E.E. Custódio"

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
