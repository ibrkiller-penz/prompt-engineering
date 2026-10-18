// 문제 본문 해요체 규칙(src/content/tone.ts)의 시험.
// - 예시 변환(어미별), 수식·따옴표·코드 보호, 받침에 따른 이에요/예요
// - 20레슨·5단원 모든 문제: 덧씌운 뒤 해라체 0건, 수식 토큰·숫자·정답·보기 개수 그대로
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentIndex } from "../../tools/content-index.mjs";
import { aeoForm, applyTone, endsWithBatchim, guardRanges, haeraLeft, haeyoDoc, haeyoQuestion, haeyoText, haeyoWord, type HaeyoChange } from "../../src/content/tone.ts";
import type { ToneFile } from "../../src/shared/contracts.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const TONE: ToneFile = JSON.parse(fs.readFileSync(path.join(here, "..", "..", "data", "overrides", "tone.json"), "utf8"));
const built = buildContentIndex();

test("어간 → 아/어 꼴(규칙·불규칙)", () => {
  const cases: [string, string][] = [
    ["하", "해"], ["구하", "구해"], ["보", "봐"], ["나오", "나와"], ["주", "줘"], ["바꾸", "바꿔"], ["되", "돼"], ["쓰", "써"], ["크", "커"],
    ["모으", "모아"], ["예쁘", "예뻐"], ["고르", "골라"], ["흐르", "흘러"], ["다르", "달라"], ["따르", "따라"], ["쉽", "쉬워"], ["가깝", "가까워"],
    ["돕", "도와"], ["듣", "들어"], ["긋", "그어"], ["있", "있어"], ["없", "없어"], ["같", "같아"], ["않", "않아"], ["받", "받아"], ["넣", "넣어"],
    ["만들", "만들어"], ["보이", "보여"], ["그리", "그려"], ["가", "가"], ["내", "내"], ["세", "세어"], ["그렇", "그래"],
  ];
  for (const [stem, want] of cases) assert.equal(aeoForm(stem), want, stem);
});

test("받침 읽기: 한글·숫자·영문자·수식", () => {
  const yes = ["값", "강화학습", "1", "3", "6", "7", "8", "0", "10", "100", "1000", "48", "0.3", "x_1", "M", "\\frac{1}{3}", "(12, 6)", "\\text{일}", "\\frac{3}{4}", "①", "③", "㉠"];
  const no = ["배수", "데이터", "2", "4", "5", "9", "0.5", "x", "y", "z", "AI", "TF-IDF", "20\\%", "60°", "180^\\circ", "\\theta", "\\frac{2}{3}", "\\sqrt{45}", "②", "④"];
  for (const s of yes) assert.equal(endsWithBatchim(s), true, s);
  for (const s of no) assert.equal(endsWithBatchim(s), false, s);
});

