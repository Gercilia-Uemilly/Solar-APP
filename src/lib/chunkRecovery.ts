// Recupera o app quando o navegador ainda tem uma versão antiga do Solar
// (arquivos removidos após uma publicação nova -> "Failed to fetch dynamically imported module").
const KEY = "solar:chunk-reload-at";
const WINDOW_MS = 60_000;

export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .* failed|ChunkLoadError|Unable to preload CSS|reading .default./i.test(msg);
}

export function shouldReload(now: number, lastAt: number | null): boolean {
  return lastAt === null || now - lastAt > WINDOW_MS;
}

export async function recoverFromStaleBuild(): Promise<boolean> {
  let last: number | null = null;
  try { const v = sessionStorage.getItem(KEY); last = v ? Number(v) : null; } catch { /* storage bloqueado */ }
  const now = Date.now();
  if (!shouldReload(now, last)) return false;
  try { sessionStorage.setItem(KEY, String(now)); } catch { /* ignore */ }
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.update().catch(() => undefined)));
    }
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch { /* segue para o reload */ }
  window.location.reload();
  return true;
}
