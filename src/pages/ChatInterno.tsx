import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Users as UsersIcon, Hash } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Mensagem {
  id: string;
  de_user_id: string;
  para_user_id: string | null;
  conteudo: string;
  lida: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
}

export default function ChatInterno() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [selectedChat, setSelectedChat] = useState<string | null>(null); // null = geral
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch profiles
  useEffect(() => {
    supabase.from("profiles").select("id, full_name, avatar_url, email").eq("status", "aprovado").then(({ data }) => {
      if (data) setProfiles(data as Profile[]);
    });
  }, []);

  // Fetch messages for current chat
  useEffect(() => {
    if (!user) return;
    fetchMessages();
  }, [selectedChat, user]);

  const fetchMessages = async () => {
    if (!user) return;
    let query = supabase
      .from("mensagens")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200);

    if (selectedChat === null) {
      // Canal geral
      query = query.is("para_user_id", null);
    } else {
      // DM: messages between me and selected user
      query = query.or(
        `and(de_user_id.eq.${user.id},para_user_id.eq.${selectedChat}),and(de_user_id.eq.${selectedChat},para_user_id.eq.${user.id})`
      );
    }

    const { data } = await query;
    if (data) {
      setMensagens(data as Mensagem[]);
      // Mark as read
      const unread = (data as Mensagem[]).filter(m => !m.lida && m.de_user_id !== user.id);
      if (unread.length > 0) {
        await supabase
          .from("mensagens")
          .update({ lida: true })
          .in("id", unread.map(m => m.id));
      }
    }
    setTimeout(() => scrollToBottom(), 100);
  };

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const msg = payload.new as Mensagem;
        // Check if it belongs to current chat
        const isGeral = selectedChat === null && msg.para_user_id === null;
        const isDM = selectedChat !== null && (
          (msg.de_user_id === user.id && msg.para_user_id === selectedChat) ||
          (msg.de_user_id === selectedChat && msg.para_user_id === user.id)
        );
        if (isGeral || isDM) {
          setMensagens(prev => [...prev, msg]);
          setTimeout(() => scrollToBottom(), 50);
          // Auto-mark as read
          if (msg.de_user_id !== user.id) {
            supabase.from("mensagens").update({ lida: true }).eq("id", msg.id);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedChat]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async () => {
    if (!texto.trim() || !user || sending) return;
    setSending(true);
    const { error } = await supabase.from("mensagens").insert({
      de_user_id: user.id,
      para_user_id: selectedChat,
      conteudo: texto.trim(),
    });
    if (!error) setTexto("");
    setSending(false);
  };

  const getProfileName = (id: string) => {
    const p = profiles.find(p => p.id === id);
    return p?.full_name || p?.email?.split("@")[0] || "Usuário";
  };

  const otherProfiles = profiles.filter(p => p.id !== user?.id);

  return (
    <div className="h-[calc(100vh-140px)] flex rounded-xl border border-border bg-card overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare size={16} /> Chat Interno
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {/* Canal geral */}
          <button
            onClick={() => setSelectedChat(null)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-colors ${
              selectedChat === null ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            <Hash size={14} />
            <span>Geral</span>
          </button>

          {/* Users */}
          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-2xs text-muted-foreground px-2.5 mb-1 uppercase tracking-wider">Operadores</p>
            {otherProfiles.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedChat(p.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  selectedChat === p.id ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent/60"
                }`}
              >
                <UserAvatar userId={p.id} fullName={p.full_name} avatarUrl={p.avatar_url} size="sm" />
                <span className="truncate">{p.full_name || p.email?.split("@")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center gap-2">
          {selectedChat === null ? (
            <>
              <UsersIcon size={16} className="text-primary" />
              <span className="text-sm font-medium text-foreground">Canal Geral</span>
            </>
          ) : (
            <>
              <UserAvatar
                userId={selectedChat}
                fullName={profiles.find(p => p.id === selectedChat)?.full_name}
                avatarUrl={profiles.find(p => p.id === selectedChat)?.avatar_url}
                size="sm"
              />
              <span className="text-sm font-medium text-foreground">{getProfileName(selectedChat)}</span>
            </>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {mensagens.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda. Comece a conversa!</p>
          )}
          {mensagens.map(msg => {
            const isMe = msg.de_user_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-xl px-3 py-2 ${
                  isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  {!isMe && (
                    <p className="text-2xs font-medium mb-0.5 opacity-70">{getProfileName(msg.de_user_id)}</p>
                  )}
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.conteudo}</p>
                  <p className={`text-2xs mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border">
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
            <Input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-secondary border-border"
            />
            <Button type="submit" size="icon" disabled={sending || !texto.trim()} className="bg-primary text-primary-foreground">
              <Send size={16} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
