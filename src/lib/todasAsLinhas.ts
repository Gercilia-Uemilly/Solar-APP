/**
 * O backend devolve no máximo 1000 linhas por consulta.
 * Busca em lotes até acabar, para listas que precisam de todos os registros.
 */
export const TAMANHO_LOTE = 1000;

export async function todasAsLinhas<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += TAMANHO_LOTE) {
    const { data, error } = await consulta(de, de + TAMANHO_LOTE - 1);
    if (error) throw error;
    const lote = (data || []) as T[];
    out.push(...lote);
    if (lote.length < TAMANHO_LOTE) return out;
  }
}
