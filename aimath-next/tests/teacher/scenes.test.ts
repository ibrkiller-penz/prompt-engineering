import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lesson } from "../../src/shared/contracts.ts";
import {
  applyFlow,
  buildLessonFlow,
  buildScenes,
  homeworkFromOff,
  MAX_ON,
  nextStep,
  prevStep,
  requiredOnly,
  timeBars,
} from "../../src/teacher/logic/scenes.logic.ts";
import { BODY_H } from "../../src/teacher/logic/measure.logic.ts";
import { lessonPeriods, splitSections } from "../../src/teacher/logic/periods.logic.ts";
import { questionSections } from "../../src/teacher/logic/pick.logic.ts";
import { loadLessons } from "../shared/_content.ts";

const lessons = loadLessons().map((x) => x.lesson as unknown as Lesson);
const DURS = [45, 50, 70];

test("20레슨을 읽어요", () => {
  assert.equal(lessons.length, 20);
});

/** 단계 차례: 여는 단계(질문·도입·먼저 알고 가요) → 가운데(소제목마다 개념·체험·확인 문제, 그다음 '문제' 구간) → 정리 → 끝 */
const PHASE: Record<string, number> = { open: 0, prereq: 1, concept: 2, tool: 2, practice: 2, wrap: 3, end: 4 };