test("낱말 하나 바꾸기: 어미별", () => {
  const cases: [string, string, boolean, string | null][] = [
    // [낱말, 문장부호, 앞소리 받침, 기대]
    ["한다", ".", true, "해요"],
    ["출력한다", ".", true, "출력해요"],
    ["된다", ".", true, "돼요"],
    ["만든다", ".", true, "만들어요"],
    ["연다", ".", true, "열어요"],
    ["배운다", ".", true, "배워요"],
    ["고른다", ".", true, "골라요"],
    ["받는다", ".", true, "받아요"],
    ["긋는다", ".", true, "그어요"],
    ["있다", ".", true, "있어요"],
    ["했다", ".", true, "했어요"],
    ["하였다", ".", true, "했어요"],
    ["어렵다", ".", true, "어려워요"],
    ["필요하다", ".", true, "필요해요"],
    ["배수이다", ".", true, "배수예요"],
    ["값이다", ".", true, "값이에요"],
    ["이다", ".", false, "예요"],
    ["이다", ".", true, "이에요"],
    ["것이다", ".", true, "거예요"],
    ["아니다", ".", true, "아니에요"],
    ["하는가", "?", true, "할까요"],
    ["있는가", "?", true, "있을까요"],
    ["만드는가", "?", true, "만들까요"],
    ["가까워지겠는가", "?", true, "가까워질까요"],
    ["인가", "?", true, "일까요"],
    ["몇인가", "?", true, "몇일까요"],
    ["다른가", "?", true, "다를까요"],
    ["필요한가", "?", true, "필요할까요"],
    ["같은가", "?", true, "같을까요"],
    ["될까", "?", true, "될까요"],
    ["구하시오", ".", true, "구해 보세요"],
    ["쓰시오", ".", true, "써 보세요"],
    ["고르시오", ".", true, "골라 보세요"],
    ["찾으시오", ".", true, "찾아 보세요"],
    ["보시오", ".", true, "보세요"],
    ["구하여라", ".", true, "구해 보세요"],
    ["보자", ".", true, "봐요"],
    // 그대로 두는 것
    ["먹다", ".", true, null],
    ["바다", ".", true, null],
    ["입니다", ".", true, null],
    ["값은", "?", true, null],
    ["왕자", "", true, null],
  ];
  for (const [w, p, b, want] of cases) assert.equal(haeyoWord(w, p, b), want, w);
});

test("문장 단위: 수식·따옴표·코드는 그대로, 받침은 수식을 읽어서", () => {
  const t = (s: string) => haeyoText(s);
  assert.equal(t("뉴런의 가중치가 $(w_1, w_2) = (5, 1)$ 이다. 출력을 구하시오."), "뉴런의 가중치가 $(w_1, w_2) = (5, 1)$ 이에요. 출력을 구해 보세요.");
  assert.equal(t("두 벡터의 코사인 유사도가 $0.5$ 이다. 이루는 각은 몇 도일까?"), "두 벡터의 코사인 유사도가 $0.5$ 예요. 이루는 각은 몇 도일까요?");
  assert.equal(t("비어 있는 값은 **결측치**이다."), "비어 있는 값은 **결측치**예요.");
  assert.equal(t("심판이 30명이고 전체의 $\\frac{1}{3}$ 이상을 속이면 통과라고 한다. 통과하려면 최소 몇 명을 속여야 하는가?"),
    "심판이 30명이고 전체의 $\\frac{1}{3}$ 이상을 속이면 통과라고 해요. 통과하려면 최소 몇 명을 속여야 할까요?");
  // 따옴표 안 해라체는 문제의 대상이라 그대로
  assert.equal(t("‘모든 소수는 홀수이다’는 거짓이다."), "‘모든 소수는 홀수이다’는 거짓이에요.");
  assert.equal(t("\"거북이도 당근을 먹는다\"를 정리하면?"), "\"거북이도 당근을 먹는다\"를 정리하면?");
  // 수식 안의 글자는 그대로
  assert.equal(t("$$\\text{참이다.}$$ 그래서 맞다."), "$$\\text{참이다.}$$ 그래서 맞아요.");
  assert.equal(t("`x = 1 이다.` 를 실행한다."), "`x = 1 이다.` 를 실행해요.");
  // 괄호 안 문장, 줄바꿈, 보기처럼 마침표 없는 끝
  assert.equal(t("(소수로 답하시오)"), "(소수로 답해 보세요)");
  assert.equal(t("명제는 몇 개인가?\n① 9는 3의 배수이다. ② 강아지는 귀엽다."), "명제는 몇 개일까요?\n① 9는 3의 배수예요. ② 강아지는 귀여워요.");
  assert.equal(t("두 입력은 결과에 똑같은 영향을 준다"), "두 입력은 결과에 똑같은 영향을 줘요");
  assert.equal(t("동점이다"), "동점이에요");
  // 낱말 나열·기본형·낱말 하나짜리 보기는 그대로
  assert.equal(t("고양이, 생선, 먹다"), "고양이, 생선, 먹다");
  assert.equal(t("하늘이, 맑고, 구름이, 예쁘다"), "하늘이, 맑고, 구름이, 예쁘다");
  assert.equal(t("거짓"), "거짓");
  assert.equal(t("이미 해요체예요."), "이미 해요체예요.");
  // 바뀐 자리 기록
  const ch: HaeyoChange[] = [];
  haeyoText("값은 2이다. 답을 구하시오.", { changes: ch });
  assert.deepEqual(ch.map((c) => c.from + "→" + c.to + "@" + c.at), ["이다→예요@4", "구하시오→구해 보세요@11"]);
});

