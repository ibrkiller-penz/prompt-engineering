// 그리기 시험(브라우저): 20레슨의 모든 블록 종류를 휴대폰(375, 글자 1·3단계)과 칠판(1920)에서 실제 부품으로 그려 봐요.
//   - 블록마다: KaTeX 오류 0 · 빈 그림 0 · 블록 상자 밖으로 삐져나감 0
//   - 칠판: 블록 하나가 장면 높이(852px)를 넘지 않아요(넘으면 장면을 나눠도 못 담아요)
//   - 칠판: 수식 블록은 가로 스크롤(is-overflow)을 붙이지 않아요. 개념 2단의 옆 칸(760px)에 놓여도 줄임 · 나눔 · 캡션으로 맞춰요
//   - 블록 종류 9가지(p · math · table · term · callout · list · example · dialog · widget)가 모두 나와요
// 인쇄 미리 보기(print 미디어)도 재요: 학습지 · 정답지가 어두운 · 칠판 테마에서도 흑백이고 A4 폭을 넘지 않아요.
// playwright(전역 설치)가 없으면 건너뛰어요. 실행: node --test tests/shared/blocks-render.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromiumPath, loadPlaywright, runBlocks, startServer } from "./render/run-blocks.mjs";
import { runPrint } from "./render/run-print.mjs";

interface BlockResult {
  lid: string;
  path: string;
  t: string;
  h: number;
  over: number;
  culprit: string;
  /** 스스로 가로 스크롤을 붙인 곳(is-overflow) 수 */
  scrolls: number;
  katexErr: number;
  empty: boolean;
}

const TYPES = ["p", "math", "table", "term", "callout", "list", "example", "dialog", "widget"];
const BOARD_H = 852;
const hasPw = !!loadPlaywright();

test("블록 그리기: 휴대폰 · 칠판에서 넘침 · 수식 오류 · 빈 그림이 없어요", { skip: hasPw ? false : "playwright 없음", timeout: 600000 }, async () => {
  const r = (await runBlocks([
    { surface: "phone", fs: 1 },
    { surface: "phone", fs: 3 },
    { surface: "board", fs: 1 },
  ])) as { results: Record<string, BlockResult[]>; errors: string[] };
  assert.deepEqual(r.errors, [], "페이지 오류");
  const lessons = new Set<string>();
  for (const name of Object.keys(r.results)) {
    const list = r.results[name];
    assert.ok(list.length > 1000, name + ": 블록 수가 너무 적어요 " + list.length);
    for (const x of list) lessons.add(x.lid);
    const seen = new Set(list.map((x) => x.t));
    for (const t of TYPES) assert.ok(seen.has(t), name + ": 블록 종류 " + t + " 가 안 그려졌어요");
    const bad = list.filter((x) => x.over > 1 || x.katexErr > 0 || x.empty).map((x) => `${x.lid} ${x.path} ${x.t} over=${x.over} ${x.culprit} katex=${x.katexErr}${x.empty ? " 빈그림" : ""}`);
    assert.deepEqual(bad, [], name + "\n" + bad.slice(0, 15).join("\n"));
    if (name.indexOf("board") === 0) {
      const scroll = list.filter((x) => x.t === "math" && x.scrolls > 0).map((x) => `${x.lid} ${x.path}`);
      assert.deepEqual(scroll, [], name + " 칠판 수식 블록에 가로 스크롤이 남았어요\n" + scroll.join("\n"));
      const tall = list.filter((x) => x.h > BOARD_H).map((x) => `${x.lid} ${x.path} ${x.t} h=${x.h}`);
      assert.deepEqual(tall, [], name + " 장면보다 큰 블록\n" + tall.join("\n"));
    }
  }
  assert.equal(lessons.size, 20, "20레슨 모두");
});

interface PrintResult {
  name: string;
  coloredN: number;
  colored: string[];
  over: string[];
  katexErr: number;
  qs: number;
  visibleButtons: number;
}

test("인쇄 미리 보기: 학습지 · 정답지가 흑백이고 A4 폭 안에 들어가요", { skip: hasPw ? false : "playwright 없음", timeout: 600000 }, async () => {
  const cases: { lid: string; set: string; key?: boolean; theme: string }[] = [];
  for (const lid of ["u1-3", "u2-3", "u3-3", "u4-4", "u5-1"]) {
    cases.push({ lid, set: "board", theme: "dark" });
    cases.push({ lid, set: "hw", key: true, theme: "chalk" });
  }
  const r = (await runPrint(cases)) as { results: PrintResult[]; errors: string[] };
  assert.deepEqual(r.errors, [], "페이지 오류");
  for (const x of r.results) {
    assert.ok(x.qs > 0, x.name + ": 문제가 없어요");
    assert.equal(x.coloredN, 0, x.name + ": 색이 남았어요\n" + x.colored.join("\n"));
    assert.deepEqual(x.over, [], x.name + ": 종이 밖으로 넘쳐요");
    assert.equal(x.katexErr, 0, x.name + ": KaTeX 오류");
    assert.equal(x.visibleButtons, 0, x.name + ": 인쇄에 단추가 보여요");
  }
});

