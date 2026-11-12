import { describe, it, expect } from "vitest";
import { resolverChaveSecretaria } from "../../supabase/functions/_shared/oficioUtils";

// O órgão do parágrafo final do ofício segue o destinatário enviado (ex.: ofício 1889).
describe("órgão do encerramento a partir do destinatário", () => {
  it("SETTRAN no destinatário vira Trânsito e Transportes", () => {
    expect(resolverChaveSecretaria("Ilmo(a). Sr(a). Secretário(a) Municipal de Trânsito e Transportes")).toBe("Trânsito e Transportes (SETTRAN)");
  });
  it("Saúde no destinatário vira Saúde", () => {
    expect(resolverChaveSecretaria("Ilmo(a). Sr(a). Secretário(a) Municipal de Saúde")).toBe("Saúde");
  });
  it("Educação no destinatário vira Educação", () => {
    expect(resolverChaveSecretaria("Ilmo(a). Sr(a). Secretário(a) Municipal de Educação")).toBe("Educação");
  });
  it("destinatário vazio não força nenhum órgão", () => {
    expect(resolverChaveSecretaria("")).toBe("");
  });
});
