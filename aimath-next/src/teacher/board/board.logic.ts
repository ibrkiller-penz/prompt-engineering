// 칠판 진행 순수 로직(DOM 없음): 장면별 공개 횟수, 문제 단계, 쪽 나누기, '다음'·'이전' 한 번.
// '다음'은 ① 남은 공개 → ② 남은 쪽(넘친 장면의 "이어서") → ③ 다음 켜진 장면 순서로 써요.
import type { Lesson, Question, Scene } from "../../shared/contracts.ts";

/** 보기 기호(공용 QuestionCard 와 같은 차례) */
export const CHOICE_KEYS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

/* ─────────── 문제 한 개 단계 ─────────── */

/** 문제 공개 단계 이름 */
export type QStage = "hide" | "show" | "hint1" | "hint2" | "answer" | "sol";

export const QSTAGE_LABEL: Record<QStage, string> = {
  hide: "보기 가림",
  show: "보기",
  hint1: "힌트 1",
  hint2: "힌트 2",
  answer: "정답",
  sol: "풀이",
};

/** 문제마다 쓰는 단계: 고르기는 보기 가리기부터, 힌트가 없으면 건너뛰어요 */
export function qStages(q: Pick<Question, "type"> & { hints?: unknown; solution?: unknown }): QStage[] {
  const out: QStage[] = [];
  if (q.type === "choice") out.push("hide");
  out.push("show");
  const hs = Array.isArray(q.hints) ? (q.hints as unknown[]).filter((h) => !!h) : [];
  if (hs.length > 0) out.push("hint1");
  if (hs.length > 1) out.push("hint2");
  out.push("answer");
  if (q.solution) out.push("sol");
  return out;
}

/** 단계 r(0부터)까지 열렸을 때 각 단계가 열렸는지 */
export function stageOpen(stages: readonly QStage[], r: number, st: QStage): boolean {
  const i = stages.indexOf(st);
  return i >= 0 && i <= r;
}

/* ─────────── 장면 공개 횟수 ─────────── */

/** 장면 하나에서 '다음'으로 공개할 수 있는 횟수. 문제는 단계 수 - 1, 먼저 알고 가요는 카드 수(하나씩 뒤집기) */
export function revealMax(scene: Scene, lesson: Lesson | undefined): number {
  if (scene.kind === "problem") {
    const qb = scene.blocks.filter((b) => b.t === "q")[0] as { t: "q"; id: string } | undefined;
    const q = qb && lesson ? lesson.practice.filter((x) => x.id === qb.id)[0] : undefined;
    return q ? qStages(q).length - 1 : 0;
  }
  if (scene.kind === "prereq") {
    let n = 0;
    for (const b of scene.blocks) if (b.t === "term") n++;
    return n;
  }
  return Math.max(0, scene.reveal | 0);
}

/* ─────────── 쪽 나누기(렌더 뒤 실제 높이로) ─────────── */

/**
 * 블록 위치(top·height)로 쪽 시작 위치를 정해요. 한 쪽 높이는 limit(896).
 * 블록 하나가 limit 보다 크면 그 블록에서 쪽을 나눠요(블록 안은 잘리지만 다음 쪽에 이어져요).
 */
export function pageStarts(blocks: readonly { top: number; height: number }[], limit: number): number[] {
  const starts = [0];
  let start = 0;
  for (const b of blocks) {
    const bottom = b.top + b.height;
    if (bottom - start <= limit) continue;
    // 앞 쪽에 다른 내용이 있을 때만 이 블록에서 새 쪽을 열어요(쪽 첫머리 블록이면 그대로 이어서 나눠요)
    if (b.top > start + 48) {
      start = b.top;
      starts.push(start);
    }
    // 블록 하나가 한 쪽보다 크면 limit 씩 나눠요
    while (bottom - start > limit) {
      start += limit;
      starts.push(start);
    }
  }
  return starts;
}

/** 블록 k 의 아래 끝이 보이는 쪽 */
export function pageOfBlock(starts: readonly number[], block: { top: number; height: number }, limit: number): number {
  const bottom = block.top + block.height;
  // 블록이 통째로 들어가는 가장 앞 쪽
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= block.top && bottom - starts[i] <= limit) return i;
  }
  // 한 쪽보다 큰 블록이면 블록이 시작하는 쪽
  let p = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= block.top) p = i;
  return p;
}

