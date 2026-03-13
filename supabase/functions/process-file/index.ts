import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("type") as string; // "image", "audio", or "video"

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    // Chunked base64 to avoid stack overflow on large files
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64 = btoa(binary);
    const mimeType = file.type || (fileType === "audio" ? "audio/ogg" : fileType === "video" ? "video/mp4" : "image/jpeg");

    // For audio/video, use OpenAI Whisper for transcription first, then Claude for analysis
    if (fileType === "audio" || fileType === "video") {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      
      let transcription = "";
      
      if (OPENAI_API_KEY) {
        // Use Whisper for transcription
        try {
          const blob = new Blob([bytes], { type: mimeType });
          const whisperForm = new FormData();
          whisperForm.append("file", blob, file.name || "audio.ogg");
          whisperForm.append("model", "whisper-1");
          whisperForm.append("language", "pt");

          const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            body: whisperForm,
          });

          if (whisperResp.ok) {
            const whisperData = await whisperResp.json();
            transcription = whisperData.text || "";
          } else {
            console.error("Whisper error:", whisperResp.status, await whisperResp.text());
          }
        } catch (e) {
          console.error("Whisper transcription failed:", e);
        }
      }

      if (!transcription) {
        return new Response(JSON.stringify({ 
          text: "⚠️ Não foi possível transcrever o áudio/vídeo. Descreva a demanda manualmente.", 
          type: fileType 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Now use Claude to analyze the transcription
      const analysisContent = [
        {
          type: "text",
          text: `Analise esta transcrição de ${fileType === "video" ? "vídeo" : "áudio"} e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

TRANSCRIÇÃO:
"${transcription}"

Organize as informações:
- Qual é a demanda/problema relatado
- Localização mencionada (ruas, bairros)
- Nome do solicitante (se mencionado)
- Detalhes específicos do problema

Formato da resposta:
TRANSCRIÇÃO:
${transcription}

RESUMO PARA OFÍCIO:
[informações organizadas para criação do ofício]`,
        },
      ];

      const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20250315",
          max_tokens: 1024,
          messages: [{ role: "user", content: analysisContent }],
        }),
      });

      if (!claudeResp.ok) {
        const errText = await claudeResp.text();
        console.error("Claude analysis error:", claudeResp.status, errText);
        // Return just the transcription if analysis fails
        return new Response(
          JSON.stringify({ text: `TRANSCRIÇÃO:\n${transcription}`, type: fileType }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const claudeData = await claudeResp.json();
      const analysisText = claudeData.content?.[0]?.text || transcription;

      return new Response(
        JSON.stringify({ text: analysisText, type: fileType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For images and PDFs, use Claude directly
    let prompt: string;
    if (fileType === "image") {
      prompt = `Analise esta imagem e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Textos visíveis (placas, documentos, cartazes)
- Problemas urbanos visíveis (buracos, falta de iluminação, lixo, esgoto, etc.)
- Localização (ruas, bairros, referências)
- Condições gerais da situação fotografada

Retorne um texto descritivo claro e objetivo com todas as informações extraídas. Se houver texto legível na imagem, transcreva-o integralmente. Se for uma foto de um problema urbano, descreva em detalhes o que está visível.`;
    } else {
      prompt = `Analise este documento e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Conteúdo textual completo
- Dados de localização (endereços, bairros)
- Problemas ou demandas relatadas
- Nomes de solicitantes ou envolvidos

Retorne um texto descritivo claro e objetivo com todas as informações extraídas.`;
    }

    // Determine Claude media type
    const claudeMediaType = mimeType === "application/pdf" ? "document" : "image";
    const sourceType = mimeType === "application/pdf" ? "base64" : "base64";

    const content: any[] = [];
    
    if (claudeMediaType === "image") {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType,
          data: base64,
        },
      });
    } else {
      // PDF as document
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: base64,
        },
      });
    }

    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20250315",
        max_tokens: 1024,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Chave da Anthropic inválida ou expirada." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: `Erro ao processar arquivo (Anthropic ${response.status})` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const resultText = data.content?.[0]?.text || "";

    return new Response(
      JSON.stringify({ text: resultText, type: fileType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("process-file error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
