const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdminResult } = await supabaseAuth.rpc("is_admin", { _user_id: user.id });
    if (!isAdminResult) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { limit = 10 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: entries, error: fetchError } = await supabase
      .from("base_conhecimento")
      .select("id, link, titulo, descricao, categoria, palavras_chave")
      .eq("fonte", "Instagram")
      .or("titulo.eq.Instagram @fabaovereador,titulo.like.%Post do Instagram%,titulo.like.%Reel do Instagram%")
      .limit(limit);

    if (fetchError) {
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, updated: 0, message: "Nenhum post pendente" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const linksData = entries.map((e: any, i: number) => {
      const tipo = e.link?.includes("/reel/") ? "Reel" : "Post";
      return `${i + 1}. [${tipo}] ${e.link}`;
    }).join("\n");

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você classifica posts do Instagram do vereador Fabão (Uberlândia/MG).
Para cada link, gere um título descritivo com emoji e classifique o tema e tags.

Temas possíveis: Saúde, Educação, Transporte, Segurança, Infraestrutura, Meio Ambiente, Social, Cultura, Esporte, Político, Comunicado, Agradecimento, Evento, Conquista, Outro.

Responda com um JSON array. Cada item: {"index": N, "titulo": "...", "tema": "...", "tags": ["...", "..."]}
Responda APENAS o JSON array, sem markdown.`,
          },
          {
            role: "user",
            content: `Classifique estes ${entries.length} posts:\n${linksData}`,
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${aiResponse.status}` }), {
        status: aiResponse.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let classifications: any[] = [];
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      classifications = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content.slice(0, 500));
      return new Response(JSON.stringify({ error: "Falha ao interpretar resposta da IA", raw: content.slice(0, 200) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    let failed = 0;

    for (const cls of classifications) {
      const idx = (cls.index || cls.i) - 1;
      const entry = entries[idx];
      if (!entry) continue;

      const { error: updateError } = await supabase
        .from("base_conhecimento")
        .update({
          titulo: (cls.titulo || "").slice(0, 200),
          categoria: cls.tema || "Outro",
          palavras_chave: cls.tags || [],
        })
        .eq("id", entry.id);

      if (updateError) {
        failed++;
        console.error("Update error:", entry.id, updateError.message);
      } else {
        updated++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: entries.length,
      processed: classifications.length,
      updated,
      failed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Classification error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
