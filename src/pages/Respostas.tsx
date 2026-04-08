import { useState, useCallback, useEffect } from "react";
import {
  Heart, Copy, Sparkles, Loader2, Send, RefreshCw, Check,
  Mic, MessageSquare, Database, AlertTriangle, ChevronRight,
  ChevronLeft, User, Phone, FileText, Search, Clock, Trash2,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";



interface Atendimento {
  id: string;
  cidadao_nome: string;
  canal: string;
  descricao_original: string | null;
  resumo_demanda: string | null;
  resposta_gerada: string | null;
  resposta_editada: string | null;
  fontes: any;
  created_at: string;
  user_id: string;
}

export default function Respostas() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // === Step wizard state ===
  const [step, setStep] = useState(1);
  const [cidadaoNome, setCidadaoNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [resumo, setResumo] = useState("");
  const [resposta, setResposta] = useState("");
  const [fontes, setFontes] = useState<any>(null);

  // Loading states
  const [transcribing, setTranscribing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // History
  const [historico, setHistorico] = useState<Atendimento[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("novo");

  // File upload ref
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // === Load history ===
  const loadHistorico = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setHistorico((data as Atendimento[]) || []);
    } catch (e: any) {
      console.error("Erro ao carregar histórico:", e);
    } finally {
      setLoadingHistorico(false);
    }
  }, []);

  useEffect(() => {
    loadHistorico();

    const channel = supabase
      .channel("atendimentos-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "atendimentos" }, () => {
        loadHistorico();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadHistorico]);

  // === Step 2: Transcribe ===
  const handleTranscribe = async () => {
    if (!selectedFile) {
      toast({ title: "Selecione um arquivo", description: "Suba um áudio ou vídeo primeiro.", variant: "destructive" });
      return;
    }
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const fileType = selectedFile.type.startsWith("audio") ? "audio" : "video";
      formData.append("fileType", fileType);

      const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
      if (error) throw error;

      if (data?.text) {
        setDescricao(prev => prev ? `${prev}\n\n${data.text}` : data.text);
        toast({ title: "✅ Transcrição concluída", description: "Texto extraído e inserido no campo." });
      }
    } catch (e: any) {
      toast({ title: "Erro na transcrição", description: e.message, variant: "destructive" });
    } finally {
      setTranscribing(false);
    }
  };

  // === Step 2: Summarize ===
  const handleSummarize = async () => {
    if (!descricao.trim()) {
      toast({ title: "Campo vazio", description: "Transcreva ou digite a demanda primeiro.", variant: "destructive" });
      return;
    }
    setSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-demanda", {
        body: { descricao },
      });
      if (error) throw error;
      if (data?.resumo) {
        setResumo(data.resumo);
        toast({ title: "✅ Demanda resumida" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao resumir", description: e.message, variant: "destructive" });
    } finally {
      setSummarizing(false);
    }
  };

  // === Step 3: Generate response ===
  const handleGenerate = async () => {
    if (!descricao.trim() && !resumo.trim()) {
      toast({ title: "Dados insuficientes", description: "Descreva ou resuma a demanda primeiro.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setFontes(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-resposta", {
        body: {
          descricao: resumo || descricao,
          solicitante: cidadaoNome || null,
        },
      });
      if (error) throw error;
      if (data?.resposta) {
        setResposta(data.resposta);
        if (data.fontes) setFontes(data.fontes);
        toast({ title: "💬 Resposta gerada!" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar resposta", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // === Save atendimento ===
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("atendimentos").insert({
        user_id: user.id,
        cidadao_nome: cidadaoNome || "Não identificado",
        canal: "WhatsApp",
        descricao_original: descricao || null,
        resumo_demanda: resumo || null,
        resposta_gerada: resposta || null,
        resposta_editada: resposta || null,
        fontes: fontes || null,
      });
      if (error) throw error;

      toast({ title: "✅ Atendimento salvo!", description: "Registro disponível no histórico para todos os operadores." });
      handleReset();
      setActiveTab("historico");
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resposta);
    setCopied(true);
    toast({ title: "Copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(resposta)}`, "_blank");
  };

  const handleReset = () => {
    setStep(1);
    setCidadaoNome("");
    setDescricao("");
    setResumo("");
    setResposta("");
    setFontes(null);
    setSelectedFile(null);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("atendimentos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Atendimento excluído" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  // Filtered history
  const filteredHistorico = historico.filter(a => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      a.cidadao_nome?.toLowerCase().includes(s) ||
      a.canal?.toLowerCase().includes(s) ||
      a.resumo_demanda?.toLowerCase().includes(s) ||
      a.resposta_editada?.toLowerCase().includes(s)
    );
  });

  // === Step indicators ===
  const steps = [
    { num: 1, label: "Demanda", icon: Mic },
    { num: 2, label: "Resposta", icon: MessageSquare },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Heart className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Respostas ao Cidadão</h1>
          <p className="text-sm text-muted-foreground">Atendimento em 2 passos com IA do gabinete</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="novo" className="gap-1.5"><Sparkles size={14} /> Novo</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5"><Clock size={14} /> Histórico</TabsTrigger>
        </TabsList>

        {/* ======================== NOVO ATENDIMENTO ======================== */}
        <TabsContent value="novo" className="space-y-5 mt-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 justify-center">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center gap-2">
                <button
                  onClick={() => { if (s.num < step) setStep(s.num); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    step === s.num
                      ? "bg-primary text-primary-foreground"
                      : step > s.num
                        ? "bg-primary/20 text-primary cursor-pointer"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <s.icon size={12} />
                  {s.label}
                </button>
                {i < steps.length - 1 && <ChevronRight size={14} className="text-muted-foreground" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ──── PASSO 1: Demanda ──── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mic size={16} className="text-primary" />
                      Passo 2 — Demanda do Cidadão
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* File upload */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                        <Upload size={12} /> Áudio ou vídeo (opcional)
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="flex-1 cursor-pointer">
                          <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                            {selectedFile ? (
                              <p className="text-sm text-foreground font-medium">{selectedFile.name}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground">Clique para selecionar áudio ou vídeo</p>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="audio/*,video/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) setSelectedFile(file);
                            }}
                          />
                        </label>
                        {selectedFile && (
                          <Button onClick={handleTranscribe} disabled={transcribing} variant="outline" className="gap-2 shrink-0">
                            {transcribing ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                            Transcrever
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Descrição */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição da demanda</label>
                      <Textarea
                        rows={6}
                        placeholder="O texto da transcrição aparece aqui, ou cole/digite a demanda do cidadão..."
                        value={descricao}
                        onChange={e => setDescricao(e.target.value)}
                        className="resize-none"
                      />
                    </div>

                    {/* Summarize */}
                    <Button onClick={handleSummarize} disabled={summarizing || !descricao.trim()} variant="secondary" className="gap-2 w-full">
                      {summarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      Resumir Demanda
                    </Button>

                    {resumo && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs font-semibold text-primary mb-1">Resumo da IA:</p>
                        <p className="text-sm text-foreground leading-relaxed">{resumo}</p>
                      </div>
                    )}

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                        <ChevronLeft size={16} /> Voltar
                      </Button>
                      <Button onClick={() => setStep(3)} disabled={!descricao.trim()} className="gap-2">
                        Próximo <ChevronRight size={16} />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ──── PASSO 3: Resposta ──── */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare size={16} className="text-primary" />
                      Passo 3 — Resposta ao Cidadão
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Context summary */}
                    <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                      <p><span className="font-semibold text-foreground">Cidadão:</span> {cidadaoNome || "Não identificado"}</p>
                      <p><span className="font-semibold text-foreground">Canal:</span> {canal}</p>
                      {resumo && <p><span className="font-semibold text-foreground">Resumo:</span> {resumo}</p>}
                    </div>

                    {/* Generate button */}
                    {!resposta && (
                      <Button onClick={handleGenerate} disabled={generating} className="gap-2 w-full">
                        {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {generating ? "Gerando..." : "Gerar Resposta"}
                      </Button>
                    )}

                    {/* Response */}
                    {resposta && (
                      <>
                        {/* Source indicator */}
                        {fontes && (
                          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Database size={12} className="text-primary" />
                              Fontes usadas:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={fontes.scripts > 0 ? "default" : "outline"} className="text-[10px]">
                                {fontes.scripts} scripts
                              </Badge>
                              <Badge variant={fontes.base_info > 0 ? "default" : "outline"} className="text-[10px]">
                                {fontes.base_info} informações
                              </Badge>
                            </div>
                            {fontes.scripts === 0 && fontes.base_info === 0 && (
                              <div className="flex items-center gap-2 mt-1">
                                <AlertTriangle size={12} className="text-yellow-500" />
                                <span className="text-[11px] text-muted-foreground">
                                  Banco vazio.{" "}
                                  <button onClick={() => navigate("/banco-informacoes")} className="text-primary underline">
                                    Cadastrar scripts
                                  </button>
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        <Textarea
                          value={resposta}
                          onChange={e => setResposta(e.target.value)}
                          className="min-h-[180px] resize-none text-sm leading-relaxed"
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handleCopy} variant="outline" className="gap-2 flex-1">
                            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            {copied ? "Copiado!" : "Copiar"}
                          </Button>
                          <Button onClick={handleWhatsApp} variant="outline" className="gap-2 text-green-600">
                            <Send size={14} /> WhatsApp
                          </Button>
                          <Button onClick={handleGenerate} variant="ghost" disabled={generating} title="Regenerar">
                            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </Button>
                        </div>

                        <Button onClick={handleSave} disabled={saving} className="w-full gap-2 mt-2">
                          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Salvar Atendimento
                        </Button>
                      </>
                    )}

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                        <ChevronLeft size={16} /> Voltar
                      </Button>
                      <Button variant="ghost" onClick={handleReset} className="gap-2 text-muted-foreground">
                        <RefreshCw size={14} /> Limpar tudo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ======================== HISTÓRICO ======================== */}
        <TabsContent value="historico" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, canal, resumo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="secondary">{filteredHistorico.length} registros</Badge>
          </div>

          {loadingHistorico ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 size={16} className="animate-spin" /> Carregando...
            </div>
          ) : filteredHistorico.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">Nenhum atendimento encontrado</p>
              <p className="text-xs mt-1">Os atendimentos salvos aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistorico.map(a => (
                <Card key={a.id} className="border-border">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-primary" />
                        <span className="font-semibold text-sm text-foreground">{a.cidadao_nome}</span>
                        <Badge variant="outline" className="text-[10px]">{a.canal}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(a.id)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                    {a.resumo_demanda && (
                      <p className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                        <span className="font-semibold">Resumo:</span> {a.resumo_demanda}
                      </p>
                    )}
                    {a.resposta_editada && (
                      <p className="text-xs text-foreground bg-primary/5 rounded p-2 leading-relaxed">
                        {a.resposta_editada}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
