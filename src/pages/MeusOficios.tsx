import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
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
import { Eye, Trash2, Download, Search, FileText, FileSpreadsheet, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import OficioPreview from "@/components/OficioPreview";
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
  
}

const statusOptions = ["Rascunho", "Gerado", "Assinado", "Enviado", "Respondido", "Arquivado"];

export default function MeusOficios() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroOperador, setFiltroOperador] = useState("Todos");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // View / Edit
  const [viewOficio, setViewOficio] = useState<OficioRow | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchOficios = async () => {
    setLoading(true);
    const q = supabase.from("oficios").select("*").order("created_at", { ascending: false });
    const { data, error } = await q;
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
    oficios.forEach(o => {
      const name = o.operador_nome;
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [oficios]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("oficios").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setOficios(prev => prev.filter(o => o.id !== id));
      toast({ title: "Ofício excluído" });
    }
  };

  const filtered = oficios.filter(o => {
    if (filtroStatus !== "Todos" && o.status !== filtroStatus) return false;
    if (filtroOperador !== "Todos") {
      const opName = o.operador_nome || "";
      if (opName !== filtroOperador) return false;
    }
    if (dateFrom) {
      const d = new Date(o.created_at);
      if (d < dateFrom) return false;
    }
    if (dateTo) {
      const d = new Date(o.created_at);
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      return (
        o.assunto.toLowerCase().includes(s) ||
        o.destinatario.toLowerCase().includes(s) ||
        (o.numero || "").toLowerCase().includes(s) ||
        (o.solicitante || "").toLowerCase().includes(s) ||
        (o.bairro || "").toLowerCase().includes(s) ||
        (o.contato_solicitante || "").toLowerCase().includes(s)
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
          <h1 className="text-2xl font-bold text-foreground">{isAdmin ? "Todos os Ofícios" : "Meus Ofícios"}</h1>
          <p className="text-sm text-muted-foreground">{oficios.length} ofício(s) encontrado(s)</p>
        </div>
        {isAdmin && (
          <Button variant="outline" className="border-border text-foreground" onClick={() => exportToCSV(filtered as any)}>
            <FileSpreadsheet size={16} className="mr-2" /> Exportar Lista CSV
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nome, número, bairro, telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
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
              {isAdmin && <TableHead>Autor</TableHead>}
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">Nenhum ofício encontrado.</TableCell></TableRow>
            ) : filtered.map(o => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.numero || "-"}</TableCell>
                <TableCell>{o.assunto || "-"}</TableCell>
                <TableCell>{o.destinatario}</TableCell>
                <TableCell>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">{o.status}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{new Date(o.created_at).toLocaleDateString("pt-BR")}</TableCell>
                {isAdmin && <TableCell className="text-sm text-muted-foreground">{o.operador_nome || "-"}</TableCell>}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setViewOficio(o); setShowPreview(true); }} className="p-2 text-muted-foreground hover:text-foreground"><Eye size={16} /></button>
                    <button
                      onClick={() => {
                        if (o.conteudo) {
                          exportToWord({
                            numero: o.numero || "",
                            destinatario: o.destinatario,
                            assunto: o.assunto,
                            conteudo: o.conteudo,
                            bairro: (o as any).bairro || "",
                            logoCamaraUrl: logoCamara,
                            logoFabaoUrl: logoFabao,
                            assinaturaUrl: assinaturaFabao,
                          });
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      title="Exportar Word"
                    >
                      <FileText size={16} />
                    </button>
                    <button onClick={() => handleDelete(o.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="bg-card border-border max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              <span>Visualizar Ofício</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (viewOficio?.conteudo) {
                      exportToWord({
                        numero: viewOficio.numero || "",
                        destinatario: viewOficio.destinatario,
                        assunto: viewOficio.assunto,
                        conteudo: viewOficio.conteudo,
                        bairro: (viewOficio as any).bairro || "",
                        logoCamaraUrl: logoCamara,
                        logoFabaoUrl: logoFabao,
                        assinaturaUrl: assinaturaFabao,
                      });
                    }
                  }}
                >
                  <FileText size={14} className="mr-1" /> Word
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (viewOficio?.conteudo) {
                      await exportToPDF({
                        numero: viewOficio.numero || "",
                        destinatario: viewOficio.destinatario,
                        assunto: viewOficio.assunto,
                        conteudo: viewOficio.conteudo,
                        bairro: (viewOficio as any).bairro || "",
                        cargoDestinatario: (viewOficio as any).cargo_destinatario || "",
                      });
                    }
                  }}
                >
                  <Download size={14} className="mr-1" /> PDF
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          {viewOficio && (
            <div className="overflow-x-auto">
              <OficioPreview
                ref={previewRef}
                numero={viewOficio.numero || ""}
                destinatario={viewOficio.destinatario}
                assunto={viewOficio.assunto}
                conteudo={viewOficio.conteudo || ""}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
