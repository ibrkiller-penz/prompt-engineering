import { test } from "node:test";
import assert from "node:assert/strict";
import { seededOrder, seededShuffle, seededRandom } from "../../src/shared/logic/seeded.ts";
import { getChosung, chosungMatch, chosungIndexOf, chosungFilter } from "../../src/shared/logic/chosung.ts";
import { parseInline, plainText, type InlineToken } from "../../src/shared/logic/inlineMath.ts";
import { loadLessons } from "./_content.ts";

test("seededOrder: 같은 씨앗 = 같은 순서, 순열이에요", () => {
  const a = seededOrder(10, "u1-1-q03");
  assert.deepEqual(a, seededOrder(10, "u1-1-q03"));
  assert.deepEqual(a.slice().sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.notDeepEqual(a, seededOrder(10, "u1-1-q04"));
  assert.deepEqual(seededOrder(0, 1), []);
  assert.deepEqual(seededOrder(1, 1), [0]);
  assert.deepEqual(seededShuffle(["a", "b", "c"], 7).slice().sort(), ["a", "b", "c"]);
  const r = seededRandom(42);
  for (let i = 0; i < 100; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
  // 여러 씨앗에서 첫 자리가 고르게 나와요(대략)
  const count = [0, 0, 0, 0];
  for (let s = 0; s < 400; s++) count[seededOrder(4, "s" + s)[0]]++;
  for (const c of count) assert.ok(c > 60 && c < 140, "치우침: " + count.join(","));
});

test("초성 검색", () => {
  assert.equal(getChosung("인공지능"), "ㅇㄱㅈㄴ");
  assert.equal(getChosung("TF-IDF 값"), "TF-IDF ㄱ");
  assert.ok(chosungMatch("인공지능", "ㅇㄱㅈㄴ"));
  assert.ok(chosungMatch("인공지능", "ㄱㅈ"));
  assert.ok(chosungMatch("인공지능", "인ㄱ"));
  assert.ok(chosungMatch("인공지능", "인고"), "치는 중인 마지막 글자");
  assert.ok(!chosungMatch("인공지능", "인고지"), "가운데 글자는 정확히");
  assert.ok(chosungMatch("코사인 유사도", "ㅅㅇㅇ"), "공백 무시");
  assert.ok(chosungMatch("TF-IDF", "tf"), "영문 대소문자");
  assert.ok(!chosungMatch("벡터", "ㅂㄷ"));
  assert.equal(chosungIndexOf("단어 집합", "ㅈㅎ"), 2);
  assert.equal(chosungIndexOf("단어", ""), 0);
  const items = [
    { term: "벡터", def: "크기와 방향" },
    { term: "행렬", def: "수를 직사각형으로 벌여 놓은 것, 벡터를 모은 것" },
    { term: "벡터의 크기", def: "길이" },
  ];
  assert.deepEqual(
    chosungFilter(items, "ㅂㅌ", (x) => [x.term, x.def]).map((x) => x.term),
    ["벡터", "벡터의 크기", "행렬"],
  );
  assert.equal(chosungFilter(items, " ", (x) => [x.term]).length, 3);
});

test("inlineMath: 글자·수식·굵게·줄바꿈", () => {
  assert.deepEqual(parseInline("가 $x^2$ 나"), [
    { t: "text", v: "가 " },
    { t: "math", v: "x^2" },
    { t: "text", v: " 나" },
  ]);
  assert.deepEqual(parseInline("**$x$ 의 값**은"), [
    { t: "bold", c: [{ t: "math", v: "x" }, { t: "text", v: " 의 값" }] },
    { t: "text", v: "은" },
  ]);
  assert.deepEqual(parseInline("$a*b$와 **굵게**"), [
    { t: "math", v: "a*b" },
    { t: "text", v: "와 " },
    { t: "bold", c: [{ t: "text", v: "굵게" }] },
  ]);
  assert.deepEqual(parseInline("한 줄\n두 줄"), [{ t: "text", v: "한 줄" }, { t: "br" }, { t: "text", v: "두 줄" }]);
  assert.deepEqual(parseInline("값은 \\$5 이고 $ 하나"), [{ t: "text", v: "값은 $5 이고 $ 하나" }]);
  assert.deepEqual(parseInline("**짝 없음"), [{ t: "text", v: "**짝 없음" }]);
  assert.deepEqual(parseInline("****"), [{ t: "text", v: "****" }]);
  assert.deepEqual(parseInline(""), []);
  assert.equal(plainText("**$x=1$** 이에요"), "x=1 이에요");
});

test("inlineMath: 20레슨 본문을 분해해도 글자를 잃지 않아요", () => {
  const strip = (s: string) => s.replace(/\*\*/g, "").replace(/\$/g, "");
  const flat = (ts: InlineToken[]): string =>
    ts.map((t) => (t.t === "text" || t.t === "math" ? t.v : t.t === "br" ? "\n" : flat(t.c))).join("");
  let n = 0;
  const visit = (s: unknown) => {
    if (typeof s !== "string") return;
    n++;
    assert.equal(strip(flat(parseInline(s))), strip(s), s.slice(0, 60));
  };
  const walk = (v: unknown): void => {
    if (typeof v === "string") visit(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") for (const k of Object.keys(v)) if (k !== "tex" && k !== "id") walk((v as any)[k]);
  };
  for (const { lesson } of loadLessons()) walk(lesson);
  assert.ok(n > 2000);
});
