import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

// Global unhandled error catchers — prevent silent crashes
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Solar] Unhandled promise rejection:", event.reason);
  // Prevent default browser error logging for known non-critical rejections
  if (event.reason?.message?.includes?.("ResizeObserver")) {
    event.preventDefault();
  }
});

window.addEventListener("error", (event) => {
  console.error("[Solar] Unhandled error:", event.error || event.message);
});

createRoot(document.getElementById("root")!).render(<App />);
