import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Global realtime sync hook.
 * Listens to changes on key shared tables and invalidates
 * React Query caches so all users see updates instantly.
 * Includes auto-refresh fallback, online/offline detection,
 * and visibility/focus listeners.
 */
export function useGlobalSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("solar-sync-global-v4-" + Date.now())

      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
        queryClient.invalidateQueries({ queryKey: ["operadores"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
        queryClient.invalidateQueries({ queryKey: ["app_settings"] });
        queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        queryClient.invalidateQueries({ queryKey: ["user_roles"] });
        queryClient.invalidateQueries({ queryKey: ["profiles"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "oficios" }, () => {
        queryClient.invalidateQueries({ queryKey: ["oficios"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "oficio_numeracao" }, () => {
        queryClient.invalidateQueries({ queryKey: ["numeracao"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens" }, () => {
        queryClient.invalidateQueries({ queryKey: ["mensagens"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "scripts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["scripts"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "base_conhecimento" }, () => {
        queryClient.invalidateQueries({ queryKey: ["base_conhecimento"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "notificacoes" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      })

      .on("postgres_changes", { event: "*", schema: "public", table: "oficio_respostas" }, () => {
        queryClient.invalidateQueries({ queryKey: ["respostas"] });
        queryClient.invalidateQueries({ queryKey: ["oficios"] });
      })

      .subscribe((status) => {
        console.log("[Solar] Realtime sync:", status);
      });

    // Throttle global invalidations to avoid massive refetch storms
    // (each oficios list = ~1MB; refetching on every focus kills perf)
    let lastInvalidate = Date.now();
    const throttledInvalidate = () => {
      const now = Date.now();
      if (now - lastInvalidate < 30000) return; // no more than once per 30s
      lastInvalidate = now;
      queryClient.invalidateQueries();
    };

    // Online/offline detection
    const handleOnline = () => {
      lastInvalidate = 0;
      throttledInvalidate();
      toast.success("Conexão restaurada!");
    };
    const handleOffline = () => {
      toast.error("Sem conexão com a internet.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Focus and visibility — throttled refresh when user returns
    const handleFocus = () => throttledInvalidate();
    const handleVisibility = () => {
      if (!document.hidden) throttledInvalidate();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [queryClient]);
}
