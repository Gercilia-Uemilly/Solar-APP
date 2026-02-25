import { useRef, useState, useEffect, ChangeEvent } from "react";
import { Plus, Search, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2, Landmark, FileText, Download, Eye, Trash2, Calendar, User, MapPin, Phone, Mic, ImagePlus, X, FileAudio, Image } from "lucide-react";
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
import assinaturaFabao from "@/assets/assinatura-fabao.png";

const statusOptions = ["Rascunho", "Gerado", "Assinado", "Enviado", "Respondido", "Arquivado"];

const tiposServico = [
  { label: "Operação Tapa-Buracos / Pavimentação", secretaria: "Secretaria Municipal de Infraestrutura Urbana" },
  { label: "Iluminação Pública", secretaria: "Secretaria Municipal de Serviços Urbanos" },
  { label: "Sinalização / Semáforos / Trânsito", secretaria: "Secretaria Municipal de Trânsito e Transportes" },
  { label: "Transporte Público / Ônibus", secretaria: "Secretaria Municipal de Trânsito e Transportes" },
  { label: "Limpeza Urbana / Capina / Roçada", secretaria: "Secretaria Municipal de Serviços Urbanos" },
  { label: "Saúde / UBS / UAI", secretaria: "Secretaria Municipal de Saúde" },
  { label: "Educação / Escolas", secretaria: "Secretaria Municipal de Educação" },
  { label: "Água / Esgoto / DMAE", secretaria: "DMAE" },
  { label: "Assistência Social / CRAS", secretaria: "Secretaria Municipal de Desenvolvimento Social" },
  { label: "Meio Ambiente / Poda / Praças", secretaria: "Secretaria Municipal de Gestão Ambiental e Sustentabilidade" },
  { label: "Habitação / Casas Populares", secretaria: "Secretaria Municipal de Habitação" },
  { label: "Segurança / Videomonitoramento", secretaria: "Secretaria Municipal de Segurança Integrada" },
  { label: "Esporte / Poliesportivos / FUTEL", secretaria: "FUTEL" },
  { label: "Cultura / Turismo / Eventos", secretaria: "Secretaria Municipal de Cultura e Turismo" },
  { label: "Fiscalização de Obras", secretaria: "Secretaria Municipal de Planejamento Urbano" },
  { label: "Agronegócio / Estradas Rurais", secretaria: "Secretaria Municipal de Agronegócio" },
  { label: "PROCON / Defesa do Consumidor", secretaria: "PROCON" },
  { label: "Outro", secretaria: "" },
];

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
  cargo_destinatario: string | null;
  local_demanda: string | null;
  bairro: string | null;
  solicitante: string | null;
  contato_solicitante: string | null;
  data_geracao: string | null;
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
  const [dataGeracao, setDataGeracao] = useState(new Date().toISOString().split("T")[0]);
  const [tipoServico, setTipoServico] = useState("");
  const [assunto, setAssunto] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [cargoDestinatario, setCargoDestinatario] = useState("");
  const [localDemanda, setLocalDemanda] = useState("");
  const [bairro, setBairro] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [contatoSolicitante, setContatoSolicitante] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("Normal");
  const [linhaTelefonica, setLinhaTelefonica] = useState("");
  const [formTab, setFormTab] = useState("dados");
  const [userPhones, setUserPhones] = useState<string[]>([]);

  // AI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [editedOficio, setEditedOficio] = useState("");
  const [editedResposta, setEditedResposta] = useState("");

  // File processing state
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processedFileText, setProcessedFileText] = useState("");
  const [processedFileType, setProcessedFileType] = useState<"image" | "audio" | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Fetch oficios
  const fetchOficios = async () => {
    setLoading(true);
    const { data } = await supabase.from("oficios").select("*").order("created_at", { ascending: false });
    setOficios((data as unknown as OficioRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchOficios(); }, []);

  // Auto-generate next sequential number
  const generateNextNumero = () => {
    const year = new Date().getFullYear();
    const existingNumbers = oficios
      .map(o => o.numero)
      .filter(Boolean)
      .map(n => {
        const match = n!.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${nextNum}/${year}`;
  };

  // Fetch user phone lines
  useEffect(() => {
    if (!user) return;
    const fetchPhones = async () => {
      const { data } = await supabase.from("profiles").select("telefone1, telefone2, telefone3").eq("id", user.id).single();
      if (data) {
        const phones = [data.telefone1, data.telefone2, data.telefone3].filter(Boolean) as string[];
        setUserPhones(phones);
      }
    };
    fetchPhones();
  }, [user]);

  // Auto-fill secretaria when tipo_servico changes
  useEffect(() => {
    const found = tiposServico.find(t => t.label === tipoServico);
    if (found && found.secretaria) {
      setSecretaria(found.secretaria);
    }
  }, [tipoServico]);

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
        body: { assunto, destinatario, descricao, tipo: tipoServico || "Solicitação", solicitante, bairro, prioridade, local: localDemanda },
      });
      if (error) throw error;
      setAiResult(data);
      setEditedOficio(data.oficio || "");
      setEditedResposta(data.resposta_cidadao || "");
      if (data.secretaria_identificada && !destinatario) setDestinatario(data.secretaria_identificada);
      if (data.secretaria_identificada && !secretaria) setSecretaria(data.secretaria_identificada);
      setFormTab("texto");
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
      secretaria_identificada: aiResult?.secretaria_identificada || secretaria || null,
      tipo_demanda: aiResult?.tipo_demanda || tipoServico || null,
      urgencia: aiResult?.urgencia || (prioridade === "Urgente" ? "urgente" : "normal"),
      author_id: user.id,
      linha_telefonica: linhaTelefonica || null,
      operador_nome: user.user_metadata?.full_name || user.email || null,
      cargo_destinatario: cargoDestinatario || null,
      local_demanda: localDemanda || null,
      bairro: bairro || null,
      solicitante: solicitante || null,
      contato_solicitante: contatoSolicitante || null,
      data_geracao: dataGeracao || null,
    });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    await fetchOficios();
    resetForm();
    toast({ title: "Ofício salvo!" });
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: "image" | "audio") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setProcessedFileText("");
    setProcessedFileType(type);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const { data, error } = await supabase.functions.invoke("process-file", {
        body: formData,
      });

      if (error) throw error;

      const extractedText = data.text || "";
      setProcessedFileText(extractedText);
      toast({
        title: type === "image" ? "📷 Imagem processada!" : "🎤 Áudio transcrito!",
        description: "Revise o conteúdo extraído antes de gerar o ofício.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao processar arquivo", description: err.message || "Tente novamente.", variant: "destructive" });
      setProcessedFileType(null);
    } finally {
      setIsProcessingFile(false);
      // Reset input
      if (type === "audio" && audioInputRef.current) audioInputRef.current.value = "";
      if (type === "image" && imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const confirmProcessedText = () => {
    setDescricao(prev => prev ? prev + "\n\n" + processedFileText : processedFileText);
    setProcessedFileText("");
    setProcessedFileType(null);
    toast({ title: "Conteúdo inserido na descrição!" });
  };

  const resetForm = () => {
    setShowDialog(false);
    setNumero("");
    setDataGeracao(new Date().toISOString().split("T")[0]);
    setTipoServico("");
    setAssunto("");
    setSecretaria("");
    setDestinatario("");
    setCargoDestinatario("");
    setLocalDemanda("");
    setBairro("");
    setSolicitante("");
    setContatoSolicitante("");
    setDescricao("");
    setPrioridade("Normal");
    setLinhaTelefonica("");
    setFormTab("dados");
    setAiResult(null);
    setEditedOficio("");
    setEditedResposta("");
    setProcessedFileText("");
    setProcessedFileType(null);
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
        <Button onClick={() => { setNumero(generateNextNumero()); setShowDialog(true); }} className="bg-primary text-primary-foreground">
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
                  if (o.conteudo) exportToWord({ numero: o.numero || "", destinatario: o.destinatario, assunto: o.assunto, conteudo: o.conteudo, logoCamaraUrl: logoCamara, logoFabaoUrl: logoFabao, assinaturaUrl: assinaturaFabao });
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

      {/* Create Dialog with Tabs */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) resetForm(); else setShowDialog(true); }}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Ofício</DialogTitle>
          </DialogHeader>

          <Tabs value={formTab} onValueChange={setFormTab} className="w-full">
            <TabsList className="w-full bg-secondary grid grid-cols-4">
              <TabsTrigger value="dados" className="text-xs">📋 Dados</TabsTrigger>
              <TabsTrigger value="texto" className="text-xs">🔥 Texto</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">👁️ Visualizar</TabsTrigger>
              <TabsTrigger value="status" className="text-xs">📊 Status</TabsTrigger>
            </TabsList>

            {/* TAB: DADOS */}
            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Número do Ofício</label>
                  <Input placeholder="Ex: 23/2026" value={numero} onChange={e => setNumero(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Geração</label>
                  <Input type="date" value={dataGeracao} onChange={e => setDataGeracao(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-primary mb-1 block">Tipo de Serviço <span className="text-primary/70">(preenche secretaria automaticamente)</span></label>
                <Select value={tipoServico} onValueChange={setTipoServico}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {tiposServico.map(t => <SelectItem key={t.label} value={t.label}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assunto *</label>
                <Input placeholder="Assunto do ofício" value={assunto} onChange={e => setAssunto(e.target.value)} className="bg-secondary border-border" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Secretaria</label>
                <Input placeholder="Preenchido automaticamente" value={secretaria} onChange={e => setSecretaria(e.target.value)} className="bg-secondary border-border" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinatário *</label>
                  <Input placeholder="Nome do destinatário" value={destinatario} onChange={e => setDestinatario(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo do Destinatário</label>
                  <Input placeholder="Ex: Ilmo(a). Sr(a)..." value={cargoDestinatario} onChange={e => setCargoDestinatario(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Local</label>
                  <Input placeholder="Ex: Av. K, Terminal..." value={localDemanda} onChange={e => setLocalDemanda(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bairro</label>
                  <Input placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Solicitante</label>
                  <Input placeholder="Nome do solicitante" value={solicitante} onChange={e => setSolicitante(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Contato do Solicitante</label>
                  <Input placeholder="Telefone / WhatsApp" value={contatoSolicitante} onChange={e => setContatoSolicitante(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição da demanda</label>
                <Textarea
                  placeholder="Descreva a demanda do cidadão... Ex: 'Moradores da Rua Oscar Alvim, Bairro Fundinho, reclamam de buracos que causam acidentes.'"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="bg-secondary border-border min-h-[100px]"
                />
               </div>

              {/* Real file upload buttons */}
              <div className="flex gap-2">
                <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e => handleFileUpload(e, "audio")} />
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "image")} />
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border text-sm"
                  disabled={isProcessingFile}
                  onClick={() => audioInputRef.current?.click()}
                >
                  <Mic size={14} className="mr-1" /> Anexar Áudio
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-border text-sm"
                  disabled={isProcessingFile}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImagePlus size={14} className="mr-1" /> Anexar Imagem
                </Button>
              </div>

              {/* Processing indicator */}
              {isProcessingFile && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  <span className="text-sm text-primary font-medium">
                    {processedFileType === "image" ? "Analisando imagem (OCR)..." : "Transcrevendo áudio..."}
                  </span>
                </div>
              )}

              {/* Processed content preview */}
              {processedFileText && !isProcessingFile && (
                <div className="space-y-2 p-3 bg-accent/30 rounded-lg border border-accent">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      {processedFileType === "image" ? <Image size={12} /> : <FileAudio size={12} />}
                      Conteúdo extraído
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setProcessedFileText(""); setProcessedFileType(null); }}>
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="max-h-[150px] overflow-y-auto text-sm text-muted-foreground bg-background/50 p-2 rounded border border-border whitespace-pre-wrap">
                    {processedFileText}
                  </div>
                  <Button size="sm" onClick={confirmProcessedText} className="w-full bg-primary text-primary-foreground">
                    <CheckCircle2 size={14} className="mr-1" /> Inserir na descrição
                  </Button>
                </div>
              )}

              {/* Linha Telefônica */}
              {userPhones.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone size={12} /> Linha Telefônica utilizada</label>
                  <Select value={linhaTelefonica} onValueChange={setLinhaTelefonica}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecione a linha..." /></SelectTrigger>
                    <SelectContent>
                      {userPhones.map((phone, i) => <SelectItem key={i} value={phone}>Linha {i + 1}: {phone}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleGenerateAI} disabled={isGenerating} className="flex-1 bg-primary text-primary-foreground">
                  {isGenerating ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Texto com IA</>}
                </Button>
                <Button variant="outline" onClick={handleCreate} className="border-border">
                  Salvar Rascunho
                </Button>
              </div>
            </TabsContent>

            {/* TAB: TEXTO */}
            <TabsContent value="texto" className="space-y-4 mt-4">
              {aiResult && (
                <div className="flex flex-wrap gap-2 mb-2">
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
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground">Texto do Ofício</label>
                  {editedOficio && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedOficio, "Ofício")}><Copy size={14} className="mr-1" /> Copiar</Button>}
                </div>
                <Textarea value={editedOficio} onChange={e => setEditedOficio(e.target.value)} placeholder="O texto será preenchido pela IA ou manualmente..." className="bg-secondary border-border min-h-[250px] font-mono text-sm leading-relaxed" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MessageSquare size={12} /> Resposta ao Cidadão</label>
                  {editedResposta && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedResposta, "Resposta")}><Copy size={14} className="mr-1" /> Copiar</Button>}
                </div>
                <Textarea value={editedResposta} onChange={e => setEditedResposta(e.target.value)} placeholder="Sugestão de resposta ao cidadão..." className="bg-secondary border-border min-h-[150px] text-sm" />
              </div>

              {aiResult?.sugestoes_melhoria?.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">💡 Sugestões de melhoria</label>
                  {aiResult.sugestoes_melhoria.map((s, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-secondary rounded-lg">
                      <span className="text-primary mt-0.5">💡</span>
                      <p className="text-sm text-foreground">{s}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">
                <CheckCircle2 size={16} className="mr-1" /> Salvar Ofício
              </Button>
            </TabsContent>

            {/* TAB: PREVIEW */}
            <TabsContent value="preview" className="space-y-3 mt-4">
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => exportToWord({ numero, destinatario, assunto, conteudo: editedOficio, logoCamaraUrl: logoCamara, logoFabaoUrl: logoFabao, cargoDestinatario, assinaturaUrl: assinaturaFabao })}>
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { if (previewRef.current) await exportToPDF(previewRef.current, numero); }}>
                  <Download size={14} className="mr-1" /> PDF
                </Button>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg">
                <OficioPreview ref={previewRef} numero={numero} destinatario={destinatario} assunto={assunto} conteudo={editedOficio} cargoDestinatario={cargoDestinatario} operadorNome={user?.user_metadata?.full_name || user?.email || undefined} />
              </div>
            </TabsContent>

            {/* TAB: STATUS */}
            <TabsContent value="status" className="space-y-4 mt-4">
              <div className="bg-secondary rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Informações do Ofício</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Número:</span> <span className="text-foreground">{numero || "—"}</span></div>
                  <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{dataGeracao}</span></div>
                  <div><span className="text-muted-foreground">Assunto:</span> <span className="text-foreground">{assunto || "—"}</span></div>
                  <div><span className="text-muted-foreground">Destinatário:</span> <span className="text-foreground">{destinatario || "—"}</span></div>
                  <div><span className="text-muted-foreground">Secretaria:</span> <span className="text-foreground">{secretaria || "—"}</span></div>
                  <div><span className="text-muted-foreground">Prioridade:</span> <span className="text-foreground">{prioridade}</span></div>
                  <div><span className="text-muted-foreground">Solicitante:</span> <span className="text-foreground">{solicitante || "—"}</span></div>
                  <div><span className="text-muted-foreground">Bairro:</span> <span className="text-foreground">{bairro || "—"}</span></div>
                </div>
                {aiResult && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-primary flex items-center gap-1"><Sparkles size={12} /> Gerado por IA</p>
                  </div>
                )}
              </div>
              <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">
                <CheckCircle2 size={16} className="mr-1" /> Salvar Ofício
              </Button>
            </TabsContent>
          </Tabs>
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
                  if (viewingOficio?.conteudo) exportToWord({ numero: viewingOficio.numero || "", destinatario: viewingOficio.destinatario, assunto: viewingOficio.assunto, conteudo: viewingOficio.conteudo, logoCamaraUrl: logoCamara, logoFabaoUrl: logoFabao, assinaturaUrl: assinaturaFabao });
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
