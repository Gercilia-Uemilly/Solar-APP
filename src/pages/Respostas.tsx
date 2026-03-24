import { useState, useCallback } from "react";
import { Heart, Copy, Sparkles, Loader2, Paperclip, Send, RefreshCw, Check, FileText, Image, Mic, Video, MessageSquare, Database, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FileDropzone from "@/components/FileDropzone";
import { DemandaAnexo } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function Respostas() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [descricao, setDescricao] = useState("");
  const [anexos, setAnexos] = useState<DemandaAnexo[]>([]);

  const [resposta, setResposta] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fontes, setFontes] = useState<{ scripts: number; base_info: number; respostas_anteriores: number } | null>(null);

  const temMidias = anexos.length > 0;
  const tiposMidias = [...new Set(anexos.map(a => {
    if (a.tipo.startsWith("image")) return "imagens";
    if (a.tipo.startsWith("audio")) return "áudios";
    if (a.tipo.startsWith("video")) return "vídeos";
    return "documentos";
  }))].join(", ");

  const handleAnalyzeFile = useCallback(async (file: File) => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const fileType = file.type.startsWith("image") ? "image"
        : file.type.startsWith("audio") ? "audio"
        : file.type.startsWith("video") ? "video" : "document";
      formData.append("fileType", fileType);

      const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
      if (error) throw error;

      if (data?.text) {
        setDescricao(prev => prev ? `${prev}\n\n[Conteúdo extraído de ${file.name}]:\n${data.text}` : data.text);
        toast({ title: "Mídia analisada", description: `Conteúdo de "${file.name}" extraído com sucesso.` });
      }
    } catch (e: any) {
      toast({ title: "Erro ao analisar mídia", description: e.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  }, [toast]);

  const handleGenerate = async () => {
    if (!descricao.trim()) {
      toast({ title: "Dados insuficientes", description: "Descreva a demanda do cidadão.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    setFontes(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-resposta", {
        body: {
          descricao: descricao || null,
          tem_midias: temMidias,
          tipos_midias: tiposMidias || null,
        },
      });
      if (error) throw error;
      if (data?.resposta) {
        setResposta(data.resposta);
        if (data.fontes) setFontes(data.fontes);

        // Warn if no internal data
        if (data.fontes && data.fontes.scripts === 0 && data.fontes.base_info === 0) {
          toast({
            title: "⚠️ Banco interno vazio",
            description: "Cadastre scripts e informações para melhorar as sugestões.",
          });
        } else {
          toast({ title: "💬 Resposta gerada!", description: "Baseada no material interno do gabinete." });
        }
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar resposta", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(resposta);
    setCopied(true);
    toast({ title: "Copiado!", description: "Resposta copiada para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const encoded = encodeURIComponent(resposta);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleReset = () => {
    setDescricao("");
    setAnexos([]);
    setResposta("");
    setFontes(null);
  };

  const midiaIcons = () => {
    const icons: React.ReactNode[] = [];
    if (anexos.some(a => a.tipo.startsWith("image"))) icons.push(<Image key="img" size={14} />);
    if (anexos.some(a => a.tipo.startsWith("audio"))) icons.push(<Mic key="aud" size={14} />);
    if (anexos.some(a => a.tipo.startsWith("video"))) icons.push(<Video key="vid" size={14} />);
    if (anexos.some(a => !a.tipo.startsWith("image") && !a.tipo.startsWith("audio") && !a.tipo.startsWith("video"))) icons.push(<FileText key="doc" size={14} />);
    return icons;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Heart className="text-primary" size={24} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Respostas ao Cidadão</h1>
          <p className="text-sm text-muted-foreground">Gere respostas baseadas nos scripts e banco de informações do gabinete</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                Demanda do Cidadão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Mensagem do cidadão</label>
                <Textarea
                  rows={7}
                  placeholder="Cole ou digite a mensagem completa do cidadão aqui... A IA vai analisar usando os scripts e banco de informações cadastrados."
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="resize-none"
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Paperclip size={12} /> Mídias Anexadas
                  {temMidias && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      {anexos.length} {midiaIcons()}
                    </Badge>
                  )}
                </label>
                <FileDropzone
                  anexos={anexos}
                  onChange={setAnexos}
                  onFileAdded={handleAnalyzeFile}
                />
                {analyzing && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <Loader2 size={12} className="animate-spin" /> Analisando mídia...
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleGenerate} disabled={generating} className="flex-1 gap-2">
                  {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {generating ? "Gerando..." : "Gerar Resposta"}
                </Button>
                <Button variant="outline" onClick={handleReset} title="Limpar tudo">
                  <RefreshCw size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Response */}
        <div className="space-y-4">
          <Card className="border-border min-h-[400px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" />
                Resposta Sugerida
                {resposta && <Badge variant="secondary" className="text-[10px] gap-1"><Sparkles size={10} /> IA</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                {resposta ? (
                  <motion.div
                    key="response"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col gap-3"
                  >
                    {/* Source indicator */}
                    {fontes && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Database size={12} className="text-primary" />
                          Resposta gerada com base em:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={fontes.scripts > 0 ? "default" : "outline"} className="text-[10px] gap-1">
                            {fontes.scripts > 0 ? "✅" : "⚠️"} {fontes.scripts} scripts
                          </Badge>
                          <Badge variant={fontes.base_info > 0 ? "default" : "outline"} className="text-[10px] gap-1">
                            {fontes.base_info > 0 ? "✅" : "⚠️"} {fontes.base_info} informações
                          </Badge>
                          <Badge variant={fontes.respostas_anteriores > 0 ? "default" : "outline"} className="text-[10px] gap-1">
                            {fontes.respostas_anteriores > 0 ? "✅" : "—"} {fontes.respostas_anteriores} respostas anteriores
                          </Badge>
                        </div>
                        {fontes.scripts === 0 && fontes.base_info === 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <AlertTriangle size={12} className="text-yellow-500" />
                            <span className="text-[11px] text-muted-foreground">
                              Banco interno vazio.{" "}
                              <button
                                onClick={() => navigate("/banco-informacoes")}
                                className="text-primary underline hover:no-underline"
                              >
                                Cadastrar scripts agora
                              </button>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <Textarea
                      value={resposta}
                      onChange={e => setResposta(e.target.value)}
                      className="flex-1 min-h-[220px] resize-none text-sm leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleCopy} variant="outline" className="flex-1 gap-2">
                        {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                        {copied ? "Copiado!" : "Copiar"}
                      </Button>
                      <Button onClick={handleWhatsAppShare} variant="outline" className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950">
                        <Send size={16} /> WhatsApp
                      </Button>
                      <Button onClick={handleGenerate} variant="ghost" disabled={generating} title="Regenerar">
                        {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground py-10"
                  >
                    <div className="p-4 rounded-full bg-muted/50">
                      <MessageSquare size={32} className="text-muted-foreground/50" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Nenhuma resposta gerada</p>
                      <p className="text-xs mt-1 max-w-[280px]">
                        Cole a mensagem do cidadão e clique em "Gerar Resposta". A IA vai criar uma mensagem personalizada baseada nos scripts e no banco de informações cadastrados.
                      </p>
                    </div>
                    <div className="mt-4 space-y-2 text-left w-full max-w-[340px]">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Exemplo de resposta:</p>
                      <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground/80 italic leading-relaxed">
                        "Bom dia, Maria! Recebi sua mensagem e as fotos da Rua Oscar Alvim. Entendi perfeitamente sua preocupação com os buracos. Já registrei como protocolo 45-2026. Vou encaminhar pra Secretaria de Obras e assim que tiver retorno volto a falar com você, ok?"
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
