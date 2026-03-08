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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

    let prompt: string;
    if (fileType === "image") {
      prompt = `Analise esta imagem e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Textos visíveis (placas, documentos, cartazes)
- Problemas urbanos visíveis (buracos, falta de iluminação, lixo, esgoto, etc.)
- Localização (ruas, bairros, referências)
- Condições gerais da situação fotografada

Retorne um texto descritivo claro e objetivo com todas as informações extraídas. Se houver texto legível na imagem, transcreva-o integralmente. Se for uma foto de um problema urbano, descreva em detalhes o que está visível.`;
    } else if (fileType === "video") {
      prompt = `Analise este vídeo e extraia TODAS as informações relevantes para a criação de um ofício legislativo municipal.

Foque em:
- Problemas urbanos visíveis (buracos, falta de iluminação, lixo, esgoto, alagamentos, etc.)
- Localização mostrada (placas de rua, referências visuais, bairros)
- Áudio do narrador: transcreva o que é dito
- Condições do local (segurança, riscos, tamanho do problema)
- Pessoas afetadas ou veículos danificados

Formato da resposta:
DESCRIÇÃO VISUAL:
[o que é mostrado no vídeo]

TRANSCRIÇÃO DO ÁUDIO:
[o que é falado no vídeo, se houver]

RESUMO PARA OFÍCIO:
[informações organizadas para criação do ofício]`;
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

    // Build content parts based on file type
    const contentParts: any[] = [{ type: "text", text: prompt }];

    if (fileType === "image") {
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    } else if (fileType === "video") {
      // Send video as image_url with video mime type (Gemini supports video)
      contentParts.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}` },
      });
    } else {
      contentParts.push({
        type: "input_audio",
        input_audio: { data: base64, format: mimeType.includes("wav") ? "wav" : "mp3" },
      });
    }

    const messages = [{ role: "user" as const, content: contentParts }];

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
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
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
