import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSection, weightOf } from "../../src/shared/logic/splitSection.ts";
import { splitStory, splitStoryParagraph, DEFAULT_ALIASES, DEFAULT_NAMES } from "../../src/shared/logic/splitStory.ts";
import type { LBlock } from "../../src/shared/logic/types.ts";
import { loadLessons } from "./_content.ts";

const lessons = loadLessons();

test("콘텐츠 26레슨을 읽어요", () => {
  assert.equal(lessons.length, 26);
});

test("splitSection: 26레슨 모든 소제목에서 블록을 빠뜨리거나 겹치지 않아요", () => {
  let sections = 0;
  let cardsTotal = 0;
  for (const { file, lesson } of lessons) {
    lesson.sections.forEach((sec, si) => {
      sections++;
      const blocks = sec.blocks as LBlock[];
      const cards = splitSection(blocks);
      cardsTotal += cards.length;
      const where = file + " §" + (si + 1);
      const flat = ([] as number[]).concat(...cards.map((c) => c.idx));
      assert.deepEqual(flat, blocks.map((_, i) => i), where + ": idx 가 0..n-1 순서가 아니에요");
      for (const c of cards) {
        assert.ok(c.blocks.length > 0, where + ": 빈 카드");
        assert.equal(c.blocks.length, c.idx.length, where);
        c.blocks.forEach((b, k) => assert.ok(b === blocks[c.idx[k]], where + ": 블록이 바뀌었어요"));
        // example·widget 은 혼자(뒤에 붙는 aha 만 허용)
        const alone = c.blocks.filter((b) => b.t === "example" || b.t === "widget");
        if (alone.length) {
          assert.equal(alone.length, 1, where + ": example/widget 이 한 카드에 둘");
          assert.ok(c.blocks[0] === alone[0], where + ": example/widget 이 카드 맨 앞이 아니에요");
          for (const b of c.blocks.slice(1)) assert.ok(b.t === "callout" && b.kind === "aha", where + ": example/widget 카드에 다른 블록");
          assert.equal(c.kind, alone[0].t === "example" ? "example" : "widget");
        }
        // aha 는 블록 0번이 아니면 카드 맨 앞에 오지 않아요
        const first = c.blocks[0];
        if (first.t === "callout" && first.kind === "aha") assert.equal(c.idx[0], 0, where + ": aha 가 새 카드를 열었어요");
        // 예산: aha 를 빼고, 블록이 둘 이상이면 6 이하
        if (c.kind === "flow") {
          const nonAha = c.blocks.filter((b) => !(b.t === "callout" && b.kind === "aha"));
          if (nonAha.length > 1) {
            const w = nonAha.reduce((a, b) => a + weightOf(b), 0);
            assert.ok(w <= 6, where + ": 예산 초과 " + w);
          }
        }
      }
      // 이어지는 term 묶음은 같은 카드(묶음이 예산 이하일 때)
      for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].t !== "term") continue;
        let j = i;
        let w = 0;
        while (j < blocks.length && blocks[j].t === "term") w += weightOf(blocks[j++]);
        if (w <= 6) {
          const ci = cards.findIndex((c) => c.idx.indexOf(i) >= 0);
          for (let k = i; k < j; k++) assert.ok(cards[ci].idx.indexOf(k) >= 0, where + ": 용어 묶음이 갈라졌어요");
        }
        i = j - 1;
      }
    });
  }
  assert.ok(sections > 40, "소제목 수가 너무 적어요: " + sections);
  assert.ok(cardsTotal >= sections);
});

test("splitSection: 규칙 단위 시험", () => {
  const P = (n: number): LBlock => ({ t: "p", text: "가".repeat(n) });
  const ex: LBlock = { t: "example", title: "예", problem: "문제", steps: ["1"], answer: "답" };
  const aha: LBlock = { t: "callout", kind: "aha", text: "아하" };
  const term: LBlock = { t: "term", term: "용어", def: "뜻" };
  const math: LBlock = { t: "math", tex: "x^2" };
  // example 은 혼자, 뒤 aha 는 example 카드에 붙음
  let cards = splitSection([P(10), ex, aha, P(10)]);
  assert.deepEqual(cards.map((c) => c.idx), [[0], [1, 2], [3]]);
  assert.deepEqual(cards.map((c) => c.kind), ["flow", "example", "flow"]);
  // 예산 6: 무게 3짜리 문단 셋 → 2장
  cards = splitSection([P(200), P(200), P(200)]);
  assert.deepEqual(cards.map((c) => c.idx), [[0, 1], [2]]);
  // aha 는 예산을 넘어도 앞 카드에 붙음
  cards = splitSection([P(200), P(200), aha]);
  assert.deepEqual(cards.map((c) => c.idx), [[0, 1, 2]]);
  // 용어 묶음은 한 카드로
  cards = splitSection([P(200), P(100), term, term, term]);
  assert.deepEqual(cards.map((c) => c.idx), [[0, 1], [2, 3, 4]]);
  // 넘친 수식은 앞 문단을 데려감
  cards = splitSection([P(200), P(100), P(30), math]);
  assert.deepEqual(cards.map((c) => c.idx), [[0, 1], [2, 3]]);
  // 첫 블록이 aha 여도 잃어버리지 않음
  cards = splitSection([aha, P(10)]);
  assert.deepEqual(cards.map((c) => c.idx), [[0, 1]]);
  // 빈 입력
  assert.deepEqual(splitSection([]), []);
  // 예산 옵션
  cards = splitSection([P(10), P(10), P(10)], { budget: 1 });
  assert.equal(cards.length, 3);
});

