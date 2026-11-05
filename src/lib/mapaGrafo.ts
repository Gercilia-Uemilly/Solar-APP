/**
 * Cérebro F3 — monta as bolinhas (nós) e linhas (arestas) do Mapa a partir dos dados do banco.
 * Só lê. Tudo puro (sem React/Supabase) para poder testar.
 */
import type { ElementDefinition } from "cytoscape";
import { extrairBairro, resolverChaveSecretaria } from "@/lib/oficioUtils";

export type TipoNo = "cidade" | "orgao" | "oficio" | "bairro" | "assunto" | "nota" | "pessoa";
export const TIPOS: TipoNo[] = ["cidade", "orgao", "oficio", "bairro", "assunto", "nota", "pessoa"];

export const ROTULO_TIPO: Record<TipoNo, string> = {
  cidade: "Cidade", orgao: "Órgão / secretaria", oficio: "Ofício", bairro: "Bairro",
  assunto: "Assunto", nota: "Fato / nota", pessoa: "Pessoa",
};

/** Paleta categórica validada (dataviz, 7 slots, claro/escuro); a forma da bolinha também muda por tipo */
export const COR_TIPO: Record<"claro" | "escuro", Record<TipoNo, string>> = {
  claro: { cidade: "#2a78d6", orgao: "#eb6834", oficio: "#1baf7a", bairro: "#eda100", assunto: "#e87ba4", nota: "#008300", pessoa: "#6250d6" },
  escuro: { cidade: "#3987e5", orgao: "#d95926", oficio: "#199e70", bairro: "#c98500", assunto: "#d55181", nota: "#008300", pessoa: "#9085e9" },
};
export const FORMA_TIPO: Record<TipoNo, string> = {
  cidade: "ellipse", orgao: "round-rectangle", oficio: "diamond", bairro: "hexagon", assunto: "tag", nota: "star", pessoa: "triangle",
};

export const ROTULO_ASSUNTO: Record<string, string> = {
  geral: "Geral", tributos: "Tributos", rural: "Rural", comunicacao: "Comunicação", juridico: "Jurídico", emprego: "Emprego",
  assistencia_social: "Assistência social", educacao: "Educação", meio_ambiente: "Meio ambiente", transito: "Trânsito",
  planejamento: "Planejamento", saude: "Saúde", seguranca: "Segurança", infraestrutura: "Infraestrutura",
  agua_esgoto: "Água e esgoto", ouvidoria: "Ouvidoria", esporte_cultura: "Esporte e cultura", moradia: "Moradia", parlamentar: "Parlamentar",
};

export interface Cidade { id: string; nome: string }
export interface Orgao {
  id: string; cidade_id: string | null; nome: string; sigla: string | null; esfera: string; assuntos: string[] | null;
  situacao: string; email: string | null; telefone: string | null; endereco: string | null; fonte: string | null;
}
export interface OficioMapa {
  id: string; numero: string | null; assunto: string | null; bairro: string | null; cidade: string | null;
  orgao_destino_id: string | null; secretaria_identificada: string | null; created_at: string; status: string | null;
}
export interface Fato { chave: string; fato: string; situacao: string }
export interface PessoaMapa { id: string; nome: string | null; bairro: string | null }

export interface Filtros {
  cidadeId: string | "todas";
  tipos: Set<TipoNo>;
  situacao: "todas" | "ok" | "conferir" | "sem_email";
}
export interface Expansao { cidades: Set<string>; orgaos: Set<string>; pessoasBairro: string | null }

export const MAX_OFICIOS_POR_ORGAO = 40;
export const MAX_PESSOAS = 200;

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Nome do bairro a partir do campo bairro do ofício (que às vezes guarda o endereço inteiro) */
export function bairroDoOficio(campo: string | null): string {
  const s = (campo || "").trim();
  if (!s) return "";
  const b = extrairBairro(s);
  if (b) return b;
  return s.length <= 40 && !/\d|,/.test(s) ? s : "";
}

export const idBairro = (cidadeId: string, nome: string) => `bairro:${cidadeId}:${slug(nome)}`;

const tamanho = (n: number) => Math.min(80, 22 + 6 * Math.sqrt(n));

/** Liga cada ofício a um órgão: orgao_destino_id; senão (ofícios antigos de Uberlândia) pelo nome da secretaria */
export function indexarOficios(oficios: OficioMapa[], cidades: Cidade[], orgaos: Orgao[]) {
  const cidadePorNome = new Map(cidades.map(c => [c.nome, c.id]));
  const orgaoPorNome = new Map(orgaos.filter(o => o.cidade_id).map(o => [`${o.cidade_id}|${o.nome}`, o.id]));
  const porOrgao = new Map<string, OficioMapa[]>();
  const porCidade = new Map<string, number>();
  const porBairro = new Map<string, number>();
  for (const o of oficios) {
    const cidadeId = cidadePorNome.get(o.cidade || "Uberlândia");
    if (!cidadeId) continue;
    porCidade.set(cidadeId, (porCidade.get(cidadeId) || 0) + 1);
    const b = bairroDoOficio(o.bairro);
    if (b) porBairro.set(idBairro(cidadeId, b), (porBairro.get(idBairro(cidadeId, b)) || 0) + 1);
    const sec = o.secretaria_identificada || "";
    const orgaoId = o.orgao_destino_id
      || orgaoPorNome.get(`${cidadeId}|${sec}`)
      || orgaoPorNome.get(`${cidadeId}|${resolverChaveSecretaria(sec)}`);
    if (!orgaoId) continue;
    const lista = porOrgao.get(orgaoId) || [];
    lista.push(o);
    porOrgao.set(orgaoId, lista);
  }
  for (const l of porOrgao.values()) l.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { porOrgao, porCidade, porBairro };
}

