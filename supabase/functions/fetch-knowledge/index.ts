import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return (match?.[1] || match?.[2] || "").trim();
}

function extractAllItems(xml: string): string[] {
  const items: string[] = [];
  let startIdx = 0;
  while (true) {
    const start = xml.indexOf("<item>", startIdx);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    items.push(xml.substring(start, end + 7));
    startIdx = end + 7;
  }
  return items;
}

async function enrichWithAI(newEntries: { index: number; entry: any }[], supabaseUrl: string, supabaseKey: string) {
  if (newEntries.length === 0) return;

  const batchSize = 10;
  for (let b = 0; b < newEntries.length; b += batchSize) {
    const batch = newEntries.slice(b, b + batchSize);
    const batchText = batch.map((ne, i) => `[${i}] ${ne.entry.titulo}: ${ne.entry.descricao || ""}`).join("\n");

    try {
      const result = await callGemini({
        model: "gemini-2.5-flash-lite",
        systemInstruction: `Extraia de cada notícia: palavras_chave (string[]), orgao (string|null - órgão municipal), bairro (string|null). Responda com JSON array.`,
        messages: [{ role: "user", parts: [{ text: batchText }] }],
        tools: [{
          functionDeclarations: [{
            name: "extract_news_data",
            description: "Extract structured data from news items",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      index: { type: "number" },
                      palavras_chave: { type: "array", items: { type: "string" } },
                      orgao: { type: "string" },
                      bairro: { type: "string" },
                    },
                    required: ["index", "palavras_chave"],
                  },
                },
              },
              required: ["items"],
            },
          }],
        }],
        toolConfig: {
          functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["extract_news_data"] },
        },
      });

      if (result.toolCalls) {
        for (const tc of result.toolCalls) {
          const extracted = tc.functionCall?.args || {};
          for (const item of extracted.items || []) {
            if (item.index >= 0 && item.index < batch.length) {
              const ne = batch[item.index];
              if (ne.entry.id) {
                const updateBody: any = {};
                if (item.palavras_chave) updateBody.palavras_chave = item.palavras_chave;
                if (item.orgao) updateBody.orgao = item.orgao;
                if (item.bairro) updateBody.bairro = item.bairro;

                await fetch(
                  `${supabaseUrl}/rest/v1/base_conhecimento?id=eq.${ne.entry.id}`,
                  {
                    method: "PATCH",
                    headers: {
                      apikey: supabaseKey,
                      Authorization: `Bearer ${supabaseKey}`,
                      "Content-Type": "application/json",
                      Prefer: "return=minimal",
                    },
                    body: JSON.stringify(updateBody),
                  }
                );
              }
            }
          }
        }
      }
    } catch (aiErr) {
      console.error("AI batch error (non-fatal):", aiErr);
    }
  }
}

