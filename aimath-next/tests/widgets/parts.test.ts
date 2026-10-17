// 공통 부품의 순수 계산(Plot·Stepper) 시험.
import test from "node:test";
import assert from "node:assert/strict";
import { clean, fmtNum, linScale, markerPath, niceTicks, plotHeight, seriesStyle, summarize, sampleFn } from "../../src/shared/widgets/plot.logic.ts";
import { decimalsOf, repeatDelay, snapValue, stepValue } from "../../src/shared/widgets/stepper.logic.ts";

test("niceTicks: 1·2·5 단위, 범위 안", () => {
  assert.deepEqual(niceTicks(0, 10, 5), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(niceTicks(-1, 7, 4), [0, 2, 4, 6]);
  const t = niceTicks(0, 1, 5);
  assert.ok(t.length >= 4 && t.length <= 11);
  for (const v of t) assert.ok(v >= 0 && v <= 1);
  assert.deepEqual(niceTicks(3, 3), [3]);
  assert.deepEqual(niceTicks(NaN, 3), []);
});

test("linScale: 위아래 뒤집힌 y 축도 되돌릴 수 있어요", () => {
  const y = linScale(0, 10, 300, 0);
  assert.equal(y(0), 300);
  assert.equal(y(10), 0);
  assert.equal(y.inv(150), 5);
});

test("plotHeight: equal 이면 한 칸 길이가 같아요", () => {
  const pad = { left: 40, right: 10, top: 10, bottom: 40 };
  const h = plotHeight(450, 0.6, 100, 2000, { x: [0, 10], y: [0, 10], pad });
  assert.equal(h - pad.top - pad.bottom, 450 - pad.left - pad.right);
  assert.equal(plotHeight(1000, 0.6, 100, 300), 300);
});

test("계열 s1~s5 는 색·선·표식이 모두 달라요", () => {
  const ss = [1, 2, 3, 4, 5].map(seriesStyle);
  assert.equal(new Set(ss.map((s) => s.cls)).size, 5);
  assert.equal(new Set(ss.map((s) => s.dash)).size, 5);
  assert.equal(new Set(ss.map((s) => s.marker)).size, 5);
  assert.equal(seriesStyle(6).cls, "wg-s1");
  for (const s of ss) assert.match(markerPath(s.marker, 10, 10, 4), /^M/);
});

test("fmtNum·clean: 음수 기호와 -0", () => {
  assert.equal(fmtNum(-1.5), "−1.5");
  assert.equal(fmtNum(0.1 + 0.2), "0.3");
  assert.equal(fmtNum(-0.0001, 2), "0");
  assert.equal(clean(-0), 0);
  assert.equal(fmtNum(Infinity), "∞");
});

test("summarize·sampleFn", () => {
  assert.match(summarize([{ label: "A", data: [{ x: 1, y: 2 }] }]), /A: 점 \(1, 2\)/);
  assert.match(summarize([]), /아무것도/);
  const pts = sampleFn((x) => 1 / x, -1, 1, 4);
  assert.ok(pts.every((p) => Number.isFinite(p.y)));
});

test("stepValue: 범위·눈금에 맞춰 한 칸씩", () => {
  assert.equal(decimalsOf(0.05), 2);
  assert.equal(decimalsOf(1), 0);
  assert.equal(decimalsOf(1e-7), 7);
  assert.equal(stepValue(0.1, 1, 0.05, -3, 3), 0.15);
  assert.equal(stepValue(0.3, 1, 0.1, 0, 1), 0.4); // 0.30000000000000004 같은 잡음 없음
  assert.equal(stepValue(10, 1, 1, 0, 10), 10);
  assert.equal(stepValue(0, -1, 1, 0, 10), 0);
  assert.equal(stepValue(250, 1, 5, 0, 255), 255);
  assert.equal(snapValue(7.3, 0.5, 0, 10), 7.5);
  assert.equal(snapValue(NaN, 1, 2, 5), 2);
  assert.ok(repeatDelay(0) > repeatDelay(10));
});
