// 문제 기록 v2(QRec)를 고치는 순수 함수. DOM·저장소 없이 값만 주고받아요(node --test 로 시험).
// 규칙
//  - first: 처음 '제출'했을 때 맞혔는지. 풀이를 먼저 열었으면 false. 아직 안 풀었으면 null.
//  - ok: '맞힘'으로 세는지. 그 자리에서 풀이를 펼친 뒤 맞힌 것은 세지 않지만, 나중에 풀이 없이 다시 맞히면 세요.
//        한 번 얻은 맞힘은 나중에 틀려도 남아요(완료가 흔들리지 않게).
//  - sol: 풀이를 본 적 있음(표시만, 맞힘을 막지 않아요).
//  - wrong·lastWrong: 틀린 횟수와 마지막으로 틀린 때.
//  - hints: 연 힌트 단계(0·1·2 중 가장 큰 값). 힌트를 써도 '처음에 맞힘'은 그대로 셀 수 있어요.
//  - t0: 처음 제출(또는 풀이 열기)한 때, t1: 마지막으로 제출한 때. 힌트만 열었으면 t0 = 0.
//  - 틀리거나 풀이를 보면 복습 상자(rv)에 들어가요(review.logic.ts).
import type { QMap, QRec } from "../../shared/contracts.ts";
import { GRADUATED, REVIEW_DAYS, addDays, enterReview, reviewAnswer } from "./review.logic.ts";

export const emptyRec = (): QRec => ({ first: null, wrong: 0, hints: 0, sol: false, ok: false, lastWrong: null, t0: 0, t1: 0 });

/** 저장소에서 읽은 값이 깨졌거나 옛 모양이어도 QRec 로 고쳐 읽어요 */
export function normRec(v: unknown): QRec {
  const r = emptyRec();
  if (!v || typeof v !== "object") return r;
  const o = v as Record<string, unknown>;
  r.first = o.first === true ? true : o.first === false ? false : null;
  r.wrong = typeof o.wrong === "number" && o.wrong > 0 ? Math.floor(o.wrong) : 0;
  r.hints = o.hints === 2 ? 2 : o.hints === 1 ? 1 : 0;
  r.sol = o.sol === true;
  r.ok = o.ok === true;
  r.lastWrong = typeof o.lastWrong === "number" ? o.lastWrong : null;
  r.t0 = typeof o.t0 === "number" ? o.t0 : 0;
  r.t1 = typeof o.t1 === "number" ? o.t1 : 0;
  const rv = o.rv as { step?: unknown; due?: unknown } | undefined;
  if (rv && typeof rv === "object" && typeof rv.due === "number") {
    const st = rv.step === 1 || rv.step === 2 || rv.step === 3 ? rv.step : 0;
    r.rv = { step: st, due: rv.due };
  }
  return r;
}

/** 풀어 봤나(제출했거나 풀이를 봤나) — 완료 기준의 '풀어 봄' */
export const isTried = (r: QRec | undefined): boolean => !!r && (r.first !== null || r.sol || r.ok || r.wrong > 0);
/** 맞힘으로 세나 */
export const isOk = (r: QRec | undefined): boolean => !!r && r.ok;

export interface AnswerOpts {
  /** 오늘의 복습 화면에서 푼 것이면 true — 복습 단계를 올리거나 처음으로 돌려요 */
  review?: boolean;
  /** 이번 풀이에서 풀이를 먼저 펼쳐 본 뒤 낸 답이면 true — 맞혀도 '맞힘'으로 세지 않고, 복습 단계도 올리지 않아요 */
  afterSolution?: boolean;
}

/** 답을 제출했을 때.
 *  - 맞힘(ok)은 '이번에 풀이를 보지 않고' 맞혔을 때만 켜요. 예전에 풀이를 본 적(sol)이 있어도, 나중에 혼자 맞히면 맞힘이에요.
 *  - sol 은 '풀이를 본 적 있음' 표시로만 남아요(여기서 바꾸지 않아요). */
export function applyAnswer(prev: QRec | undefined, correct: boolean, now: number, opts: AnswerOpts = {}): QRec {
  const r: QRec = prev ? { ...normRec(prev) } : emptyRec();
  const after = !!opts.afterSolution;
  if (r.first === null) r.first = correct && !after && !r.sol;
  if (!r.t0) r.t0 = now;
  r.t1 = now;
  if (correct) {
    if (!after) r.ok = true;
  } else {
    r.wrong += 1;
    r.lastWrong = now;
  }
  // 복습 화면: 혼자 맞히면 다음 단계, 틀리면 처음으로, 풀이를 보고 맞히면 단계는 그대로 두고 내일 다시
  // 그 밖: 틀리면 복습 상자 처음으로, 풀이를 보고 맞혔는데 아직 혼자 맞힌 적이 없으면 상자에 넣어요(맞히면 그대로)
  if (opts.review && r.rv) {
    if (correct && after) r.rv = r.rv.step >= GRADUATED ? r.rv : { step: r.rv.step, due: addDays(now, REVIEW_DAYS[0]) };
    else r.rv = reviewAnswer(r.rv, correct, now);
  } else if (!correct) r.rv = enterReview(r.rv, now);
  else if (after && !r.ok && !r.rv) r.rv = enterReview(r.rv, now);
  return r;
}

/** 힌트를 열었을 때(1 또는 2) */
export function applyHint(prev: QRec | undefined, level: 1 | 2): QRec {
  const r: QRec = prev ? { ...normRec(prev) } : emptyRec();
  if (level > r.hints) r.hints = level;
  return r;
}

/** 풀이를 열었을 때. 아직 제출 전이면 '처음에 맞힘'은 false 가 되고, 복습 상자에 들어가요(이미 맞혔으면 넣지 않아요) */
export function applySolution(prev: QRec | undefined, now: number): QRec {
  const r: QRec = prev ? { ...normRec(prev) } : emptyRec();
  if (r.sol) return r;
  r.sol = true;
  if (r.first === null) r.first = false;
  if (!r.t0) r.t0 = now;
  if (!r.ok) r.rv = enterReview(r.rv, now);
  return r;
}

/** 여러 문제 기록에서 맞힘·풀어 봄 개수 */
export function countOf(ids: readonly string[], q: QMap): { total: number; tried: number; ok: number; first: number } {
  let tried = 0;
  let ok = 0;
  let first = 0;
  for (const id of ids) {
    const r = q[id];
    if (isTried(r)) tried++;
    if (isOk(r)) ok++;
    if (r && r.first === true) first++;
  }
  return { total: ids.length, tried, ok, first };
}
