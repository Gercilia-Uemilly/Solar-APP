import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um sistema de aprendizado de atendimento de WhatsApp de um gabinete político do Vereador Fabão em Uberlândia-MG.

Você recebe:
1. Uma conversa real de WhatsApp (com mensagens do cidadão e respostas do atendente)
2. A lista de scripts que já existem no banco

Sua missão:
- Analisar a conversa
- Identificar a intenção principal
- Extrair palavras-chave
- Extrair o padrão de linguagem (tom humano, estilo mineiro)
- Decidir se deve CRIAR um novo script ou MELHORAR um existente

REGRAS DO SCRIPT:
- Curto, estilo WhatsApp real
- Primeiro passo da conversa (não resposta completa)
- SEMPRE puxar continuidade com pergunta
- Linguagem humana, simples, estilo mineiro ("viu?", "né?", "tá?")
- Emojis permitidos: 😊, 🙏, 😔, 😕
- Proibido: 👍
- NUNCA encerrar atendimento
- NUNCA usar "estou à disposição" ou similar
- Toda resposta termina com pergunta útil

Retorne EXATAMENTE um JSON array (sem markdown):
[
  {
    "action": "create" ou "update",
    "existing_script_id": null ou "uuid do script existente se for update",
    "titulo": "Título do script",
    "categoria": "Categoria",
    "palavras_chave": ["kw1", "kw2"],
    "script_base": "Texto do script conversacional",
    "observacao": "Nota sobre o que foi aprendido"
  }
]

Se a conversa não tiver conteúdo útil para scripts, retorne: []`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: authErr } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_ids, conversa_text } = await req.json();

    // Fetch existing scripts for comparison
    const { data: existingScripts } = await sb
      .from("scripts")
      .select("id, titulo, categoria, tags, conteudo")
      .order("titulo");

    const scriptsSummary = (existingScripts || []).map(s =>
      `[${s.id}] ${s.categoria} | ${s.titulo} | tags: ${(s.tags || []).join(", ")}`
    ).join("\n");

    let conversationsText = "";

    if (conversa_text) {
      // Direct text input
      conversationsText = conversa_text;
    } else if (conversation_ids?.length > 0) {
      // Fetch from DB
      for (const convId of conversation_ids.slice(0, 5)) {
        const { data: conv } = await sb
          .from("whatsapp_conversations")
          .select("contact_name")
          .eq("id", convId)
          .single();

        const { data: msgs } = await sb
          .from("whatsapp_messages")
          .select("direction, content, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true })
          .limit(50);

        if (msgs && msgs.length > 0) {
          conversationsText += `\n--- Conversa com ${conv?.contact_name || "Desconhecido"} ---\n`;
          for (const m of msgs) {
            const who = m.direction === "incoming" ? "Cidadão" : "Atendente";
            conversationsText += `${who}: ${m.content || "[mídia]"}\n`;
          }
        }
      }
    } else {
      // Auto: fetch recent conversations with 3+ messages
      const { data: recentConvs } = await sb
        .from("whatsapp_conversations")
        .select("id, contact_name")
        .order("last_message_at", { ascending: false })
        .limit(10);

      for (const conv of (recentConvs || []).slice(0, 5)) {
        const { data: msgs } = await sb
          .from("whatsapp_messages")
          .select("direction, content, created_at")
          .eq("conversation_id", conv.id)
          .order("created_at", { ascending: true })
          .limit(50);

        if (msgs && msgs.length >= 3) {
          conversationsText += `\n--- Conversa com ${conv.contact_name || "Desconhecido"} ---\n`;
          for (const m of msgs) {
            const who = m.direction === "incoming" ? "Cidadão" : "Atendente";
            conversationsText += `${who}: ${m.content || "[mídia]"}\n`;
          }
        }
      }
    }

    if (!conversationsText.trim()) {
      return new Response(JSON.stringify({ results: [], message: "Nenhuma conversa encontrada para analisar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Gemini
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) throw new Error("GOOGLE_AI_API_KEY não configurada");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const userPrompt = `SCRIPTS EXISTENTES NO BANCO (${(existingScripts || []).length} scripts):\n${scriptsSummary}\n\n---\n\nCONVERSAS PARA ANALISAR:\n${conversationsText}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 4096, temperature: 0.5 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini error:", response.status, errText);
      throw Object.assign(new Error(`Erro Gemini: ${response.status}`), { status: response.status });
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    let suggestions: any[];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      suggestions = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      suggestions = [];
    }

    // Auto-apply: create or update scripts
    const results: any[] = [];
    const userId = userData.user.id;

    for (const s of suggestions) {
      try {
        if (s.action === "update" && s.existing_script_id) {
          await sb.from("scripts").update({
            conteudo: s.script_base,
            tags: s.palavras_chave || [],
          }).eq("id", s.existing_script_id);
          results.push({ action: "updated", titulo: s.titulo, id: s.existing_script_id });
        } else {
          const { data: inserted } = await sb.from("scripts").insert({
            titulo: s.titulo || "Script aprendido",
            conteudo: s.script_base || "",
            categoria: s.categoria || "Outros",
            tags: s.palavras_chave || [],
            author_id: userId,
          }).select("id").single();
          results.push({ action: "created", titulo: s.titulo, id: inserted?.id });
        }
      } catch (e: any) {
        results.push({ action: "error", titulo: s.titulo, error: e.message });
      }
    }

    return new Response(JSON.stringify({
      results,
      analyzed_conversations: conversationsText.split("---").length - 1,
      suggestions_count: suggestions.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("learn-from-conversations error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: e.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
