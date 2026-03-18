import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const RESPOSTAS_RAPIDAS: Record<string, string> = {
  "criar oficio": "Para criar um ofício, clique em **\"Novo Ofício\"** no menu lateral. Preencha os campos obrigatórios (destinatário, assunto e conteúdo) e clique em **\"Salvar\"**. Você pode gerar o conteúdo automaticamente com IA clicando no botão **\"Gerar com IA\"**.",
  "exportar pdf": "No editor do ofício, clique no botão **\"PDF\"** na barra de ações superior. O sistema irá gerar o PDF com o cabeçalho oficial, conteúdo e assinatura. Se houver anexos, eles serão incluídos automaticamente no final do PDF.",
  "exportar word": "No editor do ofício, clique no botão **\"Word\"** na barra de ações. O documento será gerado no formato .docx com toda a formatação oficial.",
  "anexar": "Para anexar arquivos ao ofício, use a seção **\"Anexos\"** no editor. Clique em **\"Adicionar Anexo\"** ou arraste os arquivos. PDFs e imagens são suportados e serão incluídos automaticamente na exportação.",
  "salvar drive": "Para salvar no Google Drive, primeiro conecte sua conta Google em **Configurações**. Depois, no editor do ofício, clique no botão **\"Drive\"**. O PDF completo (com anexos) será enviado para sua pasta no Drive.",
  "rascunho": "Os ofícios são salvos automaticamente como rascunho. Você pode encontrar todos os seus rascunhos em **\"Todos os Ofícios\"** no menu lateral, filtrando por status **\"Rascunho\"**.",
  "numerar": "Para numerar um ofício, abra-o no editor e clique em **\"Numerar\"**. O sistema atribuirá automaticamente o próximo número disponível na sequência do ano atual.",
};

const SUGESTOES = [
  "Como criar um ofício?",
  "Como exportar para PDF?",
  "Como anexar arquivos?",
  "Como salvar no Drive?",
];

export default function AiSupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkQuickAnswer = (pergunta: string): string | null => {
    const lower = pergunta.toLowerCase();
    for (const [key, value] of Object.entries(RESPOSTAS_RAPIDAS)) {
      if (lower.includes(key)) return value;
    }
    return null;
  };

  const handleSend = async (text?: string) => {
    const pergunta = (text || input).trim();
    if (!pergunta || loading) return;

    const userMsg: Message = { role: "user", content: pergunta };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Check quick answers first
    const quick = checkQuickAnswer(pergunta);
    if (quick) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", content: quick }]);
        setLoading(false);
      }, 300);
      return;
    }

    // Call AI edge function
    try {
      const { data, error } = await supabase.functions.invoke("suporte-ia", {
        body: {
          pergunta,
          historico: messages.slice(-10), // last 10 messages for context
        },
      });

      if (error) throw error;

      setMessages(prev => [
        ...prev,
        { role: "assistant", content: data?.resposta || "Desculpe, não consegui processar sua pergunta. Tente novamente." },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "Erro ao processar. Tente novamente ou entre em contato com o administrador." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
            title="Assistente Solar"
          >
            <Bot size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-5 right-5 z-50 w-[380px] h-[520px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="h-12 px-4 border-b border-border flex items-center justify-between bg-primary/5">
              <div className="flex items-center gap-2">
                <Bot size={18} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Assistente Solar</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles size={24} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Olá! Como posso ajudar?</p>
                    <p className="text-xs text-muted-foreground mt-1">Pergunte sobre qualquer funcionalidade do sistema.</p>
                  </div>
                  <div className="space-y-1.5">
                    {SUGESTOES.map(s => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-accent text-foreground transition-colors"
                      >
                        💡 {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Pensando...
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Digite sua dúvida..."
                  className="flex-1 bg-secondary border-border text-sm"
                  disabled={loading}
                />
                <Button type="submit" size="icon" disabled={loading || !input.trim()} className="bg-primary text-primary-foreground h-9 w-9">
                  <Send size={14} />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
