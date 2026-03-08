import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Mail, Send, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const WHATSAPP_NUMBER = "5534999999999"; // número do suporte
const SUPPORT_EMAIL = "c.sarling1994@gmail.com";

const categories = [
  { value: "duvida", label: "Dúvida" },
  { value: "problema", label: "Reportar problema" },
  { value: "sugestao", label: "Sugestão" },
  { value: "outro", label: "Outro" },
];

interface SupportDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SupportDrawer({ open, onClose }: SupportDrawerProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<"options" | "form" | "sent">("options");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("sugestao");
  const [sending, setSending] = useState(false);

  const resetForm = () => {
    setSubject("");
    setMessage("");
    setCategory("sugestao");
    setTab("options");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent("Olá! Preciso de ajuda com o sistema Solar.");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, "_blank");
  };

  const handleSendEmail = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Preencha o assunto e a mensagem.");
      return;
    }

    setSending(true);
    try {
      // Save to database
      const { error } = await supabase.from("support_messages").insert({
        user_id: user?.id,
        user_email: user?.email,
        user_name: user?.user_metadata?.full_name || user?.email?.split("@")[0],
        subject: subject.trim().slice(0, 200),
        message: message.trim().slice(0, 5000),
        type: category,
      });

      if (error) throw error;

      // Also send via mailto as fallback
      const mailtoBody = encodeURIComponent(
        `Categoria: ${categories.find(c => c.value === category)?.label || category}\n\nDe: ${user?.user_metadata?.full_name || "Usuário"} (${user?.email})\n\n${message.trim()}`
      );
      const mailtoSubject = encodeURIComponent(`[Solar] ${subject.trim()}`);

      // Open mailto link in background
      const mailLink = document.createElement("a");
      mailLink.href = `mailto:${SUPPORT_EMAIL}?subject=${mailtoSubject}&body=${mailtoBody}`;
      mailLink.click();

      setTab("sent");
      toast.success("Mensagem enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar: " + (err.message || "Tente novamente."));
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-lg">Suporte & Ajuda</SheetTitle>
          <SheetDescription>
            Entre em contato conosco para dúvidas, problemas ou sugestões.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 mt-4 overflow-y-auto">
          <AnimatePresence mode="wait">
            {tab === "options" && (
              <motion.div
                key="options"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                {/* WhatsApp option */}
                <button
                  onClick={handleWhatsApp}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle size={24} className="text-green-500" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Chat via WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Resposta rápida em horário comercial</p>
                  </div>
                </button>

                {/* Email form option */}
                <button
                  onClick={() => setTab("form")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail size={24} className="text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">Enviar e-mail</p>
                    <p className="text-xs text-muted-foreground">Descreva seu problema ou sugestão</p>
                  </div>
                </button>

                {/* Direct email info */}
                <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground mb-1">Ou envie diretamente para:</p>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-sm text-primary hover:underline font-medium"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </div>
              </motion.div>
            )}

            {tab === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <button
                  onClick={() => setTab("options")}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  ← Voltar
                </button>

                <div className="space-y-2">
                  <Label htmlFor="support-category">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-subject">Assunto</Label>
                  <Input
                    id="support-subject"
                    placeholder="Resumo da sua mensagem"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="support-message">Mensagem</Label>
                  <Textarea
                    id="support-message"
                    placeholder="Descreva detalhadamente sua dúvida, problema ou sugestão..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    maxLength={5000}
                    className="resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {message.length}/5000
                  </p>
                </div>

                <Button
                  onClick={handleSendEmail}
                  disabled={sending || !subject.trim() || !message.trim()}
                  className="w-full gap-2"
                >
                  {sending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Enviar mensagem
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {tab === "sent" && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Mensagem enviada!</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                  Sua mensagem foi registrada. Responderemos o mais breve possível pelo e-mail cadastrado.
                </p>
                <Button variant="outline" onClick={handleClose}>
                  Fechar
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  );
}
