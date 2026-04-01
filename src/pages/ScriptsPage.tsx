import { useState, useMemo } from "react";
import { Plus, Search, Star, Copy, Pencil, Trash2, Loader2, Sparkles, MessageSquareText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

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

export default function ScriptsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: scripts, setData: setScripts, loading, refetch: fetchScripts } = useRealtimeTable<ScriptRow>({
    table: "scripts",
    channel: "scripts-realtime",
    orderBy: { column: "titulo", ascending: true },
  });
  const [search, setSearch] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");
  const [showDialog, setShowDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);

  // Form
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // AI Generator
  const [conversaInput, setConversaInput] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);


  const categorias = useMemo(() => {
    const cats = new Set(scripts.map((s) => s.categoria));
    return Array.from(cats).sort();
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

  const handleCreate = async () => {
    if (!user) return;
    if (editingId) {
      await supabase.from("scripts").update({
        titulo,
        conteudo,
        categoria: categoria || "Outros",
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      }).eq("id", editingId);
      toast({ title: "Script atualizado!" });
    } else {
      await supabase.from("scripts").insert({
        titulo,
        conteudo,
        categoria: categoria || "Outros",
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        author_id: user.id,
      });
      toast({ title: "Script criado!" });
    }
    await fetchScripts();
    setShowDialog(false);
    setTitulo(""); setConteudo(""); setCategoria(""); setTags(""); setEditingId(null);
  };

  const handleEdit = (s: ScriptRow) => {
    setEditingId(s.id);
    setTitulo(s.titulo);
    setConteudo(s.conteudo);
    setCategoria(s.categoria);
    setTags(s.tags.join(", "));
    setShowDialog(true);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: "Script copiado para a área de transferência." });
  };

  const handleToggleFav = async (id: string) => {
    const script = scripts.find(s => s.id === id);
    if (!script) return;
    await supabase.from("scripts").update({ favorito: !script.favorito }).eq("id", id);
    setScripts(prev => prev.map(s => s.id === id ? { ...s, favorito: !s.favorito } : s));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("scripts").delete().eq("id", id);
    setScripts(prev => prev.filter(s => s.id !== id));
    toast({ title: "Script excluído" });
  };

  // AI Script Generator
  const handleGenerateScript = async () => {
    if (!conversaInput.trim()) return;
    setAiGenerating(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", {
        body: { conversa: conversaInput },
      });
      if (error) throw error;
      setAiResult(data);
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message || "Tente novamente", variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveAIScript = async () => {
    if (!user || !aiResult) return;
    await supabase.from("scripts").insert({
      titulo: aiResult.titulo || "Script gerado por IA",
      conteudo: aiResult.script_base || "",
      categoria: aiResult.categoria || "Outros",
      tags: aiResult.palavras_chave || [],
      author_id: user.id,
    });
    toast({ title: "Script salvo!" });
    await fetchScripts();
    setShowAIDialog(false);
    setConversaInput("");
    setAiResult(null);
  };

  const handleUseInForm = () => {
    if (!aiResult) return;
    setTitulo(aiResult.titulo || "");
    setConteudo(aiResult.script_base || "");
    setCategoria(aiResult.categoria || "");
    setTags((aiResult.palavras_chave || []).join(", "));
    setEditingId(null);
    setShowAIDialog(false);
    setShowDialog(true);
    setConversaInput("");
    setAiResult(null);
  };




  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Scripts de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Respostas prontas para WhatsApp · {scripts.length} script(s)</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setConversaInput(""); setAiResult(null); setShowAIDialog(true); }} variant="outline" className="border-primary text-primary hover:bg-primary/10">
            <Sparkles size={16} className="mr-1" /> Gerar com IA
          </Button>
          <Button onClick={() => { setEditingId(null); setTitulo(""); setConteudo(""); setCategoria(""); setTags(""); setShowDialog(true); }} className="bg-primary text-primary-foreground">
            <Plus size={16} className="mr-1" /> Novo Script
          </Button>
        </div>
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

      {/* Scripts List - Grouped by Category */}
      <div className="space-y-6">
        {loading ? (
          <p className="text-center text-muted-foreground py-8"><Loader2 className="inline animate-spin mr-2" size={16} />Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum script encontrado.</p>
        ) : (() => {
          const grouped = filtered.reduce<Record<string, ScriptRow[]>>((acc, s) => {
            const cat = s.categoria || "Outros";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(s);
            return acc;
          }, {});
          const sortedCats = Object.keys(grouped).sort();
          return sortedCats.map((cat) => (
            <div key={cat} className="space-y-2">
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 border-b border-border">
                <h2 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {cat}
                  <span className="text-xs font-normal text-muted-foreground">({grouped[cat].length})</span>
                </h2>
              </div>
              <div className="space-y-2">
                {grouped[cat].map((s) => (
                  <div key={s.id} className="bg-card rounded-lg p-4 border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button onClick={() => handleToggleFav(s.id)} className={`shrink-0 ${s.favorito ? "text-yellow-500" : "text-muted-foreground"} hover:text-yellow-500`}>
                          <Star size={14} fill={s.favorito ? "currentColor" : "none"} />
                        </button>
                        <span className="text-sm font-medium text-foreground truncate">{s.titulo}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => handleCopy(s.conteudo)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Copiar"><Copy size={13} /></button>
                        <button onClick={() => handleEdit(s)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Editar"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-foreground/70 whitespace-pre-line leading-relaxed line-clamp-4 ml-6">{s.conteudo}</p>
                    {s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 ml-6">
                        {s.tags.map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>

      {/* Dialog - Manual */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingId ? "Editar Script" : "Novo Script"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="bg-secondary border-border" />
            <Input placeholder="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="bg-secondary border-border" />
            <Textarea placeholder="Conteúdo do script..." value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="bg-secondary border-border min-h-[120px]" />
            <Input placeholder="Tags (separadas por vírgula)" value={tags} onChange={(e) => setTags(e.target.value)} className="bg-secondary border-border" />
            <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">{editingId ? "Atualizar" : "Criar Script"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog - AI Generator */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Sparkles size={20} className="text-primary" /> Gerar Script com IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Cole uma conversa real de WhatsApp e a IA vai gerar um script estruturado:</p>
              <Textarea
                placeholder={`Ex:\n"oi, tem vaga de emprego?"\n"quero fazer denúncia de barulho"\n"como faço pra conseguir uma casinha?"`}
                value={conversaInput}
                onChange={(e) => setConversaInput(e.target.value)}
                className="bg-secondary border-border min-h-[120px]"
              />
            </div>

            <Button
              onClick={handleGenerateScript}
              disabled={aiGenerating || !conversaInput.trim()}
              className="w-full bg-primary text-primary-foreground"
            >
              {aiGenerating ? <><Loader2 size={16} className="mr-2 animate-spin" /> Gerando...</> : <><Sparkles size={16} className="mr-2" /> Gerar Script</>}
            </Button>

            {aiResult && (
              <div className="bg-secondary/50 rounded-xl p-4 space-y-3 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquareText size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">Script Gerado</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">{aiResult.categoria}</span>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Título</p>
                  <p className="text-sm text-foreground">{aiResult.titulo}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground font-medium mb-1">Script Base</p>
                  <div className="bg-card rounded-lg p-3 border border-border">
                    <p className="text-sm text-foreground whitespace-pre-line">{aiResult.script_base}</p>
                  </div>
                </div>

                {aiResult.palavras_chave?.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Palavras-chave</p>
                    <div className="flex flex-wrap gap-1">
                      {aiResult.palavras_chave.map((kw: string) => (
                        <span key={kw} className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}

                {aiResult.observacao && (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Observação</p>
                    <p className="text-xs text-muted-foreground">{aiResult.observacao}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveAIScript} className="flex-1 bg-primary text-primary-foreground">
                    Salvar Script
                  </Button>
                  <Button onClick={handleUseInForm} variant="outline" className="flex-1">
                    Editar antes de salvar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>



    </div>
  );
}