test("splitStory: 26레슨 모든 문단을 빠뜨리거나 겹치지 않고, 대부분 말풍선으로 나눠요", () => {
  let paras = 0;
  let fails = 0;
  let says = 0;
  let named = 0;
  const validWho = new Set(DEFAULT_NAMES.map((n) => DEFAULT_ALIASES[n] || n));
  for (const { file, lesson } of lessons) {
    const cards = splitStory(lesson.story);
    assert.equal(cards.length, lesson.story.length, file);
    cards.forEach((c, i) => {
      paras++;
      assert.equal(c.idx, i, file);
      assert.equal(c.segs.map((s) => s.raw).join(""), lesson.story[i], file + " 문단 " + i + ": 원문과 달라요");
      if (!c.ok) fails++;
      for (const s of c.segs) {
        assert.ok(s.text.length > 0 || s.raw.trim() === "", file + ": 빈 조각");
        if (s.k === "say") {
          says++;
          assert.ok(/^[“"]/.test(s.raw.trim()) && /[”"]$/.test(s.raw.trim()), file + ": 말풍선 따옴표");
          if (s.who) {
            named++;
            assert.ok(validWho.has(s.who), file + ": 모르는 인물 " + s.who);
          }
        }
      }
    });
  }
  assert.ok(paras >= 100, "문단 수: " + paras);
  assert.equal(fails, 0, "따옴표 나누기 실패 문단이 있어요");
  assert.ok(says > 40, "말풍선 수: " + says);
  assert.ok(named / says > 0.5, "말한 사람을 찾은 비율이 낮아요: " + named + "/" + says);
});

test("splitStory: 말한 사람 찾기와 실패 시 원문 유지", () => {
  const a = splitStoryParagraph("민준이 손을 들었다. “㉮는 사람이에요.” 지우는 고개를 저었다. “아니야.”");
  assert.ok(a.ok);
  const says = a.segs.filter((s) => s.k === "say");
  assert.deepEqual(says.map((s) => (s.k === "say" ? s.who : "")), ["민준", "지우"]);
  assert.equal(says[0].text, "㉮는 사람이에요.");

  const b = splitStoryParagraph('"밝게 하면 되잖아!" 도윤이 벌떡 일어났다.');
  const sb = b.segs[0];
  assert.ok(sb.k === "say" && sb.who === "도윤");

  const c = splitStoryParagraph("아라 쌤이 웃으셨다. “바로 그거야.”");
  const sc = c.segs[1];
  assert.ok(sc.k === "say" && sc.who === "아라 쌤");

  const d = splitStoryParagraph("쌤이 말했다. “좋아.”");
  const sd = d.segs[1];
  assert.ok(sd.k === "say" && sd.who === "아라 쌤", "별칭");

  // 따옴표 짝이 안 맞으면 원문 그대로
  const f = splitStoryParagraph("지우가 말했다. “끝나지 않는 말");
  assert.equal(f.ok, false);
  assert.equal(f.segs.length, 1);
  assert.equal(f.segs[0].raw, "지우가 말했다. “끝나지 않는 말");

  // 따옴표 없는 문단은 지문 하나
  const g = splitStoryParagraph("비가 왔다.");
  assert.ok(g.ok);
  assert.deepEqual(g.segs.map((s) => s.k), ["narr"]);
});

test("splitStory: 이어지는 말·화면 말풍선(옵션)·적힌 글", () => {
  const a = splitStoryParagraph("도윤이 눈을 떴다. “이거 봐.” “진짜 많아!”");
  const says = a.segs.filter((s) => s.k === "say");
  assert.deepEqual(says.map((s) => (s.k === "say" ? s.who : "")), ["도윤", "도윤"]);
  assert.equal(a.segs.map((s) => s.raw).join(""), "도윤이 눈을 떴다. “이거 봐.” “진짜 많아!”");

  // 화면 말풍선 화자는 기본으로 없고, 옵션으로 줄 수 있어요
  const b = splitStoryParagraph("화면에 말풍선이 떴다. “안녕하세요!”");
  const sb = b.segs[1];
  assert.ok(sb.k === "say" && sb.who === null);
  const b2 = splitStoryParagraph("화면에 말풍선이 떴다. “안녕하세요!”", 0, { screenSpeaker: "챗봇" });
  const sb2 = b2.segs[1];
  assert.ok(sb2.k === "say" && sb2.who === "챗봇");

  const c = splitStoryParagraph("쪽지에는 “국이 맛있다”라고 적혀 있었다. 민준이 웃었다. “좋네.”");
  assert.deepEqual(c.segs.map((s) => s.k), ["narr", "say"]);
  const sc = c.segs[1];
  assert.ok(sc.k === "say" && sc.who === "민준");
});
