import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { buildFileName } from "@/lib/exportOficio";

describe("nome do arquivo de ofício vindo do Agente JR", () => {
  it("usa os 4 últimos dígitos do telefone, sem o nome da pessoa", () => {
    expect(buildFileName("Ofício GVF n° 2292/2026", "Carol (mãe do aluno Miguel)", undefined, "553496980873", "whatsapp_bot")).toBe("2292-2026 0873");
  });
  it("sem telefone, mantém o nome como antes", () => {
    expect(buildFileName("Ofício GVF n° 2292/2026", "Carol", undefined, "", "whatsapp_bot")).toBe("2292-2026 Carol");
  });
  it("outras origens continuam com o nome", () => {
    expect(buildFileName("Ofício GVF n° 2292/2026", "Carol", undefined, "553496980873", "WhatsApp Gabinete")).toBe("2292-2026 Carol");
  });
});
