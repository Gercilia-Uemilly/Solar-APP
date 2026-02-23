import { useRef, useState } from "react";
import { Plus, Search, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2, Landmark, FileText, Download, Eye, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import OficioPreview from "@/components/OficioPreview";
import { exportToWord, exportToPDF } from "@/lib/exportOficio";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";

const statusOptions = ["Rascunho", "Gerado", "Assinado", "Enviado", "Respondido", "Arquivado"];

interface AIResult {
  oficio: string;
  resposta_cidadao: string;
  secretaria_identificada: string;
  tipo_demanda: string;
  urgencia: string;
  sugestoes_melhoria: string[];
}

interface OficioRow {
  id: string;
  numero: string | null;
  assunto: string;
  destinatario: string;
  status: string;
  conteudo: string | null;
  resposta_cidadao: string | null;
  author_id: string;
  created_at: string;
}

export default function Oficios() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [viewingOficio, setViewingOficio] = useState<OficioRow | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Form state
  const [numero, setNumero] = useState("");
  const [assunto, setAssunto] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState("Solicitação");
  const [solicitante, setSolicitante] = useState("");
  const [bairro, setBairro] = useState("");
  const [prioridade, setPrioridade] = useState("Normal");

  // AI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [editedOficio, setEditedOficio] = useState("");
  const [editedResposta, setEditedResposta] = useState("");

  // Fetch oficios
  const fetchOficios = async () => {
    setLoading(true);
    const { data } = await supabase.from("oficios").select("*").order("created_at", { ascending: false });
    setOficios((data as unknown as OficioRow[]) || []);
    setLoading(false);
  };

  useState(() => { fetchOficios(); });

  const filtered = oficios.filter(o => {
    if (filtroStatus !== "Todos" && o.status !== filtroStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return o.assunto.toLowerCase().includes(s) || o.destinatario.toLowerCase().includes(s);
    }
    return true;
  });

  const handleGenerateAI = async () => {
    if (!descricao.trim()) {
      toast({ title: "Preencha a descrição", description: "A descrição é necessária para gerar o ofício.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-oficio", {
        body: { assunto, destinatario, descricao, tipo, solicitante, bairro, prioridade },
      });
      if (error) throw error;
      setAiResult(data);
      setEditedOficio(data.oficio || "");
      setEditedResposta(data.resposta_cidadao || "");
      if (data.secretaria_identificada && !destinatario) setDestinatario(data.secretaria_identificada);
      if (data.tipo_demanda && tipo === "Solicitação") setTipo(data.tipo_demanda);
      toast({ title: "Ofício gerado!", description: "Revise e edite o texto antes de salvar." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    const { error } = await supabase.from("oficios").insert({
      numero: numero || null,
      assunto: assunto || aiResult?.tipo_demanda || "Sem assunto",
      destinatario: destinatario || aiResult?.secretaria_identificada || "A definir",
      status: aiResult ? "Gerado" : "Rascunho",
      conteudo: editedOficio || null,
      resposta_cidadao: editedResposta || null,
      secretaria_identificada: aiResult?.secretaria_identificada || null,
      tipo_demanda: aiResult?.tipo_demanda || tipo,
      urgencia: aiResult?.urgencia || (prioridade === "Urgente" ? "urgente" : "normal"),
      author_id: user.id,
    });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    await fetchOficios();
    resetForm();
    toast({ title: "Ofício salvo!" });
  };

  const resetForm = () => {
    setShowDialog(false);
    setNumero("");
    setAssunto("");
    setDestinatario("");
    setDescricao("");
    setTipo("Solicitação");
    setSolicitante("");
    setBairro("");
    setPrioridade("Normal");
    setAiResult(null);
    setEditedOficio("");
    setEditedResposta("");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("oficios").delete().eq("id", id);
    setOficios(prev => prev.filter(o => o.id !== id));
    toast({ title: "Ofício excluído" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ofícios</h1>
          <p className="text-sm text-muted-foreground">{oficios.length} ofício(s)</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Novo Ofício
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar ofícios..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum ofício encontrado.</p>
        ) : filtered.map(o => (
          <div key={o.id} className="bg-card rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">{o.status}</span>
                {o.numero && <span className="text-xs text-muted-foreground">Nº {o.numero}</span>}
                <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              {o.assunto && <p className="text-sm font-semibold text-foreground">{o.assunto}</p>}
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Landmark size={12} />
                {o.destinatario}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setViewingOficio(o); setShowPreviewDialog(true); }} className="p-2 text-muted-foreground hover:text-foreground" title="Visualizar"><Eye size={16} /></button>
              <button
                onClick={() => {
                  if (o.conteudo) exportToWord({ numero: o.numero || "", destinatario: o.destinatario, assunto: o.assunto, conteudo: o.conteudo, logoCamaraUrl: logoCamara, logoFabaoUrl: logoFabao });
                }}
                className="p-2 text-muted-foreground hover:text-foreground"
                title="Exportar Word"
              >
                <FileText size={16} />
              </button>
              <button onClick={() => handleDelete(o.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) resetForm(); else setShowDialog(true); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Sparkles size={20} className="text-primary" /> Novo Ofício com IA
            </DialogTitle>
          </DialogHeader>

          {!aiResult ? (
            <div className="space-y-4">
              <Input placeholder="Nº do Ofício (ex: 23)" value={numero} onChange={e => setNumero(e.target.value)} className="bg-secondary border-border" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Assunto (opcional - IA identifica)" value={assunto} onChange={e => setAssunto(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Destinatário (opcional - IA identifica)" value={destinatario} onChange={e => setDestinatario(e.target.value)} className="bg-secondary border-border" />
              </div>
              <Textarea
                placeholder="Descreva a demanda do cidadão... Ex: 'Moradores da Rua Oscar Alvim, Bairro Fundinho, reclamam de buracos que causam acidentes.'"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="bg-secondary border-border min-h-[120px]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Nome do solicitante" value={solicitante} onChange={e => setSolicitante(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Solicitação", "Reclamação", "Denúncia", "Sugestão", "Informação"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateAI} disabled={isGenerating} className="w-full bg-primary text-primary-foreground">
                {isGenerating ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Texto com IA</>}
              </Button>
              <div className="text-center">
                <button onClick={handleCreate} className="text-xs text-muted-foreground hover:text-foreground underline">Criar sem IA (rascunho)</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {aiResult.secretaria_identificada && (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary flex items-center gap-1"><Landmark size={12} /> {aiResult.secretaria_identificada}</span>
                )}
                {aiResult.tipo_demanda && <span className="text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground">{aiResult.tipo_demanda}</span>}
                {aiResult.urgencia && (
                  <span className={`text-xs px-3 py-1 rounded-full flex items-center gap-1 ${aiResult.urgencia === "urgente" ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
                    {aiResult.urgencia === "urgente" ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                    {aiResult.urgencia === "urgente" ? "Urgente" : "Normal"}
                  </span>
                )}
              </div>

              <Tabs defaultValue="oficio" className="w-full">
                <TabsList className="w-full bg-secondary">
                  <TabsTrigger value="oficio" className="flex-1">📄 Ofício</TabsTrigger>
                  <TabsTrigger value="resposta" className="flex-1">💬 Resposta</TabsTrigger>
                  <TabsTrigger value="preview" className="flex-1">👁️ Visualizar</TabsTrigger>
                  {aiResult.sugestoes_melhoria?.length > 0 && <TabsTrigger value="sugestoes" className="flex-1">💡 Sugestões</TabsTrigger>}
                </TabsList>

                <TabsContent value="oficio" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Revise e edite o texto antes de salvar</p>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedOficio, "Ofício")}><Copy size={14} className="mr-1" /> Copiar</Button>
                  </div>
                  <Textarea value={editedOficio} onChange={e => setEditedOficio(e.target.value)} className="bg-secondary border-border min-h-[300px] font-mono text-sm leading-relaxed" />
                </TabsContent>

                <TabsContent value="resposta" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><MessageSquare size={12} /> Resposta ao cidadão</p>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedResposta, "Resposta")}><Copy size={14} className="mr-1" /> Copiar</Button>
                  </div>
                  <Textarea value={editedResposta} onChange={e => setEditedResposta(e.target.value)} className="bg-secondary border-border min-h-[200px] text-sm" />
                </TabsContent>

                <TabsContent value="preview" className="space-y-3">
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => exportToWord({ numero, destinatario, assunto, conteudo: editedOficio, logoCamaraUrl: logoCamara, logoFabaoUrl: logoFabao })}>
                      <FileText size={14} className="mr-1" /> Word
                    </Button>
                    <Button size="sm" variant="outline" onClick={async () => { if (previewRef.current) await exportToPDF(previewRef.current, numero); }}>
                      <Download size={14} className="mr-1" /> PDF
                    </Button>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <OficioPreview ref={previewRef} numero={numero} destinatario={destinatario} assunto={assunto} conteudo={editedOficio} />
                  </div>
                </TabsContent>

                {aiResult.sugestoes_melhoria?.length > 0 && (
                  <TabsContent value="sugestoes" className="space-y-2">
                    {aiResult.sugestoes_melhoria.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-secondary rounded-lg">
                        <span className="text-primary mt-0.5">💡</span>
                        <p className="text-sm text-foreground">{s}</p>
                      </div>
                    ))}
                  </TabsContent>
                )}
              </Tabs>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAiResult(null)} className="flex-1 border-border">← Voltar</Button>
                <Button onClick={handleCreate} className="flex-1 bg-primary text-primary-foreground"><CheckCircle2 size={16} className="mr-1" /> Salvar Ofício</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="bg-card border-border max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              <span>{viewingOficio?.assunto || "Ofício"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  if (viewingOficio?.conteudo) exportToWord({ numero: viewingOficio.numero || "", destinatario: viewingOficio.destinatario, assunto: viewingOficio.assunto, conteudo: viewingOficio.conteudo, logoCamaraUrl: logoCamara, logoFabaoUrl: logoFabao });
                }}><FileText size={14} className="mr-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  const el = document.getElementById("oficio-view-preview");
                  if (el) await exportToPDF(el, viewingOficio?.numero || "");
                }}><Download size={14} className="mr-1" /> PDF</Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewingOficio && (
            <div className="overflow-x-auto">
              <div id="oficio-view-preview">
                <OficioPreview numero={viewingOficio.numero || ""} destinatario={viewingOficio.destinatario} assunto={viewingOficio.assunto} conteudo={viewingOficio.conteudo || ""} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
