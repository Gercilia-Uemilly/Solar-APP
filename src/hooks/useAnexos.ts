import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AnexoFile } from "@/components/FileDropzone";

function normalizeAttachmentMime(fileName: string, ...candidates: Array<string | null | undefined>): string {
  const normalizedCandidates = candidates
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean);
  const extension = (fileName.split(".").pop() || "").toLowerCase();
  if (normalizedCandidates.some((v) => v.includes("pdf")) || extension === "pdf") return "application/pdf";
  if (normalizedCandidates.some((v) => v.startsWith("image/"))) return normalizedCandidates.find((v) => v.startsWith("image/"))!;
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)) return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
  return normalizedCandidates[0] || "application/octet-stream";
}

/**
 * Hook that manages ofício attachments with immediate persistence.
 * - Uploads to storage + inserts DB row on add
 * - Deletes from storage + DB on remove
 * - Loads from DB when oficioId changes
 * - Realtime sync for multi-user
 */
export function useAnexos(oficioId: string | null) {
  const [anexos, setAnexos] = useState<AnexoFile[]>([]);
  const [loading, setLoading] = useState(false);
  const uploadsInProgressRef = useRef(new Set<string>());

  const fileFingerprint = (file: Pick<File, "name" | "size">) => `${file.name}|${file.size}`;

  // Load anexos from DB when oficioId changes
  useEffect(() => {
    if (!oficioId) {
      setAnexos([]);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("oficio_anexos")
        .select("*")
        .eq("oficio_id", oficioId)
        .order("created_at", { ascending: true });

      if (!cancelled && !error && data) {
        const loaded: AnexoFile[] = (data as any[]).map((a: any) => {
          const { data: urlData } = supabase.storage.from("midias").getPublicUrl(a.storage_path);
          const normalizedType = normalizeAttachmentMime(a.file_name || "anexo", a.mime_type || "");
          return {
            id: a.id,
            nome: a.file_name || "anexo",
            tipo: normalizedType,
            tamanho: 0,
            url: urlData.publicUrl,
            storagePath: a.storage_path,
          };
        });
        setAnexos(loaded);
      }
      if (!cancelled) setLoading(false);
    };
    load();

    return () => { cancelled = true; };
  }, [oficioId]);

  // Realtime sync
  useEffect(() => {
    if (!oficioId) return;

    const channel = supabase
      .channel(`anexos-${oficioId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "oficio_anexos",
        filter: `oficio_id=eq.${oficioId}`,
      }, (payload) => {
        const a = payload.new as any;
        setAnexos((prev) => {
          if (prev.some((x) => x.id === a.id)) return prev;
          const { data: urlData } = supabase.storage.from("midias").getPublicUrl(a.storage_path);
          return [...prev, {
            id: a.id,
            nome: a.file_name || "anexo",
            tipo: normalizeAttachmentMime(a.file_name || "", a.mime_type || ""),
            tamanho: 0,
            url: urlData.publicUrl,
            storagePath: a.storage_path,
          }];
        });
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "oficio_anexos",
        filter: `oficio_id=eq.${oficioId}`,
      }, (payload) => {
        const old = payload.old as any;
        setAnexos((prev) => prev.filter((x) => x.id !== old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [oficioId]);

  // Add file — immediately upload + persist
  const addFile = useCallback(async (file: File) => {
    if (!oficioId) return;

    const fingerprint = fileFingerprint(file);
    if (uploadsInProgressRef.current.has(fingerprint)) return;
    uploadsInProgressRef.current.add(fingerprint);

    const toastId = `anexo-${Date.now()}`;
    toast.loading("Salvando anexo...", { id: toastId });

    try {
      const ext = file.name.split(".").pop() || "bin";
      const storagePath = `oficios/${oficioId}/${crypto.randomUUID()}.${ext}`;
      const mimeType = normalizeAttachmentMime(file.name, file.type);

      const { error: upErr } = await supabase.storage.from("midias").upload(storagePath, file, {
        contentType: mimeType || undefined,
      });
      if (upErr) throw upErr;

      const { data: inserted, error: dbErr } = await (supabase.from("oficio_anexos") as any)
        .insert({
          oficio_id: oficioId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: mimeType,
        })
        .select()
        .single();
      if (dbErr) throw dbErr;

      const { data: urlData } = supabase.storage.from("midias").getPublicUrl(storagePath);

      // Only add locally if realtime hasn't already added it
      setAnexos((prev) => {
        if (prev.some((x) => x.id === inserted.id)) return prev;
        return [...prev, {
          id: inserted.id,
          nome: file.name,
          tipo: mimeType,
          tamanho: file.size,
          url: urlData.publicUrl,
          storagePath,
        }];
      });

      toast.success("Anexo salvo!", { id: toastId });
    } catch (err: any) {
      toast.error(`Erro ao salvar anexo: ${err.message}`, { id: toastId });
    } finally {
      uploadsInProgressRef.current.delete(fingerprint);
    }
  }, [oficioId]);

  // Remove file — immediately delete from storage + DB
  const removeFile = useCallback(async (anexoId: string) => {
    const anexo = anexos.find((a) => a.id === anexoId);
    if (!anexo) return;

    const toastId = `remove-${Date.now()}`;
    toast.loading("Removendo...", { id: toastId });

    try {
      // Remove from storage
      const storagePath = (anexo as any).storagePath;
      if (storagePath) {
        await supabase.storage.from("midias").remove([storagePath]);
      }

      // Remove from DB
      const { error: dbErr } = await supabase.from("oficio_anexos").delete().eq("id", anexoId);
      if (dbErr) throw dbErr;

      // Remove locally (realtime will also do this, but be instant)
      setAnexos((prev) => prev.filter((a) => a.id !== anexoId));

      toast.success("Anexo removido!", { id: toastId });
    } catch (err: any) {
      toast.error(`Erro ao remover: ${err.message}`, { id: toastId });
    }
  }, [anexos]);

  // Add a local-only file (for new ofícios not yet saved)
  const addLocalFile = useCallback((file: File) => {
    const mimeType = normalizeAttachmentMime(file.name, file.type);
    const newAnexo: AnexoFile = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: file.name,
      tipo: mimeType,
      tamanho: file.size,
      file,
    };
    setAnexos((prev) => {
      const isDupe = prev.some((a) => a.nome === file.name && a.tamanho === file.size);
      if (isDupe) return prev;
      return [...prev, newAnexo];
    });
  }, []);

  // Upload all local (unsaved) files — called after ofício is saved for the first time
  const uploadLocalFiles = useCallback(async (targetOficioId: string) => {
    const localFiles = anexos.filter((a) => a.file && a.id.startsWith("local-"));
    for (const anexo of localFiles) {
      if (!anexo.file) continue;
      const fingerprint = fileFingerprint(anexo.file);
      if (uploadsInProgressRef.current.has(fingerprint)) continue;
      uploadsInProgressRef.current.add(fingerprint);
      const ext = anexo.nome.split(".").pop() || "bin";
      const storagePath = `oficios/${targetOficioId}/${crypto.randomUUID()}.${ext}`;
      const mimeType = normalizeAttachmentMime(anexo.nome, anexo.tipo, anexo.file.type);

      try {
        const { error: upErr } = await supabase.storage.from("midias").upload(storagePath, anexo.file, {
          contentType: mimeType || undefined,
        });
        if (upErr) throw upErr;

        const { data: inserted, error: dbErr } = await (supabase.from("oficio_anexos") as any).insert({
          oficio_id: targetOficioId,
          storage_path: storagePath,
          file_name: anexo.nome,
          mime_type: mimeType,
        }).select().single();
        if (dbErr) throw dbErr;

        const { data: urlData } = supabase.storage.from("midias").getPublicUrl(storagePath);
        setAnexos((prev) => prev.map((item) => item.id === anexo.id ? {
          id: inserted.id,
          nome: anexo.nome,
          tipo: mimeType,
          tamanho: anexo.file?.size || anexo.tamanho,
          url: urlData.publicUrl,
          storagePath,
        } : item));
      } catch (err: any) {
        toast.error(`Erro ao salvar ${anexo.nome}: ${err.message}`);
      } finally {
        uploadsInProgressRef.current.delete(fingerprint);
      }
    }
  }, [anexos]);

  const reset = useCallback(() => {
    setAnexos([]);
  }, []);

  return {
    anexos,
    setAnexos,
    loading,
    addFile,
    removeFile,
    addLocalFile,
    uploadLocalFiles,
    reset,
  };
}
