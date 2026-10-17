import { test } from "node:test";
import assert from "node:assert/strict";
import { padKeysForQuestion, isFractionAnswer } from "../src/shared/ui/padKeys.ts";
import { isFractionValue, type Question } from "../src/shared/contracts.ts";
import { loadLessons, loadUnits } from "./shared/_content.ts";

const numQ = (over: Record<string, unknown>) =>
  ({ id: "t", level: 1, group: "개념 확인", prompt: "값을 구해요.", type: "number", answer: 5, hints: ["a", "b"], solution: "s", ...over }) as unknown as Question;

test("isFractionValue: 정수·유한소수는 아니고 1/3 꼴만 분수", () => {
  assert.equal(isFractionValue(3), false);
  assert.equal(isFractionValue(0.5), false);
  assert.equal(isFractionValue(3.14159), false);
  assert.equal(isFractionValue(1.414213), false);
  assert.equal(isFractionValue(1 / 3), true);
  assert.equal(isFractionValue(2 / 3), true);
});

test("5자리 이상 유한소수 정답은 '/' 키가 없어요, 무리수 √ 는 유지", () => {
  const q = numQ({ answer: 3.14159, hints: ["$\\pi$", "b"] });
  assert.equal(isFractionAnswer(q), false);
  const keys = padKeysForQuestion(q);
  assert.equal(keys.indexOf("/"), -1);
  assert.ok(keys.indexOf("π") >= 0);
  assert.ok(padKeysForQuestion(numQ({ answer: 1.41421, solution: "$\\sqrt{2}$" })).indexOf("√") >= 0);
});

test("전체 숫자 문제: 키 구성이 정답 유형과 어긋나지 않아요", () => {
  let n = 0;
  const check = (q: any) => {
    if (!q || q.type !== "number" || typeof q.answer !== "number") return;
    n++;
    const keys = padKeysForQuestion(q as Question);
    assert.equal(keys.indexOf("/") >= 0, isFractionAnswer(q as Question), q.id + " '/' 키");
    if (q.answer < 0) assert.ok(keys.indexOf("-") >= 0, q.id + " '-' 키");
    if (Math.abs(q.answer - Math.round(q.answer)) >= 1e-9) assert.ok(keys.indexOf(".") >= 0 || keys.indexOf("/") >= 0, q.id + " 소수점 키");
    assert.equal(new Set(keys).size, keys.length, q.id + " 중복 키");
  };
  for (const { lesson } of loadLessons()) (lesson.practice || []).forEach(check);
  for (const { unit } of loadUnits()) (unit.test || []).forEach(check);
  assert.ok(n > 50);
});
