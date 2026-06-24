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

  const { data: pub } = supabase.storage.from("respostas-oficios").getPublicUrl(path);

  const { data: row, error } = await (supabase as any).from("oficio_respostas").insert({
    oficio_id: oficioId,
    arquivo_url: pub.publicUrl,
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

  return row.id as string;
}

export async function getRespostaSignedUrl(path: string) {
  const { data } = await supabase.storage.from("respostas-oficios").createSignedUrl(path, 3600);
  return data?.signedUrl || null;
}