interface NarrowMath {
  lid: string;
  path: string;
  over: number;
  scroll: boolean;
  hint: boolean;
  scale: string;
  split: boolean;
  caps: number;
  h: number;
}

const ENV = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process || {}).env || {};
const SIDE_W = Number(ENV.AIBN_MATH_W) || 760; // 더 좁게 시험해 보려면 AIBN_MATH_W=500

test("칠판 옆 칸(760px)의 수식 블록: 가로 넘침 0 · 스크롤 안내 없음 · 0.7배 아래로 안 줄여요", { skip: hasPw ? false : "playwright 없음", timeout: 600000 }, async () => {
  const pw = loadPlaywright();
  const { server, base } = await startServer();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    await page.goto(base + "/__blocks.html?surface=board&fs=1", { waitUntil: "load", timeout: 120000 });
    await page.waitForFunction(() => Array.isArray((window as unknown as { __BLOCKS__?: unknown }).__BLOCKS__), null, { timeout: 120000 });
    // 수식 블록만 옆 칸 폭으로 좁히고, 글자 단계 속성을 다시 써서(같은 값) 모든 수식이 처음부터 다시 맞추게 해요
    await page.evaluate((w: number) => {
      document.querySelectorAll<HTMLElement>(".bd-blk.t-math").forEach((b) => {
        b.style.width = w + "px";
      });
      document.documentElement.setAttribute("data-fs", document.documentElement.getAttribute("data-fs") || "1");
    }, SIDE_W);
    await page.waitForTimeout(800);
    const res = (await page.evaluate(() => {
      const out: NarrowMath[] = [];
      const metas = (window as unknown as { __BLOCKS__: { lid: string; path: string; t: string }[] }).__BLOCKS__;
      document.querySelectorAll<HTMLElement>(".bd-blk.t-math").forEach((b) => {
        const box = b.querySelector<HTMLElement>("[data-i]") || b;
        const i = Number((b.getAttribute("data-i") || box.getAttribute("data-i")) as string);
        const m = b.querySelector<HTMLElement>(".ui-math");
        if (!m) return;
        let over = Math.max(0, m.scrollWidth - m.clientWidth);
        m.querySelectorAll<HTMLElement>(".katex-html").forEach((h) => {
          over = Math.max(over, h.scrollWidth - m.clientWidth);
        });
        out.push({
          lid: metas[i] ? metas[i].lid : "?",
          path: metas[i] ? metas[i].path : "?",
          over,
          scroll: m.classList.contains("is-overflow"),
          hint: !!b.querySelector(".ui-scroll-hint"),
          scale: m.style.fontSize || "1em",
          split: m.classList.contains("is-split"),
          caps: m.querySelectorAll(".ui-math-cap").length,
          h: b.getBoundingClientRect().height,
        });
      });
      return out;
    })) as NarrowMath[];
    assert.deepEqual(errors, [], "페이지 오류");
    assert.ok(res.length >= 50, "수식 블록 수가 너무 적어요 " + res.length);
    const bad = res.filter((x) => x.over > 2 || x.scroll || x.hint).map((x) => `${x.lid} ${x.path} over=${x.over} scale=${x.scale}`);
    assert.deepEqual(bad, [], "옆 칸에서 넘치는 수식\n" + bad.join("\n"));
    const tiny = res.filter((x) => parseFloat(x.scale) < 0.69).map((x) => `${x.lid} ${x.path} scale=${x.scale}`);
    assert.deepEqual(tiny, [], "0.7배보다 작게 줄인 수식\n" + tiny.join("\n"));
    const tall = res.filter((x) => x.h > BOARD_H).map((x) => `${x.lid} ${x.path} h=${x.h}`);
    assert.deepEqual(tall, [], "장면보다 큰 수식 블록\n" + tall.join("\n"));
    // 손실함수 식(u4-3 · u4-5)이 옆 칸 한 화면 안에 들어가요
    const loss = res.filter((x) => x.lid === "u4-3" || x.lid === "u4-5");
    assert.ok(loss.length > 0, "u4-3 · u4-5 수식 블록이 없어요");
    if (ENV.AIBN_MATH_LOG) for (const x of res) if (x.scale !== "1em" || x.split || x.caps) console.log("  맞춤", x.lid, x.path, x.scale, x.split ? "나눔" : "", x.caps ? "캡션" + x.caps : "");
  } finally {
    await browser.close();
    await server.close();
  }
});
