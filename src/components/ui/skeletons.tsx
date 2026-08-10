import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeletons compartilhados — usados no lugar de spinners para evitar
 * "tela em branco" e reduzir a percepção de lentidão.
 * Todas as animações respeitam `prefers-reduced-motion` (ver index.css).
 */

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-2 animate-fade-in" role="status" aria-label="Carregando dados">
      <div className="flex gap-3 pb-2 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 py-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" style={{ opacity: 1 - r * 0.08 }} />
          ))}
        </div>
      ))}
      <span className="sr-only">Carregando dados…</span>
    </div>
  );
}

export function CardGridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-in"
      role="status"
      aria-label="Carregando itens"
    >
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border p-4 space-y-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
      <span className="sr-only">Carregando itens…</span>
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3 animate-fade-in" role="status" aria-label="Carregando lista">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando lista…</span>
    </div>
  );
}

/** Esqueleto de página inteira — fallback do Suspense das rotas. */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 space-y-6" role="status" aria-label="Carregando página">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <TableSkeleton rows={7} cols={5} />
      <span className="sr-only">Carregando página…</span>
    </div>
  );
}