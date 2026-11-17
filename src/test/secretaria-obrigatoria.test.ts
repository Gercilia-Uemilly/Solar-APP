import { describe, it, expect } from "vitest";
import { faltaSecretaria } from "@/lib/secretariaObrigatoria";

describe("secretaria obrigatória", () => {
  it("bloqueia em Uberlândia quando a secretaria está vazia", () => {
    expect(faltaSecretaria(false, "")).toBe(true);
    expect(faltaSecretaria(false, "   ")).toBe(true);
    expect(faltaSecretaria(false, null)).toBe(true);
  });
  it("libera em Uberlândia quando a secretaria foi escolhida", () => {
    expect(faltaSecretaria(false, "Trânsito e Transportes")).toBe(false);
  });
  it("não exige em outras cidades", () => {
    expect(faltaSecretaria(true, "")).toBe(false);
  });
});
