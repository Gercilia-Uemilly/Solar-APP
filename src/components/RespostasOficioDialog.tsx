import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Trash2, Loader2, Eye, Upload, ExternalLink } from "lucide-react";
import { useRespostas, getRespostaSignedUrl, type OficioResposta } from "@/hooks/useRespostas";
import { useToast } from "@/hooks/use-toast";
import UploadRespostaModal from "./UploadRespostaModal";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oficioId: string | null;
  oficioNumero?: string | null;
}

export default function RespostasOficioDialog({ open, onOpenChange, oficioId, oficioNumero }: Props) {
  const { toast } = useToast();
  const { respostas, loading, remove } = useRespostas(open ? oficioId : null);
  const [previewFile, setPreviewFile] = useState<{ blob: Blob; name: string; mime: string } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchAsBlob = async (r: OficioResposta): Promise<Blob | null> => {
    const url = r.arquivo_path ? await getRespostaSignedUrl(r.arquivo_path) : r.arquivo_url;
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const type = blob.type || (r.arquivo_nome.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
      return new Blob([blob], { type });
    } catch {
      return null;
    }
  };

  const handleView = async (r: OficioResposta) => {
    const blob = await fetchAsBlob(r);
    if (blob) setPreviewFile({ blob, name: r.arquivo_nome, mime: blob.type || r.mime_type || "application/pdf" });
    else toast({ title: "Não foi possível abrir o arquivo", variant: "destructive" });
  };

  const handleOpenNewTab = async (r: OficioResposta) => {
    // Open window synchronously to avoid popup blockers, then navigate when blob is ready
    const win = window.open("about:blank", "_blank");
    const blob = await fetchAsBlob(r);
    if (!blob) { win?.close(); toast({ title: "Não foi possível abrir o arquivo", variant: "destructive" }); return; }
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.location.href = url;
  };

  const handleDownload = async (r: OficioResposta) => {
    const blob = await fetchAsBlob(r);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = r.arquivo_nome;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDelete = async (r: OficioResposta) => {
    if (!confirm(`Excluir "${r.arquivo_nome}"?`)) return;
    try { await remove(r); toast({ title: "Resposta excluída" }); }
    catch (e: any) { toast({ title: "Falha ao excluir", description: e?.message, variant: "destructive" }); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Respostas {oficioNumero ? `· ${oficioNumero}` : ""}</DialogTitle>
            <DialogDescription>
              {respostas.length === 0 ? "Nenhuma resposta anexada ainda." : `${respostas.length} resposta(s) anexada(s).`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload size={14} className="mr-1" /> Subir Resposta
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {respostas.map(r => (
                <div key={r.id} className="border rounded-lg p-3 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <FileText size={20} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{r.arquivo_nome}</p>
                        {r.tipo_origem === "import_excel" && <Badge variant="outline" className="text-xs">Histórico</Badge>}
                        {r.match_status === "pendente_revisao" && <Badge variant="secondary" className="text-xs">Revisar</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                        <span>{new Date(r.created_at).toLocaleString("pt-BR")}</span>
                        {r.uploaded_by_nome && <span>por {r.uploaded_by_nome}</span>}
                        {r.orgao_respondente && <span>· {r.orgao_respondente}</span>}
                      </div>
                      {r.resumo_ia && (
                        <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2">{r.resumo_ia}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handleView(r)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Visualizar"><Eye size={16} /></button>
                      <button onClick={() => handleOpenNewTab(r)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Abrir em nova aba"><ExternalLink size={16} /></button>
                      <button onClick={() => handleDownload(r)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Baixar"><Download size={16} /></button>
                      <button onClick={() => handleDelete(r)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <UploadRespostaModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        oficioId={oficioId}
        oficioNumero={oficioNumero}
      />

      <Dialog open={!!previewFile} onOpenChange={(v) => !v && setPreviewFile(null)}>
        <DialogContent className="max-w-5xl h-[85vh] p-2">
          <DialogHeader className="px-2"><DialogTitle>Pré-visualização</DialogTitle></DialogHeader>
          {previewFile && <RespostaPreview file={previewFile} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RespostaPreview({ file }: { file: { blob: Blob; name: string; mime: string } }) {
  const [pages, setPages] = useState<string[]>([]);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const urlsToRevoke: string[] = [];

    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      setPages([]);
      setObjectUrl(null);

      const isPdf = file.mime.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        const url = URL.createObjectURL(file.blob);
        urlsToRevoke.push(url);
        if (!cancelled) {
          setObjectUrl(url);
          setLoading(false);
        }
        return;
      }

      try {
        const data = new Uint8Array(await file.blob.arrayBuffer());
        let pdf: pdfjsLib.PDFDocumentProxy;
        try {
          pdf = await pdfjsLib.getDocument({ data }).promise;
        } catch {
          pdf = await pdfjsLib.getDocument({ data, disableWorker: true } as any).promise;
        }

        const renderedPages: string[] = [];
        const maxWidth = 980;
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const viewportBase = page.getViewport({ scale: 1 });
          const scale = Math.min(1.7, maxWidth / viewportBase.width);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const url = canvas.toDataURL("image/png");
          renderedPages.push(url);
          canvas.width = 0;
          canvas.height = 0;
        }

        if (!cancelled) setPages(renderedPages);
      } catch {
        if (!cancelled) setError("Não foi possível gerar a pré-visualização deste PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    renderPdf();
    return () => {
      cancelled = true;
      urlsToRevoke.forEach(URL.revokeObjectURL);
    };
  }, [file]);

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{error}</div>;
  }

  if (objectUrl) {
    return <img src={objectUrl} alt={file.name} className="max-h-full max-w-full object-contain mx-auto rounded border" />;
  }

  return (
    <div className="h-full overflow-y-auto rounded border bg-muted/40 p-3">
      <div className="mx-auto flex max-w-[980px] flex-col gap-4">
        {pages.map((src, index) => (
          <img key={index} src={src} alt={`${file.name} página ${index + 1}`} className="w-full rounded border bg-background shadow-sm" />
        ))}
      </div>
    </div>
  );
}