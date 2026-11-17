import { describe, it, expect } from "vitest";
import { isFinalizado, separarPorAba } from "@/lib/oficioTabs";

describe("abas de ofícios", () => {
  it("ofício cancelado vai para a aba Finalizados", () => {
    expect(isFinalizado("Cancelado")).toBe(true);
  });

  it("status finalizados conhecidos vão para Finalizados", () => {
    for (const s of ["Protocolado", "Respondido", "Atendido", "Impresso"]) {
      expect(isFinalizado(s)).toBe(true);
    }
  });

  it("rascunho e salvo continuam na aba Rascunhos", () => {
    expect(isFinalizado("Rascunho")).toBe(false);
    expect(isFinalizado("Salvo")).toBe(false);
    expect(isFinalizado("Exportado")).toBe(false);
  });

  it("separarPorAba coloca cancelado em finalizados e rascunho em rascunhos", () => {
    const lista = [
      { id: 1, status: "Cancelado" },
      { id: 2, status: "Rascunho" },
      { id: 3, status: "Respondido" },
    ];
    const { finalizados, rascunhos } = separarPorAba(lista);
    expect(finalizados.map((o) => o.id)).toEqual([1, 3]);
    expect(rascunhos.map((o) => o.id)).toEqual([2]);
  });
});
