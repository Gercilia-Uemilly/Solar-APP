import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractCDATA(item: string, tag: string): string {
  const regex = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, "i");
  const match = item.match(regex);
  if (match) return match[1].trim();
  // fallback: plain tag
  const plain = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const m2 = item.match(plain);
  return m2 ? m2[1].trim() : "";
}

function extractTag(item: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const match = item.match(regex);
  return match ? match[1].trim() : "";
}

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

function parseWpDate(dateStr: string): string | null {
  if (!dateStr) return null;
  // wp:post_date_gmt format: "2023-05-15 14:30:00"
  const d = new Date(dateStr.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: corsHeaders });
    }
    const userId = claims.claims.sub as string;

    // Check admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: corsHeaders });
    }

    // Get user name
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).single();
    const authorName = profile?.full_name || "Admin";

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), { status: 400, headers: corsHeaders });
    }

    const content = await file.text();

    // Extract items
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const items: string[] = [];
    let match;
    while ((match = itemRegex.exec(content)) !== null) {
      items.push(match[1]);
    }

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "No items found in XML" }), { status: 400, headers: corsHeaders });
    }

    // Get existing links to avoid duplicates
    const { data: existingClippings } = await supabase.from("clippings").select("link");
    const existingLinks = new Set((existingClippings || []).map((c: any) => c.link).filter(Boolean));

    const clippingsToInsert: any[] = [];
    let skipped = 0;

    for (const item of items) {
      // Only import published posts
      const status = extractCDATA(item, "wp:status");
      if (status !== "publish") {
        skipped++;
        continue;
      }

      const postType = extractCDATA(item, "wp:post_type");
      if (postType !== "post") {
        skipped++;
        continue;
      }

      const link = extractTag(item, "link");
      if (existingLinks.has(link)) {
        skipped++;
        continue;
      }

      const titulo = extractCDATA(item, "title") || "Sem título";
      const rawContent = extractCDATA(item, "content:encoded");
      const descricao = stripHtml(rawContent).substring(0, 2000);
      const dataPub = parseWpDate(extractCDATA(item, "wp:post_date_gmt"));

      clippingsToInsert.push({
        titulo,
        descricao: descricao || null,
        link: link || null,
        data_publicacao: dataPub || new Date().toISOString(),
        fonte: "SOS Uberlândia",
        tipo: "Notícia",
        sentimento: "neutro",
        author_id: userId,
        author_nome: authorName,
      });
    }

    // Batch insert (100 at a time)
    let inserted = 0;
    const batchSize = 100;
    for (let i = 0; i < clippingsToInsert.length; i += batchSize) {
      const batch = clippingsToInsert.slice(i, i + batchSize);
      const { error } = await supabase.from("clippings").insert(batch);
      if (!error) {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalItems: items.length,
        inserted,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing WordPress import:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
