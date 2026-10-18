// Avisa o n8n que um ofício foi revisado (enviado ao Drive). Chamado pelo gatilho do banco.
// Entrada: POST { oficio_id }. Só avisa se o status atual for 'Salvo no Drive'.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const N8N_URL = "https://n8n.solardigital.site/webhook/oficio-revisado-6f7a5cbbfc50";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  let oficioId = "";
  try { oficioId = String((await req.json())?.oficio_id || "").trim(); } catch { /* corpo inválido */ }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oficioId)) {
    return json({ error: "oficio_id inválido" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: o, error } = await admin.from("oficios").select("id, status").eq("id", oficioId).maybeSingle();
  if (error) return json({ ok: false, erro: "Erro ao ler o ofício" }, 200);
  if (!o || o.status !== "Salvo no Drive") return json({ ok: false });

  try {
    const r = await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bot-secret": Deno.env.get("BOT_SECRET") ?? "" },
      body: JSON.stringify({ oficio_id: o.id, status: o.status }),
    });
    await r.text();
    if (!r.ok) return json({ ok: false, erro: `n8n respondeu ${r.status}` });
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, erro: "n8n não respondeu: " + String((e as Error)?.message || e).slice(0, 200) });
  }
});
