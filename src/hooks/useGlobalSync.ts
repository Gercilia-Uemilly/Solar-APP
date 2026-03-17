import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Global realtime sync hook.
 * Listens to changes on key shared tables and invalidates
 * React Query caches so all users see updates instantly.
 */
export function useGlobalSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = [
      supabase
        .channel("global-profiles")
        .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
        })
        .subscribe(),

      supabase
        .channel("global-app-settings")
        .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => {
          queryClient.invalidateQueries({ queryKey: ["app_settings"] });
          queryClient.invalidateQueries({ queryKey: ["configuracoes"] });
        })
        .subscribe(),

      supabase
        .channel("global-user-roles")
        .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
          queryClient.invalidateQueries({ queryKey: ["user_roles"] });
          queryClient.invalidateQueries({ queryKey: ["profiles"] });
        })
        .subscribe(),
    ];

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient]);
}
