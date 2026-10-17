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

test("checkAnswer: 콘텐츠의 모든 숫자 문제는 정답을 그대로 치면 맞아요(단위·전각·x= 붙여도)", () => {
  const qs: any[] = [];
  for (const { lesson } of loadLessons()) qs.push(...lesson.practice);
  for (const { unit } of loadUnits()) qs.push(...unit.test);
  const nums = qs.filter((q) => q.type === "number");
  assert.ok(nums.length > 300, "숫자 문제 수: " + nums.length);
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
