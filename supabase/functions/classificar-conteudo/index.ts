import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: authErr } = await sb.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conteudo, tipo } = await req.json();
    if (!conteudo || conteudo.trim().length < 5) {
      return new Response(
        JSON.stringify({ categoria: "outro", tags: [], sentimento: "neutro" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: `Classifique este conteúdo do gabinete do Vereador Fabão e retorne APENAS JSON válido:
{
  "categoria": "demanda|resposta|informativo|campanha|institucional|outro",
  "secretaria": "nome da secretaria se identificada ou null",
  "assunto": "resumo em até 8 palavras",
  "sentimento": "positivo|neutro|negativo",
  "urgente": true/false,
  "tags": ["tag1","tag2","tag3"],
  "usar_como_script": true/false
}

Conteúdo (${tipo || "texto"}):
"${conteudo.substring(0, 1000)}"`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || "";
    const cleaned = texto.replace(/```json/g, "").replace(/```/g, "").trim();

    let resultado;
    try {
      resultado = JSON.parse(cleaned);
    } catch {
      resultado = { categoria: "outro", tags: [], sentimento: "neutro" };
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro classificar-conteudo:", e);
    return new Response(
      JSON.stringify({
        error: e.message || "Erro desconhecido",
        categoria: "outro",
        tags: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
