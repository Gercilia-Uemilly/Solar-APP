// Auto-generate the official ofício text for records inserted by the
// WhatsApp/n8n bot. Triggered by a Postgres trigger on `oficios` whenever
// origem='whatsapp_bot' AND ia_pendente=true. Reuses the same logic as
// the manual "Gerar Texto com IA" button by invoking the generate-oficio
// edge function with the same payload, then writes the result back.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const oficioId: string | undefined = body?.oficio_id || body?.record?.id;
    if (!oficioId) {
      return new Response(JSON.stringify({ error: "oficio_id ausente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Carrega o ofício
    const { data: oficio, error: loadErr } = await admin
      .from("oficios")
      .select("*")
      .eq("id", oficioId)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!oficio) {
      return new Response(JSON.stringify({ error: "ofício não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Segurança: só processa o que veio do bot e ainda está pendente
    if (oficio.origem !== "whatsapp_bot" || oficio.ia_pendente !== true || oficio.ia_gerada === true) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const descricaoBruta = (oficio.conteudo || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (descricaoBruta.length < 10) {
      return new Response(JSON.stringify({ error: "descrição muito curta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reaproveita EXATAMENTE a mesma lógica do botão "Gerar Texto com IA"
    const payload = {
      assunto: oficio.assunto || "",
      destinatario: oficio.destinatario || "",
      descricao: descricaoBruta,
      tipo: oficio.secretaria_identificada || oficio.tipo_demanda || "Solicitação",
      solicitante: oficio.solicitante || "",
      bairro: oficio.bairro || "",
      prioridade: oficio.urgencia === "urgente" ? "Urgente" : "Normal",
      local: oficio.endereco_completo || oficio.local_demanda || "",
    };

    const genResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-oficio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify(payload),
    });

    if (!genResp.ok) {
      const errText = await genResp.text();
      console.error("generate-oficio falhou:", genResp.status, errText);
      // Não apaga o ofício — apenas mantém ia_pendente=true para o operador clicar manualmente
      return new Response(JSON.stringify({ error: "Falha ao gerar texto", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await genResp.json();
    const oficioText = data.oficio || data.text || "";
    if (!oficioText) {
      return new Response(JSON.stringify({ error: "Resposta vazia da IA" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatePayload: Record<string, any> = {
      conteudo: oficioText,
      ia_pendente: false,
      ia_gerada: true,
      resposta_cidadao: oficio.resposta_cidadao || data.resposta_cidadao || null,
      updated_at: new Date().toISOString(),
    };
    if (data.assunto_sugerido && !oficio.assunto) updatePayload.assunto = data.assunto_sugerido;
    if (data.secretaria_identificada && !oficio.secretaria_identificada) {
      updatePayload.secretaria_identificada = data.secretaria_identificada;
    }

    const { error: updErr } = await admin
      .from("oficios")
      .update(updatePayload)
      .eq("id", oficioId);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ success: true, oficio_id: oficioId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("auto-generate-oficio-whatsapp erro:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});