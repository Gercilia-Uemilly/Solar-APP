import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WP_API = "https://sosuberlandia.com.br/wp-json/wp/v2/posts";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(title: string, content: string): string[] {
  const text = `${title} ${content}`.toLowerCase();
  const keywords: string[] = [];
  
  const bairros = ["santa mônica", "tibery", "morumbi", "luizote", "umuarama", "segismundo pereira", "saraiva", "jardim karaíba", "roosevelt", "planalto", "custódio pereira", "tubalina", "martins", "brasil", "guarani", "tabajaras", "santa rosa", "patrimônio", "daniel fonseca", "osvaldo rezende", "jaraguá", "granada", "novo mundo", "chácaras tubalina", "presidente roosevelt", "mansour", "minas gerais", "são jorge", "laranjeiras", "shopping park"];
  
  for (const b of bairros) {
    if (text.includes(b)) keywords.push(b);
  }
  
  const temas = ["saúde", "educação", "segurança", "trânsito", "transporte", "infraestrutura", "meio ambiente", "cultura", "esporte", "habitação", "emprego", "concurso", "licitação", "obra"];
  for (const t of temas) {
    if (text.includes(t)) keywords.push(t);
  }
  
  return keywords.slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Auth: aceita (a) segredo interno (cron/n8n) ou (b) usuário autenticado (botão na interface)
    const internalSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET_N8N") || Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
    const providedSecret = req.headers.get("x-internal-secret") || "";
    const authHeader = req.headers.get("Authorization");

    let supabase;
    if (internalSecret && providedSecret === internalSecret) {
      // Chamada interna agendada: usa service role para gravar
      supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    } else {
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      // Validate user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json().catch(() => ({}));
    const pages = Math.min(body.pages || 3, 50); // max 50 pages (1000 posts)
    const perPage = 20;

    let inserted = 0;
    let skipped = 0;
    let totalFetched = 0;

    for (let page = 1; page <= pages; page++) {
      // orderby=date&order=desc -> always fetch newest first
      const url = `${WP_API}?per_page=${perPage}&page=${page}&orderby=date&order=desc&_fields=id,title,content,excerpt,link,date,categories`;
      
      console.log(`Fetching page ${page}: ${url}`);
      
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`Page ${page} returned ${res.status}, stopping.`);
        break;
      }

      const posts = await res.json();
      if (!Array.isArray(posts) || posts.length === 0) break;

      totalFetched += posts.length;

      const toInsert: any[] = [];

      for (const post of posts) {
        const link = post.link || "";
        if (!link) continue;

        const titulo = stripHtml(post.title?.rendered || "Sem título");
        const rawContent = post.content?.rendered || post.excerpt?.rendered || "";
        const descricao = stripHtml(rawContent).substring(0, 2000);
        const dataPub = post.date ? new Date(post.date).toISOString() : new Date().toISOString();
        const palavrasChave = extractKeywords(titulo, descricao);

        // Try to detect bairro from content
        let bairro: string | null = null;
        const bairroMatch = descricao.match(/bairro\s+([A-Za-zÀ-ú\s]+?)(?:\.|,|\s{2}|$)/i);
        if (bairroMatch) bairro = bairroMatch[1].trim().substring(0, 60);

        toInsert.push({
          titulo,
          descricao: descricao || null,
          link,
          data_publicacao: dataPub,
          fonte: "SOS Uberlândia",
          categoria: "Notícia",
          palavras_chave: palavrasChave.length > 0 ? palavrasChave : null,
          bairro,
          modelo: false,
        });
      }

      // Upsert atualizando registros existentes (corrige datas vazias e títulos antigos);
      // baseia-se no índice único parcial base_conhecimento_sos_link_unique (link) WHERE fonte='SOS Uberlândia'
      if (toInsert.length > 0) {
        const { data: upserted, error } = await supabase
          .from("base_conhecimento")
          .upsert(toInsert, { onConflict: "link" })
          .select("id");
        if (error) {
          console.error("Insert error:", error);
        } else {
          const newCount = upserted?.length || 0;
          inserted += newCount;
          skipped += toInsert.length - newCount;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFetched,
        inserted,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching SOS Uberlândia:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
