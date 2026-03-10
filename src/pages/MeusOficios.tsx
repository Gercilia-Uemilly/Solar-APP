import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Eye, Trash2, Download, Search, FileText, FileSpreadsheet, CalendarIcon, X, CloudUpload, Loader2, Pencil, ArrowLeft, Save, ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import OficioPreview from "@/components/OficioPreview";
import { defaultFormatOptions } from "@/components/PreviewFormatToolbar";
import type { FormatOptions } from "@/components/PreviewFormatToolbar";
import { exportToWord, exportToPDF, exportToCSV } from "@/lib/exportOficio";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";
import assinaturaFabao from "@/assets/assinatura-fabao.png";

interface OficioRow {
  id: string;
  numero: string | null;
  assunto: string;
  destinatario: string;
  status: string;
  conteudo: string | null;
  resposta_cidadao: string | null;
  secretaria_identificada: string | null;
  tipo_demanda: string | null;
  urgencia: string | null;
  author_id: string;
  created_at: string;
  updated_at: string;
  solicitante: string | null;
  bairro: string | null;
  contato_solicitante: string | null;
  operador_nome: string | null;
  link_pdf_drive: string | null;
  cargo_destinatario: string | null;
  local_demanda: string | null;
  data_geracao: string | null;
  linha_telefonica: string | null;
  ano: number | null;
}

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
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroOperador, setFiltroOperador] = useState("Todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [isUploading, setIsUploading] = useState(false);
  const [profileName, setProfileName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name").eq("id", user.id).single().then(({ data }) => {
      if (data?.full_name) setProfileName(data.full_name);
    });
  }, [user]);

  // View
  const [viewOficio, setViewOficio] = useState<OficioRow | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [editedContent, setEditedContent] = useState<string>("");
  const [originalContent, setOriginalContent] = useState<string>("");
  const previewRef = useRef<HTMLDivElement>(null);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(defaultFormatOptions);

  const handleOpenPreview = async (o: OficioRow) => {
    // Check for concurrent edits before opening
    const { data: latest } = await supabase.from("oficios").select("conteudo, last_edited_by_name, last_edited_at, updated_at").eq("id", o.id).single();
    if (latest && latest.last_edited_by_name && latest.last_edited_at) {
      const editDate = new Date(latest.last_edited_at);
      const timeDiff = Date.now() - editDate.getTime();
      // Show warning if edited by someone else in last 30 minutes
      if (timeDiff < 30 * 60 * 1000 && latest.last_edited_by_name !== (profileName || user?.email)) {
        const formattedDate = editDate.toLocaleString("pt-BR");
        if (!confirm(`Este ofício foi editado por ${latest.last_edited_by_name} em ${formattedDate}. Deseja carregar a versão mais recente?`)) {
          return;
        }
        // Use latest version from DB
        o = { ...o, conteudo: latest.conteudo };
      }
    }
    setViewOficio(o);
    setEditedContent(o.conteudo || "");
    setOriginalContent(o.conteudo || "");
    setShowPreview(true);
  };

  const handleSaveContent = async () => {
    if (!viewOficio || editedContent === originalContent) return;
    const updatePayload: Record<string, any> = { 
      conteudo: editedContent,
      status: "Salvo",
      last_edited_by: user?.id || null,
      last_edited_by_name: profileName || user?.email || null,
      last_edited_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("oficios").update(updatePayload).eq("id", viewOficio.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conteúdo salvo!" });
      setOriginalContent(editedContent);
      setViewOficio({ ...viewOficio, conteudo: editedContent, status: "Salvo" });
      setOficios(prev => prev.map(o => o.id === viewOficio.id ? { ...o, conteudo: editedContent, status: "Salvo" } : o));
    }
  };

  const handleEditForm = (o: OficioRow) => {
    navigate("/oficios", { state: { editOficio: o } });
  };

  const fetchOficios = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("oficios").select("*").order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao buscar ofícios", description: error.message, variant: "destructive" });
    } else {
      setOficios((data as unknown as OficioRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOficios(); }, []);

  const operadores = useMemo(() => {
    const names = new Set<string>();
    oficios.forEach(o => { if (o.operador_nome) names.add(o.operador_nome); });
    return Array.from(names).sort();
  }, [oficios]);

  const canEditOrDelete = (o: OficioRow) => {
    if (!user) return false;
    return true;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("oficios").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setOficios(prev => prev.filter(o => o.id !== id));
      toast({ title: "Ofício excluído" });
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
    operadorNome: o.operador_nome || profileName || user?.email || undefined,
    telefone: o.linha_telefonica || undefined,
    solicitante: o.solicitante || undefined,
    logoCamaraUrl: logoCamara,
    logoFabaoUrl: logoFabao,
    assinaturaUrl: assinaturaFabao,
  });

  const handleUploadToDrive = async (oficio: OficioRow) => {
    if (!oficio.conteudo) {
      toast({ title: "Sem conteúdo", description: "Gere o texto do ofício antes de enviar.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sessão expirada", description: "Faça login novamente.", variant: "destructive" });
        return;
      }
      const authToken = session.access_token;
      const wordBlob = await exportToWord({
        ...buildExportData(oficio),
        conteudo: oficio.conteudo,
      });
      const numLimpo = (oficio.numero || "rascunho").replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '').trim();
      const solCode = (oficio.solicitante || "").trim().split(/\s+/)[0]?.replace(/[<>:"/\\|?*]/g, '').substring(0, 30) || "";
      const baseFileName = solCode ? `${numLimpo} ${solCode}` : numLimpo;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const convertFormData = new FormData();
      convertFormData.append("file", wordBlob, `${numLimpo}.docx`);
      const convertResp = await fetch(`${supabaseUrl}/functions/v1/convert-to-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: convertFormData,
      });

      let uploadBlob: Blob;
      let uploadFileName: string;

      if (convertResp.ok && (convertResp.headers.get("content-type") || "").includes("application/pdf")) {
        uploadBlob = await convertResp.blob();
        uploadFileName = `${baseFileName}.pdf`;
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
      toast({ title: "✅ Enviado ao Drive!", description: uploadFileName.endsWith(".pdf") ? "PDF enviado!" : "Enviado como Word." });
    } catch (e: any) {
      toast({ title: "Erro ao enviar", description: e.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setIsUploading(false);
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
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum ofício encontrado.</TableCell></TableRow>
            ) : filtered.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.numero || "-"}</TableCell>
                <TableCell>{o.assunto || "-"}</TableCell>
                <TableCell>{o.destinatario}</TableCell>
                <TableCell>
                  <div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      o.status === "Rascunho" && "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
                      o.status === "Salvo" && "bg-green-500/20 text-green-700 dark:text-green-400",
                      o.status === "Exportado" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
                      o.status === "Salvo no Drive" && "bg-sky-500/20 text-sky-700 dark:text-sky-400",
                      !["Rascunho","Salvo","Exportado","Salvo no Drive"].includes(o.status) && "bg-primary/20 text-primary",
                    )}>
                      {o.status === "Rascunho" && "🟡 "}{o.status === "Salvo" && "🟢 "}{o.status === "Exportado" && "🔵 "}{o.status === "Salvo no Drive" && "☁️ "}{o.status}
                    </span>
                    {o.status === "Salvo no Drive" && (o as any).uploaded_by_name && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">por {(o as any).uploaded_by_name}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.operador_nome || "-"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleOpenPreview(o)} className="p-2 text-muted-foreground hover:text-foreground" title="Visualizar"><Eye size={16} /></button>
                    <button
                      onClick={() => { if (o.conteudo) exportToWord(buildExportData(o)); }}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      title="Exportar Word"
                    >
                      <FileText size={16} />
                    </button>
                    <button
                      onClick={async () => { if (o.conteudo) await exportToPDF(buildExportData(o)); }}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      title="Exportar PDF"
                    >
                      <Download size={16} />
                    </button>
                    {canEditOrDelete(o) && (
                      <>
                        <button onClick={() => handleEditForm(o)} className="p-2 text-muted-foreground hover:text-foreground" title="Editar"><Pencil size={16} /></button>
                        <button
                          onClick={() => handleUploadToDrive(o)}
                          disabled={isUploading}
                          className="p-2 text-muted-foreground hover:text-primary disabled:opacity-50"
                          title="Enviar ao Drive"
                        >
                          {isUploading ? <Loader2 size={16} className="animate-spin" /> : <CloudUpload size={16} />}
                        </button>
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
              <div className="flex gap-2">
                {editedContent !== originalContent && (
                  <Button size="sm" variant="default" onClick={handleSaveContent}>
                    <Save size={14} className="mr-1" /> Salvar
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => { if (viewOficio) exportToWord({ ...buildExportData(viewOficio), conteudo: editedContent }); }}>
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button size="sm" variant="outline" onClick={async () => { if (viewOficio) await exportToPDF({ ...buildExportData(viewOficio), conteudo: editedContent }); }}>
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
            <div className="overflow-x-auto border border-border rounded-lg" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <OficioPreview
                ref={previewRef}
                numero={viewOficio.numero || ""}
                destinatario={viewOficio.destinatario}
                assunto={viewOficio.assunto}
                conteudo={editedContent}
                bairro={viewOficio.bairro || undefined}
                cargoDestinatario={viewOficio.cargo_destinatario || undefined}
                operadorNome={viewOficio.operador_nome || undefined}
                formatOptions={formatOptions}
                editable
                onContentChange={setEditedContent}
                initialConteudo={originalContent}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
