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
import { lessonPeriods, periodQuestion, recapLines, summaryForPeriod, summarySections } from "../../src/teacher/logic/periods.logic.ts";
import { questionSections, sectionCheckIds } from "../../src/teacher/logic/pick.logic.ts";
import { BODY_H } from "../../src/teacher/logic/measure.logic.ts";
import { firstOn, lastOn, railInfo, snapOn } from "../../src/teacher/board/board.logic.ts";
import { cutInfo } from "../../src/teacher/today/cuts.ts";
import { barSegments } from "../../src/teacher/today/timebar.ts";
import { loadLessons } from "../shared/_content.ts";
import { klassNowText, markOf, startLabel, statusLine } from "../../src/teacher/progress/progress.logic.ts";
import { nextPeriodHeads, storyAdd, storyAddText, timeVerdict } from "../../src/teacher/prep/prep.logic.ts";

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
          if (!st) {
            // 기본은 자동으로 끄지 않아요: 넘치면 over(= 합 − 수업 시간), 줄이기 제안대로면 수업 시간에 맞아요
            if (v.flow.over > 0) assert.equal(v.flow.over, v.total - m, where + ": over");
            else assert.ok(Math.abs(v.total - m) <= 1, where + ": 자동 배분 합 " + v.total + " / " + m);
            // 줄이기 제안대로 끄면(교사가 '줄이기'를 누른 흐름) 제안이 말한 합·넘침과 같아요
            const cut = compute(L, m, per.p, { off: v.flow.suggest.dropped, on: [], min: {} });
            assert.equal(cut.total, v.flow.suggest.total, where + ": 제안대로 끈 흐름 합");
            assert.equal(v.flow.suggest.over, Math.max(0, cut.total - m), where + ": 제안 뒤 넘침");
            assert.ok(v.flow.suggest.total <= v.total, where + ": 제안이 오히려 길어요");
            if (v.flow.suggest.over === 0) assert.ok(Math.abs(cut.total - m) <= 1, where + ": 제안대로 끈 흐름 합 " + cut.total);
          }
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

/** 장면 목록에서 '오늘 정리'(지난 시간 되짚기 말고) 줄 */
function summaryLines(scenes: readonly BuiltScene[]): string[] {
  const out: string[] = [];
  for (const s of scenes) if (s.kind === "summary" && sceneRoot(s.id) === "summary") for (const b of s.blocks) if (b.t === "lines") for (const it of b.items) out.push(it);
  return out;
}

