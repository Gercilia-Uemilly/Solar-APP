import { useState, useMemo } from "react";
import { Plus, Search, Star, Copy, Pencil, Trash2 } from "lucide-react";
import { store } from "@/lib/store";
import { Script } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function ScriptsPage() {
  const [scripts, setScripts] = useState(() => store.getScripts());
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [showDialog, setShowDialog] = useState(false);
  const { toast } = useToast();

  // Form
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tags, setTags] = useState("");

  const categorias = useMemo(() => {
    const cats = new Set(scripts.map((s) => s.categoria));
    return Array.from(cats);
  }, [scripts]);

  const filtered = useMemo(() => {
    return scripts.filter((s) => {
      if (filtroCategoria === "Favoritos" && !s.favorito) return false;
      if (filtroCategoria !== "Todas" && filtroCategoria !== "Favoritos" && s.categoria !== filtroCategoria) return false;
      if (search) {
        const q = search.toLowerCase();
        return s.titulo.toLowerCase().includes(q) || s.conteudo.toLowerCase().includes(q) || s.tags.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [scripts, filtroCategoria, search]);

  const handleCreate = () => {
    const novo: Script = {
      id: Date.now().toString(),
      titulo,
      conteudo,
      categoria: categoria || "Outros",
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      favorito: false,
      criadoEm: new Date().toISOString(),
    };
    store.addScript(novo);
    setScripts(store.getScripts());
    setShowDialog(false);
    setTitulo(""); setConteudo(""); setCategoria(""); setTags("");
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Script copiado para a área de transferência." });
  };

  const handleToggleFav = (id: string) => {
    store.toggleFavorite(id);
    setScripts(store.getScripts());
  };

  const handleDelete = (id: string) => {
    store.deleteScript(id);
    setScripts(store.getScripts());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scripts de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Respostas prontas para WhatsApp · {scripts.length} script(s)</p>
        </div>
        <Button onClick={() => setShowDialog(true)} className="bg-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Novo Script
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar scripts, tags, palavras-chave..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {["Todas", "Favoritos", ...categorias].map((c) => (
          <button
            key={c}
            onClick={() => setFiltroCategoria(c)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              filtroCategoria === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
            }`}
          >
            {c === "Favoritos" && "☆ "}{c}
          </button>
        ))}
      </div>

      {/* Scripts List */}
      <div className="space-y-4">
        {filtered.map((s) => (
          <div key={s.id} className="bg-card rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggleFav(s.id)} className={`${s.favorito ? "text-status-pending" : "text-muted-foreground"} hover:text-status-pending`}>
                  <Star size={16} fill={s.favorito ? "currentColor" : "none"} />
                </button>
                <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary font-medium">{s.categoria}</span>
                <span className="text-sm font-semibold text-foreground">{s.titulo}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleCopy(s.conteudo)} className="p-2 text-muted-foreground hover:text-foreground"><Copy size={14} /></button>
                <button className="p-2 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(s.id)} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">{s.conteudo}</p>
            {s.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {s.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Script</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-secondary border-border" />
            <Textarea placeholder="Conteúdo do script..." value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="bg-secondary border-border min-h-[120px]" />
            <Input placeholder="Tags (separadas por vírgula)" value={tags} onChange={(e) => setTags(e.target.value)} className="bg-secondary border-border" />
            <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">Criar Script</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
