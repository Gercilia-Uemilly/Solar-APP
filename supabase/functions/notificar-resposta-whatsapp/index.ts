import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buscarTelefonePorOrigemCodigo } from "../_shared/zapReqContatos.ts";
import { enviarWhatsApp, whatsappProviderConfigurado } from "../_shared/whatsappSender.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Auth: allow only authenticated users OR internal callers (shared secret)
    const expectedSecret = Deno.env.get("INTERNAL_WEBHOOK_SECRET") || "";
    const providedSecret = req.headers.get("x-internal-secret") || "";
    const authHeader = req.headers.get("Authorization") || "";
    let authorized = expectedSecret && providedSecret === expectedSecret;
    if (!authorized && authHeader.startsWith("Bearer ")) {
      try {
        const sbAuth = createClient(
          Deno.env.get("SUPABASE_URL") || "",
          Deno.env.get("SUPABASE_ANON_KEY") || "",
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

    const { resposta_id, oficio_id: oficioIdInput } = await req.json();
    const SRV_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const SB_URL = Deno.env.get("SUPABASE_URL") || "";
    console.log("notificar: env", { hasUrl: !!SB_URL, hasKey: !!SRV_KEY, keyLen: SRV_KEY.length });
    const sb = createClient(SB_URL, SRV_KEY, { auth: { persistSession: false } });

    // Buscar resposta primeiro para resolver oficio_id (e usar resumo)
    const { data: resposta, error: errResp } = await sb.from("oficio_respostas")
      .select("oficio_id, resumo_ia, orgao_respondente, arquivo_nome, uploaded_by, uploaded_by_nome, tipo_origem")
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
      .select("id, numero, assunto, destinatario, secretaria_identificada, author_id, operador_nome, telefone_recebimento, origem, codigo_z")
      .eq("id", oficio_id).maybeSingle();
    if (errOf) console.error("notificar: erro buscar oficio", errOf);
    console.log("notificar: oficio", { oficio_id, encontrado: !!oficio, author_id: oficio?.author_id });
    if (!oficio) {
      return new Response(JSON.stringify({ ok: false, skipped: "oficio_nao_encontrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notificar APENAS o autor do ofício (nunca quem fez o upload)
    const idsParaNotificar = [oficio.author_id].filter(Boolean) as string[];
    let profiles: any[] = [];
    try {
      const r = await sb.from("profiles")
        .select("id, full_name, celular, telefone1, telefone2, telefone3").in("id", idsParaNotificar);
      profiles = r.data || [];
    } catch { /* */ }

    // Prioridade para identificar o telefone do operador a ser notificado:
    // 1) telefone_recebimento explícito no ofício
    // 2) telefone mapeado pela origem + código_z na planilha de contatos (ZAP/REQ)
    let telRecebPreferido = normalizePhone(oficio.telefone_recebimento || "");
    if (!telRecebPreferido) {
      const telPlanilha = buscarTelefonePorOrigemCodigo(oficio.origem, oficio.codigo_z);
      if (telPlanilha) {
        telRecebPreferido = telPlanilha;
        console.log("notificar: telefone resolvido pela planilha", { origem: oficio.origem, codigo_z: oficio.codigo_z, telefone: telPlanilha });
      }
    }
    const todos = profiles.flatMap((p) => [p?.celular, p?.telefone1, p?.telefone2, p?.telefone3])
      .map((p) => normalizePhone(p || "")).filter(Boolean) as string[];
    let uniqueCandidates: string[];
    if (telRecebPreferido && todos.includes(telRecebPreferido)) {
      uniqueCandidates = [telRecebPreferido];
      console.log("notificar: notificando APENAS o zap correspondente", telRecebPreferido);
    } else {
      uniqueCandidates = Array.from(new Set(todos));
      if (telRecebPreferido) {
        console.log("notificar: telefone da planilha não está cadastrado nas 3 linhas do operador — fallback para todas", telRecebPreferido);
      }
    }
    console.log("notificar: telefones", { ids: idsParaNotificar, total: uniqueCandidates.length });

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
    if (zapiUrl && uniqueCandidates.length > 0) {
      for (const phone of uniqueCandidates) {
        const headers: any = { "Content-Type": "application/json" };
        if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;
        const r = await fetch(zapiUrl, { method: "POST", headers, body: JSON.stringify({ phone, message: msg }) });
        const txt = await r.text().catch(() => "");
        results.push({ phone, status: r.status, body: txt.slice(0, 200) });
      }
    }

    return new Response(JSON.stringify({ ok: true, notificados: results, msg_phones: uniqueCandidates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notificar-resposta-whatsapp:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});