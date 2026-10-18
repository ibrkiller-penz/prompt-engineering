import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Lesson, Plan, PlanLesson } from "../../src/shared/contracts.ts";
import {
  BOARD_MAX,
  BOARD_MIN,
  EXIT_N,
  HW_N,
  expandId,
  isSplitPeriod,
  mergeBoard,
  sectionCheckIds,
  type PlanTags,
  parseStudentLink,
  pickAll,
  qKind,
  questionSections,
  shortId,
  studentLink,
  validIds,
} from "../../src/teacher/logic/pick.logic.ts";
import { lessonPeriods, pickPeriod } from "../../src/teacher/logic/periods.logic.ts";
import { loadLessons } from "../shared/_content.ts";

const lessons = loadLessons().map((x) => x.lesson as unknown as Lesson);

const PLAN = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "plan.json"), "utf8")) as Plan;
const planOf = (L: Lesson) => (PLAN.lessons[L.id] || null) as (PlanLesson & PlanTags) | null;

test("pickAll: 모든 레슨·차시에서 칠판 5~8 · 끝 확인 3 · 숙제 5, 실제 있는 id, 서로 겹치지 않아요", () => {
  for (const L of lessons) {
    const plan = planOf(L);
    const byId: Record<string, Lesson["practice"][number]> = {};
    for (const q of L.practice) byId[q.id] = q;
    const secOf = questionSections(L, plan);
    for (const m of [45, 50, 70]) {
      const pers = lessonPeriods(L, plan, m).concat([pickPeriod([], 0, L.sections.length)]);
      for (const per of pers) {
        const where = L.id + " " + m + "분 " + per.p + "차시";
        const split = isSplitPeriod(per);
        const inP = (id: string) => per.sections.indexOf(secOf[id]) >= 0;
        const okQ = (id: string) => (split ? inP(id) : true);
        const { board, exit, hw } = pickAll(L, plan, per);
        for (const id of board.concat(exit, hw)) assert.ok(byId[id], where + ": 없는 문제 " + id);
        assert.ok(board.length >= BOARD_MIN && board.length <= BOARD_MAX, where + ": 칠판 " + board.length + "개");
        const all = board.concat(exit, hw);
        assert.equal(new Set(all).size, all.length, where + ": 겹쳐요");
        for (const id of all) assert.notEqual(byId[id].type, "open", where + ": 서술형 " + id);
        // 차시를 나눈 레슨: 세 바구니 모두 이 차시 소제목 문제만
        if (split) for (const id of all) assert.ok(inP(id), where + ": 다른 차시 소제목 문제 " + id + " (소제목 " + secOf[id] + ")");
        // 칠판 앞머리 = 이 차시 소제목들의 끝 확인 문제(소제목 차례)
        const checks = sectionCheckIds(L, plan, per.sections).map((x) => x.id);
        assert.deepEqual(board.slice(0, checks.length), checks, where + ": 칠판 앞머리는 소제목 끝 확인");
        const kinds = board.map((id) => qKind(byId[id]));
        assert.ok(kinds.filter((k) => k === "adv").length <= 1, where);
        assert.ok(kinds.indexOf("chal") < 0, where + ": 도전 문제는 칠판에 넣지 않아요");
        // 끝 확인: 3개(고를 문제가 모자랄 때만 덜), 낮은 난이도(1~3)를 먼저 쓰지만 계단이 뒤로 갈수록 난이도가 올라가서 제한은 두지 않아요, choice·ox 가 남아 있으면 choice·ox 만
        const exitCand = L.practice.filter((q) => q.type !== "open" && board.indexOf(q.id) < 0 && okQ(q.id));
        assert.equal(exit.length, Math.min(EXIT_N, exitCand.length), where + ": 끝 확인 수");
        const coLeft = exitCand.filter((q) => (q.type === "choice" || q.type === "ox") && (split || qKind(q) !== "chal")).length;
        const coInExit = exit.filter((id) => byId[id].type === "choice" || byId[id].type === "ox").length;
        assert.equal(coInExit, Math.min(3, coLeft), where + ": 끝 확인 choice·ox 개수");
        // 숙제: 5개(이 차시에 남은 문제가 모자랄 때만 덜)
        const pool = L.practice.filter((q) => q.type !== "open" && okQ(q.id)).length;
        assert.equal(hw.length, Math.min(HW_N, pool - board.length - exit.length), where + ": 숙제 수");
      }
    }
  }
});

test("pickAll: 늘 같은 결과(무작위 없음)", () => {
  for (const L of lessons) {
    const per = lessonPeriods(L, planOf(L), 45)[0];
    assert.deepEqual(pickAll(L, planOf(L), per), pickAll(L, planOf(L), per));
  }
});

test("pickAll: plan 목록이 있으면 실제 있는 id 만 따라요(앞머리에는 소제목 끝 확인)", () => {
  const L = lessons[0];
  const plan = {
    lid: L.id,
    sectionChecks: [],
    corePath: [],
    board: [L.practice[0].id, "없는-id", L.practice[1].id],
    exit: [L.practice[1].id, L.practice[2].id],
    hw: [L.practice[3].id],
    periods: [],
  };
  const r = pickAll(L, plan, null);
  const checks = sectionCheckIds(L, plan).map((x) => x.id);
  const board = mergeBoard(checks, [L.practice[0].id, L.practice[1].id]);
  assert.deepEqual(r.board, board);
  // 칠판과 겹치는 것은 빼요. 다 빠지면 자동으로 골라요
  const ex = [L.practice[1].id, L.practice[2].id].filter((id) => board.indexOf(id) < 0);
  if (ex.length) assert.deepEqual(r.exit, ex);
  else assert.equal(r.exit.length, EXIT_N);
  for (const id of r.exit) assert.ok(board.indexOf(id) < 0, "칠판과 겹치는 것은 빼요");
  const hw = [L.practice[3].id].filter((id) => board.concat(r.exit).indexOf(id) < 0);
  if (hw.length) assert.deepEqual(r.hw, hw);
  else assert.equal(r.hw.length, HW_N);
  const openQ = L.practice.filter((q) => q.type === "open")[0];
  if (openQ) assert.deepEqual(validIds(L, [openQ.id], { noOpen: true }), []); // 인공지능 기초에는 서술형이 없어요
  assert.deepEqual(validIds(L, ["없는-id"], { noOpen: true }), []);
});

