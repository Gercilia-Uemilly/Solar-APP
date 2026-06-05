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
  const threshold = opts?.assuntoThreshold ?? 0.55;

  // Precomputa tudo uma única vez por ofício (evita O(N²) de tokenização)
  type Pre = {
    o: OficioRow;
    end: string;
    bairro: string;
    sec: string;
    sol: string;
    fone: string;
    assTokens: Set<string>;
  };

  const pre: Pre[] = [];
  // Índices invertidos para reduzir o N² para apenas pares "candidatos"
  const byEnd = new Map<string, number[]>();
  const byFone = new Map<string, number[]>();
  const bySol = new Map<string, number[]>();
  const bySec = new Map<string, number[]>();
  const byBairro = new Map<string, number[]>();

  const pushIdx = (m: Map<string, number[]>, key: string, idx: number) => {
    if (!key) return;
    const arr = m.get(key);
    if (arr) arr.push(idx);
    else m.set(key, [idx]);
  };

  for (let i = 0; i < all.length; i++) {
    const o = all[i];
    if (o.deleted_at) {
      pre.push(null as any);
      continue;
    }
    const end = norm(o.endereco_completo || o.local_demanda);
    const bairro = norm(o.bairro);
    const sec = norm(o.secretaria_identificada);
    const sol = norm(o.solicitante);
    const fone = normPhone(o.contato_solicitante);
    const assTokens = tokens(o.assunto || "");
    pre.push({ o, end, bairro, sec, sol, fone, assTokens });

    pushIdx(byEnd, end, i);
    if (fone.length >= 8) pushIdx(byFone, fone, i);
    pushIdx(bySol, sol, i);
    pushIdx(bySec, sec, i);
    pushIdx(byBairro, bairro, i);
  }

  const simTokens = (a: Set<string>, b: Set<string>): number => {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    small.forEach((t) => big.has(t) && inter++);
    const union = a.size + b.size - inter;
    return union ? inter / union : 0;
  };

  for (let i = 0; i < pre.length; i++) {
    const t = pre[i];
    if (!t) continue;

    // Coleta candidatos via índices invertidos (não compara contra todos)
    const candIdx = new Set<number>();
    const addAll = (idxs?: number[]) => {
      if (!idxs) return;
      for (const j of idxs) if (j !== i) candIdx.add(j);
    };
    if (t.end) addAll(byEnd.get(t.end));
    if (t.fone.length >= 8) addAll(byFone.get(t.fone));
    if (t.sol) addAll(bySol.get(t.sol));
    if (t.sec) addAll(bySec.get(t.sec));
    if (t.bairro) addAll(byBairro.get(t.bairro));

    if (candIdx.size === 0) continue;

    const matches: DuplicateMatch[] = [];
    candIdx.forEach((j) => {
      const c = pre[j];
      if (!c) return;

      const reasons: string[] = [];
      let score = 0;

      if (t.end && c.end && (t.end === c.end || (t.end.length > 6 && (c.end.includes(t.end) || t.end.includes(c.end))))) {
        reasons.push("Mesmo endereço/local");
        score += 0.45;
      }

      if (t.fone && c.fone && t.fone.length >= 8 && t.fone === c.fone) {
        reasons.push("Mesmo telefone do solicitante");
        score += 0.4;
      } else if (t.sol && c.sol && t.sol === c.sol) {
        reasons.push("Mesmo solicitante");
        score += 0.3;
      }

      let sim = -1;
      if (t.sec && c.sec && t.sec === c.sec) {
        sim = simTokens(t.assTokens, c.assTokens);
        if (sim >= threshold) {
          reasons.push(`Mesma secretaria + assunto similar (${Math.round(sim * 100)}%)`);
          score += 0.35;
        }
      }
      if (t.bairro && c.bairro && t.bairro === c.bairro) {
        if (sim < 0) sim = simTokens(t.assTokens, c.assTokens);
        if (sim >= threshold) {
          reasons.push(`Mesmo bairro + assunto similar (${Math.round(sim * 100)}%)`);
          score += 0.3;
        }
      }

      if (reasons.length > 0) {
        matches.push({ oficio: c.o, reasons, score: Math.min(1, score) });
      }
    });

    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      map.set(t.o.id, matches);
    }
  }

  return map;
}