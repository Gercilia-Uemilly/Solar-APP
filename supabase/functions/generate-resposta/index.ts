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
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { numero, assunto, destinatario, descricao, solicitante, bairro, local, secretaria, tipo_demanda, urgencia } = await req.json();

    // ═══ PASSO 1: Buscar scripts cadastrados ═══
    const { data: scripts } = await supabaseAdmin
      .from("scripts")
      .select("titulo, conteudo, categoria, tags")
      .order("created_at", { ascending: false })
      .limit(50);

    // ═══ PASSO 2: Buscar banco de informações ═══
    const { data: baseInfo } = await supabaseAdmin
      .from("base_conhecimento")
      .select("titulo, descricao, categoria, orgao, bairro")
      .order("created_at", { ascending: false })
      .limit(50);

    // ═══ PASSO 3: Buscar respostas anteriores de ofícios ═══
    const { data: respostasAnteriores } = await supabaseAdmin
      .from("oficios")
      .select("resposta_cidadao, assunto, bairro, secretaria_identificada")
      .not("resposta_cidadao", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);

    const scriptsCount = scripts?.length || 0;
    const baseInfoCount = baseInfo?.length || 0;
    const respostasCount = respostasAnteriores?.filter(r => r.resposta_cidadao)?.length || 0;

    // ═══ PASSO 4: Montar contexto interno ═══
    const contextoInterno = `
SCRIPTS CADASTRADOS NO SISTEMA (${scriptsCount}):
${scripts?.map(s => `[${s.categoria}] ${s.titulo}: ${s.conteudo?.substring(0, 300)}`).join("\n\n") || "Nenhum script cadastrado."}

BANCO DE INFORMAÇÕES (${baseInfoCount}):
${baseInfo?.map(b => `[${b.categoria || "Geral"}] ${b.titulo}: ${b.descricao?.substring(0, 300) || "Sem descrição"} ${b.orgao ? `(Órgão: ${b.orgao})` : ""}`).join("\n\n") || "Nenhuma informação cadastrada."}

RESPOSTAS ANTERIORES DO GABINETE (${respostasCount}):
${respostasAnteriores?.filter(r => r.resposta_cidadao).map(r => `[${r.secretaria_identificada || "Geral"}] ${r.resposta_cidadao?.substring(0, 200)}`).join("\n\n") || "Nenhuma resposta anterior."}
    `.trim();

    const protocolo = numero ? `${numero}` : "ainda não atribuído";

    const systemPrompt = `Você é o assistente do gabinete do Vereador Fabão em Uberlândia-MG.

Você tem acesso ao material interno do gabinete: scripts de atendimento, banco de informações e respostas anteriores já aprovadas pela equipe.

Sua função é gerar sugestões de resposta para cidadãos que enviaram demandas via WhatsApp.

REGRAS OBRIGATÓRIAS:
1. Baseie-se EXCLUSIVAMENTE no material interno fornecido — sem inventar informações.
2. Use o estilo, tom e linguagem dos scripts e respostas anteriores do próprio gabinete.
3. Use linguagem natural de WhatsApp, mensagens curtas e tom empático.
4. Cumprimente pelo nome quando disponível.
5. Demonstre empatia com a situação.
6. Confirme recebimento da demanda.
7. Diga que irá encaminhar ao órgão responsável.
8. Finalize com disponibilidade para ajudar.
9. NUNCA escreva como documento formal.
10. Retorne APENAS o texto da resposta.`;

    const userPrompt = `MATERIAL INTERNO DO GABINETE:
${contextoInterno}

DEMANDA DO CIDADÃO PARA RESPONDER:
PROTOCOLO: ${protocolo}
NOME: ${solicitante || "Não informado"}
ASSUNTO: ${assunto || "Não informado"}
DESCRIÇÃO: ${descricao || "Não detalhada"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA: ${secretaria || destinatario || "A identificar"}
TIPO: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}

Gere a resposta para WhatsApp baseada no material interno acima, seguindo o estilo e tom já usado pelo gabinete.`;

    // ═══ PASSO 5: Chamar OpenAI ═══
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada");
    }

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI error:", aiResponse.status, errText);
      throw new Error(`Erro na API de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const resposta = aiData.choices?.[0]?.message?.content?.trim() || "Oi! Recebi sua mensagem e já estou verificando a situação. Assim que tiver retorno te aviso 👍";

    return new Response(JSON.stringify({
      resposta,
      fontes: {
        scripts: scriptsCount,
        base_info: baseInfoCount,
        respostas_anteriores: respostasCount,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Erro geral:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
