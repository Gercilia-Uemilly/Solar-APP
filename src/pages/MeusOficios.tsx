import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Pencil, Trash2, Download, Search, FileText, FileSpreadsheet } from "lucide-react";
import OficioPreview from "@/components/OficioPreview";
import { exportToWord, exportToPDF, exportToCSV } from "@/lib/exportOficio";
import logoCamara from "@/assets/logo-camara.png";
import logoFabao from "@/assets/logo-fabao.png";

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
  profiles?: { full_name: string | null };
}

const statusOptions = ["Rascunho", "Gerado", "Assinado", "Enviado", "Respondido", "Arquivado"];

export default function MeusOficios() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  // View / Edit
  const [viewOficio, setViewOficio] = useState<OficioRow | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const fetchOficios = async () => {
    setLoading(true);
    const q = supabase.from("oficios").select("*, profiles(full_name)").order("created_at", { ascending: false });
    const { data, error } = await q;
    if (error) {
      toast({ title: "Erro ao buscar ofícios", description: error.message, variant: "destructive" });
    } else {
      setOficios((data as unknown as OficioRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchOficios(); }, []);

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
    if (search) {
      const s = search.toLowerCase();
      return o.assunto.toLowerCase().includes(s) || o.destinatario.toLowerCase().includes(s) || (o.numero || "").toLowerCase().includes(s);
    }
    return true;
  });

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
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40 bg-card border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
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
                {isAdmin && <TableCell className="text-sm text-muted-foreground">{o.profiles?.full_name || "-"}</TableCell>}
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
                            logoCamaraUrl: logoCamara,
                            logoFabaoUrl: logoFabao,
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
                        logoCamaraUrl: logoCamara,
                        logoFabaoUrl: logoFabao,
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
                    if (previewRef.current) {
                      await exportToPDF(previewRef.current, viewOficio?.numero || "");
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
