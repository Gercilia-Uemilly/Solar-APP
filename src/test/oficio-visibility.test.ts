import { describe, expect, it } from "vitest";
import { canEditOficioContent } from "@/lib/oficioPermissions";

describe("visualização de ofícios", () => {
  it("mantém o ofício de outro operador somente para leitura", () => {
    expect(canEditOficioContent("operador-1", false, "operador-2")).toBe(false);
  });

  it("permite edição ao autor e ao administrador", () => {
    expect(canEditOficioContent("operador-1", false, "operador-1")).toBe(true);
    expect(canEditOficioContent("admin-1", true, "operador-2")).toBe(true);
  });
});