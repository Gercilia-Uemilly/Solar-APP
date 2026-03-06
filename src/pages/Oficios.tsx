import { useRef, useState, useEffect, useCallback, ChangeEvent } from "react";
import { Plus, Search, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2, Landmark, FileText, Download, Eye, Trash2, Calendar, User, MapPin, Phone, Mic, ImagePlus, X, FileAudio, Image, Pencil, Upload, CloudUpload, Paperclip, Lightbulb, ArrowRight, Video, FileUp, Undo2, Redo2 } from "lucide-react";
import PreviewFormatToolbar, { FormatOptions, defaultFormatOptions } from "@/components/PreviewFormatToolbar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import ImageUploader from "@/components/ImageUploader";
import RichTextEditor from "@/components/RichTextEditor";
import FileDropzone from "@/components/FileDropzone";
import type { DemandaAnexo } from "@/types";
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
  const [originalOficio, setOriginalOficio] = useState("");
  const [editedResposta, setEditedResposta] = useState("");

  // Multi-file processing state
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<{ file: File; type: string; status: "pending" | "processing" | "done" | "error"; text?: string }[]>([]);
  const [processedResults, setProcessedResults] = useState<{ type: string; text: string; fileName: string }[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingOficioId, setEditingOficioId] = useState<string | null>(null);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(defaultFormatOptions);
  const [anexoImages, setAnexoImages] = useState<File[]>([]);
  const [anexos, setAnexos] = useState<DemandaAnexo[]>([]);

  // Version history for undo/redo
  const [oficioHistory, setOficioHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smart suggestions state
  const [suggestions, setSuggestions] = useState<OficioRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [appliedSuggestionId, setAppliedSuggestionId] = useState<string | null>(null);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchSimilarOficios = useCallback((query: string) => {
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestionTimeoutRef.current = setTimeout(() => {
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (words.length === 0) { setSuggestions([]); setShowSuggestions(false); return; }
      const matches = oficios
        .filter(o => o.conteudo && o.id !== editingOficioId)
        .map(o => {
          const text = `${o.assunto} ${o.destinatario} ${o.bairro || ""} ${o.solicitante || ""} ${(o as any).tipo_demanda || ""}`.toLowerCase();
          const score = words.reduce((acc, w) => acc + (text.includes(w) ? 1 : 0), 0);
          return { ...o, score };
        })
        .filter(o => (o as any).score >= Math.max(1, Math.floor(words.length * 0.3)))
        .sort((a, b) => (b as any).score - (a as any).score)
        .slice(0, 3) as OficioRow[];
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }, 400);
  }, [oficios, editingOficioId]);

  const applySuggestion = (o: OficioRow) => {
    if (!destinatario && o.destinatario) setDestinatario(o.destinatario);
    if (!cargoDestinatario && o.cargo_destinatario) setCargoDestinatario(o.cargo_destinatario);
    if (!secretaria && (o as any).secretaria_identificada) setSecretaria((o as any).secretaria_identificada);
    if (!bairro && o.bairro) setBairro(o.bairro);
    if (!assunto && o.assunto) setAssunto(o.assunto);
    if (!tipoServico && (o as any).tipo_demanda) setTipoServico((o as any).tipo_demanda);
    setAppliedSuggestionId(o.id);
    setShowSuggestions(false);
    toast({ title: "✨ Sugestão aplicada!", description: `Dados preenchidos com base no ofício nº ${o.numero || "s/n"}.` });
  };

  // ── Version history helpers ──────────────────────────────────────────────
  const pushToHistory = useCallback((text: string) => {
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = setTimeout(() => {
      setOficioHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1);
        // Don't push if same as last entry
        if (trimmed.length > 0 && trimmed[trimmed.length - 1] === text) return prev;
        const updated = [...trimmed, text].slice(-50); // keep max 50 versions
        setHistoryIndex(updated.length - 1);
        return updated;
      });
    }, 600);
  }, [historyIndex]);

  const handleOficioChange = useCallback((text: string) => {
    setEditedOficio(text);
    pushToHistory(text);
  }, [pushToHistory]);

  const undoOficio = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    setEditedOficio(oficioHistory[newIdx]);
  }, [historyIndex, oficioHistory]);

  const redoOficio = useCallback(() => {
    if (historyIndex >= oficioHistory.length - 1) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    setEditedOficio(oficioHistory[newIdx]);
  }, [historyIndex, oficioHistory]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoOficio();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redoOficio();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoOficio, redoOficio]);

  // Generate solicitante code from user name+email
  const generateSolicitanteCode = useCallback(() => {
    if (!user) return "USR";
    const name = user.user_metadata?.full_name || "";
    const email = user.email || "";
    // Take initials from name (up to 3 chars) + first 2 chars of email
    const initials = name.split(/\s+/).map((w: string) => w[0]?.toUpperCase() || "").join("").slice(0, 3);
    const emailCode = email.replace(/@.*/, "").slice(0, 2).toUpperCase();
    return (initials || emailCode || "USR");
  }, [user]);

  // Helpers to convert between HTML and plain text for the ofício
  const plainToHtml = (text: string) => {
    if (!text) return "";
    return text.split("\n").filter(p => p.trim()).map(p => `<p>${p}</p>`).join("");
  };
  const htmlToPlain = (html: string) => {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return Array.from(div.querySelectorAll("p, div, li, h1, h2, h3"))
      .map(el => el.textContent?.trim() || "")
      .filter(Boolean)
      .join("\n") || div.textContent?.trim() || "";
  };

  // Fetch oficios
  const fetchOficios = async () => {
    setLoading(true);
    const { data } = await supabase.from("oficios").select("*").order("created_at", { ascending: false });
    setOficios((data as unknown as OficioRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchOficios(); }, []);

  // Auto-generate next sequential number with format: NUM/YEAR/CODE
  const generateNextNumero = () => {
    const year = new Date().getFullYear();
    const code = generateSolicitanteCode();
    const existingNumbers = oficios
      .map(o => o.numero)
      .filter(Boolean)
      .map(n => {
        const match = n!.match(/^(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${nextNum}/${year}/${code}`;
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

  // Trigger smart suggestions when assunto or descricao changes
  useEffect(() => {
    const query = `${assunto} ${descricao}`.trim();
    searchSimilarOficios(query);
  }, [assunto, descricao, searchSimilarOficios]);

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
      const oficioText = data.oficio || "";
      setEditedOficio(oficioText);
      setOriginalOficio(oficioText);
      setOficioHistory([oficioText]);
      setHistoryIndex(0);
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

  const handleEdit = (o: OficioRow) => {
    setEditingOficioId(o.id);
    setNumero(o.numero || "");
    setDataGeracao(o.data_geracao || new Date().toISOString().split("T")[0]);
    setAssunto(o.assunto || "");
    setDestinatario(o.destinatario || "");
    setCargoDestinatario(o.cargo_destinatario || "");
    setLocalDemanda(o.local_demanda || "");
    setBairro(o.bairro || "");
    setSolicitante(o.solicitante || "");
    setContatoSolicitante(o.contato_solicitante || "");
    const content = o.conteudo || "";
    setEditedOficio(content);
    setOriginalOficio(content);
    setOficioHistory(content ? [content] : []);
    setHistoryIndex(content ? 0 : -1);
    setEditedResposta(o.resposta_cidadao || "");
    setDescricao("");
    setPrioridade("Normal");
    setLinhaTelefonica("");
    setFormTab("dados");
    setShowDialog(true);
  };

  const handleCreate = async () => {
    if (!user) return;
    const payload = {
      numero: numero || null,
      assunto: assunto || aiResult?.tipo_demanda || "Sem assunto",
      destinatario: destinatario || aiResult?.secretaria_identificada || "A definir",
      status: aiResult ? "Gerado" : "Rascunho",
      conteudo: editedOficio || null,
      resposta_cidadao: editedResposta || null,
      secretaria_identificada: aiResult?.secretaria_identificada || secretaria || null,
      tipo_demanda: aiResult?.tipo_demanda || tipoServico || null,
      urgencia: aiResult?.urgencia || (prioridade === "Urgente" ? "urgente" : "normal"),
      linha_telefonica: linhaTelefonica || null,
      operador_nome: user.user_metadata?.full_name || user.email || null,
      cargo_destinatario: cargoDestinatario || null,
      local_demanda: localDemanda || null,
      bairro: bairro || null,
      solicitante: solicitante || null,
      contato_solicitante: contatoSolicitante || null,
      data_geracao: dataGeracao || null,
    };

    let error;
    if (editingOficioId) {
      ({ error } = await supabase.from("oficios").update(payload).eq("id", editingOficioId));
    } else {
      ({ error } = await supabase.from("oficios").insert({ ...payload, author_id: user.id }));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    await fetchOficios();
    resetForm();
    toast({ title: editingOficioId ? "Ofício atualizado!" : "Ofício salvo!" });
  };

  const getFileMediaType = (file: File): "image" | "audio" | "video" => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return "audio";
  };

  const handleMultiFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const queue = fileArray.map(f => ({ file: f, type: getFileMediaType(f), status: "pending" as const, text: undefined as string | undefined }));
    setProcessingQueue(queue);
    setIsProcessingFiles(true);

    const results: { type: string; text: string; fileName: string }[] = [];

    // Process files in parallel (max 3 at a time)
    const processFile = async (idx: number) => {
      const item = queue[idx];
      setProcessingQueue(prev => prev.map((p, i) => i === idx ? { ...p, status: "processing" } : p));

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("type", item.type);

        const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
        if (error) throw error;

        const text = data.text || "";
        results.push({ type: item.type, text, fileName: item.file.name });
        setProcessingQueue(prev => prev.map((p, i) => i === idx ? { ...p, status: "done", text } : p));

        // If image, also add to anexoImages for document attachment
        if (item.type === "image") {
          setAnexoImages(prev => [...prev, item.file]);
        }
      } catch (err: any) {
        setProcessingQueue(prev => prev.map((p, i) => i === idx ? { ...p, status: "error" } : p));
        toast({ title: `Erro ao processar ${item.file.name}`, description: err.message || "Tente novamente.", variant: "destructive" });
      }
    };

    // Process in batches of 3
    for (let i = 0; i < queue.length; i += 3) {
      const batch = queue.slice(i, i + 3).map((_, j) => processFile(i + j));
      await Promise.all(batch);
    }

    setProcessedResults(prev => [...prev, ...results]);
    setIsProcessingFiles(false);

    if (results.length > 0) {
      toast({
        title: `✅ ${results.length} arquivo(s) processado(s)!`,
        description: "Revise o conteúdo extraído e insira na descrição.",
      });
    }

    if (mediaInputRef.current) mediaInputRef.current.value = "";
  };

  const confirmAllProcessedTexts = () => {
    const combined = processedResults.map(r => {
      const label = r.type === "image" ? "📷 Imagem" : r.type === "video" ? "🎬 Vídeo" : "🎤 Áudio";
      return `[${label}: ${r.fileName}]\n${r.text}`;
    }).join("\n\n---\n\n");
    setDescricao(prev => prev ? prev + "\n\n" + combined : combined);
    setProcessedResults([]);
    setProcessingQueue([]);
    toast({ title: "Conteúdo inserido na descrição!" });
  };

  const resetForm = () => {
    setShowDialog(false);
    setEditingOficioId(null);
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
    setOriginalOficio("");
    setEditedResposta("");
    setOficioHistory([]);
    setHistoryIndex(-1);
    setProcessedResults([]);
    setProcessingQueue([]);
    setAnexoImages([]);
    setAnexos([]);
    setSuggestions([]);
    setShowSuggestions(false);
    setAppliedSuggestionId(null);
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

  const [isUploading, setIsUploading] = useState(false);

  const handleUploadToDrive = async (oficio: OficioRow) => {
    if (!oficio.conteudo) {
      toast({ title: "Sem conteúdo", description: "Gere o texto do ofício antes de enviar.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      // 1. Generate Word blob
      const wordBlob = await exportToWord({
        numero: oficio.numero || "",
        destinatario: oficio.destinatario,
        assunto: oficio.assunto,
        conteudo: oficio.conteudo,
        bairro: oficio.bairro || "",
        cargoDestinatario: oficio.cargo_destinatario || "",
        logoCamaraUrl: logoCamara,
        logoFabaoUrl: logoFabao,
        assinaturaUrl: assinaturaFabao,
      });

      const numeroArquivo = (oficio.numero || "rascunho").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_");
      const baseFileName = `Oficio_GVF_${numeroArquivo}`;

      // Upload DOCX directly (sem conversão PDF)
      const uploadBlob = wordBlob;
      const uploadFileName = `${baseFileName}.docx`;
      const uploadMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // 3. Upload to Drive + register in Sheets
      const driveFormData = new FormData();
      driveFormData.append("file", uploadBlob, uploadFileName);
      driveFormData.append("metadata", JSON.stringify({
        numero: oficio.numero || "",
        assunto: oficio.assunto,
        destinatario: oficio.destinatario,
        secretaria: (oficio as any).secretaria_identificada || "",
        bairro: oficio.bairro || "",
        solicitante: oficio.solicitante || "",
        contato_solicitante: oficio.contato_solicitante || "",
        tipo_demanda: (oficio as any).tipo_demanda || "",
        urgencia: (oficio as any).urgencia || "",
        operador: (oficio as any).operador_nome || user?.user_metadata?.full_name || user?.email || "",
        status: oficio.status,
      }));

      const driveResp = await fetch(`${supabaseUrl}/functions/v1/upload-to-drive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${supabaseKey}` },
        body: driveFormData,
      });

      if (!driveResp.ok) {
        const err = await driveResp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao enviar para o Drive");
      }

      const driveResult = await driveResp.json();

      // 4. Update oficio with drive link
      if (driveResult.driveLink) {
        await supabase.from("oficios").update({ link_pdf_drive: driveResult.driveLink }).eq("id", oficio.id);
        await fetchOficios();
      }

      toast({
        title: "✅ Enviado ao Drive!",
        description: "Arquivo enviado e registrado na planilha.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // ── Helper: build consistent export data from an OficioRow ─────────────────
  const buildExportData = (o: OficioRow) => ({
    numero: o.numero || "",
    destinatario: o.destinatario,
    assunto: o.assunto,
    conteudo: o.conteudo || "",
    bairro: o.bairro || "",
    cargoDestinatario: o.cargo_destinatario || "",
    dataGeracao: o.data_geracao || undefined,
    operadorNome: (o as any).operador_nome || user?.user_metadata?.full_name || user?.email || undefined,
    telefone: (o as any).linha_telefonica || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
  });

  // ── Helper: build export data from form state ─────────────────────────────
  const buildFormExportData = () => ({
    numero,
    destinatario,
    assunto,
    conteudo: editedOficio,
    bairro,
    cargoDestinatario,
    dataGeracao: dataGeracao || undefined,
    operadorNome: user?.user_metadata?.full_name || user?.email || undefined,
    telefone: linhaTelefonica || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
    imagens: anexoImages.length > 0 ? anexoImages : undefined,
  });

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
              <button onClick={() => handleEdit(o)} className="p-2 text-muted-foreground hover:text-primary" title="Editar"><Pencil size={16} /></button>
              <button onClick={() => { setViewingOficio(o); setShowPreviewDialog(true); }} className="p-2 text-muted-foreground hover:text-foreground" title="Visualizar"><Eye size={16} /></button>
              <button
                onClick={() => { if (o.conteudo) exportToWord(buildExportData(o)); }}
                className="p-2 text-muted-foreground hover:text-foreground"
                title="Exportar Word"
              >
                <FileText size={16} />
              </button>
              <button
                onClick={() => { if (o.conteudo) exportToPDF(buildExportData(o)); }}
                className="p-2 text-muted-foreground hover:text-foreground"
                title="Exportar PDF"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => handleUploadToDrive(o)}
                disabled={isUploading}
                className="p-2 text-muted-foreground hover:text-primary disabled:opacity-50"
                title="Enviar ao Drive + Planilha"
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
              </button>
              <button onClick={() => handleDelete(o.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Dialog with Tabs */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) resetForm(); else setShowDialog(true); }}>
        <DialogContent className="bg-card border-border !max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 overflow-y-auto p-6">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-foreground">{editingOficioId ? "Editar Ofício" : "Novo Ofício"}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Preencha os dados, revise o texto e salve o ofício.</DialogDescription>
            </div>
            {editingOficioId && (
              <Button variant="destructive" size="sm" onClick={async () => {
                await handleDelete(editingOficioId);
                resetForm();
              }}>
                <Trash2 size={14} className="mr-1" /> Excluir Ofício
              </Button>
            )}
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

              {/* Smart Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Lightbulb size={14} /> Sugestões baseadas em ofícios anteriores
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSuggestions(false)}>
                      <X size={14} />
                    </Button>
                  </div>
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="w-full text-left p-2.5 rounded-md bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          {s.numero ? `Ofício nº ${s.numero}` : "Ofício"} — {s.assunto?.slice(0, 60)}{(s.assunto?.length || 0) > 60 ? "…" : ""}
                        </span>
                        <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {s.destinatario && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s.destinatario}</span>}
                        {s.bairro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s.bairro}</span>}
                        {(s as any).tipo_demanda && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{(s as any).tipo_demanda}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {appliedSuggestionId && (
                <div className="flex items-center gap-2 p-2 bg-accent/30 rounded-lg text-xs text-accent-foreground">
                  <CheckCircle2 size={14} className="text-primary" />
                  <span>Sugestão aplicada. Campos preenchidos automaticamente.</span>
                  <Button variant="ghost" size="sm" className="h-5 text-xs ml-auto" onClick={() => setAppliedSuggestionId(null)}>
                    <X size={12} />
                  </Button>
                </div>
              )}


              {/* Multi-file media upload zone */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                  <FileUp size={12} /> Anexar Mídias (imagens, áudios, vídeos)
                </label>
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,audio/*,video/*"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleMultiFileUpload(e.target.files)}
                />
                <div
                  onClick={() => mediaInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={e => { e.preventDefault(); e.stopPropagation(); handleMultiFileUpload(e.dataTransfer.files); }}
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <div className="flex items-center justify-center gap-3 text-muted-foreground">
                    <ImagePlus size={18} />
                    <Mic size={18} />
                    <Video size={18} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Arraste ou clique para adicionar fotos, áudios ou vídeos
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Múltiplos arquivos simultâneos · A IA extrai e combina as informações
                  </p>
                </div>
              </div>

              {/* Processing queue */}
              {processingQueue.length > 0 && (
                <div className="space-y-1.5">
                  {processingQueue.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary text-sm">
                      {item.type === "image" ? <Image size={14} /> : item.type === "video" ? <Video size={14} /> : <FileAudio size={14} />}
                      <span className="flex-1 truncate text-xs text-foreground">{item.file.name}</span>
                      {item.status === "pending" && <span className="text-[10px] text-muted-foreground">Aguardando...</span>}
                      {item.status === "processing" && <Loader2 size={14} className="animate-spin text-primary" />}
                      {item.status === "done" && <CheckCircle2 size={14} className="text-primary" />}
                      {item.status === "error" && <AlertTriangle size={14} className="text-destructive" />}
                    </div>
                  ))}
                </div>
              )}

              {/* Processed results preview */}
              {processedResults.length > 0 && !isProcessingFiles && (
                <div className="space-y-2 p-3 bg-accent/30 rounded-lg border border-accent">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-primary" />
                      {processedResults.length} arquivo(s) processado(s)
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setProcessedResults([]); setProcessingQueue([]); }}>
                      <X size={14} />
                    </Button>
                  </div>
                  {processedResults.map((r, i) => (
                    <div key={i} className="bg-background/50 p-2 rounded border border-border">
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {r.type === "image" ? "📷" : r.type === "video" ? "🎬" : "🎤"} {r.fileName}
                      </span>
                      <div className="max-h-[80px] overflow-y-auto text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                        {r.text.slice(0, 300)}{r.text.length > 300 ? "…" : ""}
                      </div>
                    </div>
                  ))}
                  <Button size="sm" onClick={confirmAllProcessedTexts} className="w-full bg-primary text-primary-foreground">
                    <CheckCircle2 size={14} className="mr-1" /> Inserir tudo na descrição
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

              <ImageUploader images={anexoImages} onChange={setAnexoImages} />

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
                  <div className="flex gap-1 items-center">
                    <Button variant="ghost" size="sm" onClick={undoOficio} disabled={historyIndex <= 0} title="Desfazer (Ctrl+Z)">
                      <Undo2 size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={redoOficio} disabled={historyIndex >= oficioHistory.length - 1} title="Refazer (Ctrl+Y)">
                      <Redo2 size={14} />
                    </Button>
                    {oficioHistory.length > 1 && (
                      <span className="text-[10px] text-muted-foreground mx-1">
                        v{historyIndex + 1}/{oficioHistory.length}
                      </span>
                    )}
                    {editedOficio && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedOficio, "Ofício")}><Copy size={14} className="mr-1" /> Copiar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { handleOficioChange(""); }}><Trash2 size={14} className="mr-1" /> Limpar</Button>
                      </>
                    )}
                  </div>
                </div>
                <RichTextEditor
                  content={plainToHtml(editedOficio)}
                  onChange={(html) => handleOficioChange(htmlToPlain(html))}
                  placeholder="O texto será preenchido pela IA ou manualmente..."
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MessageSquare size={12} /> Resposta ao Cidadão</label>
                  {editedResposta && <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedResposta, "Resposta")}><Copy size={14} className="mr-1" /> Copiar</Button>}
                </div>
                <Textarea value={editedResposta} onChange={e => setEditedResposta(e.target.value)} placeholder="Sugestão de resposta ao cidadão..." className="bg-secondary border-border min-h-[150px] text-sm" />
              </div>

              {/* Anexos inline */}
              <div>
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                  <Paperclip size={12} /> Anexos do Ofício
                </label>
                <FileDropzone
                  anexos={anexos}
                  onChange={setAnexos}
                  onFileAdded={(file) => {
                    // Auto-process PDFs/images for text extraction
                    if (file.type === "application/pdf" || file.type.startsWith("image/")) {
                      const type = file.type.startsWith("image/") ? "image" : "audio";
                      // Could trigger analysis here if needed
                    }
                  }}
                />
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
              <PreviewFormatToolbar options={formatOptions} onChange={setFormatOptions} />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => {
                  if (!destinatario || !assunto || !editedOficio) {
                    alert("Preencha o destinatário, assunto e gere o texto do ofício antes de exportar.");
                    return;
                  }
                  exportToWord(buildFormExportData());
                }}>
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { await exportToPDF(buildFormExportData()); }}>
                  <Download size={14} className="mr-1" /> PDF
                </Button>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <OficioPreview ref={previewRef} numero={numero} destinatario={destinatario} assunto={assunto} conteudo={editedOficio} cargoDestinatario={cargoDestinatario} operadorNome={user?.user_metadata?.full_name || user?.email || undefined} formatOptions={formatOptions} editable onContentChange={setEditedOficio} initialConteudo={originalOficio} />
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
                <CheckCircle2 size={16} className="mr-1" /> {editingOficioId ? "Atualizar Ofício" : "Salvar Ofício"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="bg-card border-border !max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              <span>{viewingOficio?.assunto || "Ofício"}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  if (viewingOficio?.conteudo) exportToWord(buildExportData(viewingOficio));
                }}><FileText size={14} className="mr-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (viewingOficio?.conteudo) await exportToPDF(buildExportData(viewingOficio));
                }}><Download size={14} className="mr-1" /> PDF</Button>
                <Button size="sm" variant="outline" disabled={isUploading} onClick={() => { if (viewingOficio) handleUploadToDrive(viewingOficio); }}>
                  {isUploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <CloudUpload size={14} className="mr-1" />} Drive
                </Button>
              </div>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Visualize o conteúdo antes de exportar para Word ou PDF.</DialogDescription>
          </DialogHeader>
          {viewingOficio && (
            <div className="flex justify-center">
              <div id="oficio-view-preview" className="shadow-lg">
                <OficioPreview numero={viewingOficio.numero || ""} destinatario={viewingOficio.destinatario} assunto={viewingOficio.assunto} conteudo={viewingOficio.conteudo || ""} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
