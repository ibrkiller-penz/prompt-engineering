// 표시용 덧씌우기(해요체 치환·칩) 순수 함수. 원본 JSON 은 고치지 않고, 화면에 보일 때만 바꿔요.
// 규칙: 문장이 '정확히' 들어 있을 때만 바꿔요. 경로(path)를 주면 그 글자에서만.
import type { ChipRule, ToneFile, ToneRule } from "../shared/contracts.ts";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

/** 문서 안의 모든 문자열을 경로와 함께 바꿔요(새 객체를 돌려줘요) */
export function mapStrings<T>(doc: T, fn: (s: string, path: string) => string, base = ""): T {
  const walk = (v: unknown, p: string): unknown => {
    if (typeof v === "string") return fn(v, p);
    if (Array.isArray(v)) return v.map((x, i) => walk(x, p ? p + "." + i : String(i)));
    if (isObj(v)) {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v)) out[k] = walk(v[k], p ? p + "." + k : k);
      return out;
    }
    return v;
  };
  return walk(doc, base) as T;
}

function rulesFor(rules: ToneRule[] | undefined, where: string): ToneRule[] {
  return (rules || []).filter((r) => r.where === where && typeof r.from === "string" && r.from.length > 0 && typeof r.to === "string");
}

export interface ToneReport {
  applied: number;
  unused: ToneRule[]; // 원문을 못 찾은 규칙(원본이 바뀌었을 수 있어요 — 검사 스크립트가 알려 줘요)
}

/** where(레슨 id "u1-1" 또는 단원 "u1") 문서에 tone 규칙을 적용해요 */
export function applyTone<T>(doc: T, where: string, file: ToneFile | null | undefined, report?: ToneReport): T {
  const rules = rulesFor(file ? file.replace : undefined, where);
  if (!rules.length) return doc;
  const used = new Set<ToneRule>();
  const out = mapStrings(doc, (s, p) => {
    let cur = s;
    for (const r of rules) {
      if (r.path && r.path !== p) continue;
      if (cur.indexOf(r.from) >= 0) {
        cur = cur.split(r.from).join(r.to);
        used.add(r);
      }
    }
    return cur;
  });
  if (report) {
    report.applied += used.size;
    for (const r of rules) if (!used.has(r)) report.unused.push(r);
  }
  return out;
}

