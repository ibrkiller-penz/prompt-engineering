import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildContentIndex, CONTENT_DIR, choseong, isBasicGroup } from "../tools/content-index.mjs";
import { lessonLabel, lessonsOfUnit, screenCode, unitBasicIds, unitByNumber, unitOfLesson, whereIsQuestion } from "../src/content/order.ts";
import { applyTone, chipsFor, mapStrings, type ToneReport } from "../src/content/tone.ts";
import type { ContentIndex, Lesson, ToneFile, UnitContent, UnitMeta } from "../src/shared/contracts.ts";

const built = buildContentIndex();
const idx: ContentIndex = built.index;
const unitsJson: UnitMeta[] = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "units.json"), "utf8"));

test("4단원 26레슨을 모두 읽어요", () => {
  assert.equal(idx.units.length, 4);
  assert.equal(idx.order.length, 26);
  assert.equal(Object.keys(idx.lessons).length, 26);
  assert.equal(idx.totals.lessons, 26);
  assert.ok(idx.totals.practice > 1000);
  assert.deepEqual(
    idx.units.map((u) => u.lessonIds.length),
    [5, 10, 6, 5],
  );
});

test("화면 순서는 units.json 배열 순서이고 id 는 u2_1_3 모양이에요", () => {
  const expected = unitsJson.flatMap((u) => u.lessons.map((l) => l.id));
  assert.deepEqual(idx.order, expected);
  for (const id of idx.order) assert.match(id, /^u[1-4]_[0-9A-Za-z_]+$/);
  const u1 = lessonsOfUnit(idx, 1).map((l) => l.id);
  assert.deepEqual(u1, ["u1_1_1", "u1_1_2", "u1_2_1", "u1_2_2", "u1_A"]);
  // 화면 번호는 원본 id 를 따라가요(교과서 단원 번호처럼)
  assert.equal(idx.lessons["u1_1_1"].code, "Ⅰ-1-1");
  assert.equal(idx.lessons["u2_1_3"].code, "Ⅱ-1-3");
  assert.equal(idx.lessons["u2_A"].code, "Ⅱ-A");
  assert.equal(idx.lessons["u4_2"].code, "Ⅳ-2");
  assert.equal(screenCode("Ⅳ", 2), "Ⅳ-2");
  assert.equal(screenCode("Ⅱ", 4, "2-1-3"), "Ⅱ-1-3");
});

test("앞뒤 레슨 사슬", () => {
  assert.equal(idx.lessons[idx.order[0]].prev, null);
  assert.equal(idx.lessons[idx.order[idx.order.length - 1]].next, null);
  for (let i = 1; i < idx.order.length; i++) {
    assert.equal(idx.lessons[idx.order[i]].prev, idx.order[i - 1]);
    assert.equal(idx.lessons[idx.order[i - 1]].next, idx.order[i]);
  }
});

test("색인과 원본 레슨 본문이 맞아요(파일 경로·문제·소제목)", () => {
  for (const lid of idx.order) {
    const meta = idx.lessons[lid];
    assert.match(meta.file, /^u\d\/lesson-u\d_[0-9A-Za-z_]+\.json$/);
    const l: Lesson = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, meta.file), "utf8"));
    assert.equal(l.id, lid);
    assert.equal(l.unit, meta.unit);
    assert.equal(meta.sections.length, l.sections.length);
    assert.deepEqual(meta.qids, l.practice.map((q) => q.id));
    assert.deepEqual(meta.basicIds, l.practice.filter((q) => isBasicGroup(q.group)).map((q) => q.id));
    assert.ok(meta.basicIds.length >= 30, lid + " 문제 수");
    assert.ok(meta.checkIds.length > 0, lid + " 계단 확인");
    const sum = Object.keys(meta.byGroup).reduce((a, k) => a + meta.byGroup[k], 0);
    assert.equal(sum, l.practice.length);
    assert.deepEqual(meta.widgetIds, [], "체험 도구는 쓰지 않아요");
    assert.equal(meta.prereq, 0);
    assert.equal(meta.goals, (l.goals || []).length);
    for (const q of l.practice) assert.match(q.id, new RegExp("^" + lid + "-q\\d+$"));
  }
});

