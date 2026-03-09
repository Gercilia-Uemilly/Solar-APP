import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import {
  Newspaper, TrendingUp, TrendingDown, Minus, Plus, ExternalLink, Pencil, Star, CheckCircle2,
  Filter, Instagram, Facebook, Globe, Tv, BookOpen, Search, BarChart3, X, Trash2, Video, MessageCircle, Upload, FileSpreadsheet
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";

type Clipping = {
  id: string;
  data_publicacao: string;
  fonte: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  tema: string | null;
  sentimento: string;
  respondido: boolean;
  estrategico: boolean;
  observacoes: string | null;
  author_id: string;
  author_nome: string | null;
  created_at: string;
  updated_at: string;
};

const FONTES = ["Instagram", "Facebook", "Site", "Jornal", "TV"];
const TIPOS = ["Post", "Reel", "Matéria", "Comentário", "Vídeo", "Story"];
const SENTIMENTOS = ["positivo", "neutro", "negativo"];
const TEMAS = ["Saúde", "Educação", "Segurança", "Obras", "Mobilidade", "Meio Ambiente", "Habitação", "Esporte", "Cultura", "Assistência Social", "Economia", "Política", "Outro"];

const fonteIcon = (fonte: string) => {
  switch (fonte) {
    case "Instagram": return <Instagram size={16} />;
    case "Facebook": return <Facebook size={16} />;
    case "Site": return <Globe size={16} />;
    case "TV": return <Tv size={16} />;
    case "Jornal": return <BookOpen size={16} />;
    default: return <Newspaper size={16} />;
  }
};

const sentimentoColor = (s: string) => {
  switch (s) {
    case "positivo": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "negativo": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const sentimentoIcon = (s: string) => {
  switch (s) {
    case "positivo": return <TrendingUp size={14} />;
    case "negativo": return <TrendingDown size={14} />;
    default: return <Minus size={14} />;
  }
};

const tipoIcon = (tipo: string) => {
  switch (tipo) {
    case "Reel": case "Vídeo": return <Video size={14} />;
    case "Comentário": return <MessageCircle size={14} />;
    case "Story": return <Instagram size={14} />;
    default: return <Newspaper size={14} />;
  }
};

const emptyForm = {
  link: "",
  fonte: "Instagram",
  tipo: "Post",
  titulo: "",
  descricao: "",
  tema: "",
  sentimento: "neutro",
  observacoes: "",
};

export default function Clipping() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clippings, setClippings] = useState<Clipping[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterFonte, setFilterFonte] = useState("all");
  const [filterSentimento, setFilterSentimento] = useState("all");
  const [filterTema, setFilterTema] = useState("all");
  const [profileName, setProfileName] = useState("");
  
  // WordPress import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const wpInputRef = useRef<HTMLInputElement>(null);

  // Instagram import state
  const [igDialogOpen, setIgDialogOpen] = useState(false);
  const [igLinks, setIgLinks] = useState("");
  const [igImporting, setIgImporting] = useState(false);
  const [igProgress, setIgProgress] = useState(0);
  const [igResult, setIgResult] = useState<{ inserted: number; skipped: number; failed: number } | null>(null);
  const igFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClippings();
    if (user) {
      supabase.from("profiles").select("full_name").eq("id", user.id).single()
        .then(({ data }) => setProfileName(data?.full_name || ""));
    }
  }, [user]);

  const fetchClippings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clippings" as any)
      .select("*")
      .order("data_publicacao", { ascending: false });
    if (!error && data) setClippings(data as unknown as Clipping[]);
    setLoading(false);
  };

  // Dashboard stats
  const stats = useMemo(() => {
    const total = clippings.length;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const thisWeek = clippings.filter(c => isAfter(new Date(c.data_publicacao), weekStart)).length;
    const positivos = clippings.filter(c => c.sentimento === "positivo").length;
    const negativos = clippings.filter(c => c.sentimento === "negativo").length;
    const estrategicos = clippings.filter(c => c.estrategico).length;
    return { total, thisWeek, positivos, negativos, estrategicos };
  }, [clippings]);

  // Activity chart data (last 7 days)
  const chartData = useMemo(() => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = format(d, "yyyy-MM-dd");
      const label = format(d, "EEE", { locale: ptBR });
      const count = clippings.filter(c => c.data_publicacao?.startsWith(dayStr)).length;
      days.push({ label, count });
    }
    return days;
  }, [clippings]);

  const maxChart = Math.max(...chartData.map(d => d.count), 1);

  // Filtered list
  const filtered = useMemo(() => {
    return clippings.filter(c => {
      if (search && !c.titulo.toLowerCase().includes(search.toLowerCase()) && !(c.descricao || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterFonte !== "all" && c.fonte !== filterFonte) return false;
      if (filterSentimento !== "all" && c.sentimento !== filterSentimento) return false;
      if (filterTema !== "all" && c.tema !== filterTema) return false;
      return true;
    });
  }, [clippings, search, filterFonte, filterSentimento, filterTema]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: Clipping) => {
    setEditingId(c.id);
    setForm({
      link: c.link || "",
      fonte: c.fonte,
      tipo: c.tipo,
      titulo: c.titulo,
      descricao: c.descricao || "",
      tema: c.tema || "",
      sentimento: c.sentimento,
      observacoes: c.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim()) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      link: form.link.trim() || null,
      fonte: form.fonte,
      tipo: form.tipo,
      tema: form.tema || null,
      sentimento: form.sentimento,
      observacoes: form.observacoes.trim() || null,
    };

    if (editingId) {
      const { error } = await supabase.from("clippings" as any).update(payload).eq("id", editingId);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Clipping atualizado!" }); }
    } else {
      const { error } = await supabase.from("clippings" as any).insert({
        ...payload,
        author_id: user!.id,
        author_nome: profileName || user!.email,
        data_publicacao: new Date().toISOString(),
      });
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); }
      else { toast({ title: "Clipping adicionado!" }); }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchClippings();
  };

  const toggleField = async (id: string, field: "respondido" | "estrategico", value: boolean) => {
    await supabase.from("clippings" as any).update({ [field]: value }).eq("id", id);
    fetchClippings();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("clippings" as any).delete().eq("id", id);
    if (!error) { toast({ title: "Clipping removido" }); fetchClippings(); }
  };

  const handleWordPressImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportProgress(10);
    setImportResult(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      setImportProgress(30);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-wordpress`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      setImportProgress(80);
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Erro na importação");

      setImportProgress(100);
      setImportResult({ inserted: result.inserted, skipped: result.skipped });
      toast({
        title: "Importação concluída!",
        description: `${result.inserted} clippings importados, ${result.skipped} ignorados.`,
      });
      fetchClippings();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
      if (wpInputRef.current) wpInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Newspaper className="text-primary" size={28} />
            Clipping de Comunicação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitore postagens, matérias e menções ao mandato
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => wpInputRef.current?.click()} disabled={importing}>
            <Upload size={16} /> {importing ? "Importando..." : "Importar WordPress"}
          </Button>
          <input
            ref={wpInputRef}
            type="file"
            accept=".xml"
            className="hidden"
            onChange={handleWordPressImport}
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAdd} className="gap-2">
                <Plus size={16} /> Adicionar Clipping
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar Clipping" : "Novo Clipping"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Link da postagem</Label>
                <Input placeholder="https://instagram.com/p/..." value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fonte</Label>
                  <Select value={form.fonte} onValueChange={v => setForm(f => ({ ...f, fonte: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONTES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Título ou resumo *</Label>
                <Input placeholder="Ex: Post sobre obras no Bairro X" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea placeholder="Detalhes do conteúdo..." value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tema</Label>
                  <Select value={form.tema} onValueChange={v => setForm(f => ({ ...f, tema: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>{TEMAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sentimento</Label>
                  <Select value={form.sentimento} onValueChange={v => setForm(f => ({ ...f, sentimento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="positivo">✅ Positivo</SelectItem>
                      <SelectItem value="neutro">➖ Neutro</SelectItem>
                      <SelectItem value="negativo">❌ Negativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Observações internas</Label>
                <Textarea placeholder="Notas para a equipe..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Salvando..." : editingId ? "Atualizar" : "Salvar Clipping"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total monitorado", value: stats.total, icon: <Newspaper size={20} />, color: "text-primary" },
          { label: "Essa semana", value: stats.thisWeek, icon: <BarChart3 size={20} />, color: "text-blue-400" },
          { label: "Positivos", value: stats.positivos, icon: <TrendingUp size={20} />, color: "text-emerald-400" },
          { label: "Negativos", value: stats.negativos, icon: <TrendingDown size={20} />, color: "text-red-400" },
          { label: "Estratégicos", value: stats.estrategicos, icon: <Star size={20} />, color: "text-amber-400" },
        ].map((s, i) => (
          <Card key={i} className="bg-card/60 border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className={`flex items-center gap-2 mb-1 ${s.color}`}>
                {s.icon}
                <span className="text-2xl font-bold">{s.value}</span>
              </div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activity Chart */}
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Atividade dos últimos 7 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-24">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground font-medium">{d.count}</span>
                <motion.div
                  className="w-full bg-primary/80 rounded-t-sm min-h-[4px]"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.count / maxChart) * 72}px` }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                />
                <span className="text-[10px] text-muted-foreground capitalize">{d.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar clippings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterFonte} onValueChange={setFilterFonte}>
          <SelectTrigger className="w-[140px]"><Filter size={14} className="mr-1" /><SelectValue placeholder="Fonte" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas fontes</SelectItem>
            {FONTES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSentimento} onValueChange={setFilterSentimento}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sentimento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="positivo">Positivo</SelectItem>
            <SelectItem value="neutro">Neutro</SelectItem>
            <SelectItem value="negativo">Negativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTema} onValueChange={setFilterTema}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tema" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos temas</SelectItem>
            {TEMAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterFonte !== "all" || filterSentimento !== "all" || filterTema !== "all" || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterFonte("all"); setFilterSentimento("all"); setFilterTema("all"); setSearch(""); }}>
            <X size={14} className="mr-1" /> Limpar
          </Button>
        )}
      </div>

      {/* Clippings List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card className="bg-card/40 border-dashed border-border/50">
          <CardContent className="py-12 text-center">
            <Newspaper size={48} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum clipping encontrado</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={openAdd}>
              <Plus size={14} /> Adicionar primeiro clipping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((c, idx) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.02 }}
              >
                <Card className={`bg-card/60 border-border/50 hover:border-primary/30 transition-colors ${c.estrategico ? "ring-1 ring-amber-500/30" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Source icon */}
                      <div className="mt-1 p-2 rounded-lg bg-muted/50 text-muted-foreground">
                        {fonteIcon(c.fonte)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-medium text-foreground text-sm leading-snug">{c.titulo}</h3>
                            {c.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.descricao}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {c.link && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={c.link} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /></a>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive" onClick={() => handleDelete(c.id)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>

                        {/* Tags row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5">
                            {fonteIcon(c.fonte)} {c.fonte}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1 px-2 py-0.5">
                            {tipoIcon(c.tipo)} {c.tipo}
                          </Badge>
                          <Badge className={`text-[10px] gap-1 px-2 py-0.5 border ${sentimentoColor(c.sentimento)}`}>
                            {sentimentoIcon(c.sentimento)} {c.sentimento}
                          </Badge>
                          {c.tema && <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{c.tema}</Badge>}
                          {c.estrategico && <Badge className="text-[10px] px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">⭐ Estratégico</Badge>}
                          {c.respondido && <Badge className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">✓ Respondido</Badge>}
                        </div>

                        {/* Bottom row */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px] text-muted-foreground">
                            {c.data_publicacao ? format(new Date(c.data_publicacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                            {c.author_nome ? ` · ${c.author_nome}` : ""}
                          </span>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <Switch checked={c.respondido} onCheckedChange={v => toggleField(c.id, "respondido", v)} className="scale-75" />
                              <span className="text-[10px] text-muted-foreground">Respondido</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <Switch checked={c.estrategico} onCheckedChange={v => toggleField(c.id, "estrategico", v)} className="scale-75" />
                              <span className="text-[10px] text-muted-foreground">Estratégico</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
