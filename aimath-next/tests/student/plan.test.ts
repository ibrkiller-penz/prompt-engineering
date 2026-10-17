// data/plan.json 검사: 지금 콘텐츠로 만든 초안과 같고(사람이 고친 keep 레슨 제외), id 가 모두 실제 문제예요.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLessons } from "../shared/_content.ts";
// @ts-ignore — .mjs 스크립트(타입 없음)
import { buildPlan, CORE_MAX, CORE_MIN } from "../../scripts/gen-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "..", "..", "data", "plan.json"), "utf8"));
const lessons = loadLessons().map((x) => x.lesson);

test("plan.json 에 20레슨이 모두 있고, 지금 콘텐츠로 만든 초안과 같아요(keep 레슨 제외)", () => {
  assert.equal(Object.keys(plan.lessons).length, lessons.length);
  const fresh: { lessons: Record<string, unknown> } = buildPlan(plan);
  for (const lid of Object.keys(fresh.lessons)) {
    if (plan.lessons[lid].keep) continue;
    assert.deepEqual(plan.lessons[lid], fresh.lessons[lid], lid + ": npm run gen:plan 으로 다시 만들어요");
  }
});

test("plan.json 의 문제 id 는 모두 그 레슨에 있고, 규칙을 지켜요", () => {
  for (const L of lessons) {
    const p = plan.lessons[L.id];
    assert.ok(p, L.id);
    const has = (id: string) => L.practice.some((q: { id: string }) => q.id === id);
    const where = L.id;
    assert.equal(p.sectionChecks.length, L.sections.length, where + ": 소제목 수");
    const flat: string[] = [].concat(...p.sectionChecks);
    for (const id of flat) assert.ok(has(id), where + " 확인 문제 " + id);
    p.sectionChecks.forEach((ids: string[], i: number) => assert.ok(ids.length >= 1 && ids.length <= 2, where + " 소제목 " + i + " 확인 문제 수 " + ids.length));
    assert.ok(p.corePath.length >= CORE_MIN && p.corePath.length <= CORE_MAX, where + " corePath " + p.corePath.length);
    for (const id of p.corePath) {
      assert.ok(has(id), where + " corePath " + id);
      assert.ok(flat.indexOf(id) < 0, where + ": corePath 와 확인 문제가 겹쳐요 " + id);
    }
    assert.equal(new Set(p.corePath).size, p.corePath.length);
    for (const k of ["board", "exit", "hw"]) for (const id of p[k]) assert.ok(has(id), where + " " + k + " " + id);
    const secs = ([] as number[]).concat(...p.periods.map((x: { sections: number[] }) => x.sections));
    assert.deepEqual(secs, L.sections.map((_: unknown, i: number) => i), where + ": 차시가 소제목을 빠짐없이 순서대로 나눠요");
    assert.equal(p.periods.length, (L as unknown as { minutes: number }).minutes > 50 ? 2 : 1, where + ": 차시 수");
    for (const q of L.practice) assert.ok(q.id in p.sectionOf, where + " sectionOf " + q.id);
  }
});
