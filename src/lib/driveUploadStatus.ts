import { supabase } from "@/integrations/supabase/client";

export function isDriveAuthRequired(payload: any) {
  return Boolean(payload?.needsAuth || payload?.needsReauth);
}

export function getDriveAuthDescription(payload: any) {
  if (payload?.needsReauth) {
    return "Permissões expiradas. Reconecte sua conta em Configurações → Google Drive.";
  }

  return "Vá em Configurações → Google Drive → Conectar para vincular sua conta.";
}

export function getDriveErrorMessage(payload: any, fallback = "Erro ao enviar para o Drive") {
  return payload?.error || payload?.message || fallback;
}

export async function ensureDriveConnected(authToken: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const resp = await fetch(`${supabaseUrl}/functions/v1/google-user-oauth`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status" }),
  });

  if (!resp.ok) return false;

  const result = await resp.json().catch(() => ({}));
  return Boolean(result.connected);
}