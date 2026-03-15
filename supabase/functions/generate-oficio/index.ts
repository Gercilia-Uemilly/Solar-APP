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

Redija ofícios parlamentares com linguagem formal, objetiva e sem redundâncias.

MODELO OBRIGATÓRIO — exatamente 4 parágrafos:

§1 INTRODUÇÃO:
"Este parlamentar, no uso de suas prerrogativas legais e regimentais, vem respeitosamente solicitar [AÇÃO] [ENDEREÇO COMPLETO]."
→ Negrito: ação principal, rua, bairro

§2 RELATO:
"Conforme relatos encaminhados a este gabinete, [PROBLEMA DESCRITO COM DETALHES]."
→ Negrito: problema principal

§3 CONSEQUÊNCIAS:
"[IMPACTO NA POPULAÇÃO — sem repetir §1 e §2]."
→ Negrito: consequências graves

§4 SOLICITAÇÃO:
"Diante disso, solicita-se [PROVIDÊNCIAS ESPECÍFICAS], garantindo [FINALIDADE]."
→ Negrito: ações pedidas

REGRAS:
- Exatamente 4 parágrafos no corpo
- Negrito com <strong>
- Sem repetição entre parágrafos
- Sem formalismo excessivo
- Mencionar endereço completo no §1
- Gerar também o ASSUNTO no formato: "Solicitação de [SERVIÇO] – [LOCAL/BAIRRO]"

Retorne JSON no formato:
{
  "oficio": "HTML com os 4 parágrafos",
  "assunto_sugerido": "Solicitação de ... – Bairro ...",
  "secretaria_identificada": "...",
  "tipo_demanda": "...",
  "urgencia": "normal",
  "sugestoes_melhoria": []
}`;

    const userPrompt = `SECRETARIA/ÓRGÃO: ${tipo || "Não informada"}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO DO PROBLEMA: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "moradores da região"}
ENDEREÇO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO (se já informado): ${assunto || "Gerar automaticamente"}

CONCLUSÃO FIXA (copiar exatamente ao final do corpo):
"${conclusao}"

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