test("단원 마무리 문제와 단원 도우미", () => {
  for (const u of idx.units) {
    const doc: UnitContent = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, u.file), "utf8"));
    assert.equal(u.testIds.length, doc.test.length);
    assert.ok(u.testIds.length >= 15, u.slug);
    assert.equal(unitByNumber(idx, u.id), u);
  }
});

test("문제 id 는 모두 하나뿐이고 위치를 찾을 수 있어요", () => {
  const all = new Set<string>();
  for (const lid of idx.order) for (const q of idx.lessons[lid].qids) all.add(q);
  for (const u of idx.units) for (const q of u.testIds) all.add(q);
  assert.equal(all.size, idx.totals.practice + idx.totals.test);
  assert.deepEqual(whereIsQuestion(idx, "u1_1_1-q6"), { kind: "practice", lid: "u1_1_1", unit: 1 });
  assert.deepEqual(whereIsQuestion(idx, "u1-t1"), { kind: "test", lid: null, unit: 1 });
  assert.equal(whereIsQuestion(idx, "nope"), null);
});

test("체험 도구는 쓰지 않아요", () => {
  assert.equal(idx.widgets.length, 0);
});

test("단원·레슨 도우미", () => {
  assert.equal(unitOfLesson(idx, "u3_2_1")?.slug, "u3");
  assert.equal(lessonLabel(idx, "u1_1_1"), "Ⅰ-1-1 인공지능은 무엇일까?");
  assert.equal(unitBasicIds(idx, 4).length, idx.lessons["u4_1_1"].basicIds.length + idx.lessons["u4_1_2"].basicIds.length + idx.lessons["u4_2"].basicIds.length + idx.lessons["u4_3"].basicIds.length + idx.lessons["u4_A"].basicIds.length);
});

test("사전: 중복 없음, 가나다순, 초성", () => {
  const terms = built.terms;
  assert.ok(terms.length > 100);
  const names = terms.map((t) => t.term);
  assert.equal(new Set(names).size, names.length);
  assert.equal(choseong("경사 하강법"), "ㄱㅅㅎㄱㅂ");
  assert.equal(choseong("k-NN"), "k-nn");
  for (const t of terms) assert.ok(idx.lessons[t.lid], t.term);
});

test("해요체 덧씌우기: 정확히 일치할 때만, 경로 지정, 안 쓴 규칙 보고", () => {
  const doc = { story: ["심판 30명이 있었다.", "그대로"], sections: [{ blocks: [{ t: "p", text: "이것은 벡터이다." }] }] };
  const file: ToneFile = {
    v: 1,
    replace: [
      { where: "u1-1", from: "있었다.", to: "있었어요." },
      { where: "u1-1", path: "sections.0.blocks.0.text", from: "벡터이다.", to: "벡터예요." },
      { where: "u1-1", path: "story.1", from: "벡터이다.", to: "X" },
      { where: "u1-1", from: "없는 문장", to: "Y" },
      { where: "u2-1", from: "그대로", to: "Z" },
    ],
    chips: [{ where: "u1-1", match: "심판 30명", label: "가상의 예" }],
  };
  const rep: ToneReport = { applied: 0, unused: [] };
  const out = applyTone(doc, "u1-1", file, rep);
  assert.deepEqual(out.story, ["심판 30명이 있었어요.", "그대로"]);
  assert.equal(out.sections[0].blocks[0].text, "이것은 벡터예요.");
  assert.equal(doc.story[0], "심판 30명이 있었다.", "원본은 그대로");
  assert.equal(rep.applied, 2);
  assert.equal(rep.unused.length, 2);
  assert.deepEqual(chipsFor(file, "u1-1", "story.0", "심판 30명이 있었다."), ["가상의 예"]);
  assert.deepEqual(chipsFor(file, "u1-2", "story.0", "심판 30명이 있었다."), []);
  assert.equal(applyTone(doc, "u9-9", file), doc, "규칙이 없으면 같은 객체");
  assert.equal(applyTone(doc, "u1-1", null), doc);
});

test("mapStrings 경로 모양", () => {
  const seen: string[] = [];
  mapStrings({ a: ["x", { b: "y" }], c: 1 }, (s, p) => (seen.push(p), s));
  assert.deepEqual(seen, ["a.0", "a.1.b"]);
});
