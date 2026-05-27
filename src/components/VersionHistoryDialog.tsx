import { useState } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { History, RotateCcw, Loader2, Eye, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchBackupVersions, restoreFromBackup, type BackupVersion } from "@/lib/oficioBackup";

interface Props {
  oficioId: string;
  oficioNumero?: string | null;
  onRestored?: () => void;
}

export default function VersionHistoryDialog({ oficioId, oficioNumero, onRestored }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<BackupVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupVersion | null>(null);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    const data = await fetchBackupVersions(oficioId);
    setVersions(data);
    setLoading(false);
  };

  const handleRestore = async (v: BackupVersion) => {
    if (!confirm("Restaurar este ofício para o estado desta versão? O estado atual será salvo como backup antes da restauração.")) return;
    setRestoring(v.id);
    const result = await restoreFromBackup(v);
    if (result.error) {
      toast({ title: "Erro ao restaurar", description: result.error, variant: "destructive" });
    } else {
      toast({ title: "✅ Versão restaurada com sucesso!" });
      onRestored?.();
      setOpen(false);
    }
    setRestoring(null);
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 text-muted-foreground hover:text-foreground"
        title="Histórico de versões"
      >
        <History size={16} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <History size={18} />
              Histórico de Versões
              {oficioNumero && (
                <Badge variant="secondary" className="text-xs font-normal">
                  Ofício {oficioNumero}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma versão anterior encontrada</p>
              <p className="text-xs mt-1">As versões são salvas automaticamente antes de cada edição.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
                    <Calendar size={14} className="flex-shrink-0" />
                    <span className="truncate">{formatDate(v.backup_em)}</span>
                    {v.dados.operador_nome && (
                      <span className="text-xs">• {v.dados.operador_nome}</span>
                    )}
                    {v.dados.status && (
                      <Badge variant="outline" className="text-xs">{v.dados.status}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => setPreview(v)}>
                      <Eye size={14} className="mr-1" /> Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoring === v.id}
                      onClick={() => handleRestore(v)}
                    >
                      {restoring === v.id ? (
                        <Loader2 size={14} className="mr-1 animate-spin" />
                      ) : (
                        <RotateCcw size={14} className="mr-1" />
                      )}
                      Restaurar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Eye size={18} />
              Detalhes da Versão
              {preview?.backup_em && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {formatDate(preview.backup_em)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Número", preview.dados.numero],
                  ["Status", preview.dados.status],
                  ["Assunto", preview.dados.assunto],
                  ["Destinatário", preview.dados.destinatario],
                  ["Cargo", preview.dados.cargo_destinatario],
                  ["Operador", preview.dados.operador_nome],
                  ["Bairro", preview.dados.bairro],
                  ["Solicitante", preview.dados.solicitante],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label as string}>
                      <span className="font-medium text-foreground">{label}:</span>{" "}
                      <span className="text-muted-foreground">{value}</span>
                    </div>
                  ) : null
                )}
              </div>

              {preview.dados.conteudo && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Conteúdo</h4>
                  <div
                    className="prose prose-sm max-w-none bg-muted/30 rounded-lg p-4 border border-border text-foreground"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.dados.conteudo || "") }}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
            {preview && (
              <Button
                disabled={restoring === preview.id}
                onClick={() => {
                  handleRestore(preview);
                  setPreview(null);
                }}
              >
                <RotateCcw size={14} className="mr-1" /> Restaurar esta versão
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
