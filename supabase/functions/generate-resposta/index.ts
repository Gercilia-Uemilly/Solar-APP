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
  t = t.replace(/^(Resposta:?\s*|Sugestão:?\s*)/i, "").trim();
  return t;
};

const scoreRelevance = (text: string, keywords: string[]): number => {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return keywords.reduce((score, kw) => {
    if (!lower.includes(kw)) return score;
    if (kw.length > 6) return score + 3;
    if (kw.length > 4) return score + 2;
    return score + 1;
  }, 0);
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

    // Palavras-chave da demanda para ranquear relevância (filtro > 2 letras)
    const demandaText = `${assunto || ""} ${descricao || ""} ${bairro || ""} ${local || ""} ${secretaria || ""} ${tipo_demanda || ""}`.toLowerCase();
    const keywords = demandaText.split(/\s+/).filter(w => w.length > 2);

    // ═══ Buscar dados em paralelo ═══
    const [scriptsRes, baseInfoRes, respostasRes, conversasRes] = await Promise.all([
      supabaseAdmin.from("scripts").select("titulo, conteudo, categoria, tags").order("created_at", { ascending: false }).limit(80),
      supabaseAdmin.from("base_conhecimento").select("titulo, descricao, categoria, orgao, bairro").order("created_at", { ascending: false }).limit(60),
      supabaseAdmin.from("oficios").select("resposta_cidadao, assunto, bairro, secretaria_identificada").not("resposta_cidadao", "is", null).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("whatsapp_messages").select("content, direction, sender_name").eq("direction", "outgoing").not("content", "is", null).order("created_at", { ascending: false }).limit(60),
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

    // Top 20 scripts, com conteúdo completo se score >= 3
    const topScripts = rankedScripts.slice(0, 20);
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
  ? topScripts.map(s => {
      // Se score >= 3, incluir conteúdo completo; senão limitar a 1000 chars
      const conteudo = s.score >= 3 ? s.conteudo : s.conteudo?.substring(0, 1000);
      return `[${s.categoria}] ${s.titulo} (relevância: ${s.score}):\n${conteudo}`;
    }).join("\n---\n")
  : "Nenhum script cadastrado."}

═══ RESPOSTAS JÁ ENVIADAS PELO GABINETE (copie o tom e estilo!) ═══
${topRespostas.length > 0
  ? topRespostas.map(r => `[${r.secretaria_identificada || "Geral"}] Assunto: ${r.assunto}\n${r.resposta_cidadao?.substring(0, 500)}`).join("\n---\n")
  : "Nenhuma resposta anterior."}

═══ MENSAGENS REAIS DO WHATSAPP DO FABÃO (referência de tom de voz) ═══
${conversasEnviadas.slice(0, 20).map(c => c.content?.substring(0, 400)).join("\n---\n") || "Nenhuma conversa encontrada."}

═══ BANCO DE INFORMAÇÕES ═══
${baseInfo.slice(0, 10).map(b => `[${b.categoria || "Geral"}] ${b.titulo}: ${b.descricao?.substring(0, 200) || ""} ${b.orgao ? `(${b.orgao})` : ""}`).join("\n") || "Nenhuma informação."}
    `.trim();

    const protocolo = numero ? `${numero}` : "ainda não atribuído";

    const systemPrompt = `Você É o Vereador Fabão de Uberlândia. Não é uma IA respondendo por ele, você É ele. Fala na primeira pessoa como se estivesse gravando um áudio no WhatsApp para um morador que te pediu ajuda. Seu jeito é caloroso, mineiro, direto, humano e nunca robótico. Você conhece cada rua de Uberlândia, cada secretaria, cada problema da cidade. Quando alguém te manda uma demanda você responde como um amigo vereador que realmente se importa e já está tomando providências.

═══ SEU JEITO DE FALAR ═══
Use expressões naturais como "Ô", "Então", "Pode deixar", "Deixa comigo", "Vou correr atrás", "Tô em cima disso", "Já mexi nisso", "Obrigado por me avisar". Nunca use palavras formais como "Prezado", "Comunicamos", "Informamos", "Venho por meio deste", "Em atenção ao seu contato". Emojis com naturalidade: dois ou três por mensagem no máximo. Frases curtas como áudio transcrito. Sempre termine com compromisso concreto e acolhimento.

═══ REGRA DOS SCRIPTS ═══
Se existir script no material interno com relevância para a demanda, EXTRAIA as informações concretas como telefones, links, nomes de secretaria, procedimentos, e incorpore naturalmente na resposta como se o Fabão soubesse de cabeça. Nunca diga que está usando um script. As informações do script devem soar como conhecimento natural do Fabão sobre a cidade.

═══ PROIBIDO ABSOLUTAMENTE ═══
- "Entendi que a situação", "Compreendo que", "Conforme analisado", "Segue em anexo", "Diante do exposto"
- Qualquer estrutura de ofício ou carta formal
- Resumir o problema do cidadão de forma analítica
- Parecer chatbot ou IA
- "Prezado(a)", "Vossa Senhoria", "Venho por meio deste"
- "Comunicamos", "Informamos", "Em atenção ao seu contato"
- Respostas secas, curtas ou genéricas tipo "Vou verificar."

═══ ESTRUTURA DA RESPOSTA ═══
1. Saudação pelo nome com emoji
2. Uma frase curta mostrando que entendeu o problema de forma humana e empática
3. A solução concreta com informações reais do script se existir
4. Fechamento com compromisso pessoal e emoji motivador
Máximo 6 linhas.

═══ EXEMPLOS DO FABÃO ═══

Exemplo buraco na rua:
"Ô [NOME], que situação hein! 😤 Esse buraco no [LOCAL] tá perigoso mesmo, já recebi reclamação de outros moradores também. Já mandei ofício pra Secretaria de Obras pedindo tapa-buraco urgente na região. Pode deixar que vou ficar em cima até resolver! 💪"

Exemplo saúde:
"Oi [NOME]! 😊 Sei como é sofrido passar por isso com a saúde, viu. Já entrei em contato com a Secretaria de Saúde pedindo prioridade. Se precisar de mais apoio, a Defensoria Pública atende pelo (34) 3239-2800 e pode te ajudar também. Tô do seu lado nisso! 🙏"

Exemplo animal:
"[NOME], obrigado por me avisar! 🐾 Esse tipo de situação não pode ficar assim. Você pode ligar agora pro SIM no (34) 3239-2800 ou mandar zap pro 99246-2508 que eles atendem. Eu também já vou acionar a Patrulha Ambiental por aqui. Juntos a gente resolve! 💪"

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
        model: "gpt-4o",
        max_tokens: 600,
        temperature: 0.8,
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

  return `Ô ${nome}, que bom que você me avisou! 😊 Entendo a situação com ${localRef} e já vou tomar as providências necessárias. Vou encaminhar pra secretaria responsável e ficar em cima até ter um retorno. Pode contar comigo que não vou deixar na mão! 💪`;
}
