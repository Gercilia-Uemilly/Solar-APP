import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todasAsLinhas } from "@/lib/todasAsLinhas";
import { useNavigate } from "react-router-dom";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { Loader2, Search, X, ExternalLink, Users, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  TIPOS, ROTULO_TIPO, COR_TIPO, FORMA_TIPO, MAX_PESSOAS, montarElementos, buscar,
  type TipoNo, type Filtros, type Expansao, type DadosMapa, type Cidade, type Orgao, type OficioMapa, type Fato, type PessoaMapa,
} from "@/lib/mapaGrafo";

type Periodo = "mes" | "3meses" | "ano";
const ROTULO_PERIODO: Record<Periodo, string> = { mes: "Último mês", "3meses": "Últimos 3 meses", ano: "Último ano" };
const desde = (p: Periodo) => {
  const d = new Date();
  if (p === "mes") d.setMonth(d.getMonth() - 1);
  else if (p === "3meses") d.setMonth(d.getMonth() - 3);
  else d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
};

// cytoscape só entende hsl com vírgulas ("hsl(210, 18%, 92%)"); os tokens vêm como "210 18% 92%"
const lerVar = (v: string) => `hsl(${getComputedStyle(document.documentElement).getPropertyValue(v).trim().split(/\s+/).join(", ")})`;
const reduzMovimento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function estilo(escuro: boolean): cytoscape.StylesheetJsonBlock[] {
  const cores = COR_TIPO[escuro ? "escuro" : "claro"];
  const texto = lerVar("--foreground");
  const fundo = lerVar("--card");
  return [
    { selector: "node", style: {
      width: "data(tam)", height: "data(tam)", label: "data(label)", "font-size": 13, "min-zoomed-font-size": 4, color: texto,
      "text-valign": "bottom", "text-margin-y": 4, "text-wrap": "wrap", "text-max-width": "170px",
      "text-background-color": fundo, "text-background-opacity": 0.85, "text-background-padding": "2px",
      "border-width": 2, "border-color": fundo,
    } },
    ...TIPOS.map(t => ({ selector: `node[tipo = "${t}"]`, style: { "background-color": cores[t], shape: FORMA_TIPO[t] } } as cytoscape.StylesheetJsonBlock)),
    // situação do órgão: borda tracejada/pontilhada + aviso no painel (nunca só cor)
    { selector: 'node[situacao = "conferir"]', style: { "border-width": 5, "border-style": "dashed", "border-color": lerVar("--status-pending") } },
    { selector: 'node[?semEmail]', style: { "border-width": 5, "border-style": "dotted", "border-color": lerVar("--destructive") } },
    { selector: "edge", style: { width: 1.5, "line-color": lerVar("--border"), "curve-style": "haystack" } },
    { selector: "node:selected, node.destaque", style: { "border-width": 5, "border-style": "solid", "border-color": lerVar("--primary") } },
    { selector: "node.apagado, edge.apagado", style: { opacity: 0.25 } },
  ];
}

interface Selecionado { id: string; tipo: TipoNo; label: string; ref: string; [k: string]: unknown }

