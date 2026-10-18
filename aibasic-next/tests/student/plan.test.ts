// data/plan.json 검사: 지금 콘텐츠로 만든 초안과 같고(keep: true 레슨 제외, keep 배열 필드는 남긴 값 그대로), id 가 모두 실제 문제예요.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLessons } from "../shared/_content.ts";
// @ts-ignore — .mjs 스크립트(타입 없음)
import { buildPlan, CORE_MAX, CORE_MIN, KEEP_FIELDS, splitQuestion, TWO_PERIOD_MIN_SECTIONS } from "../../scripts/gen-plan.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "..", "..", "data", "plan.json"), "utf8"));
const lessons = loadLessons().map((x) => x.lesson);

test("plan.json 에 26레슨이 모두 있고, 지금 콘텐츠로 만든 초안과 같아요(keep: true 레슨 제외)", () => {
  assert.equal(Object.keys(plan.lessons).length, lessons.length);
  const fresh: { lessons: Record<string, unknown> } = buildPlan(plan);
  for (const lid of Object.keys(fresh.lessons)) {
    if (plan.lessons[lid].keep === true) continue;
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
    assert.equal(p.periods.length, L.sections.length >= TWO_PERIOD_MIN_SECTIONS ? 2 : 1, where + ": 차시 수(레슨당 1~2차시)");
    for (const q of L.practice) assert.ok(q.id in p.sectionOf, where + " sectionOf " + q.id);
  }
});

/** gen-plan 의 buildPlan 결과(타입 없는 .mjs) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rebuilt = (prev: unknown): Record<string, any> => (buildPlan(prev) as { lessons: Record<string, unknown> }).lessons;

test("plan.json: keep 에 적힌 필드는 다시 만들어도 사람이 고친 값 그대로예요", () => {
  const prev = JSON.parse(JSON.stringify(plan));
  const L = lessons.filter((x: { id: string }) => prev.lessons[x.id].periods.length === 2)[0];
  const P = prev.lessons[L.id];
  // 사람이 고친 것처럼 바꿔 봐요
  P.keep = KEEP_FIELDS.slice();
  P.sectionChecks = P.sectionChecks.slice().reverse().map((x: string[]) => x.slice(0, 1));
  P.summaryOf = P.summaryOf.map(() => 0);
  const tagQ = L.practice[L.practice.length - 1].id;
  P.secOf = { ...P.secOf, [tagQ]: 0 };
  P.periods[0].question = "손으로 쓴 1차시 질문이에요?";
  P.periods[1].question = "손으로 쓴 2차시 질문이에요?";
  const again = rebuilt(prev)[L.id];
  assert.deepEqual(again.keep, KEEP_FIELDS);
  assert.deepEqual(again.sectionChecks, P.sectionChecks, "sectionChecks");
  assert.deepEqual(again.summaryOf, P.summaryOf, "summaryOf");
  assert.equal(again.secOf[tagQ], 0, "secOf");
  assert.equal(again.sectionOf[tagQ], 0, "secOf 가 sectionOf 에 반영돼요");
  assert.deepEqual(again.periods.map((x: { question: string }) => x.question), ["손으로 쓴 1차시 질문이에요?", "손으로 쓴 2차시 질문이에요?"]);
  // keep 이 없으면 다시 만든 값으로 돌아가요
  delete P.keep;
  const fresh = rebuilt(prev)[L.id];
  assert.notDeepEqual(fresh.sectionChecks, P.sectionChecks);
  // keep: true 는 레슨 전체를 그대로
  P.keep = true;
  assert.deepEqual(rebuilt(prev)[L.id], P);
});

test("plan.json: 확인 문제·태그·정리 줄·차시 질문이 소제목과 맞아요", () => {
  for (const L of lessons) {
    const p = plan.lessons[L.id];
    const where = L.id;
    // 소제목 끝 확인 문제는 그 소제목 문제(sectionOf)
    p.sectionChecks.forEach((ids: string[], i: number) => {
      for (const id of ids) assert.equal(p.sectionOf[id], i, where + ": 소제목 " + i + " 확인 문제 " + id + " 이 소제목 " + p.sectionOf[id] + " 문제예요");
    });
    // 모든 문제에 소제목 태그(레슨 전체 -1 없음)
    for (const q of L.practice) assert.ok(p.sectionOf[q.id] >= 0 && p.sectionOf[q.id] < L.sections.length, where + " " + q.id);
    for (const id of Object.keys(p.secOf)) assert.ok(L.practice.some((q: { id: string }) => q.id === id), where + " secOf " + id);
    // 정리 줄 → 소제목
    assert.equal(p.summaryOf.length, (L as unknown as { summary: string[] }).summary.length, where + ": summaryOf 길이");
    for (const s of p.summaryOf) assert.ok(s >= -1 && s < L.sections.length, where + " summaryOf " + s);
    // 2차시 레슨은 차시마다 1~2줄 질문
    // 핵심 질문이 하나뿐인 레슨은 차시별 질문이 없어도 돼요(없으면 레슨 질문을 그대로 써요). 있으면 90자 이하
    if (p.periods.length > 1) for (const pp of p.periods) assert.ok(pp.question === undefined || (typeof pp.question === "string" && pp.question.length > 0 && pp.question.length <= 90), where + ": 차시 질문 " + pp.question);
  }
  assert.deepEqual(splitQuestion("가는 무엇일까? 그리고 나는 왜 그럴까?", 2), ["가는 무엇일까?", "나는 왜 그럴까?"]);
  assert.equal(splitQuestion("하나뿐이에요?", 2), null);
});