test("보호 구간 찾기", () => {
  const g = guardRanges("a $x$ b $$y$$ ‘c’ \"d\" `e` \\$5");
  assert.deepEqual(g.map((x) => x.kind + ":" + x.inner), ["math:x", "math:y", "quote:c", "quote:d", "code:e"]);
});

test("haeraLeft: 수식·따옴표 밖의 해라체만 찾아요", () => {
  assert.deepEqual(haeraLeft("값은 2이다. ‘참이다.’ $참이다.$ 구하시오."), ["이다.", "구하시오"]);
  assert.deepEqual(haeraLeft("값은 2예요."), []);
});

test("문제 하나: 정답·종류·id·보기 개수는 그대로, 원본은 안 바뀌어요", () => {
  const q = { type: "choice", id: "x-q1", level: 1, group: "개념 확인", prompt: "알맞은 것은 무엇인가?", choices: ["값이 같다", "$x=1$ 이다", "거짓"], answer: 1, hints: ["다시 보자.", "표를 그린다."], solution: "따라서 답은 ②이다." };
  const snap = JSON.stringify(q);
  const o = haeyoQuestion(q);
  assert.equal(JSON.stringify(q), snap, "원본 그대로");
  assert.equal(o.prompt, "알맞은 것은 무엇일까요?");
  assert.deepEqual(o.choices, ["값이 같아요", "$x=1$ 이에요", "거짓"]);
  assert.deepEqual(o.hints, ["다시 봐요.", "표를 그려요."]);
  assert.equal(o.solution, "따라서 답은 ②예요.");
  assert.equal(o.answer, 1);
  assert.equal(o.id, "x-q1");
  assert.equal(o.group, "개념 확인", "group 은 건드리지 않아요");
  const doc = { id: "u0-1", practice: [q], summary: ["그대로이다."] };
  const d2 = haeyoDoc(doc);
  assert.deepEqual(d2.summary, ["그대로이다."], "문제 밖은 tone.json 정확 일치만");
  assert.equal(d2.practice[0].prompt, "알맞은 것은 무엇일까요?");
  assert.equal(haeyoDoc({ a: 1 }).a, 1);
});

/* ───── 실제 콘텐츠 전체 ───── */
type AnyQ = Record<string, any>;
const MATH = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
const mathTokens = (s: unknown): string[] => (typeof s === "string" ? s.match(MATH) || [] : []);
const numbers = (s: unknown): string[] => (typeof s === "string" ? s.replace(MATH, " ").match(/\d+(?:[.,]\d+)*/g) || [] : []);
const fieldTexts = (q: AnyQ): [string, unknown][] => {
  const out: [string, unknown][] = [["prompt", q.prompt], ["solution", q.solution]];
  (q.choices || []).forEach((c: unknown, i: number) => out.push(["choices." + i, c]));
  (q.hints || []).forEach((c: unknown, i: number) => out.push(["hints." + i, c]));
  return out;
};

