import { useState } from "react";
import { Plus, Search, Eye, Pencil, Trash2, Landmark } from "lucide-react";
import { store } from "@/lib/store";
import { Oficio, OficioStatus } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusOptions: OficioStatus[] = ["Rascunho", "Gerado", "Assinado", "Enviado", "Respondido", "Arquivado"];

export default function Oficios() {
  const [oficios, setOficios] = useState(() => store.getOficios());
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [showDialog, setShowDialog] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [destinatario, setDestinatario] = useState("");

  const filtered = oficios.filter((o) => {
    if (filtroStatus !== "Todos" && o.status !== filtroStatus) return false;
    if (search && !o.assunto.toLowerCase().includes(search.toLowerCase()) && !o.destinatario.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = () => {
    const novo: Oficio = {
      id: Date.now().toString(),
      assunto,
      destinatario,
      status: "Rascunho",
      criadoEm: new Date().toLocaleDateString("pt-BR"),
    };
    store.addOficio(novo);
    setOficios(store.getOficios());
    setShowDialog(false);
    setAssunto(""); setDestinatario("");
  };

  const handleDelete = (id: string) => {
    store.deleteOficio(id);
    setOficios(store.getOficios());
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("pt-BR");
    } catch {
      return d;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Ofícios</h1>
          <p className="text-sm text-muted-foreground">{oficios.length} ofício(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-border text-foreground">Relatório</Button>
          <Button onClick={() => setShowDialog(true)} className="bg-primary text-primary-foreground">
            <Plus size={16} className="mr-1" /> Novo Ofício
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ofícios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            {statusOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.map((o) => (
          <div key={o.id} className="bg-card rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">{o.status}</span>
                {o.numero && <span className="text-xs text-muted-foreground">Nº {o.numero}</span>}
                <span className="text-xs text-muted-foreground">{formatDate(o.criadoEm)}</span>
              </div>
              {o.assunto && <p className="text-sm font-semibold text-foreground">{o.assunto}</p>}
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <Landmark size={12} />
                {o.destinatario}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 text-muted-foreground hover:text-foreground"><Eye size={16} /></button>
              <button className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={16} /></button>
              <button onClick={() => handleDelete(o.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Ofício</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Destinatário" value={destinatario} onChange={(e) => setDestinatario(e.target.value)} className="bg-secondary border-border" />
            <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">Criar Ofício</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
