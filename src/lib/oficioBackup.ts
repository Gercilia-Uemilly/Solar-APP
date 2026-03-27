import { supabase } from "@/integrations/supabase/client";
import type { OficioRow } from "@/lib/oficioUtils";

/**
 * Saves a snapshot of the current oficio state before making changes.
 * This enables any operator to undo/restore previous versions.
 */
export async function saveBackupBeforeEdit(oficioId: string): Promise<void> {
  try {
    // Fetch current state from DB
    const { data, error } = await supabase
      .from("oficios")
      .select("*")
      .eq("id", oficioId)
      .single();

    if (error || !data) return;

    // Don't backup if deleted
    if (data.deleted_at) return;

    // Check if we already have a backup within the last 5 minutes to avoid spam
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("oficios_backup")
      .select("id")
      .eq("oficio_id", oficioId)
      .gte("backup_em", fiveMinAgo)
      .limit(1);

    if (recent && recent.length > 0) return; // Already have a recent backup

    await supabase.from("oficios_backup").insert({
      oficio_id: oficioId,
      dados: data as any,
    });
  } catch {
    // Silent fail — backup is best-effort
  }
}

export interface BackupVersion {
  id: string;
  oficio_id: string;
  dados: Record<string, any>;
  backup_em: string | null;
}

/**
 * Fetch all backup versions for a given oficio.
 */
export async function fetchBackupVersions(oficioId: string): Promise<BackupVersion[]> {
  const { data, error } = await supabase
    .from("oficios_backup")
    .select("*")
    .eq("oficio_id", oficioId)
    .order("backup_em", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as BackupVersion[];
}

/**
 * Restore an oficio to a backup version.
 */
export async function restoreFromBackup(backup: BackupVersion): Promise<{ error?: string }> {
  // First save current state as a backup before restoring
  await saveBackupBeforeEdit(backup.oficio_id);

  const { id, created_at, author_id, deleted_at, deleted_by, deleted_by_name, ...fieldsToRestore } = backup.dados;

  const { error } = await supabase
    .from("oficios")
    .update(fieldsToRestore as any)
    .eq("id", backup.oficio_id);

  if (error) return { error: error.message };
  return {};
}