/* ─────────── 한 걸음 ─────────── */

export interface Pos {
  /** 장면 위치(전체 목록 안, 0부터) */
  s: number;
  /** 공개한 횟수 */
  r: number;
  /** 쪽(0부터). -1 은 '마지막 쪽'(이전으로 돌아왔을 때 재고 나서 정해요) */
  page: number;
}

export interface StepEnv {
  scenes: readonly Scene[];
  /** 장면 s 의 공개 횟수 */
  max: (s: number) => number;
  /** 지금 장면의 쪽 수(재기 전이면 1) */
  pages: number;
  /** 공개 r 일 때 보여야 하는 쪽(재기 전이면 0) */
  pageForReveal: (r: number) => number;
}

export function firstOn(scenes: readonly Scene[]): number {
  for (let i = 0; i < scenes.length; i++) if (scenes[i].on) return i;
  return 0;
}
export function lastOn(scenes: readonly Scene[]): number {
  for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].on) return i;
  return 0;
}
/** s 가 꺼진 장면이면 뒤쪽 첫 켜진 장면(없으면 앞쪽) */
export function snapOn(scenes: readonly Scene[], s: number): number {
  const k = Math.max(0, Math.min(scenes.length - 1, s));
  if (!scenes.length || scenes[k].on) return k;
  for (let i = k + 1; i < scenes.length; i++) if (scenes[i].on) return i;
  for (let i = k - 1; i >= 0; i--) if (scenes[i].on) return i;
  return k;
}

export function stepNext(pos: Pos, env: StepEnv): { pos: Pos; done: boolean } {
  const max = env.max(pos.s);
  const page = pos.page < 0 ? env.pages - 1 : pos.page;
  if (pos.r < max) {
    const r = pos.r + 1;
    return { pos: { s: pos.s, r, page: Math.max(page, env.pageForReveal(r)) }, done: false };
  }
  if (page < env.pages - 1) return { pos: { s: pos.s, r: pos.r, page: page + 1 }, done: false };
  for (let i = pos.s + 1; i < env.scenes.length; i++) if (env.scenes[i].on) return { pos: { s: i, r: 0, page: 0 }, done: false };
  return { pos: { s: pos.s, r: pos.r, page }, done: true };
}

export function stepPrev(pos: Pos, env: StepEnv): Pos {
  const page = pos.page < 0 ? env.pages - 1 : pos.page;
  if (pos.r > 0) {
    const r = pos.r - 1;
    return { s: pos.s, r, page: Math.min(page, Math.max(0, env.pageForReveal(r))) };
  }
  if (page > 0) return { s: pos.s, r: pos.r, page: page - 1 };
  for (let i = pos.s - 1; i >= 0; i--) if (env.scenes[i].on) return { s: i, r: env.max(i), page: -1 };
  return { s: pos.s, r: 0, page: 0 };
}

/** 진행 레일: 켜진 장면 번호(1부터)와 전체 수 */
export function railInfo(scenes: readonly Scene[], s: number): { n: number; total: number } {
  let n = 0;
  let total = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (!scenes[i].on) continue;
    total++;
    if (i <= s) n = total;
  }
  return { n, total };
}

/** 번호 뽑기: 1..max 에서 빼둔 번호(used)를 뺀 것 가운데 하나. rnd 는 0..1 */
export function drawNumber(max: number, used: readonly number[], rnd: number): number | null {
  const pool: number[] = [];
  for (let i = 1; i <= max; i++) if (used.indexOf(i) < 0) pool.push(i);
  if (!pool.length) return null;
  const k = Math.min(pool.length - 1, Math.floor(rnd * pool.length));
  return pool[k];
}

/** 타이머 표시 mm:ss */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

/* ─────────── 손들기 칸 ─────────── */

/** 손들기 칸 이름(보기 수만큼) */
export function tallyLabels(q: Question): string[] {
  if (q.type === "choice") return q.choices.map((_, i) => CHOICE_KEYS[i] || String(i + 1));
  if (q.type === "ox") return ["O", "X"];
  if (q.type === "number") return ["맞혔어요", "아직이에요"];
  return [];
}

/** 손들기 칸 가운데 정답 칸(없으면 -1) */
export function tallyAnswer(q: Question): number {
  if (q.type === "choice") return q.answer;
  if (q.type === "ox") return q.answer ? 0 : 1;
  if (q.type === "number") return 0;
  return -1;
}

