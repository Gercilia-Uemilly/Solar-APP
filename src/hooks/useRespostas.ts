import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    const { data } = await (supabase as any)
      .from("oficio_respostas")
      .select("*")
      .eq("oficio_id", oficioId)
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
    if (resposta.arquivo_path) {
      await supabase.storage.from("respostas-oficios").remove([resposta.arquivo_path]);
    }
    await (supabase as any).from("oficio_respostas").delete().eq("id", resposta.id);
    await fetchAll();
  };

  return { respostas, loading, refetch: fetchAll, remove };
}

export async function uploadRespostaArquivo(oficioId: string, file: File, userId: string, userName: string) {
  const ext = file.name.split(".").pop() || "pdf";
  const path = `${oficioId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const up = await supabase.storage.from("respostas-oficios").upload(path, file, {
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

  const { data: row, error } = await (supabase as any).from("oficio_respostas").insert({
    oficio_id: oficioId,
    arquivo_url: `storage://respostas-oficios/${path}`,
    arquivo_path: path,
    arquivo_nome: file.name,
    tamanho_bytes: file.size,
    mime_type: file.type || "application/pdf",
    sha256,
    tipo_origem: "manual",
    uploaded_by: userId,
    uploaded_by_nome: userName,
  }).select("id").single();

  if (error) {
    if ((error as any).code === "23505") {
      await supabase.storage.from("respostas-oficios").remove([path]);
      throw new Error("Este arquivo já foi anexado a este ofício.");
    }
    throw error;
  }

  // dispara processamento assíncrono (não bloqueia)
  supabase.functions.invoke("processar-resposta-oficio", {
    body: { resposta_id: row.id },
  }).catch(() => { /* falha silenciosa, ofício ainda salvou */ });

  // dispara notificação ao operador autor (WhatsApp + in-app)
  supabase.functions.invoke("notificar-resposta-whatsapp", {
    body: { resposta_id: row.id, oficio_id: oficioId },
  }).catch(() => { /* silencioso */ });

  return row.id as string;
}

export async function getRespostaSignedUrl(path: string) {
  const cleanPath = normalizeRespostaPath(path);
  if (!cleanPath) return null;
  const { data } = await supabase.storage.from("respostas-oficios").createSignedUrl(cleanPath, 3600);
  return data?.signedUrl || null;
}

export function normalizeRespostaPath(pathOrUrl: string | null | undefined) {
  if (!pathOrUrl) return null;
  const value = pathOrUrl.trim();
  const marker = "/respostas-oficios/";
  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) return decodeURIComponent(value.slice(markerIndex + marker.length));

  try {
    const url = new URL(value);
    const objectMarker = "/storage/v1/object/";
    const objectIndex = url.pathname.indexOf(objectMarker);
    if (objectIndex >= 0) {
      const rest = url.pathname.slice(objectIndex + objectMarker.length);
      const parts = rest.split("/");
      const bucketIndex = parts.indexOf("respostas-oficios");
      if (bucketIndex >= 0) return decodeURIComponent(parts.slice(bucketIndex + 1).join("/"));
    }
    return null;
  } catch {
    // already a storage path
  }

  return value.replace(/^\/+/, "");
}

export async function fetchRespostaBlob(resposta: Pick<OficioResposta, "arquivo_path" | "arquivo_url" | "arquivo_nome" | "mime_type">) {
  const path = normalizeRespostaPath(resposta.arquivo_path) || normalizeRespostaPath(resposta.arquivo_url);
  const url = path ? await getRespostaSignedUrl(path) : resposta.arquivo_url;
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 404 ? "Arquivo não encontrado no armazenamento." : `Falha ao carregar arquivo (${res.status}).`);

  const blob = await res.blob();
  const type = blob.type || resposta.mime_type || (resposta.arquivo_nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  return new Blob([blob], { type });
}