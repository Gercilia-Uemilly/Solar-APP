import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.length >= 10 && d.length <= 11 && !d.startsWith("55")) d = "55" + d;
  return d.length >= 12 ? d : null;
}

function resolveZapiSendUrl(instance?: string | null, token?: string | null) {
  const inst = (instance || "").trim();
  const tok = (token || "").trim();
  if (!inst || !tok) return "";
  if (/^https?:\/\//i.test(inst)) {
    try {
      const u = new URL(inst);
      const m = u.pathname.match(/\/instances\/([^/]+)\/token\/([^/]+)/i);
      if (m) return `${u.protocol}//${u.host}/instances/${m[1]}/token/${m[2]}/send-text`;
    } catch { /* */ }
  }
  return `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { resposta_id, oficio_id: oficioIdInput } = await req.json();
    const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const SB_URL = Deno.env.get("SUPABASE_URL") || "";
    console.log("notificar: env", { hasUrl: !!SB_URL, hasKey: !!SRV_KEY, keyLen: SRV_KEY.length });
    const sb = createClient(SB_URL, SRV_KEY, { auth: { persistSession: false } });

    // Buscar resposta primeiro para resolver oficio_id (e usar resumo)
    const { data: resposta, error: errResp } = await sb.from("oficio_respostas")
      .select("oficio_id, resumo_ia, orgao_respondente, arquivo_nome, uploaded_by_nome, tipo_origem")
      .eq("id", resposta_id).maybeSingle();
    if (errResp) console.error("notificar: erro buscar resposta", errResp);
    console.log("notificar: resposta", { resposta_id, oficio_id: resposta?.oficio_id, tipo_origem: resposta?.tipo_origem });

    const oficio_id = oficioIdInput || resposta?.oficio_id;
    if (!oficio_id) {
      return new Response(JSON.stringify({ ok: false, skipped: "sem_oficio_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Não notificar importações em massa (histórico)
    if (resposta?.tipo_origem && resposta.tipo_origem !== "manual") {
      return new Response(JSON.stringify({ ok: true, skipped: "nao_manual" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: oficio, error: errOf } = await sb.from("oficios")
      .select("id, numero, assunto, destinatario, secretaria_identificada, author_id, operador_nome")
      .eq("id", oficio_id).maybeSingle();
    if (errOf) console.error("notificar: erro buscar oficio", errOf);
    console.log("notificar: oficio", { oficio_id, encontrado: !!oficio, author_id: oficio?.author_id });
    if (!oficio) {
      return new Response(JSON.stringify({ ok: false, skipped: "oficio_nao_encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar telefones do autor (select tolerante a colunas opcionais)
    let profile: any = null;
    try {
      const r = await sb.from("profiles")
        .select("nome, celular, telefone1, telefone2, telefone3").eq("id", oficio.author_id).maybeSingle();
      profile = r.data;
    } catch { /* */ }

    const candidates = [profile?.celular, profile?.telefone1, profile?.telefone2, profile?.telefone3]
      .map((p) => normalizePhone(p || "")).filter(Boolean) as string[];

    // Notificação in-app (tabela notifications se existir)
    try {
      await sb.from("notifications").insert({
        user_id: oficio.author_id,
        type: "resposta_oficio",
        title: `Resposta recebida · Ofício ${oficio.numero || ""}`,
        body: resposta?.resumo_ia || `Nova resposta anexada por ${resposta?.uploaded_by_nome || "operador"}`,
        link: `/meus-oficios?open=${oficio.id}`,
      } as any);
    } catch { /* tabela pode não existir */ }

    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = (Deno.env.get("ZAPI_CLIENT_TOKEN") || "").trim();
    const zapiUrl = resolveZapiSendUrl(ZAPI_INSTANCE_ID, ZAPI_TOKEN);

    const msg =
      `📬 *Resposta recebida*\n` +
      `Ofício *${oficio.numero || "(s/nº)"}* — ${oficio.assunto || ""}\n` +
      `Destinatário: ${oficio.destinatario || oficio.secretaria_identificada || "-"}\n` +
      (resposta?.orgao_respondente ? `Órgão: ${resposta.orgao_respondente}\n` : "") +
      (resposta?.resumo_ia ? `\n📝 ${resposta.resumo_ia}\n` : "") +
      `\nAcesse o Solar para ver o documento.`;

    const results: any[] = [];
    if (zapiUrl && candidates.length > 0) {
      for (const phone of candidates) {
        const headers: any = { "Content-Type": "application/json" };
        if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;
        const r = await fetch(zapiUrl, { method: "POST", headers, body: JSON.stringify({ phone, message: msg }) });
        results.push({ phone, status: r.status });
        if (r.ok) break; // basta enviar para um telefone válido
      }
    }

    return new Response(JSON.stringify({ ok: true, notificados: results, msg_phones: candidates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notificar-resposta-whatsapp:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});