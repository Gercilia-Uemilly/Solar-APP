import { useRef, useState, useEffect, useCallback, ChangeEvent } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Search, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2, Landmark, FileText, Download, Eye, Trash2, Calendar, User, MapPin, Phone, Mic, ImagePlus, X, FileAudio, Image, Pencil, Upload, CloudUpload, Paperclip, Lightbulb, ArrowRight, Video, FileUp, Undo2, Redo2, Heart, Save } from "lucide-react";
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


const statusOptions = ["Rascunho", "Salvo", "Exportado", "Salvo no Drive", "Enviado", "Respondido", "Arquivado"];

const tiposServico = [
  { label: "Operação Tapa-Buracos / Pavimentação", secretaria: "Secretaria Municipal de Infraestrutura Urbana", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Obras e Infraestrutura" },
  { label: "Iluminação Pública", secretaria: "Secretaria Municipal de Serviços Urbanos", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Serviços Urbanos" },
  { label: "Sinalização / Semáforos / Trânsito", secretaria: "Secretaria Municipal de Trânsito e Transportes", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Trânsito e Transportes (SETTRAN)" },
  { label: "Transporte Público / Ônibus", secretaria: "Secretaria Municipal de Trânsito e Transportes", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Trânsito e Transportes (SETTRAN)" },
  { label: "Limpeza Urbana / Capina / Roçada", secretaria: "Secretaria Municipal de Serviços Urbanos", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Serviços Urbanos" },
  { label: "Saúde / UBS / UAI", secretaria: "Secretaria Municipal de Saúde", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Saúde" },
  { label: "Educação / Escolas", secretaria: "Secretaria Municipal de Educação", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Educação" },
  { label: "Água / Esgoto / DMAE", secretaria: "DMAE", cargo: "Ilmo(a). Sr(a). Diretor(a) Geral do DMAE" },
  { label: "Assistência Social / CRAS", secretaria: "Secretaria Municipal de Desenvolvimento Social", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Assistência Social" },
  { label: "Meio Ambiente / Poda / Praças", secretaria: "Secretaria Municipal de Gestão Ambiental e Sustentabilidade", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Meio Ambiente e Sustentabilidade" },
  { label: "Habitação / Casas Populares", secretaria: "Secretaria Municipal de Habitação", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Habitação" },
  { label: "Segurança / Videomonitoramento", secretaria: "Secretaria Municipal de Segurança Integrada", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Segurança Integrada" },
  { label: "Esporte / Poliesportivos / FUTEL", secretaria: "FUTEL", cargo: "Ilmo(a). Sr(a). Presidente da FUTEL" },
  { label: "Cultura / Turismo / Eventos", secretaria: "Secretaria Municipal de Cultura e Turismo", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Cultura e Turismo" },
  { label: "Fiscalização de Obras", secretaria: "Secretaria Municipal de Planejamento Urbano", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Planejamento Urbano" },
  { label: "Agronegócio / Estradas Rurais", secretaria: "Secretaria Municipal de Agronegócio", cargo: "Ilmo(a). Sr(a). Secretário(a) Municipal de Agronegócio" },
  { label: "PROCON / Defesa do Consumidor", secretaria: "PROCON", cargo: "Ilmo(a). Sr(a). Superintendente do PROCON" },
  { label: "Outro", secretaria: "", cargo: "" },
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
  ano: number | null;
}

export default function Oficios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

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
  const [codigoZ, setCodigoZ] = useState("");
  const [origemOficio, setOrigemOficio] = useState("WhatsApp Gabinete");
  const [linhaTelefonica, setLinhaTelefonica] = useState("");
  const [formTab, setFormTab] = useState("dados");
  const [userPhones, setUserPhones] = useState<string[]>([]);
  const [profileName, setProfileName] = useState<string>("");

  // AI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingResposta, setIsGeneratingResposta] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [editedOficio, setEditedOficio] = useState("");
  const [originalOficio, setOriginalOficio] = useState("");
  const [editedResposta, setEditedResposta] = useState("");

  // Multi-file processing state
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<{ file: File; type: string; status: "pending" | "processing" | "done" | "error"; text?: string }[]>([]);
  const [processedResults, setProcessedResults] = useState<{ type: string; text: string; fileName: string; storageUrl?: string }[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingOficioId, setEditingOficioId] = useState<string | null>(null);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(defaultFormatOptions);
  const [anexoImages, setAnexoImages] = useState<File[]>([]);
  const [anexoImageUrls, setAnexoImageUrls] = useState<string[]>([]);
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

  // Knowledge base suggestions
  const [kbSuggestions, setKbSuggestions] = useState<{ id: string; titulo: string; descricao: string | null; orgao: string | null; bairro: string | null; fonte: string | null; modelo: boolean }[]>([]);

  const searchSimilarOficios = useCallback(async (query: string) => {
    if (suggestionTimeoutRef.current) clearTimeout(suggestionTimeoutRef.current);
    if (!query || query.length < 3) {
      setSuggestions([]);
      setKbSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    suggestionTimeoutRef.current = setTimeout(async () => {
      const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (words.length === 0) { setSuggestions([]); setKbSuggestions([]); setShowSuggestions(false); return; }

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

      const searchTerm = words.slice(0, 3).join(" ");
      const { data: kbData } = await supabase
        .from("base_conhecimento" as any)
        .select("id, titulo, descricao, orgao, bairro, fonte, modelo")
        .or(`titulo.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`)
        .order("modelo", { ascending: false })
        .limit(3);

      const kbMatches = (kbData as any[] || []);
      setKbSuggestions(kbMatches);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0 || kbMatches.length > 0);
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
    if (user) {
      supabase.from("suggestion_interactions" as any).insert({ user_id: user.id, source_type: "oficio", source_id: o.id, action: "accepted", context_assunto: assunto, context_bairro: bairro }).then(() => {});
    }
    toast({ title: "✨ Sugestão aplicada!", description: `Dados preenchidos com base no ofício nº ${o.numero || "s/n"}.` });
  };

  const applyKbSuggestion = (kb: any) => {
    if (!destinatario && kb.orgao) setDestinatario(kb.orgao);
    if (!bairro && kb.bairro) setBairro(kb.bairro);
    if (!assunto && kb.titulo) setAssunto(kb.titulo);
    setAppliedSuggestionId(kb.id);
    setShowSuggestions(false);
    if (user) {
      supabase.from("suggestion_interactions" as any).insert({ user_id: user.id, source_type: "base_conhecimento", source_id: kb.id, action: "accepted", context_assunto: assunto, context_bairro: bairro }).then(() => {});
    }
    toast({ title: "✨ Sugestão da base aplicada!", description: `Dados preenchidos com "${kb.titulo}".` });
  };

  // ── Version history helpers ──────────────────────────────────────────────
  const pushToHistory = useCallback((text: string) => {
    if (historyTimeoutRef.current) clearTimeout(historyTimeoutRef.current);
    historyTimeoutRef.current = setTimeout(() => {
      setOficioHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1);
        if (trimmed.length > 0 && trimmed[trimmed.length - 1] === text) return prev;
        const updated = [...trimmed, text].slice(-50);
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undoOficio(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redoOficio(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undoOficio, redoOficio]);

  const generateOperatorCode = useCallback((name: string, email: string) => {
    const parts = (name || "").trim().split(/\s+/);
    const first = (parts[0] || "").toLowerCase();
    const lastInitial = parts.length > 1
      ? parts[parts.length - 1][0]?.toLowerCase() || ""
      : email.split("@")[0]?.[0]?.toLowerCase() || "";
    return first ? `${first}.${lastInitial}` : email.split("@")[0]?.toLowerCase() || "usr";
  }, []);

  const generateSolicitanteCode = useCallback(() => {
    if (!user) return "USR";
    const name = profileName || user.user_metadata?.full_name || "";
    const email = user.email || "";
    const initials = name.split(/\s+/).map((w: string) => w[0]?.toUpperCase() || "").join("").slice(0, 3);
    const emailCode = email.replace(/@.*/, "").slice(0, 2).toUpperCase();
    return (initials || emailCode || "USR");
  }, [user]);

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

  const fetchOficios = async () => {
    setLoading(true);
    const { data } = await supabase.from("oficios").select("*").is("deleted_at" as any, null).order("created_at", { ascending: false });
    setOficios((data as unknown as OficioRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchOficios(); }, []);

  // Handle incoming edit from MeusOficios
  useEffect(() => {
    const state = location.state as { editOficio?: any } | null;
    if (state?.editOficio) {
      // Small delay to ensure component is fully mounted after lazy load
      const timer = setTimeout(() => {
        handleEdit(state.editOficio);
        window.history.replaceState({}, document.title);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const generateNextNumero = () => {
    const year = new Date().getFullYear();
    const existingNumbers = oficios.map(o => o.numero).filter(Boolean).map(n => { const match = n!.match(/^(\d+)/); return match ? parseInt(match[1], 10) : 0; }).filter(n => n > 0);
    const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
    return `${nextNum}/${year}`;
  };

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("telefone1, telefone2, telefone3, full_name").eq("id", user.id).single();
      if (data) {
        const phones = [data.telefone1, data.telefone2, data.telefone3].filter(Boolean) as string[];
        setUserPhones(phones);
        if (data.full_name) setProfileName(data.full_name);
      }
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    const found = tiposServico.find(t => t.label === tipoServico);
    if (found) {
      if (found.secretaria) setSecretaria(found.secretaria);
      if (found.cargo) {
        setCargoDestinatario(found.cargo);
        setDestinatario("");
      } else {
        setCargoDestinatario("");
        setDestinatario("");
      }
    }
  }, [tipoServico]);

  useEffect(() => {
    const query = `${assunto} ${descricao}`.trim();
    searchSimilarOficios(query);
  }, [assunto, descricao, searchSimilarOficios]);

  const filtered = oficios.filter(o => {
    // Show only user's own oficios
    if (user && o.author_id !== user.id) return false;
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
      if (data.assunto_sugerido && !assunto) setAssunto(data.assunto_sugerido);
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

  // ── Generate empathetic response independently ─────────────────────────
  const handleGenerateResposta = async () => {
    setIsGeneratingResposta(true);
    try {
      const temMidias = processedResults.length > 0 || anexoImages.length > 0 || anexos.length > 0;
      const tiposMidias = [
        ...processedResults.map(r => r.type === "image" ? "imagens" : r.type === "video" ? "vídeos" : "áudios"),
        ...anexoImages.map(() => "imagens"),
        ...anexos.filter(a => a.tipo.includes("pdf")).map(() => "documentos PDF"),
      ].filter((v, i, a) => a.indexOf(v) === i).join(", ");

      const { data, error } = await supabase.functions.invoke("generate-resposta", {
        body: {
          numero: numero || null,
          assunto,
          destinatario,
          descricao,
          solicitante,
          bairro,
          local: localDemanda,
          secretaria: secretaria || aiResult?.secretaria_identificada || "",
          tipo_demanda: tipoServico || aiResult?.tipo_demanda || "",
          urgencia: prioridade === "Urgente" ? "urgente" : "normal",
          tem_midias: temMidias,
          tipos_midias: tiposMidias || null,
        },
      });
      if (error) throw error;
      setEditedResposta(data.resposta || "");
      toast({ title: "💬 Resposta empática gerada!", description: "Revise e edite antes de copiar." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar resposta", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsGeneratingResposta(false);
    }
  };

  const handleEdit = async (o: OficioRow) => {
    setEditingOficioId(o.id);
    const rawNum = o.numero || "";
    setNumero(rawNum);
    setDataGeracao(o.data_geracao || new Date().toISOString().split("T")[0]);
    setAssunto(o.assunto || "");
    setDestinatario(o.destinatario || "");
    setCargoDestinatario(o.cargo_destinatario || "");
    setLocalDemanda(o.local_demanda || "");
    setBairro(o.bairro || "");
    setSolicitante(o.solicitante || "");
    setContatoSolicitante(o.contato_solicitante || "");
    setCodigoZ((o as any).codigo_z || "");
    setOrigemOficio((o as any).origem || "WhatsApp Gabinete");
    // Restore secretaria and tipo_demanda from saved data
    const savedSecretaria = (o as any).secretaria_identificada || "";
    setSecretaria(savedSecretaria);
    const savedTipo = (o as any).tipo_demanda || "";
    if (savedTipo) {
      const matchedTipo = tiposServico.find(t => t.label === savedTipo);
      setTipoServico(matchedTipo ? matchedTipo.label : savedTipo);
    }
    const content = o.conteudo || "";
    setEditedOficio(content);
    setOriginalOficio(content);
    setOficioHistory(content ? [content] : []);
    setHistoryIndex(content ? 0 : -1);
    setEditedResposta(o.resposta_cidadao || "");
    setDescricao("");
    setPrioridade("Normal");
    setLinhaTelefonica("");
    // If we have content, go straight to preview; otherwise datos
    setFormTab(content ? "preview" : "dados");
    setShowDialog(true);

    // Load saved images from storage
    const { data: savedAnexos } = await supabase.from("oficio_anexos" as any).select("*").eq("oficio_id", o.id);
    if (savedAnexos && savedAnexos.length > 0) {
      const urls = (savedAnexos as any[]).map((a: any) => {
        const { data } = supabase.storage.from("midias").getPublicUrl(a.storage_path);
        return data.publicUrl;
      });
      setAnexoImageUrls(urls);
    } else {
      setAnexoImageUrls([]);
    }
  };

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    if (!numero.trim()) errors.numero = true;
    if (!contatoSolicitante.trim()) errors.contatoSolicitante = true;
    return errors;
  };

  const handleCreate = async (closeAfterSave = true) => {
    if (!user) return;
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setFormTab("dados");
      toast({ title: "Campos obrigatórios", description: "Preencha o número do ofício e o WhatsApp do solicitante.", variant: "destructive" });
      return;
    }
    setValidationErrors({});
    const fullNumero = numero || null;
    const payload: Record<string, any> = {
      numero: fullNumero,
      assunto: assunto || aiResult?.tipo_demanda || "Sem assunto",
      destinatario: destinatario || (tipoServico === "Outro" ? "A definir" : ""),
      status: "Salvo",
      conteudo: editedOficio || null,
      resposta_cidadao: editedResposta || null,
      secretaria_identificada: aiResult?.secretaria_identificada || secretaria || null,
      tipo_demanda: aiResult?.tipo_demanda || tipoServico || null,
      urgencia: aiResult?.urgencia || (prioridade === "Urgente" ? "urgente" : "normal"),
      linha_telefonica: linhaTelefonica || null,
      codigo_z: origemOficio === "Zap Emprego" ? (codigoZ || null) : null,
      origem: origemOficio || "WhatsApp Gabinete",
      ...(editingOficioId ? {} : { operador_nome: profileName || user.user_metadata?.full_name || user.email || null }),
      cargo_destinatario: cargoDestinatario || null,
      local_demanda: localDemanda || null,
      bairro: bairro || null,
      solicitante: solicitante || null,
      contato_solicitante: contatoSolicitante || null,
      data_geracao: dataGeracao || null,
      last_edited_by: user.id,
      last_edited_by_name: profileName || user.user_metadata?.full_name || user.email || null,
      last_edited_at: new Date().toISOString(),
    };

    let error;
    let oficioId = editingOficioId;
    if (editingOficioId) {
      ({ error } = await supabase.from("oficios").update(payload).eq("id", editingOficioId));
    } else {
      const { data: insertData, error: insertError } = await supabase.from("oficios").insert({ ...payload, author_id: user.id }).select("id").single();
      error = insertError;
      if (insertData) oficioId = insertData.id;
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }

    // Auto-mark number as "usado" in numeração table
    if (fullNumero && oficioId) {
      const numMatch = fullNumero.replace(/^(Ofício GVF n°\s*)+/i, "").trim().match(/^(\d+)/);
      if (numMatch) {
        const numInt = parseInt(numMatch[1], 10);
        const ano = new Date().getFullYear();
        await supabase.rpc("usar_numero", {
          p_numero: numInt,
          p_ano: ano,
          p_user_id: user.id,
          p_user_nome: profileName || user.user_metadata?.full_name || user.email || "",
          p_oficio_id: oficioId,
        });
      }
    }

    // Upload anexo images to storage and persist references
    if (oficioId && anexoImages.length > 0) {
      for (const img of anexoImages) {
        const ext = img.name.split('.').pop() || 'jpg';
        const storagePath = `oficios/${oficioId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("midias").upload(storagePath, img, { contentType: img.type });
        if (!upErr) {
          await supabase.from("oficio_anexos" as any).insert({ oficio_id: oficioId, storage_path: storagePath, file_name: img.name, mime_type: img.type });
        }
      }
    }

    await fetchOficios();
    
    // If new oficio, set the editing ID so we stay in edit mode
    if (!editingOficioId && oficioId) {
      setEditingOficioId(oficioId);
    }

    toast({ title: editingOficioId ? "✓ Ofício atualizado!" : "✓ Ofício salvo!" });

    if (closeAfterSave) {
      resetForm();
    }
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
    const results: { type: string; text: string; fileName: string; storageUrl?: string }[] = [];
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

        // Upload audio/video to storage for later download
        let storageUrl: string | undefined;
        if (item.type === "audio" || item.type === "video") {
          const ext = item.file.name.split(".").pop() || "mp3";
          const path = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("midias").upload(path, item.file);
          if (!upErr) {
            const { data: urlData } = supabase.storage.from("midias").getPublicUrl(path);
            storageUrl = urlData.publicUrl;
          }
        }

        results.push({ type: item.type, text, fileName: item.file.name, storageUrl });
        setProcessingQueue(prev => prev.map((p, i) => i === idx ? { ...p, status: "done", text } : p));
        if (item.type === "image") setAnexoImages(prev => [...prev, item.file]);
      } catch (err: any) {
        setProcessingQueue(prev => prev.map((p, i) => i === idx ? { ...p, status: "error" } : p));
        toast({ title: `Erro ao processar ${item.file.name}`, description: err.message || "Tente novamente.", variant: "destructive" });
      }
    };
    for (let i = 0; i < queue.length; i += 3) {
      const batch = queue.slice(i, i + 3).map((_, j) => processFile(i + j));
      await Promise.all(batch);
    }
    setProcessedResults(prev => [...prev, ...results]);
    setIsProcessingFiles(false);
    if (results.length > 0) toast({ title: `✅ ${results.length} arquivo(s) processado(s)!`, description: "Revise o conteúdo extraído e insira na descrição." });
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
    setCodigoZ("");
    setOrigemOficio("WhatsApp Gabinete");
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
    setValidationErrors({});
    setAnexoImages([]);
    setAnexoImageUrls([]);
    setAnexos([]);
    setSuggestions([]);
    setKbSuggestions([]);
    setShowSuggestions(false);
    setAppliedSuggestionId(null);
  };

  const handleDelete = async (id: string) => {
    const oficio = oficios.find(o => o.id === id);
    const numLabel = oficio?.numero || "rascunho";
    if (!confirm(`Tem certeza que deseja excluir o Ofício nº ${numLabel}?\nEle ficará na Lixeira por 30 dias e pode ser recuperado.`)) return;
    
    await supabase.from("oficios").update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id,
      deleted_by_name: profileName || user?.user_metadata?.full_name || user?.email || null,
    } as any).eq("id", id);
    setOficios(prev => prev.filter(o => o.id !== id));
    toast({ title: "Ofício movido para a lixeira" });
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
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const wordBlob = await exportToWord({
        ...buildExportData(oficio),
        conteudo: oficio.conteudo || "",
      });
      // Build file name: [numero]-[ano] [solicitante_code]
      const cleanedNum = (oficio.numero || "rascunho").replace(/^(Ofício GVF n°\s*)+/i, "").trim().replace(/\//, '-').replace(/[^0-9-]/g, '');
      const solicitanteCode = (oficio.solicitante || "").trim().split(/\s+/)[0] || "";
      const baseFileName = solicitanteCode ? `${cleanedNum} ${solicitanteCode}` : cleanedNum;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const convertFormData = new FormData();
      convertFormData.append("file", wordBlob, `${cleanedNum}.docx`);
      const convertResp = await fetch(`${supabaseUrl}/functions/v1/convert-to-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: convertFormData,
      });

      let uploadBlob: Blob;
      let uploadFileName: string;

      if (convertResp.ok) {
        const contentType = convertResp.headers.get("content-type") || "";
        if (contentType.includes("application/pdf")) {
          uploadBlob = await convertResp.blob();
          uploadFileName = `${baseFileName}.pdf`;
        } else {
          uploadBlob = wordBlob;
          uploadFileName = `${baseFileName}.docx`;
        }
      } else {
        uploadBlob = wordBlob;
        uploadFileName = `${baseFileName}.docx`;
      }

      const driveFormData = new FormData();
      driveFormData.append("file", uploadBlob, uploadFileName);
      driveFormData.append("metadata", JSON.stringify({
        numero: oficio.numero || "",
        assunto: oficio.assunto,
        destinatario: oficio.destinatario,
        operadorNome: profileName || user?.email || "",
        operadorEmail: user?.email || "",
        description: `Criado por: ${profileName || user?.email || ""}${user?.email ? ` (${user.email})` : ""}`,
      }));
      const driveResp = await fetch(`${supabaseUrl}/functions/v1/upload-to-drive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: driveFormData,
      });
      if (!driveResp.ok) {
        const err = await driveResp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao enviar para o Drive");
      }
      const driveResult = await driveResp.json();
      if (driveResult.driveLink) {
        await supabase.from("oficios").update({
          link_pdf_drive: driveResult.driveLink,
          status: "Salvo no Drive",
          uploaded_by_name: profileName || user?.email || null,
          uploaded_by_email: user?.email || null,
          uploaded_at: new Date().toISOString(),
        } as any).eq("id", oficio.id);
        await fetchOficios();
      }
      toast({ title: "✅ Enviado ao Drive!", description: uploadFileName.endsWith(".pdf") ? "PDF enviado com sucesso!" : "Arquivo enviado como Word." });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const buildExportData = (o: OficioRow) => ({
    numero: o.numero || "",
    destinatario: o.destinatario,
    assunto: o.assunto,
    conteudo: o.conteudo || "",
    bairro: o.bairro || "",
    cargoDestinatario: o.cargo_destinatario || "",
    dataGeracao: o.data_geracao || undefined,
    operadorNome: (o as any).operador_nome || profileName || user?.email || undefined,
    telefone: (o as any).linha_telefonica || undefined,
    solicitante: o.solicitante || undefined,
    secretaria: (o as any).secretaria_identificada || undefined,
    codigoZ: (o as any).codigo_z || undefined,
    contatoSolicitante: o.contato_solicitante || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
  });

  const buildFormExportData = () => ({
    numero,
    destinatario,
    assunto,
    conteudo: editedOficio,
    bairro,
    cargoDestinatario,
    dataGeracao: dataGeracao || undefined,
    operadorNome: profileName || user?.email || undefined,
    telefone: linhaTelefonica || undefined,
    solicitante: solicitante || undefined,
    secretaria: secretaria || aiResult?.secretaria_identificada || undefined,
    codigoZ: origemOficio === "Zap Emprego" ? (codigoZ || undefined) : undefined,
    contatoSolicitante: contatoSolicitante || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
    imagens: anexoImages.length > 0 ? anexoImages : undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Ofício</h1>
          <p className="text-sm text-muted-foreground">Crie um novo ofício</p>
        </div>
        <Button onClick={() => { setNumero(generateNextNumero()); setShowDialog(true); }} className="bg-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Novo Ofício
        </Button>
      </div>

      {/* Create Dialog with Tabs */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) resetForm(); else setShowDialog(true); }}>
        <DialogContent className="bg-card border-border !max-w-[100vw] !w-[100vw] !h-[100vh] !max-h-[100vh] !rounded-none !top-0 !left-0 !translate-x-0 !translate-y-0 overflow-y-auto p-3 sm:p-6">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-foreground">{editingOficioId ? "Editar Ofício" : "Novo Ofício"}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">Preencha os dados, revise o texto e salve o ofício.</DialogDescription>
            </div>
            {editingOficioId && (
              <Button variant="destructive" size="sm" onClick={async () => { await handleDelete(editingOficioId); resetForm(); }}>
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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Número do Ofício <span className="text-destructive">*</span></label>
                  <div className="flex items-center gap-0">
                  <Input
                      placeholder="Ex: 23"
                      value={numero.includes(`/${new Date().getFullYear()}`) ? numero.replace(`/${new Date().getFullYear()}`, "") : numero}
                      onChange={e => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setNumero(val ? `${val}/${new Date().getFullYear()}` : "");
                        setValidationErrors(prev => ({ ...prev, numero: false }));
                      }}
                      className={`bg-secondary rounded-r-none ${validationErrors.numero ? "border-destructive ring-1 ring-destructive/50" : "border-border"}`}
                    />
                    <span className="inline-flex items-center px-3 h-9 bg-muted border border-l-0 border-border rounded-r-md text-sm text-muted-foreground whitespace-nowrap">
                      /{new Date().getFullYear()}
                    </span>
                  </div>
                  {validationErrors.numero && <p className="text-[10px] text-destructive mt-0.5">Campo obrigatório</p>}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Geração</label>
                  <Input type="date" value={dataGeracao} onChange={e => setDataGeracao(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Origem da Demanda</label>
                  <Select value={origemOficio} onValueChange={v => { setOrigemOficio(v); if (v !== "Zap Emprego") setCodigoZ(""); }}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WhatsApp Gabinete">WhatsApp Gabinete</SelectItem>
                      <SelectItem value="WhatsApp Vereador">WhatsApp Vereador</SelectItem>
                      <SelectItem value="Zap Emprego">Zap Emprego</SelectItem>
                      <SelectItem value="Requerimento">Requerimento</SelectItem>
                      <SelectItem value="E-mail">E-mail</SelectItem>
                      <SelectItem value="Atendimento presencial">Atendimento presencial</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Código Z field removed — solicitante code is used instead */}
              </div>

              {/* File name preview */}
              {numero && (
                <div className="text-xs text-muted-foreground bg-secondary/50 rounded px-3 py-1.5 flex items-center gap-1">
                  <FileText size={12} />
                  <span>Nome do arquivo: <strong className="text-foreground">
                    {(() => {
                      const cleanedNum = numero.replace(/^(Ofício GVF n°\s*)+/i, "").trim().replace(/\//, '-').replace(/[^0-9-]/g, '');
                      const solCode = solicitante.trim().split(/\s+/)[0] || "";
                      return `${cleanedNum || 'rascunho'}${solCode ? ` ${solCode}` : ''}.pdf`;
                    })()}
                  </strong></span>
                </div>
              )}

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

              {tipoServico === "Outro" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinatário <span className="text-destructive">*</span></label>
                    <Input placeholder="Nome do destinatário" value={destinatario} onChange={e => setDestinatario(e.target.value)} className="bg-secondary border-border" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo do Destinatário <span className="text-destructive">*</span></label>
                    <Input placeholder="Ex: Ilmo(a). Sr(a)..." value={cargoDestinatario} onChange={e => setCargoDestinatario(e.target.value)} className="bg-secondary border-border" />
                  </div>
                </div>
              )}

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
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp do Solicitante <span className="text-destructive">*</span></label>
                  <Input placeholder="(34) 99999-9999" value={contatoSolicitante} onChange={e => { setContatoSolicitante(e.target.value); setValidationErrors(prev => ({ ...prev, contatoSolicitante: false })); }} className={`bg-secondary ${validationErrors.contatoSolicitante ? "border-destructive ring-1 ring-destructive/50" : "border-border"}`} />
                  {validationErrors.contatoSolicitante && <p className="text-[10px] text-destructive mt-0.5">Campo obrigatório</p>}
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
              {showSuggestions && (suggestions.length > 0 || kbSuggestions.length > 0) && (
                <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-primary flex items-center gap-1">
                      <Lightbulb size={14} /> Sugestões inteligentes (ofícios + base de conhecimento)
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSuggestions(false)}>
                      <X size={14} />
                    </Button>
                  </div>
                  {suggestions.map(s => (
                    <button key={s.id} type="button" onClick={() => applySuggestion(s)} className="w-full text-left p-2.5 rounded-md bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">📄 {s.numero ? `Ofício nº ${s.numero}` : "Ofício"} — {s.assunto?.slice(0, 60)}{(s.assunto?.length || 0) > 60 ? "…" : ""}</span>
                        <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {s.destinatario && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s.destinatario}</span>}
                        {s.bairro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s.bairro}</span>}
                      </div>
                    </button>
                  ))}
                  {kbSuggestions.map(kb => (
                    <button key={kb.id} type="button" onClick={() => applyKbSuggestion(kb)} className="w-full text-left p-2.5 rounded-md bg-card border border-border hover:border-accent/50 hover:bg-accent/10 transition-colors group">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground">
                          {kb.fonte === "Instagram" ? "📸" : kb.fonte === "Upload" ? "📁" : "📰"} {kb.titulo?.slice(0, 70)}{(kb.titulo?.length || 0) > 70 ? "…" : ""}
                        </span>
                        <ArrowRight size={12} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {kb.orgao && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{kb.orgao}</span>}
                        {kb.bairro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{kb.bairro}</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/30 text-accent-foreground">{kb.fonte}</span>
                        {kb.modelo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">⭐ Modelo</span>}
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
                <input ref={mediaInputRef} type="file" accept="image/*,audio/*,video/*" multiple className="hidden" onChange={e => e.target.files && handleMultiFileUpload(e.target.files)} />
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
                  <p className="text-xs text-muted-foreground mt-2">Arraste ou clique para adicionar fotos, áudios ou vídeos</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Múltiplos arquivos simultâneos · A IA extrai e combina as informações</p>
                </div>
              </div>

              {/* Processing queue */}
              {processingQueue.length > 0 && (
                <div className="space-y-2">
                  {/* Overall progress bar */}
                  {isProcessingFiles && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Processando arquivos...</span>
                        <span className="font-medium text-primary">
                          {Math.round((processingQueue.filter(p => p.status === "done" || p.status === "error").length / processingQueue.length) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${(processingQueue.filter(p => p.status === "done" || p.status === "error").length / processingQueue.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
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
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          {r.type === "image" ? "📷" : r.type === "video" ? "🎬" : "🎤"} {r.fileName}
                        </span>
                        {r.storageUrl && (
                          <div className="flex items-center gap-1">
                            <a
                              href={r.storageUrl}
                              download={r.fileName}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              <Download size={10} /> Baixar
                            </a>
                            <button
                              onClick={() => {
                                const waText = encodeURIComponent(r.storageUrl!);
                                window.open(`https://wa.me/?text=${waText}`, "_blank");
                              }}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                            >
                              <MessageSquare size={10} /> WhatsApp
                            </button>
                          </div>
                        )}
                      </div>
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

              {/* Show previously saved images */}
              {anexoImageUrls.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">📷 Imagens salvas ({anexoImageUrls.length})</label>
                  <div className="flex flex-wrap gap-2">
                    {anexoImageUrls.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`Anexo ${i + 1}`} className="w-16 h-16 object-cover rounded border border-border" />
                        <button
                          type="button"
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setAnexoImageUrls(prev => prev.filter((_, idx) => idx !== i))}
                        >×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleGenerateAI} disabled={isGenerating} className="flex-1 bg-primary text-primary-foreground">
                  {isGenerating ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Texto com IA</>}
                </Button>
                <Button variant="outline" onClick={() => handleCreate(false)} className="border-border">
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
                      <span className="text-[10px] text-muted-foreground mx-1">v{historyIndex + 1}/{oficioHistory.length}</span>
                    )}
                    {editedOficio && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(htmlToPlain(editedOficio), "Ofício")}><Copy size={14} className="mr-1" /> Copiar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { handleOficioChange(""); }}><Trash2 size={14} className="mr-1" /> Limpar</Button>
                      </>
                    )}
                  </div>
                </div>
                <RichTextEditor
                  content={editedOficio.startsWith("<") ? editedOficio : plainToHtml(editedOficio)}
                  onChange={(html) => handleOficioChange(html)}
                  placeholder="O texto será preenchido pela IA ou manualmente..."
                />
              </div>

              {/* ── Resposta Empática ao Cidadão ─────────────────────────────── */}
              <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/20">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Heart size={16} className="text-primary" />
                    Resposta Empática ao Cidadão
                  </label>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateResposta}
                      disabled={isGeneratingResposta}
                      className="border-primary/30 text-primary hover:bg-primary/10"
                    >
                      {isGeneratingResposta ? (
                        <><Loader2 size={14} className="mr-1 animate-spin" /> Gerando...</>
                      ) : (
                        <><Sparkles size={14} className="mr-1" /> Gerar Resposta</>
                      )}
                    </Button>
                    {editedResposta && (
                      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(editedResposta, "Resposta")}>
                        <Copy size={14} className="mr-1" /> Copiar
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Gera uma resposta empática e profissional para enviar ao cidadão via WhatsApp, informando o registro da demanda e o encaminhamento ao órgão competente.
                </p>
                <Textarea
                  value={editedResposta}
                  onChange={e => setEditedResposta(e.target.value)}
                  placeholder="Clique em 'Gerar Resposta' para criar uma mensagem empática automaticamente, ou digite manualmente..."
                  className="bg-background border-border min-h-[180px] text-sm leading-relaxed"
                />
                {editedResposta && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <CheckCircle2 size={12} className="text-primary" />
                    <span>Resposta pronta. Revise e copie para enviar ao cidadão.</span>
                  </div>
                )}
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
                    if (file.type === "application/pdf" || file.type.startsWith("image/")) {
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

              <Button onClick={() => handleCreate(true)} className="w-full bg-primary text-primary-foreground">
                <CheckCircle2 size={16} className="mr-1" /> Salvar Ofício
              </Button>
            </TabsContent>

            {/* TAB: PREVIEW */}
            <TabsContent value="preview" className="space-y-3 mt-4">
              <PreviewFormatToolbar options={formatOptions} onChange={setFormatOptions} hasChanges={editedOficio !== originalOficio} onUndo={() => setEditedOficio(originalOficio)} />
              <div className="flex gap-2 justify-end flex-wrap">
                <Button size="sm" variant="default" onClick={() => handleCreate(false)}>
                  <Save size={14} className="mr-1" /> Salvar
                </Button>
                <Button size="sm" variant="default" onClick={() => handleCreate(true)}>
                  <Save size={14} className="mr-1" /> Salvar e Fechar
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  if (!destinatario || !assunto || !editedOficio) {
                    toast({ title: "Campos obrigatórios", description: "Preencha o destinatário, assunto e gere o texto do ofício antes de exportar.", variant: "destructive" });
                    return;
                  }
                  exportToWord(buildFormExportData());
                }}>
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (origemOficio === "Zap Emprego" && !codigoZ) {
                    toast({ title: "Código Z obrigatório", description: "Preencha o Código Z para ofícios do Zap Emprego.", variant: "destructive" });
                    setFormTab("dados");
                    return;
                  }
                  if (origemOficio === "Zap Emprego" && (!contatoSolicitante || contatoSolicitante.replace(/\D/g, '').length < 4)) {
                    toast({ title: "Celular inválido", description: "Preencha o WhatsApp do solicitante com pelo menos 4 dígitos.", variant: "destructive" });
                    setFormTab("dados");
                    return;
                  }
                  await exportToPDF(buildFormExportData());
                }}>
                  <Download size={14} className="mr-1" /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    const data = buildFormExportData();
                    const { buildWordBlobForExport } = await import("@/lib/exportOficio");
                    const wordBlob = await buildWordBlobForExport(data);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) { toast({ title: "Sessão expirada", variant: "destructive" }); return; }
                    const convertFormData = new FormData();
                    convertFormData.append("file", wordBlob, "preview.docx");
                    const convertResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/convert-to-pdf`, {
                      method: "POST",
                      headers: { Authorization: `Bearer ${session.access_token}` },
                      body: convertFormData,
                    });
                    if (convertResp.ok && (convertResp.headers.get("content-type") || "").includes("application/pdf")) {
                      const pdfBlob = await convertResp.blob();
                      const url = URL.createObjectURL(pdfBlob);
                      window.open(url, "_blank");
                    } else {
                      toast({ title: "Não foi possível gerar preview do PDF", variant: "destructive" });
                    }
                  } catch (e: any) {
                    toast({ title: "Erro ao gerar preview", description: e.message, variant: "destructive" });
                  }
                }}>
                  <Eye size={14} className="mr-1" /> Visualizar PDF
                </Button>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <OficioPreview ref={previewRef} numero={numero} destinatario={destinatario} assunto={assunto} conteudo={editedOficio} cargoDestinatario={cargoDestinatario} operadorNome={profileName || user?.email || undefined} secretaria={secretaria || aiResult?.secretaria_identificada || undefined} formatOptions={formatOptions} dataGeracao={dataGeracao} editable onContentChange={setEditedOficio} onAssuntoChange={setAssunto} onDestinatarioChange={setDestinatario} onCargoDestinatarioChange={setCargoDestinatario} onNumeroChange={setNumero} onDataChange={(val) => { /* data is display-only from date input */ }} initialConteudo={originalOficio} anexoImageUrls={[...anexoImageUrls, ...anexoImages.map(f => URL.createObjectURL(f))]} />
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
              <Button onClick={() => handleCreate(true)} className="w-full bg-primary text-primary-foreground">
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
                <Button size="sm" variant="outline" onClick={() => { if (viewingOficio?.conteudo) exportToWord(buildExportData(viewingOficio)); }}><FileText size={14} className="mr-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={async () => { if (viewingOficio?.conteudo) await exportToPDF(buildExportData(viewingOficio)); }}><Download size={14} className="mr-1" /> PDF</Button>
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
