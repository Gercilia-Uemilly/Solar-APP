import type { OficioRow } from "@/lib/oficioUtils";

/** Normaliza texto: minúsculas, sem acentos, sem pontuação extra, trim. */
function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a","o","as","os","de","da","do","das","dos","e","em","no","na","nos","nas",
  "para","por","com","sem","ao","aos","um","uma","uns","umas","que","se","sobre",
  "rua","av","avenida","bairro","sr","sra","ilmo","exmo",
]);

function tokens(s: string): Set<string> {
  return new Set(
    norm(s)
      .split(" ")
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

/** Jaccard similarity (0..1) entre dois textos. */
function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  const union = new Set([...ta, ...tb]).size;
  return inter / union;
}

function normPhone(p: string | null | undefined): string {
  return (p || "").replace(/\D+/g, "");
}

export interface DuplicateMatch {
  oficio: OficioRow;
  reasons: string[]; // motivos legíveis
  score: number; // 0..1
}

/**
 * Detecta possíveis duplicatas de `target` dentro de `all`.
 * Critérios (configuráveis): mesmo endereço/local, mesmo solicitante,
 * mesma secretaria + assunto similar, mesmo bairro + assunto similar.
 */
export function findDuplicates(
  target: Partial<OficioRow>,
  all: OficioRow[],
  opts: { assuntoThreshold?: number } = {}
): DuplicateMatch[] {
  const threshold = opts.assuntoThreshold ?? 0.55;
  const matches: DuplicateMatch[] = [];

  const tEnd = norm(target.endereco_completo || target.local_demanda);
  const tBairro = norm(target.bairro);
  const tSec = norm(target.secretaria_identificada);
  const tAss = target.assunto || "";
  const tSol = norm(target.solicitante);
  const tFone = normPhone(target.contato_solicitante);

  for (const o of all) {
    if (o.id === target.id) continue;
    if (o.deleted_at) continue;

    const reasons: string[] = [];
    let score = 0;

    // Mesmo endereço/local
    const oEnd = norm(o.endereco_completo || o.local_demanda);
    if (tEnd && oEnd && (tEnd === oEnd || (tEnd.length > 6 && (oEnd.includes(tEnd) || tEnd.includes(oEnd))))) {
      reasons.push("Mesmo endereço/local");
      score += 0.45;
    }

    // Mesmo solicitante (telefone ou nome)
    const oFone = normPhone(o.contato_solicitante);
    if (tFone && oFone && tFone.length >= 8 && tFone === oFone) {
      reasons.push("Mesmo telefone do solicitante");
      score += 0.4;
    } else {
      const oSol = norm(o.solicitante);
      if (tSol && oSol && tSol === oSol) {
        reasons.push("Mesmo solicitante");
        score += 0.3;
      }
    }

    // Assunto similar (compartilhado entre dois critérios)
    const sim = similarity(tAss, o.assunto || "");

    // Mesma secretaria + assunto similar
    const oSec = norm(o.secretaria_identificada);
    if (tSec && oSec && tSec === oSec && sim >= threshold) {
      reasons.push(`Mesma secretaria + assunto similar (${Math.round(sim * 100)}%)`);
      score += 0.35;
    }

    // Mesmo bairro + assunto similar
    const oBairro = norm(o.bairro);
    if (tBairro && oBairro && tBairro === oBairro && sim >= threshold) {
      reasons.push(`Mesmo bairro + assunto similar (${Math.round(sim * 100)}%)`);
      score += 0.3;
    }

    if (reasons.length > 0) {
      matches.push({ oficio: o, reasons, score: Math.min(1, score) });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

/** Mapa id -> duplicatas, para uso na lista. */
export function buildDuplicateMap(
  all: OficioRow[],
  opts?: { assuntoThreshold?: number }
): Map<string, DuplicateMatch[]> {
  const map = new Map<string, DuplicateMatch[]>();
  for (const o of all) {
    const dups = findDuplicates(o, all, opts);
    if (dups.length > 0) map.set(o.id, dups);
  }
  return map;
}