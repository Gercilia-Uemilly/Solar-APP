import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Search, FolderOpen, Folder, FileText, Copy, Check, X, ChevronRight, ChevronDown, Star, Pencil, Trash2, Sparkles, Plus, Flame, Clock, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { getAcessos, registrarAcesso, getHistoricoBusca, registrarBusca } from "@/lib/bancoDestaques";
import { useAuth } from "@/hooks/useAuth";

interface ScriptRow {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  tags: string[];
  favorito: boolean;
  author_id: string;
  created_at: string;
}

interface ScriptsExplorerProps {
  scripts: ScriptRow[];
  loading: boolean;
  onEdit: (s: ScriptRow) => void;
  onDelete: (id: string) => void;
  onToggleFav: (s: ScriptRow) => void;
  onNewScript: () => void;
  onAIScript: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "ANIMAIS": "hsl(37 92% 50%)",
  "SAÚDE": "hsl(0 72% 51%)",
  "JURÍDICO": "hsl(239 84% 67%)",
  "EDUCAÇÃO": "hsl(217 91% 60%)",
  "EMPREGO": "hsl(160 84% 39%)",
  "SOCIAL": "hsl(258 90% 66%)",
  "TRANSPORTE": "hsl(188 95% 43%)",
  "DMAE E CEMIG": "hsl(25 95% 53%)",
  "CASAS POPULARES": "hsl(347 77% 50%)",
  "ESPORTE": "hsl(84 81% 44%)",
  "MEIO AMBIENTE": "hsl(142 71% 29%)",
  "REQUERIMENTOS": "hsl(215 16% 47%)",
  "PEDIDOS DE AJUDA": "hsl(330 81% 60%)",
  "ARQUIVOS TEMPORÁRIOS": "hsl(0 0% 45%)",
};

function getCatColor(cat: string): string {
  return CATEGORY_COLORS[cat.toUpperCase()] || "hsl(var(--primary))";
}

