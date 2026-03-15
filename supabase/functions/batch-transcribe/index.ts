import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, toGeminiMultimodal, toGeminiMessages } from "../_shared/gemini.ts";

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

    const userClient = createClient(supabaseUrl, supabaseAnon, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

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
        const audioResp = await fetch(entry.link!);
        if (!audioResp.ok) { results.push({ id: entry.id, error: "Download failed" }); continue; }

        const audioBytes = new Uint8Array(await audioResp.arrayBuffer());
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < audioBytes.length; i += chunkSize) {
          binary += String.fromCharCode(...audioBytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);

        // Step 1: Transcribe with Gemini
        const { systemInstruction: si1, messages: m1 } = toGeminiMultimodal([
          { inlineData: { mimeType: "audio/ogg", data: base64 } },
          { text: `Transcreva este áudio integralmente em português. Após a transcrição, organize as informações relevantes:
- Qual é a demanda/problema relatado
- Localização mencionada (ruas, bairros)
- Nome do solicitante (se mencionado)
- Detalhes específicos

Formato:
TRANSCRIÇÃO:
[transcrição completa]

RESUMO PARA OFÍCIO:
[informações organizadas]` },
        ]);

        const transcribeResult = await callGemini({ systemInstruction: si1, messages: m1 });
        const transcription = transcribeResult.text;

        if (!transcription) { results.push({ id: entry.id, error: "Empty transcription" }); continue; }

        // Step 2: Analyze for smart title and tags
        const { systemInstruction: si2, messages: m2 } = toGeminiMessages(
          "Você é um assistente de um gabinete parlamentar. Analise a transcrição de um áudio e retorne informações estruturadas.",
          `Analise esta transcrição e extraia informações estruturadas:

"${transcription.substring(0, 3000)}"

Retorne SOMENTE um JSON válido (sem markdown, sem backticks) com esta estrutura exata:
{
  "titulo": "título curto e descritivo do tema principal do áudio (max 80 chars)",
  "resumo": "resumo de 1-2 frases do conteúdo principal",
  "tags": ["tag1", "tag2", "tag3"],
  "tema_principal": "categoria principal",
  "bairro": "bairro mencionado ou null",
  "solicitante": "nome do solicitante ou null"
}`
        );

        let analysis = { titulo: "", resumo: "", tags: [] as string[], tema_principal: "Geral", bairro: null as string | null };

        try {
          const analyzeResult = await callGemini({ model: "gemini-2.5-flash-lite", systemInstruction: si2, messages: m2 });
          const jsonMatch = analyzeResult.text.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : analyzeResult.text);
          analysis = { ...analysis, ...parsed };
        } catch { /* keep defaults */ }

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
  } catch (e: any) {
    console.error("batch-transcribe error:", e);
    const status = e.status || 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
