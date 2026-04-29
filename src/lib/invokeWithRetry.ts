import { supabase } from "@/integrations/supabase/client";

interface InvokeOptions {
  body?: any;
  retries?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, err: any) => void;
}

/**
 * Detect if an error is a transient network failure (worth retrying).
 * Common on mobile: tab sleep, 4G drops, edge cold-start, DNS hiccups.
 */
function isTransientError(err: any): boolean {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to send a request") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("typeerror") ||
    err?.name === "FunctionsFetchError"
  );
}

/**
 * Wrapper around `supabase.functions.invoke` with exponential backoff retry.
 * Retries only on transient network errors — not on 4xx/5xx logical errors
 * returned by the function itself.
 */
export async function invokeWithRetry<T = any>(
  functionName: string,
  { body, retries = 3, baseDelayMs = 800, onRetry }: InvokeOptions = {}
): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) {
        // Retry only if it looks like a network issue, not a function-level error
        if (isTransientError(error) && attempt < retries) {
          lastError = error;
          onRetry?.(attempt, error);
          await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
          continue;
        }
        return { data: null, error };
      }
      return { data: data as T, error: null };
    } catch (err: any) {
      lastError = err;
      if (isTransientError(err) && attempt < retries) {
        onRetry?.(attempt, err);
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
        continue;
      }
      return { data: null, error: err };
    }
  }
  return { data: null, error: lastError };
}

/**
 * Map low-level network errors to friendly Portuguese messages.
 */
export function friendlyInvokeError(err: any): string {
  const msg = String(err?.message || err || "").toLowerCase();
  if (
    msg.includes("failed to send a request") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed")
  ) {
    return "Conexão instável. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("timeout") || msg.includes("demor")) {
    return "A operação demorou demais. Tente novamente.";
  }
  if (msg.includes("aborted")) {
    return "Operação cancelada. Tente novamente.";
  }
  if (msg.includes("non-2xx") || msg.includes("500")) {
    return "Servidor temporariamente indisponível. Aguarde alguns segundos e tente de novo.";
  }
  return err?.message || "Erro inesperado. Tente novamente.";
}