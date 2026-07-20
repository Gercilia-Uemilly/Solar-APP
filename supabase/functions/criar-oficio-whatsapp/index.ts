// Endpoint interno para o n8n / Agente WhatsApp criar ofícios sem depender
// de anon key com policy aberta. Protegido pelo INTERNAL_WEBHOOK_SECRET.
// Faz INSERT com service_role (bypass RLS) e retorna o id criado.
// O trigger existente em `oficios` dispara auto-generate-oficio-whatsapp
// automaticamente quando origem='whatsapp'/'whatsapp_bot' e ia_pendente=true.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const expected = Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
    const provided = req.headers.get("x-internal-secret") || "";
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Body inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Campos aceitos vindos do n8n (todos opcionais salvo conteudo/assunto).
    const {
      assunto,
      secretaria_identificada,
      tipo_demanda,
      solicitante,
      contato_solicitante,
      local_demanda,
      bairro,
      conteudo,
      linha_telefonica,
      telefone_recebimento,
      origem, // 'whatsapp' | 'whatsapp_bot'
    } = body as Record<string, unknown>;

    if (!conteudo || typeof conteudo !== "string") {
      return new Response(JSON.stringify({ error: "conteudo obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const insertPayload: Record<string, unknown> = {
      assunto: assunto || "Demanda via WhatsApp",
      secretaria_identificada: secretaria_identificada || null,
      tipo_demanda: tipo_demanda || null,
      solicitante: solicitante || null,
      contato_solicitante: contato_solicitante || null,
      local_demanda: local_demanda || null,
      bairro: bairro || null,
      conteudo,
      linha_telefonica: linha_telefonica || null,
      telefone_recebimento: telefone_recebimento || null,
      origem: origem === "whatsapp_bot" ? "whatsapp_bot" : "whatsapp",
      status: "Rascunho",
      ia_pendente: true,
      ia_gerada: false,
    };

    const { data, error } = await admin
      .from("oficios")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("[criar-oficio-whatsapp] insert error", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, oficio_id: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[criar-oficio-whatsapp] fatal", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});