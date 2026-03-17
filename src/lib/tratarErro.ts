import { toast } from "sonner";

const MENSAGENS: Record<string, string> = {
  "Failed to fetch": "Sem conexão. Verifique sua internet.",
  "JWT expired": "Sessão expirada. Faça login novamente.",
  "non-2xx status": "Serviço temporariamente indisponível.",
  "401": "Você não tem permissão para esta ação.",
  "403": "Acesso negado.",
  "500": "Erro no servidor. Tente novamente em instantes.",
  timeout: "Operação demorou muito. Tente novamente.",
  NetworkError: "Sem conexão. Verifique sua internet.",
  "Load failed": "Falha ao carregar. Verifique sua conexão.",
};

/**
 * Global error handler — maps technical errors to friendly Portuguese messages.
 */
export function tratarErro(error: unknown, contexto?: string) {
  const msg =
    error instanceof Error ? error.message : String(error ?? "");

  if (contexto) {
    console.error(`[${contexto}]`, error);
  }

  const mensagem =
    Object.entries(MENSAGENS).find(([key]) => msg.includes(key))?.[1] ||
    "Erro inesperado. Tente novamente.";

  toast.error(mensagem);
  return mensagem;
}
