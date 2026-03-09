const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface InstagramEntry {
  id: string;
  link: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  palavras_chave: string[] | null;
}

interface ClassificationResult {
  titulo: string;
  tema: string;
  tags: string[];
  data_aproximada: string | null;
}

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

    // Check if admin
    const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdminResult) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { limit = 50, force = false } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    // Get unclassified Instagram entries (título genérico ou sem tags)
    let query = supabase
      .from("base_conhecimento")
      .select("id, link, titulo, descricao, categoria, palavras_chave")
      .eq("fonte", "Instagram")
      .or("link.ilike.%instagram.com%");

    if (!force) {
      // Only get entries with generic titles
      query = query.or("titulo.eq.Instagram @fabaovereador,titulo.ilike.%Post do Instagram%,titulo.ilike.%Reel do Instagram%");
    }

    const { data: entries, error: fetchError } = await query.limit(limit);

    if (fetchError) {
      console.error("Error fetching entries:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        processed: 0, 
        message: "Nenhum post pendente de classificação" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      processed: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process entries in small batches to avoid timeouts
    const batchSize = 5;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      // Process batch in parallel
      const promises = batch.map(async (entry: InstagramEntry) => {
        try {
          let scrapedContent = "";
          
          // Try to scrape with Firecrawl if available
          if (FIRECRAWL_API_KEY && entry.link) {
            try {
              const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  url: entry.link,
                  formats: ["markdown"],
                  onlyMainContent: true,
                  timeout: 15000,
                }),
              });

              if (scrapeResp.ok) {
                const scrapeData = await scrapeResp.json();
                scrapedContent = scrapeData.data?.markdown || scrapeData.markdown || "";
              }
            } catch (scrapeErr) {
              console.log("Firecrawl scrape failed for", entry.link, scrapeErr);
            }
          }

          // Use AI to classify the post
          const tipo = entry.link?.includes("/reel/") ? "Reel" : "Post";
          const contentForAI = scrapedContent.slice(0, 2000) || `${tipo} do Instagram do perfil @fabaovereador. Link: ${entry.link}`;

          const aiResponse = await fetch(AI_GATEWAY_URL, {
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
                  content: `Você é um assistente que classifica posts do Instagram de um vereador (Fabão Vereador - Uberlândia/MG).
                  
Analise o conteúdo e retorne um JSON com:
- titulo: Título curto e descritivo (máx 100 chars), prefixado com emoji relevante
- tema: Uma categoria principal (Saúde, Educação, Transporte, Segurança, Infraestrutura, Meio Ambiente, Social, Cultura, Esporte, Político, Comunicado, Agradecimento, Evento, Conquista, Outro)
- tags: Array de 2-5 palavras-chave relevantes
- data_aproximada: Se conseguir identificar a data no conteúdo (formato YYYY-MM-DD), senão null

Responda APENAS com o JSON válido, sem markdown.`,
                },
                {
                  role: "user",
                  content: contentForAI,
                },
              ],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "classify_post",
                    description: "Classifica um post do Instagram",
                    parameters: {
                      type: "object",
                      properties: {
                        titulo: { type: "string", description: "Título curto e descritivo com emoji" },
                        tema: { 
                          type: "string", 
                          enum: ["Saúde", "Educação", "Transporte", "Segurança", "Infraestrutura", "Meio Ambiente", "Social", "Cultura", "Esporte", "Político", "Comunicado", "Agradecimento", "Evento", "Conquista", "Outro"]
                        },
                        tags: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "2-5 palavras-chave relevantes"
                        },
                        data_aproximada: { 
                          type: "string", 
                          description: "Data aproximada no formato YYYY-MM-DD ou null",
                          nullable: true
                        },
                      },
                      required: ["titulo", "tema", "tags"],
                    },
                  },
                },
              ],
              tool_choice: { type: "function", function: { name: "classify_post" } },
            }),
          });

          if (!aiResponse.ok) {
            const errorText = await aiResponse.text();
            throw new Error(`AI API error: ${aiResponse.status} - ${errorText}`);
          }

          const aiData = await aiResponse.json();
          
          // Extract classification from tool call
          let classification: ClassificationResult | null = null;
          
          if (aiData.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            try {
              classification = JSON.parse(aiData.choices[0].message.tool_calls[0].function.arguments);
            } catch {
              console.error("Failed to parse tool call arguments");
            }
          }

          if (!classification) {
            // Fallback: try to parse from content
            const content = aiData.choices?.[0]?.message?.content || "";
            try {
              classification = JSON.parse(content);
            } catch {
              console.error("Failed to parse AI response as JSON");
            }
          }

          if (classification && classification.titulo) {
            // Update the entry
            const updateData: Record<string, any> = {
              titulo: classification.titulo.slice(0, 200),
              categoria: classification.tema || "Outro",
              palavras_chave: classification.tags || [],
            };

            if (scrapedContent && !entry.descricao) {
              updateData.descricao = scrapedContent.slice(0, 1000);
            }

            if (classification.data_aproximada) {
              updateData.data_publicacao = classification.data_aproximada;
            }

            const { error: updateError } = await supabase
              .from("base_conhecimento")
              .update(updateData)
              .eq("id", entry.id);

            if (updateError) {
              throw new Error(`Update failed: ${updateError.message}`);
            }

            results.updated++;
          }

          results.processed++;
        } catch (err) {
          results.failed++;
          results.errors.push(`${entry.link}: ${err instanceof Error ? err.message : "Unknown error"}`);
          console.error("Error processing entry:", entry.id, err);
        }
      });

      await Promise.all(promises);
      
      // Small delay between batches to avoid rate limits
      if (i + batchSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: entries.length,
      processed: results.processed,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors.slice(0, 10), // Return first 10 errors
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Classification error:", err);
    return new Response(JSON.stringify({ 
      error: err instanceof Error ? err.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
