import { useState, useMemo } from "react";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { store } from "@/lib/store";
import { Demanda, DemandaTipo, DemandaStatus } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tipos: DemandaTipo[] = ["Solicitação", "Reclamação", "Denúncia", "Sugestão", "Informação", "Outro"];
const statuses: DemandaStatus[] = ["Pendente", "Em Andamento", "Concluída", "Cancelada"];

export default function Demandas() {
  const [demandas, setDemandas] = useState(() => store.getDemandas());
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("Todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showDialog, setShowDialog] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<DemandaTipo>("Solicitação");
  const [prioridade, setPrioridade] = useState<"Normal" | "Urgente">("Normal");
  const [solicitante, setSolicitante] = useState("");
  const [bairro, setBairro] = useState("");

  const filtered = useMemo(() => {
    return demandas.filter((d) => {
      if (filtroTipo !== "Todos" && d.tipo !== filtroTipo) return false;
      if (filtroStatus !== "Todos" && d.status !== filtroStatus) return false;
      if (search && !d.titulo.toLowerCase().includes(search.toLowerCase()) && !d.solicitante.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [demandas, filtroTipo, filtroStatus, search]);

  const handleCreate = () => {
    const novaDemanda: Demanda = {
      id: Date.now().toString(),
      titulo,
      descricao,
      tipo,
      status: "Pendente",
      prioridade,
      solicitante,
      bairro,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    store.addDemanda(novaDemanda);
    setDemandas(store.getDemandas());
    setShowDialog(false);
    setTitulo(""); setDescricao(""); setSolicitante(""); setBairro("");
  };

  const handleDelete = (id: string) => {
    store.deleteDemanda(id);
    setDemandas(store.getDemandas());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Demandas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {demandas.length} demanda(s)</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Nova Demanda
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="bg-card rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar demandas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 rounded-lg ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            <List size={16} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {["Todos", ...tipos].map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filtroTipo === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {t}
            </button>
          ))}

          {["Todos", ...statuses].map((s) => (
            <button
              key={`s-${s}`}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filtroStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">Nenhuma demanda encontrada</p>
          <button onClick={() => setShowDialog(true)} className="text-primary text-sm mt-2 hover:underline">+ Criar nova demanda</button>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-2 gap-4" : "space-y-3"}>
          {filtered.map((d) => (
            <div key={d.id} className="bg-card rounded-xl p-4 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{d.tipo}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">{d.status}</span>
                  {d.prioridade === "Urgente" && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Urgente</span>}
                </div>
                <p className="text-sm font-semibold text-foreground">{d.titulo}</p>
                <p className="text-xs text-muted-foreground mt-1">{d.solicitante} {d.bairro && `· ${d.bairro}`}</p>
              </div>
              <button onClick={() => handleDelete(d.id)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Demanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Solicitante" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} className="bg-secondary border-border" />
            <Textarea placeholder="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="bg-secondary border-border" />
            <div className="grid grid-cols-2 gap-3">
              <Select value={tipo} onValueChange={(v) => setTipo(v as DemandaTipo)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={prioridade} onValueChange={(v) => setPrioridade(v as "Normal" | "Urgente")}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal</SelectItem>
                  <SelectItem value="Urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">Criar Demanda</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
