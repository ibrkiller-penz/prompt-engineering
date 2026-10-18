// 반별 수업 기록 카드: 득표 없음·일부만·정답률·복사 글·60개 제한·시간 판단
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLessonLog, isLessonLog, lessonLogText, shouldSaveLog, weakQuestions } from "../../src/teacher/logic/lessonlog.logic.ts";
import { LOG_MAX, logKey, putLog } from "../../src/teacher/store/logic.ts";
import { overMin } from "../../src/teacher/today/timebar.ts";
import { storyAdd, storyAddText, timeVerdict } from "../../src/teacher/prep/prep.logic.ts";
import { TEACHER_KEYS } from "../../src/shared/storage/keys.ts";

const base = { klass: "2-3", lid: "u1_1_1", p: 1, date: "2026-10-17", scenesDone: 8, scenesTotal: 10, hw: ["u1_1_1-q6", "u1_1_1-q7"], exitIds: [] as string[] };

test("득표가 없으면 정답률은 null 이고 글에 NaN·0% 가 없어요", () => {
  const c = buildLessonLog({ ...base, votes: [{ id: "u1_1_1-q1", answer: 1, counts: null }, { id: "u1_1_1-q2", answer: 0, counts: [0, 0, 0] }] });
  assert.equal(c.qs[0].rate, null);
  assert.equal(c.qs[1].rate, null);
  assert.deepEqual(weakQuestions(c, 2), []);
  const t = lessonLogText(c);
  assert.ok(t.includes("아직 손들기를 안 했어요"));
  assert.ok(!/NaN|\b0%/.test(t), t);
});

test("일부 문항만 득표가 있어도 계산해요", () => {
  const c = buildLessonLog({ ...base, exitIds: ["u1_1_1-q2"], votes: [{ id: "u1_1_1-q1", answer: 1, counts: [2, 6, 2] }, { id: "u1_1_1-q2", answer: 0, counts: [3, 7, 0] }, { id: "u1_1_1-q3", answer: 0 }] });
  assert.equal(c.qs[0].rate, 60);
  assert.equal(c.qs[1].rate, 30);
  assert.equal(c.qs[2].rate, null);
  assert.equal(c.qs[1].exit, true);
  assert.equal(c.exitDone, true);
  assert.deepEqual(weakQuestions(c, 2).map((q) => q.id), ["u1_1_1-q2", "u1_1_1-q1"]);
  assert.equal(weakQuestions(c, 1).length, 1);
});

test("정답률은 반올림하고 모두 맞으면 약한 문항이 없어요", () => {
  const c = buildLessonLog({ ...base, votes: [{ id: "a-q01", answer: 0, counts: [2, 1, 0] }, { id: "a-q02", answer: 0, counts: [5, 0, 0] }] });
  assert.equal(c.qs[0].rate, 67);
  assert.equal(c.qs[1].rate, 100);
  assert.deepEqual(weakQuestions({ qs: [c.qs[1]] }, 2), []);
});

test("복사 글에는 이름·번호 표식이 없어요", () => {
  const c = buildLessonLog({ ...base, votes: [{ id: "u1_1_1-q1", answer: 1, counts: [2, 6, 2] }] });
  const t = lessonLogText(c);
  assert.ok(t.includes("2-3") && t.includes("q6"));
  assert.ok(!/이름|번호:|학번|세특|우수|부족/.test(t), t);
  assert.deepEqual(Object.keys(c).sort(), ["date", "exitDone", "hw", "klass", "lid", "p", "qs", "scenesDone", "scenesTotal", "ts"]);
});

test("저장: 같은 반·레슨·차시는 덮어쓰고 60개를 넘으면 오래된 것부터 버려요", () => {
  assert.equal(logKey("2-3", "u1_1_1", 2), "2-3|u1_1_1:2");
  let m: Record<string, ReturnType<typeof buildLessonLog>> = {};
  for (let i = 0; i < 70; i++) m = putLog(m, buildLessonLog({ ...base, klass: "k" + i, votes: [], ts: 1000 + i }));
  assert.equal(Object.keys(m).length, LOG_MAX);
  assert.ok(!m[logKey("k0", "u1_1_1", 1)]);
  assert.ok(m[logKey("k69", "u1_1_1", 1)]);
  const again = putLog(m, buildLessonLog({ ...base, klass: "k69", scenesDone: 1, votes: [], ts: 5000 }));
  assert.equal(Object.keys(again).length, LOG_MAX);
  assert.equal(again[logKey("k69", "u1_1_1", 1)].scenesDone, 1);
});

