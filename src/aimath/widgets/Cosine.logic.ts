// 코사인 유사도 (React 없음)

export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length > 0);
}

export function buildVocab(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

export function countVector(tokens: string[], vocab: string[]): number[] {
  return vocab.map((w) => tokens.filter((t) => t === w).length);
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

/** 길이의 제곱 (|A|^2 = A·A) */
export function normSq(a: number[]): number {
  return dot(a, a);
}

export interface CosResult {
  dot: number;
  normSqA: number;
  normSqB: number;
  normA: number;
  normB: number;
  /** 영벡터가 있으면 null */
  cos: number | null;
  angleDeg: number | null;
}

export function cosine(a: number[], b: number[]): CosResult {
  const d = dot(a, b);
  const sa = normSq(a);
  const sb = normSq(b);
  const na = Math.sqrt(sa);
  const nb = Math.sqrt(sb);
  if (na === 0 || nb === 0) return { dot: d, normSqA: sa, normSqB: sb, normA: na, normB: nb, cos: null, angleDeg: null };
  const c = Math.round(Math.max(-1, Math.min(1, d / (na * nb))) * 1e12) / 1e12;
  return { dot: d, normSqA: sa, normSqB: sb, normA: na, normB: nb, cos: c, angleDeg: (Math.acos(c) * 180) / Math.PI };
}
