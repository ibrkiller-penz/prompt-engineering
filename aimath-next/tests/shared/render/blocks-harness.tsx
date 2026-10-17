// 블록 그리기 시험용 화면(blocks-render.test.ts 가 vite 개발 서버로 띄워요). 앱 번들에는 들어가지 않아요.
// 20레슨의 모든 소제목 블록(+ 먼저 알고 가요 · 정리)을 실제 부품(BlockView)으로 그리고,
// 블록마다 KaTeX 오류 · 빈 그림 · 가로 넘침 · (칠판) 무대 높이 초과를 재서 window.__BLOCKS__ 에 남겨요.
//   ?surface=phone|board  &fs=0..3  &theme=light|dark|chalk  &only=u1-1
import { createRoot } from "react-dom/client";
import type { Block, Lesson, Surface } from "../../../src/shared/contracts.ts";
import { BlockView } from "../../../src/shared/ui/BlockView.tsx";
import { UiSurfaceContext } from "../../../src/shared/ui/surface.ts";

import.meta.glob("../../../src/styles/*.css", { eager: true });
import.meta.glob("../../../src/teacher/board/board.css", { eager: true });
import.meta.glob("../../../src/student/styles/student.css", { eager: true });

const LESSONS = import.meta.glob<Lesson>("../../../../content/aimath/*/lesson-*.json", { eager: true, import: "default" });

/** 휴대폰 카드 안쪽 폭: 375 - 여백 16×2 - 카드 안쪽 16×2 */
export const PHONE_W = 311;
/** 칠판 장면 안쪽 폭(1680 - 8×2)과 장면 높이(896 - 위아래 안쪽 44) */
export const BOARD_W = 1664;
export const BOARD_H = 852;

export interface BlockResult {
  lid: string;
  path: string;
  t: string;
  w: number;
  h: number;
  /** 블록 바깥으로 삐져나간 폭(px). 0 이면 정상 */
  over: number;
  /** 넘친 자손(태그.클래스) */
  culprit: string;
  /** 스스로 가로 스크롤을 붙인 곳(수식·표) 수 */
  scrolls: number;
  katexErr: number;
  empty: boolean;
}

interface Item {
  lid: string;
  path: string;
  b: Block;
}

function collect(only: string | null): Item[] {
  const out: Item[] = [];
  const files = Object.keys(LESSONS).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  for (const f of files) {
    const L = LESSONS[f];
    if (only && L.id !== only) continue;
    L.sections.forEach((s, si) => s.blocks.forEach((b, bi) => out.push({ lid: L.id, path: "sections." + si + ".blocks." + bi, b })));
    if (L.summary && L.summary.length) out.push({ lid: L.id, path: "summary", b: { t: "list", items: L.summary } as Block });
    if (L.prereq) {
      L.prereq.items.forEach((it, i) => out.push({ lid: L.id, path: "prereq.items." + i, b: { t: "term", term: it.term, def: it.text } as Block }));
    }
  }
  return out;
}

function q(name: string): string | null {
  const m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
  return m ? decodeURIComponent(m[1]) : null;
}

const surface = (q("surface") === "board" ? "board" : "phone") as Surface;
const html = document.documentElement;
html.setAttribute("data-site", surface === "board" ? "teacher" : "student");
html.setAttribute("data-surface", surface);
html.setAttribute("data-fs", q("fs") || "1");
html.setAttribute("data-theme", q("theme") || "light");
html.setAttribute("data-motion", "reduce");

const items = collect(q("only"));

function Harness() {
  const W = surface === "board" ? BOARD_W : PHONE_W;
  return (
    <UiSurfaceContext.Provider value={surface}>
      <div style={{ padding: 16, background: "var(--bg)" }}>
        {items.map((it, i) =>
          surface === "board" ? (
            <div key={i} className="bd-scene" style={{ height: "auto", width: BOARD_W + 16, marginBottom: 24 }}>
              <div className="bd-scene-inner" style={{ padding: "0 8px" }}>
                <div className={"bd-blk t-" + it.b.t} data-i={i} style={{ width: W }}>
                  <BlockView block={it.b} surface="board" where={it.lid} path={it.path} />
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="card" style={{ width: W + 32, padding: 16, marginBottom: 16, boxSizing: "border-box" }}>
              <div className="ui-blocks" data-i={i} style={{ width: W }}>
                <BlockView block={it.b} surface="phone" where={it.lid} path={it.path} />
              </div>
            </div>
          ),
        )}
      </div>
    </UiSurfaceContext.Provider>
  );
}

function describe(el: Element): string {
  const c = typeof el.className === "string" ? el.className.split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
  return el.tagName.toLowerCase() + (c ? "." + c : "");
}

/** 블록 상자 바깥으로 나간 가장 큰 폭과 범인. 스스로 스크롤하는 상자(.scroll-x) 안쪽은 보지 않아요 */
function measure(box: HTMLElement): { over: number; culprit: string } {
  const r = box.getBoundingClientRect();
  let over = 0;
  let culprit = "";
  const walk = (el: Element) => {
    for (let k = 0; k < el.children.length; k++) {
      const c = el.children[k] as HTMLElement;
      if (c.classList.contains("katex-mathml")) continue; // 읽기 도구용(화면에 안 보임)
      const cr = c.getBoundingClientRect();
      if (cr.width > 0) {
        const o = Math.max(cr.right - r.right, r.left - cr.left);
        if (o > over + 0.5) {
          over = o;
          culprit = describe(c);
        }
      }
      if (c.classList.contains("katex")) continue; // 수식은 바깥 상자만 재요(늘어나는 SVG 는 KaTeX 가 잘라 둬요)
      const st = getComputedStyle(c);
      if (st.overflowX === "auto" || st.overflowX === "scroll" || st.overflowX === "hidden") continue;
      walk(c);
    }
  };
  walk(box);
  return { over: Math.round(over), culprit };
}

function report(): BlockResult[] {
  const res: BlockResult[] = [];
  document.querySelectorAll<HTMLElement>("[data-i]").forEach((box) => {
    const it = items[Number(box.getAttribute("data-i"))];
    const m = measure(box);
    const txt = (box.textContent || "").replace(/\s+/g, "");
    res.push({
      lid: it.lid,
      path: it.path,
      t: it.b.t,
      w: Math.round(box.getBoundingClientRect().width),
      h: Math.round(box.getBoundingClientRect().height),
      over: m.over,
      culprit: m.culprit,
      scrolls: box.querySelectorAll(".is-overflow").length,
      katexErr: box.querySelectorAll(".katex-error, .ui-tex-raw").length,
      empty: txt.length === 0 && !box.querySelector("svg, canvas, input, button"),
    });
  });
  return res;
}

const W = window as unknown as { __BLOCKS__?: BlockResult[]; __BLOCKS_N__?: number };
W.__BLOCKS_N__ = items.length;
const root = document.getElementById("root") || document.body.appendChild(document.createElement("div"));
createRoot(root).render(<Harness />);

// 지연 불러오기(체험 도구)와 넘침 재기(수식 줄이기)가 끝나도록 잠깐 기다렸다가 재요
let tries = 0;
function settle() {
  tries++;
  const pending = document.querySelectorAll("[data-i]").length < items.length || document.querySelector(".ui-widget [aria-busy='true'], .wg-loading");
  if (pending && tries < 60) {
    setTimeout(settle, 100);
    return;
  }
  setTimeout(() => {
    W.__BLOCKS__ = report();
  }, 400);
}
setTimeout(settle, 200);
