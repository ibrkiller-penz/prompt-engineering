// 진리표 (React 없음)

export const not = (p: boolean): boolean => !p;
export const and = (p: boolean, q: boolean): boolean => p && q;
export const or = (p: boolean, q: boolean): boolean => p || q;
export const xor = (p: boolean, q: boolean): boolean => p !== q;

export type Notation = "TF" | "10";

export function fmt(v: boolean, mode: Notation): string {
  return mode === "TF" ? (v ? "T" : "F") : v ? "1" : "0";
}

export interface Row {
  p: boolean;
  q: boolean;
  notP: boolean;
  and: boolean;
  or: boolean;
  xor: boolean;
}

export function evalRow(p: boolean, q: boolean): Row {
  return { p, q, notP: not(p), and: and(p, q), or: or(p, q), xor: xor(p, q) };
}

/** 4가지 경우 (TT, TF, FT, FF 순) */
export function truthRows(): Row[] {
  return [
    evalRow(true, true),
    evalRow(true, false),
    evalRow(false, true),
    evalRow(false, false),
  ];
}

export interface PropPair {
  name: string;
  p: string;
  q: string;
  pv: boolean;
  qv: boolean;
}

/** 직접 지은 예시 명제 쌍. 진릿값은 사실에 맞게 고정. */
export const PAIRS: PropPair[] = [
  { name: "고래 · 소수", p: "고래는 포유류이다", q: "7은 소수이다", pv: true, qv: true },
  { name: "삼각형 · 서울", p: "삼각형의 세 내각의 합은 180°이다", q: "서울은 대한민국의 수도이다", pv: true, qv: true },
  { name: "홀수 · 3의 배수", p: "3은 홀수이다", q: "10은 3의 배수이다", pv: true, qv: false },
  { name: "지구 · 달", p: "지구는 태양 둘레를 돈다", q: "달은 스스로 빛을 낸다", pv: true, qv: false },
  { name: "달 · 지구", p: "달은 스스로 빛을 낸다", q: "지구는 태양 둘레를 돈다", pv: false, qv: true },
  { name: "소수 · 서울", p: "9는 소수이다", q: "서울은 대한민국의 수도이다", pv: false, qv: true },
  { name: "참새 · 사각형", p: "참새는 물고기이다", q: "사각형의 변은 5개이다", pv: false, qv: false },
  { name: "얼음 · 부산", p: "얼음은 물에 가라앉는다", q: "부산은 대한민국의 수도이다", pv: false, qv: false },
];

/** 부정문. 문장 끝 '~이다'는 '~이 아니다'로 바꾸지 않고 '~라는 것은 거짓이다'로 만든다(문법 오류 방지). */
export function negSentence(s: string): string {
  return `「${s}」라는 것은 거짓이다`;
}

export interface Combined {
  key: "notP" | "and" | "or" | "xor";
  op: string;
  name: string;
  sentence: string;
  value: boolean;
}

export function combine(pair: PropPair): Combined[] {
  const { p, q, pv, qv } = pair;
  return [
    { key: "notP", op: "~p", name: "NOT(부정)", sentence: negSentence(p), value: not(pv) },
    { key: "and", op: "p∧q", name: "AND(그리고)", sentence: `「${p}」 그리고 「${q}」`, value: and(pv, qv) },
    { key: "or", op: "p∨q", name: "OR(또는)", sentence: `「${p}」 또는 「${q}」`, value: or(pv, qv) },
    { key: "xor", op: "p⊕q", name: "XOR(둘 중 하나만)", sentence: `「${p}」와 「${q}」 중 정확히 하나만 참이다`, value: xor(pv, qv) },
  ];
}

export interface Practice {
  label: string;
  fn: (p: boolean, q: boolean) => boolean;
}

export const PRACTICES: Practice[] = [
  { label: "~(p∧q)", fn: (p, q) => not(and(p, q)) },
  { label: "(p∧q)∨~p", fn: (p, q) => or(and(p, q), not(p)) },
  { label: "p⊕(p∧q)", fn: (p, q) => xor(p, and(p, q)) },
  { label: "~p∨q", fn: (p, q) => or(not(p), q) },
  { label: "~(p∨q)", fn: (p, q) => not(or(p, q)) },
];

/** 4행(TT, TF, FT, FF)의 정답 */
export function practiceAnswers(idx: number): boolean[] {
  return truthRows().map((r) => PRACTICES[idx].fn(r.p, r.q));
}

export type Cell = boolean | null;

/** 칸마다 맞음(true)/틀림(false)/미응답(null) */
export function gradeCells(idx: number, answers: Cell[]): (boolean | null)[] {
  const ans = practiceAnswers(idx);
  return ans.map((a, i) => (answers[i] === null || answers[i] === undefined ? null : answers[i] === a));
}
