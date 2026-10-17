import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lesson } from "../../src/shared/contracts.ts";
import {
  applyFlow,
  buildLessonFlow,
  buildScenes,
  homeworkFromOff,
  nextStep,
  prevStep,
  requiredOnly,
  STAGE_ORDER,
  timeBars,
} from "../../src/teacher/logic/scenes.logic.ts";
import { BODY_H } from "../../src/teacher/logic/measure.logic.ts";
import { lessonPeriods, splitSections } from "../../src/teacher/logic/periods.logic.ts";
import { loadLessons } from "../shared/_content.ts";

const lessons = loadLessons().map((x) => x.lesson as unknown as Lesson);
const DURS = [45, 50, 70];

test("20레슨을 읽어요", () => {
  assert.equal(lessons.length, 20);
});

test("buildScenes: 모든 레슨·수업 시간·차시에서 켜진 장면 15~45개, 896px 안, 차례가 맞아요", () => {
  for (const L of lessons) {
    for (const m of DURS) {
      const periods = lessonPeriods(L, null, m);
      for (const per of periods) {
        const where = L.id + " " + m + "분 " + per.p + "차시";
        const f = buildLessonFlow(L, null, m, per.p);
        const sc = f.scenes;
        const on = sc.filter((s) => s.on);
        assert.ok(on.length >= 15 && on.length <= 45, where + ": 켜진 장면 " + on.length + "개");
        // id 는 유일
        const ids = sc.map((s) => s.id);
        assert.equal(new Set(ids).size, ids.length, where + ": 장면 id 가 겹쳐요");
        // 처음은 핵심 질문, 끝은 QR
        assert.equal(sc[0].kind, "question", where);
        assert.equal(sc[sc.length - 1].kind, "qr", where);
        // 단계 차례
        let last = 0;
        for (const s of sc) {
          const k = STAGE_ORDER.indexOf(s.stage);
          assert.ok(k >= last, where + ": " + s.id + " 단계 차례가 거꾸로예요");
          last = k;
        }
        for (const s of sc) {
          assert.ok(s.h <= BODY_H, where + ": " + s.id + " 높이 " + s.h + "px 이 896px 을 넘어요");
          assert.ok(s.reveal >= 0 && Number.isInteger(s.reveal), where + ": " + s.id + " reveal");
          assert.ok(s.estMin >= 0.5, where + ": " + s.id + " estMin");
          if (s.required) assert.ok(s.on, where + ": 필수 장면 " + s.id + " 이 꺼졌어요");
          if (s.kind === "story" || s.kind === "aiStory") assert.equal(s.on, false, where + ": 이야기는 기본으로 꺼져요");
          if (s.part) assert.ok(s.part.i >= 1 && s.part.i <= s.part.n, where);
        }
        // 시간 합은 수업 시간에 맞아요(0.5분 단위 반올림 허용)
        assert.ok(Math.abs(f.total - m) <= 1, where + ": 시간 합 " + f.total);
        // 칠판 문제는 적어도 3개 켜져 있어요
        assert.ok(on.filter((s) => s.kind === "problem").length >= 3, where + ": 칠판 문제가 3개보다 적어요");
        // 꺼진 문제는 숙제로
        assert.deepEqual(f.toHw, homeworkFromOff(sc));
        // 시간 막대 합 = total
        const bars = timeBars(sc);
        assert.ok(Math.abs(bars.reduce((a, b) => a + b.min, 0) - f.total) < 0.01, where + ": 시간 막대");
      }
    }
  }
});

test("buildScenes: 레슨 전체(차시 0)에서 모든 개념 블록이 장면에 들어가요", () => {
  for (const L of lessons) {
    const f = buildLessonFlow(L, null, 45, 0, { noAllocate: true });
    const seen = new Set<string>();
    for (const s of f.scenes) {
      if (!s.src) continue;
      for (const r of s.src) seen.add(r.s + ":" + r.b);
      // 나뉘지 않은 장면은 원본 블록을 그대로(같은 객체) 담아요
      if (!s.part) {
        const orig = s.src.map((r) => L.sections[r.s].blocks[r.b]);
        const inner = s.blocks.filter((b) => b.t !== "heading");
        assert.equal(inner.length, orig.length, L.id + " " + s.id);
        inner.forEach((b, i) => assert.ok(b === orig[i], L.id + " " + s.id + ": 블록이 바뀌었어요"));
      }
    }
    L.sections.forEach((sec, si) =>
      sec.blocks.forEach((_, bi) => assert.ok(seen.has(si + ":" + bi), L.id + " §" + (si + 1) + " 블록 " + bi + " 이 어느 장면에도 없어요")),
    );
    // 체험 도구 수 = 원본 widget 블록 수
    let widgets = 0;
    for (const sec of L.sections) for (const b of sec.blocks) if (b.t === "widget") widgets++;
    assert.equal(f.scenes.filter((s) => s.kind === "widget").length, widgets, L.id);
    // 예제는 늘 단독
    for (const s of f.scenes) if (s.kind === "example") assert.ok(s.blocks.every((b) => b.t === "example"), L.id + " " + s.id);
    // 이야기·먼저 알고 가요·정리 줄도 빠짐없이
    const lines = (kind: string) => {
      const out: string[] = [];
      for (const s of f.scenes) if (s.kind === kind) for (const b of s.blocks) if (b.t === "lines") for (const it of b.items) out.push(it);
      return out;
    };
    assert.deepEqual(lines("summary"), L.summary, L.id + " 정리");
    assert.deepEqual(lines("story"), L.story, L.id + " 이야기");
    if (L.prereq) {
      const terms: string[] = [];
      for (const s of f.scenes) if (s.kind === "prereq") for (const b of s.blocks) if (b.t === "term") terms.push(b.term);
      assert.deepEqual(terms, L.prereq.items.map((x) => x.term), L.id + " 먼저 알고 가요");
    }
  }
});

