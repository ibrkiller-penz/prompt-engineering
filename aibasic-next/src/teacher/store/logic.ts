// 교사 저장 값(aibn:t1:*)을 고치는 순수 함수(DOM 없음, node --test 로 시험할 수 있어요).
// 흐름(켜기/끄기·분)·문제 바구니·손들기 집계를 바꿀 때 화면 코드는 여기를 거쳐요.
// 학습 기록·판서·모둠 점수는 저장하지 않아요.

/** TeacherData["flow"] 한 칸 */
export interface FlowState {
  off: string[];
  on: string[];
  min: Record<string, number>;
}
/** TeacherData["pick"] 한 칸 */
export interface PickState {
  board: string[];
  exit: string[];
  hw: string[];
}
export type Basket = keyof PickState;
export const BASKETS: Basket[] = ["board", "exit", "hw"];
export const BASKET_LABEL: Record<Basket, string> = { board: "칠판", exit: "끝 확인", hw: "숙제" };
/** 바구니마다 담을 수 있는 최대 수 */
export const BASKET_MAX: Record<Basket, number> = { board: 8, exit: 5, hw: 10 };

export const emptyFlow = (): FlowState => ({ off: [], on: [], min: {} });

function without(arr: readonly string[], id: string): string[] {
  return arr.filter((x) => x !== id);
}

/** 장면 켜기/끄기. 기본값으로 돌아가는 쪽이면 목록에서 지워요. 필수 장면은 끌 수 없어요 */
export function toggleScene(st: FlowState | null | undefined, id: string, on: boolean, opts: { required?: boolean; defaultOn?: boolean } = {}): FlowState {
  const cur = st ? { off: st.off.slice(), on: st.on.slice(), min: { ...st.min } } : emptyFlow();
  if (!on && opts.required) return cur;
  cur.off = without(cur.off, id);
  cur.on = without(cur.on, id);
  // 자동 제안과 같은 값이면 목록에 남기지 않아요
  if (opts.defaultOn !== undefined && on === opts.defaultOn) return cur;
  if (on) cur.on.push(id);
  else cur.off.push(id);
  return cur;
}

/** 0.5분 단위, 0.5~60분 */
export function cleanMin(m: number): number {
  if (!(m > 0)) return 0.5;
  return Math.max(0.5, Math.min(60, Math.round(m * 2) / 2));
}

/** 장면 분 바꾸기(null 이면 자동으로 되돌려요) */
export function setSceneMin(st: FlowState | null | undefined, id: string, min: number | null): FlowState {
  const cur = st ? { off: st.off.slice(), on: st.on.slice(), min: { ...st.min } } : emptyFlow();
  if (min == null) delete cur.min[id];
  else cur.min[id] = cleanMin(min);
  return cur;
}

/** '필수만': 필수가 아닌 장면을 모두 꺼요(분 조절은 지워요) */
export function onlyRequired(scenes: readonly { id: string; required: boolean }[]): FlowState {
  return { off: scenes.filter((s) => !s.required).map((s) => s.id), on: [], min: {} };
}

/** 흐름 상태가 비었는지(저장할 필요가 없는지) */
export function isEmptyFlow(st: FlowState | null | undefined): boolean {
  return !st || (!st.off.length && !st.on.length && !Object.keys(st.min).length);
}

/* ─────────── 문제 바구니 ─────────── */

export function clonePick(p: PickState): PickState {
  return { board: p.board.slice(), exit: p.exit.slice(), hw: p.hw.slice() };
}

/** 문제가 들어 있는 바구니(없으면 null) */
export function basketOf(p: PickState, id: string): Basket | null {
  for (const b of BASKETS) if (p[b].indexOf(id) >= 0) return b;
  return null;
}

/**
 * 바구니에 넣거나 빼요. 한 문제는 바구니 하나에만 들어가요(다른 바구니에서는 빠져요).
 * 이미 그 바구니에 있으면 빼요. 가득 차 있으면 그대로(ok:false).
 */
export function toggleBasket(p: PickState, which: Basket, id: string): { pick: PickState; ok: boolean } {
  const next = clonePick(p);
  if (next[which].indexOf(id) >= 0) {
    next[which] = without(next[which], id);
    return { pick: next, ok: true };
  }
  if (next[which].length >= BASKET_MAX[which]) return { pick: p, ok: false };
  for (const b of BASKETS) next[b] = without(next[b], id);
  next[which].push(id);
  return { pick: next, ok: true };
}

