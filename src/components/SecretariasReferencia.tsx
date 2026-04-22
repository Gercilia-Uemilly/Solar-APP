import { useMemo, useState } from "react";
import { Search, Copy, Check, Megaphone, Landmark, Building2, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ORGAOS_REFERENCIA, RECADO_INSTITUCIONAL, type OrgaoReferencia } from "@/data/secretariasOrgaos";

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 flex-shrink-0"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast({ title: `${label} copiado`, description: text });
        setTimeout(() => setCopied(false), 1500);
      }}
      title={`Copiar ${label.toLowerCase()}`}
    >
      {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
    </Button>
  );
}

function OrgaoCard({ orgao }: { orgao: OrgaoReferencia }) {
  const isSecretaria = orgao.categoria === "Secretaria Municipal";
  return (
    <Card className="hover:shadow-md hover:border-primary/40 transition-all">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            {isSecretaria ? (
              <Building2 size={16} className="text-primary flex-shrink-0 mt-0.5" />
            ) : (
              <Landmark size={16} className="text-primary flex-shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground leading-snug">{orgao.nome}</h3>
              {orgao.sigla && (
                <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                  {orgao.sigla}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-1 border-t border-border/60">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Destinatário
              </p>
              <p className="text-xs text-foreground mt-0.5 leading-snug break-words">
                {orgao.destinatario}
              </p>
            </div>
            <CopyButton text={orgao.destinatario} label="Destinatário" />
          </div>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Vocativo
              </p>
              <p className="text-xs text-foreground mt-0.5 leading-snug break-words italic">
                {orgao.vocativo}
              </p>
            </div>
            <CopyButton text={orgao.vocativo} label="Vocativo" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SecretariasReferencia() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"todos" | "secretarias" | "orgaos">("todos");

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    return ORGAOS_REFERENCIA.filter((o) => {
      if (tab === "secretarias" && o.categoria !== "Secretaria Municipal") return false;
      if (tab === "orgaos" && o.categoria !== "Órgão Público") return false;
      if (!q) return true;
      const haystack = normalize(`${o.nome} ${o.sigla ?? ""} ${o.destinatario} ${o.vocativo}`);
      return haystack.includes(q);
    });
  }, [search, tab]);

  const counts = useMemo(
    () => ({
      total: ORGAOS_REFERENCIA.length,
      secretarias: ORGAOS_REFERENCIA.filter((o) => o.categoria === "Secretaria Municipal").length,
      orgaos: ORGAOS_REFERENCIA.filter((o) => o.categoria === "Órgão Público").length,
    }),
    [],
  );

  return (
    <div className="space-y-4">
      {/* Recado institucional em destaque */}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="p-4 flex gap-3">
          <div className="p-2 rounded-lg bg-primary/15 h-fit">
            <Megaphone size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              ⚠️ Recado da equipe
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {RECADO_INSTITUCIONAL}
            </p>
            <p className="text-[11px] text-foreground mt-2 flex items-center gap-1.5">
              <Info size={11} className="text-primary" />
              <span>
                Use o campo de busca abaixo para encontrar rapidamente o órgão e copiar o destinatário ou vocativo correto.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Busca + filtros */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do órgão, sigla, destinatário ou vocativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="bg-muted/50 p-1 h-auto">
              <TabsTrigger value="todos" className="text-xs gap-1.5">
                Todos <Badge variant="secondary" className="text-[9px] px-1.5">{counts.total}</Badge>
              </TabsTrigger>
              <TabsTrigger value="secretarias" className="text-xs gap-1.5">
                <Building2 size={12} /> Secretarias{" "}
                <Badge variant="secondary" className="text-[9px] px-1.5">{counts.secretarias}</Badge>
              </TabsTrigger>
              <TabsTrigger value="orgaos" className="text-xs gap-1.5">
                <Landmark size={12} /> Órgãos Públicos{" "}
                <Badge variant="secondary" className="text-[9px] px-1.5">{counts.orgaos}</Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-0">
              <p className="text-xs text-muted-foreground mt-2">
                {filtered.length} resultado(s)
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Grade de cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Search size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum órgão encontrado</p>
            <p className="text-xs mt-1">Tente outro termo de busca.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => (
            <OrgaoCard key={`${o.categoria}-${o.nome}`} orgao={o} />
          ))}
        </div>
      )}
    </div>
  );
}