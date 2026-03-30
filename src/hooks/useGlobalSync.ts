import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Global realtime sync hook.
 * Listens to changes on key shared tables and invalidates
 * React Query caches so all users see updates instantly.
 * Includes auto-refresh fallback and online/offline detection.
 */
export function useGlobalSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("solar-sync-global-v3")

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

      .subscribe();

    // Fallback: refresh every 30s
    const fallback = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["oficios"] });
      queryClient.invalidateQueries({ queryKey: ["numeracao"] });
    }, 30000);

    // Online/offline detection
    const handleOnline = () => {
      queryClient.invalidateQueries();
      toast.success("Conexão restaurada!");
    };
    const handleOffline = () => {
      toast.error("Sem conexão com a internet.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(fallback);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [queryClient]);
}
