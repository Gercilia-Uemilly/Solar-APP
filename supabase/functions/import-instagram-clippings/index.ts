const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const authorNome = profile?.full_name || user.email || "Usuário";

    const { links } = await req.json();
    
    if (!links || !Array.isArray(links) || links.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum link fornecido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter valid Instagram links
    const validLinks = links
      .map((l: string) => l.trim())
      .filter((l: string) => l && (l.includes("instagram.com") || l.includes("instagr.am")));

    if (validLinks.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum link válido do Instagram encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check existing links to avoid duplicates
    const { data: existingClippings } = await supabase
      .from("clippings")
      .select("link")
      .in("link", validLinks);

    const existingLinks = new Set((existingClippings || []).map((c: any) => c.link));

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    
    const results = {
      inserted: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const link of validLinks) {
      // Skip if already exists
      if (existingLinks.has(link)) {
        results.skipped++;
        continue;
      }

      let titulo = "";
      let descricao = "";
      let tipo = link.includes("/reel") ? "Reel" : "Post";

      // Try to scrape with Firecrawl if available
      if (FIRECRAWL_API_KEY) {
        try {
          const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: link,
              formats: ["markdown"],
              onlyMainContent: true,
            }),
          });

          if (scrapeResp.ok) {
            const scrapeData = await scrapeResp.json();
            const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
            const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

            // Extract title from metadata or first line of markdown
            titulo = metadata.title || "";
            if (!titulo && markdown) {
              const firstLine = markdown.split("\n").find((l: string) => l.trim());
              titulo = firstLine?.replace(/^#+\s*/, "").slice(0, 200) || "";
            }

            // Use markdown as description (limit length)
            descricao = markdown.slice(0, 1000);
          }
        } catch (scrapeErr) {
          console.error("Firecrawl error for", link, scrapeErr);
        }
      }

      // Fallback title if scraping failed
      if (!titulo) {
        titulo = `${tipo} do Instagram`;
      }

      // Insert the clipping
      const { error: insertError } = await supabase.from("clippings").insert({
        link,
        titulo,
        descricao: descricao || null,
        fonte: "Instagram",
        tipo,
        sentimento: "neutro",
        author_id: user.id,
        author_nome: authorNome,
        data_publicacao: new Date().toISOString(),
      });

      if (insertError) {
        results.failed++;
        results.errors.push(`${link}: ${insertError.message}`);
      } else {
        results.inserted++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: validLinks.length,
      inserted: results.inserted,
      skipped: results.skipped,
      failed: results.failed,
      errors: results.errors.slice(0, 5), // Return first 5 errors
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Import error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
