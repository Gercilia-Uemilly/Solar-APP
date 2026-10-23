import { describe, it, expect } from "vitest";
import { isChunkLoadError, shouldReload } from "@/lib/chunkRecovery";

describe("recuperação de versão antiga", () => {
  it("reconhece erro de arquivo antigo do Chrome e Safari", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: https://x/assets/Index-l28jqwWl.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'default')"))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });
  it("recarrega no máximo uma vez por minuto", () => {
    expect(shouldReload(100_000, null)).toBe(true);
    expect(shouldReload(100_000, 70_000)).toBe(false);
    expect(shouldReload(200_000, 70_000)).toBe(true);
  });
});
