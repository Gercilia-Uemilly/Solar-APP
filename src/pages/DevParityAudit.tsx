/**
 * Auditoria de paridade Preview x PDF exportado.
 * Rota disponível apenas em desenvolvimento (`import.meta.env.DEV`), usada pelo
 * teste E2E `e2e/preview-parity.spec.ts`. Não altera nenhum fluxo de produção.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import OficioPreview from "@/components/OficioPreview";
import { supabase } from "@/integrations/supabase/client";
import { buildMergedPdfBlob } from "@/lib/exportOficio";
import logoCamara from "@/assets/logo-camara-docx.jpeg";
import logoFabao from "@/assets/logo-fabao-docx.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";

type Row = Record<string, any>;

declare global {
  interface Window {
    __parity?: {
      ready: boolean;
      previewPages: number;
      buildPdfBase64: () => Promise<string>;
    };
  }
}

export default function DevParityAudit() {
  const [params] = useSearchParams();
  const id = params.get("id") || "";
  const [oficio, setOficio] = useState<Row | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data, error } = await supabase.from("oficios").select("*").eq("id", id).maybeSingle();
      if (!ativo) return;
      if (error) setErro(error.message);
      else setOficio(data as Row);
    })();
    return () => {
      ativo = false;
    };
  }, [id]);

  useEffect(() => {
    if (!oficio) return;

    const exportData = {
      oficioId: oficio.id,
      numero: oficio.numero || "",
      destinatario: (oficio.destinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim(),
      assunto: oficio.assunto || "",
      conteudo: oficio.conteudo || "",
      bairro: oficio.bairro || "",
      cargoDestinatario: (oficio.cargo_destinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim(),
      dataGeracao: oficio.data_geracao || undefined,
      operadorNome: oficio.operador_nome || undefined,
      secretaria: oficio.secretaria_identificada || undefined,
      origem: oficio.origem || undefined,
      logoCamaraUrl: logoCamara,
      logoFabaoUrl: logoFabao,
      assinaturaUrl: assinaturaFabao,
      vocativo: oficio.vocativo || undefined,
      fechamento: oficio.fechamento_text || undefined,
    };

    const contarPaginas = () => document.querySelectorAll(".preview-pagina-a4").length;

    window.__parity = {
      ready: true,
      get previewPages() {
        return contarPaginas();
      },
      buildPdfBase64: async () => {
        const blob = await buildMergedPdfBlob(exportData as any);
        const buffer = new Uint8Array(await blob.arrayBuffer());
        let binario = "";
        for (let i = 0; i < buffer.length; i += 1) binario += String.fromCharCode(buffer[i]);
        return btoa(binario);
      },
    } as Window["__parity"];
  }, [oficio]);

  if (erro) return <div data-testid="parity-error">{erro}</div>;
  if (!oficio) return <div data-testid="parity-loading">carregando…</div>;

  return (
    <div data-testid="parity-root" style={{ padding: 24, background: "#f1f1f1" }}>
      <OficioPreview
        numero={oficio.numero || ""}
        destinatario={oficio.destinatario || ""}
        assunto={oficio.assunto || ""}
        conteudo={oficio.conteudo || ""}
        bairro={oficio.bairro || ""}
        cargoDestinatario={oficio.cargo_destinatario || ""}
        secretaria={oficio.secretaria_identificada || ""}
        operadorNome={oficio.operador_nome || ""}
        dataGeracao={oficio.data_geracao || undefined}
        vocativoOverride={oficio.vocativo || undefined}
        fechamento={oficio.fechamento_text || undefined}
        editable={false}
      />
    </div>
  );
}
