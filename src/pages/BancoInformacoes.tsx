import { useState, useEffect, useMemo, useRef } from "react";
import { Database, Search, Download, Trash2, RefreshCw, Loader2, ExternalLink, MapPin, Landmark, Clock, Sparkles, MessageSquare, AlertTriangle, Upload, Instagram, Filter, Star, StarOff, FileText, Image, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  modelo: boolean;
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
  const [fonteFilter, setFonteFilter] = useState("Todas");
  const [mainTab, setMainTab] = useState("base");

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [generating, setGenerating] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [scriptCategoria, setScriptCategoria] = useState("SOS Uberlândia");
  const [existingScript, setExistingScript] = useState<ExistingScript | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Instagram state
  const [instaUrl, setInstaUrl] = useState("");
  const [instaImporting, setInstaImporting] = useState(false);
  const [instaFeedImporting, setInstaFeedImporting] = useState(false);
  const [instaPreview, setInstaPreview] = useState<{ titulo: string; descricao: string; data: string; imagens?: string[]; screenshot?: string } | null>(null);
  const [instaEditing, setInstaEditing] = useState(false);

  // Upload state
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEntries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("base_conhecimento" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setEntries((data as unknown as KnowledgeEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, []);

  const fontes = useMemo(() => {
    const s = new Set(entries.map(e => e.fonte).filter(Boolean));
    return ["Todas", ...Array.from(s)] as string[];
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (fonteFilter !== "Todas") {
      result = result.filter(e => e.fonte === fonteFilter);
    }
    if (!search) return result;
    const s = search.toLowerCase();
    return result.filter(e =>
      e.titulo.toLowerCase().includes(s) ||
      e.descricao?.toLowerCase().includes(s) ||
      e.orgao?.toLowerCase().includes(s) ||
      e.bairro?.toLowerCase().includes(s) ||
      e.palavras_chave?.some(k => k.toLowerCase().includes(s))
    );
  }, [entries, search, fonteFilter]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", {
        body: { action: "fetch_rss", limit: 20 },
      });
      if (error) throw error;
      toast({ title: "Importação concluída!", description: `${data.saved} novas notícias importadas de ${data.total} encontradas.` });
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
      toast({ title: "Scraping concluído!", description: `${data.saved} novas notícias importadas de ${data.total} encontradas no site.` });
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

  const toggleModelo = async (entry: KnowledgeEntry) => {
    const newVal = !entry.modelo;
    await supabase.from("base_conhecimento" as any).update({ modelo: newVal }).eq("id", entry.id);
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, modelo: newVal } : e));
    toast({ title: newVal ? "Marcado como modelo" : "Modelo removido" });
  };

  // Instagram single post import
  const handleInstagramImport = async () => {
    if (!instaUrl.trim()) return;
    setInstaImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", {
        body: { action: "import_instagram", url: instaUrl.trim() },
      });
      if (error) throw error;
      if (data.preview) {
        setInstaPreview(data.preview);
        setInstaEditing(true);
      } else if (data.saved !== undefined) {
        toast({ title: "Posts importados!", description: `${data.saved} de ${data.total} posts salvos na base.` });
        await fetchEntries();
        setInstaUrl("");
      }
    } catch (err: any) {
      toast({ title: "Erro ao importar Instagram", description: err.message, variant: "destructive" });
    } finally {
      setInstaImporting(false);
    }
  };

  // Instagram full feed import
  const handleInstagramFeedImport = async () => {
    setInstaFeedImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", {
        body: { action: "import_instagram", url: "https://www.instagram.com/fabaovereador/", limit: 20 },
      });
      if (error) throw error;
      toast({ title: "Feed importado!", description: `${data.saved} de ${data.total} posts salvos na base.` });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro ao importar feed", description: err.message, variant: "destructive" });
    } finally {
      setInstaFeedImporting(false);
    }
  };

  const saveInstaPreview = async () => {
    if (!instaPreview) return;
    const entry = {
      titulo: instaPreview.titulo,
      descricao: instaPreview.descricao,
      fonte: "Instagram",
      categoria: "Instagram",
      link: instaUrl,
      data_publicacao: instaPreview.data || new Date().toISOString(),
    };
    const { error } = await supabase.from("base_conhecimento" as any).insert(entry);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post salvo na base!" });
    setInstaPreview(null);
    setInstaEditing(false);
    setInstaUrl("");
    await fetchEntries();
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);

    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        let extractedText = "";

        if (["pdf", "docx", "doc"].includes(ext)) {
          // Process via edge function
          const formData = new FormData();
          formData.append("file", file);
          formData.append("type", ext === "pdf" ? "image" : "image"); // use image pipeline for OCR
          const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
          if (error) throw error;
          extractedText = data.text || "";
        } else if (["csv"].includes(ext)) {
          // Parse CSV client-side
          const text = await file.text();
          const lines = text.split("\n").filter(l => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
            for (let i = 1; i < Math.min(lines.length, 100); i++) {
              const cols = lines[i].split(",");
              const row: any = {};
              headers.forEach((h, j) => { row[h] = cols[j]?.trim() || ""; });
              const csvEntry = {
                titulo: row.titulo || row.title || `Linha ${i}`,
                descricao: row.descricao || row.description || row.assunto || null,
                bairro: row.bairro || null,
                fonte: "Upload",
                categoria: "Upload CSV",
              };
              await supabase.from("base_conhecimento" as any).insert(csvEntry);
            }
            toast({ title: `CSV importado!`, description: `${Math.min(lines.length - 1, 99)} linhas processadas.` });
            await fetchEntries();
            continue;
          }
        } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
          // OCR via process-file
          const formData = new FormData();
          formData.append("file", file);
          formData.append("type", "image");
          const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
          if (error) throw error;
          extractedText = data.text || "";
        }

        if (extractedText) {
          const titulo = extractedText.substring(0, 80).replace(/\n/g, " ").trim() || file.name;
          const entry = {
            titulo,
            descricao: extractedText.substring(0, 2000),
            fonte: "Upload",
            categoria: `Upload ${ext.toUpperCase()}`,
            link: null,
          };
          await supabase.from("base_conhecimento" as any).insert(entry);
          toast({ title: `Arquivo "${file.name}" processado!`, description: `Texto extraído e salvo na base.` });
        }
      } catch (err: any) {
        toast({ title: `Erro em "${file.name}"`, description: err.message, variant: "destructive" });
      }
    }

    setUploadingFile(false);
    await fetchEntries();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Script dialog helpers
  const checkDuplicate = async (titulo: string) => {
    setCheckingDuplicate(true);
    const searchTerm = titulo.substring(0, 30).toLowerCase();
    const { data } = await supabase.from("scripts").select("id, titulo, conteudo, categoria").ilike("titulo", `%${searchTerm}%`).limit(1);
    setExistingScript((data && data.length > 0) ? data[0] as ExistingScript : null);
    setCheckingDuplicate(false);
  };

  const generateContent = async (entry: KnowledgeEntry) => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-oficio", {
        body: { assunto: entry.titulo, destinatario: entry.orgao || "", descricao: entry.descricao || entry.titulo, tipo: "Solicitação", bairro: entry.bairro || "", prioridade: "Normal" },
      });
      if (error) throw error;
      setScriptContent(data.resposta_cidadao || data.oficio || "");
    } catch (err: any) {
      toast({ title: "Erro ao gerar conteúdo", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const openDialog = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    setScriptTitle(entry.titulo);
    setScriptContent("");
    setScriptCategoria(entry.fonte || "SOS Uberlândia");
    setExistingScript(null);
    setShowDialog(true);
    checkDuplicate(entry.titulo);
    generateContent(entry);
  };

  const handleSaveScript = async (updateExisting = false) => {
    if (!user) return;
    if (updateExisting && existingScript) {
      const { error } = await supabase.from("scripts").update({ conteudo: scriptContent, categoria: scriptCategoria, tags: selectedEntry?.palavras_chave || [] }).eq("id", existingScript.id);
      if (error) { toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Script atualizado!" });
    } else {
      const { error } = await supabase.from("scripts").insert({ titulo: scriptTitle, conteudo: scriptContent, categoria: scriptCategoria, tags: selectedEntry?.palavras_chave || [], author_id: user.id });
      if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Script salvo!" });
    }
    setShowDialog(false);
  };

  const fonteIcon = (fonte: string | null) => {
    if (fonte === "Instagram") return <Instagram size={10} />;
    if (fonte === "Upload") return <Upload size={10} />;
    return <Database size={10} />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database size={24} /> Banco de Informações
          </h1>
          <p className="text-sm text-muted-foreground">{entries.length} entrada(s) · Múltiplas fontes</p>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className={`grid w-full max-w-xl ${isAdmin ? 'grid-cols-4' : 'grid-cols-2'}`}>
          <TabsTrigger value="base">Base</TabsTrigger>
          {isAdmin && <TabsTrigger value="importar">SOS Uberlândia</TabsTrigger>}
          {isAdmin && <TabsTrigger value="instagram">Instagram</TabsTrigger>}
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        {/* ─── TAB: BASE ─── */}
        <TabsContent value="base" className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por título, órgão, bairro, palavra-chave..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
            </div>
            <Select value={fonteFilter} onValueChange={setFonteFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter size={14} className="mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchEntries} size="sm">
              <RefreshCw size={14} className="mr-1" /> Atualizar
            </Button>
          </div>

          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Database size={48} className="mx-auto mb-3 opacity-40" />
                <p>Nenhuma entrada encontrada.</p>
              </div>
            ) : filtered.map(entry => (
              <div key={entry.id} className={`bg-card rounded-xl p-4 border ${entry.modelo ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground leading-tight">{entry.titulo}</h3>
                      {entry.modelo && <Badge variant="default" className="text-[9px] px-1">Modelo</Badge>}
                    </div>
                    {entry.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.descricao}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-accent-foreground bg-accent/50 px-1.5 py-0.5 rounded">
                        {fonteIcon(entry.fonte)} {entry.fonte || "Desconhecida"}
                      </span>
                      {entry.orgao && <span className="inline-flex items-center gap-1 text-xs text-primary"><Landmark size={10} /> {entry.orgao}</span>}
                      {entry.bairro && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={10} /> {entry.bairro}</span>}
                      {entry.data_publicacao && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock size={10} /> {new Date(entry.data_publicacao).toLocaleDateString("pt-BR")}</span>}
                    </div>
                    {entry.palavras_chave && entry.palavras_chave.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {entry.palavras_chave.slice(0, 5).map((kw, i) => <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{kw}</Badge>)}
                        {entry.palavras_chave.length > 5 && <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{entry.palavras_chave.length - 5}</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isAdmin && (
                      <button onClick={() => toggleModelo(entry)} className={`p-2 ${entry.modelo ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`} title={entry.modelo ? "Remover modelo" : "Marcar como modelo"}>
                        {entry.modelo ? <Star size={16} /> : <StarOff size={16} />}
                      </button>
                    )}
                    <button onClick={() => openDialog(entry)} className="p-2 text-muted-foreground hover:text-primary" title="Criar Script"><MessageSquare size={16} /></button>
                    {entry.link && <a href={entry.link} target="_blank" rel="noopener noreferrer" className="p-2 text-muted-foreground hover:text-foreground"><ExternalLink size={16} /></a>}
                    {isAdmin && <button onClick={() => handleDelete(entry.id)} className="p-2 text-muted-foreground hover:text-destructive" title="Excluir"><Trash2 size={16} /></button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ─── TAB: SOS UBERLÂNDIA ─── */}
        <TabsContent value="importar" className="space-y-4">
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Importar do SOS Uberlândia</h2>
            <p className="text-sm text-muted-foreground">Importe notícias automaticamente via RSS ou scraping completo do site.</p>
            <div className="flex gap-3 flex-wrap">
              <Button onClick={handleImport} disabled={importing || scraping} variant="outline">
                {importing ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
                {importing ? "Importando..." : "RSS (Últimas 20)"}
              </Button>
              <Button onClick={handleScrapeAll} disabled={importing || scraping}>
                {scraping ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
                {scraping ? "Buscando todas..." : "Importar Todas (Site)"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">⏰ Importação automática configurada a cada 6 horas.</p>
          </div>
        </TabsContent>

        {/* ─── TAB: INSTAGRAM ─── */}
        <TabsContent value="instagram" className="space-y-4">
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Instagram size={20} /> Importar do Instagram</h2>
            
            {/* Full feed import */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-3">
              <h3 className="text-sm font-medium text-foreground">📥 Feed completo @fabaovereador</h3>
              <p className="text-xs text-muted-foreground">Importa automaticamente os últimos 20 posts do perfil, incluindo legendas e links de imagens.</p>
              <Button onClick={handleInstagramFeedImport} disabled={instaFeedImporting || instaImporting}>
                {instaFeedImporting ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
                {instaFeedImporting ? "Importando feed..." : "Importar Feed Completo"}
              </Button>
              <p className="text-[10px] text-muted-foreground">⏰ Importação automática configurada a cada 6 horas.</p>
            </div>

            {/* Single post import */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground">🔗 Importar post individual</h3>
              <p className="text-xs text-muted-foreground">Cole a URL de um post ou reel específico.</p>
              <div className="flex gap-2">
                <Input placeholder="https://www.instagram.com/p/... ou /reel/..." value={instaUrl} onChange={e => setInstaUrl(e.target.value)} className="flex-1" />
                <Button onClick={handleInstagramImport} disabled={instaImporting || instaFeedImporting || !instaUrl.trim()}>
                  {instaImporting ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Download size={16} className="mr-1" />}
                  Importar
                </Button>
              </div>
            </div>

            {instaEditing && instaPreview && (
              <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                <h3 className="text-sm font-semibold">Prévia do Post</h3>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Título</label>
                  <Input value={instaPreview.titulo} onChange={e => setInstaPreview({ ...instaPreview, titulo: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Descrição</label>
                  <Textarea value={instaPreview.descricao} onChange={e => setInstaPreview({ ...instaPreview, descricao: e.target.value })} rows={6} />
                </div>
                {/* Image previews */}
                {instaPreview.imagens && instaPreview.imagens.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Imagens encontradas ({instaPreview.imagens.length})</label>
                    <div className="flex gap-2 flex-wrap">
                      {instaPreview.imagens.slice(0, 4).map((img, i) => (
                        <img key={i} src={img} alt={`Post ${i + 1}`} className="w-20 h-20 object-cover rounded border border-border" />
                      ))}
                    </div>
                  </div>
                )}
                {instaPreview.screenshot && (
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Screenshot do post</label>
                    <img src={`data:image/png;base64,${instaPreview.screenshot}`} alt="Screenshot" className="max-w-full h-auto rounded border border-border max-h-[200px]" />
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setInstaEditing(false); setInstaPreview(null); }}>Cancelar</Button>
                  <Button onClick={saveInstaPreview}>Salvar na Base</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── TAB: UPLOAD ─── */}
        <TabsContent value="upload" className="space-y-4">
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Upload size={20} /> Upload de Arquivos</h2>
            <p className="text-sm text-muted-foreground">Envie PDF, DOCX, CSV ou imagens (JPG/PNG) para extração automática de conteúdo.</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><FileText size={12} /> PDF/DOCX: extrai texto</span>
              <span className="inline-flex items-center gap-1"><FileSpreadsheet size={12} /> CSV: importa linhas</span>
              <span className="inline-flex items-center gap-1"><Image size={12} /> Imagens: OCR</span>
            </div>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.csv,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} className="hidden" />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
              {uploadingFile ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Upload size={16} className="mr-1" />}
              {uploadingFile ? "Processando..." : "Selecionar Arquivos"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Script Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2"><Sparkles size={18} /> Criar Script de Atendimento</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Script para resposta via WhatsApp ao cidadão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {existingScript && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle size={16} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Script similar encontrado!</p>
                  <p className="text-muted-foreground mt-0.5">"{existingScript.titulo}" ({existingScript.categoria})</p>
                </div>
              </div>
            )}
            <div><label className="text-xs text-muted-foreground mb-1 block">Título</label><Input value={scriptTitle} onChange={e => setScriptTitle(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Categoria</label><Input value={scriptCategoria} onChange={e => setScriptCategoria(e.target.value)} /></div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Conteúdo</label>
              {generating ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground"><Loader2 size={16} className="animate-spin" /> Gerando com IA...</div>
              ) : (
                <Textarea value={scriptContent} onChange={e => setScriptContent(e.target.value)} rows={12} />
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
              {existingScript && <Button variant="secondary" onClick={() => handleSaveScript(true)} disabled={!scriptContent || generating}>Atualizar Existente</Button>}
              <Button onClick={() => handleSaveScript(false)} disabled={!scriptContent || generating}>{existingScript ? "Criar Novo" : "Salvar"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
