// 오늘의 복습(간격 반복)과 오답노트 상태. 순수 함수(DOM 없음).
// 규칙
//  - 틀리거나 풀이를 보면 복습 상자 0단계에 들어가고, 다음 날(1일 뒤) 복습해요.
//  - 복습에서 맞히면 1단계(3일 뒤) → 2단계(7일 뒤) → 3번 연속 맞히면 졸업(3단계).
//  - 복습에서 틀리면 0단계로 돌아가 다음 날 다시 만나요.
//  - 하루에 최대 5문제만 내요(이미 오늘 푼 복습 수만큼 덜 내요).
//  - 날짜는 이 기기의 시간대 기준 '하루'로 세요(자정에 바뀌어요).
import type { QMap, QRec } from "../../shared/contracts.ts";

export type RvStep = 0 | 1 | 2 | 3;
export interface Rv {
  step: RvStep;
  due: number;
}

export const REVIEW_DAYS = [1, 3, 7] as const;
export const REVIEW_MAX_PER_DAY = 5;
export const GRADUATED: RvStep = 3;
const DAY = 24 * 60 * 60 * 1000;

/** 그날 0시(이 기기 시간대) */
export function dayStart(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 0시에서 n일 뒤 0시(서머타임이 있어도 날짜로 셈) */
export function addDays(ms: number, n: number): number {
  const d = new Date(dayStart(ms));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** 날짜 번호(같은 날이면 같은 값) — 하루 복습 수 세기에 써요 */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

/** 상자에 넣기(이미 있어도 0단계·내일로 다시) */
export function enterReview(_prev: Rv | undefined, now: number): Rv {
  return { step: 0, due: addDays(now, REVIEW_DAYS[0]) };
}

/** 복습 화면에서 답했을 때 다음 단계 */
export function reviewAnswer(rv: Rv, correct: boolean, now: number): Rv {
  if (rv.step >= GRADUATED) return rv;
  if (!correct) return { step: 0, due: addDays(now, REVIEW_DAYS[0]) };
  if (rv.step === 2) return { step: GRADUATED, due: 0 };
  const next: 1 | 2 = rv.step === 0 ? 1 : 2;
  return { step: next, due: addDays(now, REVIEW_DAYS[next]) };
}

/** 오늘 복습할 차례인가 */
export const isDue = (r: QRec | undefined, now: number): boolean => !!r && !!r.rv && r.rv.step < GRADUATED && r.rv.due <= now;

/**
 * 오늘의 복습 문제 id(최대 5개에서 오늘 이미 푼 수를 뺀 만큼).
 * 오래 기다린 것 → 낮은 단계 → 먼저 틀린 것 차례.
 * only 를 주면 그 문제들 가운데서만(예: 학생 사이트에 실제로 있는 문제).
 */
export function todayReview(q: QMap, now: number, doneToday = 0, only?: (id: string) => boolean): string[] {
  const room = Math.max(0, REVIEW_MAX_PER_DAY - Math.max(0, doneToday));
  if (!room) return [];
  const ids = Object.keys(q).filter((id) => isDue(q[id], now) && (!only || only(id)));
  ids.sort((a, b) => {
    const ra = q[a].rv as Rv;
    const rb = q[b].rv as Rv;
    return ra.due - rb.due || ra.step - rb.step || (q[a].lastWrong || 0) - (q[b].lastWrong || 0) || (a < b ? -1 : a > b ? 1 : 0);
  });
  return ids.slice(0, room);
}

/** 오늘이 지나고 기다리는 복습 수(홈 '오늘 할 일'용) */
export function dueCount(q: QMap, now: number): number {
  let n = 0;
  for (const id of Object.keys(q)) if (isDue(q[id], now)) n++;
  return n;
}

/** 오답노트 칸: 아직(다시 맞히지 못함) / 복습 중 / 졸업. 상자에 없으면 null */
export type NoteState = "todo" | "reviewing" | "graduated";

export function noteState(r: QRec | undefined): NoteState | null {
  if (!r || !r.rv) return null;
  if (r.rv.step >= GRADUATED) return "graduated";
  // 마지막 제출이 틀림이었거나(t1 == lastWrong), 풀이만 보고 아직 맞히지 못했으면 '아직'
  if (r.lastWrong !== null) return r.t1 > r.lastWrong ? "reviewing" : "todo";
  return r.ok ? "reviewing" : "todo";
}

export interface NoteItem {
  id: string;
  state: NoteState;
  wrong: number;
  lastWrong: number | null;
  due: number;
}

/** 오답노트 목록(최근에 틀린 것부터) */
export function noteList(q: QMap, only?: (id: string) => boolean): NoteItem[] {
  const out: NoteItem[] = [];
  for (const id of Object.keys(q)) {
    if (only && !only(id)) continue;
    const st = noteState(q[id]);
    if (!st) continue;
    const r = q[id];
    out.push({ id, state: st, wrong: r.wrong, lastWrong: r.lastWrong, due: r.rv ? r.rv.due : 0 });
  }
  out.sort((a, b) => (b.lastWrong || 0) - (a.lastWrong || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** 다음 복습까지 남은 날(오늘이면 0) */
export function daysUntil(due: number, now: number): number {
  return Math.max(0, Math.round((dayStart(due) - dayStart(now)) / DAY));
}
