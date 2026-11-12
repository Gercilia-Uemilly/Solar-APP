import { describe, it, expect } from "vitest";
import { todasAsLinhas } from "@/lib/todasAsLinhas";

describe("todasAsLinhas", () => {
  it("traz os 1602 registros mesmo com limite de 1000 por consulta", async () => {
    const banco = Array.from({ length: 1602 }, (_, i) => ({ n: i }));
    const linhas = await todasAsLinhas<{ n: number }>(async (de, ate) => ({
      data: banco.slice(de, Math.min(ate + 1, de + 1000)),
      error: null,
    }));
    expect(linhas).toHaveLength(1602);
    expect(linhas[1006].n).toBe(1006);
  });
});
