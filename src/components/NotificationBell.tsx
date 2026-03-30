import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  criada_em: string;
  oficio_id: string | null;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifs = async () => {
    if (!user) return;
    const { data } = await (supabase.from("notificacoes" as any) as any)
      .select("*")
      .eq("user_id", user.id)
      .order("criada_em", { ascending: false })
      .limit(20);
    if (data) setNotifs(data);
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  // Realtime listener
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notificacoes",
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        const n = payload.new;
        toast(`🔔 ${n.titulo}`, { duration: 6000 });
        setNotifs((prev) => [n, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const unread = notifs.filter((n) => !n.lida).length;

  const markAllRead = async () => {
    if (!user) return;
    await (supabase.from("notificacoes" as any) as any)
      .update({ lida: true })
      .eq("user_id", user.id)
      .eq("lida", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Bell size={18} strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium text-foreground">Notificações</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Marcar como lidas
            </button>
          )}
        </div>
        <div className="max-h-72 overflow-y-auto">
          {notifs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma notificação</p>
          ) : (
            notifs.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b border-border last:border-0 ${!n.lida ? "bg-primary/5" : ""}`}
              >
                <p className="text-sm font-medium text-foreground">{n.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.criada_em).toLocaleString("pt-BR")}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
