import { useState } from "react";
import { Plus, Search, Eye, Pencil, Trash2, Landmark, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { store } from "@/lib/store";
import { Oficio, OficioStatus } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const statusOptions: OficioStatus[] = ["Rascunho", "Gerado", "Assinado", "Enviado", "Respondido", "Arquivado"];

interface AIResult {
  oficio: string;
  resposta_cidadao: string;
  secretaria_identificada: string;
  tipo_demanda: string;
  urgencia: string;
  sugestoes_melhoria: string[];
}

export default function Oficios() {
  const [oficios, setOficios] = useState(() => store.getOficios());
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [showDialog, setShowDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingOficio, setViewingOficio] = useState<Oficio | null>(null);

  // Form state
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

  const { toast } = useToast();

  const filtered = oficios.filter((o) => {
    if (filtroStatus !== "Todos" && o.status !== filtroStatus) return false;
    if (search && !o.assunto.toLowerCase().includes(search.toLowerCase()) && !o.destinatario.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleGenerateAI = async () => {
    if (!descricao.trim()) {
      toast({ title: "Preencha a descrição", description: "A descrição/contexto é necessária para gerar o ofício.", variant: "destructive" });
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

      if (data.secretaria_identificada && !destinatario) {
        setDestinatario(data.secretaria_identificada);
      }
      if (data.tipo_demanda && tipo === "Solicitação") {
        setTipo(data.tipo_demanda);
      }

      toast({ title: "Ofício gerado!", description: "Revise e edite o texto antes de salvar." });
    } catch (e: any) {
      console.error("AI error:", e);
      toast({ title: "Erro ao gerar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreate = () => {
    const novo: Oficio = {
      id: Date.now().toString(),
      assunto: assunto || aiResult?.tipo_demanda || "Sem assunto",
      destinatario: destinatario || aiResult?.secretaria_identificada || "A definir",
      status: aiResult ? "Gerado" : "Rascunho",
      criadoEm: new Date().toLocaleDateString("pt-BR"),
      conteudo: editedOficio || undefined,
    };
    store.addOficio(novo);
    setOficios(store.getOficios());
    resetForm();
    toast({ title: "Ofício criado!", description: `Status: ${novo.status}` });
  };

  const resetForm = () => {
    setShowDialog(false);
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

  const handleDelete = (id: string) => {
    store.deleteOficio(id);
    setOficios(store.getOficios());
  };

  const handleView = (o: Oficio) => {
    setViewingOficio(o);
    setShowViewDialog(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("pt-BR");
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ofícios</h1>
          <p className="text-sm text-muted-foreground">{oficios.length} ofício(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border text-foreground">Relatório</Button>
          <Button onClick={() => setShowDialog(true)} className="bg-primary text-primary-foreground">
            <Plus size={16} className="mr-1" /> Novo Ofício
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ofícios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((o) => (
          <div key={o.id} className="bg-card rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">{o.status}</span>
                {o.numero && <span className="text-xs text-muted-foreground">Nº {o.numero}</span>}
                <span className="text-xs text-muted-foreground">{formatDate(o.criadoEm)}</span>
              </div>
              {o.assunto && <p className="text-sm font-semibold text-foreground">{o.assunto}</p>}
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Landmark size={12} />
                {o.destinatario}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => handleView(o)} className="p-2 text-muted-foreground hover:text-foreground"><Eye size={16} /></button>
              <button className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={16} /></button>
              <button onClick={() => handleDelete(o.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) resetForm(); else setShowDialog(true); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Sparkles size={20} className="text-primary" />
              Novo Ofício com IA
            </DialogTitle>
          </DialogHeader>

          {!aiResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Assunto (opcional - IA identifica)" value={assunto} onChange={(e) => setAssunto(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Destinatário (opcional - IA identifica)" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="bg-secondary border-border" />
              </div>
              <Textarea
                placeholder="Descreva a demanda do cidadão aqui... Ex: 'Regina está precisando da operação tapa-buraco na Rua Carmo Gifonni, 294, Centro. O buraco vem causando transtornos para motoristas e transeuntes.'"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="bg-secondary border-border min-h-[120px]"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nome do solicitante" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className="bg-secondary border-border" />
                <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Solicitação">Solicitação</SelectItem>
                    <SelectItem value="Reclamação">Reclamação</SelectItem>
                    <SelectItem value="Denúncia">Denúncia</SelectItem>
                    <SelectItem value="Sugestão">Sugestão</SelectItem>
                    <SelectItem value="Informação">Informação</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleGenerateAI} disabled={isGenerating} className="w-full bg-primary text-primary-foreground">
                {isGenerating ? (
                  <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando com IA...</>
                ) : (
                  <><Sparkles size={16} className="mr-2" /> Gerar Ofício com IA</>
                )}
              </Button>

              <div className="text-center">
                <button onClick={handleCreate} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Criar sem IA (rascunho)
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* AI Identification badges */}
              <div className="flex flex-wrap gap-2">
                {aiResult.secretaria_identificada && (
                  <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                    <Landmark size={12} /> {aiResult.secretaria_identificada}
                  </span>
                )}
                {aiResult.tipo_demanda && (
                  <span className="text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground">
                    {aiResult.tipo_demanda}
                  </span>
                )}
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
                  <TabsTrigger value="resposta" className="flex-1">💬 Resposta ao Cidadão</TabsTrigger>
                  {aiResult.sugestoes_melhoria?.length > 0 && (
                    <TabsTrigger value="sugestoes" className="flex-1">💡 Sugestões</TabsTrigger>
                  )}
                </TabsList>

                <TabsContent value="oficio" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Revise e edite o texto antes de salvar</p>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedOficio, "Ofício")}>
                      <Copy size={14} className="mr-1" /> Copiar
                    </Button>
                  </div>
                  <Textarea
                    value={editedOficio}
                    onChange={(e) => setEditedOficio(e.target.value)}
                    className="bg-secondary border-border min-h-[300px] font-mono text-sm leading-relaxed"
                  />
                </TabsContent>

                <TabsContent value="resposta" className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MessageSquare size={12} /> Resposta para enviar ao cidadão via WhatsApp
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedResposta, "Resposta")}>
                      <Copy size={14} className="mr-1" /> Copiar
                    </Button>
                  </div>
                  <Textarea
                    value={editedResposta}
                    onChange={(e) => setEditedResposta(e.target.value)}
                    className="bg-secondary border-border min-h-[200px] text-sm"
                  />
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
                <Button variant="outline" onClick={() => setAiResult(null)} className="flex-1 border-border">
                  ← Voltar e editar dados
                </Button>
                <Button onClick={handleCreate} className="flex-1 bg-primary text-primary-foreground">
                  <CheckCircle2 size={16} className="mr-1" /> Salvar Ofício
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {viewingOficio?.assunto || "Ofício"}
            </DialogTitle>
          </DialogHeader>
          {viewingOficio && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">{viewingOficio.status}</span>
                <span className="text-xs text-muted-foreground">{formatDate(viewingOficio.criadoEm)}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <Landmark size={12} className="inline mr-1" />
                {viewingOficio.destinatario}
              </div>
              {viewingOficio.conteudo ? (
                <div className="bg-secondary rounded-lg p-4">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{viewingOficio.conteudo}</pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Nenhum conteúdo gerado ainda.</p>
              )}
              {viewingOficio.conteudo && (
                <Button variant="outline" onClick={() => copyToClipboard(viewingOficio.conteudo!, "Ofício")} className="w-full">
                  <Copy size={14} className="mr-1" /> Copiar Texto do Ofício
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
