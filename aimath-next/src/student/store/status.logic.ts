// 읽음·레슨 완료·숙달·단원 배지 계산. 순수 함수(DOM·저장소 없음).
//
// 읽음(소제목 하나)
//   소제목의 마지막 카드까지 넘겨 지나가고(seen) + 그 소제목 끝 확인 문제(plan.sectionChecks[i])를 모두 풀어 봤을 때.
//   끝 확인 문제가 없는 소제목은 끝까지 지나가기만 하면 읽음이에요. 펼치기·열기만으로는 읽음이 아니에요.
//   한 번 읽음이 되면 그대로 남아요.
//
// 레슨 완료(옛 /aimath 와 같은 기준)
//   개념 소제목을 모두 읽음 + 기본 문제(group 에 '실력'·'도전'이 없는 문제)를 모두 풀어 봄(맞히거나 풀이를 봄)
//   + 그중 60% 이상(올림) 맞힘. 풀이를 본 뒤 맞힌 문제는 '풀어 봄'으로는 세지만 '맞힘'으로는 세지 않아요.
//
// 숙달 4단계: 0 시작 전 · 1 배우는 중 · 2 완료 · 3 숙달
//   숙달 = 완료 + 기본 문제 80% 이상 맞힘 + 이 레슨 문제 가운데 오답노트 '아직' 칸이 없음.
import type { LessonIndex, QMap, UnitIndex } from "../../shared/contracts.ts";
import { countOf, isTried } from "./record.logic.ts";
import { noteState } from "./review.logic.ts";

export const PASS_RATE = 0.6;
export const MASTER_RATE = 0.8;

/** 소제목 i 를 읽음으로 셀 수 있나 */
export function sectionDone(i: number, seen: readonly number[], checks: readonly (readonly string[])[] | undefined, q: QMap): boolean {
  if (seen.indexOf(i) < 0) return false;
  const ids = checks && checks[i] ? checks[i] : [];
  for (const id of ids) if (!isTried(q[id])) return false;
  return true;
}

/**
 * 읽음 목록을 새로 맞춰요. 이미 읽음인 것은 남기고, 지나간 소제목 가운데 조건을 채운 것을 더해요.
 * 바뀐 게 없으면 prev 를 그대로(같은 배열) 돌려줘요 — 저장을 건너뛸 수 있게.
 */
export function settleRead(
  prev: readonly number[] | undefined,
  seen: readonly number[] | undefined,
  checks: readonly (readonly string[])[] | undefined,
  q: QMap,
  sectionCount: number,
): number[] {
  const cur = (prev || []).filter((i) => Number.isInteger(i) && i >= 0 && i < sectionCount);
  let changed = cur.length !== (prev || []).length;
  for (const i of seen || []) {
    if (i < 0 || i >= sectionCount || cur.indexOf(i) >= 0) continue;
    if (sectionDone(i, seen || [], checks, q)) {
      cur.push(i);
      changed = true;
    }
  }
  if (!changed && prev) return prev as number[];
  return cur.sort((a, b) => a - b);
}

type LMeta = Pick<LessonIndex, "id" | "sections" | "basicIds">;

export interface LessonStatus {
  basicIds: string[];
  basic: { total: number; tried: number; done: number; pct: number };
  sectionsRead: number;
  sectionsTotal: number;
  allRead: boolean;
  allTried: boolean;
  /** 맞혀야 하는 기본 문제 수(60% 올림) */
  need: number;
  passed: boolean;
  complete: boolean;
  /** 아무것도 안 했으면 false */
  started: boolean;
}

export function lessonStatus(meta: LMeta, q: QMap, read: Record<string, number[]> | undefined, seen?: Record<string, number[]>): LessonStatus {
  const basicIds = meta.basicIds.slice();
  const c = countOf(basicIds, q);
  const sectionsTotal = meta.sections.length;
  const rl = (read && read[meta.id]) || [];
  const uniq: number[] = [];
  for (const i of rl) if (Number.isInteger(i) && i >= 0 && i < sectionsTotal && uniq.indexOf(i) < 0) uniq.push(i);
  const sectionsRead = uniq.length;
  const allRead = sectionsRead >= sectionsTotal;
  const allTried = c.tried >= c.total;
  const need = Math.ceil(c.total * PASS_RATE);
  const passed = c.total > 0 && c.ok >= need;
  const sl = (seen && seen[meta.id]) || [];
  return {
    basicIds,
    basic: { total: c.total, tried: c.tried, done: c.ok, pct: c.total ? Math.round((c.ok / c.total) * 100) : 0 },
    sectionsRead,
    sectionsTotal,
    allRead,
    allTried,
    need,
    passed,
    complete: allRead && allTried && passed,
    started: sectionsRead > 0 || sl.length > 0 || c.tried > 0,
  };
}

