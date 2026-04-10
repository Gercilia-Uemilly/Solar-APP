import { useRef, useState, useEffect, useCallback, useMemo, ChangeEvent } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Search, Sparkles, Loader2, Copy, MessageSquare, AlertTriangle, CheckCircle2, Landmark, FileText, Download, Trash2, Calendar, User, MapPin, Phone, X, Pencil, Upload, CloudUpload, Paperclip, Lightbulb, ArrowRight, Undo2, Redo2, Save, BookOpen, SearchCheck } from "lucide-react";
import { PDFDocument } from "pdf-lib";
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
import { useOficios } from "@/hooks/useOficios";
import OficioPreview from "@/components/OficioPreview";
import { exportToWord, exportToPDF, fetchSavedImages, buildMergedPdfBlob, buildWordBlobForExport, buildFileName, type OficioData } from "@/lib/exportOficio";
import { registrarAuditoria } from "@/lib/auditLog";
import { enqueueExport } from "@/lib/exportQueue";
import { comprimirImagem } from "@/lib/imageCompression";

import { generateOperatorCode, type OficioRow, LISTA_SECRETARIAS, getDestinatario, getVocativo, getNomeOrgao, gerarEncerramentoDinamico } from "@/lib/oficioUtils";
import RichTextEditor from "@/components/RichTextEditor";
import FileDropzone, { type AnexoFile } from "@/components/FileDropzone";
import { useAnexos } from "@/hooks/useAnexos";
import type { DemandaAnexo } from "@/types";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";
import RevisaoOficioModal from "@/components/RevisaoOficioModal";
import { useRevisaoOficio } from "@/hooks/useRevisaoOficio";


const statusOptions = ["Rascunho", "Salvo", "Exportado", "Enviado", "Respondido", "Atendido", "Arquivado"];

// Secretaria options now come from centralized config
// imported via oficioUtils: LISTA_SECRETARIAS, getDestinatario, getVocativo

interface AIResult {
  oficio: string;
  resposta_cidadao: string;
  secretaria_identificada: string;
  tipo_demanda: string;
  urgencia: string;
  sugestoes_melhoria: string[];
}

// OficioRow imported from oficioUtils

