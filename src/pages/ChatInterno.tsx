import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageSquare, Users as UsersIcon, Hash, User } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import EmojiPicker from "@/components/chat/EmojiPicker";
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
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [tab, setTab] = useState<"geral" | "privado">("geral");
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("profiles").select("id, full_name, avatar_url, email").eq("status", "aprovado").then(({ data }) => {
      if (data) setProfiles(data as Profile[]);
    });
  }, []);

  // When switching tabs, reset selection
  useEffect(() => {
    if (tab === "geral") {
      setSelectedChat(null);
    } else {
      // Select first other user if none selected
      const others = profiles.filter(p => p.id !== user?.id);
      if (others.length > 0 && selectedChat === null) {
        setSelectedChat(others[0].id);
      }
    }
  }, [tab, profiles, user?.id]);

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
      query = query.is("para_user_id", null);
    } else {
      query = query.or(
        `and(de_user_id.eq.${user.id},para_user_id.eq.${selectedChat}),and(de_user_id.eq.${selectedChat},para_user_id.eq.${user.id})`
      );
    }

    const { data } = await query;
    if (data) {
      setMensagens(data as Mensagem[]);
      const unread = (data as Mensagem[]).filter(m => !m.lida && m.de_user_id !== user.id);
      if (unread.length > 0) {
        await supabase.from("mensagens").update({ lida: true }).in("id", unread.map(m => m.id));
      }
    }
    setTimeout(() => scrollToBottom(), 100);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, (payload) => {
        const msg = payload.new as Mensagem;
        const isGeral = selectedChat === null && msg.para_user_id === null;
        const isDM = selectedChat !== null && (
          (msg.de_user_id === user.id && msg.para_user_id === selectedChat) ||
          (msg.de_user_id === selectedChat && msg.para_user_id === user.id)
        );
        if (isGeral || isDM) {
          setMensagens(prev => [...prev, msg]);
          setTimeout(() => scrollToBottom(), 50);
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
    inputRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    setTexto(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const getProfile = (id: string) => profiles.find(p => p.id === id);
  const getProfileName = (id: string) => {
    const p = getProfile(id);
    return p?.full_name || p?.email?.split("@")[0] || "Usuário";
  };

  const otherProfiles = profiles.filter(p => p.id !== user?.id);

  return (
    <div className="h-[calc(100vh-140px)] flex rounded-xl border border-border bg-card overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 border-r border-border flex flex-col">
        <div className="p-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
            <MessageSquare size={16} /> Chat
          </h2>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "geral" | "privado")}>
            <TabsList className="w-full grid grid-cols-2 h-8">
              <TabsTrigger value="geral" className="text-xs gap-1">
                <Hash size={12} /> Geral
              </TabsTrigger>
              <TabsTrigger value="privado" className="text-xs gap-1">
                <User size={12} /> Privado
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {tab === "geral" ? (
            <div className="px-2.5 py-3 text-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                <UsersIcon size={18} className="text-primary" />
              </div>
              <p className="text-xs font-medium text-foreground">Canal Geral</p>
              <p className="text-2xs text-muted-foreground mt-0.5">Todos os operadores</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 border-b border-border flex items-center gap-2">
          {tab === "geral" || selectedChat === null ? (
            <>
              <UsersIcon size={16} className="text-primary" />
              <span className="text-sm font-medium text-foreground">Canal Geral</span>
              <Badge variant="secondary" className="text-2xs ml-1">{profiles.length} membros</Badge>
            </>
          ) : (
            <>
              <UserAvatar
                userId={selectedChat}
                fullName={getProfile(selectedChat)?.full_name}
                avatarUrl={getProfile(selectedChat)?.avatar_url}
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
          {mensagens.map((msg, i) => {
            const isMe = msg.de_user_id === user?.id;
            const senderProfile = getProfile(msg.de_user_id);
            const showAvatar = !isMe;
            // Show name if general channel or if it's not me
            const showName = !isMe && (selectedChat === null || tab === "geral");

            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} gap-2`}>
                {showAvatar && (
                  <div className="flex-shrink-0 mt-1">
                    <UserAvatar
                      userId={msg.de_user_id}
                      fullName={senderProfile?.full_name}
                      avatarUrl={senderProfile?.avatar_url}
                      size="sm"
                    />
                  </div>
                )}
                <div className={`max-w-[70%] rounded-xl px-3 py-2 ${
                  isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  {showName && (
                    <p className="text-2xs font-semibold mb-0.5 opacity-80">{getProfileName(msg.de_user_id)}</p>
                  )}
                  {!isMe && !showName && (
                    <p className="text-2xs font-semibold mb-0.5 opacity-80">{getProfileName(msg.de_user_id)}</p>
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
          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-center">
            <EmojiPicker onSelect={handleEmojiSelect} />
            <Input
              ref={inputRef}
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
