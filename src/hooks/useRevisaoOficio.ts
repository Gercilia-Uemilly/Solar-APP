import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RevisaoResult, RevisaoErro } from "@/components/RevisaoOficioModal";

interface OficioRevisaoData {
  numero?: string;
  secretaria?: string;
  destinatario?: string;
  assunto?: string;
  endereco_completo?: string;
  vocativo?: string;
  conteudo?: string;
}

export function useRevisaoOficio() {
  const [revisaoResult, setRevisaoResult] = useState<RevisaoResult | null>(null);
  const [revisaoLoading, setRevisaoLoading] = useState(false);
  const [revisaoOpen, setRevisaoOpen] = useState(false);

  const revisarOficio = useCallback(async (dados: OficioRevisaoData) => {
    setRevisaoLoading(true);
    setRevisaoOpen(true);
    setRevisaoResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("revisar-oficio", {
        body: { oficio: dados },
      });

      if (error) throw error;
      setRevisaoResult(data as RevisaoResult);
      return data as RevisaoResult;
    } catch (e: any) {
      console.error("Erro na revisão:", e);
      setRevisaoResult({
        aprovado: true,
        pontuacao: 0,
        erros: [],
        resumo: "Não foi possível revisar: " + (e?.message || "erro desconhecido"),
      });
      return null;
    } finally {
      setRevisaoLoading(false);
    }
  }, []);

  const resetRevisao = useCallback(() => {
    setRevisaoResult(null);
    setRevisaoOpen(false);
  }, []);

  return {
    revisaoResult,
    revisaoLoading,
    revisaoOpen,
    setRevisaoOpen,
    revisarOficio,
    resetRevisao,
  };
}
