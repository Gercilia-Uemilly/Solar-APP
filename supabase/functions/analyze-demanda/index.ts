import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callGemini, toGeminiMessages, toGeminiMultimodal } from "../_shared/gemini.ts";

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
  "Secretaria de Trânsito": ["semáforo", "sinalização", "trânsito", "radar", "faixa de pedestre", "rotatória", "lombada", "quebra-mola", "quebra mola", "redutor de velocidade"],
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const _sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await _sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

      const { systemInstruction, messages } = toGeminiMultimodal([
        { inlineData: { mimeType, data: base64 } },
        { text: `Extraia TODO o texto visível deste documento/imagem. Transcreva integralmente.` },
      ]);

      const extractResult = await callGemini({ systemInstruction, messages });
      extractedText = extractResult.text;
    }

    if (!extractedText.trim()) {
      return new Response(JSON.stringify({ error: "Nenhum texto extraído do arquivo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze text with AI
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

    const systemPrompt = "Você é um assistente de gabinete parlamentar. Analise demandas cidadãs e extraia informações estruturadas. Responda SOMENTE com JSON válido.";

    const { systemInstruction, messages } = toGeminiMessages(systemPrompt, analysisPrompt);
    const analysisResult = await callGemini({ systemInstruction, messages });

    let aiContent = analysisResult.text;
    aiContent = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result: Record<string, string> = {};
    try {
      result = JSON.parse(aiContent);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      result = { descricao: extractedText };
    }

    if (!result.secretaria) {
      result.secretaria = detectSecretaria(extractedText) || "";
    }

    return new Response(JSON.stringify({
      ...result,
      texto_extraido: extractedText,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("analyze-demanda error:", e);
    const status = e.status || 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