export default function Oficios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();

  const { oficios, setOficios, loading, fetchOficios, optimisticUpdate, optimisticAdd, optimisticRemove } = useOficios();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [showDialog, setShowDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [viewingOficio, setViewingOficio] = useState<OficioRow | null>(null);
  const [viewingAnexoUrls, setViewingAnexoUrls] = useState<string[]>([]);
  const previewRef = useRef<HTMLDivElement>(null);
  const destinatarioManualmenteEditadoRef = useRef(false);
  const cargoManualmenteEditadoRef = useRef(false);

  // Helper to strip any repeated "Assunto:" prefix from values
  const cleanAssuntoPrefix = (val: string) => val.replace(/^(?:assunto\s*:\s*)+/i, "").trim();

  // Form state
  const [numero, setNumero] = useState("");
  const [dataGeracao, setDataGeracao] = useState(new Date().toISOString().split("T")[0]);
  const [enderecoCompleto, setEnderecoCompleto] = useState("");
  const [assunto, setAssuntoRaw] = useState("");
  const setAssunto = useCallback((val: string) => setAssuntoRaw(cleanAssuntoPrefix(val)), []);
  const [assuntoEditedInPreview, setAssuntoEditedInPreview] = useState(false);
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
  const [fechamento, setFechamento] = useState("Atenciosamente,");
  const [vocativoCustom, setVocativoCustom] = useState("");
  const [userPhones, setUserPhones] = useState<string[]>([]);
  const [profileName, setProfileName] = useState<string>("");

  // AI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingResposta, setIsGeneratingResposta] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [editedOficio, setEditedOficio] = useState("");
  const [originalOficio, setOriginalOficio] = useState("");
  const [editedResposta, setEditedResposta] = useState("");
  const [descSaveStatus, setDescSaveStatus] = useState<string>("");

  // Multi-file processing state
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<{ file: File; type: string; status: "pending" | "processing" | "done" | "error"; text?: string }[]>([]);
  const [processedResults, setProcessedResults] = useState<{ type: string; text: string; fileName: string; storageUrl?: string }[]>([]);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editingOficioId, setEditingOficioId] = useState<string | null>(null);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(defaultFormatOptions);
  const { anexos, setAnexos, addFile: persistAddFile, removeFile: persistRemoveFile, addLocalFile, uploadLocalFiles, reset: resetAnexos } = useAnexos(editingOficioId);
  const [descricaoAnexos, setDescricaoAnexos] = useState("");
  const { revisaoResult, revisaoLoading, revisaoOpen, setRevisaoOpen, revisarOficio } = useRevisaoOficio();

  // Version history for undo/redo
  const [oficioHistory, setOficioHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oficioEditedManuallyRef = useRef(false);

  // Smart suggestions state
  const [suggestions, setSuggestions] = useState<OficioRow[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [appliedSuggestionId, setAppliedSuggestionId] = useState<string | null>(null);
  const suggestionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Knowledge base suggestions
  const [kbSuggestions, setKbSuggestions] = useState<{ id: string; titulo: string; descricao: string | null; orgao: string | null; bairro: string | null; fonte: string | null; modelo: boolean }[]>([]);

  // Duplicate detection state
  const [duplicatasEncontradas, setDuplicatasEncontradas] = useState<OficioRow[]>([]);
  const [mostrarAlertaDuplicata, setMostrarAlertaDuplicata] = useState(false);

  // Modelos state
  const [modelos, setModelos] = useState<any[]>([]);
  const [mostrarModelos, setMostrarModelos] = useState(false);

  // Duplicate detection
  const verificarDuplicata = useCallback(async (endereco: string, sec: string) => {
    if (!endereco || endereco.length < 5) return;
    const { data } = await supabase
      .from("oficios")
      .select("id, numero, assunto, created_at, status")
      .ilike("endereco_completo", `%${endereco}%`)
      .ilike("secretaria_identificada", `%${sec}%`)
      .is("deleted_at", null)
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .limit(3);
    if (data && data.length > 0) {
      setDuplicatasEncontradas(data as OficioRow[]);
      setMostrarAlertaDuplicata(true);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (enderecoCompleto && enderecoCompleto.length >= 5 && secretaria) {
        verificarDuplicata(enderecoCompleto, secretaria);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [enderecoCompleto, secretaria, verificarDuplicata]);

  // Load modelos
  const carregarModelos = useCallback(async () => {
    const { data } = await (supabase.from("modelos_oficio") as any)
      .select("*")
      .order("criado_em", { ascending: false });
    setModelos(data || []);
  }, []);

  const usarModelo = (modelo: any) => {
    if (modelo.secretaria) setSecretaria(modelo.secretaria);
    if (modelo.assunto) setAssunto(modelo.assunto);
    if (modelo.conteudo) {
      setEditedOficio(modelo.conteudo);
      setOriginalOficio(modelo.conteudo);
      setOficioHistory([modelo.conteudo]);
      setHistoryIndex(0);
    }
    setMostrarModelos(false);
    toast({ title: `Modelo "${modelo.nome}" aplicado!` });
  };

  const salvarComoModelo = async () => {
    const nome = prompt("Nome do modelo:");
    if (!nome || !user) return;
    const { error } = await (supabase.from("modelos_oficio") as any).insert({
      nome,
      secretaria: secretaria || null,
      assunto: assunto || null,
      conteudo: editedOficio || null,
      criado_por: user.id,
      criado_por_nome: profileName || user.user_metadata?.full_name || null,
      publico: true,
    });
    if (!error) {
      toast({ title: `Modelo "${nome}" salvo!` });
    } else {
      toast({ title: "Erro ao salvar modelo", description: error.message, variant: "destructive" });
    }
  };

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
    if (!enderecoCompleto && o.bairro) setEnderecoCompleto(o.bairro);
    if (!assunto && o.assunto) setAssunto(o.assunto);
    if (!secretaria && (o as any).tipo_demanda) setSecretaria((o as any).tipo_demanda);
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
    oficioEditedManuallyRef.current = true;
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

  // generateOperatorCode imported from oficioUtils

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

  // fetchOficios is provided by useOficios hook with realtime sync

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

  const [isReservingNumber, setIsReservingNumber] = useState(false);

  const handleNovoOficio = async () => {
    resetForm();
    if (!user) return;
    setIsReservingNumber(true);
    setShowDialog(true);
    try {
      const ano = new Date().getFullYear();
      const userName = profileName || user.user_metadata?.full_name || user.email || "";

      // Call hybrid edge function that checks Google Sheets + DB
      const { data, error } = await supabase.functions.invoke("reservar-numero-hibrido", {
        body: { ano, user_nome: userName },
      });

      if (error || !data?.numero) {
        toast({ title: "Erro ao reservar número", description: error?.message || "Tente novamente.", variant: "destructive" });
        setShowDialog(false);
        return;
      }
      setNumero(data.numero_completo || `${data.numero}/${ano}`);
      toast({ title: `Número ${data.numero_completo} reservado`, description: data.docs_sync ? "Sincronizado com Google Docs" : undefined });
    } catch (err) {
      toast({ title: "Erro ao reservar número", variant: "destructive" });
      setShowDialog(false);
    } finally {
      setIsReservingNumber(false);
    }
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

  // When secretaria changes, auto-fill destinatario and cargo from centralized config
  useEffect(() => {
    if (secretaria) {
      const destinatarioGerado = getDestinatario(secretaria);
      if (!cargoManualmenteEditadoRef.current) {
        setCargoDestinatario(destinatarioGerado);
      }
      if (!destinatarioManualmenteEditadoRef.current) {
        setDestinatario(destinatarioGerado);
      }
    }
  }, [secretaria]);

  const getPreviewEditableSnapshot = useCallback(() => {
    const readField = (field: string) => previewRef.current
      ?.querySelector<HTMLElement>(`[data-preview-field="${field}"]`)
      ?.textContent
      ?.trim();

    const nextNumero = readField("numero") || numero;
    const nextAssunto = (readField("assunto") || assunto).trim().replace(/^ASSUNTO:\s*/i, "").trim();
    const nextDestinatario = (readField("destinatario") || destinatario || cargoDestinatario).trim();
    const nextCargoDestinatario = nextDestinatario.replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim();

    return {
      numero: nextNumero,
      assunto: nextAssunto,
      destinatario: nextDestinatario,
      cargoDestinatario: nextCargoDestinatario,
    };
  }, [assunto, cargoDestinatario, destinatario, numero]);

  useEffect(() => {
    const query = `${assunto} ${descricao}`.trim();
    searchSimilarOficios(query);
  }, [assunto, descricao, searchSimilarOficios]);

  // Auto-save description after 2 seconds of inactivity
  useEffect(() => {
    if (!descricao.trim() || !editingOficioId || !showDialog) return;
    setDescSaveStatus("● Editando...");
    const timer = setTimeout(async () => {
      try {
        // Build template from description
        const encerramentoTexto = gerarEncerramentoDinamico(secretaria, vocativoCustom || getVocativo(secretaria || ''));
        const conteudoFormatado = `<p>${descricao.split("\n").filter((l: string) => l.trim()).join("</p><p>")}</p><p>${encerramentoTexto}</p><p>Na certeza de contar com o vosso pronto atendimento, desde já agradeço.</p>`;

        // Always update conteudo from description unless user manually edited in preview
        const updatePayload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (!oficioEditedManuallyRef.current) {
          updatePayload.conteudo = conteudoFormatado;
          setEditedOficio(conteudoFormatado);
          setOriginalOficio(conteudoFormatado);
          setOficioHistory([conteudoFormatado]);
          setHistoryIndex(0);
        }

        await supabase.from("oficios").update(updatePayload).eq("id", editingOficioId);
        setDescSaveStatus("✓ Salvo automaticamente");
      } catch {
        setDescSaveStatus("✗ Erro ao salvar");
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [descricao, editingOficioId, showDialog, secretaria]);


    const filtered = oficios.filter(o => {
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
        body: { assunto, destinatario, descricao, tipo: secretaria || "Solicitação", solicitante, bairro: bairro, prioridade, local: enderecoCompleto || localDemanda },
      });
      if (error) throw error;
      setAiResult(data);
      const oficioText = data.oficio || "";
      oficioEditedManuallyRef.current = false;
      setEditedOficio(oficioText);
      setOriginalOficio(oficioText);
      setOficioHistory([oficioText]);
      setHistoryIndex(0);
      setEditedResposta(data.resposta_cidadao || "");
      if (data.assunto_sugerido) setAssunto(data.assunto_sugerido);
      if (data.secretaria_identificada) {
        setSecretaria(data.secretaria_identificada);
        setDestinatario(getDestinatario(data.secretaria_identificada));
        setCargoDestinatario(getDestinatario(data.secretaria_identificada));
      }
      setFormTab("preview");
      toast({ title: "Ofício gerado!", description: "Revise o texto na aba Visualizar." });
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
      const temMidias = processedResults.length > 0 || anexos.length > 0;
      const tiposMidias = [
        ...processedResults.map(r => r.type === "image" ? "imagens" : r.type === "video" ? "vídeos" : "áudios"),
        ...anexos.filter(a => a.tipo.startsWith("image/")).map(() => "imagens"),
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
          tipo_demanda: secretaria || aiResult?.tipo_demanda || "",
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
    setEnderecoCompleto((o as any).endereco_completo || "");
    setSolicitante(o.solicitante || "");
    setContatoSolicitante(o.contato_solicitante || "");
    setCodigoZ((o as any).codigo_z || "");
    setOrigemOficio((o as any).origem || "WhatsApp Gabinete");
    const savedSecretaria = (o as any).secretaria_identificada || "";
    setSecretaria(savedSecretaria);
    const content = o.conteudo || "";
    oficioEditedManuallyRef.current = false;
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
    // Anexos are loaded automatically by useAnexos when editingOficioId changes
  };

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});

  const validateForm = () => {
    const errors: Record<string, boolean> = {};
    // numero is auto-reserved, no validation needed
    return errors;
  };

  const handleCreate = async (closeAfterSave = true) => {
    if (!user || !numero) {
      toast({ title: "Aguarde", description: "Número ainda não reservado.", variant: "destructive" });
      return;
    }

    const previewSnapshot = getPreviewEditableSnapshot();
    setNumero(previewSnapshot.numero);
    setAssunto(previewSnapshot.assunto);
    setDestinatario(previewSnapshot.destinatario);
    setCargoDestinatario(previewSnapshot.cargoDestinatario);

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setFormTab("dados");
      return;
    }
    setValidationErrors({});
    const fullNumero = previewSnapshot.numero || numero || null;
    const payload: Record<string, any> = {
      numero: fullNumero,
      assunto: cleanAssuntoPrefix(previewSnapshot.assunto || aiResult?.tipo_demanda || "Sem assunto"),
      destinatario: (previewSnapshot.destinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim(),
      
      conteudo: editedOficio || null,
      resposta_cidadao: null,
      secretaria_identificada: secretaria || aiResult?.secretaria_identificada || null,
      tipo_demanda: secretaria || aiResult?.tipo_demanda || null,
      urgencia: aiResult?.urgencia || (prioridade === "Urgente" ? "urgente" : "normal"),
      linha_telefonica: linhaTelefonica || null,
      codigo_z: ["Zap", "Conecta Jovem", "Empregador", "DI"].includes(origemOficio) ? (codigoZ || null) : null,
      origem: origemOficio || "Outros",
      ...(editingOficioId ? {} : { operador_nome: profileName || user.user_metadata?.full_name || user.email || null }),
      cargo_destinatario: (previewSnapshot.cargoDestinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim() || null,
      local_demanda: localDemanda || null,
      bairro: enderecoCompleto || bairro || null,
      endereco_completo: enderecoCompleto || null,
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

    // Auto-mark number as "usado" in numeração table + update Google Docs/planilha
    if (fullNumero && oficioId) {
      const numMatch = fullNumero.replace(/^(Ofício GVF n°\s*)+/i, "").trim().match(/^(\d+)/);
      if (numMatch) {
        const numInt = parseInt(numMatch[1], 10);
        const ano = new Date().getFullYear();
        const userName = profileName || user.user_metadata?.full_name || user.email || "";
        await supabase.rpc("usar_numero", {
          p_numero: numInt,
          p_ano: ano,
          p_user_id: user.id,
          p_user_nome: userName,
          p_oficio_id: oficioId,
        });
        // Also update Google Docs/planilha with the used number
        supabase.functions.invoke("reservar-numero-hibrido", {
          body: { ano, user_nome: userName, mark_used: true, used_numero: numInt },
        }).catch(() => {});
      }
    }

    // Upload local-only attachments (for new ofícios)
    if (oficioId) {
      await uploadLocalFiles(oficioId);
    }

    await fetchOficios();
    
    // If new oficio, set the editing ID so we stay in edit mode
    if (!editingOficioId && oficioId) {
      setEditingOficioId(oficioId);
    }

    toast({ title: editingOficioId ? "✓ Ofício atualizado!" : "✓ Ofício salvo!" });
    void registrarAuditoria(editingOficioId ? "editar" : "criar", { tabela: "oficios", id: oficioId || "", numero: fullNumero || "" });

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
        // AI-analyzed images are NOT added as document attachments
        // Only the extracted text is used (inserted into description)
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
    destinatarioManualmenteEditadoRef.current = false;
    cargoManualmenteEditadoRef.current = false;
    setNumero("");
    setDataGeracao(new Date().toISOString().split("T")[0]);
    setEnderecoCompleto("");
    setAssunto("");
    setAssuntoEditedInPreview(false);
    setSecretaria("");
    setDestinatario("");
    setCargoDestinatario("");
    setBairro("");
    setSolicitante("");
    setContatoSolicitante("");
    setDescricao("");
    setPrioridade("Normal");
    setCodigoZ("");
    setOrigemOficio("Requerimento");
    setLinhaTelefonica("");
    setFormTab("dados");
    setAiResult(null);
    oficioEditedManuallyRef.current = false;
    setEditedOficio("");
    setOriginalOficio("");
    setEditedResposta("");
    setOficioHistory([]);
    setHistoryIndex(-1);
    setProcessedResults([]);
    setProcessingQueue([]);
    setValidationErrors({});
    resetAnexos();
    setDescricaoAnexos("");
    setSuggestions([]);
    setKbSuggestions([]);
    setShowSuggestions(false);
    setAppliedSuggestionId(null);
    setDescSaveStatus("");
    setVocativoCustom("");

    // Force release focus and body scroll
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.style.overflow = 'auto';
    document.body.style.pointerEvents = 'auto';
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
    void registrarAuditoria("deletar", { tabela: "oficios", id, numero: numLabel });
    toast({ title: "Ofício movido para a lixeira" });
  };
  // ── Auto-save as draft or release number on dialog close ──────────────
  const handleDialogClose = async () => {
    const hasContent = !!(editedOficio?.trim() || descricao?.trim() || assunto?.trim() || solicitante?.trim());

    if (!editingOficioId && numero && user) {
      if (hasContent) {
        // Auto-save as draft
        try {
          const previewSnapshot = getPreviewEditableSnapshot();
          const payload: Record<string, any> = {
            numero: previewSnapshot.numero || numero || null,
            assunto: cleanAssuntoPrefix(previewSnapshot.assunto || assunto || "Rascunho"),
            destinatario: (previewSnapshot.destinatario || destinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim(),
            conteudo: editedOficio || null,
            secretaria_identificada: secretaria || null,
            tipo_demanda: secretaria || null,
            urgencia: prioridade === "Urgente" ? "urgente" : "normal",
            cargo_destinatario: (previewSnapshot.cargoDestinatario || cargoDestinatario || "").replace(/^DESTINAT[AÁ]RIO:\s*/i, "").trim() || null,
            local_demanda: localDemanda || null,
            bairro: enderecoCompleto || bairro || null,
            endereco_completo: enderecoCompleto || null,
            solicitante: solicitante || null,
            contato_solicitante: contatoSolicitante || null,
            data_geracao: dataGeracao || null,
            operador_nome: profileName || user.user_metadata?.full_name || user.email || null,
            author_id: user.id,
            status: "Rascunho",
            origem: origemOficio || "Outros",
            linha_telefonica: linhaTelefonica || null,
            codigo_z: codigoZ || null,
          };
          await supabase.from("oficios").insert([payload] as any);
          toast({ title: "📝 Rascunho salvo automaticamente", description: `Ofício ${numero} salvo como rascunho.` });
        } catch {
          // Silent fail
        }
      } else {
        // No content — release the reserved number
        try {
          const numMatch = numero.match(/^(\d+)/);
          if (numMatch) {
            const numInt = parseInt(numMatch[1], 10);
            const ano = new Date().getFullYear();
            await supabase.rpc("liberar_numero", { p_numero: numInt, p_ano: ano, p_user_id: user.id });
          }
        } catch {
          // Silent fail
        }
      }
    }

    resetForm();
    fetchOficios();
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadToDrive = async (oficio: OficioRow) => {
    if (!editedOficio && !oficio.conteudo) {
      toast({ title: "Sem conteúdo", description: "Gere o texto do ofício antes de enviar.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token
        || (await supabase.auth.refreshSession()).data.session?.access_token;

      if (!accessToken) {
        toast({ title: "Sessão expirada", description: "Faça login novamente para exportar e enviar ao Drive.", variant: "destructive" });
        return;
      }

      const authToken = accessToken;
      // Use buildFormExportData to capture exactly what's in the preview
      const data = await buildFormExportData();
      const baseFileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante, (data as any).origem);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Ensure saved attachments are included
      const exportData = await withSavedAttachments(data);

      let uploadBlob: Blob;
      let uploadFileName: string;

      try {
        // Try PDF first with a 30s timeout to avoid "Failed to fetch"
        const pdfPromise = buildMergedPdfBlob(exportData);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("PDF timeout")), 30000)
        );
        uploadBlob = await Promise.race([pdfPromise, timeoutPromise]);
        uploadFileName = `${baseFileName}.pdf`;
      } catch (pdfErr) {
        console.warn("PDF conversion failed, uploading Word:", pdfErr);
        // Fallback to Word if PDF conversion fails or times out
        uploadBlob = await buildWordBlobForExport(exportData);
        uploadFileName = `${baseFileName}.docx`;
      }

      const driveFormData = new FormData();
      driveFormData.append("file", uploadBlob, uploadFileName);
      driveFormData.append("metadata", JSON.stringify({
        numero: data.numero || "",
        assunto: data.assunto,
        destinatario: data.destinatario,
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
        if (err.needsAuth) {
          toast({ title: "⚠️ Conta Google não conectada", description: "Conecte sua conta Google em Configurações para salvar no Drive.", variant: "destructive" });
          return;
        }
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
        optimisticUpdate(oficio.id, { status: "Salvo no Drive", link_pdf_drive: driveResult.driveLink } as any);
      }
      toast({ title: "✅ Enviado ao Drive!", description: uploadFileName.endsWith(".pdf") ? "PDF enviado com sucesso!" : "Arquivo enviado como Word." });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  function normalizeAttachmentMime(fileName: string, ...candidates: Array<string | null | undefined>): string {
    const normalizedCandidates = candidates
      .map((value) => (value || "").trim().toLowerCase())
      .filter(Boolean);

    const extension = (fileName.split(".").pop() || "").toLowerCase();

    if (normalizedCandidates.some((value) => value.includes("pdf")) || extension === "pdf") {
      return "application/pdf";
    }

    if (normalizedCandidates.some((value) => value.startsWith("image/"))) {
      return normalizedCandidates.find((value) => value.startsWith("image/"))!;
    }

    if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(extension)) {
      return extension === "jpg" ? "image/jpeg" : `image/${extension}`;
    }

    return normalizedCandidates[0] || "application/octet-stream";
  }

  function isExportableAttachment(anexo: AnexoFile): boolean {
    const mime = normalizeAttachmentMime(anexo.nome, anexo.tipo, anexo.file?.type);
    return mime.startsWith("image/") || mime === "application/pdf";
  }

  function mergeAttachmentFiles(base: File[], incoming: File[]): File[] {
    const merged = new Map<string, File>();
    [...base, ...incoming].forEach((file) => {
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      if (!merged.has(key)) merged.set(key, file);
    });
    return Array.from(merged.values());
  }

  const buildExportData = (o: OficioRow) => ({
    oficioId: o.id,
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
    origem: (o as any).origem || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
    formatOptions,
    vocativo: vocativoCustom || undefined,
  });

  // Helper to get image/PDF File objects from unified anexos
  const getImageFilesFromAnexos = async (): Promise<File[] | undefined> => {
    const files = anexos
      .filter((a) => isExportableAttachment(a) && !!a.file)
      .map((a) => {
        const source = a.file!;
        const normalizedType = normalizeAttachmentMime(a.nome, a.tipo, source.type);
        if (source.type === normalizedType) return source;
        return new File([source], source.name || a.nome, {
          type: normalizedType,
          lastModified: source.lastModified,
        });
      });

    return files.length > 0 ? files : undefined;
  };

  const withSavedAttachments = async (exportData: OficioData): Promise<OficioData> => {
    // Always fetch FRESH from DB before exporting
    const oficioId = editingOficioId;
    if (!oficioId) return exportData;

    const savedFiles = await fetchSavedImages(oficioId);
    const currentFiles = exportData.imagens || [];
    const mergedFiles = mergeAttachmentFiles(savedFiles, currentFiles);

    return {
      ...exportData,
      imagens: mergedFiles.length > 0 ? mergedFiles : undefined,
    };
  };

  // Derive image URLs for preview from unified anexos — stable with useMemo
  const previewImageUrls = useMemo(() => {
    const imageAnexos = anexos.filter(a => a.tipo.startsWith("image/"));
    return imageAnexos.map(a => {
      if (a.url) return a.url;
      if (a.file) return URL.createObjectURL(a.file);
      return "";
    }).filter(Boolean);
  }, [anexos]);

  const [previewDocumentAnexos, setPreviewDocumentAnexos] = useState<Array<{ nome: string; tipo: string; paginas?: number }>>([]);

  useEffect(() => {
    let cancelled = false;

    const buildPreviewDocs = async () => {
      const docs = anexos.filter((a) => !a.tipo.startsWith("image/"));
      const resolved = await Promise.all(docs.map(async (a) => {
        const tipoNormalizado = normalizeAttachmentMime(a.nome, a.tipo, a.file?.type);
        const isPdf = tipoNormalizado === "application/pdf";

        if (!isPdf) {
          return { nome: a.nome, tipo: tipoNormalizado };
        }

        try {
          const buffer = a.file
            ? await a.file.arrayBuffer()
            : a.url
              ? await fetch(a.url).then((r) => r.arrayBuffer())
              : null;

          if (!buffer) return { nome: a.nome, tipo: tipoNormalizado, paginas: 1 };
          const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
          return { nome: a.nome, tipo: tipoNormalizado, paginas: Math.max(1, pdf.getPageCount()) };
        } catch {
          return { nome: a.nome, tipo: tipoNormalizado, paginas: 1 };
        }
      }));

      if (!cancelled) setPreviewDocumentAnexos(resolved);
    };

    void buildPreviewDocs();
    return () => {
      cancelled = true;
    };
  }, [anexos]);

  // Cleanup object URLs on unmount or when anexos change
  useEffect(() => {
    return () => {
      previewImageUrls.forEach(url => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewImageUrls]);

  const buildFormExportData = async (): Promise<OficioData> => {
    // Always capture the latest editable snapshot from preview DOM
    const snap = getPreviewEditableSnapshot();
    const exportNumero = snap.numero || numero;
    const exportAssunto = snap.assunto || assunto;
    const exportDestinatario = snap.destinatario || destinatario;
    const exportCargo = snap.cargoDestinatario || cargoDestinatario;

    // Sync state so subsequent saves also reflect preview edits
    if (snap.numero) setNumero(snap.numero);
    if (snap.assunto) setAssunto(snap.assunto);
    if (snap.destinatario) setDestinatario(snap.destinatario);
    if (snap.cargoDestinatario) setCargoDestinatario(snap.cargoDestinatario);

    return {
      oficioId: editingOficioId || undefined,
      numero: exportNumero,
      destinatario: exportDestinatario,
      assunto: exportAssunto,
      conteudo: editedOficio,
      bairro: assuntoEditedInPreview ? undefined : (enderecoCompleto || bairro),
      cargoDestinatario: exportCargo,
      dataGeracao: dataGeracao || undefined,
      operadorNome: profileName || user?.email || undefined,
      telefone: linhaTelefonica || undefined,
      solicitante: solicitante || undefined,
      secretaria: secretaria || aiResult?.secretaria_identificada || undefined,
      codigoZ: ["Zap", "Conecta Jovem", "Empregador", "DI"].includes(origemOficio) ? (codigoZ || undefined) : undefined,
      contatoSolicitante: contatoSolicitante || undefined,
      origem: origemOficio || undefined,
      logoCamaraUrl: logoCamara,
      logoFabaoUrl: logoFabao,
      assinaturaUrl: assinaturaFabao,
      formatOptions,
      fechamento: fechamento !== "Atenciosamente," ? fechamento : undefined,
      vocativo: vocativoCustom || undefined,
      descricaoAnexos: descricaoAnexos || undefined,
      imagens: await getImageFilesFromAnexos(),
    };
  };

  // Cleanup body styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
      document.body.style.pointerEvents = 'auto';
    };
  }, []);

  // Auto-open dialog when navigated with openNew state from sidebar
  useEffect(() => {
    const state = location.state as any;
    if (state?.openNew) {
      handleNovoOficio();
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-save draft every 15 seconds when form has content
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!showDialog || !user) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    // Only auto-save if there's meaningful content
    const hasContent = editedOficio.trim() || assunto.trim() || descricao.trim() || enderecoCompleto.trim();
    if (!hasContent) return;
    autoSaveRef.current = setTimeout(async () => {
      if (!numero) return; // Don't auto-save without a reserved number
      const saveNumero = numero;
      const payload: Record<string, any> = {
        numero: saveNumero || null,
        assunto: assunto || "Sem assunto",
        destinatario: destinatario || "",
        ...(editingOficioId ? {} : { status: "Rascunho" }),
        conteudo: editedOficio || null,
        resposta_cidadao: null,
        secretaria_identificada: secretaria || null,
        tipo_demanda: secretaria || null,
        urgencia: prioridade === "Urgente" ? "urgente" : "normal",
        linha_telefonica: linhaTelefonica || null,
        codigo_z: ["Zap", "Conecta Jovem", "Empregador", "DI"].includes(origemOficio) ? (codigoZ || null) : null,
        origem: origemOficio || "Outros",
        cargo_destinatario: cargoDestinatario || null,
        local_demanda: localDemanda || null,
        bairro: enderecoCompleto || bairro || null,
        endereco_completo: enderecoCompleto || null,
        solicitante: solicitante || null,
        contato_solicitante: contatoSolicitante || null,
        data_geracao: dataGeracao || null,
        last_edited_by: user.id,
        last_edited_by_name: profileName || user.user_metadata?.full_name || user.email || null,
        last_edited_at: new Date().toISOString(),
      };
      if (editingOficioId) {
        await supabase.from("oficios").update(payload).eq("id", editingOficioId);
      } else {
        const { data: insertData } = await supabase.from("oficios").insert({ ...payload, operador_nome: profileName || user.user_metadata?.full_name || user.email || null, author_id: user.id }).select("id").single();
        if (insertData) {
          setEditingOficioId(insertData.id);
          if (insertData.id) await uploadLocalFiles(insertData.id);
        }
      }
    }, 15000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [showDialog, editedOficio, assunto, descricao, enderecoCompleto, secretaria, destinatario, numero, solicitante, contatoSolicitante, bairro, cargoDestinatario, localDemanda, dataGeracao, prioridade, linhaTelefonica, codigoZ, origemOficio, editingOficioId, user]);

  return (
    <div className="space-y-6">

      {/* Header with New button */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Ofícios</h1>
        <Button
          onClick={handleNovoOficio}
          disabled={isReservingNumber}
          className="gap-1.5"
        >
          {isReservingNumber ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Novo Ofício
        </Button>
      </div>

      {/* Create Dialog with Tabs */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) handleDialogClose(); else setShowDialog(true); }}>
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
            <TabsList className="w-full bg-muted grid grid-cols-3">
              <TabsTrigger value="dados" className="text-xs">📋 Dados</TabsTrigger>
              <TabsTrigger value="preview" className="text-xs">👁️ Visualizar</TabsTrigger>
              <TabsTrigger value="historico" className="text-xs">📜 Histórico</TabsTrigger>
            </TabsList>

            {/* TAB: DADOS */}
            <TabsContent value="dados" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Número do Ofício {isReservingNumber && <Loader2 size={12} className="inline animate-spin ml-1" />}</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={numero}
                      onChange={e => setNumero(e.target.value)}
                      className="bg-card border-border font-mono font-bold text-foreground"
                      placeholder={isReservingNumber ? "Reservando..." : "Ex: 366/2026"}
                    />
                    {numero && !isReservingNumber && (
                      <span className="text-[10px] text-primary whitespace-nowrap" title="Número preenchido automaticamente. Você pode alterá-lo se necessário.">✔ Reservado</span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Preenchido automaticamente — editável se necessário</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Data de Geração</label>
                  <Input type="date" value={dataGeracao} onChange={e => setDataGeracao(e.target.value)} className="bg-card border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Origem da Demanda</label>
                  <Select value={origemOficio} onValueChange={v => { setOrigemOficio(v); if (!["Zap", "Conecta Jovem", "Empregador", "DI"].includes(v)) setCodigoZ(""); }}>
                    <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Requerimento">Requerimento</SelectItem>
                      <SelectItem value="Zap">Zap</SelectItem>
                      <SelectItem value="Conecta Jovem">Conecta Jovem</SelectItem>
                      <SelectItem value="Empregador">Empregador</SelectItem>
                      <SelectItem value="DI">DI (Demanda Interna)</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {["Zap", "Conecta Jovem", "Empregador", "DI"].includes(origemOficio) && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Código Z</label>
                    <Select value={codigoZ} onValueChange={setCodigoZ}>
                      <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                          <SelectItem key={n} value={String(n)}>Z{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* File name preview */}
              {numero && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-1.5 flex items-center gap-1">
                  <FileText size={12} />
                  <span>Nome do arquivo: <strong className="text-foreground">
                    {(() => {
                      const cleanedNum = numero.replace(/^(Ofício GVF n°\s*)+/i, "").trim().replace(/\//, '-').replace(/[^0-9-]/g, '');
                      const base = cleanedNum || 'rascunho';
                      const ORIGENS_COM_Z = ["Zap", "Conecta Jovem", "Empregador", "DI"];
                      if (ORIGENS_COM_Z.includes(origemOficio) && codigoZ) {
                        const cel = contatoSolicitante.replace(/\D/g, '').slice(-4);
                        return [base, `Z${codigoZ}`, cel].filter(Boolean).join(' ') + '.pdf';
                      }
                      const solCode = solicitante.trim().split(/\s+/)[0] || "";
                      return `${base}${solCode ? ` ${solCode}` : ''}.pdf`;
                    })()}
                  </strong></span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-primary mb-1 block">Secretaria <span className="text-primary/70">(preenche destinatário automaticamente)</span></label>
                <Select value={secretaria} onValueChange={setSecretaria}>
                  <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Selecione a secretaria..." /></SelectTrigger>
                  <SelectContent>
                    {LISTA_SECRETARIAS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Assunto *</label>
                <Input placeholder="Assunto do ofício" value={assunto} onChange={e => setAssunto(e.target.value)} className="bg-card border-border" />
              </div>

              {secretaria === "Outro (campo livre)" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Destinatário <span className="text-destructive">*</span></label>
                    <Input placeholder="Nome do destinatário" value={destinatario} onChange={e => setDestinatario(e.target.value)} className="bg-card border-border" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Cargo do Destinatário <span className="text-destructive">*</span></label>
                    <Input placeholder="Ex: Ilmo(a). Sr(a)..." value={cargoDestinatario} onChange={e => setCargoDestinatario(e.target.value)} className="bg-card border-border" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Bairro</label>
                  <Input placeholder="Ex: Luizote de Freitas" value={bairro} onChange={e => setBairro(e.target.value)} className="bg-card border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Endereço Completo</label>
                  <Input placeholder="Ex: Rua das Flores, 123" value={enderecoCompleto} onChange={e => setEnderecoCompleto(e.target.value)} className="bg-card border-border" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Solicitante</label>
                  <Input placeholder="Nome do solicitante" value={solicitante} onChange={e => setSolicitante(e.target.value)} className="bg-card border-border" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">WhatsApp do Solicitante</label>
                  <Input placeholder="(34) 99999-9999" value={contatoSolicitante} onChange={e => setContatoSolicitante(e.target.value)} className="bg-card border-border" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição da demanda</label>
                <Textarea
                  placeholder="Descreva a demanda ou cole a conversa com o solicitante... Ex: 'Moradores da Rua Oscar Alvim, Bairro Fundinho, reclamam de buracos' ou cole um trecho da conversa do WhatsApp"
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="bg-card border-border min-h-[120px]"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">💡 Aceita descrições curtas, detalhadas ou conversas coladas do WhatsApp — a IA interpreta e gera o ofício completo.</p>
              </div>

              {/* Mídias Auxiliares — para transcrição/extração de texto, NÃO são anexos */}
               <div className="p-3 rounded-lg border-2 border-dashed border-amber-400/60 bg-amber-500/10 space-y-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <Upload size={13} /> Mídias auxiliares (transcrever áudio / extrair texto de imagem)
                  </label>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700">
                    <span className="text-amber-700 dark:text-amber-300 text-lg leading-none">⚠️</span>
                    <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">Apenas para ajudar a escrever — NÃO anexa ao documento final</span>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*,audio/*,video/*"
                    multiple
                    className="hidden"
                    onChange={e => { if (e.target.files) handleMultiFileUpload(e.target.files); }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-blue-400/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                    disabled={isProcessingFiles}
                    onClick={() => mediaInputRef.current?.click()}
                  >
                    {isProcessingFiles ? <><Loader2 size={14} className="mr-1 animate-spin" /> Processando...</> : <><Upload size={14} className="mr-1" /> Enviar áudio ou print</>}
                  </Button>
                </div>

                {/* Processing queue */}
                {processingQueue.length > 0 && (
                  <div className="space-y-1">
                    {processingQueue.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {item.status === "processing" && <Loader2 size={12} className="animate-spin text-blue-500" />}
                        {item.status === "done" && <CheckCircle2 size={12} className="text-green-500" />}
                        {item.status === "error" && <AlertTriangle size={12} className="text-destructive" />}
                        {item.status === "pending" && <span className="w-3 h-3 rounded-full bg-muted-foreground/30" />}
                        <span className="text-muted-foreground">{item.file.name}</span>
                        {item.status === "done" && <span className="text-green-600 dark:text-green-400">✓ Texto extraído</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Processed results ready to insert */}
                {processedResults.length > 0 && (
                  <div className="space-y-2">
                    {processedResults.map((r, idx) => (
                      <div key={idx} className="p-2 bg-card rounded border border-border text-xs">
                        <p className="font-medium text-foreground mb-1">
                          {r.type === "image" ? "📷" : r.type === "video" ? "🎬" : "🎤"} {r.fileName}
                        </p>
                        <p className="text-muted-foreground line-clamp-3">{r.text}</p>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={confirmAllProcessedTexts}
                    >
                      <CheckCircle2 size={14} className="mr-1" /> Inserir textos extraídos na descrição
                    </Button>
                  </div>
                )}
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
                        {s.destinatario && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.destinatario}</span>}
                        {s.bairro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s.bairro}</span>}
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
                        {kb.orgao && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{kb.orgao}</span>}
                        {kb.bairro && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{kb.bairro}</span>}
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


              {/* Linha Telefônica */}
              {userPhones.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1"><Phone size={12} /> Linha Telefônica utilizada</label>
                  <Select value={linhaTelefonica} onValueChange={setLinhaTelefonica}>
                    <SelectTrigger className="bg-card border-border"><SelectValue placeholder="Selecione a linha..." /></SelectTrigger>
                    <SelectContent>
                      {userPhones.map((phone, i) => <SelectItem key={i} value={phone}>Linha {i + 1}: {phone}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prioridade</label>
                <Select value={prioridade} onValueChange={setPrioridade}>
                  <SelectTrigger className="bg-card border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Normal">Normal</SelectItem>
                    <SelectItem value="Urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block flex items-center gap-1">
                  <Paperclip size={12} /> Anexos do documento <span className="text-[10px] font-normal text-muted-foreground">(serão incluídos no PDF exportado)</span>
                </label>
                <FileDropzone
                  anexos={anexos}
                  onAddFile={editingOficioId ? persistAddFile : (file) => addLocalFile(file)}
                  onRemoveFile={editingOficioId ? persistRemoveFile : (id) => setAnexos(prev => prev.filter(a => a.id !== id))}
                />
              </div>

              {anexos.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">Descrição dos anexos</label>
                  <Input
                    value={descricaoAnexos}
                    onChange={(e) => setDescricaoAnexos(e.target.value)}
                    placeholder="Ex: cópias de BOs e abaixo-assinado dos moradores"
                    className="bg-card border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    ℹ️ Estes arquivos serão incluídos automaticamente no PDF e Drive ao exportar.
                  </p>
                </div>
              )}

              {/* Duplicate alert */}
              {mostrarAlertaDuplicata && duplicatasEncontradas.length > 0 && (
                <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1"><AlertTriangle size={14} /> Possível ofício duplicado</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMostrarAlertaDuplicata(false)}><X size={14} /></Button>
                  </div>
                  {duplicatasEncontradas.map(d => (
                    <div key={d.id} className="text-xs text-muted-foreground">
                      {d.numero || "s/n"} — {d.assunto?.slice(0, 60)} ({d.status}) — {new Date(d.created_at).toLocaleDateString("pt-BR")}
                    </div>
                  ))}
                </div>
              )}

              {/* Save status indicator */}
              {descSaveStatus && (
                <p className={`text-xs ${descSaveStatus.includes("Erro") ? "text-destructive" : descSaveStatus.includes("Salvo") ? "text-primary" : "text-muted-foreground"}`}>
                  {descSaveStatus}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button onClick={handleGenerateAI} disabled={isGenerating} className="flex-1 bg-primary text-primary-foreground">
                  {isGenerating ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Texto com IA</>}
                </Button>
                <Button variant="outline" onClick={async () => {
                  // Save description directly as template content (no AI)
                  if (descricao.trim() && !editedOficio) {
                    const nomeOrgao = secretaria ? getNomeOrgao(secretaria) : "a Secretaria";
                    const artigo = nomeOrgao.startsWith("Departamento") || nomeOrgao.startsWith("Instituto") ? "o" : "a";
                    const template = `<p>${descricao.split("\n").filter(l => l.trim()).join("</p><p>")}</p><p>Espero que ${artigo} ${nomeOrgao} considere favoravelmente nosso pedido e nos informe sobre a viabilidade de atendimento, bem como acerca da previsão para execução do serviço.</p><p>Na certeza de contar com o vosso pronto atendimento, desde já agradeço.</p>`;
                    oficioEditedManuallyRef.current = false;
                    setEditedOficio(template);
                    setOriginalOficio(template);
                    setOficioHistory([template]);
                    setHistoryIndex(0);
                    toast({ title: "✅ Descrição aplicada ao template!" });
                  }
                  await handleCreate(false);
                  setFormTab("preview");
                }} className="border-border">
                  <Save size={14} className="mr-1" /> Salvar
                </Button>
                <Button variant="outline" onClick={() => { carregarModelos(); setMostrarModelos(true); }} className="border-border">
                  <BookOpen size={14} className="mr-1" /> Usar Modelo
                </Button>
              </div>

              {/* Modelo selector dialog */}
              <Dialog open={mostrarModelos} onOpenChange={setMostrarModelos}>
                <DialogContent className="bg-card border-border max-w-md">
                  <DialogHeader>
                    <DialogTitle>Selecionar Modelo</DialogTitle>
                    <DialogDescription>Escolha um modelo para preencher os campos automaticamente.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {modelos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum modelo salvo.</p>
                    ) : modelos.map(m => (
                      <button key={m.id} type="button" onClick={() => usarModelo(m)} className="w-full text-left p-3 rounded-md bg-muted hover:bg-accent/50 transition-colors border border-border">
                        <p className="text-sm font-medium text-foreground">{m.nome}</p>
                        <div className="flex gap-2 mt-1">
                          {m.secretaria && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{m.secretaria}</span>}
                          <span className="text-[10px] text-muted-foreground">por {m.criado_por_nome || "—"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* TAB: PREVIEW */}
            <TabsContent value="preview" className="space-y-3 mt-4">
              <div className="flex gap-2 justify-end flex-wrap">
                <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10" disabled={revisaoLoading} onClick={() => {
                  revisarOficio({
                    numero: numero || "",
                    secretaria: secretaria || "",
                    destinatario: destinatario || "",
                    assunto: assunto || "",
                    endereco_completo: enderecoCompleto || bairro || "",
                    vocativo: getVocativo(secretaria || ""),
                    conteudo: editedOficio || "",
                  });
                }}>
                  {revisaoLoading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <SearchCheck size={14} className="mr-1" />} Revisar
                </Button>
                <Button size="sm" variant="default" onClick={() => handleCreate(false)}>
                  <Save size={14} className="mr-1" /> Salvar
                </Button>
                <Button size="sm" variant="default" onClick={() => handleCreate(true)}>
                  <Save size={14} className="mr-1" /> Salvar e Fechar
                </Button>
                <Button size="sm" variant="outline" onClick={salvarComoModelo} title="Salvar como modelo reutilizável">
                  <BookOpen size={14} className="mr-1" /> Salvar Modelo
                </Button>
                <Button size="sm" variant="outline" disabled={isExportingWord} onClick={async () => {
                  if (!editedOficio) {
                    toast({ title: "⚠️ Sem conteúdo", description: "Gere ou digite o texto do ofício antes de exportar." });
                  }
                  if (!destinatario && !cargoDestinatario) {
                    toast({ title: "⚠️ Destinatário não preenchido" });
                  }
                  setIsExportingWord(true);
                  try {
                    // Auto-save before export to ensure DB is in sync
                    await handleCreate(false);
                    const formData = await withSavedAttachments(await buildFormExportData());
                    await exportToWord(formData);
                  } catch (e: any) {
                    toast({ title: "Falha ao gerar Word", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                  } finally {
                    setIsExportingWord(false);
                  }
                }}>
                  {isExportingWord ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileText size={14} className="mr-1" />} Word
                </Button>
                <Button size="sm" variant="outline" disabled={isExportingPdf} onClick={async () => {
                  if (!editedOficio) {
                    toast({ title: "⚠️ Sem conteúdo", description: "Gere ou digite o texto do ofício antes de exportar." });
                  }
                  if (["Zap", "Conecta Jovem", "Empregador", "DI"].includes(origemOficio) && !codigoZ) {
                    toast({ title: "⚠️ Código Z não preenchido" });
                  }
                  setIsExportingPdf(true);
                  try {
                    // Auto-save before export to ensure DB is in sync
                    await handleCreate(false);
                    const formData = await withSavedAttachments(await buildFormExportData());
                    await exportToPDF(formData);
                  } catch (e: any) {
                    toast({ title: "Falha ao gerar PDF", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                  } finally {
                    setIsExportingPdf(false);
                  }
                }}>
                  {isExportingPdf ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />} PDF
                </Button>
                <Button size="sm" variant="outline" disabled={isUploading} onClick={async () => {
                  if (!editedOficio) {
                    toast({ title: "⚠️ Sem conteúdo", description: "Gere ou digite o texto do ofício antes de enviar ao Drive." });
                  }
                  // Auto-save before upload to ensure preview edits are persisted
                  await handleCreate(false);
                  const snap = getPreviewEditableSnapshot();
                  const tempOficio: OficioRow = {
                    id: editingOficioId || "",
                    numero: snap.numero || numero || null,
                    assunto: snap.assunto || assunto || "",
                    destinatario: snap.destinatario || destinatario || "",
                    status: "Rascunho" as string,
                    conteudo: editedOficio,
                    resposta_cidadao: null,
                    author_id: user?.id || "",
                    created_at: new Date().toISOString(),
                    cargo_destinatario: snap.cargoDestinatario || cargoDestinatario || null,
                    local_demanda: localDemanda || null,
                    bairro: enderecoCompleto || bairro || null,
                    solicitante: solicitante || null,
                    contato_solicitante: contatoSolicitante || null,
                    data_geracao: dataGeracao || null,
                    ano: new Date().getFullYear(),
                  };
                  await handleUploadToDrive(tempOficio);
                }}>
                  {isUploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <CloudUpload size={14} className="mr-1" />} Drive
                </Button>
              </div>
              <PreviewFormatToolbar options={formatOptions} onChange={setFormatOptions} />
              <div className="overflow-x-auto border border-border rounded-lg mt-2" style={{ maxHeight: "60vh", overflowY: "auto" }}>
                <OficioPreview
                  ref={previewRef}
                  numero={numero}
                  destinatario={destinatario}
                  assunto={assunto}
                  conteudo={editedOficio}
                  cargoDestinatario={cargoDestinatario}
                  operadorNome={profileName || user?.email || undefined}
                  secretaria={secretaria || aiResult?.secretaria_identificada || undefined}
                  dataGeracao={dataGeracao}
                  editable
                  onContentChange={handleOficioChange}
                  onAssuntoChange={(val) => {
                    setAssunto(val);
                    setAssuntoEditedInPreview(true);
                  }}
                  onDestinatarioChange={(val) => {
                    destinatarioManualmenteEditadoRef.current = true;
                    setDestinatario(val);
                  }}
                  onCargoDestinatarioChange={(val) => {
                    cargoManualmenteEditadoRef.current = true;
                    setCargoDestinatario(val);
                  }}
                  onNumeroChange={setNumero}
                  onDataChange={(val) => {
                    /* data is display-only from date input */
                  }}
                  onIncreaseFontSize={() => {
                    // Font size buttons only work on selection — handled by OficioPreviewEditor
                    setFormatOptions((prev) => ({ ...prev, fontSize: Math.min(12, prev.fontSize + 1) }));
                  }}
                  onDecreaseFontSize={() => {
                    setFormatOptions((prev) => ({ ...prev, fontSize: Math.max(8, prev.fontSize - 1) }));
                  }}
                  initialConteudo={originalOficio}
                  anexoImageUrls={previewImageUrls}
                  anexoDocuments={previewDocumentAnexos}
                  bairro={assuntoEditedInPreview ? undefined : (enderecoCompleto || bairro)}
                  formatOptions={formatOptions}
                  fechamento={fechamento}
                  onFechamentoChange={setFechamento}
                  vocativoOverride={vocativoCustom || undefined}
                  onVocativoChange={setVocativoCustom}
                />
              </div>
            </TabsContent>

            {/* TAB: HISTÓRICO */}
            <TabsContent value="historico" className="space-y-4 mt-4">
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Informações do Ofício</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Número:</span> <span className="text-foreground">{numero || "—"}</span></div>
                  <div><span className="text-muted-foreground">Data:</span> <span className="text-foreground">{dataGeracao}</span></div>
                  <div><span className="text-muted-foreground">Assunto:</span> <span className="text-foreground">{assunto || "—"}</span></div>
                  <div><span className="text-muted-foreground">Destinatário:</span> <span className="text-foreground">{cargoDestinatario || destinatario || "—"}</span></div>
                  <div><span className="text-muted-foreground">Secretaria:</span> <span className="text-foreground">{secretaria || "—"}</span></div>
                  <div><span className="text-muted-foreground">Prioridade:</span> <span className="text-foreground">{prioridade}</span></div>
                  <div><span className="text-muted-foreground">Solicitante:</span> <span className="text-foreground">{solicitante || "—"}</span></div>
                  <div><span className="text-muted-foreground">Endereço:</span> <span className="text-foreground">{enderecoCompleto || "—"}</span></div>
                </div>
                {aiResult && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-primary flex items-center gap-1"><Sparkles size={12} /> Gerado por IA</p>
                  </div>
                )}
              </div>
              {oficioHistory.length > 1 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Versões do texto ({oficioHistory.length})</h4>
                  {oficioHistory.map((_, i) => (
                    <button key={i} onClick={() => { setHistoryIndex(i); setEditedOficio(oficioHistory[i]); }} className={`w-full text-left p-2 rounded text-xs ${i === historyIndex ? "bg-primary/10 border border-primary/30" : "bg-muted"}`}>
                      Versão {i + 1} {i === historyIndex && "(atual)"}
                    </button>
                  ))}
                </div>
              )}
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
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!viewingOficio?.conteudo) return;
                  const imgs = await fetchSavedImages(viewingOficio.id);
                  try {
                    await exportToWord({ ...buildExportData(viewingOficio), imagens: imgs.length > 0 ? imgs : undefined });
                  } catch (e: any) {
                    toast({ title: "Falha ao gerar Word", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                  }
                }}><FileText size={14} className="mr-1" /> Word</Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!viewingOficio?.conteudo) return;
                  const imgs = await fetchSavedImages(viewingOficio.id);
                  try {
                    await exportToPDF({ ...buildExportData(viewingOficio), imagens: imgs.length > 0 ? imgs : undefined });
                  } catch (e: any) {
                    toast({ title: "Falha ao gerar PDF", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                  }
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
                <OficioPreview
                  numero={viewingOficio.numero || ""}
                  destinatario={viewingOficio.destinatario}
                  assunto={viewingOficio.assunto}
                  conteudo={viewingOficio.conteudo || ""}
                  bairro={viewingOficio.bairro || undefined}
                  cargoDestinatario={viewingOficio.cargo_destinatario || undefined}
                  operadorNome={viewingOficio.operador_nome || profileName || user?.email || undefined}
                  secretaria={(viewingOficio as any).secretaria_identificada || undefined}
                  dataGeracao={viewingOficio.data_geracao || undefined}
                  formatOptions={formatOptions}
                  anexoImageUrls={viewingAnexoUrls}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revisão Modal */}
      <RevisaoOficioModal
        open={revisaoOpen}
        onOpenChange={setRevisaoOpen}
        resultado={revisaoResult}
        loading={revisaoLoading}
        onCorrigirCampo={(campo, correcao) => {
          if (campo === "assunto") setAssunto(correcao);
          else if (campo === "destinatario") setDestinatario(correcao);
          else if (campo === "vocativo") setCargoDestinatario(correcao);
          else if (campo === "conclusao" || campo === "texto" || campo === "gramatica") {
            // Replace the editor content with the corrected version
            if (correcao) {
              setEditedOficio(correcao);
            }
          }
          // Persist correction to database
          if (editingOficioId) {
            const dbField = campo === "assunto" ? "assunto"
              : campo === "destinatario" ? "destinatario"
              : campo === "vocativo" ? "cargo_destinatario"
              : null;
            if (dbField) {
              supabase.from("oficios").update({ [dbField]: correcao }).eq("id", editingOficioId).then(() => {});
            }
          }
          toast({ title: "✅ Correção aplicada!" });
        }}
        onCorrigirTudo={() => {
          if (!revisaoResult?.erros) return;
          for (const erro of revisaoResult.erros) {
            if (!erro.correcao) continue;
            if (erro.campo === "assunto") setAssunto(erro.correcao);
            else if (erro.campo === "destinatario") setDestinatario(erro.correcao);
            else if (erro.campo === "vocativo") setCargoDestinatario(erro.correcao);
            else if (erro.campo === "conclusao" || erro.campo === "texto" || erro.campo === "gramatica") {
              setEditedOficio(erro.correcao);
            }
          }
          // Persist all corrections
          if (editingOficioId && revisaoResult.erros) {
            const updates: Record<string, string> = {};
            for (const erro of revisaoResult.erros) {
              if (!erro.correcao) continue;
              if (erro.campo === "assunto") updates.assunto = erro.correcao;
              else if (erro.campo === "destinatario") updates.destinatario = erro.correcao;
              else if (erro.campo === "vocativo") updates.cargo_destinatario = erro.correcao;
            }
            if (Object.keys(updates).length > 0) {
              supabase.from("oficios").update(updates).eq("id", editingOficioId).then(() => {});
            }
          }
          toast({ title: "✅ Todas as correções aplicadas!" });
        }}
        onExportarMesmoAssim={() => setRevisaoOpen(false)}
      />
    </div>
  );
}
