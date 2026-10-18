// 학생 기록 v2 순수 로직 시험: 문제 기록 · 읽음 · 레슨 완료 · 숙달 · 단원 배지 · 복습 일정 · 백업 왕복 · QR 쿼리
import test from "node:test";
import assert from "node:assert/strict";
import type { QMap, QRec } from "../../src/shared/contracts.ts";
import { applyAnswer, applyHint, applySolution, emptyRec, isOk, isTried, normRec } from "../../src/student/store/record.logic.ts";
import { lessonMastery, lessonStatus, overall, sectionDone, settleRead, unitStatus } from "../../src/student/store/status.logic.ts";
import { addDays, dayStart, noteList, noteState, REVIEW_MAX_PER_DAY, reviewAnswer, todayReview } from "../../src/student/store/review.logic.ts";
import { makeStudentBackup, parseStudentBackup, sanitize, serializeStudentBackup } from "../../src/student/store/backup.logic.ts";
import { expandQid, parseAssignQuery } from "../../src/student/store/assign.logic.ts";
import { S_PREFIX, studentKeyList } from "../../src/shared/storage/keys.ts";

const T0 = new Date(2026, 9, 16, 10, 0, 0).getTime(); // 이 기기 시간대 오전 10시
const DAY = 24 * 60 * 60 * 1000;

/* ─────────── 문제 기록 ─────────── */

test("처음에 맞히면 first·ok 가 true, 틀린 적 없음", () => {
  const r = applyAnswer(undefined, true, T0);
  assert.equal(r.first, true);
  assert.equal(r.ok, true);
  assert.equal(r.wrong, 0);
  assert.equal(r.t0, T0);
  assert.equal(r.t1, T0);
  assert.equal(r.rv, undefined);
});

test("틀린 뒤 맞히면 first=false, ok=true, wrong·lastWrong 기록, 복습 상자에 들어가요", () => {
  let r = applyAnswer(undefined, false, T0);
  assert.equal(r.first, false);
  assert.equal(r.ok, false);
  assert.equal(r.wrong, 1);
  assert.equal(r.lastWrong, T0);
  assert.deepEqual(r.rv, { step: 0, due: addDays(T0, 1) });
  r = applyAnswer(r, true, T0 + 1000);
  assert.equal(r.first, false);
  assert.equal(r.ok, true);
  assert.equal(r.t0, T0);
  assert.equal(r.t1, T0 + 1000);
  assert.equal(r.rv && r.rv.step, 0, "같은 날 맞혀도 복습 단계는 그대로");
});

test("풀이를 본 뒤 맞힌 것은 '맞힘'이 아니지만 '풀어 봄'이에요", () => {
  let r = applySolution(undefined, T0);
  assert.equal(r.sol, true);
  assert.equal(r.first, false);
  assert.ok(isTried(r));
  assert.ok(!isOk(r));
  assert.ok(r.rv, "풀이를 보면 복습 상자에");
  r = applyAnswer(r, true, T0 + 1, { afterSolution: true });
  assert.equal(r.ok, false, "풀이를 펼친 채 맞힌 시도는 맞힘이 아니에요");
  assert.ok(isTried(r));
  // 이미 맞힌 뒤 풀이를 보면 맞힘은 남아요
  let s = applyAnswer(undefined, true, T0);
  s = applySolution(s, T0 + 5);
  assert.equal(s.ok, true);
  assert.equal(s.rv, undefined);
});

test("풀이를 본 적이 있어도 다음 날 혼자(풀이 없이) 맞히면 맞힘이에요. sol 은 '본 적 있음' 표시로 남아요", () => {
  let r = applySolution(undefined, T0);
  r = applyAnswer(r, true, T0 + 1000, { afterSolution: true });
  assert.equal(r.ok, false);
  assert.ok(r.rv, "풀이를 보고 맞힌 문제는 복습 상자에");
  r = applyAnswer(r, true, T0 + DAY, { afterSolution: false });
  assert.equal(r.ok, true, "혼자 맞히면 맞힘");
  assert.equal(r.sol, true, "본 적 있음 표시는 그대로");
  assert.equal(r.first, false, "처음 제출 기록은 바뀌지 않아요");
  // 풀이 없이 처음부터 틀리고, 풀이를 보고 맞히면 여전히 맞힘이 아니에요
  let s = applyAnswer(undefined, false, T0);
  s = applySolution(s, T0 + 1);
  s = applyAnswer(s, true, T0 + 2, { afterSolution: true });
  assert.equal(s.ok, false);
  assert.equal(isTried(s), true);
});

