import { useEffect, useMemo, useState } from "react";
import { Search, Phone, Copy, Check, Filter, Plus, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ScriptRow {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
}

interface KnowledgeRow {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
}

interface ContatoExtraido {
  nome: string;
  telefone: string;
  tipo: "Telefone" | "WhatsApp" | "Ambos";
  categoria: string;
  scriptTitulo: string;
  origem?: "Script" | "Planilha" | "Manual";
  id?: string;
}

const CONTATOS_PLANILHA: ContatoExtraido[] = [
  { nome: "ZAP 01 - Monyê", telefone: "(34) 98418-5325", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP 02 - Joana", telefone: "(34) 98435-6242", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP 03 - Monyê", telefone: "(34) 98431-5324", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP 04 - Joana", telefone: "(34) 98431-1657", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP 05 - Monyê", telefone: "(34) 98439-5505", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP 06 - Joana", telefone: "(34) 98430-0587", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP 07 - Gercilia", telefone: "(34) 98425-7665", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP Conecta Jovem - João", telefone: "(34) 99102-7957", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP Empregador - Georgeane", telefone: "(34) 98406-0364", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP Agenda - Gabriela", telefone: "(34) 98427-3897", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "ZAP Relações Políticas - Diego", telefone: "(34) 98441-9523", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 01 - Marielle", telefone: "(34) 98401-8068", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 02 - Kellen", telefone: "(34) 98440-0624", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 03 - Águeda", telefone: "(34) 98423-7647", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 04 - Maria", telefone: "(34) 97400-8012", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 05 - Kellen", telefone: "(34) 99974-5336", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 06 - Daiane", telefone: "(34) 98832-5694", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 07 - Águeda", telefone: "(34) 99725-3482", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
  { nome: "REQ 08 - Maria", telefone: "(34) 98433-2617", tipo: "WhatsApp", categoria: "Gabinete", scriptTitulo: "ZAPs e REQs do Gabinete 30", origem: "Planilha" },
];

function extrairContatos(scripts: ScriptRow[]): ContatoExtraido[] {
  const phoneRegex = /\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/g;
  const contatos: ContatoExtraido[] = [];
  const seen = new Set<string>();

  for (const script of scripts) {
    const matches = script.conteudo.match(phoneRegex);
    if (!matches) continue;

    for (const raw of matches) {
      const cleaned = raw.replace(/\s+/g, "").replace(/-/g, "");
      if (seen.has(cleaned + script.id)) continue;
      seen.add(cleaned + script.id);

      const isWhats = /whats|zap|wpp/i.test(script.conteudo);
      const isTel = /telefone|ligar|ligue|plantão|fone/i.test(script.conteudo);

      const nome = script.titulo
        .replace(/^(Animais|Social|Saúde|Educação|Jurídico|Esporte|DMAE|CEMIG|Transporte)\.\s*/i, "")
        .replace(/\.\s*$/, "")
        .trim();

      contatos.push({
        nome,
        telefone: raw.trim(),
        tipo: isWhats && isTel ? "Ambos" : isWhats ? "WhatsApp" : "Telefone",
        categoria: script.categoria,
        scriptTitulo: script.titulo,
      });
    }
  }

  return contatos.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome));
}

interface Props {
  scripts: ScriptRow[];
  knowledgeEntries?: KnowledgeRow[];
  loading: boolean;
}

