// 학생 답 정리와 채점. DOM 없이 순수 함수로만 써요.
// 숫자 답에서 받아 주는 것
//  - 전각 숫자·기호(３．５, －２), 유니코드 마이너스(−, –, —, ‐, ﹣)
//  - 분수: 3/4, -3/4, 1 1/2(대분수), ½·1½ 같은 분수 글자, \frac{3}{4}
//  - 'x=3', 'y = -2', '답: 3', '약 3.14', '≈ 0.67' 처럼 앞에 붙은 말
//  - 뒤에 붙은 단위(문제 unit 또는 '명', '개', 'cm' 같은 글자), 천 단위 쉼표(1,200)
//  - 퍼센트: unit 이 '%' 면 '20' 과 '20%' 를 같게, 아니면 '62%' 를 0.62 로도 맞춰 봐요
// 분수 = 소수: 2/3 는 0.6667(허용 오차 0.001)과 같다고 봐요. 허용 오차가 없으면 아주 작은 오차(1e-9 비율)만 허용해요.

import type { LQuestion } from "./types.ts";

const VULGAR: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4, "⅕": 1 / 5, "⅖": 2 / 5, "⅗": 3 / 5, "⅘": 4 / 5,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅐": 1 / 7, "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8, "⅑": 1 / 9, "⅒": 1 / 10,
};
const VULGAR_RE = /(\d+)?\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])/g;

/**
 * 답 글자를 비교하기 쉬운 꼴로 정리해요(채점 전 단계, 화면 표시용 아님).
 * 전각→반각, 마이너스 통일, 분수 글자 풀기, 앞말(x=, 답:, 약) 떼기, 공백 정리.
 */
