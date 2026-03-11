import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Hash, Loader2, RefreshCw } from "lucide-react";

interface NumRow {
  id: string;
  numero: number;
  ano: number;
  status: string;
  reservado_por: string | null;
  reservado_por_nome: string | null;
  reservado_em: string | null;
  usado_por: string | null;
  usado_por_nome: string | null;
  usado_em: string | null;
  oficio_id: string | null;
}

const statusColors: Record<string, string> = {
  disponivel: "bg-green-500/30 text-green-800 dark:text-green-300 hover:bg-green-500/50",
  reservado: "bg-yellow-500/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-500/50",
  usado: "bg-blue-500/30 text-blue-800 dark:text-blue-300 hover:bg-blue-500/50",
  cancelado: "bg-red-500/30 text-red-800 dark:text-red-300 hover:bg-red-500/50",
};

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  usado: "Usado",
  cancelado: "Cancelado",
};

const statusEmojis: Record<string, string> = {
  disponivel: "🟩",
  reservado: "🟨",
  usado: "🟦",
  cancelado: "🟥",
};

export default function PainelNumeracao() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [numeros, setNumeros] = useState<NumRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NumRow | null>(null);
  const [ano] = useState(new Date().getFullYear());

  const fetchNumeros = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oficio_numeracao" as any)
      .select("*")
      .eq("ano", ano)
      .order("numero", { ascending: true });
    if (!error && data) setNumeros(data as unknown as NumRow[]);
    setLoading(false);
  }, [ano]);

  useEffect(() => {
    fetchNumeros();
  }, [fetchNumeros]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("numeracao-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "oficio_numeracao" },
        (payload) => {
          const updated = payload.new as unknown as NumRow;
          setNumeros(prev => prev.map(n => n.id === updated.id ? updated : n));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Release expired reservations on mount
  useEffect(() => {
    supabase.rpc("liberar_reservas_expiradas" as any).then(() => {});
  }, []);

  const handleMarkUsed = async (num: NumRow) => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const userName = (profile as any)?.full_name || user.user_metadata?.full_name || user.email || "";
    const { data: result } = await supabase.rpc("usar_numero", {
      p_numero: num.numero,
      p_ano: ano,
      p_user_id: user.id,
      p_user_nome: userName,
      p_oficio_id: null as any,
    });
    if (result) {
      toast({ title: `Número ${num.numero} marcado como usado` });
      setNumeros(prev => prev.map(n => n.id === num.id ? { ...n, status: "usado", usado_por: user.id, usado_por_nome: userName, usado_em: new Date().toISOString() } : n));
    } else {
      toast({ title: "Erro", description: "Não foi possível marcar o número.", variant: "destructive" });
    }
    setSelected(null);
  };

  const handleCancelNumber = async (num: NumRow) => {
    if (!isAdmin) return;
    if (!confirm(`Deseja cancelar o número ${num.numero}?`)) return;
    const { error } = await supabase
      .from("oficio_numeracao" as any)
      .update({ status: "cancelado" } as any)
      .eq("id", num.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNumeros(prev => prev.map(n => n.id === num.id ? { ...n, status: "cancelado" } : n));
      toast({ title: `Número ${num.numero} cancelado` });
      setSelected(null);
    }
  };

  const handleReleaseNumber = async (num: NumRow) => {
    const canRelease = isAdmin || num.reservado_por === user?.id || num.usado_por === user?.id;
    if (!canRelease) return;
    const { error } = await supabase
      .from("oficio_numeracao" as any)
      .update({ status: "disponivel", reservado_por: null, reservado_por_nome: null, reservado_em: null, usado_por: null, usado_por_nome: null, usado_em: null, oficio_id: null } as any)
      .eq("id", num.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNumeros(prev => prev.map(n => n.id === num.id ? { ...n, status: "disponivel", reservado_por: null, reservado_por_nome: null, reservado_em: null, usado_por: null, usado_por_nome: null, usado_em: null } : n));
      toast({ title: `Número ${num.numero} liberado` });
      setSelected(null);
    }
  };

  const counts = {
    disponivel: numeros.filter(n => n.status === "disponivel").length,
    reservado: numeros.filter(n => n.status === "reservado").length,
    usado: numeros.filter(n => n.status === "usado").length,
    cancelado: numeros.filter(n => n.status === "cancelado").length,
  };

  // Find last used number for display
  const lastUsed = numeros.filter(n => n.status === "usado").sort((a, b) => b.numero - a.numero)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Hash size={24} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Painel de Numeração — {ano}</h1>
            <p className="text-sm text-muted-foreground">
              {lastUsed ? `Último usado: ${lastUsed.numero}` : "Nenhum usado"} · {counts.disponivel} disponíveis
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchNumeros} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin mr-1" : "mr-1"} /> Atualizar
        </Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(statusLabels).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-sm">
            <span>{statusEmojis[key]}</span>
            <span className="text-muted-foreground">{label} ({counts[key as keyof typeof counts]})</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))" }}>
            {numeros.map(n => (
              <Tooltip key={n.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSelected(n)}
                    className={`
                      text-xs font-mono font-medium rounded py-1.5 px-1 text-center transition-all
                      ${statusColors[n.status] || "bg-muted text-muted-foreground"}
                    `}
                  >
                    {String(n.numero).padStart(3, "0")}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs max-w-[200px]">
                  <p className="font-medium">{n.numero}/{ano}</p>
                  <p>{statusLabels[n.status] || n.status}</p>
                  {n.status === "reservado" && n.reservado_por_nome && (
                    <p>Reservado por: {n.reservado_por_nome}</p>
                  )}
                  {n.status === "usado" && n.usado_por_nome && (
                    <p>Usado por: {n.usado_por_nome}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Número {selected?.numero}/{ano}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span>Status:</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[selected.status]}`}>
                  {statusEmojis[selected.status]} {statusLabels[selected.status]}
                </span>
              </div>
              {selected.reservado_por_nome && (
                <div>
                  <p className="text-muted-foreground">Reservado por: <span className="text-foreground">{selected.reservado_por_nome}</span></p>
                  {selected.reservado_em && (
                    <p className="text-muted-foreground text-xs">{new Date(selected.reservado_em).toLocaleString("pt-BR")}</p>
                  )}
                </div>
              )}
              {selected.usado_por_nome && (
                <div>
                  <p className="text-muted-foreground">Usado por: <span className="text-foreground">{selected.usado_por_nome}</span></p>
                  {selected.usado_em && (
                    <p className="text-muted-foreground text-xs">{new Date(selected.usado_em).toLocaleString("pt-BR")}</p>
                  )}
                </div>
              )}
              {/* Any user can mark available numbers as used */}
              {selected.status === "disponivel" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="default" size="sm" onClick={() => handleMarkUsed(selected)}>
                    ✅ Marcar como usado
                  </Button>
                </div>
              )}
              {/* User can release own numbers, admin can release any */}
              {(selected.status === "reservado" || selected.status === "usado") && (
                isAdmin || selected.reservado_por === user?.id || selected.usado_por === user?.id
              ) && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => handleReleaseNumber(selected)}>
                    🔓 Liberar número
                  </Button>
                  {isAdmin && (
                    <Button variant="destructive" size="sm" onClick={() => handleCancelNumber(selected)}>
                      Cancelar
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
