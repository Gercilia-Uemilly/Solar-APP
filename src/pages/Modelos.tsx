import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Trash2, Search, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Modelo {
  id: string;
  nome: string;
  descricao: string | null;
  secretaria: string | null;
  assunto: string | null;
  conteudo: string | null;
  criado_por: string;
  criado_por_nome: string | null;
  publico: boolean;
  criado_em: string;
}

export default function Modelos() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [assunto, setAssunto] = useState("");
  const [secretaria, setSecretaria] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchModelos = async () => {
    setLoading(true);
    const { data } = await (supabase.from("modelos_oficio") as any)
      .select("*")
      .order("criado_em", { ascending: false });
    setModelos((data as Modelo[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchModelos(); }, []);

  const handleCreate = async () => {
    if (!nome.trim() || !user) return;
    setSaving(true);
    const { error } = await (supabase.from("modelos_oficio") as any).insert({
      nome,
      descricao: descricao || null,
      assunto: assunto || null,
      secretaria: secretaria || null,
      conteudo: conteudo || null,
      criado_por: user.id,
      criado_por_nome: user.user_metadata?.full_name || user.email || null,
      publico: true,
    });
    if (error) {
      toast({ title: "Erro ao salvar modelo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Modelo "${nome}" criado!` });
      setShowCreate(false);
      setNome(""); setDescricao(""); setAssunto(""); setSecretaria(""); setConteudo("");
      fetchModelos();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, modeloNome: string) => {
    if (!confirm(`Excluir o modelo "${modeloNome}"?`)) return;
    await (supabase.from("modelos_oficio") as any).delete().eq("id", id);
    setModelos((prev) => prev.filter((m) => m.id !== id));
    toast({ title: "Modelo excluído" });
  };

  const filtered = modelos.filter((m) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (m.nome || "").toLowerCase().includes(s) || (m.assunto || "").toLowerCase().includes(s) || (m.secretaria || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BookOpen size={24} className="text-primary" />
          <div>
            <h1 className="text-xl font-medium text-foreground">Modelos de Ofício</h1>
            <p className="text-sm text-muted-foreground">Salve e reutilize modelos</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-primary text-primary-foreground">
          <Plus size={16} className="mr-1" /> Novo Modelo
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary border-border" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum modelo encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <div key={m.id} className="bg-card rounded-xl border border-border p-4 space-y-2 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-medium text-foreground">{m.nome}</h3>
                {(m.criado_por === user?.id || isAdmin) && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(m.id, m.nome)}>
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
              {m.secretaria && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{m.secretaria}</span>}
              {m.assunto && <p className="text-xs text-muted-foreground truncate">{m.assunto}</p>}
              {m.descricao && <p className="text-xs text-muted-foreground line-clamp-2">{m.descricao}</p>}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className="text-[10px] text-muted-foreground">por {m.criado_por_nome || "—"}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(m.criado_em).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Modelo</DialogTitle>
            <DialogDescription>Crie um modelo reutilizável para ofícios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome do modelo *</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Tapa-buraco padrão" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição</label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Breve descrição" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Secretaria</label>
              <Input value={secretaria} onChange={(e) => setSecretaria(e.target.value)} placeholder="Ex: Secretaria de Infraestrutura" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Assunto</label>
              <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Assunto padrão" className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Conteúdo (HTML)</label>
              <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Texto do ofício..." className="bg-secondary border-border min-h-[120px]" />
            </div>
            <Button onClick={handleCreate} disabled={saving || !nome.trim()} className="w-full bg-primary text-primary-foreground">
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : null} Salvar Modelo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
