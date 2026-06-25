import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Trash2, Loader2, Eye, Upload } from "lucide-react";
import { useRespostas, fetchRespostaBlob, type OficioResposta } from "@/hooks/useRespostas";
import { useToast } from "@/hooks/use-toast";
import UploadRespostaModal from "./UploadRespostaModal";
import RespostaArquivoPreview, { type RespostaPreviewFile } from "./RespostaArquivoPreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  oficioId: string | null;
  oficioNumero?: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado.";
}

export default function RespostasOficioDialog({ open, onOpenChange, oficioId, oficioNumero }: Props) {
  const { toast } = useToast();
  const { respostas, loading, remove } = useRespostas(open ? oficioId : null);
  const [previewFile, setPreviewFile] = useState<RespostaPreviewFile | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchAsBlob = async (r: OficioResposta): Promise<Blob | null> => {
    try {
      return await fetchRespostaBlob(r);
    } catch (error) {
      toast({ title: "Não foi possível carregar o arquivo", description: getErrorMessage(error), variant: "destructive" });
      return null;
    }
  };

  const handleView = async (r: OficioResposta) => {
    const blob = await fetchAsBlob(r);
    if (blob) setPreviewFile({ blob, name: r.arquivo_nome, mime: blob.type || r.mime_type || "application/pdf" });
    else toast({ title: "Não foi possível abrir o arquivo", variant: "destructive" });
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
    catch (error) { toast({ title: "Falha ao excluir", description: getErrorMessage(error), variant: "destructive" }); }
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
                        {r.match_status === "pendente_processamento" && <Badge variant="secondary" className="text-xs">Processando</Badge>}
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
          {previewFile && <RespostaArquivoPreview file={previewFile} />}
        </DialogContent>
      </Dialog>
    </>
  );
}