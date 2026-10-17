// 수업 흐름 합계 · 오늘 수업 '장면 N부터' · 칠판 무대 레일(N / 전체)이 같은 장면 목록에서 서로 맞는지 확인해요.
// 세 화면은 모두 shell/plan.ts 의 computePlan(= buildLessonFlow + applyFlow + onScenes)을 써요.
// 여기서는 같은 계산을 data/plan.json 으로 그대로 따라 하고(JSON import 없이), 각 화면이 쓰는 순수 함수로 번호를 비교해요.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lesson, Plan, PlanLesson, Scene } from "../../src/shared/contracts.ts";
import { applyFlow, buildLessonFlow, onScenes, sceneRoot, sumOn, timeBars, type BuiltScene } from "../../src/teacher/logic/scenes.logic.ts";
import { lessonPeriods } from "../../src/teacher/logic/periods.logic.ts";
import { BODY_H } from "../../src/teacher/logic/measure.logic.ts";
import { firstOn, lastOn, railInfo, snapOn } from "../../src/teacher/board/board.logic.ts";
import { barSegments } from "../../src/teacher/today/timebar.ts";
import { loadLessons } from "../shared/_content.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLAN = JSON.parse(readFileSync(join(ROOT, "data", "plan.json"), "utf8")) as Plan;
const lessons = loadLessons().map((x) => x.lesson as unknown as Lesson);
const DURS = [45, 50, 70] as const;

type FlowSt = { off: string[]; on: string[]; min: Record<string, number> };

/** shell/plan.ts computePlan 과 같은 계산 */
function compute(L: Lesson, minutes: number, p: number, st?: FlowSt) {
  const plan: PlanLesson | null = (PLAN.lessons && PLAN.lessons[L.id]) || null;
  const flow = buildLessonFlow(L, plan, minutes, p);
  const res = st ? applyFlow(flow.scenes, st, minutes) : { scenes: flow.scenes, total: flow.total };
  const idx = new Map<BuiltScene, number>();
  res.scenes.forEach((s, i) => idx.set(s, i));
  const on = onScenes(res.scenes).map((x) => ({ n: x.n, s: idx.get(x.scene) as number, scene: x.scene }));
  return { flow, scenes: res.scenes, total: res.total, on };
}

/** today/Today.tsx 의 시작 장면 고르기 */
function todayStart(on: { n: number; s: number }[], lastS: number | null) {
  let start = on.length ? on[0] : null;
  if (lastS !== null && lastS > 0) {
    for (const o of on)
      if (o.s >= lastS) {
        start = o;
        break;
      }
  }
  return start;
}

/** 교사가 흔히 바꾸는 흐름: 이어서 조각 하나 끄기, 문제 하나 끄기, 꺼진 것 켜기, 분 고치기 */
function edits(scenes: readonly BuiltScene[]): FlowSt[] {
  const out: FlowSt[] = [];
  const part = scenes.filter((s) => !s.required && s.part && s.part.i > 1)[0];
  if (part) out.push({ off: [part.id], on: [], min: {} });
  const prob = scenes.filter((s) => s.kind === "problem" && s.on)[0];
  const offOne = scenes.filter((s) => !s.on)[0];
  out.push({ off: prob ? [prob.id] : [], on: offOne ? [offOne.id] : [], min: prob ? {} : {} });
  const big = scenes.filter((s) => s.kind === "concept")[0];
  if (big) out.push({ off: [], on: [], min: { [big.id]: big.estMin + 2.5 } });
  return out;
}

test("흐름 합계 = 켜진 장면 분의 합 = 시간 막대(오늘 수업·흐름) 합 = 단계 막대 합", () => {
  for (const L of lessons)
    for (const m of DURS) {
      const plan = (PLAN.lessons && PLAN.lessons[L.id]) || null;
      for (const per of lessonPeriods(L, plan, m)) {
        const base = compute(L, m, per.p);
        for (const st of [undefined as FlowSt | undefined].concat(edits(base.scenes))) {
          const v = st ? compute(L, m, per.p, st) : base;
          const where = L.id + " " + m + "분 " + per.p + "차시" + (st ? " (고친 흐름 " + JSON.stringify(st) + ")" : "");
          assert.equal(v.total, sumOn(v.scenes), where + ": 합계");
          let raw = 0;
          for (const s of v.scenes) if (s.on) raw += s.estMin;
          assert.equal(v.total, raw, where + ": 0.5분 단위 합");
          const bars = barSegments(v.scenes);
          assert.equal(bars.reduce((a, b) => a + b.min, 0), v.total, where + ": 오늘 수업 시간 막대 합");
          assert.equal(bars.reduce((a, b) => a + b.count, 0), v.on.length, where + ": 막대 장면 수");
          const tb = timeBars(v.scenes);
          assert.equal(tb.reduce((a, b) => a + b.min, 0), v.total, where + ": 단계 막대 합");
          if (!st) assert.ok(Math.abs(v.total - m) <= 1, where + ": 자동 배분 합 " + v.total + " / " + m);
        }
      }
    }
});

