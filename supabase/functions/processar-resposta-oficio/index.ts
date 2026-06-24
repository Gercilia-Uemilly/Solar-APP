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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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
      .from("oficios").select("id, numero, assunto, secretaria_destino, destinatario, author_id, operador_nome")
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
              { role: "user", content: `Ofício nº ${oficio?.numero || ""} sobre "${oficio?.assunto || ""}" enviado a ${oficio?.destinatario || oficio?.secretaria_destino || ""}.\n\nTexto da resposta:\n${conteudo.slice(0, 8000)}` },
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
      data_resposta: resposta.data_resposta || new Date().toISOString().slice(0, 10),
    }).eq("id", resposta_id);

    // Disparar notificação
    try {
      await adminSb.functions.invoke("notificar-resposta-whatsapp", {
        body: { resposta_id, oficio_id: resposta.oficio_id },
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