test("차시 나누기: 소제목이 빠짐없이, 겹치지 않고, 차례대로 나뉘어요", () => {
  for (const L of lessons) {
    for (const m of DURS) {
      const ps = lessonPeriods(L, null, m);
      const flat = ([] as number[]).concat(...ps.map((p) => p.sections));
      assert.deepEqual(flat, L.sections.map((_, i) => i), L.id + " " + m);
      assert.ok(ps.every((p) => p.sections.length > 0));
      assert.ok(ps[0].first && ps[ps.length - 1].last);
    }
    assert.equal(lessonPeriods(L, null, 70).length, 1, L.id + ": 70분이면 한 차시");
  }
  assert.deepEqual(splitSections([1, 1, 1, 1], 2), [[0, 1], [2, 3]]);
  assert.deepEqual(splitSections([10, 1, 1, 1], 2), [[0], [1, 2, 3]]);
  assert.deepEqual(splitSections([1, 1], 3), [[0], [1]]);
});

test("plan 의 차시를 따라요", () => {
  const L = lessons.filter((x) => x.id === "u1-1")[0];
  const plan = {
    lid: "u1-1",
    sectionChecks: [],
    corePath: [],
    board: [],
    exit: [],
    hw: [],
    periods: [
      { p: 1, sections: [0, 1], minutes: 45, board: ["u1-1-q01", "u1-1-q02", "u1-1-q03", "u1-1-q04", "u1-1-q05"] },
      { p: 2, sections: [2, 3, 4, 5], minutes: 45 },
    ],
  };
  const f = buildLessonFlow(L, plan, 45, 1);
  assert.deepEqual(f.period.sections, [0, 1]);
  assert.deepEqual(f.pick.board, ["u1-1-q01", "u1-1-q02", "u1-1-q03", "u1-1-q04", "u1-1-q05"]);
  assert.ok(f.scenes.every((s) => s.section === undefined || s.section <= 1));
  const f2 = buildLessonFlow(L, plan, 45, 2);
  assert.ok(f2.scenes.every((s) => s.section === undefined || s.section >= 2));
  assert.ok(!f2.scenes.some((s) => s.kind === "prereq"), "먼저 알고 가요는 첫 차시에만");
});

test("다음/이전: 공개를 먼저 쓰고, 꺼진 장면은 건너뛰어요", () => {
  const L = lessons[0];
  const sc = buildScenes(L, null, 45, 1);
  let s = 0;
  let r = 0;
  let presses = 0;
  const visited: string[] = [sc[0].id];
  for (;;) {
    const n = nextStep(sc, s, r);
    if (n.done) break;
    if (n.s !== s) visited.push(sc[n.s].id);
    s = n.s;
    r = n.r;
    presses++;
    assert.ok(presses < 2000);
  }
  const on = sc.filter((x) => x.on);
  assert.deepEqual(visited, on.map((x) => x.id));
  const expected = on.reduce((a, x) => a + x.reveal + 1, 0) - 1;
  assert.equal(presses, expected);
  // 끝에서 '이전'을 끝까지 누르면 처음으로
  for (let i = 0; i < presses; i++) {
    const p = prevStep(sc, s, r);
    s = p.s;
    r = p.r;
  }
  assert.equal(s, 0);
  assert.equal(r, 0);
});

test("applyFlow·requiredOnly: 필수는 끌 수 없고, 직접 켠 장면은 자동으로 꺼지지 않아요", () => {
  const L = lessons[0];
  const f = buildLessonFlow(L, null, 45, 1);
  const q = f.scenes.filter((s) => s.kind === "problem" && s.on)[0];
  const story = f.scenes.filter((s) => s.kind === "story")[0];
  const res = applyFlow(f.scenes, { off: ["question", q.id], on: [story.id], min: { summary: 4 } }, 45);
  const by = (id: string) => res.scenes.filter((s) => s.id === id)[0];
  assert.equal(by("question").on, true, "필수는 꺼지지 않아요");
  assert.equal(by(q.id).on, false);
  assert.equal(by(story.id).on, true);
  assert.equal(by(story.id).required, false, "원래 required 로 돌아와요");
  assert.equal(by("summary").estMin, 4);
  assert.ok(homeworkFromOff(res.scenes).indexOf(q.qid as string) >= 0, "끈 문제는 숙제로");

  const ro = requiredOnly(f.scenes, 45);
  assert.ok(ro.scenes.every((s) => s.on === s.required));
});
