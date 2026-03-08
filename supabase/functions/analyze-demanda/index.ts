import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECRETARIA_MAP: Record<string, string[]> = {
  "Secretaria de Obras": ["buraco", "asfalto", "calçada", "pavimentação", "obra", "construção", "cratera", "rua danificada", "recapeamento"],
  "Secretaria de Meio Ambiente": ["árvore", "poda", "queimada", "esgoto", "rio", "córrego", "desmatamento", "lixo", "entulho", "ambiental"],
  "Iluminação Pública": ["lâmpada", "poste", "iluminação", "escuro", "luz apagada", "luminária"],
  "Secretaria de Saúde": ["posto de saúde", "UBS", "hospital", "médico", "remédio", "vacina", "saúde", "consulta", "enfermeiro"],
  "Secretaria de Educação": ["escola", "creche", "vaga", "professor", "educação", "matrícula", "ensino"],
  "Secretaria de Trânsito": ["semáforo", "sinalização", "trânsito", "radar", "faixa de pedestre", "rotatória", "lombada"],
  "Secretaria de Assistência Social": ["assistência", "CRAS", "CREAS", "benefício", "bolsa", "vulnerabilidade", "social"],
  "DMAE": ["água", "esgoto", "vazamento", "falta de água", "saneamento", "hidrômetro"],
  "CEMIG": ["energia", "falta de energia", "queda de energia", "rede elétrica", "transformador"],
};

function detectSecretaria(text: string): string | null {
  const lower = text.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const [sec, keywords] of Object.entries(SECRETARIA_MAP)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sec;
    }
  }
  return best;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const textInput = formData.get("text") as string | null;

    let extractedText = textInput || "";

    // If a file is provided, extract text using AI
    if (file) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const mimeType = file.type || "application/octet-stream";

      const isImage = mimeType.startsWith("image/");
      const isAudio = mimeType.startsWith("audio/");
      const isPdf = mimeType.includes("pdf");

      const extractPrompt = isPdf || isImage
        ? `Extraia TODO o texto visível deste documento/imagem. Transcreva integralmente.`
        : isAudio
        ? `Transcreva este áudio integralmente.`
        : `Extraia o conteúdo textual deste arquivo.`;

      const contentPart = isAudio
        ? { type: "input_audio" as const, input_audio: { data: base64, format: mimeType.includes("wav") ? "wav" : "mp3" } }
        : { type: "image_url" as const, image_url: { url: `data:${mimeType};base64,${base64}` } };

      const extractResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: [{ type: "text", text: extractPrompt }, contentPart] }],
        }),
      });

      if (!extractResp.ok) {
        const errText = await extractResp.text();
        console.error("Extraction error:", extractResp.status, errText);
        throw new Error(`Erro na extração: ${extractResp.status}`);
      }

      const extractData = await extractResp.json();
      extractedText = extractData.choices?.[0]?.message?.content || "";
    }

    if (!extractedText.trim()) {
      return new Response(JSON.stringify({ error: "Nenhum texto extraído do arquivo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Now analyze the text with AI to fill fields
    const analysisPrompt = `Analise o texto abaixo de uma solicitação/demanda cidadã e extraia as informações estruturadas.

TEXTO:
"""
${extractedText}
"""

Retorne APENAS um JSON com estes campos (se não encontrar, retorne string vazia):
{
  "titulo": "título curto da demanda",
  "solicitante": "nome do solicitante",
  "telefone": "telefone encontrado",
  "tipo_demanda": "Solicitação|Reclamação|Denúncia|Sugestão|Informação|Outro",
  "secretaria": "secretaria municipal responsável",
  "bairro": "bairro mencionado",
  "assunto": "resumo do assunto",
  "descricao": "descrição estruturada da demanda"
}`;

    const analysisResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um assistente de gabinete parlamentar. Analise demandas cidadãs e extraia informações estruturadas. Responda SOMENTE com JSON válido." },
          { role: "user", content: analysisPrompt },
        ],
      }),
    });

    if (!analysisResp.ok) {
      if (analysisResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`Erro na análise: ${analysisResp.status}`);
    }

    const analysisData = await analysisResp.json();
    let aiContent = analysisData.choices?.[0]?.message?.content || "{}";
    
    // Clean JSON
    aiContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let result: Record<string, string> = {};
    try {
      result = JSON.parse(aiContent);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      result = { descricao: extractedText };
    }

    // Fallback secretaria detection
    if (!result.secretaria) {
      result.secretaria = detectSecretaria(extractedText) || "";
    }

    return new Response(JSON.stringify({
      ...result,
      texto_extraido: extractedText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-demanda error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
