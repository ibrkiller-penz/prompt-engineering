import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAnswer, normalizeAnswer, parseAnswerNumber } from "../../src/shared/logic/answer.ts";
import type { LQuestion } from "../../src/shared/logic/types.ts";
import { loadLessons, loadUnits } from "./_content.ts";

const num = (answer: number, extra: Partial<{ tolerance: number; unit: string }> = {}): LQuestion => ({
  id: "t",
  type: "number",
  answer,
  ...extra,
});
const st = (q: LQuestion, s: string | number | boolean) => checkAnswer(q, s).status;

test("normalizeAnswer: 전각·마이너스·앞말", () => {
  assert.equal(normalizeAnswer("３．５"), "3.5");
  assert.equal(normalizeAnswer("−2"), "-2");
  assert.equal(normalizeAnswer("－２"), "-2");
  assert.equal(normalizeAnswer("x=3"), "3");
  assert.equal(normalizeAnswer(" y = -2 "), "-2");
  assert.equal(normalizeAnswer("답: 7"), "7");
  assert.equal(normalizeAnswer("약 3.14"), "3.14");
  assert.equal(normalizeAnswer("$\\frac{3}{4}$"), "3/4");
  assert.equal(normalizeAnswer("½"), "0.5");
});

test("parseAnswerNumber: 여러 꼴", () => {
  const v = (s: string, u?: string) => {
    const p = parseAnswerNumber(s, u);
    return p ? p.value : null;
  };
  assert.equal(v("3/4"), 0.75);
  assert.equal(v("-3/4"), -0.75);
  assert.equal(v("1 1/2"), 1.5);
  assert.equal(v("1½"), 1.5);
  assert.equal(v("-1½"), -1.5);
  assert.equal(v("1,200"), 1200);
  assert.equal(v("1,2"), null);
  assert.equal(v("15명", "명"), 15);
  assert.equal(v("15 명"), 15);
  assert.equal(v("10만 원", "만 원"), 10);
  assert.equal(v("60°"), 60);
  assert.equal(v(".5"), 0.5);
  assert.equal(v("+4"), 4);
  assert.equal(v("(-3)"), -3);
  assert.equal(v("3/0"), null);
  assert.equal(v("abc"), null);
  assert.equal(v(""), null);
  assert.equal(v("２／３"), 2 / 3);
  const p = parseAnswerNumber("62%");
  assert.ok(p && p.percent && p.value === 62);
});

test("checkAnswer: 숫자 문제", () => {
  assert.equal(st(num(3), "x=3"), "correct");
  assert.equal(st(num(3), "３"), "correct");
  assert.equal(st(num(-2), "−2"), "correct");
  assert.equal(st(num(0.5, { tolerance: 0.001 }), "½"), "correct");
  assert.equal(st(num(0.5), "1/2"), "correct");
  assert.equal(st(num(0.75), "3/4"), "correct");
  assert.equal(st(num(0.6667, { tolerance: 0.001 }), "2/3"), "correct", "분수 = 소수");
  assert.equal(st(num(0.67, { tolerance: 0.006 }), "2/3"), "correct");
  assert.equal(st(num(0.67, { tolerance: 0.001 }), "0.7"), "wrong");
  assert.equal(st(num(20, { unit: "%" }), "20%"), "correct");
  assert.equal(st(num(20, { unit: "%" }), "20"), "correct");
  assert.equal(st(num(0.62, { tolerance: 0.001 }), "62%"), "correct", "% 를 소수로");
  assert.equal(st(num(0.3), "0.1+0.2"), "invalid");
  assert.equal(st(num(0.3), String(0.1 + 0.2)), "correct", "부동소수 오차");
  assert.equal(st(num(5), "6"), "wrong");
  assert.equal(st(num(5), "다섯"), "invalid");
  assert.equal(st(num(5), ""), "invalid");
  assert.equal(st(num(5), 5), "correct");
  assert.equal(st(num(24883200, { unit: "바이트" }), "24,883,200바이트"), "correct");
  const r = checkAnswer(num(4), "4.0");
  assert.equal(r.value, 4);
});

test("checkAnswer: 고르기·OX·서술형", () => {
  const ch: LQuestion = { id: "c", type: "choice", choices: ["a", "b", "c"], answer: 1 };
  assert.equal(st(ch, 1), "correct");
  assert.equal(st(ch, 0), "wrong");
  assert.equal(st(ch, 5), "invalid");
  assert.equal(st(ch, "1"), "correct");
  const ox: LQuestion = { id: "o", type: "ox", answer: false };
  assert.equal(st(ox, false), "correct");
  assert.equal(st(ox, "X"), "correct");
  assert.equal(st(ox, "Ｏ"), "wrong");
  assert.equal(st(ox, "몰라"), "invalid");
  const op: LQuestion = { id: "p", type: "open" };
  assert.equal(st(op, "아무거나"), "self");
});

test("콘텐츠 문제는 선택형·OX 뿐이고, 정답 번호가 보기 안에 있어요 · 숫자 문제가 있으면 정답을 그대로 치면 맞아요", () => {
  const qs: any[] = [];
  for (const { lesson } of loadLessons()) qs.push(...lesson.practice);
  for (const { unit } of loadUnits()) qs.push(...unit.test);
  const nums = qs.filter((q) => q.type === "number");
  assert.ok(qs.length > 1100, "문제 수: " + qs.length);
  for (const q of qs) {
    assert.ok(q.type === "choice" || q.type === "ox" || q.type === "number", q.id + " 종류 " + q.type);
    if (q.type === "choice") {
      assert.ok(Array.isArray(q.choices) && q.choices.length >= 2 && q.choices.length <= 5, q.id + " 보기 수");
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, q.id + " 정답 번호");
    }
    if (q.type === "ox") assert.equal(typeof q.answer, "boolean", q.id);
    assert.ok(Array.isArray(q.hints) && q.hints.length === 2 && q.hints.every((h: unknown) => typeof h === "string" && h.trim()), q.id + " 힌트 2개");
    assert.ok(typeof q.solution === "string" && q.solution.trim(), q.id + " 풀이");
  }
  const toWide = (s: string) => s.replace(/[0-9.\-]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));
  for (const q of nums) {
    const a = String(q.answer);
    assert.equal(st(q, a), "correct", q.id + " " + a);
    assert.equal(st(q, toWide(a)), "correct", q.id + " 전각");
    assert.equal(st(q, "x = " + a.replace("-", "−")), "correct", q.id + " x=");
    if (q.unit) assert.equal(st(q, a + q.unit), "correct", q.id + " 단위");
    assert.equal(st(q, String(q.answer + 1)), "wrong", q.id + " 오답");
  }
});

test("checkAnswer: 단위를 띄어 써도(10 명) 붙여 써도(10명) 맞아요 — 화면의 정답 글자는 한글 단위를 붙여 써요", () => {
  assert.equal(st(num(10, { unit: "명" }), "10명"), "correct");
  assert.equal(st(num(10, { unit: "명" }), "10 명"), "correct");
  assert.equal(st(num(10, { unit: "명" }), "11명"), "wrong");
  const qs: any[] = [];
  for (const { lesson } of loadLessons()) qs.push(...lesson.practice);
  for (const { unit } of loadUnits()) qs.push(...unit.test);
  for (const q of qs.filter((x) => x.type === "number" && x.unit)) {
    assert.equal(st(q, String(q.answer) + " " + q.unit), "correct", q.id + " 띄어 쓴 단위");
  }
});
