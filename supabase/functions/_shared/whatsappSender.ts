// Envio de mensagens WhatsApp com suporte a Evolution API (padrão atual)
// e fallback para Z-API (legado). Usado pelas notificações do Solar.

export type EnvioResultado = {
  provider: "evolution" | "zapi" | "none";
  ok: boolean;
  status?: number;
  body?: string;
  motivo?: string;
};

function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

export function resolveZapiSendUrl(instanceRaw?: string | null, tokenRaw?: string | null): string {
  const inst = (instanceRaw || "").trim();
  const tok = (tokenRaw || "").trim();
  if (!inst || !tok) return "";
  if (/^https?:\/\//i.test(inst)) {
    try {
      const u = new URL(inst);
      const m = u.pathname.match(/\/instances\/([^/]+)\/token\/([^/]+)/i);
      if (m) return `${u.protocol}//${u.host}/instances/${m[1]}/token/${m[2]}/send-text`;
    } catch { /* ignore */ }
  }
  return `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
}

export function whatsappProviderConfigurado(): "evolution" | "zapi" | "none" {
  const url = (Deno.env.get("EVOLUTION_API_URL") || "").trim();
  const key = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
  const inst = (Deno.env.get("EVOLUTION_INSTANCE") || "").trim();
  if (url && key && inst) return "evolution";
  if (resolveZapiSendUrl(Deno.env.get("ZAPI_INSTANCE_ID"), Deno.env.get("ZAPI_TOKEN"))) return "zapi";
  return "none";
}

async function enviarEvolution(phone: string, message: string): Promise<EnvioResultado> {
  const base = normalizeBaseUrl(Deno.env.get("EVOLUTION_API_URL") || "");
  const key = (Deno.env.get("EVOLUTION_API_KEY") || "").trim();
  const instance = (Deno.env.get("EVOLUTION_INSTANCE") || "").trim();
  const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;
  const headers = { "Content-Type": "application/json", apikey: key };

  // Evolution v2 aceita {number, text}; v1 exige {number, textMessage:{text}}
  let r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ number: phone, text: message }),
  });
  let txt = await r.text().catch(() => "");
  if (!r.ok) {
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: phone, textMessage: { text: message } }),
    });
    txt = await r.text().catch(() => "");
  }
  return { provider: "evolution", ok: r.ok, status: r.status, body: txt.slice(0, 300) };
}

async function enviarZapi(phone: string, message: string): Promise<EnvioResultado> {
  const url = resolveZapiSendUrl(Deno.env.get("ZAPI_INSTANCE_ID"), Deno.env.get("ZAPI_TOKEN"));
  if (!url) return { provider: "none", ok: false, motivo: "zapi_nao_configurada" };
  const clientToken = (Deno.env.get("ZAPI_CLIENT_TOKEN") || "").trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
  const txt = await r.text().catch(() => "");
  return { provider: "zapi", ok: r.ok, status: r.status, body: txt.slice(0, 300) };
}

export async function enviarWhatsApp(phone: string, message: string): Promise<EnvioResultado> {
  const provider = whatsappProviderConfigurado();
  if (provider === "none") return { provider: "none", ok: false, motivo: "whatsapp_nao_configurado" };
  if (provider === "evolution") {
    const res = await enviarEvolution(phone, message);
    if (res.ok) return res;
    console.error("[whatsappSender] Evolution falhou, tentando Z-API", res.status, res.body);
    const fallback = await enviarZapi(phone, message);
    return fallback.provider === "none" ? res : fallback;
  }
  return await enviarZapi(phone, message);
}
