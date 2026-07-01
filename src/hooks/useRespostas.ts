import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const RESPOSTAS_BUCKET = "respostas-oficios";
const STORAGE_PREFIX = `storage://${RESPOSTAS_BUCKET}/`;

export interface OficioResposta {
  id: string;
  oficio_id: string;
  arquivo_url: string;
  arquivo_path: string | null;
  arquivo_nome: string;
  tamanho_bytes: number | null;
  mime_type: string | null;
  tipo_origem: string;
  data_resposta: string | null;
  orgao_respondente: string | null;
  resumo_ia: string | null;
  match_status: string;
  match_confianca: number | null;
  uploaded_by_nome: string | null;
  created_at: string;
}

export function useRespostas(oficioId: string | null | undefined) {
  const [respostas, setRespostas] = useState<OficioResposta[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!oficioId) { setRespostas([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("oficio_respostas")
      .select("*")
      .eq("oficio_id", oficioId)
      .in("match_status", ["confirmado", "pendente_processamento"])
      .order("created_at", { ascending: false });
    setRespostas((data as OficioResposta[]) || []);
    setLoading(false);
  }, [oficioId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!oficioId) return;
    const ch = supabase
      .channel(`oficio_respostas_${oficioId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "oficio_respostas", filter: `oficio_id=eq.${oficioId}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [oficioId, fetchAll]);

  const remove = async (resposta: OficioResposta) => {
    const path = normalizeRespostaPath(resposta.arquivo_path) || normalizeRespostaPath(resposta.arquivo_url);
    if (path) {
      await supabase.storage.from(RESPOSTAS_BUCKET).remove([path]);
    }
    await supabase.from("oficio_respostas").delete().eq("id", resposta.id);
    await fetchAll();
  };

  return { respostas, loading, refetch: fetchAll, remove };
}

export async function uploadRespostaArquivo(oficioId: string, file: File, userId: string, userName: string) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${oficioId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from(RESPOSTAS_BUCKET).upload(path, file, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });
  if (up.error) throw up.error;

  // hash
  let sha256: string | null = null;
  try {
    const buf = await file.arrayBuffer();
    const h = await crypto.subtle.digest("SHA-256", buf);
    sha256 = Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { /* ignore */ }

  const insertPayload = {
    oficio_id: oficioId,
    arquivo_url: `${STORAGE_PREFIX}${path}`,
    arquivo_path: path,
    arquivo_nome: file.name,
    tamanho_bytes: file.size,
    mime_type: file.type || "application/pdf",
    sha256,
    tipo_origem: "manual",
    match_status: "pendente_processamento",
    match_metodo: "upload_manual_aguardando_analise",
    match_confianca: null,
    uploaded_by: userId,
    uploaded_by_nome: userName,
  };

  let insertRes = await supabase.from("oficio_respostas").insert(insertPayload).select("id").single();

  if (insertRes.error?.code === "23505" && sha256) {
    // Já existe um registro com o mesmo hash para este ofício.
    // Se estiver em estado inválido/oculto (ex.: arquivo_invalido), remove e tenta de novo.
    const { data: existing } = await supabase
      .from("oficio_respostas")
      .select("id, match_status, arquivo_path, arquivo_url")
      .eq("oficio_id", oficioId)
      .eq("sha256", sha256)
      .maybeSingle();

    const visivel = existing && ["confirmado", "pendente_processamento", "pendente_revisao"].includes(existing.match_status);

    if (existing && !visivel) {
      const oldPath = normalizeRespostaPath(existing.arquivo_path) || normalizeRespostaPath(existing.arquivo_url);
      if (oldPath) await supabase.storage.from(RESPOSTAS_BUCKET).remove([oldPath]).catch(() => {});
      await supabase.from("oficio_respostas").delete().eq("id", existing.id);
      insertRes = await supabase.from("oficio_respostas").insert(insertPayload).select("id").single();
    } else {
      await supabase.storage.from(RESPOSTAS_BUCKET).remove([path]);
      throw new Error("Este arquivo já foi anexado a este ofício.");
    }
  }

  if (insertRes.error) {
    await supabase.storage.from(RESPOSTAS_BUCKET).remove([path]).catch(() => {});
    throw insertRes.error;
  }

  const row = insertRes.data!;

  // dispara processamento assíncrono (não bloqueia)
  supabase.functions.invoke("processar-resposta-oficio", {
    body: { resposta_id: row.id },
  }).catch(() => { /* falha silenciosa, ofício ainda salvou */ });

  return row.id as string;
}

export async function getRespostaSignedUrl(path: string) {
  const cleanPath = normalizeRespostaPath(path);
  if (!cleanPath) return null;
  const { data } = await supabase.storage.from(RESPOSTAS_BUCKET).createSignedUrl(cleanPath, 3600);
  return data?.signedUrl || null;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeRespostaPath(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  const value = pathOrUrl.trim();

  if (value.startsWith(STORAGE_PREFIX)) {
    return safeDecode(value.slice(STORAGE_PREFIX.length).replace(/^\/+/, ""));
  }

  if (value.startsWith(`${RESPOSTAS_BUCKET}/`)) {
    return safeDecode(value.slice(RESPOSTAS_BUCKET.length + 1).replace(/^\/+/, ""));
  }

  const marker = `/${RESPOSTAS_BUCKET}/`;
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) return safeDecode(value.slice(markerIndex + marker.length));

  try {
    const url = new URL(value);
    if (url.protocol === "storage:" && url.hostname === RESPOSTAS_BUCKET) {
      return safeDecode(url.pathname.replace(/^\/+/, ""));
    }

    const objectMarker = "/storage/v1/object/";
    const objectIndex = url.pathname.indexOf(objectMarker);
    if (objectIndex >= 0) {
      const rest = url.pathname.slice(objectIndex + objectMarker.length);
      const parts = rest.split("/");
      const bucketIndex = parts.indexOf(RESPOSTAS_BUCKET);
      if (bucketIndex >= 0) return safeDecode(parts.slice(bucketIndex + 1).join("/"));
    }
    return null;
  } catch {
    // already a storage path
  }

  return safeDecode(value.replace(/^\/+/, ""));
}

export async function fetchRespostaBlob(resposta: Pick<OficioResposta, "arquivo_path" | "arquivo_url" | "arquivo_nome" | "mime_type">) {
  const path = normalizeRespostaPath(resposta.arquivo_path) || normalizeRespostaPath(resposta.arquivo_url);
  let blob: Blob;

  if (path) {
    const { data, error } = await supabase.storage.from(RESPOSTAS_BUCKET).download(path);
    if (error) {
      const message = error.message?.toLowerCase() || "";
      throw new Error(message.includes("not found") || message.includes("404") ? "Arquivo não encontrado no armazenamento." : error.message);
    }
    blob = data;
  } else if (resposta.arquivo_url?.startsWith("http")) {
    const res = await fetch(resposta.arquivo_url);
    if (!res.ok) throw new Error(res.status === 404 ? "Arquivo não encontrado no armazenamento." : `Falha ao carregar arquivo (${res.status}).`);
    blob = await res.blob();
  } else {
    throw new Error("Caminho do arquivo da resposta inválido.");
  }

  const type = blob.type || resposta.mime_type || (resposta.arquivo_nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  return new Blob([blob], { type });
}