export default function ContatosTable({ scripts, knowledgeEntries = [], loading }: Props) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todas");
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [customContatos, setCustomContatos] = useState<ContatoExtraido[]>(() => {
    try {
      const raw = localStorage.getItem("contatos_manuais_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [openNovo, setOpenNovo] = useState(false);
  const [novo, setNovo] = useState<{ nome: string; telefone: string; tipo: "Telefone" | "WhatsApp" | "Ambos"; categoria: string; observacao: string }>(
    { nome: "", telefone: "", tipo: "WhatsApp", categoria: "Gabinete", observacao: "" }
  );
  const [editandoId, setEditandoId] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("contatos_manuais_v1", JSON.stringify(customContatos));
    } catch {}
  }, [customContatos]);

  const contatos = useMemo(() => {
    const fromScripts = extrairContatos(scripts).map(c => ({ ...c, origem: "Script" as const }));
    // Merge planilha contacts, avoiding duplicates by phone
    const seen = new Set(fromScripts.map(c => c.telefone.replace(/\s+/g, "").replace(/-/g, "")));
    const fromPlanilha = CONTATOS_PLANILHA.filter(c => {
      const cleaned = c.telefone.replace(/\s+/g, "").replace(/-/g, "");
      if (seen.has(cleaned)) return false;
      seen.add(cleaned);
      return true;
    });
    return [...fromScripts, ...fromPlanilha, ...customContatos].sort(
      (a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome)
    );
  }, [scripts, customContatos]);

  const categorias = useMemo(() => {
    const s = new Set(contatos.map((c) => c.categoria));
    return ["Todas", ...Array.from(s).sort()];
  }, [contatos]);

  const filtered = useMemo(() => {
    let result = contatos;
    if (catFilter !== "Todas") result = result.filter((c) => c.categoria === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.nome.toLowerCase().includes(q) ||
          c.telefone.includes(q) ||
          c.categoria.toLowerCase().includes(q) ||
          c.scriptTitulo.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contatos, catFilter, search]);

  const handleCopy = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success("Número copiado!");
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleSalvarNovo = () => {
    if (!novo.nome.trim() || !novo.telefone.trim()) {
      toast.error("Preencha nome e telefone.");
      return;
    }
    if (editandoId) {
      setCustomContatos((prev) => prev.map((c) => c.id === editandoId ? {
        ...c,
        nome: novo.nome.trim(),
        telefone: novo.telefone.trim(),
        tipo: novo.tipo,
        categoria: novo.categoria.trim() || "Outros",
        scriptTitulo: novo.observacao.trim() || "Contato cadastrado manualmente",
      } : c));
      toast.success("Contato atualizado!");
    } else {
      const contato: ContatoExtraido = {
        id: crypto.randomUUID(),
        nome: novo.nome.trim(),
        telefone: novo.telefone.trim(),
        tipo: novo.tipo,
        categoria: novo.categoria.trim() || "Outros",
        scriptTitulo: novo.observacao.trim() || "Contato cadastrado manualmente",
        origem: "Manual",
      };
      setCustomContatos((prev) => [...prev, contato]);
      toast.success("Contato cadastrado!");
    }
    setNovo({ nome: "", telefone: "", tipo: "WhatsApp", categoria: "Gabinete", observacao: "" });
    setEditandoId(null);
    setOpenNovo(false);
  };

  const handleEditarManual = (c: ContatoExtraido) => {
    if (!c.id) return;
    setEditandoId(c.id);
    setNovo({
      nome: c.nome,
      telefone: c.telefone,
      tipo: c.tipo,
      categoria: c.categoria,
      observacao: c.scriptTitulo && c.scriptTitulo !== "Contato cadastrado manualmente" ? c.scriptTitulo : "",
    });
    setOpenNovo(true);
  };

  const handleRemoverManual = (id?: string) => {
    if (!id) return;
    setCustomContatos((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contato removido.");
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">Carregando contatos...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, categoria..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-muted-foreground" />
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="text-xs">
          <Phone size={12} className="mr-1" />
          {filtered.length} contato(s)
        </Badge>
        <Dialog open={openNovo} onOpenChange={(o) => {
          setOpenNovo(o);
          if (!o) {
            setEditandoId(null);
            setNovo({ nome: "", telefone: "", tipo: "WhatsApp", categoria: "Gabinete", observacao: "" });
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 gap-1.5">
              <Plus size={14} /> Cadastrar novo contato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editandoId ? "Editar contato" : "Cadastrar novo contato"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-nome">Nome</Label>
                <Input id="nc-nome" value={novo.nome} onChange={(e) => setNovo((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: João da Silva" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-tel">Telefone / WhatsApp</Label>
                <Input id="nc-tel" value={novo.telefone} onChange={(e) => setNovo((p) => ({ ...p, telefone: e.target.value }))} placeholder="(34) 99999-9999" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={novo.tipo} onValueChange={(v) => setNovo((p) => ({ ...p, tipo: v as typeof novo.tipo }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                      <SelectItem value="Telefone">Telefone</SelectItem>
                      <SelectItem value="Ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nc-cat">Categoria</Label>
                  <Input id="nc-cat" value={novo.categoria} onChange={(e) => setNovo((p) => ({ ...p, categoria: e.target.value }))} placeholder="Gabinete" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-obs">Observação (opcional)</Label>
                <Input id="nc-obs" value={novo.observacao} onChange={(e) => setNovo((p) => ({ ...p, observacao: e.target.value }))} placeholder="Ex: Contato do setor jurídico" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenNovo(false)}>Cancelar</Button>
              <Button onClick={handleSalvarNovo}>{editandoId ? "Salvar alterações" : "Salvar contato"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / Serviço</TableHead>
                <TableHead>Telefone / ZAP</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum contato encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c, i) => (
                  <TableRow key={`${c.telefone}-${i}`}>
                    <TableCell className="font-medium text-sm max-w-[250px] truncate" title={c.scriptTitulo}>
                      {c.nome}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.telefone}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.tipo === "WhatsApp"
                            ? "border-green-500/30 text-green-600 bg-green-500/10"
                            : c.tipo === "Ambos"
                            ? "border-blue-500/30 text-blue-600 bg-blue-500/10"
                            : "border-muted-foreground/30"
                        }
                      >
                        {c.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {c.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        c.origem === "Planilha"
                          ? "border-orange-500/30 text-orange-600 bg-orange-500/10 text-[10px]"
                          : c.origem === "Manual"
                          ? "border-primary/30 text-primary bg-primary/10 text-[10px]"
                          : "border-muted-foreground/30 text-[10px]"
                      }>
                        {c.origem || "Script"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(c.telefone)}>
                          {copiedPhone === c.telefone ? (
                            <Check size={14} className="text-green-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </Button>
                        {c.origem === "Manual" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditarManual(c)} title="Editar contato">
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoverManual(c.id)} title="Remover contato">
                              <Trash2 size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
