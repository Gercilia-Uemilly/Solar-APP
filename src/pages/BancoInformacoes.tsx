import { useState, useEffect, useMemo } from "react";
import { Database, Search, Download, Trash2, RefreshCw, Loader2, ExternalLink, MapPin, Landmark, Clock, Sparkles, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";

interface KnowledgeEntry {
  id: string;
  titulo: string;
  descricao: string | null;
  palavras_chave: string[] | null;
  orgao: string | null;
  bairro: string | null;
  data_publicacao: string | null;
  link: string | null;
  fonte: string | null;
  categoria: string | null;
  created_at: string;
}

interface ExistingScript {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
}



export default function BancoInformacoes() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode] = useState("script");
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [generating, setGenerating] = useState(false);

  // Script fields
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [scriptCategoria, setScriptCategoria] = useState("SOS Uberlândia");


  // Duplicate detection
  const [existingScript, setExistingScript] = useState<ExistingScript | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("base_conhecimento" as any)
      .select("*")
      .order("data_publicacao", { ascending: false });
    setEntries((data as unknown as KnowledgeEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const filtered = useMemo(() => {
    if (!search) return entries;
    const s = search.toLowerCase();
    return entries.filter(e =>
      e.titulo.toLowerCase().includes(s) ||
      e.descricao?.toLowerCase().includes(s) ||
      e.orgao?.toLowerCase().includes(s) ||
      e.bairro?.toLowerCase().includes(s) ||
      e.palavras_chave?.some(k => k.toLowerCase().includes(s))
    );
  }, [entries, search]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", {
        body: { action: "fetch_rss", limit: 20 },
      });
      if (error) throw error;
      toast({
        title: "Importação concluída!",
        description: `${data.saved} novas notícias importadas de ${data.total} encontradas.`,
      });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", {
        body: { action: "scrape_all", limit: 100 },
      });
      if (error) throw error;
      toast({
        title: "Scraping concluído!",
        description: `${data.saved} novas notícias importadas de ${data.total} encontradas no site.`,
      });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro no scraping", description: err.message, variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("base_conhecimento" as any).delete().eq("id", id);
    setEntries(prev => prev.filter(e => e.id !== id));
    toast({ title: "Entrada removida" });
  };

  // Check for existing script with similar title
  const checkDuplicate = async (titulo: string) => {
    setCheckingDuplicate(true);
    const searchTerm = titulo.substring(0, 30).toLowerCase();
    const { data } = await supabase
      .from("scripts")
      .select("id, titulo, conteudo, categoria")
      .ilike("titulo", `%${searchTerm}%`)
      .limit(1);
    setExistingScript((data && data.length > 0) ? data[0] as ExistingScript : null);
    setCheckingDuplicate(false);
  };

  // Generate content via AI
  const generateContent = async (entry: KnowledgeEntry) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-oficio", {
        body: {
          assunto: entry.titulo,
          destinatario: entry.orgao || "",
          descricao: entry.descricao || entry.titulo,
          tipo: "Solicitação",
          bairro: entry.bairro || "",
          prioridade: "Normal",
        },
      });
      if (error) throw error;
      const scriptText = data.resposta_cidadao || data.oficio || "";
      setScriptContent(scriptText);
    } catch (err: any) {
      toast({ title: "Erro ao gerar conteúdo", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // Open dialog for an entry
  const openDialog = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    setScriptTitle(entry.titulo);
    setScriptContent("");
    setScriptCategoria("SOS Uberlândia");
    setExistingScript(null);
    setShowDialog(true);
    checkDuplicate(entry.titulo);
    generateContent(entry);
  };

  // Save script (new or update)
  const handleSaveScript = async (updateExisting = false) => {
    if (!user) return;

    if (updateExisting && existingScript) {
      const { error } = await supabase.from("scripts").update({
        conteudo: scriptContent,
        categoria: scriptCategoria,
        tags: selectedEntry?.palavras_chave || [],
      }).eq("id", existingScript.id);

      if (error) {
        toast({ title: "Erro ao atualizar script", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Script atualizado com sucesso!" });
    } else {
      const { error } = await supabase.from("scripts").insert({
        titulo: scriptTitle,
        conteudo: scriptContent,
        categoria: scriptCategoria,
        tags: selectedEntry?.palavras_chave || [],
        author_id: user.id,
      });

      if (error) {
        toast({ title: "Erro ao salvar script", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Script salvo com sucesso!" });
    }
    setShowDialog(false);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database size={24} /> Banco de Informações
          </h1>
          <p className="text-sm text-muted-foreground">{entries.length} entrada(s) · Fonte: SOS Uberlândia</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleImport} disabled={importing || scraping} variant="outline">
              {importing ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
              {importing ? "Importando..." : "RSS (Últimas)"}
            </Button>
            <Button onClick={handleScrapeAll} disabled={importing || scraping} className="bg-primary text-primary-foreground">
              {scraping ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
              {scraping ? "Buscando todas..." : "Importar Todas (Site)"}
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por título, órgão, bairro, palavra-chave..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Button variant="outline" onClick={fetchEntries} size="sm">
          <RefreshCw size={14} className="mr-1" /> Atualizar
        </Button>
      </div>

      {/* Entries list */}
      <div className="space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Database size={48} className="mx-auto mb-3 opacity-40" />
            <p>Nenhuma entrada encontrada.</p>
            {isAdmin && <p className="text-xs mt-1">Clique em "Importar Todas (Site)" para buscar do SOS Uberlândia.</p>}
          </div>
        ) : filtered.map(entry => (
          <div key={entry.id} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground leading-tight">{entry.titulo}</h3>
                {entry.descricao && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.descricao}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {entry.orgao && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary">
                      <Landmark size={10} /> {entry.orgao}
                    </span>
                  )}
                  {entry.bairro && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin size={10} /> {entry.bairro}
                    </span>
                  )}
                  {entry.data_publicacao && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={10} /> {new Date(entry.data_publicacao).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                {entry.palavras_chave && entry.palavras_chave.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {entry.palavras_chave.slice(0, 5).map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {kw}
                      </Badge>
                    ))}
                    {entry.palavras_chave.length > 5 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{entry.palavras_chave.length - 5}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openDialog(entry)}
                  className="p-2 text-muted-foreground hover:text-primary"
                  title="Criar Script de atendimento"
                >
                  <MessageSquare size={16} />
                </button>
                {entry.link && (
                  <a href={entry.link} target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-foreground">
                    <ExternalLink size={16} />
                  </a>
                )}
                {isAdmin && (
                  <button onClick={() => handleDelete(entry.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Excluir">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Creation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Sparkles size={18} />
              Criar Script de Atendimento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Script para resposta via WhatsApp ao cidadão. Revise e edite antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {existingScript && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Script similar encontrado!</p>
                  <p className="text-muted-foreground mt-0.5">"{existingScript.titulo}" ({existingScript.categoria})</p>
                  <p className="text-muted-foreground mt-1">Você pode atualizar o existente ou criar um novo.</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Título do Script</label>
              <Input value={scriptTitle} onChange={e => setScriptTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
              <Input value={scriptCategoria} onChange={e => setScriptCategoria(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Conteúdo do Script (WhatsApp)</label>
              {generating ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> Gerando script com IA...
                </div>
              ) : (
                <Textarea value={scriptContent} onChange={e => setScriptContent(e.target.value)} rows={12} />
              )}
            </div>

            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              {existingScript && (
                <Button
                  variant="secondary"
                  onClick={() => handleSaveScript(true)}
                  disabled={!scriptContent || generating}
                >
                  Atualizar Existente
                </Button>
              )}
              <Button onClick={() => handleSaveScript(false)} disabled={!scriptContent || generating}>
                {existingScript ? "Criar Novo" : "Salvar Script"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