test("복습 화면: 풀이를 보고 맞히면 단계를 올리지 않고 내일 다시, 혼자 맞히면 다음 단계", () => {
  let r = applyAnswer(undefined, false, T0);
  const d1 = T0 + DAY;
  const a = applyAnswer(r, true, d1, { review: true, afterSolution: true });
  assert.deepEqual(a.rv, { step: 0, due: addDays(d1, 1) });
  assert.equal(a.ok, false);
  r = applyAnswer(r, true, d1, { review: true });
  assert.deepEqual(r.rv, { step: 1, due: addDays(d1, 3) });
  // 복습 상자 1단계에서 풀이를 보고 맞히면 1단계 그대로
  const b = applyAnswer(r, true, d1 + 3 * DAY, { review: true, afterSolution: true });
  assert.equal(b.rv && b.rv.step, 1);
});

test("힌트는 가장 큰 단계만 남고, 힌트만 열면 '풀어 봄'이 아니에요", () => {
  let r = applyHint(undefined, 2);
  r = applyHint(r, 1);
  assert.equal(r.hints, 2);
  assert.ok(!isTried(r));
  assert.equal(r.t0, 0);
  r = applyAnswer(r, true, T0);
  assert.equal(r.first, true, "힌트를 써도 처음 제출에 맞히면 first");
});

test("깨진 값도 QRec 로 읽어요", () => {
  assert.deepEqual(normRec(null), emptyRec());
  const r = normRec({ first: "yes", wrong: -3, hints: 7, ok: 1, rv: { step: 9, due: 5 } });
  assert.equal(r.first, null);
  assert.equal(r.wrong, 0);
  assert.equal(r.hints, 0);
  assert.equal(r.ok, false);
  assert.deepEqual(r.rv, { step: 0, due: 5 });
});

/* ─────────── 읽음 · 레슨 완료 ─────────── */

const meta = {
  id: "u9-1",
  sections: [{}, {}, {}] as unknown as import("../../src/shared/contracts.ts").SectionIndex[],
  basicIds: ["a", "b", "c", "d", "e"],
  qids: ["a", "b", "c", "d", "e", "x"],
};
const checks = [["a"], [], ["b"]];
const ok = (t = T0): QRec => applyAnswer(undefined, true, t);
const bad = (t = T0): QRec => applyAnswer(undefined, false, t);

test("읽음 = 마지막 카드를 지나가고 + 끝 확인 문제를 풀어 봄", () => {
  const q: QMap = {};
  assert.equal(sectionDone(0, [], checks, q), false, "지나가지 않음");
  assert.equal(sectionDone(0, [0], checks, q), false, "확인 문제 아직");
  assert.equal(sectionDone(1, [1], checks, q), true, "확인 문제가 없는 소제목");
  q.a = bad();
  assert.equal(sectionDone(0, [0], checks, q), true, "틀려도 풀어 봤으면 읽음");
  const prev: number[] = [];
  const next = settleRead(prev, [0, 1, 2], checks, q, 3);
  assert.deepEqual(next, [0, 1]);
  assert.equal(settleRead(next, [0, 1, 2], checks, q, 3), next, "바뀐 게 없으면 같은 배열");
  q.b = applySolution(undefined, T0);
  assert.deepEqual(settleRead(next, [0, 1, 2], checks, q, 3), [0, 1, 2]);
  assert.deepEqual(settleRead([2, 0, 9], [], checks, {}, 3), [0, 2], "범위 밖 번호는 버리고, 한 번 읽음은 남아요");
});

test("소제목을 펼치기(지나가기)만 해서는 읽음·완료가 되지 않아요", () => {
  const q: QMap = { a: ok(), b: ok(), c: ok(), d: ok(), e: ok() };
  // 끝 확인 문제가 있는 소제목 0·2 에서 확인 문제 기록을 지우면
  const noCheck: QMap = { c: ok(), d: ok(), e: ok() };
  const seen = { "u9-1": [0, 1, 2] };
  assert.deepEqual(settleRead(undefined, [0, 1, 2], checks, noCheck, 3), [1], "확인 문제를 안 풀면 지나가기만으로 읽음 아님");
  assert.equal(lessonStatus(meta, q, {}, seen).complete, false, "read 가 비면 완료 아님");
  assert.equal(lessonStatus(meta, q, { "u9-1": [1] }, seen).allRead, false);
  assert.equal(sectionDone(0, [], checks, q), false, "확인 문제를 풀었어도 마지막 카드를 지나가지 않으면 읽음 아님");
});

