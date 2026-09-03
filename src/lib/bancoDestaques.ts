/**
 * Favoritos, contagem de acessos e histórico de busca do Banco de Informações.
 * Armazenado localmente por operador (chave inclui o user id).
 */

const FAV_KEY = "banco_favoritos";
const HITS_KEY = "banco_acessos";
const HIST_KEY = "banco_historico_busca";

function key(base: string, userId?: string | null) {
  return `${base}:${userId || "anon"}`;
}

function read<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(k: string, value: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* storage cheio ou indisponível — ignora */
  }
}

export function getFavoritos(userId?: string | null): string[] {
  return read<string[]>(key(FAV_KEY, userId), []);
}

export function toggleFavorito(id: string, userId?: string | null): string[] {
  const current = getFavoritos(userId);
  const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
  write(key(FAV_KEY, userId), next);
  return next;
}

export type Acessos = Record<string, number>;

export function getAcessos(userId?: string | null): Acessos {
  return read<Acessos>(key(HITS_KEY, userId), {});
}

export function registrarAcesso(id: string, userId?: string | null): Acessos {
  const current = getAcessos(userId);
  const next = { ...current, [id]: (current[id] || 0) + 1 };
  write(key(HITS_KEY, userId), next);
  return next;
}

export function getHistoricoBusca(userId?: string | null): string[] {
  return read<string[]>(key(HIST_KEY, userId), []);
}

export function registrarBusca(term: string, userId?: string | null): string[] {
  const t = term.trim();
  if (t.length < 2) return getHistoricoBusca(userId);
  const current = getHistoricoBusca(userId).filter(x => x.toLowerCase() !== t.toLowerCase());
  const next = [t, ...current].slice(0, 12);
  write(key(HIST_KEY, userId), next);
  return next;
}
