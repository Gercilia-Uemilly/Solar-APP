import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

PROBLEMAS CONHECIDOS — sempre que o operador relatar QUALQUER um destes sintomas:
- "Caí do sistema sozinho" / "deslogou sem motivo"
- "Falha ao enviar" ao gerar ofício
- "Erro vermelho" ao gerar ofício no celular
- Número de ofício trocado / duplicado
- Tela travando, demorando para carregar, lenta no celular
- Sessão expirada de repente

Pergunte ANTES de qualquer outra coisa: "Você está usando a mesma conta em mais de um celular ao mesmo tempo?"

Se a resposta for SIM (ou se ela já mencionar isso), responda EXATAMENTE com esta orientação (em linguagem simples):

"Notamos que sua conta está sendo usada em mais de um celular ao mesmo tempo. Isso causa estes probleminhas:
❌ Você cai do sistema sem motivo
❌ Aparece erro 'Falha ao enviar' ao gerar ofícios
❌ Os ofícios podem ficar com número trocado
❌ A tela trava ou demora para carregar

Por quê? O sistema foi feito para 1 conta = 1 pessoa = 1 celular. Quando você usa em vários aparelhos, eles 'brigam' pela mesma sessão e acabam derrubando uns aos outros.

O que fazer? Escolha 1 celular principal para trabalhar e saia da conta nos outros (Configurações → Sair). Se realmente precisar de acessos simultâneos, peça ao administrador para criar contas separadas para cada aparelho. ✅"

Seja direto, simpático e objetivo.
Responda sempre em português do Brasil.
Use formatação simples (sem markdown complexo).
Se não souber algo específico do sistema, oriente o operador a contatar o administrador.`;

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
    const { data: { user: _u } } = await _sb.auth.getUser();
    if (!_u) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { pergunta, historico } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    const messages = [
      ...(historico || []).map((m: any) => ({ role: m.role, content: m.content })),
      { role: "user", content: pergunta },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
