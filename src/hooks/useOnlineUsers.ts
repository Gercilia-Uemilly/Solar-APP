import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnlineUser {
  user_id: string;
  nome: string;
  online_at: string;
}

/**
 * Tracks which users are currently online using Supabase Presence.
 */
export function useOnlineUsers() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineUser>();
        const users = Object.values(state)
          .flat()
          .filter((u) => u.user_id !== undefined);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            nome:
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              "Operador",
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return onlineUsers;
}
