import { CardGridSkeleton, ListSkeleton } from "@/components/ui/skeletons";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Search, Download, Trash2, RefreshCw, Loader2, ExternalLink, MapPin, Landmark, Clock, Sparkles, MessageSquare, AlertTriangle, Filter, Star, StarOff, FileText, FileSpreadsheet, Copy, Share2, Calendar, Tag, Globe, Headphones, ImageIcon, UploadCloud, Rss, Instagram as InstagramIcon, Library, Info, Smartphone, Monitor, Plus, Pencil, MessageSquareText, Eye, Check, X } from "lucide-react";
import ScriptsExplorer from "@/components/ScriptsExplorer";
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
import ContatosTable from "@/components/ContatosTable";
import SecretariasReferencia from "@/components/SecretariasReferencia";

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

// Componente que carrega a duração de um áudio (minutagem) sem reproduzir
function AudioDuration({ src }: { src: string | null }) {
  const [dur, setDur] = useState<number | null>(null);
  useEffect(() => {
    if (!src) return;
    const a = new Audio();
    a.preload = "metadata";
    a.src = src;
    const onLoaded = () => {
      if (isFinite(a.duration) && a.duration > 0) setDur(a.duration);
    };
    a.addEventListener("loadedmetadata", onLoaded);
    return () => {
      a.removeEventListener("loadedmetadata", onLoaded);
      a.src = "";
    };
  }, [src]);
  if (dur == null) return <span className="text-[10px] text-muted-foreground">--:--</span>;
  const m = Math.floor(dur / 60);
  const s = Math.floor(dur % 60).toString().padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full">
      <Clock size={10} /> {m}:{s}
    </span>
  );
}

