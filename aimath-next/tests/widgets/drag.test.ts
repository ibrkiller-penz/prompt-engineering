// 끌기(손잡이) 순수 계산과 체험 도구 소스 규칙 시험.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NEW_WIDGETS } from "./_paths.ts";
import { PointerGate, arrowDelta, clientToData, handleSize, linScale, snapTo } from "../../src/shared/widgets/plot.logic.ts";
import { WIDGET_IDS } from "../../src/shared/widgets/ids.ts";

test("PointerGate: 첫 손가락만 받고 두 번째 손가락은 무시해요", () => {
  const g = new PointerGate();
  assert.equal(g.down(1, true, "a"), true);
  assert.equal(g.active, "a");
  // 첫 손가락을 누른 채 두 번째 손가락
  assert.equal(g.down(2, false, "b"), false);
  assert.equal(g.down(2, true, "b"), false);
  assert.equal(g.move(2), null);
  assert.equal(g.up(2), false);
  assert.equal(g.move(1), "a");
  assert.equal(g.up(1), true);
  assert.equal(g.active, null);
  // 기본이 아닌 포인터로는 시작하지 않아요
  assert.equal(g.down(3, false, "c"), false);
  // isPrimary 를 모르는 옛 브라우저(undefined)는 받아요
  assert.equal(g.down(4, undefined, "d"), true);
  g.reset();
  assert.equal(g.move(4), null);
});

test("clientToData: 화면 좌표 → 데이터 좌표, 범위 밖은 끝에 붙여요", () => {
  // 너비 200·높이 100 그림, 여백 없이 x 0..10, y 0..5(위가 5)
  const sx = linScale(0, 10, 0, 200);
  const sy = linScale(0, 5, 100, 0);
  const rect = { left: 50, top: 20, width: 400, height: 200 }; // 화면에서는 두 배로 보여요
  const p = clientToData(50 + 200, 20 + 100, rect, 200, 100, sx, sy, [0, 10], [0, 5]);
  assert.ok(Math.abs(p.x - 5) < 1e-9);
  assert.ok(Math.abs(p.y - 2.5) < 1e-9);
  const out = clientToData(-999, 9999, rect, 200, 100, sx, sy, [0, 10], [0, 5]);
  assert.deepEqual(out, { x: 0, y: 0 });
  const inv = clientToData(9999, -999, rect, 200, 100, sx, sy, [10, 0], [5, 0]);
  assert.deepEqual(inv, { x: 10, y: 5 });
});

test("snapTo·arrowDelta", () => {
  assert.equal(snapTo(2.26, 0.5, 0, 10), 2.5);
  assert.equal(snapTo(-3, 0.5, 0, 10), 0);
  assert.equal(snapTo(0.1 + 0.2, 0.1, 0, 1), 0.3);
  assert.equal(snapTo(NaN, 1, -6, 6), -6);
  assert.deepEqual(arrowDelta("ArrowUp"), [0, 1]);
  assert.deepEqual(arrowDelta("Left"), [-1, 0]);
  assert.equal(arrowDelta("Enter"), null);
});

test("handleSize: 칠판 손잡이 지름 48·잡히는 영역 80, 휴대폰 잡히는 영역 44 이상", () => {
  const b = handleSize("board");
  assert.equal(b.r * 2, 48);
  assert.equal(b.hit * 2, 80);
  assert.ok(handleSize("phone").hit * 2 >= 44);
  assert.ok(handleSize("prep").hit * 2 >= 44);
});

function widgetSources(): { id: string; src: string }[] {
  return WIDGET_IDS.map((id) => {
    const dir = join(NEW_WIDGETS, id);
    assert.ok(statSync(dir).isDirectory(), id + " 폴더");
    const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    return { id, src: files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n") };
  });
}

test("17종 화면은 옛 로직(@legacy/widgets/*.logic)만 가져오고 옛 화면은 가져오지 않아요", () => {
  for (const { id, src } of widgetSources()) {
    const legacy = src.match(/from\s+"@legacy\/[^"]+"/g) || [];
    assert.ok(legacy.length >= 1, id + " 는 옛 계산 로직을 써요");
    for (const imp of legacy) assert.match(imp, /^from\s+"@legacy\/widgets\/[A-Za-z]+\.logic"$/, id + ": " + imp);
    assert.ok(src.indexOf("useMission(") >= 0, id + " 는 미션을 판정해요");
  }
});

test("끌기가 있는 도구는 대체 조작(± 스테퍼)도 함께 둬요", () => {
  let dragging = 0;
  for (const { id, src } of widgetSources()) {
    if (src.indexOf("onDrag=") < 0) continue;
    dragging++;
    assert.ok(src.indexOf("<Stepper") >= 0, id + " 에 스테퍼 대체 조작");
  }
  assert.ok(dragging >= 6, "끌기 도구 " + dragging + "종");
});

test("체험 도구 CSS 는 Chrome 80 에서 안 되는 속성을 쓰지 않아요", () => {
  const css = readFileSync(join(NEW_WIDGETS, "widgets.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const bad of [/(^|[^-])\bgap\s*:/m, /aspect-ratio/, /:has\(/, /:is\(/, /:where\(/, /:focus-visible/, /(^|[\s;{])inset\s*:/m, /\bdvh\b/, /@layer/, /oklch/, /color-mix/, /@property/]) {
    assert.equal(bad.test(css), false, String(bad));
  }
});
