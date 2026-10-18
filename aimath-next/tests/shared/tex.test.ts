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

/* ── 벡터 화살표(\vec · \overrightarrow) ──
 * KaTeX 는 화살표를 svg 로 그려요. 공용 base.css 의 'svg { max-width:100%; overflow:visible }' 가 그대로 걸리면
 * 화살표 칸이 폭 0 이 되어 사라지므로, '.katex svg { max-width:none; overflow:hidden }' 되돌림이 뒤에 있어야 해요. */
test("\\vec · \\overrightarrow 는 svg 경로와 폭이 있는 화살표 칸으로 그려져요", () => {
  for (const display of [false, true]) {
    const vec = katex.renderToString("\\vec{a}+\\vec{v}", { displayMode: display, output: "htmlAndMathml", throwOnError: true });
    const overlays = vec.match(/class="katex-overlay"[^>]*style="[^"]*width:\s*([0-9.]+)em/g) || [];
    assert.equal(overlays.length, 2, "\\vec 마다 화살표 칸(overlay)이 하나씩 있어야 해요");
    for (const o of overlays) {
      const w = Number(/width:\s*([0-9.]+)em/.exec(o)![1]);
      assert.ok(w > 0, "화살표 칸 폭이 0 이에요: " + o);
    }
    assert.ok(/<svg[^>]*>\s*<path d="M/.test(vec), "\\vec 에 svg 경로가 있어야 해요");
    assert.ok(vec.indexOf("<mo>⃗</mo>") >= 0 || vec.indexOf("<mo>→</mo>") >= 0 || vec.indexOf("&#x20D7;") >= 0 || /<mover/.test(vec), "읽기 도구용 MathML 에도 화살표가 있어야 해요");

    const arr = katex.renderToString("\\overrightarrow{AB}", { displayMode: display, output: "htmlAndMathml", throwOnError: true });
    assert.ok(/class="hide-tail"[^>]*min-width:\s*[0-9.]+em/.test(arr), "\\overrightarrow 의 화살표 칸(hide-tail)이 있어야 해요");
    assert.ok(/<svg[^>]*>\s*<path d="M/.test(arr), "\\overrightarrow 에 svg 경로가 있어야 해요");
  }
});

test("base.css: .katex svg 되돌림이 svg 전역 규칙보다 뒤에 있어요", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const css = readFileSync(fileURLToPath(new URL("../../src/styles/base.css", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const globalAt = css.search(/(^|[\s,}])svg\s*\{[^}]*overflow\s*:\s*visible/m);
  const m = /\.katex svg\s*\{([^}]*)\}/.exec(css);
  assert.ok(m, "base.css 에 '.katex svg { … }' 규칙이 있어야 해요");
  assert.ok(/max-width\s*:\s*none/.test(m![1]), ".katex svg 는 max-width: none 이어야 해요");
  assert.ok(/overflow\s*:\s*hidden/.test(m![1]), ".katex svg 는 overflow: hidden 이어야 해요");
  assert.ok(globalAt < 0 || m!.index > globalAt, ".katex svg 규칙이 svg 전역 규칙보다 뒤에 와야 해요");
});