test("timeVerdict: '맞아요'와 '넘어요'를 한 줄에 같이 내지 않아요", () => {
  const sc = (kind: string, on: boolean, estMin: number) => ({ kind, on, estMin }) as never;
  for (const total of [20, 38, 44, 45, 47]) {
    for (const withStory of [false, true]) {
      const a = storyAdd(withStory ? [sc("story", false, 10)] : [sc("x", true, 5)], total, 45);
      const v = timeVerdict(total, 45, a);
      assert.ok(!(/맞아요/.test(v.text) && /넘/.test(v.text)), v.text);
      if (a && v.state === "fit") assert.ok(!/맞아요/.test(v.text) && /꺼 둔/.test(v.text), v.text);
    }
  }
  assert.equal(timeVerdict(44, 45, null).text, "수업 시간에 잘 맞아요.");
  assert.equal(timeVerdict(50, 45, null).state, "over");
  assert.equal(timeVerdict(30, 45, null).state, "under");
});

test("storyAddText: 대략·반올림", () => {
  const a = storyAdd([{ kind: "story", on: false, estMin: 4.5 } as never, { kind: "story", on: false, estMin: 5 } as never], 44, 45);
  assert.ok(a);
  assert.equal(storyAddText(a), "모두 켜면 대략 54분이에요. 수업보다 대략 9분 길어요.");
  const b = storyAdd([{ kind: "story", on: false, estMin: 1 } as never], 30, 45);
  assert.ok(b);
  assert.equal(storyAddText(b), "모두 켜면 대략 31분이에요. 수업 시간 안에 들어가요.");
});

test("log 키가 등록돼 있어요", () => {
  assert.ok(TEACHER_KEYS.log && TEACHER_KEYS.log.backup && /이름/.test(TEACHER_KEYS.log.desc));
});

test("복사 글: 연습 순서 번호를 주면 '6번' 형식, 안 주면 예전 그대로", () => {
  const c = buildLessonLog({ ...base, votes: [{ id: "u1_1_1-q6", answer: 1, counts: [6, 2, 2] }] });
  const order = ["u1_1_1-q1", "u1_1_1-q2", "u1_1_1-q3", "u1_1_1-q4", "u1_1_1-q5", "u1_1_1-q6", "u1_1_1-q7"];
  const t = lessonLogText(c, order);
  assert.ok(t.includes("숙제: 6번, 7번") && t.includes("- 6번 정답률") && t.includes("6번 20%"), t);
  assert.ok(!/q0\d/.test(t), t);
  assert.ok(lessonLogText(c).includes("q6"));
});

test("shouldSaveLog: 반이 비면 저장하지 않아요", () => {
  assert.equal(shouldSaveLog(""), false);
  assert.equal(shouldSaveLog("  "), false);
  assert.equal(shouldSaveLog(undefined), false);
  assert.equal(shouldSaveLog("2-3"), true);
});

test("시간 경계: 0~0.5분 넘침은 둘 다 '맞아요', 줄이기 상자 값은 0", () => {
  for (const t of [45, 45.1, 45.25, 45.5]) {
    assert.equal(overMin(t, 45), 0, String(t));
    const v = timeVerdict(t, 45, null);
    assert.equal(v.state, "fit");
    assert.ok(!/넘/.test(v.text), v.text);
  }
  assert.equal(overMin(45.75, 45), 1);
  const v = timeVerdict(45.75, 45, null);
  assert.equal(v.state, "over");
  assert.ok(v.text.includes("1분 넘쳐요"), v.text);
  assert.equal(timeVerdict(46, 45, null).text, "시간이 1분 넘쳐요.");
});

test("isLessonLog: 모양이 어긋난 카드는 걸러요", () => {
  const ok = buildLessonLog({ klass: "2-3", lid: "L1", p: 1, date: "2026-03-02", scenesDone: 1, scenesTotal: 2, hw: [], votes: [{ id: "q1", counts: [1, 2], answer: 0 }], exitIds: [], ts: 1 } as never);
  assert.equal(isLessonLog(ok), true);
  const noHw = { ...ok } as Record<string, unknown>;
  delete noHw.hw;
  assert.equal(isLessonLog(noHw), false);
  assert.equal(isLessonLog({ ...ok, qs: [{ id: "q1", answer: 0 }] }), false);
  assert.equal(isLessonLog(null), false);
});
