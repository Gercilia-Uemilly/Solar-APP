import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ptBR } from "date-fns/locale";
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOficios } from "@/hooks/useOficios";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Eye, Trash2, Download, Search, FileText, FileSpreadsheet, CalendarIcon, X, CloudUpload, Loader2, Pencil, ArrowLeft, Save, ChevronDown, Package, SearchCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import OficioPreview from "@/components/OficioPreview";
import PreviewFormatToolbar, { defaultFormatOptions } from "@/components/PreviewFormatToolbar";
import type { FormatOptions } from "@/components/PreviewFormatToolbar";
import { exportToWord, exportToPDF, exportToCSV, buildWordBlobForExport, buildMergedPdfBlob, buildFileName, fetchSavedImages } from "@/lib/exportOficio";
import { type OficioRow, getVocativo } from "@/lib/oficioUtils";
import RevisaoOficioModal from "@/components/RevisaoOficioModal";
import { useRevisaoOficio } from "@/hooks/useRevisaoOficio";
import VersionHistoryDialog from "@/components/VersionHistoryDialog";
import { saveBackupBeforeEdit } from "@/lib/oficioBackup";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";
import assinaturaFabao from "@/assets/assinatura-fabao-clean.png";

const marcadorOptions: { value: string; emoji: string; label: string; className: string }[] = [
  { value: "importante", emoji: "⭐", label: "Importante", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  { value: "urgente", emoji: "🔴", label: "Urgente", className: "bg-red-500/20 text-red-700 dark:text-red-400" },
  { value: "aguardando", emoji: "🟡", label: "Aguardando", className: "bg-amber-500/20 text-amber-700 dark:text-amber-400" },
  { value: "ok", emoji: "🟢", label: "OK", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
];

const statusOptions = ["Rascunho", "Salvo", "Exportado", "Impresso", "Protocolado", "Feito", "Salvo no Drive", "Cancelado"];

const statusConfig: Record<string, { emoji: string; className: string }> = {
  "Rascunho": { emoji: "🟡", className: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" },
  "Salvo": { emoji: "🟢", className: "bg-green-500/20 text-green-700 dark:text-green-400" },
  "Exportado": { emoji: "🔵", className: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  "Impresso": { emoji: "🔵", className: "bg-blue-500/20 text-blue-700 dark:text-blue-400" },
  "Protocolado": { emoji: "🟣", className: "bg-purple-500/20 text-purple-700 dark:text-purple-400" },
  "Feito": { emoji: "✅", className: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400" },
  "Salvo no Drive": { emoji: "☁️", className: "bg-sky-500/20 text-sky-700 dark:text-sky-400" },
  "Cancelado": { emoji: "🔴", className: "bg-red-500/20 text-red-700 dark:text-red-400" },
};

export default function MeusOficios() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { oficios, setOficios, loading, fetchOficios, optimisticUpdate, optimisticRemove } = useOficios();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroOperador, setFiltroOperador] = useState("Todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [profileName, setProfileName] = useState<string>("");
  const [exportConfirmOficio, setExportConfirmOficio] = useState<OficioRow | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const TIPOS_ESPECIAIS = ["Requerimento", "Outro", "Zap"];
  const isEspecial = (o: OficioRow) => TIPOS_ESPECIAIS.some(t => (o.assunto || "").toLowerCase().includes(t.toLowerCase()) || ((o as any).tipo_demanda || "").toLowerCase().includes(t.toLowerCase()));
  const { revisaoResult, revisaoLoading, revisaoOpen, setRevisaoOpen, revisarOficio, resetRevisao } = useRevisaoOficio();
  const [pendingExportAction, setPendingExportAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single().then(({ data }) => {
      if (data?.full_name) setProfileName(data.full_name);
    });
  }, [user]);

  // View
  const [viewOficio, setViewOficio] = useState<OficioRow | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewAnexoUrls, setPreviewAnexoUrls] = useState<string[]>([]);
  const [previewAnexoDocs, setPreviewAnexoDocs] = useState<Array<{ nome: string; tipo: string; paginas?: number }>>([]);
  const [editedContent, setEditedContent] = useState<string>("");
  const editedContentRef = useRef<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineFieldSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const formatStorageKey = "oficio_preview_format_options";
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(() => {
    try {
      const raw = localStorage.getItem(formatStorageKey);
      if (!raw) return defaultFormatOptions;
      const parsed = JSON.parse(raw) as Partial<FormatOptions>;
      return { ...defaultFormatOptions, ...parsed };
    } catch {
      return defaultFormatOptions;
    }
  });
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    localStorage.setItem(formatStorageKey, JSON.stringify(formatOptions));
  }, [formatOptions]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (inlineFieldSaveTimerRef.current) clearTimeout(inlineFieldSaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      previewAnexoUrls.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [previewAnexoUrls]);

  const handleOpenPreview = async (o: OficioRow) => {
    // Check for concurrent edits before opening
    const { data: latest } = await supabase.from("oficios").select("conteudo, last_edited_by_name, last_edited_at, updated_at, cargo_destinatario, destinatario, assunto, numero, bairro, data_geracao").eq("id", o.id).single();
    if (latest) {
      if (latest.last_edited_by_name && latest.last_edited_at) {
        const editDate = new Date(latest.last_edited_at);
        const timeDiff = Date.now() - editDate.getTime();
        if (timeDiff < 30 * 60 * 1000 && latest.last_edited_by_name !== (profileName || user?.email)) {
          const formattedDate = editDate.toLocaleString("pt-BR");
          if (!confirm(`Este ofício foi editado por ${latest.last_edited_by_name} em ${formattedDate}. Deseja carregar a versão mais recente?`)) {
            return;
          }
        }
      }
      // Always use latest data from DB
      o = { ...o, conteudo: latest.conteudo, cargo_destinatario: latest.cargo_destinatario, destinatario: latest.destinatario, assunto: latest.assunto, numero: latest.numero, bairro: latest.bairro, data_geracao: latest.data_geracao };
    }
    setViewOficio(o);
    setEditedContent(o.conteudo || "");
    editedContentRef.current = o.conteudo || "";
    setOriginalContent(o.conteudo || "");
    setEditorKey(prev => prev + 1);
    setPreviewAnexoUrls([]);
    setPreviewAnexoDocs([]);
    setShowPreview(true);

    // Load anexos (imagens + documentos)
    fetchSavedImages(o.id)
      .then(async (files) => {
        const urls = files
          .filter((f) => f.type.startsWith("image/"))
          .map((f) => URL.createObjectURL(f));
        const docs = await Promise.all(
          files
            .filter((f) => !f.type.startsWith("image/"))
            .map(async (f) => {
              const tipo = (f.type || "application/octet-stream").toLowerCase();
              const isPdf = tipo.includes("pdf") || f.name.toLowerCase().endsWith(".pdf");

              if (!isPdf) return { nome: f.name, tipo };

              try {
                const buffer = await f.arrayBuffer();
                const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
                return { nome: f.name, tipo: "application/pdf", paginas: Math.max(1, pdf.getPageCount()) };
              } catch {
                return { nome: f.name, tipo: "application/pdf", paginas: 1 };
              }
            })
        );

        setPreviewAnexoUrls(urls);
        setPreviewAnexoDocs(docs);
      })
      .catch(() => {
        setPreviewAnexoUrls([]);
        setPreviewAnexoDocs([]);
      });
  };

  const saveFieldToDb = useCallback(async (fields: Record<string, any>) => {
    if (!viewOficio) return;
    setSaveStatus("saving");
    // Auto-save backup before editing
    await saveBackupBeforeEdit(viewOficio.id);
    const updatePayload: Record<string, any> = {
      ...fields,
      last_edited_by: user?.id || null,
      last_edited_by_name: profileName || user?.email || null,
      last_edited_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("oficios").update(updatePayload).eq("id", viewOficio.id);
    if (error) {
      setSaveStatus("error");
      const msg = error.message?.includes("row-level security") ? "Você só pode editar seus próprios ofícios." : error.message;
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } else {
      setSaveStatus("saved");
      setViewOficio(prev => prev ? { ...prev, ...fields } : prev);
      setOficios(prev => prev.map(o => o.id === viewOficio.id ? { ...o, ...fields } : o));
    }
  }, [viewOficio, user, profileName, toast, setOficios]);

  const handleSaveContent = useCallback(async () => {
    if (!viewOficio) return;
    const contentToSave = editedContentRef.current;
    setSaveStatus("saving");
    const validDataGeracao = typeof viewOficio.data_geracao === "string" && /^\d{4}-\d{2}-\d{2}$/.test(viewOficio.data_geracao)
      ? viewOficio.data_geracao
      : null;

    const updatePayload: Record<string, any> = {
      conteudo: contentToSave,
      destinatario: viewOficio.destinatario,
      cargo_destinatario: viewOficio.cargo_destinatario,
      assunto: viewOficio.assunto,
      numero: viewOficio.numero,
      data_geracao: validDataGeracao,
      status: "Salvo",
      last_edited_by: user?.id || null,
      last_edited_by_name: profileName || user?.email || null,
      last_edited_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("oficios").update(updatePayload).eq("id", viewOficio.id);
    if (error) {
      setSaveStatus("error");
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setSaveStatus("saved");
      setOriginalContent(contentToSave);
      setOficios(prev => prev.map(o => o.id === viewOficio.id ? { ...o, ...updatePayload } : o));
    }
  }, [viewOficio, user, profileName, toast, setOficios]);

  const handleContentChange = useCallback((newContent: string) => {
    setEditedContent(newContent);
    editedContentRef.current = newContent;
    setSaveStatus("idle");
    
    // Auto-save after 2 seconds
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (viewOficio) {
        setSaveStatus("saving");
        supabase.from("oficios").update({
          conteudo: newContent,
          last_edited_by: user?.id || null,
          last_edited_by_name: profileName || user?.email || null,
          last_edited_at: new Date().toISOString(),
        } as any).eq("id", viewOficio.id).then(({ error }) => {
          setSaveStatus(error ? "error" : "saved");
          if (!error) {
            setOriginalContent(newContent);
            setOficios(prev => prev.map(o => o.id === viewOficio.id ? { ...o, conteudo: newContent } : o));
          }
        });
      }
    }, 2000);
  }, [viewOficio, user, profileName, setOficios]);

  const handleInlineFieldChange = useCallback((field: string, value: string) => {
    setViewOficio(prev => prev ? { ...prev, [field]: value } : prev);
    setSaveStatus("idle");

    if (inlineFieldSaveTimerRef.current) clearTimeout(inlineFieldSaveTimerRef.current);
    inlineFieldSaveTimerRef.current = setTimeout(() => {
      saveFieldToDb({ [field]: value });
    }, 600);
  }, [saveFieldToDb]);

  const handleEditForm = (o: OficioRow) => {
    navigate("/oficios", { state: { editOficio: o } });
  };

  // fetchOficios is provided by useOficios hook with realtime sync

  const operadores = useMemo(() => {
    const names = new Set<string>();
    oficios.forEach(o => { if (o.operador_nome) names.add(o.operador_nome); });
    return Array.from(names).sort();
  }, [oficios]);

  const canEditOrDelete = (o: OficioRow) => {
    if (!user) return false;
    return isAdmin || o.author_id === user.id;
  };

  const handleStatusChange = async (oficioId: string, newStatus: string) => {
    await saveBackupBeforeEdit(oficioId);
    const { error } = await supabase.from("oficios").update({ status: newStatus }).eq("id", oficioId);
    if (error) {
      const msg = error.message?.includes("row-level security") ? "Você só pode editar seus próprios ofícios." : error.message;
      toast({ title: "Erro ao alterar status", description: msg, variant: "destructive" });
    } else {
      setOficios(prev => prev.map(o => o.id === oficioId ? { ...o, status: newStatus } : o));
      toast({ title: `Status alterado para "${newStatus}"` });
    }
  };

  const handleMarcadorChange = async (oficioId: string, marcador: string | null) => {
    const { error } = await supabase.from("oficios").update({ marcador } as any).eq("id", oficioId);
    if (!error) {
      setOficios(prev => prev.map(o => o.id === oficioId ? { ...o, marcador } : o));
    }
  };

  const handleDelete = async (id: string) => {
    const oficio = oficios.find(o => o.id === id);
    const numLabel = oficio?.numero || "rascunho";
    if (!confirm(`Tem certeza que deseja excluir o Ofício nº ${numLabel}?\nEle ficará na Lixeira por 30 dias e pode ser recuperado.`)) return;
    
    const { error } = await supabase.from("oficios").update({
      deleted_at: new Date().toISOString(),
      deleted_by: user?.id,
      deleted_by_name: profileName || user?.email || null,
    } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setOficios(prev => prev.filter(o => o.id !== id));
      toast({ title: "Ofício movido para a lixeira" });
    }
  };

  const buildExportData = (o: OficioRow) => ({
    oficioId: o.id,
    numero: o.numero || "",
    destinatario: o.destinatario,
    assunto: o.assunto,
    conteudo: o.conteudo || "",
    bairro: o.bairro || "",
    cargoDestinatario: o.cargo_destinatario || "",
    dataGeracao: o.data_geracao || undefined,
    operadorNome: o.operador_nome || profileName || user?.email || undefined,
    telefone: o.linha_telefonica || undefined,
    solicitante: o.solicitante || undefined,
    codigoZ: (o as any).codigo_z || undefined,
    contatoSolicitante: o.contato_solicitante || undefined,
    secretaria: (o as any).secretaria_identificada || undefined,
    origem: (o as any).origem || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
    formatOptions,
  });

  const handleUploadToDrive = async (oficio: OficioRow) => {
    if (!oficio.conteudo) {
      toast({ title: "Sem conteúdo", description: "Gere o texto do ofício antes de enviar.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token
        || (await supabase.auth.refreshSession()).data.session?.access_token;

      if (!accessToken) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        return;
      }
      const authToken = accessToken;
      const data = buildExportData(oficio);
      const imgs = await fetchSavedImages(oficio.id);
      const baseFileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante, (data as any).origem);
      
      // Build merged PDF (ofício + anexos) for Drive upload
      const exportData = {
        ...data,
        conteudo: editedContent || oficio.conteudo,
        imagens: imgs.length > 0 ? imgs : undefined,
      };
      
      let uploadBlob: Blob;
      let uploadFileName: string;
      
      try {
        uploadBlob = await buildMergedPdfBlob(exportData);
        uploadFileName = `${baseFileName}.pdf`;
      } catch {
        // Fallback to Word if PDF conversion fails
        uploadBlob = await buildWordBlobForExport(exportData);
        uploadFileName = `${baseFileName}.docx`;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

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
        if (err.needsAuth) {
          toast({ title: "⚠️ Conta Google não conectada", description: "Conecte sua conta Google em Configurações para salvar na pasta do gabinete com seu nome.", variant: "destructive" });
          return;
        }
        throw new Error(err.error || "Erro ao enviar para o Drive");
      }
      const driveResult = await driveResp.json();
      if (driveResult.driveLink) {
        await supabase.from("oficios").update({
          link_pdf_drive: driveResult.driveLink,
           status: "Exportado",
          uploaded_by_name: profileName || user?.email || null,
          uploaded_by_email: user?.email || null,
          uploaded_at: new Date().toISOString(),
        } as any).eq("id", oficio.id);
        await fetchOficios();
      }
      toast({ title: "✅ Enviado ao Drive!", description: uploadFileName.endsWith(".pdf") ? "PDF enviado!" : "Enviado como Word." });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportAll = async (oficio: OficioRow) => {
    if (!oficio.conteudo) {
      toast({ title: "Sem conteúdo", description: "Gere o texto do ofício antes de exportar.", variant: "destructive" });
      return;
    }
    setIsExportingAll(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token
        || (await supabase.auth.refreshSession()).data.session?.access_token;

      if (!accessToken) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        return;
      }
      const authToken = accessToken;
      const data = buildExportData(oficio);
      const imgs = await fetchSavedImages(oficio.id);
      if (imgs.length > 0) (data as any).imagens = imgs;
      const fileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante, (data as any).origem);
      
      toast({ title: "⏳ Exportando PDF, Word e Drive...", description: fileName });

      // 1. Build Word blob (without anexos embedded for PDF merging)
      const { saveAs } = await import("file-saver");
      const wordBlob = await buildWordBlobForExport(data);
      
      // 2. Build merged PDF (ofício + anexos in one file)
      let pdfBlob: Blob | null = null;
      try {
        pdfBlob = await buildMergedPdfBlob(data);
      } catch (e) {
        console.error("PDF merge failed, trying without merge:", e);
      }

      // 3. Download PDF
      if (pdfBlob) {
        saveAs(pdfBlob, `${fileName}.pdf`);
      }

      // 4. Download Word
      saveAs(wordBlob, `${fileName}.docx`);

      // 5. Upload to Drive (PDF or Word)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const driveFormData = new FormData();
      const uploadBlob = pdfBlob || wordBlob;
      const uploadName = pdfBlob ? `${fileName}.pdf` : `${fileName}.docx`;
      driveFormData.append("file", uploadBlob, uploadName);
      driveFormData.append("metadata", JSON.stringify({
        numero: oficio.numero || "",
        assunto: oficio.assunto,
        destinatario: oficio.destinatario,
        operadorNome: profileName || user?.email || "",
        operadorEmail: user?.email || "",
      }));
      const driveResp = await fetch(`${supabaseUrl}/functions/v1/upload-to-drive`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: driveFormData,
      });
      
      if (!driveResp.ok) {
        const err = await driveResp.json().catch(() => ({}));
        if (err.needsAuth) {
          toast({ title: "⚠️ Conta Google não conectada", description: "Conecte em Configurações para salvar no Drive.", variant: "destructive" });
        } else {
          toast({ title: "PDF e Word baixados, mas erro no Drive", description: err.error || "Tente enviar ao Drive separadamente.", variant: "destructive" });
        }
        return;
      }

      const driveResult = await driveResp.json();
      if (driveResult.driveLink) {
        await supabase.from("oficios").update({
          link_pdf_drive: driveResult.driveLink,
          status: "Exportado",
          uploaded_by_name: profileName || user?.email || null,
          uploaded_by_email: user?.email || null,
          uploaded_at: new Date().toISOString(),
        } as any).eq("id", oficio.id);
        await fetchOficios();
      }

      toast({ title: "✅ PDF, Word e Drive salvos com sucesso!", description: uploadName });
      setExportConfirmOficio(null);
    } catch (e: any) {
      toast({ title: "Erro ao exportar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsExportingAll(false);
    }
  };

  const filtered = oficios.filter(o => {
    if (filtroStatus !== "Todos" && o.status !== filtroStatus) return false;
    if (filtroOperador !== "Todos" && o.operador_nome !== filtroOperador) return false;
    if (dateFrom && new Date(o.created_at) < dateFrom) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (new Date(o.created_at) > end) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return (
        o.assunto.toLowerCase().includes(s) ||
        o.destinatario.toLowerCase().includes(s) ||
        (o.numero || "").toLowerCase().includes(s) ||
        (o.solicitante || "").toLowerCase().includes(s) ||
        (o.bairro || "").toLowerCase().includes(s) ||
        (o.contato_solicitante || "").toLowerCase().includes(s) ||
        (o.operador_nome || "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const hasActiveFilters = filtroStatus !== "Todos" || filtroOperador !== "Todos" || !!dateFrom || !!dateTo || !!search;
  const clearFilters = () => {
    setSearch("");
    setFiltroStatus("Todos");
    setFiltroOperador("Todos");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const [abaAtiva, setAbaAtiva] = useState<"rascunhos" | "finalizados">("rascunhos");

  const finalizados = filtered.filter(o => ["Protocolado", "Feito", "Respondido"].includes(o.status));
  const rascunhos = filtered.filter(o => !["Protocolado", "Feito", "Respondido"].includes(o.status));
  const listaExibida = abaAtiva === "rascunhos" ? rascunhos : finalizados;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Todos os Ofícios</h1>
          <p className="text-sm text-muted-foreground">{oficios.length} ofício(s) encontrado(s)</p>
        </div>
        <Button variant="outline" className="border-border text-foreground" onClick={() => exportToCSV(filtered as any)}>
          <FileSpreadsheet size={16} className="mr-2" /> Exportar Lista CSV
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setAbaAtiva("rascunhos")}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", abaAtiva === "rascunhos" ? "bg-yellow-500 text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
        >
          📝 Rascunhos ({rascunhos.length})
        </button>
        <button
          onClick={() => setAbaAtiva("finalizados")}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", abaAtiva === "finalizados" ? "bg-purple-600 text-white" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
        >
          📬 Finalizados ({finalizados.length})
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nome, número, bairro, operador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 bg-card border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos Status</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroOperador} onValueChange={setFiltroOperador}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue placeholder="Operador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos Operadores</SelectItem>
            {operadores.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal bg-card border-border", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal bg-card border-border", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
            <X size={14} className="mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>🔖</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : listaExibida.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum ofício encontrado.</TableCell></TableRow>
            ) : listaExibida.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.numero || "-"}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-lg cursor-pointer hover:opacity-80" title="Marcador">
                        {marcadorOptions.find(m => m.value === o.marcador)?.emoji || "⚪"}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuLabel>Marcador</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {marcadorOptions.map(m => (
                        <DropdownMenuItem key={m.value} onClick={() => handleMarcadorChange(o.id, m.value)} className={cn(o.marcador === m.value && "font-bold")}>
                          {m.emoji} {m.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleMarcadorChange(o.id, null)}>⚪ Remover</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>{o.assunto || "-"}</TableCell>
                <TableCell>{o.destinatario}</TableCell>
                <TableCell>
                  <div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(
                          "text-xs px-2 py-0.5 rounded font-medium inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity",
                          statusConfig[o.status]?.className || "bg-primary/20 text-primary",
                        )}>
                          {statusConfig[o.status]?.emoji || "⚪"} {o.status}
                          <ChevronDown size={12} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuLabel>Alterar status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {statusOptions.map(s => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStatusChange(o.id, s)}
                            className={cn(o.status === s && "font-bold")}
                          >
                            {statusConfig[s]?.emoji || "⚪"} {s}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {(o.status === "Exportado") && (o as any).uploaded_by_name && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">por {(o as any).uploaded_by_name}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.operador_nome || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <VersionHistoryDialog oficioId={o.id} oficioNumero={o.numero} onRestored={fetchOficios} />
                    <button onClick={() => handleOpenPreview(o)} className="p-2 text-muted-foreground hover:text-foreground" title="Visualizar"><Eye size={16} /></button>
                    <button
                      onClick={async () => {
                        if (!o.conteudo) return;
                        const imgs = await fetchSavedImages(o.id);
                        try {
                          await exportToWord({ ...buildExportData(o), imagens: imgs.length > 0 ? imgs : undefined });
                        } catch (e: any) {
                          toast({ title: "Falha ao gerar Word", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      title="Exportar Word"
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (!o.conteudo) return;
                        const imgs = await fetchSavedImages(o.id);
                        try {
                          await exportToPDF({ ...buildExportData(o), imagens: imgs.length > 0 ? imgs : undefined });
                        } catch (e: any) {
                          toast({ title: "Falha ao gerar PDF", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      title="Exportar PDF"
                    >
                      <Download size={16} />
                    </button>
                    {canEditOrDelete(o) && (
                      <>
                        <button onClick={() => handleEditForm(o)} className="p-2 text-muted-foreground hover:text-foreground" title="Editar"><Pencil size={16} /></button>
                        {isEspecial(o) ? (
                          <button
                            onClick={() => setExportConfirmOficio(o)}
                            disabled={isExportingAll}
                            className="p-2 text-primary hover:text-primary/80 disabled:opacity-50"
                            title="Exportar Tudo (PDF + Word + Drive)"
                          >
                            {isExportingAll ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUploadToDrive(o)}
                            disabled={isUploading}
                            className="p-2 text-muted-foreground hover:text-primary disabled:opacity-50"
                            title="Enviar ao Drive"
                          >
                            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                          </button>
                        )}
                        <button onClick={() => handleDelete(o.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Export Confirmation Dialog */}
      <Dialog open={!!exportConfirmOficio} onOpenChange={(open) => !open && setExportConfirmOficio(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">📄 Exportar Ofício</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Confirme a exportação completa (PDF + Word + Drive).
            </DialogDescription>
          </DialogHeader>
          {exportConfirmOficio && (() => {
            const data = buildExportData(exportConfirmOficio);
            const fileName = buildFileName(data.numero, data.solicitante, data.codigoZ, data.contatoSolicitante, (data as any).origem);
            return (
              <div className="space-y-3 text-sm">
                <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-foreground">Nome do arquivo: <span className="font-mono">{fileName}</span></p>
                  <p className="text-muted-foreground">📄 {fileName}.pdf</p>
                  <p className="text-muted-foreground">📝 {fileName}.docx</p>
                  <p className="text-muted-foreground">☁️ Drive: {fileName}.pdf</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setExportConfirmOficio(null)}>Cancelar</Button>
                  <Button size="sm" disabled={isExportingAll} onClick={() => handleExportAll(exportConfirmOficio)}>
                    {isExportingAll ? <Loader2 size={14} className="animate-spin mr-1" /> : <Package size={14} className="mr-1" />}
                    Confirmar e Exportar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={(open) => {
        if (!open && editedContent !== originalContent) {
          if (!confirm("Você tem edições não salvas. Deseja sair mesmo assim?")) return;
        }
        setShowPreview(open);
      }}>
        <DialogContent className="bg-card border-border max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {viewOficio && canEditOrDelete(viewOficio) && (
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (editedContent !== originalContent && !confirm("Você tem edições no preview. Deseja voltar mesmo assim?")) return;
                    handleEditForm(viewOficio);
                    setShowPreview(false);
                  }}>
                    <ArrowLeft size={14} className="mr-1" /> Editar Dados
                  </Button>
                )}
                <span>Visualizar Ofício</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${saveStatus === "saving" ? "text-muted-foreground" : saveStatus === "saved" ? "text-green-600" : saveStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {saveStatus === "saving" && "● Salvando..."}
                  {saveStatus === "saved" && "✓ Salvo"}
                  {saveStatus === "error" && "✗ Erro ao salvar"}
                </span>
                <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10" disabled={revisaoLoading} onClick={() => {
                  if (!viewOficio) return;
                  revisarOficio({
                    numero: viewOficio.numero || "",
                    secretaria: (viewOficio as any).secretaria_identificada || "",
                    destinatario: viewOficio.destinatario || "",
                    assunto: viewOficio.assunto || "",
                    endereco_completo: (viewOficio as any).endereco_completo || viewOficio.bairro || "",
                    vocativo: getVocativo((viewOficio as any).secretaria_identificada || ""),
                    conteudo: editedContent || viewOficio.conteudo || "",
                  });
                }}>
                  {revisaoLoading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <SearchCheck size={14} className="mr-1" />} Revisar
                </Button>
                <Button size="sm" variant="default" onClick={() => handleSaveContent()}>
                  <Save size={14} className="mr-1" /> Salvar
                </Button>
                {editedContent !== originalContent && (
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                    if (confirm("Deseja descartar todas as edições e voltar ao texto original?")) {
                      setEditedContent(originalContent);
                      editedContentRef.current = originalContent;
                      setEditorKey(prev => prev + 1);
                      setSaveStatus("idle");
                    }
                  }}>
                    ↺ Restaurar original
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!viewOficio) return;
                  const imgs = await fetchSavedImages(viewOficio.id);
                  try {
                    await exportToWord({ ...buildExportData(viewOficio), conteudo: editedContent, imagens: imgs.length > 0 ? imgs : undefined });
                  } catch (e: any) {
                    toast({ title: "Falha ao gerar Word", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                  }
                }}>
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button size="sm" variant="outline" onClick={async () => {
                  if (!viewOficio) return;
                  const imgs = await fetchSavedImages(viewOficio.id);
                  try {
                    await exportToPDF({ ...buildExportData(viewOficio), conteudo: editedContent, imagens: imgs.length > 0 ? imgs : undefined });
                  } catch (e: any) {
                    toast({ title: "Falha ao gerar PDF", description: e?.message || "Tente novamente em instantes.", variant: "destructive" });
                  }
                }}>
                  <Download size={14} className="mr-1" /> PDF
                </Button>
                {viewOficio && canEditOrDelete(viewOficio) && (
                  <Button size="sm" variant="outline" disabled={isUploading} onClick={() => { if (viewOficio) handleUploadToDrive(viewOficio); }}>
                    {isUploading ? <Loader2 size={14} className="mr-1 animate-spin" /> : <CloudUpload size={14} className="mr-1" />} Drive
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewOficio && (
            <>
            <PreviewFormatToolbar options={formatOptions} onChange={setFormatOptions} />
            <div className="overflow-x-auto border border-border rounded-lg mt-2" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <OficioPreview
                key={editorKey}
                ref={previewRef}
                numero={viewOficio.numero || ""}
                destinatario={viewOficio.destinatario}
                assunto={viewOficio.assunto}
                conteudo={editedContent}
                bairro={viewOficio.bairro || undefined}
                cargoDestinatario={viewOficio.cargo_destinatario || undefined}
                operadorNome={viewOficio.operador_nome || undefined}
                dataGeracao={viewOficio.data_geracao || undefined}
                formatOptions={formatOptions}
                editable
                onContentChange={handleContentChange}
                onNumeroChange={(val) => handleInlineFieldChange("numero", val)}
                onAssuntoChange={(val) => handleInlineFieldChange("assunto", val)}
                onCargoDestinatarioChange={(val) => handleInlineFieldChange("cargo_destinatario", val)}
                onDataChange={undefined}
                onIncreaseFontSize={() => setFormatOptions((prev) => ({ ...prev, fontSize: Math.min(20, prev.fontSize + 1) }))}
                onDecreaseFontSize={() => setFormatOptions((prev) => ({ ...prev, fontSize: Math.max(8, prev.fontSize - 1) }))}
                initialConteudo={originalContent}
                anexoImageUrls={previewAnexoUrls}
                anexoDocuments={previewAnexoDocs}
              />
            </div>
            </>
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
          if (!viewOficio) return;
          if (campo === "assunto") {
            handleInlineFieldChange("assunto", correcao);
          } else if (campo === "destinatario") {
            handleInlineFieldChange("destinatario", correcao);
          } else if (campo === "vocativo" || campo === "cargo_destinatario") {
            handleInlineFieldChange("cargo_destinatario", correcao);
          }
        }}
        onCorrigirTudo={() => {
          if (!viewOficio || !revisaoResult?.erros) return;
          for (const erro of revisaoResult.erros) {
            if (!erro.correcao) continue;
            if (erro.campo === "assunto") handleInlineFieldChange("assunto", erro.correcao);
            else if (erro.campo === "destinatario") handleInlineFieldChange("destinatario", erro.correcao);
            else if (erro.campo === "vocativo") handleInlineFieldChange("cargo_destinatario", erro.correcao);
          }
          toast({ title: "✅ Correções aplicadas!" });
        }}
        onExportarMesmoAssim={() => {
          setRevisaoOpen(false);
          if (pendingExportAction) {
            pendingExportAction();
            setPendingExportAction(null);
          }
        }}
      />
    </div>
  );
}