export default function ScriptsExplorer({ scripts, loading, onEdit, onDelete, onToggleFav, onNewScript, onAIScript }: ScriptsExplorerProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<ScriptRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [favOnly, setFavOnly] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [acessos, setAcessos] = useState(() => getAcessos(user?.id));
  const [historico, setHistorico] = useState(() => getHistoricoBusca(user?.id));
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Group scripts by category
  const grouped = useMemo(() => {
    const map = new Map<string, ScriptRow[]>();
    scripts.forEach(s => {
      const cat = s.categoria || "Sem Categoria";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    });
    // Sort categories alphabetically; scripts within: favoritos first, then by access count
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    sorted.forEach(([, items]) => {
      items.sort((a, b) => {
        if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
        return (acessos[b.id] || 0) - (acessos[a.id] || 0);
      });
    });
    return new Map(sorted);
  }, [scripts, acessos]);

  // Filter by search + favoritos
  const filteredGrouped = useMemo(() => {
    const q = search.toLowerCase();
    const result = new Map<string, ScriptRow[]>();
    grouped.forEach((items, cat) => {
      const catMatch = q && cat.toLowerCase().includes(q);
      let filtered = items.filter(s =>
        !q || catMatch || s.titulo.toLowerCase().includes(q) || s.conteudo.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q))
      );
      if (favOnly) filtered = filtered.filter(s => s.favorito);
      if (filtered.length > 0) result.set(cat, filtered);
    });
    return result;
  }, [grouped, search, favOnly]);

  // Auto-open folders when searching
  const visibleFolders = useMemo(() => {
    if (search || favOnly) return new Set(filteredGrouped.keys());
    return openFolders;
  }, [search, favOnly, filteredGrouped, openFolders]);

  // Mais usados (top acessos)
  const maisUsados = useMemo(() => {
    return [...scripts]
      .filter(s => (acessos[s.id] || 0) > 0)
      .sort((a, b) => (acessos[b.id] || 0) - (acessos[a.id] || 0))
      .slice(0, 6);
  }, [scripts, acessos]);

  // Suggestions: history + titles + categories + tags matching input
  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = new Set<string>();
    if (!q) {
      historico.slice(0, 8).forEach(h => pool.add(h));
      return [...pool];
    }
    historico.filter(h => h.toLowerCase().includes(q)).forEach(h => pool.add(h));
    scripts.forEach(s => {
      if (s.titulo.toLowerCase().includes(q)) pool.add(s.titulo);
      if (s.categoria?.toLowerCase().includes(q)) pool.add(s.categoria);
      s.tags?.forEach(t => { if (t.toLowerCase().includes(q)) pool.add(t); });
    });
    return [...pool].slice(0, 8);
  }, [search, historico, scripts]);

  const toggleFolder = (cat: string) => {
    if (search) return; // Don't toggle during search
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
    setSelectedFolder(cat);
    setSelectedScript(null);
  };

  const selectScript = (s: ScriptRow) => {
    setSelectedScript(s);
    setSelectedFolder(s.categoria);
    setAcessos(registrarAcesso(s.id, user?.id));
    if (search.trim()) setHistorico(registrarBusca(search, user?.id));
  };

  const handleCopy = useCallback((s: ScriptRow) => {
    navigator.clipboard.writeText(s.conteudo);
    setCopiedId(s.id);
    setAcessos(registrarAcesso(s.id, user?.id));
    toast.success("Script copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2000);
  }, [user?.id]);

  const totalFiltered = useMemo(() => {
    let count = 0;
    filteredGrouped.forEach(items => count += items.length);
    return count;
  }, [filteredGrouped]);

  // Content for right panel
  const folderScripts = selectedFolder ? (filteredGrouped.get(selectedFolder) || []) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mr-3" />
        Carregando scripts...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top bar: search + actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]" ref={searchRef}>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <Input
            placeholder="Buscar script por título, categoria ou palavra-chave..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            className="pl-11 h-11 text-sm bg-card border-border rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground z-10">
              <X size={14} />
            </button>
          )}
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-30 overflow-hidden">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border/50">
                {search.trim() ? "Sugestões" : "Buscas recentes"}
              </p>
              {suggestions.map((sug, i) => {
                const isHistory = historico.some(h => h.toLowerCase() === sug.toLowerCase());
                return (
                  <button
                    key={i}
                    onClick={() => { setSearch(sug); setShowSuggestions(false); setHistorico(registrarBusca(sug, user?.id)); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-foreground/90 hover:bg-muted transition-colors"
                  >
                    {isHistory ? <Clock size={13} className="text-muted-foreground flex-shrink-0" /> : <TrendingUp size={13} className="text-primary flex-shrink-0" />}
                    <span className="truncate">{sug}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={favOnly ? "default" : "outline"}
          onClick={() => setFavOnly(v => !v)}
          className="gap-1.5 h-9"
        >
          <Star size={13} fill={favOnly ? "currentColor" : "none"} /> Favoritos
        </Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onAIScript} className="gap-1.5 h-9">
            <Sparkles size={13} /> Gerar com IA
          </Button>
          <Button size="sm" onClick={onNewScript} className="gap-1.5 h-9">
            <Plus size={13} /> Novo Script
          </Button>
        </div>
      </div>

      {/* Mais usados */}
      {maisUsados.length > 0 && !search && !favOnly && (
        <div className="border border-border rounded-xl bg-card p-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Flame size={12} className="text-primary" /> Mais usados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {maisUsados.map(s => (
              <button
                key={s.id}
                onClick={() => selectScript(s)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-muted hover:bg-primary/10 hover:text-primary text-foreground/80 transition-colors"
              >
                {s.favorito && <Star size={10} fill="currentColor" className="text-primary" />}
                <span className="max-w-[220px] truncate">{s.titulo}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{acessos[s.id]}×</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        <span className="font-bold text-foreground">{totalFiltered}</span> script{totalFiltered !== 1 ? "s" : ""} em{" "}
        <span className="font-bold text-foreground">{filteredGrouped.size}</span> categoria{filteredGrouped.size !== 1 ? "s" : ""}
        {favOnly && <span className="ml-1 text-primary">(somente favoritos)</span>}
      </p>

      {/* Explorer layout */}
      <div className="flex border border-border rounded-xl overflow-hidden bg-card" style={{ minHeight: "520px" }}>
        {/* Left panel: folder tree */}
        <div className="w-[280px] flex-shrink-0 border-r border-border bg-muted/30">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Categorias</p>
          </div>
          <ScrollArea className="h-[480px]">
            <div className="p-1.5">
              {filteredGrouped.size === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma categoria encontrada</p>
              ) : (
                Array.from(filteredGrouped.entries()).map(([cat, items]) => {
                  const isOpen = visibleFolders.has(cat);
                  const isSelected = selectedFolder === cat && !selectedScript;
                  const color = getCatColor(cat);

                  return (
                    <div key={cat}>
                      {/* Folder row */}
                      <button
                        onClick={() => toggleFolder(cat)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors group ${
                          isSelected
                            ? "bg-primary/10 text-foreground font-medium"
                            : "text-foreground/80 hover:bg-muted"
                        }`}
                      >
                        <span className="text-muted-foreground">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                        {isOpen ? (
                          <FolderOpen size={16} style={{ color }} />
                        ) : (
                          <Folder size={16} style={{ color }} />
                        )}
                        <span className="flex-1 truncate text-[13px]">{cat}</span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          {items.length}
                        </span>
                      </button>

                      {/* Script items inside folder */}
                      {isOpen && (
                        <div className="ml-5 border-l border-border/50 pl-1 mb-1">
                          {items.map(s => (
                            <button
                              key={s.id}
                              onClick={() => selectScript(s)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors ${
                                selectedScript?.id === s.id
                                  ? "bg-primary/10 text-foreground font-medium"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              }`}
                            >
                              <FileText size={12} className="flex-shrink-0" />
                              <span className="truncate">{s.titulo}</span>
                              {(acessos[s.id] || 0) >= 5 && (
                                <Flame size={10} className="text-primary flex-shrink-0 ml-auto" />
                              )}
                              {s.favorito && <Star size={10} fill="currentColor" className={`text-primary flex-shrink-0 ${(acessos[s.id] || 0) >= 5 ? "" : "ml-auto"}`} />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel: content */}
        <div className="flex-1 min-w-0">
          {selectedScript ? (
            /* Script detail view */
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCatColor(selectedScript.categoria) }} />
                  <h2 className="text-base font-bold text-foreground truncate">{selectedScript.titulo}</h2>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Button
                    size="sm"
                    variant={copiedId === selectedScript.id ? "default" : "outline"}
                    onClick={() => handleCopy(selectedScript)}
                    className="gap-1.5 h-8 text-xs"
                  >
                    {copiedId === selectedScript.id ? <Check size={13} /> : <Copy size={13} />}
                    {copiedId === selectedScript.id ? "Copiado!" : "Copiar conteúdo"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedScript(null)}
                    className="h-8 text-xs"
                  >
                    <X size={13} /> Fechar
                  </Button>
                </div>
              </div>
              <ScrollArea className="flex-1 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                    style={{ backgroundColor: getCatColor(selectedScript.categoria) }}
                  >
                    {selectedScript.categoria}
                  </span>
                  {selectedScript.tags?.map((t, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                  ))}
                </div>
                <div className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {selectedScript.conteudo}
                </div>
              </ScrollArea>
              <div className="flex items-center gap-1.5 p-3 border-t border-border">
                <button onClick={() => onToggleFav(selectedScript)} className={`p-2 rounded-md transition-colors ${selectedScript.favorito ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                  <Star size={14} fill={selectedScript.favorito ? "currentColor" : "none"} />
                </button>
                <button onClick={() => onEdit(selectedScript)} className="p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => { onDelete(selectedScript.id); setSelectedScript(null); }} className="p-2 rounded-md text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ) : selectedFolder ? (
            /* Folder grid view */
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <FolderOpen size={18} style={{ color: getCatColor(selectedFolder) }} />
                <h2 className="text-base font-bold text-foreground">{selectedFolder}</h2>
                <span className="text-xs text-muted-foreground ml-1">({folderScripts.length} script{folderScripts.length !== 1 ? "s" : ""})</span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 grid gap-3 grid-cols-1 md:grid-cols-2">
                  {folderScripts.map(s => (
                    <button
                      key={s.id}
                      onClick={() => selectScript(s)}
                      className="text-left p-3.5 rounded-lg border border-border hover:border-primary/30 hover:shadow-sm bg-card transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="text-sm font-semibold text-foreground leading-snug flex-1">{s.titulo}</h3>
                        {s.favorito && <Star size={12} fill="currentColor" className="text-primary flex-shrink-0 mt-0.5" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line leading-relaxed">
                        {s.conteudo}
                      </p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Folder size={48} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Selecione uma pasta</p>
              <p className="text-xs mt-1">Clique em uma categoria à esquerda para ver os scripts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