async function saveEntry(entry: any, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (entry.link) {
    const checkResp = await fetch(
      `${supabaseUrl}/rest/v1/base_conhecimento?link=eq.${encodeURIComponent(entry.link)}&select=id`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const existing = await checkResp.json();
    if (existing.length > 0) return null;
  }

  const insertResp = await fetch(`${supabaseUrl}/rest/v1/base_conhecimento`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(entry),
  });
  if (insertResp.ok) {
    const inserted = await insertResp.json();
    return inserted[0]?.id || null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    let userId: string;
    try {
      const { data: claimsData, error: claimsErr } = await _sb.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        console.error("getClaims failed:", claimsErr?.message, JSON.stringify(claimsData));
        return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = claimsData.claims.sub as string;
    } catch (authErr: any) {
      console.error("Auth error:", authErr?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin-only: check role before allowing knowledge base writes
    const adminCheckClient = createClient(supabaseUrl, supabaseKey);
    const { data: isAdmin } = await adminCheckClient.rpc("is_admin", { _user_id: userId });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem acessar esta função" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { action, limit, url: instaUrl } = body;

    if (action === "fetch_rss") {
      const rssUrl = "https://sosuberlandia.com.br/feed";
      const resp = await fetch(rssUrl, {
        headers: { "User-Agent": "TheOffice30-Bot/1.0" },
      });

      if (!resp.ok) throw new Error(`RSS fetch failed: ${resp.status}`);

      const xml = await resp.text();
      const items = extractAllItems(xml);
      const maxItems = Math.min(items.length, limit || 100);

      console.log(`Found ${items.length} items in RSS, processing ${maxItems}`);

      let savedCount = 0;
      const newEntries: { index: number; entry: any }[] = [];

      for (let i = 0; i < maxItems; i++) {
        const item = items[i];
        const titulo = extractTag(item, "title");
        const link = extractTag(item, "link");
        const pubDate = extractTag(item, "pubDate");
        const descricaoRaw = extractTag(item, "description");
        const descricao = descricaoRaw.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8211;/g, "–").replace(/&#8230;/g, "…").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').trim();

        const entry = {
          titulo,
          descricao,
          link,
          data_publicacao: pubDate ? new Date(pubDate).toISOString() : null,
          fonte: "SOS Uberlândia",
          categoria: "Notícia",
        };

        const id = await saveEntry(entry, supabaseUrl, supabaseKey);
        if (id) {
          savedCount++;
          newEntries.push({ index: newEntries.length, entry: { ...entry, id } });
        }
      }

      console.log(`Saved ${savedCount} new entries. Enriching with AI...`);
      await enrichWithAI(newEntries, supabaseUrl, supabaseKey);

      return new Response(
        JSON.stringify({ success: true, total: items.length, saved: savedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "scrape_all") {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (!FIRECRAWL_API_KEY) {
        throw new Error("Firecrawl não configurado. Conecte o Firecrawl nas configurações.");
      }

      console.log("Scraping SOS Uberlândia news category page...");
      const scrapeListResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: "https://sosuberlandia.com.br/category/noticias/",
          formats: ["links", "markdown"],
          onlyMainContent: true,
        }),
      });

      if (!scrapeListResp.ok) {
        const err = await scrapeListResp.text();
        throw new Error(`Firecrawl scrape failed: ${err}`);
      }

      const scrapeListData = await scrapeListResp.json();
      const allLinks: string[] = scrapeListData.data?.links || scrapeListData.links || [];
      const pageMarkdown: string = scrapeListData.data?.markdown || scrapeListData.markdown || "";

      console.log(`Found ${allLinks.length} links on the category page`);

      const excludePatterns = ["/category/", "/tag/", "/page/", "/feed", "/wp-content/", "/wp-json/", "/author/", "/sos-uberlandia-lanca-site", "/politica-de-privacidade", "#"];
      const newsLinks = allLinks.filter((url: string) => {
        if (!url.startsWith("https://sosuberlandia.com.br/")) return false;
        if (url === "https://sosuberlandia.com.br/" || url === "https://sosuberlandia.com.br") return false;
        for (const p of excludePatterns) {
          if (url.includes(p)) return false;
        }
        return url.split("/").filter(Boolean).length >= 3;
      });
      const uniqueLinks = [...new Set(newsLinks)];

      console.log(`Found ${uniqueLinks.length} unique news URLs from ${allLinks.length} total links`);

      const articleRegex = /###\s*\[([^\]]+)\]\(([^)]+)\)\s*\n\s*\n\s*(?:(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})\s*\n\s*\n\s*)?([^\n#[]*)/g;
      const articlesFromPage: Map<string, { titulo: string; descricao: string; data: string | null }> = new Map();
      let match;
      while ((match = articleRegex.exec(pageMarkdown)) !== null) {
        const url = match[2];
        if (!articlesFromPage.has(url)) {
          articlesFromPage.set(url, {
            titulo: match[1].trim(),
            descricao: (match[4] || "").trim(),
            data: match[3] || null,
          });
        }
      }

      console.log(`Extracted ${articlesFromPage.size} articles from page markdown`);

      let savedCount = 0;
      const newEntries: { index: number; entry: any }[] = [];

      for (const link of uniqueLinks) {
        const articleInfo = articlesFromPage.get(link);
        const titulo = articleInfo?.titulo || link.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Sem título";
        const descricao = articleInfo?.descricao || "";

        const entry = {
          titulo,
          descricao: descricao || null,
          link,
          data_publicacao: null,
          fonte: "SOS Uberlândia",
          categoria: "Notícia",
        };

        const id = await saveEntry(entry, supabaseUrl, supabaseKey);
        if (id) {
          savedCount++;
          newEntries.push({ index: newEntries.length, entry: { ...entry, id } });
        }
      }

      console.log(`Saved ${savedCount} new articles. Enriching with AI...`);
      await enrichWithAI(newEntries, supabaseUrl, supabaseKey);

      return new Response(
        JSON.stringify({ success: true, total: uniqueLinks.length, saved: savedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "import_instagram") {
      const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
      if (!FIRECRAWL_API_KEY) {
        throw new Error("Firecrawl não configurado. Conecte o Firecrawl nas configurações.");
      }

      const targetUrl = instaUrl || "https://www.instagram.com/fabaovereador/";
      const isSinglePost = targetUrl.includes("/p/") || targetUrl.includes("/reel/");

      if (isSinglePost) {
        console.log("Scraping single Instagram post:", targetUrl);
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: targetUrl,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });

        if (!scrapeResp.ok) {
          const err = await scrapeResp.text();
          console.error("Firecrawl single post error:", err);
          // Instagram not supported by Firecrawl - return fallback
          return new Response(
            JSON.stringify({ success: false, error: "Instagram não é suportado pelo Firecrawl. Use a importação manual de links na aba Clipping.", fallback: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const scrapeData = await scrapeResp.json();
        const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
        const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

        const lines = markdown.split("\n").filter((l: string) => l.trim());
        const titulo = metadata.title || lines[0]?.replace(/^#+\s*/, "").slice(0, 120) || "Post Instagram";
        const descricao = lines.slice(0, 10).join("\n").slice(0, 2000);

        return new Response(
          JSON.stringify({
            preview: {
              titulo,
              descricao,
              data: new Date().toISOString(),
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Scraping Instagram profile:", targetUrl);
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ["markdown", "links"],
          onlyMainContent: true,
        }),
      });

      if (!scrapeResp.ok) {
        const err = await scrapeResp.text();
        console.error("Firecrawl profile error:", err);
        return new Response(
          JSON.stringify({ success: false, error: "Instagram não é suportado pelo Firecrawl. Use a importação manual de links na aba Clipping.", fallback: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const scrapeData = await scrapeResp.json();
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
      const allLinks: string[] = scrapeData.data?.links || scrapeData.links || [];

      const postLinks = allLinks.filter((l: string) =>
        l.includes("instagram.com/p/") || l.includes("instagram.com/reel/")
      );
      const uniquePostLinks = [...new Set(postLinks)].slice(0, limit || 20);

      console.log(`Found ${uniquePostLinks.length} post links from profile`);

      const postBlocks = markdown.split(/\n(?=#{1,3}\s|\*\*|!\[)/).filter((b: string) => b.trim().length > 20);

      let savedCount = 0;
      const newEntries: { index: number; entry: any }[] = [];

      for (let i = 0; i < uniquePostLinks.length; i++) {
        const postLink = uniquePostLinks[i];
        const relatedBlock = postBlocks[i] || "";

        const blockLines = relatedBlock.split("\n").filter((l: string) => l.trim());
        const titulo = blockLines[0]?.replace(/^[#*!\[\]()]+\s*/g, "").slice(0, 120) || `Post Instagram #${i + 1}`;
        const descricao = blockLines.slice(0, 5).join("\n").replace(/^[#*!\[\]()]+\s*/g, "").slice(0, 1000) || null;

        const entry = {
          titulo,
          descricao,
          link: postLink,
          fonte: "Instagram",
          categoria: "Instagram",
          data_publicacao: new Date().toISOString(),
        };

        const id = await saveEntry(entry, supabaseUrl, supabaseKey);
        if (id) {
          savedCount++;
          newEntries.push({ index: newEntries.length, entry: { ...entry, id } });
        }
      }

      if (uniquePostLinks.length === 0 && postBlocks.length > 0) {
        for (let i = 0; i < Math.min(postBlocks.length, limit || 20); i++) {
          const block = postBlocks[i];
          const blockLines = block.split("\n").filter((l: string) => l.trim());
          const titulo = blockLines[0]?.replace(/^[#*!\[\]()]+\s*/g, "").slice(0, 120) || `Post Instagram #${i + 1}`;
          const descricao = blockLines.slice(0, 5).join("\n").slice(0, 1000) || null;

          if (titulo.length < 5) continue;

          const entry = {
            titulo,
            descricao,
            link: targetUrl,
            fonte: "Instagram",
            categoria: "Instagram",
            data_publicacao: new Date().toISOString(),
          };

          const id = await saveEntry(entry, supabaseUrl, supabaseKey);
          if (id) {
            savedCount++;
            newEntries.push({ index: newEntries.length, entry: { ...entry, id } });
          }
        }
      }

      if (newEntries.length > 0) {
        console.log(`Saved ${savedCount} Instagram posts. Enriching with AI...`);
        await enrichWithAI(newEntries, supabaseUrl, supabaseKey);
      }

      return new Response(
        JSON.stringify({ success: true, total: uniquePostLinks.length || postBlocks.length, saved: savedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("fetch-knowledge error:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