/** 목록 안에서 한 칸 위(-1)·아래(+1)로 */
export function moveItem<T>(arr: readonly T[], i: number, d: -1 | 1): T[] {
  const out = arr.slice();
  const j = i + d;
  if (i < 0 || i >= out.length || j < 0 || j >= out.length) return out;
  const t = out[i];
  out[i] = out[j];
  out[j] = t;
  return out;
}

/** 꺼진 칠판 문제(숙제로 간 것)를 숙제 목록 뒤에 붙여요(겹치지 않게) */
export function homeworkWith(hw: readonly string[], fromOff: readonly string[], exclude: readonly string[] = []): string[] {
  const out = hw.slice();
  for (const id of fromOff) if (out.indexOf(id) < 0 && exclude.indexOf(id) < 0) out.push(id);
  return out;
}

/* ─────────── 손들기 집계 ─────────── */

/** "lid:qid" — results 저장 키 */
export const resultKey = (lid: string, qid: string) => lid + ":" + qid;

export function splitResultKey(k: string): { lid: string; qid: string } | null {
  const i = k.indexOf(":");
  if (i <= 0) return null;
  return { lid: k.slice(0, i), qid: k.slice(i + 1) };
}

/** 수업 기록 카드 저장 키: "반|lid:p" */
export const logKey = (klass: string, lid: string, p: number) => klass + "|" + lid + ":" + p;

/** 기록 카드를 최대 몇 개까지 둘지 */
export const LOG_MAX = 60;

/** 카드 저장: 같은 반·레슨·차시는 덮어쓰고, 60개를 넘으면 오래된 것부터 버려요(새 맵을 돌려줘요) */
export function putLog<T extends { klass: string; lid: string; p: number; ts: number }>(map: Readonly<Record<string, T>>, card: T, max: number = LOG_MAX): Record<string, T> {
  const out: Record<string, T> = { ...map };
  out[logKey(card.klass, card.lid, card.p)] = card;
  const keys = Object.keys(out);
  if (keys.length > max) {
    keys.sort((a, b) => out[a].ts - out[b].ts);
    for (let i = 0; i < keys.length - max; i++) delete out[keys[i]];
  }
  return out;
}

/** 손든 수 한 칸 바꾸기(0~99). n 은 보기 수 */
export function bump(counts: readonly number[] | null | undefined, i: number, d: number, n: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const v = counts && typeof counts[k] === "number" && counts[k] >= 0 ? Math.floor(counts[k]) : 0;
    out.push(v);
  }
  if (i >= 0 && i < n) out[i] = Math.max(0, Math.min(99, out[i] + d));
  return out;
}

export function sum(counts: readonly number[]): number {
  let t = 0;
  for (const c of counts) t += c > 0 ? c : 0;
  return t;
}

/** 막대 길이(%): 가장 큰 값 기준. 모두 0 이면 0 */
export function barPcts(counts: readonly number[]): number[] {
  let m = 0;
  for (const c of counts) if (c > m) m = c;
  return counts.map((c) => (m > 0 ? Math.round((c / m) * 100) : 0));
}

/** 정답률(%) — 정답 칸 / 전체. 아무도 손들지 않았으면 null */
export function correctRate(counts: readonly number[], answer: number): number | null {
  const t = sum(counts);
  if (!t || answer < 0 || answer >= counts.length) return null;
  return Math.round((counts[answer] / t) * 100);
}

/* ─────────── 진도 표시 ─────────── */

export type Mark = "done" | "part" | null;

/** 진도 칸 누를 때: 없음 → 일부 → 끝 → 없음 */
export function cycleMark(m: Mark | undefined): Mark {
  if (!m) return "part";
  if (m === "part") return "done";
  return null;
}

export const MARK_LABEL: Record<"done" | "part" | "none", string> = { done: "끝", part: "진행 중", none: "아직" };

/** 수업 흐름 줄 구분: 같은 종류·같은 제목이 이어지면 "(1/3)" 순번을 붙여요('이어서' 나눔 장면은 칩이 따로 있어 건너뛰어요) */
export function dupTags(scenes: readonly { kind: string; title?: unknown; part?: unknown }[]): string[] {
  const out: string[] = scenes.map(() => "");
  let i = 0;
  while (i < scenes.length) {
    let j = i + 1;
    const key = scenes[i].kind + "|" + String(scenes[i].title || "");
    while (j < scenes.length && scenes[j].kind + "|" + String(scenes[j].title || "") === key) j++;
    if (j - i > 1) for (let k = i; k < j; k++) if (!scenes[k].part) out[k] = "(" + (k - i + 1) + "/" + (j - i) + ")";
    i = j;
  }
  return out;
}
