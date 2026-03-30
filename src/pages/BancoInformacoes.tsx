import { useState, useMemo, useRef } from "react";
import { Search, Download, Trash2, RefreshCw, Loader2, ExternalLink, MapPin, Landmark, Clock, Sparkles, MessageSquare, AlertTriangle, Filter, Star, StarOff, FileText, FileSpreadsheet, Copy, Share2, Calendar, Tag, Globe, Headphones, ImageIcon, UploadCloud, Rss, Instagram as InstagramIcon, Library, Info, Smartphone, Monitor, Plus, Pencil, MessageSquareText } from "lucide-react";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const TAB_CONFIG = [
  { value: "base", label: "Base", icon: Library, adminOnly: false },
  { value: "scripts", label: "Scripts", icon: MessageSquareText, adminOnly: false },
  { value: "audios", label: "Áudios", icon: Headphones, adminOnly: false },
  { value: "importar", label: "SOS Uberlândia", icon: Rss, adminOnly: false },
  { value: "instagram", label: "Instagram", icon: InstagramIcon, adminOnly: false },
  { value: "upload", label: "Upload", icon: UploadCloud, adminOnly: false },
] as const;

/** Build a smart download filename: 2026-03-04_tarifa-zero-criancas_fala-vereador.mp3 */
function buildDownloadName(entry: KnowledgeEntry): string {
  const date = new Date(entry.created_at).toISOString().slice(0, 10);
  const slug = entry.titulo
    .replace(/🎤\s*/g, "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
  const origem = (entry.fonte || "upload").toLowerCase().replace(/\s+/g, "-");
  const ext = entry.link?.split(".").pop()?.split("?")[0] || "mp3";
  return `${date}_${slug}_${origem}.${ext}`;
}

/** Build WhatsApp message */
function buildWhatsAppMessage(entry: KnowledgeEntry): string {
  const title = entry.titulo.replace(/🎤\s*/g, "");
  const tags = entry.palavras_chave?.length ? `\nTemas: ${entry.palavras_chave.join(", ")}` : "";
  return `Segue áudio sobre *${title}*${tags}\n\n${entry.link || ""}`;
}

export default function BancoInformacoes() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const { data: entries, setData: setEntries, loading, refetch: fetchEntries } = useRealtimeTable<KnowledgeEntry>({
    table: "base_conhecimento",
    channel: "base-conhecimento-realtime",
    orderBy: { column: "created_at", ascending: false },
    select: "id,titulo,descricao,palavras_chave,orgao,bairro,data_publicacao,link,fonte,categoria,modelo,created_at",
    limit: 200,
    disableRealtime: true,
  });
  const { data: scripts, setData: setScriptsData, loading: scriptsLoading, refetch: fetchScripts } = useRealtimeTable<ScriptRow>({
    table: "scripts",
    channel: "scripts-banco-realtime",
    orderBy: { column: "titulo", ascending: true },
  });
  const [importing, setImporting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [search, setSearch] = useState("");
  const [fonteFilter, setFonteFilter] = useState("Todas");
  const [dateFilter, setDateFilter] = useState("Todas");
  const [themeFilter, setThemeFilter] = useState("Todos");
  const [mainTab, setMainTab] = useState("base");

  const [showDialog, setShowDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [generating, setGenerating] = useState(false);
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [scriptCategoria, setScriptCategoria] = useState("SOS Uberlândia");
  const [existingScript, setExistingScript] = useState<ExistingScript | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const [instaUrl, setInstaUrl] = useState("");
  const [instaImporting, setInstaImporting] = useState(false);
  const [instaFeedImporting, setInstaFeedImporting] = useState(false);
  const [instaClassifying, setInstaClassifying] = useState(false);
  const [instaClassifyProgress, setInstaClassifyProgress] = useState<{ processed: number; total: number } | null>(null);
  const [instaPreview, setInstaPreview] = useState<{ titulo: string; descricao: string; data: string; imagens?: string[]; screenshot?: string } | null>(null);
  const [instaEditing, setInstaEditing] = useState(false);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Audio filters
  const [audioSearch, setAudioSearch] = useState("");
  const [audioOriginFilter, setAudioOriginFilter] = useState("Todas");
  const [audioTagFilter, setAudioTagFilter] = useState("Todos");

  // Script tab state
  const [scriptSearch, setScriptSearch] = useState("");
  const [scriptCatFilter, setScriptCatFilter] = useState("Todas");
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const [sFormTitulo, setSFormTitulo] = useState("");
  const [sFormConteudo, setSFormConteudo] = useState("");
  const [sFormCategoria, setSFormCategoria] = useState("");
  const [sFormTags, setSFormTags] = useState("");
  const [sEditingId, setSEditingId] = useState<string | null>(null);
  const [aiScriptInput, setAiScriptInput] = useState("");
  const [aiScriptGenerating, setAiScriptGenerating] = useState(false);
  const [aiScriptResult, setAiScriptResult] = useState<any>(null);
  const [showAIScriptDialog, setShowAIScriptDialog] = useState(false);

  // ─── Derived data ───
  const fontes = useMemo(() => {
    const s = new Set(entries.map(e => e.fonte).filter(Boolean));
    return ["Todas", ...Array.from(s)] as string[];
  }, [entries]);

  const themes = useMemo(() => {
    const s = new Set(entries.map(e => e.categoria).filter(Boolean));
    return ["Todos", ...Array.from(s)] as string[];
  }, [entries]);

  const dateOptions = ["Todas", "Hoje", "7 dias", "30 dias", "90 dias"];

  const filtered = useMemo(() => {
    let result = entries;
    if (fonteFilter !== "Todas") result = result.filter(e => e.fonte === fonteFilter);
    if (themeFilter !== "Todos") result = result.filter(e => e.categoria === themeFilter);
    if (dateFilter !== "Todas") {
      const now = Date.now();
      const days = dateFilter === "Hoje" ? 1 : dateFilter === "7 dias" ? 7 : dateFilter === "30 dias" ? 30 : 90;
      result = result.filter(e => (now - new Date(e.created_at).getTime()) / 86400000 <= days);
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
  }, [entries, search, fonteFilter, themeFilter, dateFilter]);

  const audioEntries = useMemo(() => {
    let result = entries.filter(e => e.categoria === "Áudio");
    if (audioOriginFilter !== "Todas") result = result.filter(e => e.fonte === audioOriginFilter);
    if (audioTagFilter !== "Todos") result = result.filter(e => e.palavras_chave?.includes(audioTagFilter));
    if (!audioSearch) return result;
    const s = audioSearch.toLowerCase();
    return result.filter(e =>
      e.titulo.toLowerCase().includes(s) ||
      e.descricao?.toLowerCase().includes(s) ||
      e.palavras_chave?.some(k => k.toLowerCase().includes(s))
    );
  }, [entries, audioSearch, audioOriginFilter, audioTagFilter]);

  const audioOrigins = useMemo(() => {
    const s = new Set(entries.filter(e => e.categoria === "Áudio").map(e => e.fonte).filter(Boolean));
    return ["Todas", ...Array.from(s)] as string[];
  }, [entries]);

  const audioTags = useMemo(() => {
    const s = new Set(entries.filter(e => e.categoria === "Áudio").flatMap(e => e.palavras_chave || []).filter(Boolean));
    return ["Todos", ...Array.from(s)] as string[];
  }, [entries]);

  // Scripts computed
  const scriptCategories = useMemo(() => {
    const cats = new Set(scripts.map(s => s.categoria));
    return Array.from(cats).sort();
  }, [scripts]);

  const filteredScripts = useMemo(() => {
    return scripts.filter(s => {
      if (scriptCatFilter === "Favoritos" && !s.favorito) return false;
      if (scriptCatFilter !== "Todas" && scriptCatFilter !== "Favoritos" && s.categoria !== scriptCatFilter) return false;
      if (scriptSearch) {
        const q = scriptSearch.toLowerCase();
        return s.titulo.toLowerCase().includes(q) || s.conteudo.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [scripts, scriptCatFilter, scriptSearch]);

  const stats = useMemo(() => ({
    total: entries.length,
    scripts: scripts.length,
    audios: entries.filter(e => e.categoria === "Áudio").length,
    instagram: entries.filter(e => e.fonte === "Instagram" || e.categoria === "Instagram").length,
    modelos: entries.filter(e => e.modelo).length,
  }), [entries, scripts]);

  // ─── Handlers ───
  const handleImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", { body: { action: "fetch_rss", limit: 20 } });
      if (error) throw error;
      toast({ title: "Importação concluída!", description: `${data.saved} novas notícias importadas.` });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", { body: { action: "scrape_all", limit: 100 } });
      if (error) throw error;
      toast({ title: "Scraping concluído!", description: `${data.saved} novas notícias.` });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro no scraping", description: err.message, variant: "destructive" });
    } finally { setScraping(false); }
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

  const handleInstagramImport = async () => {
    if (!instaUrl.trim()) return;
    setInstaImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", { body: { action: "import_instagram", url: instaUrl.trim() } });
      if (error) throw error;
      if (data.preview) { setInstaPreview(data.preview); setInstaEditing(true); }
      else if (data.saved !== undefined) {
        toast({ title: "Posts importados!", description: `${data.saved} posts salvos.` });
        await fetchEntries(); setInstaUrl("");
      }
    } catch (err: any) {
      toast({ title: "Erro ao importar Instagram", description: err.message, variant: "destructive" });
    } finally { setInstaImporting(false); }
  };

  const handleInstagramFeedImport = async () => {
    setInstaFeedImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", { body: { action: "import_instagram", url: "https://www.instagram.com/fabaovereador/", limit: 20 } });
      if (error) throw error;
      toast({ title: "Feed importado!", description: `${data.saved} posts salvos.` });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro ao importar feed", description: err.message, variant: "destructive" });
    } finally { setInstaFeedImporting(false); }
  };

  const saveInstaPreview = async () => {
    if (!instaPreview) return;
    const entry = { titulo: instaPreview.titulo, descricao: instaPreview.descricao, fonte: "Instagram", categoria: "Instagram", link: instaUrl, data_publicacao: instaPreview.data || new Date().toISOString() };
    const { error } = await supabase.from("base_conhecimento" as any).insert(entry);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Post salvo na base!" });
    setInstaPreview(null); setInstaEditing(false); setInstaUrl(""); await fetchEntries();
  };

  const handleInstagramClassify = async () => {
    setInstaClassifying(true);
    setInstaClassifyProgress(null);
    try {
      const instagramEntries = entries.filter(e => 
        (e.fonte === "Instagram" || e.link?.includes("instagram.com")) && 
        (e.titulo === "Instagram @fabaovereador" || e.titulo?.includes("Post do Instagram") || e.titulo?.includes("Reel do Instagram"))
      );
      
      const totalToProcess = Math.min(instagramEntries.length, 50);
      setInstaClassifyProgress({ processed: 0, total: totalToProcess });

      const { data, error } = await supabase.functions.invoke("classify-instagram", {
        body: { limit: 50 },
      });

      if (error) throw error;

      toast({ 
        title: "Classificação concluída!", 
        description: `${data.updated} posts atualizados de ${data.processed} processados.` 
      });
      await fetchEntries();
    } catch (err: any) {
      toast({ title: "Erro na classificação", description: err.message, variant: "destructive" });
    } finally { 
      setInstaClassifying(false); 
      setInstaClassifyProgress(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingFile(true);
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        let extractedText = "";
        if (["pdf", "docx", "doc"].includes(ext)) {
          const formData = new FormData(); formData.append("file", file); formData.append("type", "image");
          const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
          if (error) throw error; extractedText = data.text || "";
        } else if (["csv"].includes(ext)) {
          const text = await file.text();
          const lines = text.split("\n").filter(l => l.trim());
          if (lines.length > 1) {
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
            for (let i = 1; i < Math.min(lines.length, 100); i++) {
              const cols = lines[i].split(","); const row: any = {};
              headers.forEach((h, j) => { row[h] = cols[j]?.trim() || ""; });
              await supabase.from("base_conhecimento" as any).insert({ titulo: row.titulo || row.title || `Linha ${i}`, descricao: row.descricao || row.description || row.assunto || null, bairro: row.bairro || null, fonte: "Upload", categoria: "Upload CSV" });
            }
            toast({ title: `CSV importado!`, description: `${Math.min(lines.length - 1, 99)} linhas.` });
            await fetchEntries(); continue;
          }
        } else if (["jpg", "jpeg", "png", "webp"].includes(ext)) {
          const formData = new FormData(); formData.append("file", file); formData.append("type", "image");
          const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
          if (error) throw error; extractedText = data.text || "";
        } else if (["mp3", "wav", "m4a", "ogg", "webm", "aac", "mp4", "mpeg"].includes(ext)) {
          const formData = new FormData(); formData.append("file", file);
          formData.append("type", file.type.startsWith("video") ? "video" : "audio");
          const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
          if (error) throw error; extractedText = data.text || "";
          const storagePath = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("midias").upload(storagePath, file);
          let audioUrl: string | undefined;
          if (!upErr) { const { data: urlData } = supabase.storage.from("midias").getPublicUrl(storagePath); audioUrl = urlData.publicUrl; }
          await supabase.from("base_conhecimento" as any).insert({ titulo: `🎤 ${file.name.replace(/\.[^.]+$/, "")}`, descricao: extractedText.substring(0, 2000), fonte: "Upload", categoria: "Áudio", link: audioUrl || null, modelo: true });
          toast({ title: `Áudio "${file.name}" transcrito!` }); continue;
        }
        if (extractedText) {
          const titulo = extractedText.substring(0, 80).replace(/\n/g, " ").trim() || file.name;
          await supabase.from("base_conhecimento" as any).insert({ titulo, descricao: extractedText.substring(0, 2000), fonte: "Upload", categoria: `Upload ${ext.toUpperCase()}`, link: null });
          toast({ title: `Arquivo "${file.name}" processado!` });
        }
      } catch (err: any) {
        toast({ title: `Erro em "${file.name}"`, description: err.message, variant: "destructive" });
      }
    }
    setUploadingFile(false); await fetchEntries();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Audio upload with AI auto-analysis for title, tags, and theme */
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAudio(true);
    for (const file of Array.from(files)) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";

        // 1. Transcribe
        const formData = new FormData(); formData.append("file", file);
        formData.append("type", file.type.startsWith("video") ? "video" : "audio");
        const { data, error } = await supabase.functions.invoke("process-file", { body: formData });
        if (error) throw error;
        const extractedText = data.text || "";

        // 2. Upload original to storage
        const storagePath = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("midias").upload(storagePath, file);
        let audioUrl: string | undefined;
        if (!upErr) { const { data: urlData } = supabase.storage.from("midias").getPublicUrl(storagePath); audioUrl = urlData.publicUrl; }

        // 3. AI analysis for smart title and tags
        let aiTitle = file.name.replace(/\.[^.]+$/, "");
        let aiTags: string[] = [];
        let aiTema = "Geral";
        let aiResumo = extractedText.substring(0, 200);

        if (extractedText.length > 20) {
          try {
            const { data: analysis, error: aiErr } = await supabase.functions.invoke("analyze-audio", {
              body: { transcription: extractedText },
            });
            if (!aiErr && analysis) {
              aiTitle = analysis.titulo || aiTitle;
              aiTags = analysis.tags || [];
              aiTema = analysis.tema_principal || "Geral";
              aiResumo = analysis.resumo || aiResumo;
            }
          } catch {
            // AI analysis failed, use fallback
          }
        }

        // 4. Save to knowledge base
        await supabase.from("base_conhecimento" as any).insert({
          titulo: aiTitle,
          descricao: extractedText.substring(0, 2000),
          fonte: "Upload",
          categoria: "Áudio",
          link: audioUrl || null,
          modelo: true,
          palavras_chave: aiTags.length > 0 ? aiTags : null,
          orgao: aiTema !== "Geral" ? aiTema : null,
        });
        toast({ title: `Áudio salvo!`, description: `"${aiTitle}" — ${aiTags.length} tags geradas.` });
      } catch (err: any) {
        toast({ title: `Erro em "${file.name}"`, description: err.message, variant: "destructive" });
      }
    }
    setUploadingAudio(false); await fetchEntries();
    if (audioInputRef.current) audioInputRef.current.value = "";
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
      const { data, error } = await supabase.functions.invoke("generate-oficio", { body: { assunto: entry.titulo, destinatario: entry.orgao || "", descricao: entry.descricao || entry.titulo, tipo: "Solicitação", bairro: entry.bairro || "", prioridade: "Normal" } });
      if (error) throw error;
      setScriptContent(data.resposta_cidadao || data.oficio || "");
    } catch (err: any) {
      toast({ title: "Erro ao gerar conteúdo", description: err.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const openDialog = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry); setScriptTitle(entry.titulo); setScriptContent("");
    setScriptCategoria(entry.fonte || "SOS Uberlândia"); setExistingScript(null);
    setShowDialog(true); checkDuplicate(entry.titulo); generateContent(entry);
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

  // ─── Script tab handlers ───
  const handleScriptCreate = async () => {
    if (!user) return;
    if (sEditingId) {
      await supabase.from("scripts").update({
        titulo: sFormTitulo, conteudo: sFormConteudo, categoria: sFormCategoria,
        tags: sFormTags.split(",").map(t => t.trim()).filter(Boolean),
      }).eq("id", sEditingId);
      setScriptsData(prev => prev.map(s => s.id === sEditingId ? { ...s, titulo: sFormTitulo, conteudo: sFormConteudo, categoria: sFormCategoria, tags: sFormTags.split(",").map(t => t.trim()).filter(Boolean) } : s));
      toast({ title: "Script atualizado!" });
    } else {
      const { data: newScript, error } = await supabase.from("scripts").insert({
        titulo: sFormTitulo, conteudo: sFormConteudo, categoria: sFormCategoria || "Geral",
        tags: sFormTags.split(",").map(t => t.trim()).filter(Boolean), author_id: user.id,
      }).select().single();
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      if (newScript) setScriptsData(prev => [...prev, newScript as unknown as ScriptRow]);
      toast({ title: "Script criado!" });
    }
    setShowScriptDialog(false); resetScriptForm();
  };

  const resetScriptForm = () => { setSFormTitulo(""); setSFormConteudo(""); setSFormCategoria(""); setSFormTags(""); setSEditingId(null); };

  const handleScriptEdit = (s: ScriptRow) => {
    setSFormTitulo(s.titulo); setSFormConteudo(s.conteudo); setSFormCategoria(s.categoria);
    setSFormTags(s.tags?.join(", ") || ""); setSEditingId(s.id); setShowScriptDialog(true);
  };

  const handleScriptCopy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copiado!" }); };

  const handleScriptToggleFav = async (s: ScriptRow) => {
    const newVal = !s.favorito;
    await supabase.from("scripts").update({ favorito: newVal }).eq("id", s.id);
    setScriptsData(prev => prev.map(x => x.id === s.id ? { ...x, favorito: newVal } : x));
  };

  const handleScriptDelete = async (id: string) => {
    await supabase.from("scripts").delete().eq("id", id);
    setScriptsData(prev => prev.filter(x => x.id !== id));
    toast({ title: "Script removido" });
  };

  const handleGenerateAIScript = async () => {
    if (!aiScriptInput.trim()) return;
    setAiScriptGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-script", { body: { conversa: aiScriptInput } });
      if (error) throw error;
      setAiScriptResult(data);
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    } finally { setAiScriptGenerating(false); }
  };

  const handleSaveAIScript = async () => {
    if (!user || !aiScriptResult) return;
    const { error } = await supabase.from("scripts").insert({
      titulo: aiScriptResult.titulo, conteudo: aiScriptResult.script_base || aiScriptResult.conteudo,
      categoria: aiScriptResult.categoria || "Geral",
      tags: aiScriptResult.tags || [], author_id: user.id,
    });
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Script salvo!" }); setAiScriptResult(null); setAiScriptInput("");
    setShowAIScriptDialog(false); await fetchScripts();
  };

  const fonteIcon = (fonte: string | null) => {
    if (fonte === "Instagram") return <InstagramIcon size={12} className="text-pink-500" />;
    if (fonte === "Upload") return <UploadCloud size={12} className="text-primary" />;
    if (fonte === "WhatsApp") return <Smartphone size={12} className="text-green-600" />;
    if (fonte === "SOS Uberlândia") return <Rss size={12} className="text-orange-500" />;
    return <Library size={12} className="text-primary" />;
  };

  const categoriaIcon = (cat: string | null) => {
    if (cat === "Áudio") return <Headphones size={12} className="text-primary" />;
    if (cat === "Instagram") return <InstagramIcon size={12} className="text-pink-500" />;
    if (cat?.startsWith("Upload")) return <UploadCloud size={12} className="text-primary" />;
    return <FileText size={12} className="text-muted-foreground" />;
  };

  const visibleTabs = TAB_CONFIG;

  // ─── Smart download handler ───
  const handleSmartDownload = async (entry: KnowledgeEntry) => {
    if (!entry.link) return;
    try {
      const resp = await fetch(entry.link);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildDownloadName(entry);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado!", description: buildDownloadName(entry) });
    } catch {
      // fallback: open in new tab
      window.open(entry.link, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Library size={24} className="text-primary" /> Central de Inteligência
          </h1>
          <p className="text-sm text-muted-foreground">Base de conhecimento do mandato</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEntries} className="gap-2">
          <RefreshCw size={14} /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMainTab("base")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10"><Library size={20} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total na base</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMainTab("audios")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent"><Headphones size={20} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{stats.audios}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Áudios</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMainTab("scripts")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent"><MessageSquareText size={20} className="text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{stats.scripts}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Scripts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMainTab("instagram")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-pink-500/10"><InstagramIcon size={20} className="text-pink-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{stats.instagram}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Instagram</p>
            </div>
          </CardContent>
        </Card>
        {isAdmin && <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/10"><Star size={20} className="text-yellow-500" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{stats.modelos}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Modelos</p>
            </div>
          </CardContent>
        </Card>}
      </div>

      {/* Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap gap-1">
          {visibleTabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs data-[state=active]:shadow-sm">
              <tab.icon size={14} /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ═══════════ TAB: BASE ═══════════ */}
        <TabsContent value="base" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar por título, órgão, bairro, palavra-chave..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter size={12} /> Filtros:</div>
                <Select value={fonteFilter} onValueChange={setFonteFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><Globe size={12} className="mr-1 flex-shrink-0" /><SelectValue /></SelectTrigger>
                  <SelectContent>{fontes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={themeFilter} onValueChange={setThemeFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs"><Tag size={12} className="mr-1 flex-shrink-0" /><SelectValue /></SelectTrigger>
                  <SelectContent>{themes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><Calendar size={12} className="mr-1 flex-shrink-0" /><SelectValue /></SelectTrigger>
                  <SelectContent>{dateOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
                {(fonteFilter !== "Todas" || themeFilter !== "Todos" || dateFilter !== "Todas") && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFonteFilter("Todas"); setThemeFilter("Todos"); setDateFilter("Todas"); }}>Limpar</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{filtered.length} resultado(s)</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Loader2 size={32} className="mx-auto mb-3 animate-spin opacity-40" /><p>Carregando...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Library size={48} className="mx-auto mb-3 opacity-30" /><p className="font-medium">Nenhuma entrada encontrada</p>
              </div>
            ) : filtered.map(entry => (
              <Card key={entry.id} className={`group hover:shadow-md transition-all ${isAdmin && entry.modelo ? 'border-primary/40 bg-primary/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {categoriaIcon(entry.categoria)}
                      <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{entry.titulo}</h3>
                    </div>
                    {isAdmin && entry.modelo && <Badge variant="default" className="text-[9px] px-1.5 flex-shrink-0">Modelo</Badge>}
                  </div>
                  {entry.descricao && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{entry.descricao}</p>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-foreground bg-muted px-2 py-0.5 rounded-full">
                      {fonteIcon(entry.fonte)} {entry.fonte || "—"}
                    </span>
                    {entry.orgao && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Landmark size={10} /> {entry.orgao}</span>}
                    {entry.bairro && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><MapPin size={10} /> {entry.bairro}</span>}
                    {entry.data_publicacao && <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock size={10} /> {new Date(entry.data_publicacao).toLocaleDateString("pt-BR")}</span>}
                  </div>
                  {entry.palavras_chave && entry.palavras_chave.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.palavras_chave.slice(0, 4).map((kw, i) => <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">{kw}</Badge>)}
                      {entry.palavras_chave.length > 4 && <Badge variant="outline" className="text-[9px] px-1.5 py-0">+{entry.palavras_chave.length - 4}</Badge>}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                    {isAdmin && <button onClick={() => toggleModelo(entry)} className={`p-1.5 rounded-md ${entry.modelo ? 'text-primary' : 'text-muted-foreground hover:text-primary'} hover:bg-muted transition-colors`}>{entry.modelo ? <Star size={14} /> : <StarOff size={14} />}</button>}
                    <button onClick={() => openDialog(entry)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"><MessageSquare size={14} /></button>
                    {entry.link && <a href={entry.link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><ExternalLink size={14} /></a>}
                    <button onClick={() => handleDelete(entry.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors ml-auto"><Trash2 size={14} /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════ TAB: SCRIPTS ═══════════ */}
        <TabsContent value="scripts" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar scripts..." value={scriptSearch} onChange={e => setScriptSearch(e.target.value)} className="pl-9" />
                </div>
                <Button size="sm" onClick={() => { resetScriptForm(); setShowScriptDialog(true); }} className="gap-1.5">
                  <Plus size={14} /> Novo Script
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAIScriptDialog(true)} className="gap-1.5">
                  <Sparkles size={14} /> Gerar com IA
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant={scriptCatFilter === "Todas" ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setScriptCatFilter("Todas")}>Todas</Button>
                <Button variant={scriptCatFilter === "Favoritos" ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1" onClick={() => setScriptCatFilter("Favoritos")}><Star size={12} /> Favoritos</Button>
                {scriptCategories.map(cat => (
                  <Button key={cat} variant={scriptCatFilter === cat ? "default" : "outline"} size="sm" className="h-7 text-xs" onClick={() => setScriptCatFilter(cat)}>{cat}</Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{filteredScripts.length} script(s)</p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {scriptsLoading ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Loader2 size={32} className="mx-auto mb-3 animate-spin opacity-40" /><p>Carregando...</p>
              </div>
            ) : filteredScripts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <MessageSquareText size={48} className="mx-auto mb-3 opacity-30" /><p className="font-medium">Nenhum script encontrado</p>
              </div>
            ) : filteredScripts.map(s => (
              <Card key={s.id} className="group hover:shadow-md transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground leading-tight">{s.titulo}</h3>
                    <Badge variant="secondary" className="text-[9px] px-1.5 flex-shrink-0">{s.categoria}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap">{s.conteudo}</p>
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.tags.slice(0, 3).map((t, i) => <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">{t}</Badge>)}
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleScriptToggleFav(s)} className={`p-1.5 rounded-md ${s.favorito ? 'text-primary' : 'text-muted-foreground hover:text-primary'} hover:bg-muted transition-colors`}>
                      {s.favorito ? <Star size={14} /> : <StarOff size={14} />}
                    </button>
                    <button onClick={() => handleScriptCopy(s.conteudo)} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><Copy size={14} /></button>
                    <button onClick={() => handleScriptEdit(s)} className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleScriptDelete(s.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors ml-auto"><Trash2 size={14} /></button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audios" className="space-y-4">
          {/* Upload area */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Headphones size={18} className="text-primary" /> Banco de Áudios
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie áudios de referência. A IA transcreve, gera título e tags automaticamente.
              </p>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5"><Info size={14} className="text-primary" /> Fluxo do operador:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { n: "1", t: 'Envie áudios (MP3, WAV, M4A, OGG etc.)' },
                    { n: "2", t: 'IA transcreve e gera título + tags automaticamente' },
                    { n: "3", t: 'Ouça pelo player e entenda o tema rapidamente' },
                    { n: "4", t: 'Baixe com nome inteligente ou envie via WhatsApp' },
                  ].map(step => (
                    <div key={step.n} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0 mt-0.5">{step.n}</div>
                      <p className="text-xs text-muted-foreground">{step.t}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <input ref={audioInputRef} type="file" multiple accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.mpeg" onChange={handleAudioUpload} className="hidden" />
                <Button onClick={() => audioInputRef.current?.click()} disabled={uploadingAudio} className="gap-2">
                  {uploadingAudio ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  {uploadingAudio ? "Processando áudios..." : "Enviar Áudios"}
                </Button>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Monitor size={12} /> Desktop
                  <span className="mx-1">·</span>
                  <Smartphone size={12} /> Celular
                  <span className="mx-1">·</span>
                  compatível com WhatsApp
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search & filters */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar áudios por título, conteúdo ou tag..." value={audioSearch} onChange={e => setAudioSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Filter size={12} /> Filtros:</div>
                <Select value={audioOriginFilter} onValueChange={setAudioOriginFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs"><Globe size={12} className="mr-1 flex-shrink-0" /><SelectValue /></SelectTrigger>
                  <SelectContent>{audioOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
                {audioTags.length > 1 && (
                  <Select value={audioTagFilter} onValueChange={setAudioTagFilter}>
                    <SelectTrigger className="w-[150px] h-8 text-xs"><Tag size={12} className="mr-1 flex-shrink-0" /><SelectValue /></SelectTrigger>
                    <SelectContent>{audioTags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                )}
                {(audioOriginFilter !== "Todas" || audioTagFilter !== "Todos") && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setAudioOriginFilter("Todas"); setAudioTagFilter("Todos"); }}>Limpar</Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{audioEntries.length} áudio(s)</span>
              </div>
            </CardContent>
          </Card>

          {/* Audio cards */}
          <div className="space-y-3">
            {audioEntries.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  <Headphones size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Nenhum áudio encontrado</p>
                  <p className="text-xs mt-1">Envie áudios ou ajuste os filtros.</p>
                </CardContent>
              </Card>
            ) : audioEntries.map(entry => (
              <Card key={entry.id} className="group hover:shadow-md transition-all">
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start gap-4">
                    {/* Audio icon */}
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Headphones size={24} className="text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h4 className="text-sm font-semibold text-foreground leading-tight">
                        {entry.titulo.replace(/🎤\s*/g, "")}
                      </h4>

                      {/* Meta: date, origin, theme */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock size={10} /> {new Date(entry.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-foreground bg-muted px-2 py-0.5 rounded-full">
                          {fonteIcon(entry.fonte)} {entry.fonte || "Upload"}
                        </span>
                        {entry.orgao && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            {entry.orgao}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {entry.palavras_chave && entry.palavras_chave.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {entry.palavras_chave.map((kw, i) => (
                            <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">{kw}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Short description */}
                      {entry.descricao && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {entry.descricao}
                        </p>
                      )}

                      {/* Audio player */}
                      {entry.link && (
                        <audio controls preload="none" className="w-full mt-3 h-10 rounded-lg" style={{ maxWidth: 500 }}>
                          <source src={entry.link} />
                        </audio>
                      )}

                      {/* Full transcription */}
                      {entry.descricao && entry.descricao.length > 100 && (
                        <details className="mt-2">
                          <summary className="text-[11px] text-primary cursor-pointer hover:underline font-medium">📝 Ver transcrição completa</summary>
                          <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap bg-muted/50 p-3 rounded-lg border border-border max-h-40 overflow-y-auto">
                            {entry.descricao}
                          </p>
                        </details>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        {entry.link && (
                          <>
                            <button
                              onClick={() => handleSmartDownload(entry)}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium shadow-sm"
                            >
                              <Download size={13} /> Baixar Áudio
                            </button>
                            <button
                              onClick={() => {
                                const waText = encodeURIComponent(buildWhatsAppMessage(entry));
                                window.open(`https://wa.me/?text=${waText}`, "_blank");
                              }}
                              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium shadow-sm"
                            >
                              <Share2 size={13} /> WhatsApp
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => { if (entry.descricao) { navigator.clipboard.writeText(entry.descricao); toast({ title: "Transcrição copiada!" }); } }}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted text-foreground hover:bg-muted/70 transition-colors"
                        >
                          <Copy size={13} /> Copiar texto
                        </button>
                        <button onClick={() => openDialog(entry)}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/70 transition-colors"
                        >
                          <Sparkles size={13} /> Criar script
                        </button>
                      </div>
                    </div>

                    <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══════════ TAB: SOS UBERLÂNDIA ═══════════ */}
        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Rss size={18} className="text-orange-500" /> SOS Uberlândia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Importe notícias via RSS ou scraping do site.</p>
              <div className="flex gap-3 flex-wrap">
                <Button onClick={handleImport} disabled={importing || scraping} variant="outline" className="gap-2">
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {importing ? "Importando..." : "RSS (Últimas 20)"}
                </Button>
                <Button onClick={handleScrapeAll} disabled={importing || scraping} className="gap-2">
                  {scraping ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {scraping ? "Buscando..." : "Importar Todas (Site)"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> Automática a cada 6h.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB: INSTAGRAM ═══════════ */}
        <TabsContent value="instagram" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><InstagramIcon size={18} className="text-pink-500" /> Posts do Instagram</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 border border-pink-500/20 rounded-lg p-4 bg-pink-500/5">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2 w-full mb-2"><Rss size={14} className="text-pink-500" /> Importação automática</h3>
                  <div className="flex-1 min-w-[200px]">
                    <Input placeholder="Link do post ou perfil do Instagram" value={instaUrl} onChange={e => setInstaUrl(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={handleInstagramImport} disabled={instaImporting || !instaUrl.trim()} className="gap-1.5">
                    {instaImporting ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                    Importar Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleInstagramFeedImport} disabled={instaFeedImporting} className="gap-1.5">
                    {instaFeedImporting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Importar Feed @fabaovereador
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 border border-purple-500/20 rounded-lg p-4 bg-purple-500/5">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2 w-full mb-2">
                    <Sparkles size={14} className="text-purple-500" /> Classificação com IA
                  </h3>
                  <p className="text-xs text-muted-foreground w-full mb-2">
                    Processa posts não classificados usando IA para gerar título, tema e tags automaticamente.
                    {entries.filter(e => (e.fonte === "Instagram" || e.link?.includes("instagram.com")) && 
                      (e.titulo === "Instagram @fabaovereador" || e.titulo?.includes("Post do Instagram") || e.titulo?.includes("Reel do Instagram"))
                    ).length > 0 && (
                      <span className="ml-1 font-medium text-purple-600">
                        ({entries.filter(e => (e.fonte === "Instagram" || e.link?.includes("instagram.com")) && 
                          (e.titulo === "Instagram @fabaovereador" || e.titulo?.includes("Post do Instagram") || e.titulo?.includes("Reel do Instagram"))
                        ).length} pendentes)
                      </span>
                    )}
                  </p>
                  <Button 
                    size="sm" 
                    onClick={handleInstagramClassify} 
                    disabled={instaClassifying}
                    className="gap-1.5 bg-purple-600 hover:bg-purple-700"
                  >
                    {instaClassifying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {instaClassifying 
                      ? instaClassifyProgress 
                        ? `Classificando... ${instaClassifyProgress.processed}/${instaClassifyProgress.total}` 
                        : "Classificando..." 
                      : "Classificar Posts com IA"}
                  </Button>
                </div>
                <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-2"><UploadCloud size={14} /> Cadastrar manualmente</h3>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Título do Post</label>
                    <Input placeholder="Ex: Post sobre infraestrutura" value={instaPreview?.titulo || ""} onChange={e => setInstaPreview(prev => ({ titulo: e.target.value, descricao: prev?.descricao || "", data: prev?.data || new Date().toISOString() }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Legenda / Conteúdo</label>
                    <Textarea placeholder="Cole a legenda do post..." value={instaPreview?.descricao || ""} onChange={e => setInstaPreview(prev => ({ titulo: prev?.titulo || "", descricao: e.target.value, data: prev?.data || new Date().toISOString() }))} rows={5} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Link do Post (opcional)</label>
                    <Input placeholder="https://www.instagram.com/p/..." value={instaUrl} onChange={e => setInstaUrl(e.target.value)} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setInstaPreview(null); setInstaUrl(""); }}>Limpar</Button>
                    <Button size="sm" onClick={saveInstaPreview} disabled={!instaPreview?.titulo?.trim() || !instaPreview?.descricao?.trim()}>Salvar na Base</Button>
                  </div>
                </div>
              <div className="grid gap-3 md:grid-cols-2">
                {entries.filter(e => e.fonte === "Instagram" || e.categoria === "Instagram").length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    <InstagramIcon size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-medium">Nenhum post cadastrado</p>
                  </div>
                ) : entries.filter(e => e.fonte === "Instagram" || e.categoria === "Instagram").map(entry => (
                  <Card key={entry.id} className="group hover:shadow-md transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground">{entry.titulo}</h4>
                          {entry.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{entry.descricao}</p>}
                          <div className="flex items-center gap-2 mt-2">
                            {entry.data_publicacao && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock size={10} />{new Date(entry.data_publicacao).toLocaleDateString("pt-BR")}</span>}
                            {entry.link && <a href={entry.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><ExternalLink size={10} />Ver post</a>}
                          </div>
                        </div>
                        <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TAB: UPLOAD ═══════════ */}
        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><UploadCloud size={18} className="text-primary" /> Upload de Arquivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Envie PDF, DOCX, CSV ou imagens para extração automática.</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg"><FileText size={14} /> PDF/DOCX</span>
                <span className="inline-flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg"><FileSpreadsheet size={14} /> CSV</span>
                <span className="inline-flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg"><ImageIcon size={14} /> Imagens (OCR)</span>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Headphones size={12} /> Para áudios, use a aba <strong>"Áudios"</strong>.</p>
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.csv,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="gap-2">
                {uploadingFile ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {uploadingFile ? "Processando..." : "Selecionar Arquivos"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Script Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2"><Sparkles size={18} /> Criar Script</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Script para resposta via WhatsApp.</DialogDescription>
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

      {/* Script Create/Edit Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <MessageSquareText size={18} /> {sEditingId ? "Editar Script" : "Novo Script"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Script para atendimento via WhatsApp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="text-xs text-muted-foreground mb-1 block">Título</label><Input value={sFormTitulo} onChange={e => setSFormTitulo(e.target.value)} placeholder="Ex: Tarifa Zero Escolar" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Categoria</label><Input value={sFormCategoria} onChange={e => setSFormCategoria(e.target.value)} placeholder="Ex: Saúde, Habitação, Infraestrutura" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Tags (separadas por vírgula)</label><Input value={sFormTags} onChange={e => setSFormTags(e.target.value)} placeholder="escola, transporte, criança" /></div>
            <div><label className="text-xs text-muted-foreground mb-1 block">Conteúdo</label><Textarea value={sFormConteudo} onChange={e => setSFormConteudo(e.target.value)} rows={10} placeholder="Escreva o script aqui..." /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowScriptDialog(false)}>Cancelar</Button>
              <Button onClick={handleScriptCreate} disabled={!sFormTitulo.trim() || !sFormConteudo.trim()}>
                {sEditingId ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Script Generator Dialog */}
      <Dialog open={showAIScriptDialog} onOpenChange={setShowAIScriptDialog}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2"><Sparkles size={18} /> Gerar Script com IA</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Cole uma conversa do WhatsApp e a IA cria um script estruturado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea value={aiScriptInput} onChange={e => setAiScriptInput(e.target.value)} rows={8} placeholder="Cole aqui um trecho de conversa do WhatsApp..." />
            <Button onClick={handleGenerateAIScript} disabled={aiScriptGenerating || !aiScriptInput.trim()} className="gap-1.5 w-full">
              {aiScriptGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiScriptGenerating ? "Gerando..." : "Gerar Script"}
            </Button>
            {aiScriptResult && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">{aiScriptResult.titulo}</h4>
                  <Badge variant="secondary" className="text-xs">{aiScriptResult.categoria}</Badge>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{aiScriptResult.script_base || aiScriptResult.conteudo}</p>
                  {aiScriptResult.tags && (
                    <div className="flex flex-wrap gap-1">
                      {aiScriptResult.tags.map((t: string, i: number) => <Badge key={i} variant="outline" className="text-[9px]">{t}</Badge>)}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveAIScript} className="gap-1.5"><Plus size={14} /> Salvar Script</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      setSFormTitulo(aiScriptResult.titulo || "");
                      setSFormConteudo(aiScriptResult.script_base || aiScriptResult.conteudo || "");
                      setSFormCategoria(aiScriptResult.categoria || "");
                      setSFormTags(aiScriptResult.tags?.join(", ") || "");
                      setShowAIScriptDialog(false); setShowScriptDialog(true);
                    }}>
                      <Pencil size={14} /> Editar antes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
