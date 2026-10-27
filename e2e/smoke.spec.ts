import { expect, test } from "@playwright/test";

/**
 * Smoke e2e — não toca em autenticação real nem na integração n8n.
 * Apenas garante que a aplicação sobe e que rotas protegidas redirecionam.
 */
test("a aplicação carrega e redireciona visitante para o login", async ({ page }) => {
  await page.goto("/oficios");
  await page.waitForURL(/\/login/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
});

test("a página de login renderiza sem erros de console críticos", async ({ page }) => {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") erros.push(msg.text());
  });
  await page.goto("/login");
  await expect(page.locator("body")).toBeVisible();
  expect(erros.filter((e) => e.includes("Uncaught"))).toHaveLength(0);
});

test("respeita prefers-reduced-motion", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/login");
  const duracao = await page.evaluate(() => {
    const el = document.createElement("div");
    el.className = "animate-fade-in";
    document.body.appendChild(el);
    const d = getComputedStyle(el).animationDuration;
    el.remove();
    return d;
  });
  // O Chromium pode serializar 0.00001s como "1e-05s": compara o número, não o texto.
  expect(Number.parseFloat(duracao)).toBeLessThanOrEqual(0.00001);
  await context.close();
});