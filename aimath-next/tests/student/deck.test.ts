// 카드 덱: 소제목 끝 확인 카드가 plan.sectionChecks 의 모든 id 를 보여 주는지(읽음 조건과 같은 문제 묶음).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDeck, type DeckLesson } from "../../src/student/pages/deck.logic.ts";

const PLAN = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "plan.json"), "utf8"));

test("확인 카드가 소제목의 확인 문제 id 를 모두 담아요", () => {
  const lesson: DeckLesson = { story: [], question: "q", sections: [{ heading: "a", blocks: [] }, { heading: "b", blocks: [] }], summary: [] };
  const steps = buildDeck(lesson, [["x1", "x2"], ["y1"]]);
  const c1 = steps.find((s) => s.id === "c1")!.cards.filter((c) => c.k === "check");
  assert.deepEqual(c1.length === 1 && c1[0].k === "check" ? c1[0].qids : null, ["x1", "x2"]);
});

test("plan.json 의 모든 레슨에서 확인 카드 id 목록 = sectionChecks", () => {
  for (const lid of Object.keys(PLAN.lessons)) {
    const checks: string[][] = PLAN.lessons[lid].sectionChecks;
    const lesson: DeckLesson = { story: [], question: "q", sections: checks.map((_, i) => ({ heading: "h" + i, blocks: [] })), summary: [] };
    const steps = buildDeck(lesson, checks);
    checks.forEach((ids, i) => {
      const cards = steps.find((s) => s.id === "c" + (i + 1))!.cards.filter((c) => c.k === "check");
      assert.equal(cards.length, 1, lid + " 소제목 " + i);
      assert.deepEqual(cards[0].k === "check" ? cards[0].qids : [], ids, lid + " 소제목 " + i);
    });
  }
});
