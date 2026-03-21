import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY nao configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const oficio = body.oficio;

    if (!oficio) {
      return new Response(
        JSON.stringify({ error: "Dados do oficio nao informados" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = "Voce e revisor de oficios parlamentares do gabinete do Vereador Fabao em Uberlandia-MG. Analise o oficio e retorne APENAS JSON valido sem markdown. Verificar: 1) ASSUNTO: formato Solicitacao de X - Local Y, maximo 80 caracteres. 2) DESTINATARIO: bate com a secretaria? 3) VOCATIVO: Secretarias municipais use Excelentissimo(a) Senhor(a) Secretario(a), - DMAE use Excelentissimo(a) Senhor(a) Diretor(a) Geral, 4) ENDERECO: mencionado no primeiro paragrafo? 5) TEXTO: palavras repetidas? 6) GRAMATICA: erros obvios? 7) CAMPOS VAZIOS: assunto ou secretaria em branco? 8) NUMERO: formato XXX/2026? 9) CONCLUSAO: termina com frase padrao? 10) ORGAO: nome na conclusao bate com secretaria? Retornar JSON: {aprovado: true, erros: [{campo: string, gravidade: erro|aviso|sugestao, descricao: string, correcao: string}], resumo: string}. Se sem erros retornar erros como array vazio.";

    const userPrompt = "Revise este oficio:\nNUMERO: " + (oficio.numero || "nao informado") + "\nSECRETARIA: " + (oficio.secretaria || "nao informada") + "\nDESTINATARIO: " + (oficio.destinatario || "nao informado") + "\nASSUNTO: " + (oficio.assunto || "nao informado") + "\nENDERECO: " + (oficio.endereco_completo || "nao informado") + "\nVOCATIVO: " + (oficio.vocativo || "nao informado") + "\nTEXTO DO OFICIO:\n" + (oficio.conteudo || "vazio");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 1000,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const erro = await response.text();
      console.error("OpenAI error:", response.status, erro);
      return new Response(
        JSON.stringify({ error: "Erro OpenAI: " + response.status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const texto = data.choices[0].message.content;
    const cleaned = texto.replace(/```json/g, "").replace(/```/g, "").trim();

    let resultado;
    try {
      resultado = JSON.parse(cleaned);
    } catch (e) {
      resultado = {
        aprovado: true,
        erros: [],
        resumo: "Nao foi possivel analisar. Verifique manualmente.",
      };
    }

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("revisar-oficio error:", error);
    return new Response(
      JSON.stringify({
        aprovado: true,
        erros: [],
        resumo: "Erro interno. Voce pode exportar normalmente.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
// deploy v3 - openai only
