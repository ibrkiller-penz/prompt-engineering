// TF-IDF 계산 (React 없음)

export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase())
    .filter((w) => w.length > 0);
}

export type LogBase = "e" | "10";

/** tf = (문서에서 단어 등장 횟수) / (문서 전체 단어 수). 빈 문서는 0 */
export function tf(tokens: string[], word: string): number {
  if (tokens.length === 0) return 0;
  return tokens.filter((t) => t === word).length / tokens.length;
}

/** df = 단어가 들어 있는 문서 수 */
export function df(docs: string[][], word: string): number {
  return docs.filter((d) => d.includes(word)).length;
}

/** idf = log(N/df). df=0 또는 N=0 이면 정의할 수 없으므로 null */
export function idf(N: number, dfv: number, base: LogBase = "e"): number | null {
  if (N <= 0 || dfv <= 0) return null;
  const r = N / dfv;
  return base === "e" ? Math.log(r) : Math.log10(r);
}

/** tf-idf. idf 를 정의할 수 없으면 0 */
export function tfidf(tokens: string[], docs: string[][], word: string, base: LogBase = "e"): number {
  const i = idf(docs.length, df(docs, word), base);
  return i === null ? 0 : tf(tokens, word) * i;
}

export function vocabOf(docs: string[][]): string[] {
  return Array.from(new Set(docs.flat()));
}

/** 점수가 가장 큰 단어(동점이면 모두). 점수가 전부 0 이면 빈 배열 */
export function topWords(scores: number[], vocab: string[]): string[] {
  const max = Math.max(...scores, 0);
  if (max <= 1e-12) return [];
  return vocab.filter((_, i) => Math.abs(scores[i] - max) < 1e-12);
}