test("buildScenes: 모든 레슨·수업 시간·차시에서 켜진 장면 15개 이상, 896px 안, 차례가 맞아요", () => {
  for (const L of lessons) {
    for (const m of DURS) {
      const periods = lessonPeriods(L, null, m);
      for (const per of periods) {
        const where = L.id + " " + m + "분 " + per.p + "차시";
        const f = buildLessonFlow(L, null, m, per.p);
        const sc = f.scenes;
        const on = sc.filter((s) => s.on);
        assert.ok(on.length >= 15, where + ": 켜진 장면 " + on.length + "개");
        // id 는 유일
        const ids = sc.map((s) => s.id);
        assert.equal(new Set(ids).size, ids.length, where + ": 장면 id 가 겹쳐요");
        // 처음은 핵심 질문, 끝은 QR
        assert.equal(sc[0].kind, "question", where);
        assert.equal(sc[sc.length - 1].kind, "qr", where);
        // 단계 차례(가운데는 소제목마다 섞여요)
        let last = 0;
        for (const s of sc) {
          const k = PHASE[s.stage];
          assert.ok(k >= last, where + ": " + s.id + " 단계 차례가 거꾸로예요");
          last = k;
        }
        // 가운데: 소제목 번호가 거꾸로 가지 않고, 확인 문제는 그 소제목 개념 뒤 · 다음 소제목 앞, 소제목마다 1개 이하.
        //         확인 문제가 아닌 칠판 문제는 모든 소제목 장면 뒤('문제' 구간)
        let sec = -1;
        let inTail = false;
        const checks: Record<number, number> = {};
        for (const s of sc) {
          if (s.kind === "problem" && s.secCheck === undefined) inTail = true;
          if (s.section !== undefined) {
            assert.ok(!inTail, where + ": " + s.id + " 소제목 장면이 '문제' 구간 뒤에 있어요");
            assert.ok(s.section >= sec, where + ": " + s.id + " 소제목 차례");
            sec = s.section;
          }
          if (s.secCheck !== undefined) {
            assert.equal(s.section, s.secCheck, where);
            checks[s.secCheck] = (checks[s.secCheck] || 0) + 1;
            assert.ok(sc.some((x) => x.kind === "concept" && x.section === s.secCheck && sc.indexOf(x) < sc.indexOf(s)), where + ": 확인 문제 앞에 개념이 없어요");
          }
        }
        for (const k in checks) assert.equal(checks[k], 1, where + ": 소제목 " + k + " 확인 문제 수");
        for (const s of sc) {
          assert.ok(s.h <= BODY_H, where + ": " + s.id + " 높이 " + s.h + "px 이 896px 을 넘어요");
          assert.ok(s.reveal >= 0 && Number.isInteger(s.reveal), where + ": " + s.id + " reveal");
          assert.ok(s.estMin >= 0.5, where + ": " + s.id + " estMin");
          if (s.required) assert.ok(s.on, where + ": 필수 장면 " + s.id + " 이 꺼졌어요");
          if (s.secCheck !== undefined) assert.ok(s.on, where + ": 확인 문제 " + s.id + " 가 꺼졌어요");
          if (s.kind === "aiStory" || s.id === "story") assert.equal(s.on, false, where + ": 이야기(한 장면 말고)는 기본으로 꺼져요");
          if (s.part) assert.ok(s.part.i >= 1 && s.part.i <= s.part.n, where);
        }
        // 도입: 1차시는 이야기 한 장면 켜짐, 2차시부터는 지난 시간 되짚기
        if (per.first && L.story.length) assert.ok(sc.some((s) => s.id === "story-brief" && s.on), where + ": 이야기 한 장면");
        if (per.p > 1) assert.ok(sc.some((s) => s.id === "recap" && s.on), where + ": 지난 시간 되짚기");
        // 기본은 자동으로 끄지 않아요
        assert.deepEqual(f.dropped, [], where);
        // 시간: 넘치지 않으면 수업 시간에 맞고(0.5분 반올림 허용), 넘치면 over = 합 − 수업 시간
        if (f.over > 0) assert.equal(f.over, f.total - m, where + ": over");
        else assert.ok(Math.abs(f.total - m) <= 1, where + ": 시간 합 " + f.total);
        // 줄이기 제안: 그대로 끄면 수업 시간에 맞고 장면 수도 상한 안, 확인 문제·필수는 제안에 없어요
        if (f.suggest.over === 0) assert.ok(Math.abs(f.suggest.total - m) <= 1, where + ": 제안 시간 합 " + f.suggest.total);
        else assert.equal(f.suggest.over, f.suggest.total - m, where + ": 제안 뒤 넘침");
        if (f.over === 0 && on.length <= MAX_ON) assert.ok(f.suggest.dropped.length <= 1, where + ": 넘치지 않는데 제안이 많아요");
        // 제안 뒤 켜진 장면 수: 상한(MAX_ON) 안. 다만 끄지 않는 소제목 확인 문제만큼은 넘을 수 있어요
        const nCheck = sc.filter((s) => s.secCheck !== undefined).length;
        const after = applyFlow(sc, { off: f.suggest.dropped }, m);
        assert.ok(after.scenes.filter((s) => s.on).length <= MAX_ON + nCheck, where + ": 제안 뒤 켜진 장면 수");
        for (const id of f.suggest.dropped) {
          const s = sc.filter((x) => x.id === id)[0];
          assert.ok(s && !s.required && s.secCheck === undefined, where + ": 제안 " + id);
        }
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

test("autoDrop: 예전처럼 자동으로 끄면 수업 시간에 맞고, 소제목 확인 문제는 남아요", () => {
  for (const L of lessons)
    for (const m of DURS)
      for (const per of lessonPeriods(L, null, m)) {
        const where = L.id + " " + m + "분 " + per.p + "차시";
        const f = buildLessonFlow(L, null, m, per.p, { autoDrop: true });
        assert.ok(Math.abs(f.total - m) <= 1, where + ": 시간 합 " + f.total);
        assert.ok(f.scenes.filter((s) => s.on).length <= MAX_ON + f.scenes.filter((s) => s.secCheck !== undefined).length, where);
        for (const s of f.scenes) if (s.secCheck !== undefined) assert.ok(s.on, where + ": 확인 문제 " + s.id + " 가 꺼졌어요");
        assert.deepEqual(f.dropped, buildLessonFlow(L, null, m, per.p).suggest.dropped, where + ": 자동 끄기 = 줄이기 제안");
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
    assert.deepEqual(lines("story"), L.story, L.id + " 이야기(나머지 + 한 장면)");
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
  // 나눈 차시: plan 목록 가운데 이 차시 소제목 문제만 남기고(앞머리는 소제목 끝 확인) 모자라면 채워요
  const secOf = questionSections(L, plan);
  assert.deepEqual(f.pick.board.slice(0, 2), ["u1-1-q01", "u1-1-q02"]);
  assert.ok(f.pick.board.length >= 5);
  for (const id of f.pick.board.concat(f.pick.exit, f.pick.hw)) assert.ok(secOf[id] <= 1, id + " 은 2차시 소제목 문제예요");
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
  assert.ok(ro.scenes.every((s) => s.on === (s.required || s.secCheck !== undefined)));
  // 교사가 고친 흐름도 자동으로 끄지 않고 넘친 분과 제안만 알려 줘요
  const many = applyFlow(f.scenes, { on: [story.id] }, 45);
  assert.ok(many.scenes.every((s, i) => s.on === (f.scenes[i].on || s.id.replace(/\+\d+$/, "") === story.id)), "켜 둔 장면이 그대로예요");
  assert.equal(many.over, Math.max(0, many.total - 45));
  if (many.over > 0) {
    assert.ok(many.suggest.dropped.length > 0, "넘치면 줄이기 제안");
    assert.ok(many.suggest.dropped.indexOf(story.id) < 0, "교사가 켠 장면은 제안에 넣지 않아요");
  }
  // 모두 직접 켜면 끌 것이 없어요(제안도 빈 목록)
  const all = applyFlow(f.scenes, { on: f.scenes.map((s) => s.id) }, 45);
  assert.ok(all.scenes.every((s) => s.on));
  assert.deepEqual(all.suggest.dropped, []);
});