test("레슨 완료: 모두 읽음 + 기본 문제 모두 풀어 봄 + 60%(올림) 맞힘, 풀이 본 문제는 맞힘에서 빼요", () => {
  const read = { "u9-1": [0, 1, 2] };
  const q: QMap = { a: ok(), b: ok(), c: bad(), d: applyAnswer(applySolution(undefined, T0), true, T0, { afterSolution: true }), e: bad() };
  let st = lessonStatus(meta, q, read);
  assert.equal(st.need, 3);
  assert.equal(st.allTried, true);
  assert.equal(st.basic.done, 2, "d 는 풀이를 봐서 맞힘이 아니에요");
  assert.equal(st.complete, false);
  q.c = applyAnswer(q.c, true, T0 + 9);
  st = lessonStatus(meta, q, read);
  assert.equal(st.basic.done, 3);
  assert.equal(st.complete, true);
  st = lessonStatus(meta, q, { "u9-1": [0, 1] });
  assert.equal(st.allRead, false);
  assert.equal(st.complete, false);
  const q2: QMap = { a: ok(), b: ok(), c: ok(), d: ok() };
  assert.equal(lessonStatus(meta, q2, read).complete, false, "e 를 아직 안 풀었어요");
});

test("숙달 4단계", () => {
  assert.equal(lessonMastery(meta, {}, {}), 0);
  assert.equal(lessonMastery(meta, { x: bad() }, {}), 1, "실력 문제만 풀어도 배우는 중");
  assert.equal(lessonMastery(meta, {}, {}, { "u9-1": [0] }), 1, "지나가기만 해도 배우는 중");
  const read = { "u9-1": [0, 1, 2] };
  const q: QMap = { a: ok(), b: ok(), c: ok(), d: bad(), e: bad() };
  assert.equal(lessonMastery(meta, q, read), 2, "60%는 넘었지만 80%가 안 돼요");
  q.d = applyAnswer(q.d, true, T0 + 1);
  q.e = applyAnswer(q.e, true, T0 + 1);
  assert.equal(lessonMastery(meta, q, read), 3);
  q.x = bad(T0 + 2);
  assert.equal(lessonMastery(meta, q, read), 2, "오답노트 '아직'이 남아 있으면 숙달이 아니에요");
});

test("단원 배지: 레슨 모두 완료면 done, 단원 마무리 도전까지 60%면 star", () => {
  const m2 = { ...meta, id: "u9-2", basicIds: ["f"], qids: ["f"] };
  const lessons = { "u9-1": meta, "u9-2": m2 };
  const unit = { lessonIds: ["u9-1", "u9-2"], testIds: ["t1", "t2"] };
  const read = { "u9-1": [0, 1, 2], "u9-2": [0, 1, 2] };
  const q: QMap = { a: ok(), b: ok(), c: ok(), d: ok(), e: ok() };
  let us = unitStatus(unit, lessons, q, read);
  assert.equal(us.done, 1);
  assert.equal(us.next, "u9-2");
  assert.equal(us.badge, null);
  q.f = ok();
  us = unitStatus(unit, lessons, q, read);
  assert.equal(us.badge, "done");
  assert.equal(us.percent, 100);
  q.t1 = ok();
  q.t2 = ok();
  assert.equal(unitStatus(unit, lessons, q, read).badge, "star");
});

test("홈(overall)의 완료 레슨 수와 단원 화면(unitStatus.done)의 합이 같아요", () => {
  const m2 = { ...meta, id: "u9-2", basicIds: ["f"], qids: ["f"] };
  const lessons = { "u9-1": meta, "u9-2": m2 };
  const unit = { lessonIds: ["u9-1", "u9-2"], testIds: [] as string[] };
  const read = { "u9-1": [0, 1, 2], "u9-2": [0, 1, 2] };
  const q: QMap = { a: ok(), b: ok(), c: ok(), d: ok(), e: ok() };
  assert.equal(overall(lessons, unit.lessonIds, q, read).complete, unitStatus(unit, lessons, q, read).done);
  q.f = ok();
  assert.equal(overall(lessons, unit.lessonIds, q, read).complete, unitStatus(unit, lessons, q, read).done);
});

/* ─────────── 복습 일정 ─────────── */

