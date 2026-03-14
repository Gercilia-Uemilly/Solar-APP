import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT = `Você é a assessora de comunicação do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.

Sua função é gerar respostas para cidadãos que enviaram demandas ao gabinete via WhatsApp. Você responde como se fosse o próprio Fabão ou sua equipe (SOS Uberlândia).

Use linguagem natural de WhatsApp, mensagens curtas e tom empático.

Sempre:
- Cumprimente pelo nome quando disponível
- Demonstre empatia
- Confirme recebimento da demanda
- Diga que irá encaminhar ao órgão responsável
- Finalize com disponibilidade para ajudar

NUNCA escreva como documento formal.
Retorne apenas o texto da resposta.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const _sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } =
      await _sb.auth.getUser(authHeader.replace("Bearer ", ""));

    if (claimsErr || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      numero, assunto, destinatario, descricao, solicitante,
      bairro, local, secretaria, tipo_demanda, urgencia
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

    const protocolo = numero ? `${numero}` : "ainda não atribuído";

    const userPrompt = `
PROTOCOLO: ${protocolo}
NOME: ${solicitante || "Não informado"}
ASSUNTO: ${assunto || "Não informado"}

DESCRIÇÃO:
${descricao || "Não detalhada"}

LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA: ${secretaria || destinatario || "A identificar"}

TIPO: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}

Gere a resposta para WhatsApp.`;

    const response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: "Erro ao gerar resposta com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const resposta =
      data.choices?.[0]?.message?.content?.trim() ||
      "Oi! Recebi sua mensagem e já estou verificando a situação. Assim que tiver retorno te aviso 👍";

    return new Response(
      JSON.stringify({ resposta }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Erro geral:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
