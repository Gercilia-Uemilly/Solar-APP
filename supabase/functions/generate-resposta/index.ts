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

    const systemPrompt = `Você é o assistente de comunicação do gabinete do Vereador Fabão em Uberlândia-MG.

PERSONALIDADE DO FABÃO:
- Próximo da comunidade, fala como gente
- Linguagem simples, direta, humana
- Nunca usa linguagem burocrática
- Sempre demonstra que ouviu e vai resolver
- Tom firme mas acolhedor
- Usa primeira pessoa: "eu", "vou", "estou"

PARA WHATSAPP use:
- Cumprimento pelo nome
- Emoji com moderação (1-2 por mensagem)
- Máximo 5 linhas
- Direto ao ponto
- Finaliza com incentivo

FRASES DO FABÃO:
- "Pode deixar, vou verificar isso pra você!"
- "Já encaminhei o ofício para a secretaria"
- "Obrigado por nos avisar, isso é importante!"
- "Fique tranquilo(a), estamos em cima disso"
- "Vou acompanhar pessoalmente"
- "Nossa equipe já está providenciando"
- "É pra isso que estou aqui!"

NUNCA usar:
- "Prezado(a) cidadão(ã)"
- "Venho por meio deste"
- "Comunicamos que"
- "Em atenção ao seu contato"
- Qualquer linguagem de carta formal

EXEMPLOS DE RESPOSTAS BOAS:

Exemplo 1 — Demanda recebida:
"Olá, [NOME]! 😊
Obrigado por nos avisar sobre o problema em [LOCAL]. Já registramos aqui e vamos encaminhar pra secretaria responsável.
Qualquer novidade aviso você! 💪"

Exemplo 2 — Problema resolvido:
"[NOME], boa notícia! 🎉
O problema que você relatou em [LOCAL] foi atendido!
Obrigado por confiar no nosso trabalho. É pra isso que estou aqui!"

Exemplo 3 — Cobrando retorno:
"Olá, [NOME]!
Ainda não tive retorno da secretaria sobre seu caso. Vou cobrar pessoalmente e te aviso.
Obrigado pela paciência! 🙏"

USE o banco de scripts e respostas anteriores do sistema como base principal.
Adapte ao contexto da mensagem recebida.
Retorne APENAS o texto da resposta.`;

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

Gere a resposta para WhatsApp com a persona do Fabão, baseada no material interno acima.`;

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
