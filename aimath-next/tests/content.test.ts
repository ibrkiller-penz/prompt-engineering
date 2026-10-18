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

test("5단원 20레슨을 모두 읽어요", () => {
  assert.equal(idx.units.length, 5);
  assert.equal(idx.order.length, 20);
  assert.equal(Object.keys(idx.lessons).length, 20);
  assert.equal(idx.totals.lessons, 20);
  assert.ok(idx.totals.practice > 600);
});

test("화면 순서는 units.json 배열 순서(파일 번호·order 값이 아니에요)", () => {
  const expected = unitsJson.flatMap((u) => u.lessons.map((l) => l.id));
  assert.deepEqual(idx.order, expected);
  // 1단원은 파일 번호와 화면 순서가 달라요: u1-3(빅데이터)이 다섯째
  const u1 = lessonsOfUnit(idx, 1).map((l) => l.id);
  assert.deepEqual(u1, ["u1-1", "u1-2", "u1-4", "u1-5", "u1-3"]);
  assert.equal(idx.lessons["u1-3"].code, "Ⅰ-5");
  assert.equal(idx.lessons["u1-4"].code, "Ⅰ-3");
  assert.equal(idx.lessons["u2-3"].code, "Ⅱ-2");
  assert.equal(screenCode("Ⅳ", 2), "Ⅳ-2");
});

test("앞뒤 레슨 사슬", () => {
  assert.equal(idx.lessons[idx.order[0]].prev, null);
  assert.equal(idx.lessons[idx.order[19]].next, null);
  for (let i = 1; i < idx.order.length; i++) {
    assert.equal(idx.lessons[idx.order[i]].prev, idx.order[i - 1]);
    assert.equal(idx.lessons[idx.order[i - 1]].next, idx.order[i]);
  }
});

test("색인과 원본 레슨 본문이 맞아요(파일 경로·문제·소제목·위젯)", () => {
  for (const lid of idx.order) {
    const meta = idx.lessons[lid];
    assert.match(meta.file, /^u\d\/lesson-\d+\.json$/);
    const l: Lesson = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, meta.file), "utf8"));
    assert.equal(l.id, lid);
    assert.equal(l.unit, meta.unit);
    assert.equal(meta.sections.length, l.sections.length);
    assert.deepEqual(meta.qids, l.practice.map((q) => q.id));
    assert.deepEqual(meta.basicIds, l.practice.filter((q) => isBasicGroup(q.group)).map((q) => q.id));
    assert.ok(meta.basicIds.length > 0, lid + " 기본 문제");
    assert.ok(meta.checkIds.length > 0, lid + " 개념 확인");
    const sum = Object.keys(meta.byGroup).reduce((a, k) => a + meta.byGroup[k], 0);
    assert.equal(sum, l.practice.length);
    const ws = l.sections.flatMap((s) => s.blocks.filter((b) => b.t === "widget").map((b) => (b as { id: string }).id));
    assert.deepEqual(meta.widgetIds, ws.filter((w, i) => ws.indexOf(w) === i));
    assert.equal(meta.prereq, l.prereq ? l.prereq.items.length : 0);
  }
});

test("단원 마무리 도전에서 학력진단 A·B회는 빠져요", () => {
  for (const u of idx.units) {
    const doc: UnitContent = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, u.file), "utf8"));
    assert.equal(u.testIds.length + u.diagIds.length, doc.test.length);
    for (const id of u.testIds) {
      const q = doc.test.find((x) => x.id === id);
      assert.ok(q && !/학력진단/.test(q.group), id);
    }
    assert.ok(u.testIds.length >= 19, u.slug);
    assert.equal(unitByNumber(idx, u.id), u);
  }
});

test("문제 id 는 모두 하나뿐이고 위치를 찾을 수 있어요", () => {
  const all = new Set<string>();
  for (const lid of idx.order) for (const q of idx.lessons[lid].qids) all.add(q);
  for (const u of idx.units) for (const q of u.testIds.concat(u.diagIds)) all.add(q);
  assert.equal(all.size, idx.totals.practice + idx.totals.test + idx.totals.diag);
  assert.deepEqual(whereIsQuestion(idx, "u1-1-q06"), { kind: "practice", lid: "u1-1", unit: 1 });
  assert.deepEqual(whereIsQuestion(idx, "u1-t01"), { kind: "test", lid: null, unit: 1 });
  assert.deepEqual(whereIsQuestion(idx, "u1-dA01"), { kind: "diag", lid: null, unit: 1 });
  assert.equal(whereIsQuestion(idx, "nope"), null);
});

test("체험 도구는 실제로 17종", () => {
  assert.equal(idx.widgets.length, 17);
});

test("단원·레슨 도우미", () => {
  assert.equal(unitOfLesson(idx, "u3-4")?.slug, "u3");
  assert.equal(lessonLabel(idx, "u1-3"), "Ⅰ-5 빅데이터");
  assert.equal(unitBasicIds(idx, 5).length, idx.lessons["u5-1"].basicIds.length + idx.lessons["u5-2"].basicIds.length);
});

test("사전: 중복 없음, 가나다순, 초성", () => {
  const terms = built.terms;
  assert.ok(terms.length > 100);
  const names = terms.map((t) => t.term);
  assert.equal(new Set(names).size, names.length);
  assert.equal(choseong("경사 하강법"), "ㄱㅅㅎㄱㅂ");
  assert.equal(choseong("TF-IDF"), "tf-idf");
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