/** 이 글자(경로 path, 내용 text)에 붙일 칩 이름들 */
export function chipsFor(file: ToneFile | null | undefined, where: string, path: string, text: string): string[] {
  const out: string[] = [];
  for (const c of (file && file.chips) || ([] as ChipRule[])) {
    if (c.where !== where) continue;
    if (c.path && c.path !== path) continue;
    if (c.match && text.indexOf(c.match) >= 0 && out.indexOf(c.label) < 0) out.push(c.label);
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 문제 본문 해요체 규칙(prompt·choices·hints·solution)
 * - 문장 끝 해라체 어미만 바꿔요: "…한다." → "…해요.", "…하는가?" → "…할까요?", "…인가?" → "…일까요?",
 *   "…이다." → "…이에요/예요."(받침에 따라), "구하시오/구하여라" → "구해 보세요" 등.
 * - $…$, $$…$$ 수식, 따옴표(‘’ “” '' "" 「」 『』) 안의 글, `코드` 는 건드리지 않아요.
 * - 모르는 낱말은 그대로 둬요(틀리게 바꾸는 것보다 남겨 두는 게 나아요). 남은 것은 check-content 가 알려 줘요.
 * - Chrome 80 에서도 돌아가게 최신 문법(?., ??, replaceAll, 뒤보기 정규식 등)을 쓰지 않아요.
 * ──────────────────────────────────────────────────────────────────────────── */

const HANGUL_BASE = 0xac00;
const isHangul = (ch: string): boolean => {
  const c = ch.charCodeAt(0);
  return c >= HANGUL_BASE && c <= 0xd7a3;
};
// 중성 번호: ㅏ0 ㅐ1 ㅑ2 ㅒ3 ㅓ4 ㅔ5 ㅕ6 ㅖ7 ㅗ8 ㅘ9 ㅙ10 ㅚ11 ㅛ12 ㅜ13 ㅝ14 ㅞ15 ㅟ16 ㅠ17 ㅡ18 ㅢ19 ㅣ20
// 종성 번호: 없음0 ㄱ1 ㄲ2 ㄳ3 ㄴ4 ㄵ5 ㄶ6 ㄷ7 ㄹ8 ㄺ9 ㄻ10 ㄼ11 ㄽ12 ㄾ13 ㄿ14 ㅀ15 ㅁ16 ㅂ17 ㅄ18 ㅅ19 ㅆ20 ㅇ21 ㅈ22 ㅊ23 ㅋ24 ㅌ25 ㅍ26 ㅎ27
const J = { A: 0, AE: 1, YA: 2, EO: 4, E: 5, YEO: 6, O: 8, WA: 9, WAE: 10, OE: 11, U: 13, WO: 14, EU: 18, I: 20 };
const T = { NONE: 0, N: 4, D: 7, L: 8, B: 17, S: 19, SS: 20 };
interface Syl {
  c: number; // 초성
  v: number; // 중성
  t: number; // 종성
}
function dec(ch: string): Syl | null {
  if (!ch || !isHangul(ch)) return null;
  const n = ch.charCodeAt(0) - HANGUL_BASE;
  return { c: Math.floor(n / 588), v: Math.floor((n % 588) / 28), t: n % 28 };
}
const com = (s: Syl): string => String.fromCharCode(HANGUL_BASE + s.c * 588 + s.v * 28 + s.t);
const lastCh = (s: string): string => (s ? s.charAt(s.length - 1) : "");
const init = (s: string): string => s.slice(0, s.length - 1);
const withJong = (ch: string, t: number): string => {
  const d = dec(ch);
  return d ? com({ c: d.c, v: d.v, t: t }) : ch;
};

// ㄹ 받침이 떨어진 어간을 되살려요(만든다 → 만들, 연다 → 열). 뜻이 갈릴 수 있는 것(산다·안다·끈다)은 넣지 않아요.
const LIEUL_RESTORE = ["드", "여", "노", "푸", "도"];
// ㅂ 불규칙(쉽다 → 쉬워요). 돕·곱 은 '와'
const B_IRREG = ["쉽", "렵", "깝", "겁", "볍", "덥", "춥", "엽", "롭", "럽", "섭", "밉", "맵", "답", "돕", "곱", "둡"];
// ㄷ 불규칙(듣다 → 들어요)
const D_IRREG = ["듣", "걷", "묻", "싣", "깨닫"];
// ㅅ 불규칙(긋다 → 그어요)
const S_IRREG = ["긋", "짓", "잇", "낫", "붓"];
// 르 불규칙이 아닌 '르'(따르다 → 따라요)
const REU_REGULAR = ["따르", "치르", "들르"];
// 받침 없는 '…다' 로 끝나도 해라체 형용사인 어간(그 밖의 '…다' 는 동사 기본형이나 이름일 수 있어 그대로 둬요)
const ADJ_STEMS = [
  "같", "똑같", "없", "많", "적", "작", "크", "높", "낮", "좋", "싫", "쉽", "어렵", "가깝", "멀", "길", "짧", "넓", "좁", "맞", "옳", "알맞",
  "다르", "빠르", "느리", "귀엽", "예쁘", "가볍", "무겁", "싶", "않", "깊", "얕", "굵", "가늘", "밝", "어둡", "무섭", "아프", "기쁘", "슬프",
  "바쁘", "나쁘", "늦", "드물", "둥글", "젊", "아름답", "새롭", "괜찮", "낫", "이르", "흐리", "비싸", "싸", "짜", "맵", "춥", "덥", "즐겁",
];

const endsWithAny = (s: string, list: string[]): string | null => {
  for (const x of list) if (s.length >= x.length && s.slice(s.length - x.length) === x) return x;
  return null;
};

function restoreLieul(stem: string): string {
  const last = lastCh(stem);
  const d = dec(last);
  if (d && d.t === 0 && LIEUL_RESTORE.indexOf(last) >= 0) return init(stem) + withJong(last, T.L);
  return stem;
}

/** 어간 → '아/어' 꼴(해요체 '요' 앞): 하 → 해, 보 → 봐, 쓰 → 써, 고르 → 골라, 쉽 → 쉬워, 있 → 있어 */
export function aeoForm(stem: string): string {
  if (!stem) return stem;
  const last = lastCh(stem);
  const d = dec(last);
  if (!d) return stem;
  const head = init(stem);
  if (last === "하") return head + "해";
  // ㅎ 불규칙(그렇다 → 그래요, 어떻다 → 어때요)
  if (last === "렇") return head + "래";
  if (last === "떻") return head + "때";
  if (d.t === T.B && endsWithAny(stem, B_IRREG)) {
    const base = head + com({ c: d.c, v: d.v, t: 0 });
    return base + (last === "돕" || last === "곱" ? "와" : "워");
  }
  if (d.t === T.D && endsWithAny(stem, D_IRREG)) return aeoForm(head + withJong(last, T.L));
  if (d.t === T.S && endsWithAny(stem, S_IRREG)) {
    const base = head + com({ c: d.c, v: d.v, t: 0 });
    return base + (d.v === J.A || d.v === J.O ? "아" : "어");
  }
  if (d.t !== T.NONE) return stem + (d.v === J.A || d.v === J.YA || d.v === J.O ? "아" : "어");
  // 받침 없음
  if (d.v === J.EU) {
    const prev = dec(lastCh(head));
    if (last === "르" && prev && REU_REGULAR.indexOf(stem.slice(-2)) < 0) {
      // 르 불규칙: 고르 → 골라, 흐르 → 흘러
      const bright = prev.v === J.A || prev.v === J.O;
      return init(head) + com({ c: prev.c, v: prev.v, t: T.L }) + (bright ? "라" : "러");
    }
    const bright = !!prev && (prev.v === J.A || prev.v === J.O);
    return head + com({ c: d.c, v: bright ? J.A : J.EO, t: 0 });
  }
  if (d.v === J.O) return head + com({ c: d.c, v: J.WA, t: 0 });
  if (d.v === J.U) return head + com({ c: d.c, v: J.WO, t: 0 });
  if (d.v === J.OE) return head + com({ c: d.c, v: J.WAE, t: 0 });
  if (d.v === J.I) return head + com({ c: d.c, v: J.YEO, t: 0 });
  if (d.v === J.E || d.v === 16 /* ㅟ */ || d.v === 19 /* ㅢ */) return stem + "어";
  return stem; // ㅏ ㅐ ㅓ ㅕ ㅘ ㅝ ㅙ …: 가 → 가, 내 → 내
}

/** 어간 → '…ㄹ까요'(추측 물음): 하 → 할까요, 있 → 있을까요, 쉽 → 쉬울까요 */
function futQ(stem0: string): string {
  let stem = stem0;
  if (lastCh(stem) === "겠" && stem.length > 1) stem = init(stem);
  const last = lastCh(stem);
  const d = dec(last);
  if (!d) return stem0 + "까요";
  const head = init(stem);
  if (d.t === T.NONE) return head + withJong(last, T.L) + "까요";
  if (d.t === T.L) return stem + "까요";
  if (d.t === T.B && endsWithAny(stem, B_IRREG)) return head + com({ c: d.c, v: d.v, t: 0 }) + "울까요";
  if (d.t === T.D && endsWithAny(stem, D_IRREG)) return head + withJong(last, T.L) + "을까요";
  if (d.t === T.S && endsWithAny(stem, S_IRREG)) return head + com({ c: d.c, v: d.v, t: 0 }) + "을까요";
  return stem + "을까요";
}

/* 읽을 때 마지막 소리에 받침이 있는지(이에요/예요 고르기). 수식·숫자·영문자도 읽는 소리로 따져요. */
const DIGIT_JONG = [true, true, false, true, false, false, true, true, true, false]; // 영 일 이 삼 사 오 육 칠 팔 구
const GREEK_JONG: Record<string, boolean> = { epsilon: true, varepsilon: true, ell: true };
export function endsWithBatchim(raw: string): boolean {
  let s = String(raw || "");
  for (let guard = 0; guard < 20; guard++) {
    s = s.replace(/(\s|\\[,;:!]|\\ |\\quad|\\qquad|\\right|\\big|\\Big|\*|_)+$/, "");
    if (!s) return true;
    const fr = s.match(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{[^{}]*\}$/);
    if (fr) {
      s = fr[1]; // 3분의 1 → 분자 쪽 소리로 끝나요
      continue;
    }
    const tx = s.match(/\\(?:text|mathrm|textbf|mathbf|operatorname)\s*\{([^{}]*)\}$/);
    if (tx) {
      s = tx[1];
      continue;
    }
    const ch = lastCh(s);
    if (ch === "}" || ch === "]" || ch === ")" || ch === "|" || ch === "’" || ch === "”" || ch === "'" || ch === '"') {
      s = init(s);
      continue;
    }
    break;
  }
  if (!s) return true;
  const ch = lastCh(s);
  if (isHangul(ch)) {
    const d = dec(ch);
    return !!d && d.t !== 0;
  }
  const cc = ch.charCodeAt(0);
  if (cc >= 0x2460 && cc <= 0x2473) return endsWithBatchim(String(cc - 0x2460 + 1)); // ①~⑳ 은 숫자로 읽어요
  if (ch === "%" || /\\%$/.test(s)) return false; // 퍼센트
  if (/(\\circ|°)$/.test(s)) return false; // 도
  const num = s.match(/(\d[\d,]*)(\.(\d+))?$/);
  if (num) {
    if (num[3]) return DIGIT_JONG[Number(lastCh(num[3]))];
    const digits = num[1].replace(/,/g, "");
    if (/0$/.test(digits)) return true; // 영·십·백·천·만·억 모두 받침이 있어요
    return DIGIT_JONG[Number(lastCh(digits))];
  }
  const cmd = s.match(/\\([A-Za-z]+)$/);
  if (cmd) return !!GREEK_JONG[cmd[1]];
  if (/[A-Za-z]$/.test(s)) return /[lmnrLMNR]$/.test(s); // 엘·엠·엔·알
  return true;
}

/** 보호 구간: 수식·따옴표·코드 */
interface Guard {
  a: number; // 시작(구분자 포함)
  b: number; // 끝(구분자 다음 자리)
  kind: "math" | "quote" | "code";
  inner: string;
}
const QUOTE_PAIRS: Record<string, string> = { "‘": "’", "“": "”", "「": "」", "『": "』", "'": "'", '"': '"' };

export function guardRanges(s: string): Guard[] {
  const out: Guard[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s.charAt(i);
    if (ch === "\\" && s.charAt(i + 1) === "$") {
      i += 2;
      continue;
    }
    if (ch === "$") {
      const dbl = s.charAt(i + 1) === "$";
      const open = dbl ? 2 : 1;
      let j = i + open;
      let end = -1;
      while (j < s.length) {
        if (s.charAt(j) === "\\") {
          j += 2;
          continue;
        }
        if (s.charAt(j) === "$" && (!dbl || s.charAt(j + 1) === "$")) {
          end = j;
          break;
        }
        j++;
      }
      if (end < 0) {
        i += open;
        continue;
      }
      out.push({ a: i, b: end + open, kind: "math", inner: s.slice(i + open, end) });
      i = end + open;
      continue;
    }
    if (ch === "`") {
      const end = s.indexOf("`", i + 1);
      if (end > 0) {
        out.push({ a: i, b: end + 1, kind: "code", inner: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    const close = QUOTE_PAIRS[ch];
    if (close) {
      // ASCII 작은따옴표가 낱말 사이에 끼인 경우(it's)는 따옴표가 아니에요
      const end = s.indexOf(close, i + 1);
      if (end > 0) {
        out.push({ a: i, b: end + 1, kind: "quote", inner: s.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

const guardAt = (gs: Guard[], pos: number): Guard | null => {
  for (const g of gs) if (pos >= g.a && pos < g.b) return g;
  return null;
};

/** 낱말 바로 앞(띄어쓰기·굵게 표시 건너뜀) 소리에 받침이 있는지 */
function prevBatchim(s: string, gs: Guard[], pos: number): boolean {
  let k = pos - 1;
  while (k >= 0 && /[\s*_]/.test(s.charAt(k))) k--;
  if (k < 0) return true;
  const g = guardAt(gs, k);
  if (g) return endsWithBatchim(g.inner);
  const ch = s.charAt(k);
  if (ch === ")") {
    const open = s.lastIndexOf("(", k);
    if (open > 0 && isHangul(s.charAt(open - 1))) return endsWithBatchim(s.charAt(open - 1)); // 명제(…)이다 → '제'
    if (open >= 0) return endsWithBatchim(s.slice(open + 1, k));
  }
  let st = k;
  while (st > 0 && !/\s/.test(s.charAt(st - 1)) && !guardAt(gs, st - 1)) st--;
  return endsWithBatchim(s.slice(st, k + 1));
}

/** 받침에 맞는 '이에요/예요'(것 → 거예요) */
function copula(base: string, batchim: boolean): string {
  if (base && lastCh(base) === "것") return init(base) + "거예요";
  return base + (batchim ? "이에요" : "예요");
}

/**
 * 해라체로 끝나는 낱말 하나를 해요체로(바꿀 수 없으면 null).
 * @param w      문장 끝 낱말(한글만)
 * @param punct  뒤에 오는 문장부호("." "?" "!" 또는 "")
 * @param prevB  낱말이 '이다/인가' 처럼 앞말 없이 시작할 때, 앞소리의 받침 유무
 */
export function haeyoWord(w: string, punct: string, prevB: boolean): string | null {
  if (!w) return null;
  const n = w.length;
  const end2 = w.slice(-2);
  // ── 시키는 말 ──
  if (end2 === "시오" && n >= 3) {
    let stem = w.slice(0, n - 2);
    if (lastCh(stem) === "으" && stem.length >= 2 && (dec(lastCh(init(stem))) || { t: 0 }).t !== 0) stem = init(stem);
    if (stem === "보") return "보세요";
    if (stem.slice(-2) === "보이") return init(init(stem)) + "보여 주세요";
    if (lastCh(stem) === "보" && stem.length >= 2) return init(stem) + "보세요"; // 찾아보시오 → 찾아보세요
    return aeoForm(stem) + " 보세요";
  }
  if (w.slice(-3) === "하여라") return aeoForm(w.slice(0, n - 3) + "하") + " 보세요";
  if (w.slice(-3) === "보아라") return w.slice(0, n - 3) + "보세요";
  // ── 함께하자는 말 ──
  if (lastCh(w) === "자" && punct !== "?" && (end2 === "보자" || end2 === "하자" || end2 === "넣자" || end2 === "두자" || end2 === "세자")) {
    return aeoForm(w.slice(0, n - 1)) + "요";
  }
  // ── 묻는 말 ──
  if (lastCh(w) === "까" && n >= 2) {
    const d = dec(w.charAt(n - 2));
    if (d && d.t === T.L) return w + "요"; // 할까 · 일까 · 같을까
    return null;
  }
  if (lastCh(w) === "가" && n >= 2 && punct !== ".") {
    if (end2 === "는가") {
      if (n === 2) return null;
      return futQ(restoreLieul(w.slice(0, n - 2)));
    }
    if (end2 === "인가") return w.slice(0, n - 2) + "일까요";
    if (end2 === "은가" && n >= 3) return futQ(w.slice(0, n - 2));
    const s = w.charAt(n - 2);
    const d = dec(s);
    if (d && d.t === T.N) return futQ(w.slice(0, n - 2) + com({ c: d.c, v: d.v, t: 0 })); // 다른가 → 다를까요, 필요한가 → 필요할까요
    return null;
  }
  // ── 서술하는 말(…다) ──
  if (lastCh(w) !== "다" || n < 2) return null;
  if (punct === "?") return null;
  if (w === "는다") return "늘어요";
  if (end2 === "이다") return copula(w.slice(0, n - 2), n === 2 ? prevB : endsWithBatchim(w.charAt(n - 3)));
  if (w.slice(-3) === "아니다") return w.slice(0, n - 3) + "아니에요";
  if (w.slice(-3) === "입니다") return null; // 이미 높임말
  if (end2 === "니다") return null;
  if (end2 === "는다") return aeoForm(w.slice(0, n - 2)) + "요";
  const s = w.charAt(n - 2);
  const d = dec(s);
  if (!d) return null;
  const head = w.slice(0, n - 2);
  if (d.t === T.SS) {
    // 했다 · 있었다 · 하였다 → …어요
    const base = w.slice(0, n - 1);
    return (base.slice(-2) === "하였" ? base.slice(0, base.length - 2) + "했" : base) + "어요";
  }
  if (d.t === T.N) {
    // 현재형 ㄴ다: 한다 → 해요, 만든다 → 만들어요, 나온다 → 나와요
    const stem = restoreLieul(head + com({ c: d.c, v: d.v, t: 0 }));
    return aeoForm(stem) + "요";
  }
  const stem = w.slice(0, n - 1);
  if (s === "하") return aeoForm(stem) + "요"; // 필요하다 · 분명하다(형용사)
  if (endsWithAny(stem, ADJ_STEMS)) return aeoForm(stem) + "요";
  return null; // 먹다 · 바다 처럼 기본형이나 이름일 수 있어 그대로 둬요
}

/** 이 자리(문장 끝) 뒤가 문장 끝으로 볼 수 있는지 */
function sentenceEndAfter(s: string, j: number): { punct: string } | null {
  const ch = s.charAt(j);
  if (ch === "." || ch === "?" || ch === "!") {
    const nx = s.charAt(j + 1);
    if (nx === "" || /[\s)\]」』’”'"①-⑳]/.test(nx)) return { punct: ch };
    return null;
  }
  if (ch === ")" && s.lastIndexOf("(", j) >= 0) return { punct: "." }; // (소수로 답하시오) · (중앙값은 변한다)
  if (j >= s.length) return { punct: "" };
  // 줄바꿈 바로 앞이나, 문장 끝 괄호 닫기 직전(…변한다) 은 바꾸지 않아요(애매해요)
  if (ch === "\n") return { punct: "" };
  return null;
}

export interface HaeyoChange {
  from: string;
  to: string;
  at: number; // 원문에서 바뀐 자리
}

/**
 * 글 하나의 문장 끝 해라체를 해요체로 바꿔요. 수식·따옴표·코드 안은 그대로예요.
 * @param opts.bare  문장부호 없이 글이 끝나도 바꿀지(보기 choices 는 true). 기본 true
 */
export function haeyoText(text: string, opts?: { bare?: boolean; changes?: HaeyoChange[] }): string {
  if (typeof text !== "string" || !text) return text;
  const bare = !opts || opts.bare !== false;
  const gs = guardRanges(text);
  const re = /[가-힣]+/g;
  const edits: { a: number; b: number; to: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const a = m.index;
    const b = a + m[0].length;
    if (guardAt(gs, a)) continue;
    const endInfo = sentenceEndAfter(text, b);
    if (!endInfo) continue;
    if (endInfo.punct === "") {
      if (!bare) continue;
      // 문장부호 없이 끝나는 보기: 띄어 쓴 문장일 때만(낱말 하나짜리 보기는 그대로)
      if (b < text.length && text.charAt(b) !== "\n") continue;
      // ('4이다' · '동점이다' 처럼 '이다' 로 끝나는 보기는 낱말 하나여도 바꿔요 — 같은 문제의 다른 보기와 말투를 맞춰요)
      if (!/\s/.test(text.slice(0, a).replace(/^\s+/, "")) && !/(이다|였다)$/.test(m[0])) continue;
      if (/,\s*[가-힣]+$/.test(text.slice(0, b))) continue; // '고양이, 생선, 먹다' 같은 낱말 나열
    }
    const to = haeyoWord(m[0], endInfo.punct, prevBatchim(text, gs, a));
    if (to && to !== m[0]) edits.push({ a: a, b: b, to: to });
  }
  if (!edits.length) return text;
  let out = text;
  for (let k = edits.length - 1; k >= 0; k--) {
    const e = edits[k];
    if (opts && opts.changes) opts.changes.unshift({ from: text.slice(e.a, e.b), to: e.to, at: e.a });
    out = out.slice(0, e.a) + e.to + out.slice(e.b);
  }
  return out;
}

/** 문제 하나(prompt·choices·hints·solution)를 해요체로. 정답(answer)·종류·id 는 그대로예요. 새 객체를 돌려줘요 */
export function haeyoQuestion<Q>(q: Q, changes?: HaeyoChange[]): Q {
  if (!isObj(q)) return q;
  const src = q as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) out[k] = src[k];
  const one = (v: unknown): unknown => (typeof v === "string" ? haeyoText(v, { changes: changes }) : v);
  if (typeof src.prompt === "string") out.prompt = one(src.prompt);
  if (typeof src.solution === "string") out.solution = one(src.solution);
  if (Array.isArray(src.choices)) out.choices = src.choices.map(one);
  if (Array.isArray(src.hints)) out.hints = src.hints.map(one);
  return out as unknown as Q;
}

/** 레슨(practice)·단원(test) 문서 안 모든 문제에 해요체 규칙을 적용해요(새 객체) */
export function haeyoDoc<T>(doc: T, changes?: HaeyoChange[]): T {
  if (!isObj(doc)) return doc;
  const src = doc as unknown as Record<string, unknown>;
  const hasP = Array.isArray(src.practice);
  const hasT = Array.isArray(src.test);
  if (!hasP && !hasT) return doc;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) out[k] = src[k];
  if (hasP) out.practice = (src.practice as unknown[]).map((q) => haeyoQuestion(q, changes));
  if (hasT) out.test = (src.test as unknown[]).map((q) => haeyoQuestion(q, changes));
  return out as unknown as T;
}

/** 해라체로 남은 문장 끝(수식·따옴표 밖). check-content·시험이 써요 */
export const HAERA_LEFT = /(한다|는가|인가|이다)[.?]|하시오|하여라/;
export function haeraLeft(text: string): string[] {
  if (typeof text !== "string" || !text) return [];
  const gs = guardRanges(text);
  let plain = "";
  let pos = 0;
  for (const g of gs) {
    plain += text.slice(pos, g.a) + " ";
    pos = g.b;
  }
  plain += text.slice(pos);
  const out: string[] = [];
  const re = /[가-힣]*(?:(?:한다|는가|인가|이다)[.?]|하시오|하여라)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plain))) out.push(m[0]);
  return out;
}
