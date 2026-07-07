import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extrai texto bruto de um PDF usando unpdf (puro Deno, sem dependências nativas)
async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return (Array.isArray(text) ? text.join("\n") : text || "").slice(0, 20000);
  } catch (e) {
    console.warn("PDF parse falhou:", (e as any)?.message);
    return "";
  }
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getNumeroParts(numero: string | null | undefined) {
  const value = numero || "";
  const match = value.match(/(\d{1,5})\s*\/\s*(20\d{2})/) || value.match(/(\d{1,5}).*?(20\d{2})/);
  return match ? { numero: match[1], ano: match[2] } : null;
}

function looksLikeOriginalOficioPdf(conteudo: string, oficio: any) {
  const text = normalizeText(conteudo);
  if (!text) return false;

  const responseMarkers = [
    "responde oficio",
    "resposta ao oficio",
    "em atencao ao oficio",
    "em resposta ao oficio",
    "informamos que",
    "esclarecemos que",
    "encaminhamos resposta",
  ];
  if (responseMarkers.some((marker) => text.includes(marker))) return false;

  const parts = getNumeroParts(oficio?.numero);
  const sameNumber = parts ? text.includes(`${parts.numero}/${parts.ano}`) || (text.includes(parts.numero) && text.includes(parts.ano)) : false;
  if (!sameNumber) return false;

  const markers = [
    text.includes("oficio gvf"),
    text.includes("destinatario:"),
    text.includes("assunto:"),
    text.includes("vereador que a este subscreve") || text.includes("este gabinete") || text.includes("exercicio de suas atribuicoes parlamentares"),
    text.includes("uberlandia"),
  ].filter(Boolean).length;

  return markers >= 3;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated user OR internal shared secret
    const expectedSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
    const providedSecret = req.headers.get("x-internal-secret") || "";
    const authHeader = req.headers.get("Authorization") || "";
    let authorized = expectedSecret && providedSecret === expectedSecret;
    if (!authorized && authHeader.startsWith("Bearer ")) {
      try {
        const sbAuth = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const token = authHeader.replace("Bearer ", "");
        const { data, error } = await sbAuth.auth.getClaims(token);
        authorized = !!(data?.claims?.sub) && !error;
      } catch { /* ignore */ }
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { resposta_id } = await req.json();
    if (!resposta_id) throw new Error("resposta_id obrigatório");

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: resposta, error: rErr } = await adminSb
      .from("oficio_respostas").select("*").eq("id", resposta_id).single();
    if (rErr || !resposta) throw new Error("Resposta não encontrada");

    const { data: oficio } = await adminSb
      .from("oficios").select("id, numero, assunto, secretaria_identificada, destinatario, author_id, operador_nome, conteudo")
      .eq("id", resposta.oficio_id).single();

    // Baixar PDF
    let conteudo = "";
    let resumo = "";
    let orgao = resposta.orgao_respondente || null;

    if (resposta.arquivo_path) {
      const dl = await adminSb.storage.from("respostas-oficios").download(resposta.arquivo_path);
      if (dl.data) {
        const buf = await dl.data.arrayBuffer();
        conteudo = await extractPdfText(buf);
      }
    }

    if (looksLikeOriginalOficioPdf(conteudo, oficio)) {
      await adminSb.from("oficio_respostas").update({
        conteudo_extraido: conteudo || null,
        resumo_ia: "Arquivo ignorado: o PDF anexado é o próprio ofício, não uma resposta do órgão.",
        orgao_respondente: null,
        match_status: "arquivo_invalido",
        match_metodo: "conteudo_eh_proprio_oficio",
        match_confianca: 0,
        data_resposta: resposta.data_resposta || new Date().toISOString().slice(0, 10),
      }).eq("id", resposta_id);

      return new Response(JSON.stringify({ ok: true, skipped: "arquivo_eh_o_proprio_oficio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar resumo com IA (Lovable AI)
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (conteudo && LOVABLE_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você analisa respostas oficiais a ofícios. Responda em JSON: {\"resumo\":\"resumo em até 3 linhas, claro e direto\",\"orgao\":\"nome do órgão respondente se identificável\",\"posicionamento\":\"deferido|indeferido|em_analise|informativo\"}" },
              { role: "user", content: `Ofício nº ${oficio?.numero || ""} sobre "${oficio?.assunto || ""}" enviado a ${oficio?.destinatario || oficio?.secretaria_identificada || ""}.\n\nTexto da resposta:\n${conteudo.slice(0, 8000)}` },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
          resumo = parsed.resumo || "";
          orgao = orgao || parsed.orgao || null;
        }
      } catch (e) { console.warn("AI fail:", (e as any)?.message); }
    }

    await adminSb.from("oficio_respostas").update({
      conteudo_extraido: conteudo || null,
      resumo_ia: resumo || null,
      orgao_respondente: orgao,
      match_status: "confirmado",
      match_metodo: resposta.match_metodo || "conteudo_validado",
      match_confianca: resposta.match_confianca ?? 1,
      data_resposta: resposta.data_resposta || new Date().toISOString().slice(0, 10),
    }).eq("id", resposta_id);

    // Disparar notificação
    try {
      await adminSb.functions.invoke("notificar-resposta-whatsapp", {
        body: { resposta_id, oficio_id: resposta.oficio_id },
        headers: { "x-internal-secret": expectedSecret },
      });
    } catch (e) { console.warn("Notificação falhou:", (e as any)?.message); }

    return new Response(JSON.stringify({ ok: true, resumo, orgao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("processar-resposta-oficio:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});