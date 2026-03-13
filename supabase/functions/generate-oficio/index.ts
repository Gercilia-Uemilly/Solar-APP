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

Gere APENAS o corpo do ofício (parágrafos entre a saudação e o fecho). O corpo deve ter EXATAMENTE 4 parágrafos + conclusão fixa.

### ESTRUTURA OBRIGATÓRIA DO TEXTO (4 parágrafos + conclusão):

**PARÁGRAFO 1 — INTRODUÇÃO COM SOLICITAÇÃO:**
Começar com: "Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [AÇÃO ESPECÍFICA COM ENDEREÇO COMPLETO], visando [OBJETIVO]."
- Mencionar rua, avenida, bairro exatos
- Colocar em negrito (<strong>): nome da rua, bairro, tipo de serviço solicitado

**PARÁGRAFO 2 — RELATO DO SOLICITANTE:**
Começar com: "Conforme relatos encaminhados a este gabinete por [QUEM RECLAMOU], [DESCRIÇÃO DO PROBLEMA com detalhes técnicos]."
- Descrever o problema com precisão
- Colocar em negrito os problemas principais

**PARÁGRAFO 3 — CONSEQUÊNCIAS E PREJUÍZOS:**
Descrever o impacto na população sem começar com 'Conforme'. Usar frases como:
"Tal situação [CONSEQUÊNCIA]..."
"Como consequência, a população [IMPACTO]..."
- Mencionar quem é afetado: motoristas, pedestres, moradores, ciclistas, idosos, crianças etc
- Colocar em negrito as consequências graves

**PARÁGRAFO 4 — SOLICITAÇÃO FORMAL:**
Começar com: "Diante do exposto, solicita-se a adoção das seguintes providências: [AÇÕES ESPECÍFICAS]. Tais medidas têm como objetivo principal [FINALIDADE]."
- Ser específico nas providências pedidas
- Colocar em negrito as ações solicitadas

**CONCLUSÃO FIXA (gerar EXATAMENTE assim, substituindo apenas o nome da secretaria):**
"Espero que [NOME COMPLETO DA SECRETARIA conforme fornecido nos dados] considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução das providências necessárias."
(pular uma linha)
"Na certeza de contar com o vosso pronto atendimento, desde já agradeço."

### REGRAS OBRIGATÓRIAS:
- MÁXIMO 4 parágrafos no corpo + conclusão fixa
- Linguagem formal e técnica
- Negrito (<strong>) nos termos técnicos e locais específicos
- Nunca repetir informações entre parágrafos
- Nunca usar 'Resposta Empática' ou frases motivacionais
- Nunca adicionar parágrafos extras além dos 4
- O endereço completo deve aparecer no §1
- Na conclusão, usar SEMPRE o nome COMPLETO da secretaria conforme fornecido (ex: "Secretaria Municipal de Obras e Infraestrutura", não abreviar)
- NUNCA duplicar a palavra "Bairro" no texto (verificar se o endereço já contém "Bairro" antes de adicionar)

### REGRAS DE DESTAQUE EM NEGRITO:
- Use tags <strong> para destacar: nomes de ruas, bairros, tipos de problema, órgãos, ações solicitadas
- NÃO coloque parágrafos inteiros em negrito
- NÃO coloque frases inteiras em negrito — apenas termos-chave

## LISTA COMPLETA DE SECRETARIAS E COMPETÊNCIAS

### SECRETARIA MUNICIPAL DE SERVIÇOS URBANOS
- Bocas de lobo, bueiros, capina de canteiros, calçadas, iluminação pública, varrição, ecopontos

### SECRETARIA MUNICIPAL DE INFRAESTRUTURA URBANA (OBRAS E INFRAESTRUTURA)
- Tapa-buracos, pavimentação, meio-fio, obras públicas, drenagem pluvial

### SECRETARIA MUNICIPAL DE SAÚDE
- Combate a insetos (CCZ), unidades de saúde, vacinação

