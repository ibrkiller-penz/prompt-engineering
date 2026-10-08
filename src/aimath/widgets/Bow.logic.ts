// 단어집합·원-핫·빈도 벡터 계산 (React 없음)

/** 공백으로 자르고 문장부호를 지운다. 조사는 그대로 둔다(단순 토큰화). */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length > 0);
}

/** 중복을 없애고 처음 나온 순서를 유지 */
export function uniqueInOrder(tokens: string[]): string[] {
  return Array.from(new Set(tokens));
}

/** 두 문서의 합집합 어휘(처음 나온 순서) */
export function buildVocab(a: string[], b: string[]): string[] {
  return uniqueInOrder([...a, ...b]);
}

export function countVector(tokens: string[], vocab: string[]): number[] {
  return vocab.map((w) => tokens.filter((t) => t === w).length);
}

export function oneHot(word: string, vocab: string[]): number[] {
  return vocab.map((w) => (w === word ? 1 : 0));
}

export interface SetStats {
  nA: number;
  nB: number;
  nInter: number;
  nUnion: number;
  /** n(A)+n(B)-n(A∩B) */
  rhs: number;
  holds: boolean;
}

export function setStats(a: string[], b: string[]): SetStats {
  const sa = new Set(a);
  const sb = new Set(b);
  const nInter = [...sa].filter((w) => sb.has(w)).length;
  const nUnion = new Set([...sa, ...sb]).size;
  const rhs = sa.size + sb.size - nInter;
  return { nA: sa.size, nB: sb.size, nInter, nUnion, rhs, holds: rhs === nUnion };
}
