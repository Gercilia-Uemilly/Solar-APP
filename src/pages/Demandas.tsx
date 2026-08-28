import { useState, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { Plus, Search, LayoutGrid, List, Sparkles, Loader2, Eye, Trash2, Edit, ChevronDown } from "lucide-react";
import { store } from "@/lib/store";
import { Demanda, DemandaTipo, DemandaStatus, DemandaOrigem, DemandaAnexo } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RichTextEditor from "@/components/RichTextEditor";
import FileDropzone from "@/components/FileDropzone";

const tipos: DemandaTipo[] = ["Solicitação", "Reclamação", "Denúncia", "Sugestão", "Informação", "Outro"];
const statuses: DemandaStatus[] = ["Pendente", "Em Andamento", "Concluída", "Cancelada"];
const origens: DemandaOrigem[] = ["WhatsApp Gabinete", "WhatsApp Vereador", "Requerimento", "E-mail", "Atendimento presencial", "Outro"];

const secretarias = [
  "Secretaria de Obras", "Secretaria de Meio Ambiente", "Iluminação Pública",
  "Secretaria de Saúde", "Secretaria de Educação", "Trânsito e Transportes (SETTRAN)",
  "Secretaria de Assistência Social", "DMAE", "CEMIG", "Outro",
];

export default function Demandas() {
  const { toast } = useToast();
  const [demandas, setDemandas] = useState(() => store.getDemandas());
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDialog, setShowDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingDemanda, setViewingDemanda] = useState<Demanda | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [conteudoHtml, setConteudoHtml] = useState("");
  const [tipo, setTipo] = useState<DemandaTipo>("Solicitação");
  const [prioridade, setPrioridade] = useState<"Normal" | "Urgente">("Normal");
  const [solicitante, setSolicitante] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairro, setBairro] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const [origem, setOrigem] = useState<DemandaOrigem>("WhatsApp Gabinete");
  const [anexos, setAnexos] = useState<DemandaAnexo[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const filtered = useMemo(() => {
    return demandas.filter((d) => {
      if (filtroTipo !== "Todos" && d.tipo !== filtroTipo) return false;
      if (filtroStatus !== "Todos" && d.status !== filtroStatus) return false;
      if (search && !d.titulo.toLowerCase().includes(search.toLowerCase()) && !d.solicitante.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [demandas, filtroTipo, filtroStatus, search]);

  const resetForm = () => {
    setTitulo(""); setConteudoHtml(""); setSolicitante(""); setBairro("");
    setTelefone(""); setSecretaria(""); setOrigem("WhatsApp Gabinete");
    setTipo("Solicitação"); setPrioridade("Normal"); setAnexos([]);
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!titulo.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    const novaDemanda: Demanda = {
      id: editingId || Date.now().toString(),
      titulo,
      descricao: conteudoHtml.replace(/<[^>]*>/g, "").trim(),
      conteudo_html: conteudoHtml,
      tipo,
      status: editingId ? (demandas.find(d => d.id === editingId)?.status || "Pendente") : "Pendente",
      prioridade,
      solicitante,
      telefone_solicitante: telefone,
      bairro,
      secretaria,
      origem,
      anexos: anexos.map(a => ({ ...a, file: undefined })),
      criadoEm: editingId ? (demandas.find(d => d.id === editingId)?.criadoEm || new Date().toISOString()) : new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };

    if (editingId) {
      store.updateDemanda(novaDemanda);
    } else {
      store.addDemanda(novaDemanda);
    }
    setDemandas(store.getDemandas());
    setShowDialog(false);
    resetForm();
    toast({ title: editingId ? "Demanda atualizada" : "Demanda criada com sucesso" });
  };

  const handleEdit = (d: Demanda) => {
    setEditingId(d.id);
    setTitulo(d.titulo);
    setConteudoHtml(d.conteudo_html || d.descricao || "");
    setTipo(d.tipo);
    setPrioridade(d.prioridade);
    setSolicitante(d.solicitante);
    setTelefone(d.telefone_solicitante || "");
    setBairro(d.bairro || "");
    setSecretaria(d.secretaria || "");
    setOrigem(d.origem || "WhatsApp Gabinete");
    setAnexos(d.anexos || []);
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    store.deleteDemanda(id);
    setDemandas(store.getDemandas());
    toast({ title: "Demanda removida" });
  };

  const handleView = (d: Demanda) => {
    setViewingDemanda(d);
    setShowViewDialog(true);
  };

  // AI auto-analysis when file added
  const handleFileAdded = useCallback(async (file: File) => {
    const isPdf = file.type.includes("pdf");
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    if (!isPdf && !isImage && !isAudio) return;

    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data, error } = await supabase.functions.invoke("analyze-demanda", { body: formData });

      if (error) throw error;

      if (data) {
        if (data.titulo && !titulo) setTitulo(data.titulo);
        if (data.solicitante && !solicitante) setSolicitante(data.solicitante);
        if (data.telefone && !telefone) setTelefone(data.telefone);
        if (data.bairro && !bairro) setBairro(data.bairro);
        if (data.secretaria && !secretaria) setSecretaria(data.secretaria);
        if (data.tipo_demanda) {
          const found = tipos.find(t => t.toLowerCase() === data.tipo_demanda.toLowerCase());
          if (found) setTipo(found);
        }
        if (data.descricao && !conteudoHtml) {
          setConteudoHtml(`<p>${data.descricao.replace(/\n/g, "</p><p>")}</p>`);
        }
        toast({ title: "Análise concluída", description: "Campos preenchidos automaticamente pela IA" });
      }
    } catch (e) {
      console.error("Análise error:", e);
      toast({ title: "Erro na análise", description: "Não foi possível analisar o arquivo", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [titulo, solicitante, telefone, bairro, secretaria, conteudoHtml, toast]);

  // Generate auto demand
  const handleAutoGenerate = async () => {
    if (anexos.length === 0 && !conteudoHtml.trim()) {
      toast({ title: "Envie um arquivo ou escreva um texto para gerar automaticamente", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const plainText = conteudoHtml.replace(/<[^>]*>/g, "").trim();
      const formData = new FormData();

      // If there's a file, send it; otherwise send text
      const fileAnexo = anexos.find(a => a.file && (a.tipo.includes("pdf") || a.tipo.startsWith("image/") || a.tipo.startsWith("audio/")));
      if (fileAnexo?.file) {
        formData.append("file", fileAnexo.file);
      } else {
        formData.append("text", plainText);
      }

      const { data, error } = await supabase.functions.invoke("analyze-demanda", { body: formData });
      if (error) throw error;

      if (data) {
        if (data.titulo) setTitulo(data.titulo);
        if (data.solicitante) setSolicitante(data.solicitante);
        if (data.telefone) setTelefone(data.telefone);
        if (data.bairro) setBairro(data.bairro);
        if (data.secretaria) setSecretaria(data.secretaria);
        if (data.tipo_demanda) {
          const found = tipos.find(t => t.toLowerCase() === data.tipo_demanda.toLowerCase());
          if (found) setTipo(found);
        }
        if (data.descricao) {
          setConteudoHtml(`<p>${data.descricao.replace(/\n/g, "</p><p>")}</p>`);
        }
        toast({ title: "Demanda gerada!", description: "Revise os campos e confirme." });
      }
    } catch (e) {
      console.error("Auto-generate error:", e);
      toast({ title: "Erro ao gerar demanda", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "Pendente": return "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400";
      case "Em Andamento": return "bg-blue-500/20 text-blue-600 dark:text-blue-400";
      case "Concluída": return "bg-green-500/20 text-green-600 dark:text-green-400";
      case "Cancelada": return "bg-destructive/20 text-destructive";
      default: return "bg-accent text-accent-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demandas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {demandas.length} demanda(s)</p>
        </div>
        <Button onClick={() => { resetForm(); setShowDialog(true); }} className="bg-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Nova Demanda
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="bg-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar demandas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
          </div>
          <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            <List size={16} />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {["Todos", ...tipos].map((t) => (
            <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1 rounded-full text-xs transition-colors ${filtroTipo === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Todos", ...statuses].map((s) => (
            <button key={`s-${s}`} onClick={() => setFiltroStatus(s)} className={`px-3 py-1 rounded-full text-xs transition-colors ${filtroStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Nenhuma demanda encontrada</p>
          <button onClick={() => { resetForm(); setShowDialog(true); }} className="text-primary text-sm mt-2 hover:underline">+ Criar nova demanda</button>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-3"}>
          {filtered.map((d) => (
            <div key={d.id} className="bg-card rounded-xl p-4 space-y-2 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{d.tipo}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(d.status)}`}>{d.status}</span>
                    {d.prioridade === "Urgente" && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Urgente</span>}
                    {d.secretaria && <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{d.secretaria}</span>}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{d.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {d.solicitante}{d.bairro && ` · ${d.bairro}`}{d.origem && ` · ${d.origem}`}
                  </p>
                  {d.anexos && d.anexos.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">📎 {d.anexos.length} anexo(s)</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => handleView(d)} className="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Visualizar">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => handleEdit(d)} className="p-1.5 rounded hover:bg-accent text-muted-foreground" title="Editar">
                    <Edit size={14} />
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) resetForm(); setShowDialog(o); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {editingId ? "Editar Demanda" : "Nova Demanda"}
              {analyzing && <Loader2 size={16} className="animate-spin text-primary" />}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="dados" className="space-y-4">
            <TabsList className="w-full">
              <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
              <TabsTrigger value="texto" className="flex-1">Texto</TabsTrigger>
              <TabsTrigger value="anexos" className="flex-1">Anexos</TabsTrigger>
            </TabsList>

            {/* Tab: Dados */}
            <TabsContent value="dados" className="space-y-3">
              <Input placeholder="Título da solicitação *" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="bg-secondary border-border" />

              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Solicitante" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} className="bg-secondary border-border" />
              </div>

              <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="bg-secondary border-border" />

              <div className="grid grid-cols-2 gap-3">
                <Select value={secretaria || "none"} onValueChange={(v) => setSecretaria(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Secretaria responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione a secretaria</SelectItem>
                    {secretarias.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={origem} onValueChange={(v) => setOrigem(v as DemandaOrigem)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select value={tipo} onValueChange={(v) => setTipo(v as DemandaTipo)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={prioridade} onValueChange={(v) => setPrioridade(v as "Normal" | "Urgente")}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Tab: Texto */}
            <TabsContent value="texto" className="space-y-3">
              <RichTextEditor content={conteudoHtml} onChange={setConteudoHtml} placeholder="Descreva a demanda com detalhes..." />
            </TabsContent>

            {/* Tab: Anexos */}
            <TabsContent value="anexos" className="space-y-3">
              <FileDropzone anexos={anexos} onChange={setAnexos} onFileAdded={handleFileAdded} />
              {analyzing && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 size={14} className="animate-spin" />
                  Analisando arquivo com IA...
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleAutoGenerate} variant="outline" className="flex-1" disabled={analyzing}>
              <Sparkles size={14} className="mr-1" /> Gerar automaticamente
            </Button>
            <Button onClick={handleCreate} className="flex-1 bg-primary text-primary-foreground" disabled={analyzing}>
              {editingId ? "Atualizar" : "Criar Demanda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewingDemanda && (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">{viewingDemanda.titulo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{viewingDemanda.tipo}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor(viewingDemanda.status)}`}>{viewingDemanda.status}</span>
                  {viewingDemanda.prioridade === "Urgente" && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Urgente</span>}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {viewingDemanda.solicitante && <div><span className="text-muted-foreground">Solicitante:</span> <span className="text-foreground">{viewingDemanda.solicitante}</span></div>}
                  {viewingDemanda.telefone_solicitante && <div><span className="text-muted-foreground">Telefone:</span> <span className="text-foreground">{viewingDemanda.telefone_solicitante}</span></div>}
                  {viewingDemanda.bairro && <div><span className="text-muted-foreground">Bairro:</span> <span className="text-foreground">{viewingDemanda.bairro}</span></div>}
                  {viewingDemanda.secretaria && <div><span className="text-muted-foreground">Secretaria:</span> <span className="text-foreground">{viewingDemanda.secretaria}</span></div>}
                  {viewingDemanda.origem && <div><span className="text-muted-foreground">Origem:</span> <span className="text-foreground">{viewingDemanda.origem}</span></div>}
                </div>

                {viewingDemanda.conteudo_html && (
                  <div className="prose prose-sm max-w-none text-foreground bg-secondary rounded-lg p-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingDemanda.conteudo_html) }} />
                )}

                {viewingDemanda.anexos && viewingDemanda.anexos.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Anexos ({viewingDemanda.anexos.length})</p>
                    <div className="space-y-1">
                      {viewingDemanda.anexos.map(a => (
                        <div key={a.id} className="text-xs text-muted-foreground bg-secondary rounded px-3 py-1.5">
                          📎 {a.nome}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Criado em {new Date(viewingDemanda.criadoEm).toLocaleDateString("pt-BR")}
                  {viewingDemanda.atualizadoEm && ` · Atualizado em ${new Date(viewingDemanda.atualizadoEm).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
