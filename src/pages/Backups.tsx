import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DatabaseBackup,
  Loader2,
  RotateCcw,
  Eye,
  Calendar,
  FileText,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface BackupRow {
  id: string;
  oficio_id: string;
  dados: Record<string, any>;
  backup_em: string | null;
}

export default function Backups() {
  const { toast } = useToast();
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [previewBackup, setPreviewBackup] = useState<BackupRow | null>(null);

  const fetchBackups = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oficios_backup")
      .select("*")
      .order("backup_em", { ascending: false })
      .limit(100);

    if (error) {
      toast({ title: "Erro ao carregar backups", description: error.message, variant: "destructive" });
    } else {
      setBackups((data || []) as BackupRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleRestore = async (backup: BackupRow) => {
    if (!confirm("Restaurar este ofício para o estado do backup? As alterações atuais serão substituídas.")) return;

    setRestoring(backup.id);
    try {
      const dados = backup.dados;
      // Remove fields that shouldn't be overwritten
      const { id, created_at, author_id, ...fieldsToRestore } = dados;

      const { error } = await supabase
        .from("oficios")
        .update(fieldsToRestore as any)
        .eq("id", backup.oficio_id);

      if (error) throw error;

      toast({ title: "✅ Ofício restaurado!", description: `Ofício restaurado para o estado de ${formatDate(backup.backup_em)}` });
    } catch (err: any) {
      toast({ title: "Erro ao restaurar", description: err.message, variant: "destructive" });
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filtered = backups.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const dados = b.dados;
    return (
      (dados.numero && String(dados.numero).includes(q)) ||
      (dados.assunto && String(dados.assunto).toLowerCase().includes(q)) ||
      (dados.destinatario && String(dados.destinatario).toLowerCase().includes(q)) ||
      (dados.operador_nome && String(dados.operador_nome).toLowerCase().includes(q))
    );
  });

  // Group backups by oficio_id
  const grouped = filtered.reduce<Record<string, BackupRow[]>>((acc, b) => {
    if (!acc[b.oficio_id]) acc[b.oficio_id] = [];
    acc[b.oficio_id].push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DatabaseBackup size={24} /> Backups de Ofícios
        </h1>
        <p className="text-sm text-muted-foreground">
          Snapshots diários dos últimos 30 dias. Restaure um ofício para um estado anterior.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por número, assunto, destinatário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DatabaseBackup size={48} className="mx-auto mb-3 opacity-30" />
          <p>Nenhum backup encontrado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([oficioId, versions]) => {
            const latest = versions[0];
            const dados = latest.dados;
            return (
              <Card key={oficioId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                    <FileText size={16} className="text-primary" />
                    <span>{dados.numero ? `Ofício ${dados.numero}` : "Rascunho"}</span>
                    <Badge variant="secondary" className="text-xs">
                      {versions.length} versão(ões)
                    </Badge>
                    {dados.status && (
                      <Badge variant="outline" className="text-xs">{dados.status}</Badge>
                    )}
                  </CardTitle>
                  {dados.assunto && (
                    <p className="text-sm text-muted-foreground truncate">{dados.assunto}</p>
                  )}
                  {dados.destinatario && (
                    <p className="text-xs text-muted-foreground">Para: {dados.destinatario}</p>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
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
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewBackup(v)}
                          >
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewBackup} onOpenChange={() => setPreviewBackup(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              Detalhes do Backup
              {previewBackup?.backup_em && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {formatDate(previewBackup.backup_em)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {previewBackup && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Número", previewBackup.dados.numero],
                  ["Status", previewBackup.dados.status],
                  ["Assunto", previewBackup.dados.assunto],
                  ["Destinatário", previewBackup.dados.destinatario],
                  ["Cargo", previewBackup.dados.cargo_destinatario],
                  ["Operador", previewBackup.dados.operador_nome],
                  ["Bairro", previewBackup.dados.bairro],
                  ["Solicitante", previewBackup.dados.solicitante],
                  ["Secretaria", previewBackup.dados.secretaria_identificada],
                  ["Urgência", previewBackup.dados.urgencia],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label as string}>
                      <span className="font-medium text-foreground">{label}:</span>{" "}
                      <span className="text-muted-foreground">{value}</span>
                    </div>
                  ) : null
                )}
              </div>

              {previewBackup.dados.conteudo && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Conteúdo do Ofício</h4>
                  <div
                    className="prose prose-sm max-w-none bg-muted/30 rounded-lg p-4 border border-border text-foreground"
                    dangerouslySetInnerHTML={{ __html: previewBackup.dados.conteudo }}
                  />
                </div>
              )}

              {previewBackup.dados.resposta_cidadao && (
                <div>
                  <h4 className="font-medium text-foreground mb-2">Resposta ao Cidadão</h4>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border text-sm text-muted-foreground whitespace-pre-wrap">
                    {previewBackup.dados.resposta_cidadao}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewBackup(null)}>
              Fechar
            </Button>
            {previewBackup && (
              <Button
                disabled={restoring === previewBackup.id}
                onClick={() => {
                  handleRestore(previewBackup);
                  setPreviewBackup(null);
                }}
              >
                <RotateCcw size={14} className="mr-1" /> Restaurar este backup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
