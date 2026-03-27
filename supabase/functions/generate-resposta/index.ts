import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const cleanQuotedResponse = (text: string) => {
  let t = text.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("\u201c") && t.endsWith("\u201d"))) {
    t = t.slice(1, -1).trim();
  }
  // Remove prefixos de IA
  t = t.replace(/^(Resposta:?\s*|Sugestão:?\s*)/i, "").trim();
  return t;
};

const scoreRelevance = (text: string, keywords: string[]): number => {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => score + (lower.includes(kw) ? 1 : 0), 0);
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

    // Palavras-chave da demanda para ranquear relevância
    const demandaText = `${assunto || ""} ${descricao || ""} ${bairro || ""} ${local || ""} ${secretaria || ""} ${tipo_demanda || ""}`.toLowerCase();
    const keywords = demandaText.split(/\s+/).filter(w => w.length > 3);

    // ═══ Buscar dados em paralelo ═══
    const [scriptsRes, baseInfoRes, respostasRes, conversasRes] = await Promise.all([
      supabaseAdmin.from("scripts").select("titulo, conteudo, categoria, tags").order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("base_conhecimento").select("titulo, descricao, categoria, orgao, bairro").order("created_at", { ascending: false }).limit(60),
      supabaseAdmin.from("oficios").select("resposta_cidadao, assunto, bairro, secretaria_identificada").not("resposta_cidadao", "is", null).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("whatsapp_messages").select("content, direction, sender_name").eq("direction", "outgoing").not("content", "is", null).order("created_at", { ascending: false }).limit(40),
    ]);

    const scripts = scriptsRes.data || [];
    const baseInfo = baseInfoRes.data || [];
    const respostasAnteriores = respostasRes.data?.filter(r => r.resposta_cidadao) || [];
    const conversasEnviadas = conversasRes.data?.filter(c => c.content && c.content.length > 20) || [];

    // ═══ Ranquear scripts por relevância ═══
    const rankedScripts = scripts
      .map(s => ({
        ...s,
        score: scoreRelevance(`${s.titulo} ${s.conteudo} ${(s.tags || []).join(" ")} ${s.categoria}`, keywords)
      }))
      .sort((a, b) => b.score - a.score);

    const topScripts = rankedScripts.slice(0, 15);
    const topRespostas = respostasAnteriores
      .map(r => ({ ...r, score: scoreRelevance(`${r.assunto} ${r.bairro} ${r.secretaria_identificada} ${r.resposta_cidadao}`, keywords) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const scriptsCount = scripts.length;
    const baseInfoCount = baseInfo.length;
    const respostasCount = respostasAnteriores.length;
    const conversasCount = conversasEnviadas.length;

    // ═══ Montar contexto priorizando scripts relevantes ═══
    const contextoInterno = `
═══ SCRIPTS DO GABINETE (FONTE PRIMÁRIA — use como base!) ═══
${topScripts.length > 0
  ? topScripts.map(s => `[${s.categoria}] ${s.titulo} (relevância: ${s.score}):\n${s.conteudo?.substring(0, 400)}`).join("\n---\n")
  : "Nenhum script cadastrado."}

═══ RESPOSTAS JÁ ENVIADAS PELO GABINETE (copie o tom e estilo!) ═══
${topRespostas.length > 0
  ? topRespostas.map(r => `[${r.secretaria_identificada || "Geral"}] Assunto: ${r.assunto}\n${r.resposta_cidadao?.substring(0, 300)}`).join("\n---\n")
  : "Nenhuma resposta anterior."}

═══ MENSAGENS REAIS DO WHATSAPP DO FABÃO (referência de tom de voz) ═══
${conversasEnviadas.slice(0, 10).map(c => c.content?.substring(0, 200)).join("\n---\n") || "Nenhuma conversa encontrada."}

═══ BANCO DE INFORMAÇÕES ═══
${baseInfo.slice(0, 10).map(b => `[${b.categoria || "Geral"}] ${b.titulo}: ${b.descricao?.substring(0, 200) || ""} ${b.orgao ? `(${b.orgao})` : ""}`).join("\n") || "Nenhuma informação."}
    `.trim();

    const protocolo = numero ? `${numero}` : "ainda não atribuído";

    const systemPrompt = `Você é o FABÃO — Vereador Fabão de Uberlândia-MG. Você NÃO é uma IA, você é o Fabão respondendo pessoalmente pelo WhatsApp.

═══ QUEM VOCÊ É ═══
- Vereador próximo do povo, que fala como gente de verdade
- Você GRAVA ÁUDIOS no WhatsApp mas responde em texto também
- Usa expressões mineiras naturais: "Então...", "Ô...", "Pode deixar...", "Deixa comigo..."
- Tom ACOLHEDOR, FIRME e HUMANO — nunca robótico ou formal
- Sempre usa primeira pessoa: "eu vou", "já encaminhei", "estou em cima"

═══ REGRA DE OURO: SCRIPTS SÃO SUA BÍBLIA ═══
Se existir um script no material interno que corresponda à situação:
→ USE O CONTEÚDO DO SCRIPT como base da resposta
→ Adapte levemente o tom mas MANTENHA as informações e links do script
→ NÃO invente informações que não estão no script
Se não houver script correspondente, use as respostas anteriores como referência de tom.

═══ COMO RESPONDER ═══
1. Saudação calorosa pelo nome (com emoji 😊 ou 👋)
2. Demonstre que ENTENDEU o problema (cite o local/situação específica)
3. Dê a SOLUÇÃO CONCRETA: o que você vai fazer ou já fez
4. Feche com compromisso de acompanhamento e emoji motivacional (💪, 🙏, 👍)

═══ TOM OBRIGATÓRIO ═══
- Como se fosse um ÁUDIO do WhatsApp transcrito em texto
- Emojis com moderação: 2-3 por mensagem (😊 💪 🙏 👍 🎉)
- Máximo 5-6 linhas
- Direto, sem enrolação
- SEMPRE ofereça uma ação prática (encaminhar, cobrar, verificar)

═══ EXEMPLOS DO FABÃO ═══

Exemplo — Buraco na rua:
"Ô [NOME], tudo bem? 😊
Entendo sua preocupação com esse buraco aí no [BAIRRO], é perigoso mesmo! Já encaminhei ofício pra Secretaria de Obras cobrando o tapa-buraco urgente na região.
Pode deixar que vou acompanhar pessoalmente e te dou retorno! 💪"

Exemplo — Iluminação:
"[NOME], obrigado por avisar! 👍
Esse poste apagado no [LOCAL] é um risco pra segurança de todo mundo. Já acionei a DMAE/Iluminação pra resolver isso o mais rápido possível.
Assim que tiver novidade, te aviso por aqui! 🙏"

Exemplo — Saúde:
"Oi, [NOME]! 😊
Sei como é difícil essa situação com saúde, viu? Já entrei em contato com a Secretaria de Saúde pedindo prioridade no seu caso.
Estou de olho e te passo retorno assim que tiver resposta. Conta comigo! 💪"

═══ PROIBIDO ═══
- "Prezado(a)", "Vossa Senhoria", "Venho por meio deste"
- "Comunicamos", "Informamos", "Em atenção ao seu contato"
- Qualquer tom de ofício/carta formal
- Respostas secas, curtas ou genéricas tipo "Vou verificar."
- Parecer IA ou chatbot — você é o FABÃO, gente de verdade

═══ IMPORTANTE ═══
Retorne APENAS o texto da resposta, sem aspas, sem prefixos, sem explicações.`;

    const userPrompt = `═══ MATERIAL INTERNO DO GABINETE ═══
${contextoInterno}

═══ DEMANDA DO CIDADÃO PARA RESPONDER AGORA ═══
PROTOCOLO: ${protocolo}
NOME: ${solicitante || "Não informado"}
ASSUNTO: ${assunto || "Não informado"}
DESCRIÇÃO: ${descricao || "Não detalhada"}
LOCAL: ${local || "Não informado"}
BAIRRO: ${bairro || "Não informado"}
SECRETARIA: ${secretaria || destinatario || "A identificar"}
TIPO: ${tipo_demanda || "Solicitação"}
URGÊNCIA: ${urgencia || "Normal"}

Gere a resposta como o Fabão responderia no WhatsApp. Use os scripts e respostas anteriores como base. Seja humano, empático, e dê uma solução concreta.`;

    // ═══ Chamar IA ═══
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
        max_tokens: 600,
        temperature: 0.5,
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
    const aiTexto = aiData.choices?.[0]?.message?.content?.trim() || "";
    const resposta = aiTexto ? cleanQuotedResponse(aiTexto) : buildFallback(solicitante, local, bairro);

    return new Response(JSON.stringify({
      resposta,
      fontes: {
        scripts: scriptsCount,
        base_info: baseInfoCount,
        respostas_anteriores: respostasCount,
        conversas_whatsapp: conversasCount,
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

function buildFallback(solicitante?: string | null, local?: string | null, bairro?: string | null): string {
  const nome = solicitante && solicitante !== "Não informado" ? solicitante : "meu amigo";
  const localRef = local && local !== "Não informado"
    ? local
    : bairro && bairro !== "Não informado"
      ? `o bairro ${bairro}`
      : "essa situação que você me passou";

  return `Ô ${nome}, tudo bem? 😊\nEntendo sua preocupação com ${localRef}, e obrigado por me avisar!\nPode deixar que já vou encaminhar pra secretaria responsável e cobrar retorno pessoalmente.\nAssim que tiver novidade, te aviso por aqui. Conta comigo! 💪`;
}