test("복습: 1·3·7일 간격, 3번 연속 맞히면 졸업, 틀리면 처음으로", () => {
  let rv = { step: 0 as const, due: addDays(T0, 1) } as { step: 0 | 1 | 2 | 3; due: number };
  const d1 = T0 + DAY;
  rv = reviewAnswer(rv, true, d1);
  assert.deepEqual(rv, { step: 1, due: addDays(d1, 3) });
  const d2 = d1 + 3 * DAY;
  rv = reviewAnswer(rv, true, d2);
  assert.deepEqual(rv, { step: 2, due: addDays(d2, 7) });
  const back = reviewAnswer(rv, false, d2 + 7 * DAY);
  assert.deepEqual(back, { step: 0, due: addDays(d2 + 7 * DAY, 1) });
  rv = reviewAnswer(rv, true, d2 + 7 * DAY);
  assert.equal(rv.step, 3);
  assert.deepEqual(reviewAnswer(rv, false, d2 + 99 * DAY), rv, "졸업한 문제는 그대로");
  assert.equal(dayStart(addDays(T0, 1)), addDays(T0, 1));
});

test("기록 흐름: 틀림 → 내일 복습 → 맞힘 3번 → 졸업, 오답노트 칸이 따라 바뀌어요", () => {
  let r = applyAnswer(undefined, false, T0);
  assert.equal(noteState(r), "todo");
  r = applyAnswer(r, true, T0 + 60000);
  assert.equal(noteState(r), "reviewing", "다시 맞히면 '복습 중'");
  assert.deepEqual(todayReview({ q1: r }, T0 + 120000), [], "오늘은 아직 차례가 아니에요");
  const d1 = T0 + DAY;
  assert.deepEqual(todayReview({ q1: r }, d1), ["q1"]);
  r = applyAnswer(r, true, d1, { review: true });
  r = applyAnswer(r, true, d1 + 3 * DAY, { review: true });
  r = applyAnswer(r, true, d1 + 10 * DAY, { review: true });
  assert.equal(noteState(r), "graduated");
  assert.deepEqual(todayReview({ q1: r }, d1 + 99 * DAY), []);
  // 졸업한 문제를 연습에서 또 틀리면 다시 상자로
  r = applyAnswer(r, false, d1 + 100 * DAY);
  assert.equal(noteState(r), "todo");
  // 풀이만 보고 아직 안 맞힌 문제는 '아직'
  assert.equal(noteState(applySolution(undefined, T0)), "todo");
  assert.equal(noteState(ok()), null, "처음에 맞힌 문제는 오답노트에 없어요");
});

test("오늘의 복습은 하루 최대 5문제, 오늘 푼 만큼 덜어요, 오래 기다린 것부터", () => {
  const q: QMap = {};
  for (let i = 0; i < 8; i++) q["q" + i] = applyAnswer(undefined, false, T0 - i * DAY);
  const now = T0 + DAY;
  const list = todayReview(q, now);
  assert.equal(list.length, REVIEW_MAX_PER_DAY);
  assert.equal(list[0], "q7", "가장 오래 기다린 것");
  assert.equal(todayReview(q, now, 3).length, 2);
  assert.equal(todayReview(q, now, 9).length, 0);
  assert.deepEqual(todayReview(q, now, 0, (id) => id === "q2"), ["q2"]);
  const notes = noteList(q);
  assert.equal(notes.length, 8);
  assert.equal(notes[0].id, "q0", "최근에 틀린 것부터");
});

/* ─────────── 백업 왕복 ─────────── */

test("백업 왕복: 공용 키 + 학생 전용 키(seen·think·self·proj)가 그대로 돌아와요", () => {
  const data: Record<string, unknown> = {
    q: { "u1-1-q01": ok(), "u1-1-q02": applySolution(undefined, T0) },
    read: { "u1-1": [0, 2] },
    seen: { "u1-1": [0, 1, 2] },
    pos: { "u1-1": { step: "c2", card: 3, ts: T0 } },
    last: { path: "/l/u1-1/s/c2/3", title: "Ⅰ-1 인공지능의 개념과 역사", ts: T0 },
    prefs: { fs: 2, theme: "dark", motion: "reduce", speak: true, contrast: false },
    prereq: { "u1-1": { 명제: "unsure" } },
    assigned: { "u1-1": { hw: ["u1-1-q06"], ex: ["u1-1-q03"], ts: T0 } },
    tools: { turing: { done: true, ts: T0 } },
    think: { "u1-1": { p0: "규칙을 사람이 다 정하기는 어려워요." } },
    self: { "u1-1": { level: 2, ts: T0 } },
    proj: { "u1-1": { steps: [0, 2], done: false, ts: T0 } },
    rvday: { day: "2026-10-16", n: 2 },
  };
  const text = serializeStudentBackup(data, new Date(T0));
  const back = parseStudentBackup(text);
  assert.ok(back.ok);
  if (!back.ok) return;
  const expect: Record<string, unknown> = {};
  for (const k of Object.keys(data)) if (k !== "rvday") expect[k] = data[k];
  assert.deepEqual(back.data, expect, "rvday 는 기록 파일에 넣지 않아요");
  assert.equal(back.questions, 2);
  assert.deepEqual(back.skipped, []);
  const b = makeStudentBackup(data, new Date(T0));
  assert.equal(b.app, "aibasic-next");
  assert.equal(b.site, "student");
});

