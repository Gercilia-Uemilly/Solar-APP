import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Vision via Lovable AI Gateway (Gemini supports more image formats)
async function callVision(base64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Vision error:", response.status, errText);
    if (response.status === 429) throw Object.assign(new Error("Limite de requisições excedido."), { status: 429 });
    if (response.status === 402) throw Object.assign(new Error("Créditos insuficientes."), { status: 402 });
    throw Object.assign(new Error(`Erro Vision: ${response.status}`), { status: response.status });
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Whisper for audio transcription (stays with OpenAI)
async function callWhisper(file: File): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", "whisper-1");
  formData.append("language", "pt");
  formData.append("response_format", "text");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Whisper error:", response.status, errText);
    if (response.status === 429) throw Object.assign(new Error("Limite de requisições excedido."), { status: 429 });
    throw Object.assign(new Error(`Erro Whisper: ${response.status}`), { status: response.status });
  }

  return await response.text();
}

// Organize transcription with Lovable AI
async function organizeTranscription(transcription: string, mediaType: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return transcription;

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: "Você é um assistente de gabinete parlamentar. Organize transcrições de áudio/vídeo para auxiliar na criação de ofícios legislativos municipais.",
        },
        {
          role: "user",
          content: `Organize esta transcrição de ${mediaType} para criar um ofício legislativo municipal.\n\nTRANSCRIÇÃO:\n${transcription}\n\nRetorne no formato:\nTRANSCRIÇÃO:\n[transcrição limpa e organizada]\n\nRESUMO PARA OFÍCIO:\n- Demanda/problema relatado\n- Localização mencionada (ruas, bairros)\n- Nome do solicitante (se mencionado)\n- Detalhes específicos do problema`,
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    console.error("Organize error:", response.status);
    return `TRANSCRIÇÃO:\n${transcription}`;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || transcription;
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
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await _sb.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("type") as string;

    if (!file) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo enviado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["image", "audio", "video"].includes(fileType)) {
      return new Response(JSON.stringify({ error: "Tipo de arquivo inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let resultText: string;

    if (fileType === "audio" || fileType === "video") {
      // Check file size — Whisper limit is 25MB
      const fileSizeMB = file.size / (1024 * 1024);

      if (fileType === "video" && fileSizeMB > 24) {
        // Video too large for Whisper — upload to storage and process via Gemini asynchronously
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        const storagePath = `videos/${crypto.randomUUID()}_${file.name}`;
        const { error: uploadErr } = await supabaseAdmin.storage
          .from("midias")
          .upload(storagePath, file, { contentType: file.type || "video/mp4" });

        if (uploadErr) {
          console.error("Storage upload error:", uploadErr);
          resultText = `⚠️ Vídeo grande demais (${fileSizeMB.toFixed(1)}MB). Não foi possível fazer upload.\n\nDica: extraia o áudio do vídeo (mp3/m4a/wav) e envie apenas o áudio para transcrição.`;
        } else {
          // Get public URL and use Gemini with URL reference
          const { data: urlData } = supabaseAdmin.storage
            .from("midias")
            .getPublicUrl(storagePath);

          const publicUrl = urlData?.publicUrl;

          if (publicUrl) {
            try {
              const apiKey = Deno.env.get("LOVABLE_API_KEY");
              if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

              const response = await fetch(LOVABLE_AI_URL, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: "google/gemini-2.5-flash",
                  messages: [
                    {
                      role: "user",
                      content: [
                        { type: "image_url", image_url: { url: publicUrl } },
                        {
                          type: "text",
                          text: `Transcreva TODO o áudio/fala deste vídeo em português. Depois descreva o conteúdo visual.\n\nRetorne:\nTRANSCRIÇÃO:\n[fala completa]\n\nDESCRIÇÃO VISUAL:\n- Problemas visíveis\n- Localização\n\nRESUMO PARA OFÍCIO:\n- Demanda\n- Local\n- Solicitante\n- Detalhes`,
                        },
                      ],
                    },
                  ],
                  max_tokens: 8192,
                }),
              });

              if (!response.ok) {
                const errText = await response.text();
                console.error("Gemini video error:", response.status, errText);
                resultText = `⚠️ Vídeo enviado mas não foi possível transcrever automaticamente.\n\nDica: extraia o áudio (mp3/m4a/wav) e envie apenas o áudio.`;
              } else {
                const data = await response.json();
                resultText = data.choices?.[0]?.message?.content || "Não foi possível processar o vídeo.";
              }
            } catch (e) {
              console.error("Gemini video call error:", e);
              resultText = `⚠️ Vídeo salvo, mas a transcrição automática falhou.\n\nDica: extraia o áudio (mp3/m4a/wav) e envie apenas o áudio.`;
            }
          } else {
            resultText = `⚠️ Vídeo salvo, mas não foi possível gerar URL para transcrição.\n\nDica: extraia o áudio (mp3/m4a/wav) e envie apenas o áudio.`;
          }

          // Clean up the temporary video file
          supabaseAdmin.storage.from("midias").remove([storagePath]).catch(() => {});
        }
      } else {
        // Audio or small video — use Whisper directly
        const transcription = await callWhisper(file);
        resultText = await organizeTranscription(transcription, fileType === "video" ? "vídeo" : "áudio");
      }
    } else {
      // Images: use Lovable AI Gateway (Gemini) — supports HEIC, AVIF, etc.
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "image/jpeg";

      const prompt = `Analise esta imagem e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Textos visíveis (placas, documentos, cartazes)
- Problemas urbanos visíveis (buracos, falta de iluminação, lixo, esgoto, etc.)
- Localização (ruas, bairros, referências)
- Condições gerais da situação fotografada

Retorne um texto descritivo claro e objetivo com todas as informações extraídas. Se houver texto legível na imagem, transcreva-o integralmente.`;

      resultText = await callVision(base64, mimeType, prompt);
    }

    return new Response(
      JSON.stringify({ text: resultText, type: fileType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("process-file error:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
