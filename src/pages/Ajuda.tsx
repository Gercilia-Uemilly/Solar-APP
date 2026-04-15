import { useEffect, useState, useRef } from "react";
import { 
  AlertTriangle, 
  RefreshCw, 
  FileDigit, 
  FileText, 
  Image, 
  HelpCircle,
  CheckCircle,
  MessageCircle,
  BookOpen,
  ChevronRight,
  Send,
  Upload,
  X,
  Loader2,
  TicketCheck,
  Bot,
  Clock,
  ImageIcon
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const sections = [
  {
    id: "drive",
    icon: RefreshCw,
    title: "Problema com Google Drive (Permissões)",
    errorMessage: "Desconecte e reconecte seu Google Drive em Configurações para atualizar as permissões.",
    steps: ["Configurações", "Google Drive", "Desconectar", "Conectar novamente"],
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200"
  },
  {
    id: "numero-duplicado",
    icon: FileDigit,
    title: "Número de Ofício duplicado",
    description: "Sempre conferir no Drive antes de exportar. Se já existir, usar o próximo número e avisar o administrador.",
    alert: "Vale sempre o primeiro que foi feito",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200"
  },
  {
    id: "incompleto",
    icon: FileText,
    title: "Ofício incompleto",
    description: "Ler até o final antes de exportar. Se faltar algo, corrigir antes.",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200"
  },
  {
    id: "imagens",
    icon: Image,
    title: "Imagens diferentes no preview e no Drive",
    description: "Pode acontecer do preview estar certo e no Drive sair diferente. Isso é normal em alguns casos, varia de imagem pra imagem.",
    action: "Se estiver aceitável → pode seguir. Se estiver ruim → avisar o administrador.",
    note: "Estamos ajustando para padronizar automaticamente",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200"
  },
  {
    id: "numero-sumiu",
    icon: HelpCircle,
    title: "Número mudou ou sumiu",
    description: "Usar o próximo número disponível e seguir normalmente.",
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200"
  },
  {
    id: "sistema-drive",
    icon: AlertTriangle,
    title: "Sistema diferente do Drive",
    description: "Sempre vale o que já está no Drive.",
    action: "Ajustar para o próximo número",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  }
];

const checkList = [
  "Conferir número",
  "Conferir Drive",
  "Ler o ofício até o final"
];

const quandoAvisar = [
  "Número duplicando",
  "Imagem muito errada",
  "Sistema travando",
  "Qualquer coisa fora do padrão"
];

const categoryOptions = [
  { value: "google-drive", label: "Google Drive / Permissões" },
  { value: "numero-oficio", label: "Numeração de Ofício" },
  { value: "exportacao", label: "Exportação (PDF/Word)" },
  { value: "imagens", label: "Imagens / Formatação" },
  { value: "sistema-travando", label: "Sistema travando / Lento" },
  { value: "login-acesso", label: "Login / Acesso" },
  { value: "outro", label: "Outro problema" },
];

interface Ticket {
  id: string;
  category: string;
  description: string;
  status: string;
  ai_response: string | null;
  created_at: string;
  screenshot_url: string | null;
}

function TicketForm({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [category, setCategory] = useState("outro");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ resolvido: boolean; resposta: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Imagem muito grande. Máximo 5MB.");
        return;
      }
      setScreenshot(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setScreenshot(file);
          setPreviewUrl(URL.createObjectURL(file));
          toast.success("Print colado!");
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Descreva o problema.");
      return;
    }
    if (!user) return;

    setSending(true);
    try {
      // Upload screenshot if any
      let screenshotUrl: string | null = null;
      if (screenshot) {
        const ext = screenshot.name.split(".").pop() || "png";
        const path = `tickets/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("midias")
          .upload(path, screenshot, { contentType: screenshot.type });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("midias").getPublicUrl(path);
          screenshotUrl = urlData?.publicUrl || null;
        }
      }

      // Fetch profile for name/email
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();

      const { data, error } = await supabase.functions.invoke("handle-support-ticket", {
        body: {
          description,
          category,
          screenshot_url: screenshotUrl,
          user_name: profile?.full_name || "",
          user_email: profile?.email || user.email || "",
          user_id: user.id,
        },
      });

      if (error) throw error;

      setResult({
        resolvido: data.resolvido,
        resposta: data.resposta,
      });

      if (data.resolvido) {
        toast.success("O Solar conseguiu resolver seu problema!");
      } else {
        toast.info("Chamado enviado ao administrador via WhatsApp e email.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao enviar chamado. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          {result.resolvido ? (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100">
              <Send className="w-5 h-5 text-amber-600" />
            </div>
          )}
          <span className={`font-bold text-base ${result.resolvido ? "text-emerald-700" : "text-amber-700"}`}>
            {result.resolvido ? "Resolvido pelo Solar" : "Encaminhado ao administrador"}
          </span>
        </div>

        <div className="p-4 rounded-lg border bg-card">
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{result.resposta}</p>
        </div>

        {!result.resolvido && (
          <p className="text-xs text-muted-foreground italic">
            O administrador receberá uma notificação via WhatsApp e email com os detalhes do seu chamado.
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => { setResult(null); setDescription(""); setScreenshot(null); setPreviewUrl(null); }}>
            Novo chamado
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      <div className="space-y-2">
        <label className="text-sm font-medium">Categoria do problema</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Descreva o problema</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explique o que aconteceu, o que você tentou fazer e o erro que apareceu..."
          rows={4}
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground">{description.length}/2000 • Dica: Cole um print com Ctrl+V</p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Print / Captura de tela (opcional)</label>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Anexar imagem
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {screenshot && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              {screenshot.name.slice(0, 30)}
              <button onClick={() => { setScreenshot(null); setPreviewUrl(null); }} className="ml-1">
                <X className="w-3 h-3 text-destructive" />
              </button>
            </span>
          )}
        </div>
        {previewUrl && (
          <div className="relative mt-2 rounded-lg overflow-hidden border max-h-48">
            <img src={previewUrl} alt="Print" className="w-full h-auto max-h-48 object-contain bg-muted" />
          </div>
        )}
      </div>

      <div className="p-3 rounded-lg bg-muted/50 border text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground text-sm">☀️ Como funciona:</p>
        <p>1. O Solar tentará resolver seu problema automaticamente</p>
        <p>2. Se não conseguir, o chamado será enviado ao administrador via <strong>WhatsApp</strong> e <strong>email</strong></p>
        <p>3. Você receberá uma notificação quando for respondido</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} disabled={sending || !description.trim()} className="gap-2">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Analisando..." : "Enviar chamado"}
        </Button>
      </div>
    </div>
  );
}

function MeusChamados() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("support_tickets")
      .select("id, category, description, status, ai_response, created_at, screenshot_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setTickets((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, [user]);

  const handleDelete = async (ticketId: string) => {
    const confirmed = window.confirm("Tem certeza que deseja apagar este chamado?");
    if (!confirmed) return;
    const { error } = await supabase.from("support_tickets").delete().eq("id", ticketId);
    if (error) {
      toast.error("Erro ao apagar chamado.");
      return;
    }
    setTickets(prev => prev.filter(t => t.id !== ticketId));
    toast.success("Chamado apagado.");
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!tickets.length) return <p className="text-sm text-muted-foreground text-center py-4">Nenhum chamado aberto ainda.</p>;

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {tickets.map(t => (
        <div key={t.id} className="p-3 rounded-lg border bg-card space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={t.status === "resolvido" ? "default" : t.status === "escalado" ? "destructive" : "secondary"} className="text-xs">
                {t.status === "resolvido" ? "✅ Resolvido" : t.status === "escalado" ? "📨 Escalado" : "🕐 Aberto"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {categoryOptions.find(c => c.value === t.category)?.label || t.category}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(t.created_at).toLocaleDateString("pt-BR")}
              </span>
              <button
                onClick={() => handleDelete(t.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                title="Apagar chamado"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-foreground line-clamp-2">{t.description}</p>
          {t.ai_response && (
            <div className="p-2 rounded bg-muted/50 border text-xs text-muted-foreground">
              <span className="font-medium text-foreground">☀️ Solar:</span> {t.ai_response.slice(0, 200)}{t.ai_response.length > 200 ? "..." : ""}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Ajuda() {
  const [ticketOpen, setTicketOpen] = useState(false);

  useEffect(() => {
    document.title = "Ajuda — Manual Rápido";
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Manual Rápido</h1>
            <p className="text-sm text-muted-foreground">Problemas e Soluções do Sistema</p>
          </div>
        </div>

        <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" variant="default">
              <TicketCheck className="w-4 h-4" />
              Abrir chamado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TicketCheck className="w-5 h-5 text-primary" />
                Abrir chamado de suporte
              </DialogTitle>
            </DialogHeader>
            <TicketForm onClose={() => setTicketOpen(false)} />
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Alerta inicial */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 shrink-0">
                💡 Antes de tudo
              </Badge>
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  O sistema ajuda muito, mas ainda pode ter falhas.
                </p>
                <p className="text-sm font-medium text-foreground">
                  Sempre conferir antes de finalizar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Seções de problemas */}
      <div className="space-y-4">
        {sections.map((section, index) => (
          <motion.div
            key={section.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className={`overflow-hidden border ${section.borderColor}`}>
              <CardHeader className={`${section.bgColor} py-4`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white/80 ${section.color}`}>
                    <section.icon className="w-5 h-5" />
                  </div>
                  <CardTitle className={`text-base font-semibold ${section.color}`}>
                    {index + 1}. {section.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4 pb-4 space-y-3">
                {section.errorMessage && (
                  <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <strong>Mensagem:</strong> "{section.errorMessage}"
                  </div>
                )}
                
                {section.description && (
                  <p className="text-sm text-foreground leading-relaxed">
                    {section.description}
                  </p>
                )}

                {section.steps && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Como resolver:</span>
                    {section.steps.map((step, i) => (
                      <span key={i} className="flex items-center text-sm">
                        <span className="px-2 py-1 rounded bg-secondary text-secondary-foreground font-medium">
                          {step}
                        </span>
                        {i < section.steps!.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {section.alert && (
                  <div className="flex items-center gap-2 p-2 rounded bg-red-100 border border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span className="text-sm font-medium text-red-700">{section.alert}</span>
                  </div>
                )}

                {section.action && (
                  <div className="p-3 rounded-md bg-muted/50 border border-border">
                    <p className="text-sm text-foreground">{section.action}</p>
                  </div>
                )}

                {section.note && (
                  <p className="text-xs text-muted-foreground italic">
                    💡 {section.note}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Separator />

      {/* Regra de ouro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="bg-emerald-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base font-semibold text-emerald-700">
                🧠 Regra de ouro — Antes de exportar:
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {checkList.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200"
                >
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold">
                    ✔
                  </span>
                  <span className="text-sm font-medium text-emerald-800">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quando avisar administrador */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        <Card>
          <CardHeader className="bg-amber-50/50">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-600" />
              <CardTitle className="text-base font-semibold text-amber-700">
                📞 Quando avisar o administrador:
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quandoAvisar.map((item, i) => (
                <div 
                  key={i}
                  className="flex items-center gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-sm text-amber-800">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-center">
              <Button variant="outline" className="gap-2" onClick={() => setTicketOpen(true)}>
                <TicketCheck className="w-4 h-4" />
                Ou abra um chamado direto aqui
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Meus chamados */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TicketCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-base font-semibold">Meus chamados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <MeusChamados />
          </CardContent>
        </Card>
      </motion.div>

      {/* Recado final */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 }}
      >
        <Card className="border-primary/30 overflow-hidden">
          <div className="flex items-center gap-4 px-6 py-5">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 shrink-0">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                Erros podem acontecer — e tudo bem 😊
              </p>
              <p className="text-sm text-muted-foreground">
                O importante é <strong className="text-foreground">conferir antes de finalizar</strong>. O Solar está em melhoria contínua.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
