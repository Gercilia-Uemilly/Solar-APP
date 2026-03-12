import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    // Auth check
    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get entries with categoria='Áudio' that have no description yet
    const { data: entries, error: fetchErr } = await adminClient
      .from("base_conhecimento")
      .select("*")
      .eq("categoria", "Áudio")
      .is("descricao", null)
      .not("link", "is", null);

    if (fetchErr) throw fetchErr;
    if (!entries || entries.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum áudio pendente", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const entry of entries) {
      try {
        // Download audio from storage URL
        const audioResp = await fetch(entry.link!);
        if (!audioResp.ok) { results.push({ id: entry.id, error: "Download failed" }); continue; }

        const audioBytes = new Uint8Array(await audioResp.arrayBuffer());

        // Chunked base64
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < audioBytes.length; i += chunkSize) {
          binary += String.fromCharCode(...audioBytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);
        const mimeType = "audio/ogg";

        // Step 1: Transcribe with AI
        const transcribeResp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Transcreva este áudio integralmente em português. Após a transcrição, organize as informações relevantes:
- Qual é a demanda/problema relatado
- Localização mencionada (ruas, bairros)
- Nome do solicitante (se mencionado)
- Detalhes específicos

Formato:
TRANSCRIÇÃO:
[transcrição completa]

RESUMO PARA OFÍCIO:
[informações organizadas]`,
                },
                {
                  type: "input_audio",
                  input_audio: { data: base64, format: "mp3" },
                },
              ],
            }],
          }),
        });

        if (!transcribeResp.ok) {
          console.error("Transcription error for", entry.id, await transcribeResp.text());
          results.push({ id: entry.id, error: "Transcription failed" });
          continue;
        }

        const transcribeData = await transcribeResp.json();
        const transcription = transcribeData.choices?.[0]?.message?.content || "";

        if (!transcription) { results.push({ id: entry.id, error: "Empty transcription" }); continue; }

        // Step 2: Analyze for smart title and tags
        const analyzeResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Você é um assistente de um gabinete parlamentar. Analise a transcrição de um áudio e retorne informações estruturadas." },
              {
                role: "user",
                content: `Analise esta transcrição e extraia informações estruturadas:

"${transcription.substring(0, 3000)}"

Retorne SOMENTE um JSON válido (sem markdown, sem backticks) com esta estrutura exata:
{
  "titulo": "título curto e descritivo do tema principal do áudio (max 80 chars)",
  "resumo": "resumo de 1-2 frases do conteúdo principal",
  "tags": ["tag1", "tag2", "tag3"],
  "tema_principal": "categoria principal (ex: Mobilidade, Segurança, Saúde, Educação, Infraestrutura, Política Pública, Meio Ambiente, Cultura, Esporte, Habitação, Assistência Social, Economia)",
  "bairro": "bairro mencionado ou null",
  "solicitante": "nome do solicitante ou null"
}`,
              },
            ],
          }),
        });

        let analysis = { titulo: "", resumo: "", tags: [] as string[], tema_principal: "Geral", bairro: null as string | null };

        if (analyzeResp.ok) {
          const analyzeData = await analyzeResp.json();
          const content = analyzeData.choices?.[0]?.message?.content || "";
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
            analysis = { ...analysis, ...parsed };
          } catch { /* keep defaults */ }
        }

        // Step 3: Update DB entry
        const smartTitle = analysis.titulo ? `🎤 ${analysis.titulo}` : entry.titulo;
        const { error: updateErr } = await adminClient
          .from("base_conhecimento")
          .update({
            titulo: smartTitle,
            descricao: transcription.substring(0, 2000),
            palavras_chave: analysis.tags || [],
            bairro: analysis.bairro || null,
            orgao: analysis.tema_principal || "Geral",
          })
          .eq("id", entry.id);

        if (updateErr) throw updateErr;

        results.push({ id: entry.id, titulo: smartTitle, tags: analysis.tags, tema: analysis.tema_principal, success: true });
        console.log(`✅ Processed: ${smartTitle}`);
      } catch (entryErr) {
        console.error("Error processing entry", entry.id, entryErr);
        results.push({ id: entry.id, error: String(entryErr) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("batch-transcribe error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