export function normalizeAnswer(raw: string): string {
  let s = String(raw == null ? "" : raw);
  // 분수 글자(½)는 NFKC 가 '1⁄2' 로 바꾸면서 대분수 1½ 이 '11⁄2' 가 되므로 먼저 숫자로 풀어요.
  s = s.replace(VULGAR_RE, (_m, whole: string | undefined, f: string) => {
    const v = (whole ? Number(whole) : 0) + VULGAR[f];
    return " " + String(v);
  });
  s = s.normalize("NFKC");
  s = s.replace(/[−‒–—―‐‑﹣]/g, "-");
  s = s.replace(/[⁄∕÷]/g, "/");
  s = s.replace(/[   　]/g, " ");
  s = s.replace(/\$/g, "");
  s = s.replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "$1/$2");
  s = s.replace(/\\(?:left|right)/g, "");
  s = s.trim();
  // 앞에 붙은 말: '정답:', '답 :', '약', '≈', '='
  s = s.replace(/^(?:정답|답)\s*[:：은는]?\s*/, "");
  s = s.replace(/^[A-Za-z가-힣][A-Za-z0-9_가-힣']*\s*\(?[A-Za-z0-9]*\)?\s*=\s*/, "");
  s = s.replace(/^(?:약|대략|≈|=)\s*/, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

export interface ParsedNumber {
  value: number;
  /** 입력 끝에 % 가 붙어 있었는지 */
  percent: boolean;
}

/** 숫자 답을 읽어요. 읽을 수 없으면 null. */
export function parseAnswerNumber(raw: string, unit?: string): ParsedNumber | null {
  let s = normalizeAnswer(raw);
  if (!s) return null;
  const u = unit ? unit.normalize("NFKC").trim() : "";
  if (u && s.endsWith(u)) s = s.slice(0, s.length - u.length).trim();
  if (u && s.endsWith(u.replace(/\s+/g, ""))) s = s.slice(0, s.length - u.replace(/\s+/g, "").length).trim();
  let percent = false;
  if (/%$/.test(s)) {
    percent = true;
    s = s.slice(0, -1).trim();
  } else {
    // 뒤에 붙은 단위 글자(명, 개, cm, °, 만 원 …)는 떼요.
    s = s.replace(/\s*(?:[가-힣]+(?:\s[가-힣]+)?|[a-zA-Z]{1,3}|°)$/, "").trim();
  }
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1).trim();
  if (/,/.test(s)) {
    if (!/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return null;
    s = s.replace(/,/g, "");
  }
  const NUM = "(?:\\d+\\.?\\d*|\\.\\d+)";
  let m = s.match(new RegExp("^([+-]?)(\\d+) (\\d+)/(\\d+)$"));
  if (m) {
    const d = Number(m[4]);
    if (d === 0) return null;
    const v = Number(m[2]) + Number(m[3]) / d;
    return { value: m[1] === "-" ? -v : v, percent };
  }
  // ½ 를 풀면서 생긴 '1 0.5' 같은 꼴(대분수)
  m = s.match(new RegExp("^([+-]?)(\\d+) (0\\.\\d+)$"));
  if (m) {
    const v = Number(m[2]) + Number(m[3]);
    return { value: m[1] === "-" ? -v : v, percent };
  }
  s = s.replace(/\s+/g, "");
  m = s.match(new RegExp("^([+-]?" + NUM + ")/([+-]?" + NUM + ")$"));
  if (m) {
    const d = Number(m[2]);
    if (d === 0 || !isFinite(d)) return null;
    return { value: Number(m[1]) / d, percent };
  }
  if (new RegExp("^[+-]?" + NUM + "(?:e[+-]?\\d+)?$", "i").test(s)) {
    const v = Number(s);
    return isFinite(v) ? { value: v, percent } : null;
  }
  return null;
}

export function withinTolerance(value: number, answer: number, tolerance?: number): boolean {
  const tol = tolerance != null && tolerance >= 0 ? tolerance : 1e-9 * Math.max(1, Math.abs(answer));
  // 부동소수 오차(0.1+0.2) 만큼은 조금 더 봐줘요.
  return Math.abs(value - answer) <= tol + 1e-12 * Math.max(1, Math.abs(answer));
}

export type CheckStatus = "correct" | "wrong" | "invalid" | "self";

export interface CheckResult {
  status: CheckStatus;
  /** 숫자 문제에서 읽은 값 */
  value?: number;
}

/** 학생이 낸 답: choice 는 보기 번호(0부터), ox 는 true/false, number 는 입력 글자. open 은 스스로 채점이에요. */
export type AnswerInput = number | boolean | string | null | undefined;

export function checkAnswer(q: LQuestion, input: AnswerInput): CheckResult {
  switch (q.type) {
    case "choice": {
      const n = typeof input === "number" ? input : typeof input === "string" && /^\d+$/.test(input.trim()) ? Number(input.trim()) : NaN;
      if (!isFinite(n) || n < 0 || n >= q.choices.length || n % 1 !== 0) return { status: "invalid" };
      return { status: n === q.answer ? "correct" : "wrong" };
    }
    case "ox": {
      let b: boolean | null = null;
      if (typeof input === "boolean") b = input;
      else if (typeof input === "string") {
        const t = input.normalize("NFKC").trim().toUpperCase();
        if (t === "O" || t === "○" || t === "참" || t === "TRUE") b = true;
        else if (t === "X" || t === "×" || t === "거짓" || t === "FALSE") b = false;
      }
      if (b === null) return { status: "invalid" };
      return { status: b === q.answer ? "correct" : "wrong" };
    }
    case "number": {
      if (typeof input === "number") {
        if (!isFinite(input)) return { status: "invalid" };
        return { status: withinTolerance(input, q.answer, q.tolerance) ? "correct" : "wrong", value: input };
      }
      if (typeof input !== "string") return { status: "invalid" };
      const p = parseAnswerNumber(input, q.unit);
      if (!p) return { status: "invalid" };
      const unitIsPercent = !!q.unit && q.unit.trim() === "%";
      const cands = p.percent && !unitIsPercent ? [p.value / 100, p.value] : [p.value];
      for (const c of cands) if (withinTolerance(c, q.answer, q.tolerance)) return { status: "correct", value: c };
      return { status: "wrong", value: cands[0] };
    }
    case "open":
      return { status: "self" };
  }
}
