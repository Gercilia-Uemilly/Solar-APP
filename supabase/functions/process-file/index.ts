import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const fileType = formData.get("type") as string; // "image" or "audio"

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
    const mimeType = file.type || (fileType === "audio" ? "audio/ogg" : "image/jpeg");

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
      prompt = `Transcreva este áudio integralmente, mantendo o conteúdo original. 
      
Após a transcrição, organize as informações relevantes para criação de um ofício legislativo:
- Qual é a demanda/problema relatado
- Localização mencionada (ruas, bairros)
- Nome do solicitante (se mencionado)
- Detalhes específicos do problema

Formato da resposta:
TRANSCRIÇÃO:
[transcrição completa do áudio]

RESUMO PARA OFÍCIO:
[informações organizadas]`;
    }

    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: prompt,
          },
          fileType === "image"
            ? {
                type: "image_url" as const,
                image_url: { url: `data:${mimeType};base64,${base64}` },
              }
            : {
                type: "input_audio" as const,
                input_audio: { data: base64, format: mimeType.includes("wav") ? "wav" : "mp3" },
              },
        ],
      },
    ];

    // Use Gemini Flash for speed
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao processar arquivo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ text: content, type: fileType }),
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
