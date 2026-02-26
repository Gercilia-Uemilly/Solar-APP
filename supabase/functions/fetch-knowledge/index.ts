import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, limit } = await req.json();

    if (action === "fetch_rss") {
      const rssUrl = "https://sosuberlandia.com.br/feed";
      const resp = await fetch(rssUrl, {
        headers: { "User-Agent": "TheOffice30-Bot/1.0" },
      });

      if (!resp.ok) {
        throw new Error(`RSS fetch failed: ${resp.status}`);
      }

      const xml = await resp.text();
      const items = extractAllItems(xml);
      const maxItems = Math.min(items.length, limit || 100);

      console.log(`Found ${items.length} items in RSS, processing ${maxItems}`);

      const entries = [];
      for (let i = 0; i < maxItems; i++) {
        const item = items[i];
        const titulo = extractTag(item, "title");
        const link = extractTag(item, "link");
        const pubDate = extractTag(item, "pubDate");
        const descricaoRaw = extractTag(item, "description");
        const descricao = descricaoRaw.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#8211;/g, "–").replace(/&#8230;/g, "…").replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').trim();

        entries.push({
          titulo,
          descricao,
          link,
          data_publicacao: pubDate ? new Date(pubDate).toISOString() : null,
          fonte: "SOS Uberlândia",
          categoria: "Notícia",
        });
      }

      // Save to database first (without AI), then enrich with AI for new entries only
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      let savedCount = 0;
      const newEntries: { index: number; entry: any }[] = [];

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const checkResp = await fetch(
          `${supabaseUrl}/rest/v1/base_conhecimento?link=eq.${encodeURIComponent(entry.link)}&select=id`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        const existing = await checkResp.json();

        if (existing.length === 0) {
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
            savedCount++;
            newEntries.push({ index: i, entry: { ...entry, id: inserted[0]?.id } });
          }
        }
      }

      console.log(`Saved ${savedCount} new entries. Enriching with AI...`);

      // Enrich new entries with AI in batches of 10
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY && newEntries.length > 0) {
        const batchSize = 10;
        for (let b = 0; b < newEntries.length; b += batchSize) {
          const batch = newEntries.slice(b, b + batchSize);
          const batchText = batch.map((ne, i) => `[${i}] ${ne.entry.titulo}: ${ne.entry.descricao}`).join("\n");

          try {
            const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `Extraia de cada notícia: palavras_chave (string[]), orgao (string|null - órgão municipal), bairro (string|null). Responda com JSON array.`,
                  },
                  { role: "user", content: batchText },
                ],
                tools: [{
                  type: "function",
                  function: {
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
                  },
                }],
                tool_choice: { type: "function", function: { name: "extract_news_data" } },
              }),
            });

            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall) {
                const extracted = JSON.parse(toolCall.function.arguments);
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

      return new Response(
        JSON.stringify({ success: true, total: entries.length, saved: savedCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