test("오늘 수업 '장면 N부터' · 흐름 번호 · 칠판 레일(N / 전체)이 같은 장면을 가리켜요", () => {
  for (const L of lessons)
    for (const m of DURS) {
      const plan = (PLAN.lessons && PLAN.lessons[L.id]) || null;
      for (const per of lessonPeriods(L, plan, m)) {
        const base = compute(L, m, per.p);
        for (const st of [undefined as FlowSt | undefined].concat(edits(base.scenes))) {
          const v = st ? compute(L, m, per.p, st) : base;
          const where = L.id + " " + m + "분 " + per.p + "차시" + (st ? " 고친 흐름" : "");
          const sc = v.scenes as Scene[];
          // 레일: 켜진 장면만, 차례대로 1..N
          const rail = sc.map((s, i) => ({ s, i })).filter((x) => x.s.on);
          assert.equal(rail.length, v.on.length, where + ": 레일 수");
          v.on.forEach((o, k) => {
            assert.equal(o.n, k + 1, where);
            assert.equal(rail[k].i, o.s, where + ": 레일 " + (k + 1) + "번 위치");
            const info = railInfo(sc, o.s);
            assert.equal(info.n, o.n, where + ": 흐름/오늘 번호 " + o.n + " ≠ 칠판 " + info.n);
            assert.equal(info.total, v.on.length, where + ": 칠판 전체 수");
            assert.equal(snapOn(sc, o.s), o.s, where + ": 켜진 장면 주소가 그대로 열려요");
          });
          // 처음 시작: 오늘 수업 '장면 1부터' = 흐름의 첫 켜진 장면 = 칠판 firstOn
          const st0 = todayStart(v.on, null);
          assert.ok(st0, where);
          assert.equal(st0!.n, 1, where);
          assert.equal(st0!.s, firstOn(sc), where + ": 시작 위치");
          // 이어서 하기: 멈춘 위치(s)마다 오늘 수업이 고른 장면 = 칠판이 그 주소로 여는 장면(snapOn)
          for (let last = 1; last < sc.length; last++) {
            const pick = todayStart(v.on, last);
            const opened = snapOn(sc, last);
            if (pick && pick.s >= last) {
              assert.equal(opened, pick.s, where + ": 멈춘 위치 " + last + " → 오늘 " + pick.s + " / 칠판 " + opened);
              assert.equal(railInfo(sc, opened).n, pick.n, where + ": 이어서 번호");
            }
          }
          // 끝은 QR 장면, 마지막 켜진 장면
          assert.equal(sc[lastOn(sc)].kind, "qr", where);
          // "이어서" 조각은 함께 켜지고 꺼져요
          const byRoot: Record<string, boolean[]> = {};
          for (const s of sc) (byRoot[sceneRoot(s.id)] = byRoot[sceneRoot(s.id)] || []).push(s.on);
          for (const r in byRoot) assert.ok(byRoot[r].every((x) => x === byRoot[r][0]), where + ": 조각 " + r + " 켜짐이 섞였어요");
        }
      }
    }
});

test("plan.json 기준 모든 장면 어림 높이가 896px 안이고, 나눈 장면은 이어서 번호가 1..n 이에요", () => {
  for (const L of lessons)
    for (const m of DURS) {
      const plan = (PLAN.lessons && PLAN.lessons[L.id]) || null;
      for (const per of lessonPeriods(L, plan, m)) {
        const v = compute(L, m, per.p);
        const where = L.id + " " + m + "분 " + per.p + "차시";
        const groups: Record<string, BuiltScene[]> = {};
        for (const s of v.scenes) {
          assert.ok(s.h <= BODY_H, where + ": " + s.id + " " + s.h + "px");
          (groups[sceneRoot(s.id)] = groups[sceneRoot(s.id)] || []).push(s);
        }
        for (const r in groups) {
          const g = groups[r];
          if (g.length === 1) {
            assert.ok(!g[0].part, where + ": 혼자인 장면 " + r + " 에 이어서 번호가 있어요");
            continue;
          }
          g.forEach((s, i) => {
            assert.ok(s.part, where + ": " + s.id + " 이어서 번호 없음");
            assert.equal(s.part!.i, i + 1, where + ": " + s.id);
            assert.equal(s.part!.n, g.length, where + ": " + s.id);
          });
        }
      }
    }
});

test("나눈 정리·예제: 원래 줄·풀이 단계·답이 빠짐없이 차례대로 들어가요", () => {
  for (const L of lessons) {
    const plan = (PLAN.lessons && PLAN.lessons[L.id]) || null;
    const pers = lessonPeriods(L, plan, 45);
    const last = compute(L, 45, pers[pers.length - 1].p);
    const lines: string[] = [];
    for (const s of last.scenes) if (s.kind === "summary") for (const b of s.blocks) if (b.t === "lines") for (const it of b.items) lines.push(it);
    assert.deepEqual(lines, L.summary, L.id + ": 정리 줄");
    for (const per of pers) {
      const v = compute(L, 45, per.p);
      const ex: Record<string, BuiltScene[]> = {};
      for (const s of v.scenes) if (s.kind === "example") (ex[sceneRoot(s.id)] = ex[sceneRoot(s.id)] || []).push(s);
      for (const r in ex) {
        const g = ex[r];
        if (g.length < 2) continue;
        const src = g[0].src && g[0].src[0];
        assert.ok(src, r);
        const orig = L.sections[src!.s].blocks[src!.b] as { t: string; steps: string[]; answer: string; problem: string };
        const steps: string[] = [];
        let answers = 0;
        g.forEach((s, i) => {
          const b = s.blocks[0] as { t: string; steps: string[]; answer: string; problem: string };
          for (const t of b.steps) steps.push(t);
          if (b.answer) answers++;
          if (i > 0) assert.equal(b.problem, "", L.id + " " + s.id + ": 문제는 첫 조각에만");
          assert.equal(s.reveal, b.steps.length + (b.answer ? 1 : 0), L.id + " " + s.id + ": 공개 수");
        });
        assert.deepEqual(steps, orig.steps, L.id + " " + r + ": 풀이 단계");
        assert.equal(answers, 1, L.id + " " + r + ": 답은 한 번");
        assert.equal((g[g.length - 1].blocks[0] as { answer: string }).answer, orig.answer, L.id + " " + r + ": 답은 마지막 조각에");
      }
    }
  }
});
