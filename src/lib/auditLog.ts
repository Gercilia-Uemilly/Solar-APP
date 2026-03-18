import { supabase } from "@/integrations/supabase/client";

export type AuditAction = "criar" | "editar" | "exportar" | "deletar" | "restaurar" | "login" | "logout";

interface AuditDetails {
  tabela?: string;
  id?: string;
  numero?: string;
  formato?: string;
  [key: string]: any;
}

/**
 * Register an action in the audit_log table.
 * Fire-and-forget — does not block the caller.
 */
export async function registrarAuditoria(acao: AuditAction, detalhes: AuditDetails) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("audit_log") as any).insert({
      user_id: user.id,
      user_nome: user.user_metadata?.full_name || user.email || "",
      acao,
      tabela: detalhes.tabela || null,
      registro_id: detalhes.id || null,
      detalhes,
    });
  } catch {
    // Silent — audit should never break main flow
  }
}
