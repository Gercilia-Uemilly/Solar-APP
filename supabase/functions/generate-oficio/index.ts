import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callGemini, toGeminiMessages } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade, local } = await req.json();

    const nomeOrgao = {
      'DMAE': 'Departamento Municipal de Água e Esgoto',
      'DMAE — Departamento Municipal de Água e Esgoto': 'Departamento Municipal de Água e Esgoto',
      'UFU — Universidade Federal de Uberlândia': 'Universidade Federal de Uberlândia',
      'Secretaria Municipal de Trânsito e Transportes (SETTRAN)': 'Secretaria Municipal de Trânsito e Transportes',
    }[tipo] || tipo || 'órgão competente';

    const conclusao = `Espero que o ${nomeOrgao} considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução das providências necessárias.\n\nNa certeza de contar com o vosso pronto atendimento, desde já agradeço.`;

    const SYSTEM_PROMPT = `Você é redator parlamentar do gabinete do Vereador Fabão em Uberlândia-MG.

Redija ofícios parlamentares com linguagem formal, clara, objetiva e sem redundâncias.

IMPORTANTE: Você deve gerar um ofício completo mesmo quando receber apenas uma descrição curta como "buraco na rua no bairro Tubalina". Interprete o problema, identifique a secretaria correta, e estruture o ofício completo seguindo o modelo abaixo.

MODELO OBRIGATÓRIO — exatamente 4 parágrafos + conclusão:

§1 INTRODUÇÃO:
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [AÇÃO] [ENDEREÇO COMPLETO]."
→ Negrito com <strong>: ação principal, rua, bairro

§2 RELATO:
"Conforme relatos encaminhados a este gabinete, [PROBLEMA DESCRITO COM DETALHES]."
→ Negrito com <strong>: problema principal

§3 CONSEQUÊNCIAS:
"[IMPACTO NA POPULAÇÃO — sem repetir §1 e §2]."
→ Negrito com <strong>: consequências graves

§4 SOLICITAÇÃO:
"Diante disso, solicita-se [PROVIDÊNCIAS ESPECÍFICAS], garantindo [FINALIDADE]."
→ Negrito com <strong>: ações pedidas

§5 CONCLUSÃO (usar a conclusão fixa fornecida no prompt do usuário)

EXEMPLO DE OFÍCIO DO GABINETE (imite este estilo):
---
<p>Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar a <strong>operação tapa-buracos</strong> na <strong>Rua Osvaldo Cruz</strong>, nas proximidades do número 450, no <strong>Bairro Tubalina</strong>, em Uberlândia-MG.</p>
<p>Conforme relatos encaminhados a este gabinete por moradores da região, a referida via apresenta <strong>diversos buracos de grande profundidade</strong> que se agravaram com as chuvas recentes, comprometendo seriamente a trafegabilidade do local.</p>
<p>A situação tem causado <strong>danos a veículos, risco de acidentes</strong> e dificuldade de acesso para os moradores, incluindo idosos e pessoas com mobilidade reduzida, que dependem dessa via para suas atividades diárias.</p>
<p>Diante disso, solicita-se a <strong>recuperação asfáltica urgente</strong> no trecho indicado, garantindo condições seguras de tráfego e a integridade física dos cidadãos que transitam pela região.</p>
---

REGRAS OBRIGATÓRIAS:
- Exatamente 4 parágrafos no corpo + conclusão (cada um como <p>)
- Negrito SOMENTE com <strong>, nunca <b>
- Sem repetição entre parágrafos
- Linguagem formal mas sem ser excessivamente rebuscada — imite o estilo do exemplo acima
- Mencionar endereço completo no §1 quando disponível
- NUNCA duplicar a palavra "Bairro" (ex: "Bairro Bairro Tubalina" é ERRADO, "Bairro Tubalina" é CORRETO)
- Se o endereço já contém "Bairro", NÃO adicionar novamente
- Gerar o ASSUNTO no formato: "Solicitação de [SERVIÇO] – [LOCAL/BAIRRO]"
- Se a descrição for curta/simples, interprete o contexto e elabore os 4 parágrafos completos com detalhes realistas
- Identifique automaticamente a secretaria responsável pelo tipo de problema
- NÃO inclua formatação extra (sem fonte, sem tamanho, sem espaçamento inline) — apenas <p> e <strong>

IDENTIFICAÇÃO AUTOMÁTICA DE SECRETARIA:
- Buracos, pavimentação, asfalto → Secretaria Municipal de Obras e Infraestrutura
- Limpeza, poda, capina, lixo, iluminação → Secretaria Municipal de Serviços Urbanos
- Trânsito, sinalização, semáforos → Secretaria Municipal de Trânsito e Transportes (SETTRAN)
- Água, esgoto, saneamento → DMAE — Departamento Municipal de Água e Esgoto
- Saúde, UBS, hospital → Secretaria Municipal de Saúde
- Educação, escolas → Secretaria Municipal de Educação

Retorne JSON no formato:
{
  "oficio": "HTML com os 4 parágrafos + conclusão (cada um em <p>)",
  "assunto_sugerido": "Solicitação de ... – Bairro ...",
  "secretaria_identificada": "Nome completo da secretaria",
  "tipo_demanda": "...",
  "urgencia": "normal|urgente",
  "sugestoes_melhoria": []
}`;

    const userPrompt = `SECRETARIA/ÓRGÃO: ${tipo || "A identificar automaticamente"}
DESTINATÁRIO: ${destinatario || "A identificar automaticamente"}
DESCRIÇÃO DO PROBLEMA: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "moradores da região"}
ENDEREÇO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO (se já informado): ${assunto || "Gerar automaticamente"}

CONCLUSÃO FIXA (incluir como último parágrafo do corpo):
"${conclusao}"

IMPORTANTE: Mesmo que a descrição seja curta (ex: "buraco na rua"), gere um ofício completo com 4 parágrafos detalhados + a conclusão. Interprete o contexto, elabore detalhes realistas e siga o padrão institucional do gabinete.

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
        secretaria_identificada: tipo || "",
        tipo_demanda: "Solicitação",
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        sugestoes_melhoria: [],
      };
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
