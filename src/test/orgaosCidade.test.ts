import { describe, it, expect } from "vitest";
import { avisosOrgao, destinatarioOrgao, encerramentoOrgao, trocarEncerramento, categoriaDaSecretaria, type OrgaoCidade } from "@/hooks/useOrgaosCidade";
import { gerarEncerramentoDinamico } from "@/lib/oficioUtils";

const orgao = (p: Partial<OrgaoCidade>): OrgaoCidade => ({
  id: "1", nome: "Secretaria Municipal de Saúde", sigla: null, esfera: "municipal", email: "saude@araguari.mg.gov.br",
  telefone: "(34) 3690-3000", situacao: "ok", destinatario: "Ilmo(a). Sr(a). Secretário(a) Municipal de Saúde de Araguari",
  vocativo: "Excelentíssimo(a) Senhor(a) Secretário(a),", tratamento_situacao: "conferir", ...p,
});

describe("ofício por cidade", () => {
  it("encerramento leva o órgão e a cidade", () => {
    expect(encerramentoOrgao(orgao({}), "Araguari")).toContain("apreciação da Secretaria Municipal de Saúde de Araguari,");
    expect(encerramentoOrgao(orgao({ nome: "SAE (água e esgoto)" }), "Araguari")).toContain("apreciação do SAE de Araguari,");
    expect(encerramentoOrgao(orgao({ nome: "Secretaria de Obras e Serviços Urbanos" }), "Ituiutaba")).toContain("da Secretaria de Obras e Serviços Urbanos de Ituiutaba,");
  });

  it("troca só o parágrafo de encaminhamento que a IA escreveu", () => {
    const ia = `<p>Este parlamentar...</p><p>${gerarEncerramentoDinamico("Saúde")}</p><p>Na certeza de contar com o vosso pronto atendimento, desde já agradeço.</p>`;
    const novo = trocarEncerramento(ia, orgao({}), "Araguari");
    expect(novo).toContain("apreciação da Secretaria Municipal de Saúde de Araguari,");
    expect(novo).toContain("<p>Este parlamentar...</p>");
    expect(novo).toContain("Na certeza de contar");
    expect(novo.match(/encaminha-se/g)).toHaveLength(1);
  });

  it("avisos amarelos", () => {
    expect(avisosOrgao(orgao({ tratamento_situacao: "ok" }))).toEqual([]);
    expect(avisosOrgao(orgao({ email: null, situacao: "sem_email" }))).toContain("sem e-mail");
    expect(avisosOrgao(orgao({ situacao: "conferir", tratamento_situacao: "ok" }))).toEqual(["dados do órgão para conferir"]);
  });

  it("destinatário cai no padrão quando o banco não tem", () => {
    expect(destinatarioOrgao(orgao({ destinatario: null, nome: "Ouvidoria-Geral do Município" }), "Araguari"))
      .toBe("Ilmo(a). Sr(a). Responsável pelo(a) Ouvidoria-Geral do Município – Araguari/MG");
  });

  it("assunto da IA vira categoria do roteamento", () => {
    expect(categoriaDaSecretaria("Saúde")).toBe("saude");
    expect(categoriaDaSecretaria("Serviços Urbanos")).toBe("infraestrutura");
    expect(categoriaDaSecretaria("ARESAN")).toBeNull();
  });
});
