import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Lembrete {
  id: string;
  titulo: string;
  descricao: string | null;
  data_hora: string;
  tipo: string;
  lido_por: string[];
}

export default function LembreteBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);

  const fetchLembretes = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("lembretes")
      .select("id, titulo, descricao, data_hora, tipo, lido_por")
      .order("data_hora", { ascending: true })
      .limit(20);
    if (data) setLembretes(data as unknown as Lembrete[]);
  };

  useEffect(() => {
    fetchLembretes();
    const ch = supabase
      .channel("lembrete-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lembretes" }, () => fetchLembretes())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lembretes" }, () => fetchLembretes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unread = lembretes.filter(l => !l.lido_por?.includes(user?.id || ""));
  const count = unread.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell size={17} strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Lembretes</span>
          {count > 0 && <Badge variant="secondary" className="text-2xs">{count} pendente(s)</Badge>}
        </div>
        <div className="max-h-64 overflow-y-auto">
          {lembretes.slice(0, 8).map(l => {
            const isRead = l.lido_por?.includes(user?.id || "");
            return (
              <div
                key={l.id}
                className={`px-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-accent/50 transition-colors ${!isRead ? "bg-primary/5" : ""}`}
                onClick={() => navigate("/lembretes")}
              >
                <p className={`text-sm ${!isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{l.titulo}</p>
                <p className="text-2xs text-muted-foreground mt-0.5">
                  {format(new Date(l.data_hora), "dd/MM HH:mm", { locale: ptBR })}
                  {l.tipo === "admin" && " · Equipe"}
                </p>
              </div>
            );
          })}
          {lembretes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lembrete</p>
          )}
        </div>
        <div className="p-2 border-t border-border">
          <button
            onClick={() => navigate("/lembretes")}
            className="w-full text-xs text-primary hover:underline text-center"
          >
            Ver todos os lembretes
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