const passaSituacao = (o: Orgao, f: Filtros["situacao"]) =>
  f === "todas" ? true
    : f === "sem_email" ? (!o.email || o.situacao === "sem_email" || o.situacao === "email_com_erro")
    : o.situacao === f;

export interface DadosMapa { cidades: Cidade[]; orgaos: Orgao[]; oficios: OficioMapa[]; fatos: Fato[]; pessoas: PessoaMapa[] }

export function montarElementos(d: DadosMapa, f: Filtros, e: Expansao): ElementDefinition[] {
  const nos = new Map<string, ElementDefinition>();
  const arestas = new Map<string, ElementDefinition>();
  const no = (id: string, tipo: TipoNo, label: string, extra: Record<string, unknown> = {}, n = 0) => {
    if (!f.tipos.has(tipo) || nos.has(id)) return;
    nos.set(id, { group: "nodes", data: { id, tipo, label, tam: tamanho(n), qtd: n, ...extra } });
  };
  const liga = (a: string, b: string, tipo = "") => {
    const id = `${a}->${b}`;
    if (!arestas.has(id)) arestas.set(id, { group: "edges", data: { id, source: a, target: b, tipo } });
  };

  const { porOrgao, porCidade, porBairro } = indexarOficios(d.oficios, d.cidades, d.orgaos);
  const cidades = d.cidades.filter(c => f.cidadeId === "todas" || c.id === f.cidadeId);

  for (const c of cidades) {
    const idC = `cidade:${c.id}`;
    no(idC, "cidade", c.nome, { ref: c.id }, porCidade.get(c.id) || 0);
    const orgaosC = d.orgaos.filter(o => o.cidade_id === c.id);
    for (const a of new Set(orgaosC.flatMap(o => o.assuntos || []))) {
      no(`assunto:${a}`, "assunto", ROTULO_ASSUNTO[a] || a, { ref: a });
      liga(idC, `assunto:${a}`);
    }
    if (!e.cidades.has(c.id) && f.cidadeId !== c.id) continue; // cidade filtrada já abre os órgãos

    for (const o of orgaosC.filter(o => passaSituacao(o, f.situacao))) {
      const idO = `orgao:${o.id}`;
      const ofs = porOrgao.get(o.id) || [];
      no(idO, "orgao", (o.sigla && !o.nome.includes(o.sigla) ? `${o.nome} (${o.sigla})` : o.nome) + (ofs.length ? ` · ${ofs.length}` : ""), { ref: o.id, situacao: o.situacao, semEmail: !o.email }, ofs.length);
      liga(idC, idO);
      for (const a of o.assuntos || []) liga(idO, `assunto:${a}`);
      if (!e.orgaos.has(o.id)) continue;

      for (const of of ofs.slice(0, MAX_OFICIOS_POR_ORGAO)) {
        const idOf = `oficio:${of.id}`;
        no(idOf, "oficio", (of.numero || "rascunho").replace(/^Of[ií]cio GVF n[°º]\s*/i, ""), { ref: of.id, assunto: of.assunto, data: of.created_at });
        liga(idO, idOf);
        const b = bairroDoOficio(of.bairro);
        if (!b) continue;
        const idB = idBairro(c.id, b);
        no(idB, "bairro", b, { ref: b, cidadeId: c.id }, porBairro.get(idB) || 0);
        liga(idOf, idB);
      }
      if (ofs.length > MAX_OFICIOS_POR_ORGAO) {
        nos.get(idO)!.data.label += ` (+${ofs.length - MAX_OFICIOS_POR_ORGAO} ofícios não mostrados)`;
      }
    }
  }

  const udi = cidades.find(c => c.nome === "Uberlândia");
  if (udi) for (const ft of d.fatos) {
    no(`nota:${ft.chave}`, "nota", ft.chave.replace(/_/g, " "), { ref: ft.chave, situacao: ft.situacao, texto: ft.fato });
    liga(`cidade:${udi.id}`, `nota:${ft.chave}`);
  }

  if (e.pessoasBairro && nos.has(e.pessoasBairro)) {
    for (const p of d.pessoas.slice(0, MAX_PESSOAS)) {
      no(`pessoa:${p.id}`, "pessoa", (p.nome || "sem nome").split(/\s+/)[0], { ref: p.id });
      liga(e.pessoasBairro, `pessoa:${p.id}`);
    }
  }

  // aresta só fica se as duas pontas estão visíveis (filtro de tipo)
  const lista = [...arestas.values()].filter(a => nos.has(a.data.source as string) && nos.has(a.data.target as string));
  return [...nos.values(), ...lista];
}

/** Busca: acha cidade/órgão/assunto/bairro/ofício pelo texto e diz o que precisa expandir para ele aparecer */
export function buscar(d: DadosMapa, texto: string): { id: string; expandirCidade?: string; expandirOrgao?: string } | null {
  const q = slug(texto);
  if (!q) return null;
  const casa = (s: string | null | undefined) => !!s && slug(s).includes(q);
  const c = d.cidades.find(x => slug(x.nome) === q) || d.cidades.find(x => casa(x.nome));
  if (c) return { id: `cidade:${c.id}` };
  const o = d.orgaos.find(x => slug(x.sigla || "") === q) || d.orgaos.find(x => casa(x.sigla) || casa(x.nome));
  if (o) return { id: `orgao:${o.id}`, expandirCidade: o.cidade_id || undefined };
  const a = Object.entries(ROTULO_ASSUNTO).find(([k, v]) => slug(k).includes(q) || casa(v));
  if (a) return { id: `assunto:${a[0]}` };
  return null;
}
