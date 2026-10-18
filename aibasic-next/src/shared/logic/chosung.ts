// 사전 초성 검색. 'ㅇㄱㅈㄴ' 으로 '인공지능', 'ㅂㅌ' 으로 '벡터' 를 찾아요.
// 초성과 완성 글자를 섞어도 돼요('인ㄱ'). 마지막 글자는 치는 중일 수 있어서 '고' 로 '공' 도 찾아요.

const CHO = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
const BASE = 0xac00;
const LAST = 0xd7a3;

function isSyllable(c: number): boolean {
  return c >= BASE && c <= LAST;
}

/** 글자 하나의 초성(한글 음절이 아니면 그대로) */
export function chosungOf(ch: string): string {
  const c = ch.charCodeAt(0);
  return isSyllable(c) ? CHO[Math.floor((c - BASE) / 588)] : ch;
}

/** 글자 전체를 초성으로(한글이 아닌 글자는 그대로) */
export function getChosung(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) out += chosungOf(s[i]);
  return out;
}

export function isChosung(ch: string): boolean {
  return CHO.indexOf(ch) >= 0;
}

function prep(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, "").toLowerCase();
}

/** 쿼리 글자 q 가 대상 글자 t 와 맞는지. last 는 쿼리의 마지막 글자인지(치는 중 허용) */
function charMatch(q: string, t: string, last: boolean): boolean {
  if (q === t) return true;
  const tc = t.charCodeAt(0);
  if (isChosung(q)) return isSyllable(tc) && chosungOf(t) === q;
  const qc = q.charCodeAt(0);
  if (last && isSyllable(qc) && isSyllable(tc)) {
    // 받침 없는 '고' 가 '공'·'곰' 의 앞부분으로 맞음
    const qi = qc - BASE;
    const ti = tc - BASE;
    if (qi % 28 === 0 && Math.floor(qi / 28) === Math.floor(ti / 28)) return true;
  }
  return false;
}

/** 대상 글자에서 쿼리가 처음 맞는 위치(공백 빼고 센 위치). 없으면 -1, 빈 쿼리는 0 */
export function chosungIndexOf(target: string, query: string): number {
  const q = prep(query);
  const t = prep(target);
  if (!q) return 0;
  for (let s = 0; s + q.length <= t.length; s++) {
    let ok = true;
    for (let k = 0; k < q.length; k++) {
      if (!charMatch(q[k], t[s + k], k === q.length - 1)) {
        ok = false;
        break;
      }
    }
    if (ok) return s;
  }
  return -1;
}

export function chosungMatch(target: string, query: string): boolean {
  return chosungIndexOf(target, query) >= 0;
}

/**
 * 목록 거르기. keys 가 주는 글자들(용어, 뜻 등) 중 하나라도 맞으면 남겨요.
 * 정렬: 첫 번째 key 에서 맞음 > 다른 key 에서 맞음, 그 안에서는 앞쪽에서 맞을수록 먼저. 같으면 원래 순서.
 */
export function chosungFilter<T>(items: readonly T[], query: string, keys: (item: T) => string[]): T[] {
  if (!prep(query)) return items.slice();
  const scored: { item: T; score: number; i: number }[] = [];
  items.forEach((item, i) => {
    const ks = keys(item);
    let best = Infinity;
    for (let k = 0; k < ks.length; k++) {
      const at = chosungIndexOf(ks[k] || "", query);
      if (at >= 0) {
        best = Math.min(best, k * 10000 + at);
        break;
      }
    }
    if (best < Infinity) scored.push({ item, score: best, i });
  });
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  return scored.map((x) => x.item);
}
