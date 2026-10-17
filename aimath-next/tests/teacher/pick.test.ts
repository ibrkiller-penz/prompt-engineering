import { test } from "node:test";
import assert from "node:assert/strict";
import type { Lesson } from "../../src/shared/contracts.ts";
import {
  BOARD_MAX,
  BOARD_MIN,
  expandId,
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

test("pickAll: 모든 레슨·차시에서 칠판 5~8 · 끝 확인 3 · 숙제 5, 실제 있는 id, 서로 겹치지 않아요", () => {
  for (const L of lessons) {
    const byId: Record<string, Lesson["practice"][number]> = {};
    for (const q of L.practice) byId[q.id] = q;
    const pers = lessonPeriods(L, null, 45).concat([pickPeriod([], 0, L.sections.length)]);
    for (const per of pers) {
      const where = L.id + " " + per.p + "차시";
      const { board, exit, hw } = pickAll(L, null, per);
      for (const id of board.concat(exit, hw)) assert.ok(byId[id], where + ": 없는 문제 " + id);
      assert.ok(board.length >= BOARD_MIN && board.length <= BOARD_MAX, where + ": 칠판 " + board.length + "개");
      assert.equal(exit.length, 3, where + ": 끝 확인");
      assert.equal(hw.length, 5, where + ": 숙제");
      const all = board.concat(exit, hw);
      assert.equal(new Set(all).size, all.length, where + ": 겹쳐요");
      for (const id of all) assert.notEqual(byId[id].type, "open", where + ": 서술형 " + id);
      // 칠판: 개념 확인이 앞에, 실력 UP 1개 이하
      const kinds = board.map((id) => qKind(byId[id]));
      assert.equal(kinds[0], "check", where + ": 칠판 첫 문제는 개념 확인");
      assert.ok(kinds.filter((k) => k === "check").length <= 2, where);
      assert.ok(kinds.filter((k) => k === "adv").length <= 1, where);
      assert.ok(kinds.indexOf("chal") < 0, where + ": 도전 문제는 칠판에 넣지 않아요");
      // 끝 확인: 난이도 1~3, choice·ox 가 남아 있으면 choice·ox 만(모자랄 때만 number 로 채워요)
      const coLeft = L.practice.filter(
        (q) => (q.type === "choice" || q.type === "ox") && q.level <= 3 && board.indexOf(q.id) < 0 && qKind(q) !== "chal",
      ).length;
      const coInExit = exit.filter((id) => byId[id].type === "choice" || byId[id].type === "ox").length;
      assert.equal(coInExit, Math.min(3, coLeft), where + ": 끝 확인 choice·ox 개수");
      for (const id of exit) assert.ok(byId[id].level <= 3, where + ": 끝 확인 난이도 " + byId[id].level);
    }
  }
});

test("pickAll: 늘 같은 결과(무작위 없음)", () => {
  for (const L of lessons) {
    const per = lessonPeriods(L, null, 45)[0];
    assert.deepEqual(pickAll(L, null, per), pickAll(L, null, per));
  }
});

test("pickAll: plan 목록이 있으면 실제 있는 id 만 따라요", () => {
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
  assert.deepEqual(r.board, [L.practice[0].id, L.practice[1].id]);
  assert.deepEqual(r.exit, [L.practice[2].id], "칠판과 겹치는 것은 빼요");
  assert.deepEqual(r.hw, [L.practice[3].id]);
  const openQ = L.practice.filter((q) => q.type === "open")[0];
  assert.deepEqual(validIds(L, [openQ.id], { noOpen: true }), []);
});

test("questionSections: 기초력 문제는 소제목 범위 안, 레슨 전체 문제는 -1", () => {
  for (const L of lessons) {
    const m = questionSections(L);
    for (const q of L.practice) {
      const k = qKind(q);
      const s = m[q.id];
      if (k === "check" || k === "basic") assert.ok(s >= 0 && s < L.sections.length, L.id + " " + q.id);
      else assert.equal(s, -1, L.id + " " + q.id);
    }
  }
});

test("studentLink: 학생 주소 + 문제 id 만, 다시 읽으면 같은 값", () => {
  const url = studentLink("https://aimaths.web.app/", "u1-1", {
    hw: ["u1-1-q06", "u1-1-q11", "u1-1-q06"],
    ex: ["u1-1-q03", "<script>"],
  });
  assert.equal(url, "https://aimaths.web.app/#/l/u1-1?hw=q06,q11&ex=q03");
  assert.deepEqual(parseStudentLink(url), { lid: "u1-1", hw: ["u1-1-q06", "u1-1-q11"], ex: ["u1-1-q03"] });
  assert.equal(studentLink("https://aimaths.web.app", "u2-3"), "https://aimaths.web.app/#/l/u2-3");
  assert.equal(studentLink("https://aimaths.web.app", "u2-3", { ex: ["u2-3-q01"], short: false }), "https://aimaths.web.app/#/l/u2-3?ex=u2-3-q01");
  assert.throws(() => studentLink("https://aimaths.web.app", "../x"));
  assert.equal(shortId("u1-1", "u1-1-q06"), "q06");
  assert.equal(shortId("u1-1", "u2-1-q06"), "u2-1-q06");
  assert.equal(expandId("u1-1", "q06"), "u1-1-q06");
  assert.equal(expandId("u1-1", "u1-1-q06"), "u1-1-q06");
  // 주소에 반·이름 같은 다른 값이 들어가지 않아요
  assert.ok(!/class|name|ban|=[^,&]*[가-힣]/.test(url));
});

test("studentLink: 실제 pickAll 결과로 만든 주소의 문제는 모두 그 레슨에 있어요", () => {
  for (const L of lessons) {
    const r = pickAll(L, null, lessonPeriods(L, null, 45)[0]);
    const back = parseStudentLink(studentLink("https://aimaths.web.app", L.id, { hw: r.hw, ex: r.exit }));
    assert.ok(back);
    assert.deepEqual(back.hw, r.hw);
    assert.deepEqual(back.ex, r.exit);
  }
});