test("백업 왕복 뒤 레슨 상태(lessonStatus)가 그대로예요", () => {
  const qa: QMap = { a: ok(), b: ok(), c: bad(), d: applyAnswer(applySolution(undefined, T0), true, T0, { afterSolution: true }), e: applyAnswer(applySolution(undefined, T0), true, T0 + DAY) };
  const data: Record<string, unknown> = { q: qa, read: { "u9-1": [0, 1, 2] }, seen: { "u9-1": [0, 1, 2] } };
  const back = parseStudentBackup(serializeStudentBackup(data, new Date(T0)));
  assert.ok(back.ok);
  if (!back.ok) return;
  const before = lessonStatus(meta, qa, data.read as Record<string, number[]>, data.seen as Record<string, number[]>);
  const after = lessonStatus(meta, back.data.q as QMap, back.data.read as Record<string, number[]>, back.data.seen as Record<string, number[]>);
  assert.deepEqual(after, before);
  assert.equal(before.basic.done, 3, "a·b·e(다음 날 혼자 맞힘) 3개");
  assert.equal(before.complete, true);
});

test("학생 저장 키는 aibn:s1: 로 시작해요", () => {
  assert.equal(S_PREFIX, "aibn:s1:");
  for (const k of studentKeyList) assert.match(S_PREFIX + k, /^aibn:s1:[a-z]+$/);
  assert.ok(studentKeyList.indexOf("q" as never) >= 0);
});

test("백업 불러오기: 다른 사이트·깨진 파일은 거절하고, 이상한 값은 걸러요", () => {
  assert.equal(parseStudentBackup("").ok, false);
  assert.equal(parseStudentBackup("{나쁜 json").ok, false);
  const teacher = JSON.stringify({ app: "aibasic-next", site: "teacher", v: 1, savedAt: "", data: {} });
  const r = parseStudentBackup(teacher);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, /교사/);
  const messy = JSON.stringify({
    app: "aibasic-next",
    site: "student",
    v: 1,
    savedAt: "x",
    data: {
      q: { "u1-1-q01": { first: true, ok: true, wrong: 0, hints: 0, sol: false, lastWrong: null, t0: 1, t1: 1 }, "<script>": { ok: true } },
      read: { "u1-1": [0, "1", -1, 2, 2], "../x": [0] },
      prefs: { fs: 9, theme: "chalk" },
      think: { "u1-1": { p0: "가".repeat(3000) } },
      hacker: 1,
    },
  });
  const m = parseStudentBackup(messy);
  assert.ok(m.ok);
  if (!m.ok) return;
  assert.deepEqual(Object.keys(m.data.q as object), ["u1-1-q01"]);
  assert.deepEqual(m.data.read, { "u1-1": [0, 2] });
  assert.deepEqual(m.data.prefs, { fs: 1, theme: "auto", motion: "auto", speak: false, contrast: false });
  assert.equal(((m.data.think as Record<string, Record<string, string>>)["u1-1"].p0).length, 1000);
  assert.deepEqual(m.skipped, ["hacker"]);
  assert.equal(sanitize("pos", { "u1-1": { step: "evil", card: 1 } }) && Object.keys(sanitize("pos", { "u1-1": { step: "evil", card: 1 } }) as object).length, 0);
});

/* ─────────── 선생님 QR 쿼리 ─────────── */

test("QR 쿼리: 짧은 id 를 늘리고, 다른 레슨·이상한 id 는 버려요", () => {
  assert.equal(expandQid("u1-1", "q06"), "u1-1-q06");
  assert.equal(expandQid("u1-1", "u1-1-q06"), "u1-1-q06");
  const a = parseAssignQuery("u1-1", "?hw=q06,q11,u2-1-q01,q06&ex=q03%2Cq05,<x>");
  assert.deepEqual(a, { hw: ["u1-1-q06", "u1-1-q11"], ex: ["u1-1-q03", "u1-1-q05"] });
  const b = parseAssignQuery("u1-1", "/l/u1-1?hw=q06,q99", (id) => id !== "u1-1-q99");
  assert.deepEqual(b, { hw: ["u1-1-q06"], ex: [] });
  assert.deepEqual(parseAssignQuery("u1-1", ""), { hw: [], ex: [] });
});
