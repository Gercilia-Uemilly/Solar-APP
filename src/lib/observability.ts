import * as Sentry from "@sentry/react";

/**
 * Camada de observabilidade.
 *
 * - Erros: Sentry (ativado apenas quando `VITE_SENTRY_DSN` estiver definida).
 * - Tracing/métricas: o Sentry já emite performance tracing. Para exportar para
 *   Datadog / New Relic / OpenTelemetry basta apontar o coletor OTLP no provedor
 *   e ativar `VITE_OTEL_EXPORTER_URL` (ver comentário abaixo).
 *
 * Nada aqui interfere em autenticação ou na integração n8n — é só instrumentação.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE;

let iniciado = false;

export function initObservability() {
  if (iniciado || !DSN) return;
  iniciado = true;

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    release: import.meta.env.VITE_APP_RELEASE as string | undefined,
    integrations: [Sentry.browserTracingIntegration()],
    // Amostragem conservadora para não gerar ruído/custo.
    tracesSampleRate: ENV === "production" ? 0.1 : 1.0,
    // Não enviar dados pessoais por padrão.
    sendDefaultPii: false,
    beforeSend(event) {
      // Remove querystrings que possam conter tokens.
      if (event.request?.url) event.request.url = event.request.url.split("?")[0];
      return event;
    },
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "AbortError",
    ],
  });
}

/** Reporta um erro capturado manualmente (ex.: ErrorBoundary, catch de mutação). */
export function reportError(error: unknown, contexto?: Record<string, unknown>) {
  if (!DSN) {
    console.error("[observability]", error, contexto);
    return;
  }
  Sentry.captureException(error, contexto ? { extra: contexto } : undefined);
}

/** Associa o usuário logado aos eventos (apenas id — sem e-mail/PII). */
export function setObservabilityUser(userId: string | null) {
  if (!DSN) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

/*
 * OpenTelemetry (opcional):
 * Para enviar traces para Datadog / New Relic / coletor OTLP próprio,
 * instale `@opentelemetry/sdk-trace-web` + `@opentelemetry/exporter-trace-otlp-http`
 * e configure `VITE_OTEL_EXPORTER_URL`. O Sentry acima continua funcionando em paralelo.
 */