test("나눈 정리·예제: 원래 줄·풀이 단계·답이 빠짐없이 차례대로 들어가요", () => {
  for (const L of lessons) {
    const plan = (PLAN.lessons && PLAN.lessons[L.id]) || null;
    const pers = lessonPeriods(L, plan, 45);
    // 차시마다 정리 줄을 이으면 원래 정리 줄 그대로(빠짐·겹침 없이, 차례대로)
    const lines: string[] = [];
    for (const per of pers) for (const x of summaryLines(compute(L, 45, per.p).scenes)) lines.push(x);
    assert.deepEqual(lines, L.summary, L.id + ": 정리 줄");
    // 마지막 차시에서 '이 레슨 전체 정리'를 고르면 모든 줄
    const lastP = pers[pers.length - 1].p;
    const whole = buildLessonFlow(L, plan, 45, lastP, { fullSummary: true });
    assert.deepEqual(summaryLines(whole.scenes), L.summary, L.id + ": 전체 정리");
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

test("차시 정합성: 칠판·끝 확인·숙제가 그 차시 소제목 안에만 있고, 정리 줄·질문·되짚기가 차시에 맞아요", () => {
  for (const L of lessons) {
    const plan = (PLAN.lessons && PLAN.lessons[L.id]) || null;
    const secOf = questionSections(L, plan);
    const sumSec = summarySections(L, plan);
    for (const m of DURS) {
      const pers = lessonPeriods(L, plan, m);
      pers.forEach((per, k) => {
        const where = L.id + " " + m + "분 " + per.p + "/" + per.n + "차시";
        const v = compute(L, m, per.p);
        const has = (id: string) => L.practice.some((q) => q.id === id);
        // 문제 id 는 모두 실제 문제
        for (const id of v.flow.pick.board.concat(v.flow.pick.exit, v.flow.pick.hw)) assert.ok(has(id), where + ": 없는 문제 " + id);
        for (const s of v.scenes) if (s.qid) assert.ok(has(s.qid), where + ": 없는 문제 장면 " + s.qid);
        if (per.n > 1) {
          for (const id of v.flow.pick.board.concat(v.flow.pick.exit, v.flow.pick.hw))
            assert.ok(per.sections.indexOf(secOf[id]) >= 0, where + ": " + id + " 은 소제목 " + secOf[id] + " 문제예요(이 차시 " + per.sections.join(",") + ")");
          // 정리 줄: 이 차시 소제목 줄(레슨 전체 줄 -1 은 마지막 차시)
          const sum = summaryForPeriod(L, plan, per);
          const want = L.summary.filter((_, i) => (sumSec[i] === -1 ? per.last : per.sections.indexOf(sumSec[i]) >= 0));
          if (want.length) assert.deepEqual(sum.lines, want, where + ": 정리 줄");
          assert.ok(sum.lines.length > 0, where + ": 정리 줄이 비었어요");
          assert.deepEqual(summaryLines(v.scenes), sum.lines, where + ": 정리 장면 = summaryForPeriod");
          // 핵심 질문: 차시 질문(plan periods[].question) 1~2줄
          const q = periodQuestion(L, plan, per);
          assert.ok(q.length >= 1 && q.length <= 2, where);
          const qs: string[] = [];
          for (const s of v.scenes) if (s.kind === "question") for (const b of s.blocks) if (b.t === "lines") for (const it of b.items) qs.push(it);
          assert.deepEqual(qs, q, where + ": 질문 장면");
          if (per.plan && (per.plan as { question?: string }).question) assert.equal(q.join(" "), (per.plan as { question?: string }).question, where);
        } else {
          assert.deepEqual(summaryLines(v.scenes), L.summary, where + ": 한 차시면 정리 줄 전부");
        }
        // 소제목 끝 확인: 이 차시 소제목마다 하나씩, 켜져 있고, 그 소제목 문제
        const want = sectionCheckIds(L, plan, per.sections);
        const got = v.scenes.filter((s) => s.secCheck !== undefined);
        assert.deepEqual(got.map((s) => [s.secCheck, s.qid]), want.map((x) => [x.s, x.id]), where + ": 소제목 확인 문제");
        // 되짚기: 2차시부터, 이전 차시 정리에서 2~3줄
        const recap = v.scenes.filter((s) => s.id === "recap" || s.id.indexOf("recap+") === 0);
        if (k === 0) assert.equal(recap.length, 0, where);
        else {
          const prevLines = summaryForPeriod(L, plan, pers[k - 1]).lines;
          const items: string[] = [];
          for (const s of recap) for (const b of s.blocks) if (b.t === "lines") for (const it of b.items) items.push(it);
          assert.deepEqual(items, recapLines(L, plan, pers[k - 1]), where);
          assert.ok(items.length >= Math.min(2, prevLines.length) && items.length <= 3, where + ": 되짚기 " + items.length + "줄");
          for (const it of items) assert.ok(prevLines.indexOf(it) >= 0, where + ": 되짚기 줄은 지난 차시 정리에서");
        }
      });
      // 개념 블록은 차시들을 통틀어 빠짐·겹침 없이 한 번씩
      const seen: Record<string, number> = {};
      for (const per of pers) for (const s of compute(L, m, per.p).scenes) for (const r of s.src || []) seen[r.s + ":" + r.b] = (seen[r.s + ":" + r.b] || 0) + (s.part && s.part.i > 1 && s.kind !== "concept" ? 0 : 1);
      L.sections.forEach((sec, si) =>
        sec.blocks.forEach((_, bi) => {
          const n = seen[si + ":" + bi] || 0;
          assert.ok(n >= 1, L.id + " " + m + "분: 블록 " + si + ":" + bi + " 이 빠졌어요");
        }),
      );
      const owners: Record<string, string[]> = {};
      for (const per of pers)
        for (const s of compute(L, m, per.p).scenes)
          for (const r of s.src || []) (owners[r.s + ":" + r.b] = owners[r.s + ":" + r.b] || []).push(sceneRoot(s.id) + "@" + per.p);
      for (const key in owners) {
        const roots = owners[key].filter((x, i, a) => a.indexOf(x) === i);
        assert.equal(roots.length, 1, L.id + " " + m + "분: 블록 " + key + " 이 여러 장면에 겹쳐요 " + roots.join(" "));
      }
    }
  }
});

test("plan.json 레슨 차례 = units.json 배열 차례, 차시 정리 줄은 summaryOf 를 따라요", () => {
  const units = JSON.parse(readFileSync(join(ROOT, "..", "content", "aimath", "units.json"), "utf8")) as { lessons: { id: string }[] }[];
  const order: string[] = [];
  for (const u of units) for (const x of u.lessons) order.push(x.id);
  assert.deepEqual(Object.keys(PLAN.lessons), order.filter((id) => PLAN.lessons[id]));
  // summaryOf 가 없으면 줄 차례대로 고르게 나눠요(빈 차시 없음)
  for (const L of lessons) {
    const plan = PLAN.lessons[L.id];
    if (!plan || plan.periods.length < 2) continue;
    const bare = { ...plan } as PlanLesson & { summaryOf?: number[] };
    delete bare.summaryOf;
    const all: string[] = [];
    for (const per of lessonPeriods(L, bare, 45)) {
      const r = summaryForPeriod(L, bare, per);
      assert.ok(r.lines.length > 0, L.id);
      for (const x of r.lines) all.push(x);
    }
    assert.deepEqual(all, L.summary, L.id + ": summaryOf 없이도 빠짐없이");
    assert.equal(summaryForPeriod(L, plan, 0).title, "이 레슨 전체 정리");
    assert.equal(summaryForPeriod(L, plan, plan.periods.length, { whole: true }).title, "이 레슨 전체 정리");
    assert.equal(summaryForPeriod(L, plan, 1).title, "오늘 정리");
  }
});

test("첫 화면 문구: 기록 상태 한 줄 · 끝난 차시는 '처음부터' · 분모는 켜진 장면 수", () => {
  const prog = { "2-3": { "u1-1": "part" }, "2-4": { "u1-1": "done" }, "2-5": {} };
  assert.equal(markOf(prog, "2-3", "u1-1"), "part");
  assert.equal(markOf(prog, null, "u1-1"), "none");
  assert.equal(statusLine("2-3", "I-1", "part"), "2-3반 I-1 · 진행 중이에요.");
  assert.equal(statusLine("2-4", "I-1", "done"), "2-4반 I-1 · 끝난 레슨이에요.");
  assert.equal(statusLine(null, "I-1", "none"), "I-1 · 아직 시작 전이에요.");
  assert.deepEqual(startLabel("done", 4, 9), { label: "처음부터", sub: "장면 1/9부터", fromStart: true });
  assert.deepEqual(startLabel("part", 4, 9), { label: "이어서 수업", sub: "장면 4/9부터", fromStart: false });
  assert.equal(startLabel("none", 1, 7).label, "수업 시작");
  const order = ["u1-1", "u1-2"];
  const code = (id: string) => (id === "u1-1" ? "I-1" : "I-2");
  assert.equal(klassNowText(prog, "2-3", order, code), "2-3: I-1 진행 중");
  assert.equal(klassNowText(prog, "2-4", order, code), "2-4: I-1 끝");
  assert.equal(klassNowText(prog, "2-5", order, code), "2-5: 아직 시작 전");
});

test("이야기 장면을 모두 켜면: 늘어나는 분 · 수업 시간 넘침 안내 · 다음 차시 예고", () => {
  const sc = [
    { kind: "story", on: true, estMin: 1 },
    { kind: "story", on: false, estMin: 2 },
    { kind: "story", on: false, estMin: 1.5 },
    { kind: "concept", on: true, estMin: 10 },
  ] as const;
  const a = storyAdd(sc, 40, 45);
  assert.ok(a);
  assert.equal(a.add, 3.5);
  assert.equal(a.after, 43.5);
  assert.equal(a.over, 0);
  assert.ok(storyAddText(a).indexOf("안에 들어가요") > 0);
  const b = storyAdd(sc, 44, 45);
  assert.ok(b && b.over === 2.5);
  assert.ok(storyAddText(b).indexOf("대략 3분 길어요") > 0);
  assert.equal(storyAdd([{ kind: "story", on: true, estMin: 1 }], 10, 45), null);
  const secs = [{ heading: "가" }, { heading: "나" }, { heading: "" }];
  const pers = [{ p: 1, sections: [0] }, { p: 2, sections: [1, 2] }];
  assert.deepEqual(nextPeriodHeads(secs, pers, 1), ["나"]);
  assert.equal(nextPeriodHeads(secs, pers, 2), null);
});

test("모든 레슨·차시에서 이야기 켜기 안내가 계산돼요(꺼진 이야기 장면이 있을 때만)", () => {
  for (const L of lessons) {
    const c = compute(L, 45, 1);
    const a = storyAdd(c.scenes, c.total, 45);
    const offStory = c.scenes.filter((s) => s.kind === "story" && !s.on);
    assert.equal(!!a, offStory.length > 0, L.id);
    if (a) assert.ok(a.add > 0 && a.after > c.total, L.id);
  }
});

test("log 키 등록 + 모든 레슨에서 한 줄 판단이 이야기 안내와 모순되지 않아요", async () => {
  const { TEACHER_KEYS } = await import("../../src/shared/storage/keys.ts");
  const { timeVerdict } = await import("../../src/teacher/today/timebar.ts");
  assert.ok(TEACHER_KEYS.log);
  for (const L of lessons) {
    const c = compute(L, 45, 1);
    const a = storyAdd(c.scenes, c.total, 45);
    const v = timeVerdict(c.total, 45, a);
    assert.ok(!(/맞아요/.test(v.text) && a && a.over > 0), L.id + " " + v.text);
  }
});

test("줄이기 안내: 넘침이 0.5분 이하면 없고 0.8분(반올림하면 1분)이면 있어요(시간 판단과 같은 기준)", () => {
  const sc = { id: "s1", kind: "concept", on: true, required: false, estMin: 5, blocks: [] } as unknown as BuiltScene;
  const mk = (total: number) =>
    ({ total, scenes: [sc], flow: { suggest: { dropped: ["s1"], total: total - 5, over: 0 }, scenes: [] } }) as never;
  const a = cutInfo(mk(45.5), 45, null);
  assert.equal(a.over, 0);
  assert.equal(a.scenes.length, 0);
  const b = cutInfo(mk(45.8), 45, null);
  assert.ok(b.over > 0);
  assert.equal(b.scenes.length, 1);
  assert.equal(timeVerdict(45.5, 45, null).state === "over", a.over > 0);
  assert.equal(timeVerdict(45.8, 45, null).state === "over", b.over > 0);
});
