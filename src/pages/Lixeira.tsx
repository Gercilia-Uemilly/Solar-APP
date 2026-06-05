import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, Loader2, AlertTriangle } from "lucide-react";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

interface DeletedOficio {
  id: string;
  numero: string | null;
  assunto: string;
  destinatario: string;
  deleted_at: string | null;
  deleted_by_name: string | null;
  operador_nome: string | null;
  created_at: string;
}

export default function Lixeira() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: oficios, loading, refetch: fetchDeleted } = useRealtimeTable<DeletedOficio>({
    table: "oficios",
    channel: "lixeira-realtime",
    select: "id, numero, assunto, destinatario, deleted_at, deleted_by_name, operador_nome, created_at",
    orderBy: { column: "deleted_at", ascending: false },
    isNotNull: ["deleted_at"],
    validate: (row) => row.deleted_at !== null,
  });
  const [isEmptying, setIsEmptying] = useState(false);

  const handleRestore = async (id: string) => {
    const { error } = await supabase.from("oficios").update({
      deleted_at: null,
      deleted_by: null,
      deleted_by_name: null,
    } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" });
    } else {
      // Realtime will auto-remove from list
      toast({ title: "✅ Ofício restaurado!" });
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Excluir permanentemente? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("oficios").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Realtime will auto-remove from list
      toast({ title: "Ofício excluído permanentemente" });
    }
  };

  const handleEmptyTrash = useCallback(async () => {
    if (!isAdmin) return;
    if (!confirm("Deseja esvaziar a lixeira? Todos os ofícios serão excluídos permanentemente. Esta ação não pode ser desfeita.")) return;
    setIsEmptying(true);
    try {
      const ids = oficios.map((o) => o.id);
      if (ids.length === 0) {
        toast({ title: "A lixeira já está vazia." });
        return;
      }
      const { error } = await supabase.from("oficios").delete().in("id", ids);
      if (error) {
        toast({ title: "Erro ao esvaziar lixeira", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "✅ Lixeira esvaziada com sucesso!" });
      }
    } finally {
      setIsEmptying(false);
    }
  }, [isAdmin, oficios, toast]);

  const daysUntilExpiry = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    return Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Trash2 size={24} /> Lixeira
          </h1>
          <p className="text-sm text-muted-foreground">Ofícios excluídos ficam aqui por 30 dias antes de serem removidos permanentemente.</p>
        </div>
        {isAdmin && oficios.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEmptyTrash}
            disabled={isEmptying}
          >
            {isEmptying ? <Loader2 size={14} className="animate-spin mr-1" /> : <Trash2 size={14} className="mr-1" />}
            Esvaziar Lixeira
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={24} />
        </div>
      ) : oficios.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trash2 size={48} className="mx-auto mb-3 opacity-30" />
          <p>A lixeira está vazia</p>
        </div>
      ) : (
        <div className="space-y-2">
          {oficios.map(o => {
            const days = daysUntilExpiry(o.deleted_at);
            return (
              <div key={o.id} className="flex items-center justify-between gap-4 p-4 bg-card border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {o.numero ? `Ofício ${o.numero}` : "Rascunho"}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertTriangle size={10} /> {days}d restantes
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{o.assunto}</p>
                  <p className="text-xs text-muted-foreground">
                    Excluído por {o.deleted_by_name || "desconhecido"} em {new Date(o.deleted_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleRestore(o.id)}>
                    <RotateCcw size={14} className="mr-1" /> Restaurar
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" size="sm" onClick={() => handlePermanentDelete(o.id)}>
                      <Trash2 size={14} className="mr-1" /> Excluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
