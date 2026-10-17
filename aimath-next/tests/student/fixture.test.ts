// 촬영용 가짜 학습 기록(tools/fixtures/student.json)으로 이어서 하기 · 완료 판정 · 복습 · 백업 왕복을 확인해요.
// 화면에서 같은 흐름은 tests/student/phone-sweep.mjs --flow 가 브라우저로 확인해요.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ContentIndex, QMap } from "../../src/shared/contracts.ts";
import { lessonMastery, lessonStatus } from "../../src/student/store/status.logic.ts";
import { noteList, todayReview, REVIEW_MAX_PER_DAY } from "../../src/student/store/review.logic.ts";
import { parseStudentBackup, serializeStudentBackup } from "../../src/student/store/backup.logic.ts";
import { normRec } from "../../src/student/store/record.logic.ts";
// @ts-ignore 순수 JS 색인기(빌드 플러그인과 같은 것)
import { buildContentIndex } from "../../tools/content-index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "..", "..", "tools", "fixtures", "student.json"), "utf8")) as { now: number; storage: Record<string, unknown> };
const S = fx.storage;
const idx = (buildContentIndex() as { index: ContentIndex }).index;

const qRaw = S["aimn:s1:q"] as Record<string, unknown>;
const q: QMap = {};
for (const k of Object.keys(qRaw)) q[k] = normRec(qRaw[k]);
const read = S["aimn:s1:read"] as Record<string, number[]>;

test("가짜 기록: 문제 id 는 모두 실제 콘텐츠에 있어요", () => {
  const all = new Set<string>();
  for (const l of Object.values(idx.lessons)) for (const id of l.qids) all.add(id);
  const missing = Object.keys(q).filter((id) => !all.has(id) && !/^u\d-test/.test(id));
  assert.deepEqual(missing, []);
});

test("이어서 하기: 마지막 위치가 실제 레슨·단계를 가리켜요", () => {
  const last = S["aimn:s1:last"] as { path: string; title: string };
  const m = /^\/l\/(u\d-\d)\/s\/(story|prereq|c\d+|wrap)\/(\d+)$/.exec(last.path);
  assert.ok(m, "주소 모양 " + last.path);
  const l = idx.lessons[m![1]];
  assert.ok(l, "있는 레슨");
  if (/^c\d+$/.test(m![2])) assert.ok(parseInt(m![2].slice(1), 10) <= l.sections.length, "있는 소제목");
  const pos = S["aimn:s1:pos"] as Record<string, { step: string; card: number }>;
  assert.equal(pos[m![1]].step, m![2]);
});

test("완료 판정: Ⅰ-1 은 완료, Ⅰ-2 는 배우는 중, 손대지 않은 레슨은 시작 전", () => {
  const st1 = lessonStatus(idx.lessons["u1-1"], q, read);
  assert.equal(st1.allRead, true);
  assert.equal(st1.allTried, true);
  assert.equal(st1.complete, true);
  assert.ok(lessonMastery(idx.lessons["u1-1"], q, read) >= 2);
  const st2 = lessonStatus(idx.lessons["u1-2"], q, read);
  assert.equal(st2.complete, false);
  assert.equal(lessonMastery(idx.lessons["u1-2"], q, read), 1);
  assert.equal(lessonMastery(idx.lessons["u5-1"] || Object.values(idx.lessons)[19], q, read), 0);
});

test("복습: 기준 시각에 예정된 문제가 있고 하루 5문제를 넘지 않아요, 오답노트에도 나와요", () => {
  const due = todayReview(q, fx.now);
  assert.ok(due.length >= 1, "예정 문제가 있어요");
  assert.ok(due.length <= REVIEW_MAX_PER_DAY);
  const notes = noteList(q);
  assert.ok(notes.length >= due.length);
  // 오늘 이미 5문제를 풀었으면 0
  assert.equal(todayReview(q, fx.now, REVIEW_MAX_PER_DAY).length, 0);
});

test("백업 왕복: 가짜 기록 전체가 그대로 돌아와요(rvday·화면 상태 제외)", () => {
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(S)) data[k.replace(/^aimn:s1:/, "")] = S[k];
  const back = parseStudentBackup(serializeStudentBackup(data, new Date(fx.now)));
  assert.ok(back.ok);
  if (!back.ok) return;
  for (const k of Object.keys(data)) {
    if (k === "rvday") continue;
    assert.deepEqual(back.data[k as keyof typeof back.data], data[k], k + " 가 그대로 돌아와요");
  }
  assert.equal(back.questions, Object.keys(q).length);
});

// ── 문제 화면·결과 카드의 새 문구 규칙 ──
import { gainLine, prevNote, resultLine, solvedToday } from "../../src/student/pages/student.logic.ts";

test("결과 카드 문구: 'N문제 중 M문제 맞혔어요', 늘었을 때만 '지난번보다'", () => {
  assert.equal(resultLine(9, 8), "9문제 중 8문제 맞혔어요");
  assert.equal(gainLine(6, 8), "지난번보다 2문제 더 맞혔어요");
  assert.equal(gainLine(8, 8), "");
  assert.equal(gainLine(9, 8), "");
});

test("'지난번' 표시: 처음 푸는 문제는 없음 · 제출 전 맞힘 · 제출 뒤 틀리면 '이번엔 달랐어요'", () => {
  assert.equal(prevNote(undefined, false, null), null);
  assert.equal(prevNote({ ok: true, wrong: 0 }, true, null)?.text, "지난번에 맞혔어요");
  assert.equal(prevNote({ ok: true, wrong: 0 }, true, { correct: false })?.text, "지난번엔 맞혔는데 이번엔 달랐어요");
  assert.equal(prevNote({ ok: true, wrong: 0 }, true, { correct: true }), null);
  assert.match(prevNote({ ok: false, wrong: 2 }, true, null)?.text || "", /다시 본 횟수 2/);
});

test("오늘 푼 문제 수는 기존 기록(t1)만 읽어요", () => {
  const now = new Date(2026, 4, 10, 15, 0).getTime();
  const earlier = new Date(2026, 4, 10, 8, 0).getTime();
  const yesterday = new Date(2026, 4, 9, 23, 0).getTime();
  assert.equal(solvedToday({ a: { t1: earlier }, b: { t1: yesterday }, c: { t1: 0 } }, now), 1);
});
