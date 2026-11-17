// Regra das abas da tela Meus Ofícios:
// - Finalizados: Protocolado, Respondido, Atendido, Impresso, Cancelado
// - Rascunhos: qualquer outro status (Rascunho, Salvo, Exportado, Salvo no Drive, etc.)

export const STATUS_FINALIZADOS = ["Protocolado", "Respondido", "Atendido", "Impresso", "Cancelado"] as const;

export function isFinalizado(status: string | null | undefined): boolean {
  return STATUS_FINALIZADOS.includes((status ?? "") as (typeof STATUS_FINALIZADOS)[number]);
}

export function separarPorAba<T extends { status: string | null }>(oficios: T[]): {
  finalizados: T[];
  rascunhos: T[];
} {
  const finalizados: T[] = [];
  const rascunhos: T[] = [];
  for (const o of oficios) {
    if (isFinalizado(o.status)) finalizados.push(o);
    else rascunhos.push(o);
  }
  return { finalizados, rascunhos };
}
