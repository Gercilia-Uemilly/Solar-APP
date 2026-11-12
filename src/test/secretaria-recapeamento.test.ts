import { describe, it, expect } from "vitest";
import { detectSecretaria } from "../../supabase/functions/_shared/detectSecretaria";

// Recapeamento asfáltico vai para a Infraestrutura, não para Serviços Urbanos.
describe("secretaria adivinhada pelas palavras da demanda", () => {
  it("recapeamento asfáltico vai para Infraestrutura", () => {
    expect(detectSecretaria("Solicito recapeamento asfáltico na Rua das Flores")).toBe("Infraestrutura");
  });
  it("recapeamento sem acento e com calçada e limpeza continua Infraestrutura", () => {
    expect(detectSecretaria("recapeamento asfaltico da avenida, limpeza e calçada quebrada")).toBe("Infraestrutura");
  });
  it("tapa-buraco continua com Serviços Urbanos", () => {
    expect(detectSecretaria("operação tapa-buraco na rua")).toBe("Serviços Urbanos");
  });
});
