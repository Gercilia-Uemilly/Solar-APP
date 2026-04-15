import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Hash, Loader2, RefreshCw, Grid3X3, List, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  origem_numero?: string;
}

const statusColors: Record<string, string> = {
  disponivel: "bg-muted/60 text-muted-foreground hover:bg-muted",
  reservado: "bg-yellow-500/30 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-500/50",
  usado: "bg-primary/20 text-primary hover:bg-primary/30",
  cancelado: "bg-destructive/20 text-destructive hover:bg-destructive/30",
};

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Rascunho",
  usado: "Salvo",
  cancelado: "Cancelado",
};

const statusEmojis: Record<string, string> = {
  disponivel: "⬜",
  reservado: "🟨",
  usado: "🟩",
  cancelado: "🟥",
};

const origemLabels: Record<string, string> = {
  sistema: "Sistema",
  planilha: "Legado",
};

const origemColors: Record<string, string> = {
  sistema: "bg-muted text-muted-foreground border-border",
  planilha: "bg-muted/50 text-muted-foreground border-border",
};

export default function PainelNumeracao() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [numeros, setNumeros] = useState<NumRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NumRow | null>(null);
  const [ano] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [sortMode, setSortMode] = useState<"num_asc" | "num_desc" | "date_asc" | "date_desc">("num_asc");

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

  useEffect(() => { fetchNumeros(); }, [fetchNumeros]);

  useEffect(() => {
    const channel = supabase
      .channel("numeracao-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "oficio_numeracao" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const updated = payload.new as unknown as NumRow;
          setNumeros(prev => prev.map(n => n.id === updated.id ? updated : n));
        } else if (payload.eventType === "INSERT") {
          const inserted = payload.new as unknown as NumRow;
          setNumeros(prev => {
            if (prev.some(n => n.id === inserted.id)) return prev;
            return [...prev, inserted].sort((a, b) => a.numero - b.numero);
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    supabase.rpc("liberar_reservas_expiradas" as any).then(() => {});
  }, []);


  // Admin-only: manual corrections
  const handleMarkUsed = async (num: NumRow) => {
    if (!isAdmin || !user) return;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    const userName = (profile as any)?.full_name || user.user_metadata?.full_name || user.email || "";
    const { data: result } = await supabase.rpc("usar_numero", {
      p_numero: num.numero, p_ano: ano, p_user_id: user.id, p_user_nome: userName, p_oficio_id: null as any,
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
    if (!isAdmin) return;
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

  const lastUsedNum = numeros.filter(n => n.status !== "disponivel").sort((a, b) => b.numero - a.numero)[0]?.numero || 0;

  // Show all numbers from 1 to 1000 (or up to highest used if beyond 1000)
  const visibleNumbers = numeros.filter(n => n.numero <= 1000 || (n.numero > 1000 && n.status !== "disponivel"));

  const sortedNumbers = useMemo(() => {
    const arr = [...visibleNumbers];
    switch (sortMode) {
      case "num_desc":
        return arr.sort((a, b) => b.numero - a.numero);
      case "date_asc":
        return arr.sort((a, b) => {
          const da = a.usado_em || a.reservado_em || "";
          const db = b.usado_em || b.reservado_em || "";
          if (!da && !db) return a.numero - b.numero;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db) || a.numero - b.numero;
        });
      case "date_desc":
        return arr.sort((a, b) => {
          const da = a.usado_em || a.reservado_em || "";
          const db = b.usado_em || b.reservado_em || "";
          if (!da && !db) return b.numero - a.numero;
          if (!da) return 1;
          if (!db) return -1;
          return db.localeCompare(da) || b.numero - a.numero;
        });
      default:
        return arr.sort((a, b) => a.numero - b.numero);
    }
  }, [visibleNumbers, sortMode]);

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      reservado: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
      usado: "bg-primary/20 text-primary border-primary/30",
      cancelado: "bg-destructive/20 text-destructive border-destructive/30",
      disponivel: "bg-muted text-muted-foreground border-border",
    };
    return (
      <Badge variant="outline" className={`text-[10px] font-medium ${colorMap[status] || colorMap.disponivel}`}>
        {statusEmojis[status]} {statusLabels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Hash size={24} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Controle de Numeração — {ano}</h1>
            <p className="text-sm text-muted-foreground">
              Último número: <span className="font-mono font-bold text-foreground">{lastUsedNum || "—"}</span> · {counts.usado} salvos · {counts.reservado} rascunhos · {counts.cancelado} cancelados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortMode} onValueChange={(v) => setSortMode(v as any)}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="num_asc">Número ↑ crescente</SelectItem>
              <SelectItem value="num_desc">Número ↓ decrescente</SelectItem>
              <SelectItem value="date_asc">Data ↑ mais antiga</SelectItem>
              <SelectItem value="date_desc">Data ↓ mais recente</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-7 px-2">
              <List size={14} />
            </Button>
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-7 px-2">
              <Grid3X3 size={14} />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={fetchNumeros} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin mr-1" : "mr-1"} /> Atualizar
          </Button>
        </div>
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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : (
        <>
          {viewMode === "list" ? (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Número</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead>Operador(a)</TableHead>
                    <TableHead className="w-40">Data/Hora</TableHead>
                    <TableHead className="w-24">Origem</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedNumbers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum número reservado ou utilizado ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedNumbers.map(n => (
                      <TableRow key={n.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(n)}>
                        <TableCell className="font-mono font-bold text-foreground">{n.numero}/{n.ano}</TableCell>
                        <TableCell>{getStatusBadge(n.status)}</TableCell>
                        <TableCell className="text-sm text-foreground">
                          {n.usado_por_nome || n.reservado_por_nome || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {n.usado_em
                            ? new Date(n.usado_em).toLocaleString("pt-BR")
                            : n.reservado_em
                              ? new Date(n.reservado_em).toLocaleString("pt-BR")
                              : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${origemColors[n.origem_numero || "sistema"] || origemColors.sistema}`}>
                            {origemLabels[n.origem_numero || "sistema"] || n.origem_numero}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isAdmin && n.status === "disponivel" && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); handleMarkUsed(n); }}>
                              Usar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))" }}>
                {sortedNumbers.map(n => (
                  <Tooltip key={n.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelected(n)}
                        className={`text-xs font-mono font-medium rounded py-1.5 px-1 text-center transition-all ${statusColors[n.status] || "bg-muted text-muted-foreground"}`}
                      >
                        {String(n.numero).padStart(3, "0")}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[220px]">
                      <p className="font-medium">{n.numero}/{ano} — {statusLabels[n.status] || n.status}</p>
                      {(n.usado_por_nome || n.reservado_por_nome) && (
                        <p>👤 {n.usado_por_nome || n.reservado_por_nome}</p>
                      )}
                      {(n.usado_em || n.reservado_em) && (
                        <p>🕐 {new Date((n.usado_em || n.reservado_em)!).toLocaleString("pt-BR")}</p>
                      )}
                      {n.origem_numero && n.origem_numero !== "sistema" && <p>Origem: {origemLabels[n.origem_numero]}</p>}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </>
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
                {getStatusBadge(selected.status)}
              </div>
              {selected.origem_numero && (
                <div className="flex items-center gap-2">
                  <span>Origem:</span>
                  <Badge variant="outline" className="text-[10px]">{origemLabels[selected.origem_numero] || selected.origem_numero}</Badge>
                </div>
              )}
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
              {isAdmin && selected.status === "disponivel" && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="default" size="sm" onClick={() => handleMarkUsed(selected)}>✅ Marcar como usado</Button>
                </div>
              )}
              {isAdmin && (selected.status === "reservado" || selected.status === "usado" || selected.status === "cancelado") && (
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => handleReleaseNumber(selected)}>🔓 Liberar número</Button>
                  {selected.status !== "cancelado" && (
                    <Button variant="destructive" size="sm" onClick={() => handleCancelNumber(selected)}>Cancelar</Button>
                  )}
                </div>
              )}
              {!isAdmin && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                  ℹ️ A numeração é gerenciada automaticamente pelo sistema. Contate um administrador para correções.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
