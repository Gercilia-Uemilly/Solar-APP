import { useState, useCallback } from "react";
import { Heart, Copy, Sparkles, Loader2, Paperclip, Send, RefreshCw, Check, FileText, Image, Mic, Video, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import FileDropzone from "@/components/FileDropzone";
import { DemandaAnexo } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

const secretarias = [
  "Secretaria de Obras", "Secretaria de Meio Ambiente", "Iluminação Pública",
  "Secretaria de Saúde", "Secretaria de Educação", "Secretaria de Trânsito e Transportes",
  "Secretaria de Assistência Social", "DMAE", "CEMIG", "Outro",
];

const tiposDemanda = ["Solicitação", "Reclamação", "Denúncia", "Sugestão", "Informação"];
const urgencias = ["Normal", "Urgente", "Muito Urgente"];

export default function Respostas() {
  const { toast } = useToast();

  // Form fields
  const [solicitante, setSolicitante] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [bairro, setBairro] = useState("");
  const [local, setLocal] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const [tipoDemanda, setTipoDemanda] = useState("Solicitação");
  const [urgencia, setUrgencia] = useState("Normal");
  const [numero, setNumero] = useState("");
  const [destinatario, setDestinatario] = useState("");
  const [anexos, setAnexos] = useState<DemandaAnexo[]>([]);

  // Response state
  const [resposta, setResposta] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

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
    if (!descricao.trim() && !assunto.trim()) {
      toast({ title: "Dados insuficientes", description: "Preencha ao menos o assunto ou a descrição da demanda.", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-resposta", {
        body: {
          numero: numero || null,
          assunto: assunto || null,
          destinatario: destinatario || secretaria || null,
          descricao: descricao || null,
          solicitante: solicitante || null,
          bairro: bairro || null,
          local: local || null,
          secretaria: secretaria || null,
          tipo_demanda: tipoDemanda || null,
          urgencia: urgencia || null,
          tem_midias: temMidias,
          tipos_midias: tiposMidias || null,
        },
      });
      if (error) throw error;
      if (data?.resposta) {
        setResposta(data.resposta);
        toast({ title: "💬 Resposta gerada!", description: "Revise e edite antes de enviar." });
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
    setSolicitante(""); setAssunto(""); setDescricao(""); setBairro("");
    setLocal(""); setSecretaria(""); setTipoDemanda("Solicitação");
    setUrgencia("Normal"); setNumero(""); setDestinatario("");
    setAnexos([]); setResposta("");
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Heart className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Respostas ao Cidadão</h1>
            <p className="text-sm text-muted-foreground">Gere respostas naturais e acolhedoras com IA</p>
          </div>
        </div>

        {/* ZIP Import Button */}
        {isAdmin && (
          <div className="flex items-center gap-2">
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,.txt"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportWhatsApp(file);
              }}
            />
            <Button
              variant="outline"
              onClick={() => zipInputRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
              {importing ? "Importando..." : "Importar Conversas WhatsApp"}
            </Button>
            {whatsappCount !== null && (
              <Badge variant="secondary" className="text-xs gap-1">
                <MessageSquare size={12} /> {whatsappCount} trechos
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Info banner about WhatsApp conversations */}
      {isAdmin && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
          <MessageSquare size={18} className="text-primary mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Base de conversas WhatsApp</p>
            <p>Importe o arquivo ZIP das conversas exportadas do WhatsApp para alimentar o estilo das respostas. A IA usará essas conversas como referência principal de tom e linguagem.</p>
            <p className="mt-1 text-primary/70">WhatsApp → Conversa → ⋮ → Exportar conversa → Sem mídia → Enviar arquivo ZIP</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                Dados da Demanda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do Solicitante</label>
                  <Input placeholder="Ex: Maria Silva" value={solicitante} onChange={e => setSolicitante(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº Protocolo / Ofício</label>
                  <Input placeholder="Ex: 45-2026-MARIA123" value={numero} onChange={e => setNumero(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assunto</label>
                <Input placeholder="Ex: Buracos na Rua Oscar Alvim" value={assunto} onChange={e => setAssunto(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bairro</label>
                  <Input placeholder="Ex: Fundinho" value={bairro} onChange={e => setBairro(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Local</label>
                  <Input placeholder="Ex: Rua Oscar Alvim, 200" value={local} onChange={e => setLocal(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={tipoDemanda} onValueChange={setTipoDemanda}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {tiposDemanda.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Urgência</label>
                  <Select value={urgencia} onValueChange={setUrgencia}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {urgencias.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Secretaria</label>
                  <Select value={secretaria} onValueChange={setSecretaria}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {secretarias.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Demanda do Cidadão</label>
                <Textarea
                  rows={5}
                  placeholder="Cole ou digite a mensagem completa do cidadão aqui... A IA vai analisar o texto e gerar uma resposta personalizada."
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
                    <Textarea
                      value={resposta}
                      onChange={e => setResposta(e.target.value)}
                      className="flex-1 min-h-[280px] resize-none text-sm leading-relaxed"
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
                        Preencha os dados da demanda e clique em "Gerar Resposta". A IA vai criar uma mensagem personalizada baseada nas conversas reais do WhatsApp e no Banco de Informações.
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
