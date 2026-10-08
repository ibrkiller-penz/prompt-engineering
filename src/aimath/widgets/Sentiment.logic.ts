// 감성 사전 점수 계산 (React 없음)

export interface DictEntry {
  word: string;
  score: number;
}

export interface Segment {
  text: string;
  /** 사전에 걸린 부분이면 그 단어의 점수, 아니면 null */
  score: number | null;
}

export interface Match {
  token: string;
  word: string;
  score: number;
}

function cleanDict(dict: DictEntry[]): DictEntry[] {
  return dict
    .map((d) => ({ word: d.word.trim(), score: d.score }))
    .filter((d) => d.word.length > 0 && Number.isFinite(d.score))
    .sort((a, b) => b.word.length - a.word.length); // 긴 단어 우선
}

/** 어절 안에 사전 단어가 들어 있으면(가장 긴 것 하나) 일치로 본다. */
function findIn(token: string, dict: DictEntry[]): { entry: DictEntry; index: number } | null {
  for (const e of dict) {
    const i = token.indexOf(e.word);
    if (i >= 0) return { entry: e, index: i };
  }
  return null;
}

export function matchReview(text: string, dictIn: DictEntry[]): Match[] {
  const dict = cleanDict(dictIn);
  const out: Match[] = [];
  for (const raw of text.split(/\s+/)) {
    const token = raw.replace(/[^\p{L}\p{N}]/gu, "");
    if (!token) continue;
    const f = findIn(token, dict);
    if (f) out.push({ token, word: f.entry.word, score: f.entry.score });
  }
  return out;
}

export function totalScore(matches: Match[]): number {
  return matches.reduce((s, m) => s + m.score, 0);
}

export type Verdict = "긍정" | "부정" | "중립";

/** 합계가 threshold 이상이면 긍정, -threshold 이하면 부정, 그 사이는 중립 */
export function verdict(total: number, threshold: number): Verdict {
  const t = Math.abs(threshold);
  if (total >= t && total > 0) return "긍정";
  if (total <= -t && total < 0) return "부정";
  return "중립";
}

/** 강조 표시용으로 글을 조각낸다 (공백은 그대로 보존) */
export function highlight(text: string, dictIn: DictEntry[]): Segment[] {
  const dict = cleanDict(dictIn);
  const segs: Segment[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (part === "") continue;
    if (/^\s+$/.test(part)) {
      segs.push({ text: part, score: null });
      continue;
    }
    const f = findIn(part, dict);
    if (!f) {
      segs.push({ text: part, score: null });
      continue;
    }
    const end = f.index + f.entry.word.length;
    if (f.index > 0) segs.push({ text: part.slice(0, f.index), score: null });
    segs.push({ text: part.slice(f.index, end), score: f.entry.score });
    if (end < part.length) segs.push({ text: part.slice(end), score: null });
  }
  return segs;
}