export default function Mapa() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const caixaRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const t0 = useRef(performance.now());
  const [tempoCarga, setTempoCarga] = useState<number | null>(null);
  const [contagem, setContagem] = useState({ nos: 0, linhas: 0 });

  const [base, setBase] = useState<{ cidades: Cidade[]; orgaos: Orgao[]; fatos: Fato[] } | null>(null);
  const [oficios, setOficios] = useState<OficioMapa[]>([]);
  const [carregandoOficios, setCarregandoOficios] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pessoas, setPessoas] = useState<PessoaMapa[]>([]);

  const [periodo, setPeriodo] = useState<Periodo>("3meses");
  const [filtros, setFiltros] = useState<Filtros>({ cidadeId: "todas", tipos: new Set(TIPOS.filter(t => t !== "pessoa")), situacao: "todas" });
  const [expansao, setExpansao] = useState<Expansao>({ cidades: new Set(), orgaos: new Set(), pessoasBairro: null });
  const [busca, setBusca] = useState("");
  const [focoPendente, setFocoPendente] = useState<string | null>(null);
  const [sel, setSel] = useState<Selecionado | null>(null);
  const [vizinhos, setVizinhos] = useState<{ id: string; label: string; tipo: TipoNo; qtd?: number }[]>([]);
  const [extrasSel, setExtrasSel] = useState<Record<string, number | null>>({});
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains("dark"));

  // ── dados (só leitura) ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [c, o, f] = await Promise.all([
          supabase.from("cidades").select("id, nome").order("nome"),
          supabase.from("orgaos_publicos").select("id, cidade_id, nome, sigla, esfera, assuntos, situacao, email, telefone, endereco, fonte").eq("ativo", true),
          supabase.from("fatos_fabao" as any).select("chave, fato, situacao"),
        ]);
        if (c.error || o.error) throw c.error || o.error;
        setBase({ cidades: (c.data || []) as Cidade[], orgaos: (o.data || []) as unknown as Orgao[], fatos: f.error ? [] : ((f.data || []) as unknown as Fato[]) });
      } catch (e: any) {
        console.error("Mapa: erro ao carregar", e);
        setErro(e?.message || "Erro ao carregar o mapa");
      }
    })();
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCarregandoOficios(true);
    todasAsLinhas<OficioMapa>((de, ate) => supabase.from("oficios")
      .select("id, numero, assunto, bairro, cidade, orgao_destino_id, secretaria_identificada, created_at, status")
      .is("deleted_at", null).gte("created_at", desde(periodo)).order("created_at", { ascending: false }).range(de, ate))
      .then(l => { if (!cancelado) setOficios(l); })
      .catch(e => { console.error("Mapa: erro nos ofícios", e); if (!cancelado) setErro("Erro ao carregar os ofícios"); })
      .finally(() => { if (!cancelado) setCarregandoOficios(false); });
    return () => { cancelado = true; };
  }, [periodo]);

  const dados: DadosMapa | null = useMemo(() => base && { ...base, oficios, pessoas }, [base, oficios, pessoas]);
  const elementos: ElementDefinition[] = useMemo(() => dados ? montarElementos(dados, filtros, expansao) : [], [dados, filtros, expansao]);

  // ── tema claro/escuro ──────────────────────────────────────
  useEffect(() => {
    const obs = new MutationObserver(() => setEscuro(document.documentElement.classList.contains("dark")));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => { cyRef.current?.style(estilo(escuro)); }, [escuro]);

  // ── cytoscape ──────────────────────────────────────────────
  const selecionar = useCallback((id: string) => {
    const cy = cyRef.current;
    const n = cy?.$id(id);
    if (!cy || !n || n.empty()) return;
    cy.elements().unselect().removeClass("destaque apagado");
    n.select().addClass("destaque");
    const viz = n.closedNeighborhood();
    cy.elements().not(viz).addClass("apagado");
    if (reduzMovimento()) cy.center(n); else cy.animate({ center: { eles: n }, duration: 250 });
    setSel(n.data() as Selecionado);
    setVizinhos(n.neighborhood("node").map(v => ({ id: v.id(), label: v.data("label"), tipo: v.data("tipo"), qtd: v.data("qtd") as number })).sort((a, b) => (b.qtd || 0) - (a.qtd || 0)));
  }, []);

  useEffect(() => {
    if (!caixaRef.current || cyRef.current) return;
    const cy = cytoscape({ container: caixaRef.current, style: estilo(escuro), minZoom: 0.15, maxZoom: 3, wheelSensitivity: 0.3, boxSelectionEnabled: false });
    cyRef.current = cy;
    cy.on("tap", "node", ev => {
      const d = ev.target.data();
      selecionar(d.id);
      if (d.tipo === "cidade") setExpansao(e => { const s = new Set(e.cidades); s.has(d.ref) ? s.delete(d.ref) : s.add(d.ref); return { ...e, cidades: s }; });
      if (d.tipo === "orgao") setExpansao(e => { const s = new Set(e.orgaos); s.has(d.ref) ? s.delete(d.ref) : s.add(d.ref); return { ...e, orgaos: s }; });
    });
    cy.on("tap", ev => { if (ev.target === cy) { cy.elements().unselect().removeClass("destaque apagado"); setSel(null); } });
    return () => { cy.destroy(); cyRef.current = null; };
  }, [selecionar]); // eslint-disable-line react-hooks/exhaustive-deps

  // diff: mantém a posição de quem já está na tela, só acrescenta/remove o que mudou
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !dados) return;
    const novos = new Set(elementos.map(e => e.data.id as string));
    cy.batch(() => {
      cy.elements().filter(e => !novos.has(e.id())).remove();
      const ja = new Set(cy.elements().map(e => e.id()));
      for (const el of elementos) {
        if (ja.has(el.data.id as string)) cy.$id(el.data.id as string).data(el.data);
        else cy.add(el);
      }
    });
    const layout = cy.layout({ name: "cose", animate: false, randomize: false, nodeDimensionsIncludeLabels: true, idealEdgeLength: () => 140, nodeRepulsion: () => 40000, padding: 30, fit: !focoPendente } as any);
    layout.one("layoutstop", () => {
      setContagem({ nos: cy.nodes().length, linhas: cy.edges().length });
      if (tempoCarga === null && !carregandoOficios) setTempoCarga((performance.now() - t0.current) / 1000);
      if (focoPendente && !cy.$id(focoPendente).empty()) { selecionar(focoPendente); setFocoPendente(null); }
      else if (sel && !cy.$id(sel.id).empty()) selecionar(sel.id); // atualiza a lista "Liga em" depois de abrir
    });
    layout.run();
  }, [elementos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── extras do painel (contagens sob demanda) ───────────────
  useEffect(() => {
    setExtrasSel({});
    if (!sel) return;
    const conta = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? null;
    if (sel.tipo === "bairro") {
      Promise.all([
        conta(supabase.from("base_conhecimento").select("id", { count: "exact", head: true }).ilike("bairro", `%${sel.ref}%`)),
        conta(supabase.from("contacts").select("id", { count: "exact", head: true }).ilike("bairro", `%${sel.ref}%`)),
      ]).then(([conhecimento, pessoasN]) => setExtrasSel({ conhecimento, pessoas: pessoasN }));
    }
    if (sel.tipo === "assunto") {
      const termo = String(sel.label).split(" ")[0];
      Promise.all([
        conta(supabase.from("base_conhecimento").select("id", { count: "exact", head: true }).ilike("categoria", `%${termo}%`)),
        conta(supabase.from("scripts").select("id", { count: "exact", head: true }).ilike("categoria", `%${termo}%`)),
      ]).then(([conhecimento, scripts]) => setExtrasSel({ conhecimento, scripts }));
    }
  }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fazerBusca = () => {
    if (!dados) return;
    const r = buscar(dados, busca);
    if (!r) { toast({ title: "Nada encontrado", description: `Não achei "${busca}" no mapa.` }); return; }
    if (filtros.cidadeId !== "todas" && r.expandirCidade && r.expandirCidade !== filtros.cidadeId) setFiltros(f => ({ ...f, cidadeId: "todas" }));
    if (r.expandirCidade) setExpansao(e => ({ ...e, cidades: new Set(e.cidades).add(r.expandirCidade!) }));
    if (cyRef.current && !cyRef.current.$id(r.id).empty()) selecionar(r.id); else setFocoPendente(r.id);
  };

  const abrirOficio = async (id: string) => {
    const { data, error } = await supabase.from("oficios").select("*").eq("id", id).maybeSingle();
    if (error || !data) { toast({ title: "Não consegui abrir o ofício", variant: "destructive" }); return; }
    navigate("/oficios", { state: { editOficio: data } });
  };

  const mostrarPessoas = async () => {
    if (!isAdmin || !sel || sel.tipo !== "bairro") return;
    // só nome e bairro: nunca relato, saúde ou pedido de ajuda
    const { data, error } = await supabase.from("contacts").select("id, nome, bairro").ilike("bairro", `%${sel.ref}%`).is("arquivado_em", null).limit(MAX_PESSOAS);
    if (error) { toast({ title: "Erro ao buscar pessoas", variant: "destructive" }); return; }
    setPessoas((data || []) as PessoaMapa[]);
    setFiltros(f => ({ ...f, tipos: new Set(f.tipos).add("pessoa") }));
    setExpansao(e => ({ ...e, pessoasBairro: sel.id }));
    if (!data?.length) toast({ title: "Nenhuma pessoa cadastrada nesse bairro" });
  };

  const alternarTipo = (t: TipoNo, on: boolean) => setFiltros(f => { const s = new Set(f.tipos); on ? s.add(t) : s.delete(t); return { ...f, tipos: s }; });
  const cores = COR_TIPO[escuro ? "escuro" : "claro"];
  const orgaoSel = sel?.tipo === "orgao" ? base?.orgaos.find(o => o.id === sel.ref) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <form className="flex gap-2 flex-1 min-w-[220px]" onSubmit={e => { e.preventDefault(); fazerBusca(); }}>
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar: DMAE, Araguari, saúde..." aria-label="Buscar no mapa" className="bg-card border-border" />
          <Button type="submit" variant="outline" size="icon" aria-label="Buscar"><Search size={16} /></Button>
        </form>
        <Select value={filtros.cidadeId} onValueChange={v => setFiltros(f => ({ ...f, cidadeId: v }))}>
          <SelectTrigger className="w-[170px] bg-card border-border" aria-label="Cidade"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as cidades</SelectItem>
            {base?.cidades.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={v => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[160px] bg-card border-border" aria-label="Período dos ofícios"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(ROTULO_PERIODO) as Periodo[]).map(p => <SelectItem key={p} value={p}>{ROTULO_PERIODO[p]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filtros.situacao} onValueChange={v => setFiltros(f => ({ ...f, situacao: v as Filtros["situacao"] }))}>
          <SelectTrigger className="w-[170px] bg-card border-border" aria-label="Situação do órgão"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Órgãos: todos</SelectItem>
            <SelectItem value="ok">Órgãos: ok</SelectItem>
            <SelectItem value="conferir">Órgãos: conferir</SelectItem>
            <SelectItem value="sem_email">Órgãos: sem e-mail</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda e filtro por tipo">
        {TIPOS.filter(t => t !== "pessoa" || isAdmin).map(t => (
          <label key={t} className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox checked={filtros.tipos.has(t)} onCheckedChange={v => alternarTipo(t, !!v)} />
            <svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill={cores[t]} /></svg>
            <span className="text-foreground">{ROTULO_TIPO[t]}</span>
          </label>
        ))}
        <span>· borda tracejada = órgão "conferir" · pontilhada = sem e-mail · tamanho = nº de ofícios</span>
        <span className="ml-auto">
          {carregandoOficios ? <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> carregando ofícios…</span>
            : <>{contagem.nos} bolinhas · {contagem.linhas} linhas{tempoCarga !== null && ` · abriu em ${tempoCarga.toFixed(1)} s`}</>}
        </span>
      </div>

      {erro && <div role="alert" className="text-sm text-destructive flex items-center gap-2"><AlertTriangle size={14} /> {erro}</div>}

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="relative flex-1 rounded-lg border border-border bg-card overflow-hidden">
          {!base && <div className="absolute inset-0 p-6 space-y-3"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-full w-full" /></div>}
          <div ref={caixaRef} className="absolute inset-0" aria-label="Mapa de cidades, órgãos e ofícios. Clique numa cidade para abrir os órgãos." role="application" />
          {base && !sel && <p className="absolute bottom-2 left-3 text-xs text-muted-foreground pointer-events-none">Clique numa cidade para abrir os órgãos; num órgão para abrir os ofícios.</p>}
        </div>

        {sel && (
          <aside className="w-80 shrink-0 rounded-lg border border-border bg-card p-4 overflow-y-auto text-sm space-y-3 animate-in fade-in slide-in-from-right-2 duration-200" aria-label="Detalhes">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{ROTULO_TIPO[sel.tipo]}</p>
                <h2 className="font-semibold text-foreground break-words">{sel.label}</h2>
              </div>
              <Button variant="ghost" size="icon" aria-label="Fechar detalhes" onClick={() => { cyRef.current?.elements().unselect().removeClass("destaque apagado"); setSel(null); }}><X size={16} /></Button>
            </div>

            {typeof sel.qtd === "number" && ["cidade", "orgao", "bairro"].includes(sel.tipo) && <p>Ofícios no período: <strong>{sel.qtd as number}</strong></p>}

            {orgaoSel && (
              <div className="space-y-1">
                <p>Esfera: {orgaoSel.esfera}</p>
                <p>E-mail: <strong>{orgaoSel.email || "—"}</strong></p>
                <p>Telefone: <strong>{orgaoSel.telefone || "—"}</strong></p>
                {orgaoSel.endereco && <p>Endereço: {orgaoSel.endereco}</p>}
                {(orgaoSel.situacao !== "ok" || !orgaoSel.email) && (
                  <p className="flex items-center gap-1 text-foreground"><AlertTriangle size={14} /> Situação: {!orgaoSel.email ? "sem e-mail" : orgaoSel.situacao}</p>
                )}
                {orgaoSel.fonte?.startsWith("http") && <a href={orgaoSel.fonte} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1">Fonte <ExternalLink size={12} /></a>}
              </div>
            )}

            {sel.tipo === "oficio" && (
              <div className="space-y-2">
                <p>{String(sel.assunto || "")}</p>
                <p className="text-xs text-muted-foreground">{new Date(String(sel.data)).toLocaleDateString("pt-BR")}</p>
                <Button size="sm" onClick={() => abrirOficio(sel.ref)}><ExternalLink size={14} className="mr-1" /> Abrir ofício</Button>
              </div>
            )}

            {sel.tipo === "nota" && <p className="whitespace-pre-wrap">{String(sel.texto || "")}<br /><span className="text-xs text-muted-foreground">Situação: {String(sel.situacao)}</span></p>}

            {sel.tipo === "bairro" && (
              <div className="space-y-2">
                <p>Base de conhecimento: <strong>{extrasSel.conhecimento ?? "…"}</strong></p>
                <p>Pessoas cadastradas: <strong>{extrasSel.pessoas ?? "…"}</strong></p>
                {isAdmin && <Button size="sm" variant="outline" onClick={mostrarPessoas}><Users size={14} className="mr-1" /> Mostrar pessoas (até {MAX_PESSOAS})</Button>}
              </div>
            )}

            {sel.tipo === "assunto" && (
              <div className="space-y-2">
                <p>Base de conhecimento: <strong>{extrasSel.conhecimento ?? "…"}</strong></p>
                <p>Scripts: <strong>{extrasSel.scripts ?? "…"}</strong></p>
                <Button size="sm" variant="outline" onClick={() => navigate("/banco-informacoes")}><ExternalLink size={14} className="mr-1" /> Abrir Banco de Info</Button>
              </div>
            )}

            {vizinhos.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Liga em ({vizinhos.length})</p>
                <ul className="space-y-0.5 max-h-60 overflow-y-auto">
                  {vizinhos.slice(0, 60).map(v => (
                    <li key={v.id}>
                      <button className="text-left hover:underline text-foreground" onClick={() => selecionar(v.id)}>
                        <span className="text-muted-foreground">{ROTULO_TIPO[v.tipo]}:</span> {v.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
