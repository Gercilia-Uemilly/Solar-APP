import { describe, it, expect } from "vitest";
import { montarElementos, buscar, bairroDoOficio, TIPOS, MAX_OFICIOS_POR_ORGAO, type DadosMapa, type Filtros, type Expansao } from "@/lib/mapaGrafo";

const dados: DadosMapa = {
  cidades: [{ id: "udi", nome: "Uberlândia" }, { id: "ara", nome: "Araguari" }],
  orgaos: [
    { id: "dmae", cidade_id: "udi", nome: "DMAE", sigla: "DMAE", esfera: "municipal", assuntos: ["agua_esgoto"], situacao: "sem_email", email: null, telefone: null, endereco: null, fonte: null },
    { id: "su", cidade_id: "udi", nome: "Serviços Urbanos", sigla: null, esfera: "municipal", assuntos: ["infraestrutura"], situacao: "sem_email", email: null, telefone: null, endereco: null, fonte: null },
    { id: "saude-ara", cidade_id: "ara", nome: "Secretaria Municipal de Saúde", sigla: null, esfera: "municipal", assuntos: ["saude"], situacao: "conferir", email: "s@a.gov.br", telefone: null, endereco: null, fonte: null },
  ],
  oficios: [
    // antigo de Uberlândia: sem orgao_destino_id, liga pela secretaria
    { id: "o1", numero: "Ofício GVF n° 10/2026", assunto: "Buraco", bairro: "Rua X, 10 - Luizote de Freitas, Uberlândia", cidade: "Uberlândia", orgao_destino_id: null, secretaria_identificada: "Serviços Urbanos", created_at: "2026-10-01", status: "Protocolado" },
    { id: "o2", numero: "Ofício GVF n° 11/2026", assunto: "Vazamento", bairro: "Luizote de Freitas", cidade: "Uberlândia", orgao_destino_id: null, secretaria_identificada: "Departamento Municipal de Água e Esgoto", created_at: "2026-10-02", status: "Protocolado" },
    { id: "o3", numero: "Ofício GVF n° 12/2026", assunto: "Médico", bairro: "Centro", cidade: "Araguari", orgao_destino_id: "saude-ara", secretaria_identificada: "Secretaria Municipal de Saúde", created_at: "2026-10-03", status: "Rascunho" },
  ],
  fatos: [{ chave: "eleito_deputado_2026", fato: "...", situacao: "ok" }],
  pessoas: [],
};
const filtros = (p: Partial<Filtros> = {}): Filtros => ({ cidadeId: "todas", tipos: new Set(TIPOS), situacao: "todas", ...p });
const exp = (p: Partial<Expansao> = {}): Expansao => ({ cidades: new Set(), orgaos: new Set(), pessoasBairro: null, ...p });
const ids = (els: ReturnType<typeof montarElementos>) => els.filter(e => e.group === "nodes").map(e => e.data.id);

describe("mapa", () => {
  it("começa só com cidades, assuntos e fatos (sem órgãos nem ofícios)", () => {
    const n = ids(montarElementos(dados, filtros(), exp()));
    expect(n).toContain("cidade:udi");
    expect(n).toContain("assunto:saude");
    expect(n).toContain("nota:eleito_deputado_2026");
    expect(n.some(i => i.startsWith("orgao:") || i.startsWith("oficio:"))).toBe(false);
  });

  it("abrir cidade mostra os órgãos com a contagem de ofícios (ofício antigo liga pelo nome da secretaria)", () => {
    const els = montarElementos(dados, filtros(), exp({ cidades: new Set(["udi"]) }));
    const su = els.find(e => e.data.id === "orgao:su")!;
    const dmae = els.find(e => e.data.id === "orgao:dmae")!;
    expect(su.data.qtd).toBe(1);
    expect(dmae.data.qtd).toBe(1);
    expect(ids(els).some(i => i.startsWith("orgao:saude-ara"))).toBe(false);
  });

  it("abrir órgão mostra ofícios ligados ao bairro", () => {
    const els = montarElementos(dados, filtros(), exp({ cidades: new Set(["udi"]), orgaos: new Set(["su", "dmae"]) }));
    const bairro = els.find(e => e.data.id === "bairro:udi:luizote-de-freitas")!;
    expect(bairro.data.qtd).toBe(2);
    expect(els.some(e => e.group === "edges" && e.data.source === "oficio:o1" && e.data.target === "bairro:udi:luizote-de-freitas")).toBe(true);
  });

  it("filtro de situação e de tipo", () => {
    const so = ids(montarElementos(dados, filtros({ situacao: "conferir" }), exp({ cidades: new Set(["udi", "ara"]) })));
    expect(so).toContain("orgao:saude-ara");
    expect(so).not.toContain("orgao:dmae");
    const semAssunto = montarElementos(dados, filtros({ tipos: new Set(["cidade"]) }), exp());
    expect(semAssunto.every(e => e.group === "nodes" ? e.data.tipo === "cidade" : true)).toBe(true);
    expect(semAssunto.some(e => e.group === "edges")).toBe(false);
  });

  it("órgão com muitos ofícios mostra no máximo o limite", () => {
    const muitos = Array.from({ length: MAX_OFICIOS_POR_ORGAO + 5 }, (_, i) => ({ ...dados.oficios[0], id: `x${i}` }));
    const els = montarElementos({ ...dados, oficios: muitos }, filtros(), exp({ cidades: new Set(["udi"]), orgaos: new Set(["su"]) }));
    expect(els.filter(e => e.group === "nodes" && e.data.tipo === "oficio").length).toBe(MAX_OFICIOS_POR_ORGAO);
    expect(String(els.find(e => e.data.id === "orgao:su")!.data.label)).toContain("+5");
  });

  it("busca DMAE e Araguari", () => {
    expect(buscar(dados, "DMAE")).toEqual({ id: "orgao:dmae", expandirCidade: "udi" });
    expect(buscar(dados, "araguari")).toEqual({ id: "cidade:ara" });
    expect(buscar(dados, "zzz")).toBeNull();
  });

  it("bairro do ofício", () => {
    expect(bairroDoOficio("Rua X, 10 - Luizote de Freitas, Uberlândia")).toBe("Luizote de Freitas");
    expect(bairroDoOficio("Centro")).toBe("Centro");
    expect(bairroDoOficio("Rua sem bairro 123")).toBe("");
  });
});
