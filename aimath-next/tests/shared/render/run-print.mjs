// 인쇄 미리 보기 검사: 교사 개발 서버에서 #/print/:lid 를 print 미디어로 그리고
//   (1) 종이 안 모든 글자 · 테두리 · 바탕 · SVG 칠이 무채색(흑백)인지
//   (2) 종이 폭(A4) 밖으로 넘치는 것이 없는지
//   (3) KaTeX 오류가 없는지
// 를 재요. 어두운 테마 · 칠판 테마로 열어 두어도 종이는 흑백이어야 해요.
//   node tests/shared/render/run-print.mjs [촬영 폴더]   → 요약 + (폴더를 주면) png
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromiumPath, loadPlaywright, startServer } from "./run-blocks.mjs";

/** 무채색으로 볼 허용 차(채널 최댓값 - 최솟값) */
const TOL = 6;

/**
 * cases: [{ lid, set?: "board"|"exit"|"hw", key?: boolean, theme?: "light"|"dark"|"chalk", shot?: string }]
 * 돌려줌: { results: [{ name, colored: string[], over: string[], katexErr, qs, paperW }], errors } 또는 null
 */
export async function runPrint(cases) {
  const pw = loadPlaywright();
  if (!pw) return null;
  const { server, base } = await startServer();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const results = [];
  const errors = [];
  try {
    for (const c of cases) {
      const name = c.lid + "-" + (c.set || "board") + (c.key ? "-key" : "") + "-" + (c.theme || "light");
      const ctx = await browser.newContext({ viewport: { width: 696, height: 1000 } /* A4 210mm - 쪽 여백 13mm×2 ≈ 184mm ≈ 696px */, deviceScaleFactor: 1, colorScheme: c.theme === "dark" ? "dark" : "light" });
      // 테마는 교사 읽기 설정(aimn:t1:prefs)으로 걸어요
      await ctx.addInitScript((theme) => {
        try {
          localStorage.setItem("aimn:t1:prefs", JSON.stringify({ fs: 1, theme: theme, contrast: false, motion: "auto", speak: false }));
        } catch (e) {
          /* 저장소가 막혀도 괜찮아요 */
        }
      }, c.theme || "light");
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(name + ": " + e.message));
      const qs = "?set=" + (c.set || "board") + (c.key ? "&key=1" : "");
      await page.goto(base + "/#/print/" + c.lid + qs, { waitUntil: "load", timeout: 120000 });
      await page.waitForSelector(".pr-paper .pr-foot", { timeout: 120000 });
      await page.emulateMedia({ media: "print" });
      await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : null));
      await page.waitForTimeout(150);
      const r = await page.evaluate((tol) => {
        const paper = document.querySelector(".pr-paper");
        const pr = paper.getBoundingClientRect();
        const colored = [];
        const over = [];
        const chroma = (s) => {
          const m = /rgba?\(([^)]+)\)/.exec(s || "");
          if (!m) return 0;
          const v = m[1].split(",").map((x) => parseFloat(x));
          if (v.length > 3 && v[3] === 0) return 0; // 투명
          return Math.max(v[0], v[1], v[2]) - Math.min(v[0], v[1], v[2]);
        };
        const tag = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className ? "." + el.className.split(/\s+/)[0] : "");
        // 안 보이는 것(display:none · 화면 전용)은 빼요
        const all = [document.documentElement, document.body].concat(Array.prototype.slice.call(document.body.querySelectorAll("*")));
        for (const el of all) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const rect = el.getBoundingClientRect();
          if (el !== document.documentElement && el !== document.body && (rect.width === 0 || rect.height === 0)) continue;
          if (el.closest(".katex-mathml")) continue;
          const props = ["color", "backgroundColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor", "fill", "stroke", "outlineColor"];
          for (const p of props) {
            if (p.indexOf("border") === 0 && parseFloat(cs[p.replace("Color", "Width")]) === 0) continue;
            if (p === "outlineColor" && cs.outlineStyle === "none") continue;
            if ((p === "fill" || p === "stroke") && !(el instanceof SVGElement)) continue;
            if (p === "color" && !(el.textContent || "").trim()) continue;
            const ch = chroma(cs[p]);
            if (ch > tol) colored.push(tag(el) + " " + p + "=" + cs[p]);
          }
          if (cs.backgroundImage && cs.backgroundImage !== "none" && /gradient|url/.test(cs.backgroundImage)) colored.push(tag(el) + " background-image");
          if (paper.contains(el) && rect.width > 0 && rect.right > pr.right + 1 && !el.closest(".katex .katex-html svg")) over.push(tag(el) + " +" + Math.round(rect.right - pr.right));
        }
        return {
          colored: colored.slice(0, 30),
          coloredN: colored.length,
          over: over.slice(0, 30),
          katexErr: paper.querySelectorAll(".katex-error, .ui-tex-raw").length,
          qs: paper.querySelectorAll(".pr-q").length,
          paperW: Math.round(pr.width),
          visibleButtons: Array.prototype.slice.call(document.querySelectorAll("button, .btn")).filter((b) => getComputedStyle(b).display !== "none" && b.getBoundingClientRect().width > 0).length,
        };
      }, TOL);
      if (c.shot) await page.screenshot({ path: c.shot, fullPage: true });
      results.push(Object.assign({ name }, r));
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return { results, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  const lids = (process.argv[3] || "u1-1,u2-3,u3-3,u4-4,u5-2").split(",");
  const cases = [];
  for (const lid of lids) {
    cases.push({ lid, set: "board", theme: "dark" });
    cases.push({ lid, set: "board", key: true, theme: "chalk" });
    cases.push({ lid, set: "hw", theme: "light" });
  }
  if (dir) for (const c of cases) c.shot = path.join(dir, "print-" + c.lid + "-" + (c.set || "board") + (c.key ? "-key" : "") + "-" + c.theme + ".png");
  const r = await runPrint(cases);
  if (!r) {
    console.log("playwright 를 찾지 못해 건너뛰어요.");
    process.exit(0);
  }
  for (const x of r.results) {
    console.log(`[${x.name}] 문제 ${x.qs} · 종이 ${x.paperW}px · 색 ${x.coloredN} · 넘침 ${x.over.length} · KaTeX 오류 ${x.katexErr} · 보이는 단추 ${x.visibleButtons}`);
    for (const s of x.colored) console.log("   색", s);
    for (const s of x.over) console.log("   넘침", s);
  }
  if (r.errors.length) console.log("페이지 오류:\n" + r.errors.join("\n"));
}
