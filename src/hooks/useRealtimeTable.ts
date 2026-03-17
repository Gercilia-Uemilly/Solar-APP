import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeTableOptions<T> {
  table: string;
  /** Channel name (must be unique per subscription) */
  channel: string;
  /** Select columns, defaults to "*" */
  select?: string;
  /** Order by column */
  orderBy?: { column: string; ascending?: boolean };
  /** Filter: eq pairs applied to the query */
  filters?: Record<string, any>;
  /** Filter for null columns (is null) */
  isNull?: string[];
  /** Filter for not-null columns (is not null) */
  isNotNull?: string[];
  /** Transform/validate a row before adding to state */
  validate?: (row: T) => boolean;
  /** ID field name, defaults to "id" */
  idField?: keyof T;
  /** Max rows to fetch (default: no limit) */
  limit?: number;
  /** Disable realtime subscription for large tables */
  disableRealtime?: boolean;
}

/**
 * Generic realtime hook for any Supabase table.
 * Fetches data + subscribes to INSERT/UPDATE/DELETE events.
 */
export function useRealtimeTable<T extends Record<string, any>>(
  options: UseRealtimeTableOptions<T>
) {
  const {
    table,
    channel,
    select = "*",
    orderBy,
    filters,
    isNull,
    isNotNull,
    validate,
    idField = "id" as keyof T,
    limit,
    disableRealtime = false,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from(table as any).select(select);

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }
    if (isNull) {
      for (const col of isNull) {
        query = query.is(col, null);
      }
    }
    if (isNotNull) {
      for (const col of isNotNull) {
        query = query.not(col, "is", null);
      }
    }
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    if (limit) {
      query = query.limit(limit);
    }

    const { data: result, error } = await query;
    if (!error && result && isMounted.current) {
      setData(result as unknown as T[]);
    }
    if (isMounted.current) setLoading(false);
  }, [table, select, JSON.stringify(filters), JSON.stringify(isNull), JSON.stringify(isNotNull), JSON.stringify(orderBy), limit]);

  useEffect(() => {
    isMounted.current = true;
    fetchData();

    const sub = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          if (!isMounted.current) return;
          const { eventType, new: newRow, old: oldRow } = payload;

          setData((prev) => {
            if (eventType === "INSERT") {
              const row = newRow as T;
              if (validate && !validate(row)) return prev;
              if (prev.some((r) => r[idField] === row[idField])) return prev;
              // Add to beginning if ordered desc, end otherwise
              return orderBy?.ascending === false ? [row, ...prev] : [...prev, row];
            }

            if (eventType === "UPDATE") {
              const row = newRow as T;
              if (validate && !validate(row)) {
                // No longer valid — remove
                return prev.filter((r) => r[idField] !== row[idField]);
              }
              const exists = prev.some((r) => r[idField] === row[idField]);
              if (exists) {
                return prev.map((r) => (r[idField] === row[idField] ? row : r));
              }
              return orderBy?.ascending === false ? [row, ...prev] : [...prev, row];
            }

            if (eventType === "DELETE") {
              const id = (oldRow as any)?.[idField];
              if (id) return prev.filter((r) => r[idField] !== id);
            }

            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      isMounted.current = false;
      supabase.removeChannel(sub);
    };
  }, [fetchData, channel, table, idField]);

  const optimisticUpdate = useCallback(
    (id: any, fields: Partial<T>) => {
      setData((prev) =>
        prev.map((r) => (r[idField] === id ? { ...r, ...fields } : r))
      );
    },
    [idField]
  );

  const optimisticAdd = useCallback(
    (item: T) => {
      setData((prev) => {
        if (prev.some((r) => r[idField] === item[idField])) return prev;
        return orderBy?.ascending === false ? [item, ...prev] : [...prev, item];
      });
    },
    [idField]
  );

  const optimisticRemove = useCallback(
    (id: any) => {
      setData((prev) => prev.filter((r) => r[idField] !== id));
    },
    [idField]
  );

  return {
    data,
    setData,
    loading,
    refetch: fetchData,
    optimisticUpdate,
    optimisticAdd,
    optimisticRemove,
  };
}
