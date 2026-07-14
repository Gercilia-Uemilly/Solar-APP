import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, ArrowRight, Calendar, User, HelpCircle } from "lucide-react";

interface StatusHistoryRow {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  alterado_por_nome: string | null;
  alterado_em: string;
  estimado?: boolean;
}

interface Props {
  oficioId: string;
  oficioNumero?: string | null;
}

export default function StatusHistoryDialog({ oficioId, oficioNumero }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<StatusHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpen = async () => {
    setOpen(true);
    setLoading(true);
    const { data } = await (supabase as any)
      .from("oficio_status_history")
      .select("id,status_anterior,status_novo,alterado_por_nome,alterado_em,estimado")
      .eq("oficio_id", oficioId)
      .order("alterado_em", { ascending: false });
    setRows((data as StatusHistoryRow[]) || []);
    setLoading(false);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-2 text-muted-foreground hover:text-foreground"
        title="Histórico de status"
      >
        <Activity size={16} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Activity size={18} />
              Histórico de Status
              {oficioNumero && (
                <Badge variant="secondary" className="text-xs font-normal">
                  {oficioNumero}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity size={48} className="mx-auto mb-3 opacity-30" />
              <p>Nenhuma mudança de status registrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    {r.status_anterior ? (
                      <>
                        <Badge variant="outline">{r.status_anterior}</Badge>
                        <ArrowRight size={14} className="text-muted-foreground" />
                        <Badge>{r.status_novo}</Badge>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted-foreground">Criado como</span>
                        <Badge>{r.status_novo}</Badge>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User size={12} /> {r.alterado_por_nome || "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} /> {fmt(r.alterado_em)}
                    </span>
                    {r.estimado && (
                      <span
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                        title="Registro anterior ao rastreamento automático. O nome foi inferido a partir de dados existentes e pode não corresponder a quem realmente alterou o status."
                      >
                        <HelpCircle size={11} /> atribuição estimada
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}