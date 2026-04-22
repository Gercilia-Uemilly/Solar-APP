import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Download, AlertCircle } from "lucide-react";
import { buildMergedPdfBlob, type OficioData } from "@/lib/exportOficio";
import { toast } from "@/hooks/use-toast";

interface RealPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Builder lazy: só executa quando o usuário pedir a prévia, evita gastar créditos. */
  buildData: () => Promise<OficioData> | OficioData;
  fileName?: string;
}

/**
 * Prévia de alta fidelidade: gera o PDF final via mesmo pipeline da exportação
 * (Word → conversão → merge anexos), de modo que o usuário veja EXATAMENTE
 * o que será baixado/enviado ao Drive — incluindo grid 2x2 das imagens.
 */
export default function RealPreviewDialog({
  open,
  onOpenChange,
  buildData,
  fileName = "previa-oficio.pdf",
}: RealPreviewDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await buildData();
      const blob = await buildMergedPdfBlob(data);
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e: any) {
      console.error("[RealPreviewDialog] erro ao gerar prévia:", e);
      const msg = e?.message || "Não foi possível gerar a prévia agora.";
      setError(msg);
      toast({ title: "Falha na prévia real", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Gera a prévia automaticamente ao abrir, e limpa ao fechar
  useEffect(() => {
    if (open) {
      generate();
    } else {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Limpa URL ao desmontar
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔍 Prévia Real (PDF final)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Esta é a renderização EXATA do arquivo que será baixado/enviado ao Drive,
            gerada pelo mesmo pipeline da exportação (inclui grid 2x2 dos anexos).
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border pb-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
            {loading ? (
              <Loader2 size={14} className="mr-1 animate-spin" />
            ) : (
              <RefreshCw size={14} className="mr-1" />
            )}
            {loading ? "Gerando…" : "Atualizar prévia"}
          </Button>
          <Button size="sm" variant="default" onClick={handleDownload} disabled={!pdfUrl || loading}>
            <Download size={14} className="mr-1" /> Baixar este PDF
          </Button>
          <span className="text-[11px] text-muted-foreground ml-auto">
            Pode levar 10–20s. Consome créditos da conversão Word→PDF.
          </span>
        </div>

        <div className="flex-1 min-h-0 bg-muted/40 rounded-md overflow-hidden border border-border">
          {loading && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={32} className="animate-spin" />
              <p className="text-sm">Gerando PDF idêntico ao final…</p>
              <p className="text-xs">Word → conversão → merge anexos</p>
            </div>
          )}
          {!loading && error && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-destructive p-4 text-center">
              <AlertCircle size={32} />
              <p className="text-sm font-medium">Erro ao gerar prévia</p>
              <p className="text-xs text-muted-foreground max-w-md">{error}</p>
              <Button size="sm" variant="outline" onClick={generate}>
                <RefreshCw size={14} className="mr-1" /> Tentar novamente
              </Button>
            </div>
          )}
          {!loading && !error && pdfUrl && (
            <iframe
              src={pdfUrl}
              title="Prévia real do ofício"
              className="w-full h-full border-0"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