// Classifica um áudio em um tema legível baseado em palavras-chave / título / descrição
function classifyAudioTheme(entry: KnowledgeEntry): string {
  const txt = `${entry.titulo} ${entry.descricao || ""} ${(entry.palavras_chave || []).join(" ")}`.toLowerCase();
  const rules: Array<{ theme: string; kws: string[] }> = [
    { theme: "🩺 Saúde", kws: ["saúde", "saude", "ubs", "hospital", "remédio", "remedio", "consulta", "médico", "medico", "sus", "vacina"] },
    { theme: "🎓 Educação", kws: ["escola", "creche", "vaga escolar", "educação", "educacao", "aluno", "ensino", "professor"] },
    { theme: "💼 Emprego e Vagas", kws: ["jovem aprendiz", "vaga", "emprego", "currículo", "curriculo", "trabalho", "estágio", "estagio"] },
    { theme: "🚧 Obras e Infraestrutura", kws: ["buraco", "asfalto", "obra", "rua", "calçada", "calcada", "pavimentação", "pavimentacao", "tapa-buraco"] },
    { theme: "💡 Iluminação e Energia", kws: ["iluminação", "iluminacao", "poste", "lâmpada", "lampada", "cemig", "energia", "luz"] },
    { theme: "💧 Água e Esgoto", kws: ["dmae", "água", "agua", "esgoto", "vazamento", "encanamento"] },
    { theme: "🧹 Limpeza Urbana", kws: ["lixo", "entulho", "limpeza", "varrição", "varricao", "coleta"] },
    { theme: "🌳 Meio Ambiente / Praças", kws: ["praça", "praca", "árvore", "arvore", "poda", "parque", "meio ambiente"] },
    { theme: "🚌 Transporte / Trânsito", kws: ["ônibus", "onibus", "transporte", "settran", "trânsito", "transito", "semáforo", "semaforo"] },
    { theme: "🏠 Habitação / Moradia", kws: ["moradia", "casa", "aluguel social", "habitação", "habitacao"] },
    { theme: "🤝 Assistência Social", kws: ["cras", "creas", "bolsa", "auxílio", "auxilio", "assistência social", "assistencia social"] },
    { theme: "🛡️ Segurança", kws: ["polícia", "policia", "segurança", "seguranca", "guarda municipal", "violência", "violencia"] },
    { theme: "🐾 Animais", kws: ["cachorro", "gato", "animal", "castração", "castracao", "ccz"] },
    { theme: "📣 Reclamação / Denúncia", kws: ["reclamação", "reclamacao", "denúncia", "denuncia", "abandono"] },
    { theme: "📅 Evento / Convite", kws: ["evento", "convite", "reunião", "reuniao", "audiência", "audiencia"] },
  ];
  for (const r of rules) {
    if (r.kws.some(k => txt.includes(k))) return r.theme;
  }
  // fallback: primeira palavra-chave
  if (entry.palavras_chave && entry.palavras_chave.length > 0) {
    return `🏷️ ${entry.palavras_chave[0]}`;
  }
  return "📂 Outros";
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

const INSTAGRAM_PENDING_TITLE_PATTERNS = [
  "Instagram @fabaovereador",
  "Post do Instagram",
  "Reel do Instagram",
] as const;

function isPendingInstagramEntry(entry: KnowledgeEntry) {
  return (entry.fonte === "Instagram" || entry.link?.includes("instagram.com"))
    && (
      entry.categoria === "Instagram"
      || INSTAGRAM_PENDING_TITLE_PATTERNS.some((pattern) => entry.titulo?.includes(pattern))
    );
}

const TAB_CONFIG = [
  { value: "base", label: "Base", icon: Library, adminOnly: false },
  { value: "scripts", label: "Scripts", icon: MessageSquareText, adminOnly: false },
  { value: "audios", label: "Áudios", icon: Headphones, adminOnly: false },
  { value: "importar", label: "SOS Uberlândia", icon: Rss, adminOnly: false },
  { value: "instagram", label: "Instagram", icon: InstagramIcon, adminOnly: false },
  { value: "upload", label: "Upload", icon: UploadCloud, adminOnly: false },
  { value: "contatos", label: "Contatos", icon: Smartphone, adminOnly: false },
  { value: "secretarias", label: "Secretarias", icon: Landmark, adminOnly: false },
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

/** Category color mapping for script cards */
function getCategoryColor(cat: string): string {
  const colors: Record<string, string> = {
    "ANIMAIS": "bg-amber-500",
    "SAÚDE": "bg-red-500",
    "JURÍDICO": "bg-indigo-500",
    "EDUCAÇÃO": "bg-blue-500",
    "EMPREGO": "bg-emerald-500",
    "SOCIAL": "bg-violet-500",
    "TRANSPORTE": "bg-cyan-500",
    "DMAE e CEMIG": "bg-orange-500",
    "CASAS POPULARES": "bg-rose-500",
    "ESPORTE": "bg-lime-500",
    "MEIO AMBIENTE": "bg-green-600",
    "REQUERIMENTOS": "bg-slate-500",
    "PEDIDOS DE AJUDA": "bg-pink-500",
    "ARQUIVOS TEMPORÁRIOS": "bg-gray-500",
  };
  return colors[cat.toUpperCase()] || colors[cat] || "bg-primary";
}

/** Download audio and open WhatsApp for manual attachment */
function downloadAndOpenWhatsApp(entry: KnowledgeEntry, phoneNumber?: string | null, showToast?: () => void) {
  // 1. Download the audio file
  if (entry.link) {
    const a = document.createElement("a");
    a.href = entry.link;
    a.download = entry.titulo.replace(/[^\w\s.-]/g, "").trim() + ".mp3";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // 2. Open WhatsApp
  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    window.open(`https://wa.me/${fullPhone}`, "_blank");
  } else {
    window.open(`https://web.whatsapp.com`, "_blank");
  }

  // 3. Show instruction toast
  showToast?.();
}

export default function BancoInformacoes() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const { data: entries, setData: setEntries, loading, refetch: fetchEntries } = useRealtimeTable<KnowledgeEntry>({
    table: "base_conhecimento",
    channel: "base-conhecimento-realtime",
    orderBy: { column: "created_at", ascending: false },
    select: "id,titulo,descricao,palavras_chave,orgao,bairro,data_publicacao,link,fonte,categoria,modelo,created_at",
    limit: 1000,
    disableRealtime: true,
  });
  const { data: audioBaseEntries, loading: audioLoading, refetch: fetchAudioEntries } = useRealtimeTable<KnowledgeEntry>({
    table: "base_conhecimento",
    channel: "base-conhecimento-audios-realtime",
    orderBy: { column: "created_at", ascending: false },
    select: "id,titulo,descricao,palavras_chave,orgao,bairro,data_publicacao,link,fonte,categoria,modelo,created_at",
    filters: { categoria: "Áudio" },
    limit: 300,
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
  // Resultados de busca no servidor — necessário porque a base tem mais linhas
  // do que o cache local (limit: 1000) e a pesquisa por título/descrição
  // precisa alcançar TODA a tabela.
  const [serverSearchResults, setServerSearchResults] = useState<KnowledgeEntry[] | null>(null);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const [fonteFilter, setFonteFilter] = useState("Todas");
  const [dateFilter, setDateFilter] = useState("Todas");
  const [themeFilter, setThemeFilter] = useState("Todos");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  // Paginação da aba Base — permite navegar por TODOS os registros da lista filtrada
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;
  const [sosSearch, setSosSearch] = useState("");
  const [sosSortOrder, setSosSortOrder] = useState<"desc" | "asc">("desc");
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
  const [audioGrouped, setAudioGrouped] = useState(true);

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
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);

  const refreshKnowledgeViews = useCallback(async () => {
    await Promise.all([fetchEntries(), fetchAudioEntries()]);
  }, [fetchEntries, fetchAudioEntries]);

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
    // Fonte base: quando há termo de busca, usa a união entre o cache local
    // e os resultados vindos do servidor (para cobrir linhas fora do cache).
    const base: KnowledgeEntry[] = search && serverSearchResults
      ? (() => {
          const map = new Map<string, KnowledgeEntry>();
          for (const e of entries) map.set(e.id, e);
          for (const e of serverSearchResults) map.set(e.id, e);
          return Array.from(map.values());
        })()
      : [...entries];
    let result = base;
    if (fonteFilter !== "Todas") result = result.filter(e => e.fonte === fonteFilter);
    if (themeFilter !== "Todos") result = result.filter(e => e.categoria === themeFilter);
    if (dateFilter !== "Todas") {
      const now = Date.now();
      const days = dateFilter === "Hoje" ? 1 : dateFilter === "7 dias" ? 7 : dateFilter === "30 dias" ? 30 : 90;
      result = result.filter(e => (now - new Date(e.created_at).getTime()) / 86400000 <= days);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(e =>
        e.titulo.toLowerCase().includes(s) ||
        e.descricao?.toLowerCase().includes(s) ||
        e.orgao?.toLowerCase().includes(s) ||
        e.bairro?.toLowerCase().includes(s) ||
        e.palavras_chave?.some(k => k.toLowerCase().includes(s))
      );
    }
    return result.sort((a, b) => {
      const da = new Date(a.data_publicacao || a.created_at).getTime();
      const db = new Date(b.data_publicacao || b.created_at).getTime();
      return sortOrder === "desc" ? db - da : da - db;
    });
  }, [entries, serverSearchResults, search, fonteFilter, themeFilter, dateFilter, sortOrder]);

  // Reseta paginação sempre que a lista filtrada muda por busca/filtros/ordem
  useEffect(() => { setPage(1); }, [search, fonteFilter, themeFilter, dateFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  // Busca no servidor com debounce — cobre linhas que ficam fora do cache local
  // quando a tabela ultrapassa o limite de 1000.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setServerSearchResults(null);
      setServerSearchLoading(false);
      return;
    }
    let cancelled = false;
    setServerSearchLoading(true);
    const timer = setTimeout(async () => {
      const escaped = term.replace(/[%,]/g, " ");
      const like = `%${escaped}%`;
      const { data, error } = await supabase
        .from("base_conhecimento" as any)
        .select("id,titulo,descricao,palavras_chave,orgao,bairro,data_publicacao,link,fonte,categoria,modelo,created_at")
        .or(
          `titulo.ilike.${like},descricao.ilike.${like},orgao.ilike.${like},bairro.ilike.${like}`
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) {
        console.error("Busca no banco falhou:", error);
        setServerSearchResults([]);
      } else {
        setServerSearchResults((data as unknown as KnowledgeEntry[]) || []);
      }
      setServerSearchLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [search]);

  const sosEntries = useMemo(() => {
    let result = entries.filter(e => e.fonte === "SOS Uberlândia");
    if (sosSearch) {
      const s = sosSearch.toLowerCase();
      result = result.filter(e =>
        e.titulo.toLowerCase().includes(s) ||
        e.descricao?.toLowerCase().includes(s) ||
        e.palavras_chave?.some(k => k.toLowerCase().includes(s))
      );
    }
    return [...result].sort((a, b) => {
      const da = new Date(a.data_publicacao || a.created_at).getTime();
      const db = new Date(b.data_publicacao || b.created_at).getTime();
      return sosSortOrder === "desc" ? db - da : da - db;
    });
  }, [entries, sosSearch, sosSortOrder]);

  const audioEntries = useMemo(() => {
    let result = audioBaseEntries;
    if (audioOriginFilter !== "Todas") result = result.filter(e => e.fonte === audioOriginFilter);
    if (audioTagFilter !== "Todos") result = result.filter(e => e.palavras_chave?.includes(audioTagFilter));
    if (!audioSearch) return result;
    const s = audioSearch.toLowerCase();
    return result.filter(e =>
      e.titulo.toLowerCase().includes(s) ||
      e.descricao?.toLowerCase().includes(s) ||
      e.palavras_chave?.some(k => k.toLowerCase().includes(s))
    );
  }, [audioBaseEntries, audioSearch, audioOriginFilter, audioTagFilter]);

  const audioOrigins = useMemo(() => {
    const s = new Set(audioBaseEntries.map(e => e.fonte).filter(Boolean));
    return ["Todas", ...Array.from(s)] as string[];
  }, [audioBaseEntries]);

  const audioTags = useMemo(() => {
    const s = new Set(audioBaseEntries.flatMap(e => e.palavras_chave || []).filter(Boolean));
    return ["Todos", ...Array.from(s)] as string[];
  }, [audioBaseEntries]);

  // Agrupa os áudios por tema classificado para exibição
  const audioGroups = useMemo(() => {
    const map = new Map<string, KnowledgeEntry[]>();
    for (const e of audioEntries) {
      const theme = classifyAudioTheme(e);
      if (!map.has(theme)) map.set(theme, []);
      map.get(theme)!.push(e);
    }
    return Array.from(map.entries())
      .map(([theme, items]) => ({ theme, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [audioEntries]);

  const instagramEntries = useMemo(
    () => entries.filter(e => e.fonte === "Instagram" || e.categoria === "Instagram"),
    [entries]
  );

  const pendingInstagramEntries = useMemo(
    () => entries.filter(isPendingInstagramEntry),
    [entries]
  );

  // Scripts computed
  const scriptCategories = useMemo(() => {
    const cats = new Set(scripts.map(s => s.categoria));
    return Array.from(cats).sort();
  }, [scripts]);

  const filteredScripts = useMemo(() => {
    return scripts.filter(s => {
      if (scriptCatFilter === "Favoritos" && !s.favorito) return false;
      if (scriptCatFilter !== "Todas" && scriptCatFilter !== "Favoritos" && s.categoria.toUpperCase() !== scriptCatFilter.toUpperCase()) return false;
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
    audios: audioBaseEntries.length,
    instagram: instagramEntries.length,
    modelos: entries.filter(e => e.modelo).length,
  }), [entries, scripts, audioBaseEntries.length, instagramEntries.length]);

  // ─── Handlers ───
  const handleImport = async () => {
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-knowledge", { body: { action: "fetch_rss", limit: 20 } });
      if (error) throw error;
      toast({ title: "Importação concluída!", description: `${data.saved} novas notícias importadas.` });
      await refreshKnowledgeViews();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally { setImporting(false); }
  };

  const handleScrapeAll = async (pages = 5) => {
    setScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-sos-uberlandia", { body: { pages } });
      if (error) throw error;
      toast({ title: "Importação concluída!", description: `${data.inserted} novas notícias importadas (${data.skipped} já existentes).` });
      await refreshKnowledgeViews();
    } catch (err: any) {
      toast({ title: "Erro na importação", description: err.message, variant: "destructive" });
    } finally { setScraping(false); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("base_conhecimento" as any).delete().eq("id", id);
    await refreshKnowledgeViews();
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
        await refreshKnowledgeViews(); setInstaUrl("");
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
      await refreshKnowledgeViews();
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
    setInstaPreview(null); setInstaEditing(false); setInstaUrl(""); await refreshKnowledgeViews();
  };

  const getInstagramClassificationToken = async (forceRefresh = false) => {
    const loadSession = forceRefresh
      ? supabase.auth.refreshSession()
      : supabase.auth.getSession();

    const { data, error } = await loadSession;
    const activeSession = data.session;
    const expiresAtMs = activeSession?.expires_at ? activeSession.expires_at * 1000 : 0;
    const isExpiredOrNearExpiry = !forceRefresh && (!activeSession?.access_token || (expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000));

    if (error || isExpiredOrNearExpiry) {
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshedData.session?.access_token) {
        throw new Error("Sua sessão expirou. Entre novamente para classificar os posts.");
      }
      return refreshedData.session.access_token;
    }

    if (!activeSession?.access_token) {
      throw new Error("Faça login novamente para classificar os posts.");
    }

    return activeSession.access_token;
  };

  const classifyInstagramBatch = async (limit: number, accessToken: string) => {
    const { data, error } = await supabase.functions.invoke("classify-instagram", {
      body: { limit },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!error) return { data, accessToken };

    const shouldRetryWithFreshSession = /401|jwt|token|autenticado|authorization/i.test(error.message || "");
    if (!shouldRetryWithFreshSession) {
      throw error;
    }

    const refreshedToken = await getInstagramClassificationToken(true);
    const retry = await supabase.functions.invoke("classify-instagram", {
      body: { limit },
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
      },
    });

    if (retry.error) throw retry.error;
    return { data: retry.data, accessToken: refreshedToken };
  };

  const handleInstagramClassify = async () => {
    setInstaClassifying(true);
    setInstaClassifyProgress(null);
    try {
      const batchLimit = 50;
      let processed = 0;
      let updated = 0;
      let totalEstimate = Math.max(pendingInstagramEntries.length, batchLimit);
      let accessToken = await getInstagramClassificationToken();

      setInstaClassifyProgress({ processed: 0, total: totalEstimate });

      for (let batch = 0; batch < 60; batch++) {
        const result = await classifyInstagramBatch(batchLimit, accessToken);
        const data = result.data;
        accessToken = result.accessToken;

        const processedBatch = Number(data?.processed || 0);
        const updatedBatch = Number(data?.updated || 0);
        const fetchedBatch = Number(data?.total || 0);

        processed += processedBatch;
        updated += updatedBatch;
        totalEstimate = Math.max(totalEstimate, processed + (fetchedBatch === batchLimit ? batchLimit : 0));
        setInstaClassifyProgress({ processed, total: totalEstimate });

        if (fetchedBatch === 0 || processedBatch === 0 || fetchedBatch < batchLimit) {
          break;
        }
      }

      toast({ 
        title: "Classificação concluída!", 
        description: `${updated} posts atualizados de ${processed} processados.` 
      });
      await refreshKnowledgeViews();
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
        } else if (["txt", "md"].includes(ext)) {
          extractedText = await file.text();
        }
        if (extractedText && user) {
          // Use AI to classify and generate title/category, then save as script
          let titulo = file.name.replace(/\.[^.]+$/, "");
          let categoria = "Geral";
          let tags: string[] = [];
          let conteudo = extractedText.substring(0, 5000);
          try {
            const { data: classData } = await supabase.functions.invoke("classificar-conteudo", {
              body: { conteudo: extractedText.substring(0, 3000), tipo: `arquivo ${ext.toUpperCase()}` },
            });
            if (classData) {
              titulo = classData.assunto || classData.titulo || titulo;
              categoria = classData.categoria || categoria;
              tags = classData.tags || tags;
            }
          } catch {
            // fallback: use file name as title
          }
          // Save as script
          const { error: scriptErr } = await supabase.from("scripts").insert({
            titulo,
            conteudo,
            categoria,
            tags,
            author_id: user.id,
          });
          if (scriptErr) throw scriptErr;
          // Also save to base_conhecimento for reference
          await supabase.from("base_conhecimento" as any).insert({
            titulo,
            descricao: extractedText.substring(0, 2000),
            fonte: "Upload",
            categoria: `Upload ${ext.toUpperCase()}`,
            link: null,
          });
          toast({ title: `"${file.name}" classificado e salvo como script!`, description: `Categoria: ${categoria}` });
        }
      } catch (err: any) {
        toast({ title: `Erro em "${file.name}"`, description: err.message, variant: "destructive" });
      }
    }
    setUploadingFile(false); await refreshKnowledgeViews(); await fetchScripts();
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
    setUploadingAudio(false); await refreshKnowledgeViews();
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

  const handleScriptCopyWithFeedback = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptId(id);
    toast({ title: "Copiado!", description: "Script copiado para a área de transferência." });
    setTimeout(() => setCopiedScriptId(null), 2000);
  }, [toast]);

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

  const renderAudioCard = (entry: KnowledgeEntry) => (
    <Card key={entry.id} className="group hover:shadow-md transition-all">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Headphones size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-foreground leading-tight">
              {entry.titulo.replace(/🎤\s*/g, "")}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock size={10} /> {new Date(entry.created_at).toLocaleDateString("pt-BR")}
              </span>
              <AudioDuration src={entry.link} />
              <span className="inline-flex items-center gap-1 text-[10px] text-foreground bg-muted px-2 py-0.5 rounded-full">
                {fonteIcon(entry.fonte)} {entry.fonte || "Upload"}
              </span>
              {entry.orgao && (
                <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {entry.orgao}
                </span>
              )}
            </div>
            {entry.palavras_chave && entry.palavras_chave.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {entry.palavras_chave.map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] px-1.5 py-0">{kw}</Badge>
                ))}
              </div>
            )}
            {entry.descricao && (
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{entry.descricao}</p>
            )}
            {entry.link && (
              <audio controls preload="none" className="w-full mt-3 h-10 rounded-lg" style={{ maxWidth: 500 }}>
                <source src={entry.link} />
              </audio>
            )}
            {entry.descricao && entry.descricao.length > 100 && (
              <details className="mt-2">
                <summary className="text-[11px] text-primary cursor-pointer hover:underline font-medium">📝 Ver transcrição completa</summary>
                <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap bg-muted/50 p-3 rounded-lg border border-border max-h-40 overflow-y-auto">
                  {entry.descricao}
                </p>
              </details>
            )}
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
                    onClick={() => downloadAndOpenWhatsApp(entry, null, () => toast({ title: "Áudio baixado!", description: "Agora anexe o arquivo no WhatsApp clicando no ícone de clipe 📎" }))}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium shadow-sm"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    Baixar e Abrir WhatsApp
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
  );

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
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "desc" | "asc")}>
                  <SelectTrigger className="w-[150px] h-8 text-xs"><Clock size={12} className="mr-1 flex-shrink-0" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Mais recentes</SelectItem>
                    <SelectItem value="asc">Mais antigas</SelectItem>
                  </SelectContent>
                </Select>
                {(fonteFilter !== "Todas" || themeFilter !== "Todos" || dateFilter !== "Todas") && (
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setFonteFilter("Todas"); setThemeFilter("Todos"); setDateFilter("Todas"); }}>Limpar</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {filtered.length} resultado(s)
                {filtered.length > PAGE_SIZE && (
                  <> · Página {currentPage} de {totalPages}</>
                )}
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <div className="col-span-full">
                <CardGridSkeleton items={6} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Library size={48} className="mx-auto mb-3 opacity-30" /><p className="font-medium">Nenhuma entrada encontrada</p>
              </div>
            ) : paginated.map(entry => (
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

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage <= 1}
                onClick={() => setPage(1)}
              >
                « Primeira
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ‹ Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Próxima ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                Última »
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ TAB: SCRIPTS ═══════════ */}
        <TabsContent value="scripts" className="space-y-0">
          <ScriptsExplorer
            scripts={scripts}
            loading={scriptsLoading}
            onEdit={handleScriptEdit}
            onDelete={handleScriptDelete}
            onToggleFav={handleScriptToggleFav}
            onNewScript={() => { resetScriptForm(); setShowScriptDialog(true); }}
            onAIScript={() => setShowAIScriptDialog(true)}
          />
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
                <Button
                  variant={audioGrouped ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => setAudioGrouped(g => !g)}
                  title="Alternar agrupamento por tema"
                >
                  <Library size={12} /> {audioGrouped ? "Agrupado por tema" : "Lista simples"}
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">{audioEntries.length} áudio(s)</span>
              </div>
            </CardContent>
          </Card>

          {/* Audio cards */}
          <div className="space-y-3">
            {audioLoading ? (
              <Card>
                <CardContent className="py-6">
                  <ListSkeleton items={4} />
                </CardContent>
              </Card>
            ) : audioEntries.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12 text-muted-foreground">
                  <Headphones size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="font-medium">Nenhum áudio encontrado</p>
                  <p className="text-xs mt-1">Envie áudios ou ajuste os filtros.</p>
                </CardContent>
              </Card>
            ) : audioGrouped ? (
              audioGroups.map(group => (
                <div key={group.theme} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <h3 className="text-sm font-bold text-foreground">{group.theme}</h3>
                    <Badge variant="secondary" className="text-[10px]">{group.items.length}</Badge>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  {group.items.map(entry => renderAudioCard(entry))}
                </div>
              ))
            ) : audioEntries.map(entry => renderAudioCard(entry))}
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
                <Button onClick={() => handleScrapeAll(3)} disabled={importing || scraping} variant="outline" className="gap-2">
                  {scraping ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {scraping ? "Buscando..." : "Últimas 60"}
                </Button>
                <Button onClick={() => handleScrapeAll(10)} disabled={importing || scraping} variant="outline" className="gap-2">
                  {scraping ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {scraping ? "Buscando..." : "Importar 200"}
                </Button>
                <Button onClick={() => handleScrapeAll(50)} disabled={importing || scraping} className="gap-2">
                  {scraping ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {scraping ? "Buscando..." : "Importar Todo o Site (1000)"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={12} /> Atualização automática a cada 4 horas.</p>
            </CardContent>
          </Card>

          {/* Lista de notícias importadas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText size={14} className="text-muted-foreground" />
                Notícias importadas ({sosEntries.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar notícia..."
                    value={sosSearch}
                    onChange={(e) => setSosSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Select value={sosSortOrder} onValueChange={(v) => setSosSortOrder(v as "desc" | "asc")}>
                  <SelectTrigger className="w-[160px] h-9 text-xs">
                    <Clock size={12} className="mr-1" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Mais recentes</SelectItem>
                    <SelectItem value="asc">Mais antigas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sosEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Rss size={32} className="mx-auto mb-2 opacity-30" />
                  Nenhuma notícia encontrada. Use os botões acima para importar.
                </div>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 max-h-[600px] overflow-y-auto pr-1">
                  {sosEntries.map((entry) => (
                    <div key={entry.id} className="border border-border rounded-lg p-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-semibold text-foreground line-clamp-2 flex-1">{entry.titulo}</h4>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => handleDelete(entry.id)}>
                            <Trash2 size={12} className="text-destructive" />
                          </Button>
                        )}
                      </div>
                      {entry.descricao && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.descricao}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock size={10} />
                          {new Date(entry.data_publicacao || entry.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        {entry.bairro && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin size={10} /> {entry.bairro}
                          </span>
                        )}
                        {entry.link && (
                          <a href={entry.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline ml-auto">
                            <ExternalLink size={10} /> Abrir
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    {pendingInstagramEntries.length > 0 && (
                      <span className="ml-1 font-medium text-purple-600">
                        ({pendingInstagramEntries.length} pendentes nesta carga)
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
                {instagramEntries.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-muted-foreground">
                    <InstagramIcon size={40} className="mx-auto mb-2 opacity-30" /><p className="text-sm font-medium">Nenhum post cadastrado</p>
                  </div>
                ) : instagramEntries.map(entry => (
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

        {/* ═══════════ TAB: CONTATOS ═══════════ */}
        <TabsContent value="contatos" className="space-y-4">
          <ContatosTable scripts={scripts as any} knowledgeEntries={entries as any} loading={scriptsLoading || loading} />
        </TabsContent>

        {/* ═══════════ TAB: SECRETARIAS ═══════════ */}
        <TabsContent value="secretarias" className="space-y-4">
          <SecretariasReferencia />
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
