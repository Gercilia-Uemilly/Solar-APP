import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

function loadHandler(updateError: Error | null = null) {
  const updateUserById = vi.fn().mockResolvedValue({ error: updateError });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-id" } } }),
      admin: { updateUserById },
    },
    rpc: vi.fn().mockResolvedValue({ data: true }),
  };
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const source = readFileSync("supabase/functions/reset-user-password/index.ts", "utf8")
    .replace(/^import .*;\s*/m, "");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  runInNewContext(outputText, {
    createClient: () => client,
    Deno: {
      env: { get: () => "test-only" },
      serve: (callback: (request: Request) => Promise<Response>) => { handler = callback; },
    },
    Response,
  });
  if (!handler) throw new Error("Handler não registrado");
  return { handler, updateUserById };
}

describe("reset-user-password", () => {
  it("updates the requested user's password with the supported admin method", async () => {
    const { handler, updateUserById } = loadHandler();
    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "target-user-id", newPassword: "test-password" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(updateUserById).toHaveBeenCalledExactlyOnceWith("target-user-id", { password: "test-password" });
  });

  it("does not report success if the password update fails", async () => {
    const { handler } = loadHandler(new Error("Update rejected"));
    const response = await handler(new Request("https://example.test", {
      method: "POST",
      headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "target-user-id", newPassword: "test-password" }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Update rejected" });
  });
});