import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, Send, MessageSquare, Bot, User, Copy, Check, Phone,
  ArrowRight, Sparkles, Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  last_message_at: string | null;
  unread_count: number;
  status: string;
  remote_jid: string;
}

interface Message {
  id: string;
  direction: string;
  content: string | null;
  sender_name: string | null;
  ai_suggested_response: string | null;
  ai_analysis: any;
  created_at: string;
  status: string;
}

export default function WhatsAppMensagens() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copiedAi, setCopiedAi] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();

    // Realtime for conversations
    const convChannel = supabase
      .channel("whatsapp_conversations_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations" }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(convChannel); };
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);

      // Realtime for messages
      const msgChannel = supabase
        .channel(`whatsapp_messages_${selectedConv.id}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${selectedConv.id}`,
        }, (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          scrollToBottom();
        })
        .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "whatsapp_messages",
          filter: `conversation_id=eq.${selectedConv.id}`,
        }, (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m))
          );
        })
        .subscribe();

      return () => { supabase.removeChannel(msgChannel); };
    }
  }, [selectedConv?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const fetchConversations = async () => {
    const { data, error } = await supabase
      .from("whatsapp_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    if (!error && data) setConversations(data);
    setLoading(false);
  };

  const fetchMessages = async (convId: string) => {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });

    if (!error && data) setMessages(data);

    // Mark as read
    await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", convId);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return;
    setSending(true);

    try {
      const { error } = await supabase.functions.invoke("send-whatsapp", {
        body: { conversation_id: selectedConv.id, message: newMessage },
      });

      if (error) throw error;
      setNewMessage("");
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleUseAiResponse = (response: string) => {
    setNewMessage(response);
  };

  const handleCopyAi = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAi(id);
    setTimeout(() => setCopiedAi(null), 2000);
  };

  const handleCreateDemanda = async (msg: Message) => {
    if (!msg.ai_analysis) {
      toast({ title: "Análise de IA não disponível para esta mensagem" });
      return;
    }

    const a = msg.ai_analysis;
    toast({
      title: "Demanda identificada",
      description: `${a.problema || "Sem descrição"} → ${a.secretaria || "Secretaria não identificada"}`,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={24} />
          Mensagens WhatsApp
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie conversas e atendimentos do WhatsApp com suporte de IA.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100%-80px)]">
        {/* Conversations List */}
        <Card className="md:col-span-1 overflow-hidden">
          <div className="p-3 border-b border-border">
            <h2 className="text-sm font-medium text-foreground">Conversas</h2>
          </div>
          <ScrollArea className="h-[calc(100%-48px)]">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Nenhuma conversa ainda. Conecte o WhatsApp para começar.
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className={`w-full text-left p-3 border-b border-border/50 hover:bg-accent/50 transition-colors ${
                    selectedConv?.id === conv.id ? "bg-accent" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {conv.contact_name || conv.contact_phone || "Desconhecido"}
                        </p>
                        {conv.contact_phone && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <Phone size={10} />
                            {conv.contact_phone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(conv.last_message_at), "HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      {conv.unread_count > 0 && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </ScrollArea>
        </Card>

        {/* Chat Area */}
        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          {selectedConv ? (
            <>
              {/* Header */}
              <div className="p-3 border-b border-border flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selectedConv.contact_name || selectedConv.contact_phone || "Desconhecido"}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedConv.contact_phone}</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      <div
                        className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                            msg.direction === "outgoing"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
                          <p
                            className={`text-[10px] mt-1 ${
                              msg.direction === "outgoing" ? "text-primary-foreground/60" : "text-muted-foreground"
                            }`}
                          >
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>

                      {/* AI Suggestion */}
                      {msg.direction === "incoming" && msg.ai_suggested_response && (
                        <div className="ml-4 mt-2 bg-accent/30 border border-accent rounded-lg p-3 max-w-[75%]">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                            <Sparkles size={12} className="text-primary" />
                            Sugestão da IA
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {msg.ai_suggested_response}
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleUseAiResponse(msg.ai_suggested_response!)}
                            >
                              <ArrowRight size={12} className="mr-1" />
                              Usar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => handleCopyAi(msg.id, msg.ai_suggested_response!)}
                            >
                              {copiedAi === msg.id ? <Check size={12} /> : <Copy size={12} />}
                            </Button>
                            {msg.ai_analysis && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => handleCreateDemanda(msg)}
                              >
                                <Bot size={12} className="mr-1" />
                                Registrar demanda
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t border-border flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={sending}
                />
                <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Selecione uma conversa para visualizar</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
