// 입력 상태 보관(draft.logic) 시험: 메모리 안에서만, 범위가 바뀌거나 맞히면 비워요
import test from "node:test";
import assert from "node:assert/strict";
import { clearAllDrafts, clearDraft, draftCount, enterDraftScope, loadDraft, saveDraft } from "../../src/student/pages/draft.logic.ts";

test("저장한 답과 글을 그대로 돌려줘요(복사본)", () => {
  clearAllDrafts();
  enterDraftScope("u1-1");
  saveDraft("q1", { pick: 2, text: "" });
  saveDraft("q2", { pick: null, text: "3/4" });
  saveDraft("q3", { pick: false, text: "" });
  assert.deepEqual(loadDraft("q1"), { pick: 2, text: "" });
  assert.deepEqual(loadDraft("q2"), { pick: null, text: "3/4" });
  assert.deepEqual(loadDraft("q3"), { pick: false, text: "" });
  const d = loadDraft("q1")!;
  d.pick = 0;
  assert.equal(loadDraft("q1")!.pick, 2);
});

test("없는 문제는 undefined, 아무것도 안 고른 상태를 저장하면 지워져요", () => {
  clearAllDrafts();
  assert.equal(loadDraft("none"), undefined);
  saveDraft("q1", { pick: 1, text: "" });
  saveDraft("q1", { pick: null, text: "" });
  assert.equal(loadDraft("q1"), undefined);
  assert.equal(draftCount(), 0);
});

test("같은 레슨 안에서는 남고, 다른 레슨으로 가면 비워요", () => {
  clearAllDrafts();
  enterDraftScope("u1-1");
  saveDraft("q1", { pick: 0, text: "" });
  enterDraftScope("u1-1");
  assert.ok(loadDraft("q1"));
  enterDraftScope("u1-2");
  assert.equal(loadDraft("q1"), undefined);
});

test("맞히면 그 문제만 비워요", () => {
  clearAllDrafts();
  enterDraftScope("u2-1");
  saveDraft("a", { pick: 1, text: "" });
  saveDraft("b", { pick: 2, text: "" });
  clearDraft("a");
  assert.equal(loadDraft("a"), undefined);
  assert.ok(loadDraft("b"));
});

test("저장소(localStorage)를 건드리지 않아요", () => {
  const g = globalThis as { localStorage?: unknown };
  assert.equal(typeof g.localStorage, "undefined");
  saveDraft("z", { pick: 1, text: "x" });
  assert.equal(typeof g.localStorage, "undefined");
});