function allDocs(): { where: string; key: "practice" | "test"; raw: AnyQ; out: AnyQ; toned: AnyQ }[] {
  const res: { where: string; key: "practice" | "test"; raw: AnyQ; out: AnyQ; toned: AnyQ }[] = [];
  for (const lid of built.index.order) {
    const raw = built.lessons[lid];
    const toned = applyTone(raw, lid, TONE);
    res.push({ where: lid, key: "practice", raw, toned, out: haeyoDoc(toned) });
  }
  for (const u of built.index.units) {
    const raw = built.unitDocs[u.id];
    const toned = applyTone(raw, u.slug, TONE);
    res.push({ where: u.slug, key: "test", raw, toned, out: haeyoDoc(toned) });
  }
  return res;
}

test("20레슨·5단원: 덧씌운 뒤 문제 본문에 해라체('한다.' '는가?' '인가?' '이다.' '하시오')가 0건", () => {
  const left: string[] = [];
  let n = 0;
  for (const d of allDocs()) {
    for (const q of d.out[d.key] as AnyQ[]) {
      n++;
      for (const [f, v] of fieldTexts(q)) for (const hit of haeraLeft(v as string)) left.push(q.id + " " + f + ": " + hit);
    }
  }
  assert.equal(built.index.order.length, 20);
  assert.ok(n > 800, "문제 수 " + n);
  assert.deepEqual(left, []);
});

test("20레슨·5단원: 규칙 변환 전후 수식 토큰·숫자·정답·보기 개수가 그대로", () => {
  let changed = 0;
  for (const d of allDocs()) {
    const before = d.toned[d.key] as AnyQ[];
    const after = d.out[d.key] as AnyQ[];
    assert.equal(after.length, before.length, d.where);
    before.forEach((q, i) => {
      const o = after[i];
      assert.equal(o.id, q.id);
      assert.equal(o.type, q.type, q.id);
      assert.deepEqual(o.answer, q.answer, q.id + " 정답");
      assert.equal(o.tolerance, q.tolerance, q.id);
      assert.equal(o.unit, q.unit, q.id);
      assert.equal(o.level, q.level, q.id);
      assert.equal(o.group, q.group, q.id);
      if (Array.isArray(q.choices)) assert.equal(o.choices.length, q.choices.length, q.id + " 보기 개수");
      if (Array.isArray(q.hints)) assert.equal(o.hints.length, q.hints.length, q.id + " 힌트 개수");
      const fb = fieldTexts(q);
      const fa = fieldTexts(o);
      fb.forEach(([f, v], k) => {
        const w = fa[k][1];
        assert.deepEqual(mathTokens(w), mathTokens(v), q.id + " " + f + " 수식");
        assert.deepEqual(numbers(w), numbers(v), q.id + " " + f + " 숫자");
        if (w !== v) changed++;
      });
    });
  }
  assert.ok(changed > 300, "바뀐 글 수 " + changed);
});

test("원본 콘텐츠는 바뀌지 않아요(덧씌우기는 새 객체)", () => {
  const lid = built.index.order[0];
  const raw = built.lessons[lid];
  const snap = JSON.stringify(raw);
  haeyoDoc(applyTone(raw, lid, TONE));
  assert.equal(JSON.stringify(raw), snap);
});

test("tone.json: '11명이 속았다' 는 '…11명을 속였어요' 로 덮어써요", () => {
  const raw = built.lessons["u1-1"];
  const out = haeyoDoc(applyTone(raw, "u1-1", TONE)) as AnyQ;
  const q8 = (out.practice as AnyQ[]).find((q) => q.id === "u1-1-q08");
  const q7 = (out.practice as AnyQ[]).find((q) => q.id === "u1-1-q07");
  assert.ok(q8 && q8.prompt.indexOf("어떤 프로그램이 심판 30명 중 11명을 속였어요.") === 0, q8 && q8.prompt);
  assert.ok(q7 && q7.prompt.indexOf("어떤 프로그램이 심판 30명 중 6명을 속였어요.") === 0, q7 && q7.prompt);
  assert.ok(q7 && /몇 %일까요\?$/.test(q7.prompt));
});
