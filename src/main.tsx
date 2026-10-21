import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initObservability, reportError } from "./lib/observability";
import { isChunkLoadError, recoverFromStaleBuild } from "./lib/chunkRecovery";

initObservability();

// Clear old service worker API caches to prevent stale data
if ("caches" in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      if (name.includes("api-cache")) {
        caches.delete(name);
        console.log("[Solar] Cleared stale API cache:", name);
      }
    }
  });
}

// Versão antiga em cache após publicação: recarrega uma vez com arquivos novos
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromStaleBuild();
});

// Global unhandled error catchers — prevent silent crashes
window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) { void recoverFromStaleBuild(); return; }
  console.error("[Solar] Unhandled promise rejection:", event.reason);
  reportError(event.reason, { origem: "unhandledrejection" });
  // Prevent default browser error logging for known non-critical rejections
  if (event.reason?.message?.includes?.("ResizeObserver")) {
    event.preventDefault();
  }
});

window.addEventListener("error", (event) => {
  console.error("[Solar] Unhandled error:", event.error || event.message);
  reportError(event.error ?? event.message, { origem: "window.error" });
});

createRoot(document.getElementById("root")!).render(<App />);