export type Mastery = 0 | 1 | 2 | 3;
export const MASTERY_LABEL: Record<Mastery, string> = { 0: "시작 전", 1: "배우는 중", 2: "완료", 3: "숙달" };

type LMetaQ = LMeta & Pick<LessonIndex, "qids">;

export function lessonMastery(meta: LMetaQ, q: QMap, read: Record<string, number[]> | undefined, seen?: Record<string, number[]>): Mastery {
  const st = lessonStatus(meta, q, read, seen);
  let anyTried = st.started;
  if (!anyTried) for (const id of meta.qids) if (isTried(q[id])) anyTried = true;
  if (!st.complete) return anyTried ? 1 : 0;
  if (st.basic.total && st.basic.done / st.basic.total < MASTER_RATE) return 2;
  for (const id of meta.qids) if (noteState(q[id]) === "todo") return 2;
  return 3;
}

/** 레슨 진행 막대(0~100). 읽음 절반 + 기본 문제 풀어 봄 절반 */
export function lessonPercent(st: LessonStatus): number {
  if (st.complete) return 100;
  const r = st.sectionsTotal ? st.sectionsRead / st.sectionsTotal : 1;
  const t = st.basic.total ? st.basic.tried / st.basic.total : 1;
  return Math.min(99, Math.round((r * 0.5 + t * 0.5) * 100));
}

export type UnitBadge = null | "done" | "star";
export const UNIT_BADGE_LABEL: Record<"done" | "star", string> = { done: "단원 완료", star: "단원 마무리 도전 통과" };

export interface UnitStatus {
  lessons: number;
  done: number;
  /** 다음에 할 레슨(완료하지 않은 첫 레슨, 모두 끝났으면 null) */
  next: string | null;
  percent: number;
  test: { total: number; tried: number; ok: number };
  /** done: 레슨을 모두 완료, star: 거기에 단원 마무리 도전을 모두 풀어 보고 60% 이상 맞힘 */
  badge: UnitBadge;
}

export function unitStatus(
  unit: Pick<UnitIndex, "lessonIds" | "testIds">,
  lessons: Record<string, LMeta>,
  q: QMap,
  read: Record<string, number[]> | undefined,
): UnitStatus {
  let done = 0;
  let next: string | null = null;
  let pctSum = 0;
  for (const lid of unit.lessonIds) {
    const m = lessons[lid];
    if (!m) continue;
    const st = lessonStatus(m, q, read);
    if (st.complete) done++;
    else if (next === null) next = lid;
    pctSum += lessonPercent(st);
  }
  const n = unit.lessonIds.length;
  const t = countOf(unit.testIds, q);
  let badge: UnitBadge = null;
  if (n > 0 && done === n) {
    badge = "done";
    if (t.total > 0 && t.tried >= t.total && t.ok >= Math.ceil(t.total * PASS_RATE)) badge = "star";
  }
  return { lessons: n, done, next, percent: n ? Math.round(pctSum / n) : 0, test: { total: t.total, tried: t.tried, ok: t.ok }, badge };
}

/** 전체 요약(내 기록·홈) */
export function overall(lessons: Record<string, LMeta>, order: readonly string[], q: QMap, read: Record<string, number[]> | undefined) {
  let complete = 0;
  for (const lid of order) if (lessons[lid] && lessonStatus(lessons[lid], q, read).complete) complete++;
  let ok = 0;
  let tried = 0;
  for (const id of Object.keys(q)) {
    if (q[id].ok) ok++;
    if (isTried(q[id])) tried++;
  }
  return { lessons: order.length, complete, ok, tried };
}
