// 수식 검사: 원본 콘텐츠 20레슨 + 단원 문제의 모든 TeX 를 KaTeX 로 그려 봐요(오류 · 모르는 글자 0).
// 화면과 같은 전처리(wrapTextChars)를 거쳐요. 원본은 읽기만 해요.
import { test } from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import { wrapTextChars } from "../../src/shared/logic/texText.ts";
import { parseInline, type InlineToken } from "../../src/shared/logic/inlineMath.ts";
import { loadLessons, loadUnits } from "./_content.ts";

test("wrapTextChars: 한글 · 동그라미 글자만 \\text{} 로 감싸요", () => {
  assert.equal(wrapTextChars("x+1"), "x+1");
  assert.equal(wrapTextChars("2+㉠+6"), "2+\\text{㉠}+6");
  assert.equal(wrapTextChars("㉠=20-12"), "\\text{㉠}=20-12");
  assert.equal(wrapTextChars("\\text{키}=3"), "\\text{키}=3", "이미 글자 묶음이면 그대로");
  assert.equal(wrapTextChars("\\text{a {b} 가}+나"), "\\text{a {b} 가}+\\text{나}", "묶음 안 중괄호");
  assert.equal(wrapTextChars("\\frac{가나}{2}"), "\\frac{\\text{가나}}{2}");
  assert.equal(wrapTextChars("\\mathrm{점수}_{①}"), "\\mathrm{점수}_{\\text{①}}");
  assert.equal(wrapTextChars("\\{가\\}"), "\\{\\text{가}\\}");
});

function* texOf(v: unknown, where: string): Generator<{ tex: string; display: boolean; where: string }> {
  if (typeof v === "string") {
    if (v.indexOf("$") < 0) return;
    const walk = function* (ts: InlineToken[]): Generator<{ tex: string; display: boolean; where: string }> {
      for (const t of ts) {
        if (t.t === "math") yield { tex: t.v, display: false, where };
        else if (t.t === "bold") yield* walk(t.c);
      }
    };
    yield* walk(parseInline(v));
    return;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) yield* texOf(v[i], where + "." + i);
    return;
  }
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.t === "math") {
      const list = Array.isArray(o.tex) ? (o.tex as string[]) : [o.tex as string];
      for (const t of list) yield { tex: t, display: true, where: where + ".tex" };
    }
    for (const k of Object.keys(o)) if (!(o.t === "math" && k === "tex")) yield* texOf(o[k], where + "." + k);
  }
}

const ENCLOSED = /[\u2460-\u24FF\u3200-\u32FF]/;

test("콘텐츠의 모든 수식이 KaTeX 오류 · 경고 없이 그려져요", () => {
  const docs: { file: string; doc: unknown }[] = [];
  for (const x of loadLessons()) docs.push({ file: x.file, doc: x.lesson });
  for (const x of loadUnits()) docs.push({ file: x.file, doc: x.unit });
  const bad: string[] = [];
  let n = 0;
  for (const d of docs) {
    for (const t of texOf(d.doc, d.file)) {
      n++;
      const tex = wrapTextChars(t.tex);
      try {
        katex.renderToString(tex, {
          displayMode: t.display,
          output: "htmlAndMathml",
          throwOnError: true,
          strict: (code: string, msg: string) => {
            // \text{} 로 감싼 동그라미 글자(㉠ · ①)는 KaTeX 글꼴에 없어 시스템 글꼴로 그려요(높이는 글자 상자 기준이라 괜찮아요)
            if (ENCLOSED.test(msg) && tex.indexOf("\\text{") >= 0) return "ignore";
            bad.push(t.where + " :: " + t.tex + " :: " + code + " " + msg.slice(0, 60));
            return "ignore";
          },
        });
      } catch (e) {
        bad.push(t.where + " :: " + t.tex + " :: " + String((e as Error).message).slice(0, 100));
      }
    }
  }
  assert.ok(n > 5000, "수식 수가 너무 적어요: " + n);
  assert.deepEqual(bad, [], bad.slice(0, 10).join("\n"));
});