### SECRETARIA MUNICIPAL DE TRÂNSITO E TRANSPORTES (SETTRAN)
- Blitz educativas, táxis, ônibus, terminais, semáforos, sinalização, transporte porta-a-porta

### SECRETARIA MUNICIPAL DE MEIO AMBIENTE E SUSTENTABILIDADE
- Academias ao ar livre, brinquedos/quadras em praças, capina/limpeza de praças, poda de árvores

### SECRETARIA MUNICIPAL DE EDUCAÇÃO
- Manutenção de escolas municipais, cobertura de quadras, creches

### SECRETARIA MUNICIPAL DE ASSISTÊNCIA SOCIAL
- CRAS, CREAS, Cadastro Único, Bolsa Família, NAICAs, CEAIs, cursos profissionalizantes

### SECRETARIA MUNICIPAL DE AGRONEGÓCIO
- Estradas vicinais rurais, mata-burros, feiras livres, apoio a produtores

### DMAE — Departamento Municipal de Água e Esgoto
- Água, esgoto, aterro sanitário, coleta de resíduos, caçambas, coleta seletiva

### SECRETARIA MUNICIPAL DE HABITAÇÃO
- Programas habitacionais (Minha Casa Minha Vida)

### SECRETARIA MUNICIPAL DE CULTURA E TURISMO
- Palco móvel/fixo, teatros, eventos culturais, turismo

### SECRETARIA MUNICIPAL DE ESPORTES E LAZER (FUTEL)
- Poliesportivos, quadras, campos de futebol, Parque do Sabiá, piscinas públicas

## INSTRUÇÕES DE RESPOSTA

Retorne um JSON válido com a seguinte estrutura:
{
  "oficio": "Texto completo do corpo do ofício (4 parágrafos + conclusão). Use tags <strong> para negrito seletivo.",
  "assunto_sugerido": "Solicitação de [AÇÃO] – [LOCAL/BAIRRO]",
  "secretaria_identificada": "Nome completo da secretaria/órgão responsável",
  "tipo_demanda": "Solicitação, Reclamação ou Denúncia",
  "urgencia": "normal ou urgente",
  "sugestoes_melhoria": ["lista de sugestões"]
}

REGRAS PARA "assunto_sugerido":
- Formato: "Solicitação de [AÇÃO] – [LOCAL]"
- NUNCA duplicar "Bairro Bairro" — se o endereço já tem "Bairro", não adicionar novamente
- Exemplos corretos:
  - "Solicitação de Operação Tapa-Buraco – Bairro Tubalina"
  - "Solicitação de manutenção da iluminação pública – Bairro Luizote IV"

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

    // Fetch context in parallel
    const [kbResp, oficiosResp] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,bairro,palavras_chave&order=data_publicacao.desc&limit=5`, { headers }).catch(() => null),
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

SECRETARIA: ${tipo || "Não informada"}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO/CONTEXTO: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "Cidadão"}
ENDEREÇO COMPLETO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO (se já informado): ${assunto || "Não informado — gerar automaticamente"}
${knowledgeContext}${previousOficiosContext}

INSTRUÇÕES:
1. Identifique a secretaria responsável usando a lista de competências
2. Redija o corpo seguindo a ESTRUTURA OBRIGATÓRIA de 4 parágrafos + conclusão fixa
3. Gere o campo "assunto_sugerido" no formato "Solicitação de [AÇÃO] – [LOCAL/BAIRRO]"
4. Use tags <strong> para destacar em negrito termos relevantes
5. O texto deve caber em UMA página A4
6. Na conclusão, use o nome COMPLETO da secretaria conforme indicado em SECRETARIA
7. NUNCA duplique "Bairro Bairro" — verifique o endereço antes`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20250315",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Anthropic API error:", response.status, t);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Chave da Anthropic inválida ou expirada." }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar ofício" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
