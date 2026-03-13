import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um redator parlamentar experiente da assessoria do Gabinete do Vereador Fabão, Câmara Municipal de Uberlândia.

Sua especialidade é redigir ofícios oficiais de alta qualidade técnica e institucional.

Gere o corpo do ofício seguindo a estrutura:

1º parágrafo — introdução com solicitação  
2º parágrafo — relato do solicitante  
3º parágrafo — consequências do problema  
4º parágrafo — solicitação formal  

Depois finalize com a conclusão institucional.

Use linguagem formal e técnica.

Use <strong> para destacar ruas, bairros, problemas e ações solicitadas.

Retorne apenas JSON.`;


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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } =
      await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (claimsErr || !claimsData?.user) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      assunto,
      destinatario,
      descricao,
      tipo,
      solicitante,
      bairro,
      prioridade,
      local
    } = await req.json();

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

    if (!ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

    const [kbResp, oficiosResp] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/base_conhecimento?select=titulo,descricao,orgao,bairro,palavras_chave&order=data_publicacao.desc&limit=5`, { headers }).catch(() => null),
      fetch(`${supabaseUrl}/rest/v1/oficios?select=numero,assunto,destinatario,conteudo,secretaria_identificada,tipo_demanda,bairro&order=created_at.desc&limit=10&conteudo=not.is.null`, { headers }).catch(() => null),
    ]);

    let knowledgeContext = "";

    if (kbResp?.ok) {
      const kbData = await kbResp.json();

      if (kbData.length > 0) {
        knowledgeContext =
          "\n\nCONTEXTO ADICIONAL:\n" +
          kbData
            .map((k: any) =>
              `- ${k.titulo}${k.orgao ? ` (${k.orgao})` : ""}${k.bairro ? ` (${k.bairro})` : ""}: ${k.descricao?.substring(0, 150) || ""}`
            )
            .join("\n");
      }
    }

    let previousOficiosContext = "";

    if (oficiosResp?.ok) {
      const oficiosData = await oficiosResp.json();

      if (oficiosData.length > 0) {
        previousOficiosContext =
          "\n\nOFÍCIOS ANTERIORES:\n" +
          oficiosData
            .map(
              (o: any, i: number) =>
                `--- Ofício ${i + 1} ---\nAssunto: ${o.assunto}\nDestinatário: ${o.destinatario}\nSecretaria: ${o.secretaria_identificada || "N/I"}\nBairro: ${o.bairro || "N/I"}\nCorpo: ${o.conteudo?.substring(0, 400) || ""}`
            )
            .join("\n");
      }
    }

    const userPrompt = `Gerar ofício parlamentar com base nos dados:

SECRETARIA: ${tipo || "Não informada"}
DESTINATÁRIO: ${destinatario || "A identificar"}
DESCRIÇÃO: ${descricao || "Não informado"}
SOLICITANTE: ${solicitante || "Cidadão"}
ENDEREÇO: ${bairro || local || "Não informado"}
PRIORIDADE: ${prioridade || "Normal"}
ASSUNTO: ${assunto || "Gerar automaticamente"}
${knowledgeContext}
${previousOficiosContext}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    if (!response.ok) {

      const text = await response.text();

      console.error("Anthropic API error:", text);

      return new Response(
        JSON.stringify({ error: "Erro ao gerar ofício" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    const content = data.content?.[0]?.text || "";

    let parsed;

    try {

      const cleaned = content
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      parsed = JSON.parse(cleaned);

    } catch {

      parsed = {
        oficio: content,
        assunto_sugerido: "",
        secretaria_identificada: destinatario || "",
        tipo_demanda: tipo || "Solicitação",
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        sugestoes_melhoria: []
      };

    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {

    console.error("generate-oficio error:", error);

    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar ofício" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  }

});
