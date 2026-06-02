import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OficioRow } from "@/lib/oficioUtils";

/**
 * Shared hook for fetching oficios with Supabase Realtime sync.
 * All pages using oficios get automatic live updates across devices/users.
 */
export function useOficios() {
  const [oficios, setOficios] = useState<OficioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);
  const lastFetchRef = useRef<number>(0);

  const fetchOficios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("oficios")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error && data && isMounted.current) {
      setOficios(data as OficioRow[]);
    }
    if (isMounted.current) setLoading(false);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchOficios();

    // Realtime subscription
    const channel = supabase
      .channel("oficios-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oficios" },
        (payload) => {
          if (!isMounted.current) return;

          const { eventType, new: newRow, old: oldRow } = payload;

          setOficios((prev) => {
            if (eventType === "INSERT") {
              const row = newRow as OficioRow;
              if (row.deleted_at) return prev;
              // Avoid duplicates
              if (prev.some((o) => o.id === row.id)) return prev;
              return [row, ...prev];
            }

            if (eventType === "UPDATE") {
              const row = newRow as OficioRow;
              // If soft-deleted, remove from list
              if (row.deleted_at) {
                return prev.filter((o) => o.id !== row.id);
              }
              // Update in place
              const exists = prev.some((o) => o.id === row.id);
              if (exists) {
                return prev.map((o) => (o.id === row.id ? row : o));
              }
              // Was un-deleted — add back
              return [row, ...prev];
            }

            if (eventType === "DELETE") {
              const id = (oldRow as any)?.id;
              if (id) return prev.filter((o) => o.id !== id);
            }

            return prev;
          });
        }
      )
      .subscribe();

    // Refetch on window focus (throttled — realtime already keeps us in sync,
    // and the full list is ~1MB so refetching on every focus is expensive)
    const handleFocus = () => {
      if (!isMounted.current) return;
      const now = Date.now();
      if (now - lastFetchRef.current < 30000) return;
      lastFetchRef.current = now;
      fetchOficios();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      isMounted.current = false;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchOficios]);

  /** Optimistic update: immediately apply a change locally */
  const optimisticUpdate = useCallback(
    (id: string, fields: Partial<OficioRow>) => {
      setOficios((prev) =>
        prev.map((o) => (o.id === id ? { ...o, ...fields } : o))
      );
    },
    []
  );

  /** Optimistic add: immediately show a new oficio */
  const optimisticAdd = useCallback((oficio: OficioRow) => {
    setOficios((prev) => {
      if (prev.some((o) => o.id === oficio.id)) return prev;
      return [oficio, ...prev];
    });
  }, []);

  /** Optimistic remove */
  const optimisticRemove = useCallback((id: string) => {
    setOficios((prev) => prev.filter((o) => o.id !== id));
  }, []);

  return {
    oficios,
    setOficios,
    loading,
    fetchOficios,
    optimisticUpdate,
    optimisticAdd,
    optimisticRemove,
  };
}