test("pickAll: 나눈 차시면 plan 목록도 이 차시 소제목 것만 남기고, 모자라면 채워요", () => {
  for (const L of lessons) {
    const plan = planOf(L);
    if (!plan) continue;
    const pers = lessonPeriods(L, plan, 45);
    if (pers.length < 2) continue;
    const secOf = questionSections(L, plan);
    // 레슨 전체 칠판 목록을 1차시 목록으로 억지로 넣어 봐요
    const p1 = { ...pers[0], plan: { ...(pers[0].plan || { p: 1, sections: pers[0].sections, minutes: 45 }), board: plan.board, exit: plan.exit, hw: plan.hw } };
    const r = pickAll(L, plan, p1);
    for (const id of r.board.concat(r.exit, r.hw)) assert.ok(p1.sections.indexOf(secOf[id]) >= 0, L.id + ": " + id);
    assert.ok(r.board.length >= BOARD_MIN, L.id + ": 칠판 " + r.board.length);
  }
});

test("questionSections: plan 없이는 기초력 문제만 소제목, 레슨 전체 문제는 -1 · plan 태그(secOf)가 있으면 모두 소제목", () => {
  for (const L of lessons) {
    const m = questionSections(L);
    for (const q of L.practice) {
      const k = qKind(q);
      const s = m[q.id];
      if (k === "check" || k === "basic") assert.ok(s >= 0 && s < L.sections.length, L.id + " " + q.id);
      else assert.equal(s, -1, L.id + " " + q.id);
    }
    const t = questionSections(L, planOf(L));
    for (const q of L.practice) assert.ok(t[q.id] >= 0 && t[q.id] < L.sections.length, L.id + " " + q.id + " 태그 " + t[q.id]);
    // 범위를 벗어난 태그는 무시해요
    const bad = questionSections(L, { secOf: { [L.practice[0].id]: 99 } });
    assert.equal(bad[L.practice[0].id], m[L.practice[0].id]);
  }
});

test("sectionCheckIds: 소제목마다 1개, 그 소제목으로 태그된 문제, 서술형 아님", () => {
  for (const L of lessons) {
    const plan = planOf(L);
    const secOf = questionSections(L, plan);
    const got = sectionCheckIds(L, plan);
    assert.deepEqual(got.map((x) => x.s), L.sections.map((_, i) => i), L.id + ": 모든 소제목에 확인 문제");
    for (const { s, id } of got) {
      const q = L.practice.filter((x) => x.id === id)[0];
      assert.ok(q && q.type !== "open", L.id + " " + id);
      assert.equal(secOf[id], s, L.id + ": " + id + " 은 소제목 " + s + " 문제여야 해요");
    }
  }
});

test("studentLink: 학생 주소 + 문제 id 만, 다시 읽으면 같은 값", () => {
  const url = studentLink("https://aibasics.web.app/", "u1_1_1", {
    hw: ["u1_1_1-q6", "u1_1_1-q11", "u1_1_1-q6"],
    ex: ["u1_1_1-q3", "<script>"],
  });
  assert.equal(url, "https://aibasics.web.app/#/l/u1_1_1?hw=q6,q11&ex=q3");
  assert.deepEqual(parseStudentLink(url), { lid: "u1_1_1", hw: ["u1_1_1-q6", "u1_1_1-q11"], ex: ["u1_1_1-q3"] });
  assert.equal(studentLink("https://aibasics.web.app", "u2_1_3"), "https://aibasics.web.app/#/l/u2_1_3");
  assert.equal(studentLink("https://aibasics.web.app", "u2_1_3", { ex: ["u2_1_3-q1"], short: false }), "https://aibasics.web.app/#/l/u2_1_3?ex=u2_1_3-q1");
  assert.throws(() => studentLink("https://aibasics.web.app", "../x"));
  assert.equal(shortId("u1_1_1", "u1_1_1-q6"), "q6");
  assert.equal(shortId("u1_1_1", "u2_1_1-q06"), "u2_1_1-q06");
  assert.equal(expandId("u1_1_1", "q6"), "u1_1_1-q6");
  assert.equal(expandId("u1_1_1", "u1_1_1-q6"), "u1_1_1-q6");
  // 주소에 반·이름 같은 다른 값이 들어가지 않아요
  assert.ok(!/class|name|ban|=[^,&]*[가-힣]/.test(url));
});

test("studentLink: 실제 pickAll 결과로 만든 주소의 문제는 모두 그 레슨에 있어요", () => {
  for (const L of lessons) {
    const r = pickAll(L, planOf(L), lessonPeriods(L, planOf(L), 45)[0]);
    const back = parseStudentLink(studentLink("https://aibasics.web.app", L.id, { hw: r.hw, ex: r.exit }));
    assert.ok(back);
    assert.deepEqual(back.hw, r.hw);
    assert.deepEqual(back.ex, r.exit);
  }
});
