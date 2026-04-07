import { useMemo, useState } from "react";
import { Search, Phone, Copy, Check, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

function extrairContatos(scripts: ScriptRow[], knowledgeEntries: KnowledgeRow[]): ContatoExtraido[] {
  const phoneRegex = /\(?\d{2}\)?\s?\d{4,5}[\s-]?\d{4}/g;
  const contatos: ContatoExtraido[] = [];
  const seen = new Set<string>();

  // Extract from scripts
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

  // Extract from knowledge base entries (e.g. ZAPs e REQs)
  for (const entry of knowledgeEntries) {
    const text = entry.descricao || "";
    const matches = text.match(phoneRegex);
    if (!matches) continue;

    for (const raw of matches) {
      const cleaned = raw.replace(/\s+/g, "").replace(/-/g, "");
      if (seen.has(cleaned + entry.id)) continue;
      seen.add(cleaned + entry.id);

      const isWhats = /whats|zap|wpp/i.test(text) || /whats|zap|wpp/i.test(entry.titulo);
      const isTel = /telefone|ligar|ligue|plantão|fone|req/i.test(text) || /telefone|req/i.test(entry.titulo);

      // Try to find a label near the phone number
      const idx = text.indexOf(raw.trim());
      let nome = entry.titulo;
      if (idx > 0) {
        const before = text.substring(Math.max(0, idx - 80), idx);
        const lineMatch = before.match(/(?:^|\n)([^\n]{3,}?)[\s:–—-]*$/);
        if (lineMatch) {
          nome = lineMatch[1].replace(/^[-–—•*\s]+/, "").trim();
        }
      }

      contatos.push({
        nome,
        telefone: raw.trim(),
        tipo: isWhats && isTel ? "Ambos" : isWhats ? "WhatsApp" : "Telefone",
        categoria: entry.categoria || "Base",
        scriptTitulo: entry.titulo,
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

  const contatos = useMemo(() => extrairContatos(scripts, knowledgeEntries), [scripts, knowledgeEntries]);

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
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(c.telefone)}>
                        {copiedPhone === c.telefone ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </Button>
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
