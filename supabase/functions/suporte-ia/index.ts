import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente do Sistema Solar, usado pelo gabinete do Vereador Fabão em Uberlândia-MG.

Ajude os operadores com dúvidas sobre:
- Como criar um ofício (menu lateral > Novo Ofício)
- Como exportar para PDF/Word/Drive (botões no editor do ofício)
- Como usar o sistema em geral
- Dúvidas sobre formatação de ofícios
- Como anexar imagens e documentos
- Como usar o chat interno entre operadores
- Como numerar ofícios
- Como gerenciar respostas aos cidadãos
- Banco de Informações e Clipping
- WhatsApp integrado

Seja direto, simpático e objetivo.
Responda sempre em português do Brasil.
Use formatação simples (sem markdown complexo).
Se não souber algo específico do sistema, oriente o operador a contatar o administrador.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pergunta, historico } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const messages = [
      ...(historico || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: pergunta },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ resposta: "Muitas perguntas em pouco tempo. Aguarde um momento e tente novamente." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ resposta: "Serviço de IA temporariamente indisponível. Tente novamente mais tarde." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro no serviço de IA");
    }

    const data = await response.json();
    const resposta = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    return new Response(JSON.stringify({ resposta }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suporte-ia error:", e);
    return new Response(JSON.stringify({ resposta: "Erro ao processar. Tente novamente." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
