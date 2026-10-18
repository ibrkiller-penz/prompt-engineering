#!/usr/bin/env node
// 칠판 문제 장면 한 화면 검사(단독 실행, verify 에는 넣지 않아요).
//   먼저 `npx vite build --mode teacher` 로 dist-t 를 만들어 두어야 해요.
//   20레슨 × 차시(p=1,2) × 모든 문제 장면에서, 정답·힌트·풀이를 모두 연 단계까지 '다음'을 눌러 가며
//   (1) 문제 영역(.bdq) 안에 scrollHeight>clientHeight 인 스크롤 영역이 없고
//   (2) 보이는 모든 요소가 무대(0~1080 × 0~1920) 안에 있는지 재요. 위반이 하나라도 있으면 1로 끝나요.
//   node scripts/check-board-fit.mjs [--lessons=u1-1,u3-1] [--fs=0..3] [--port=7801] [--verbose]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n) => {
  const a = args.find((x) => x.indexOf("--" + n + "=") === 0);
  return a ? a.slice(n.length + 3) : "";
};
const LESSONS = opt("lessons") ? opt("lessons").split(",") : null;
const PORT = Number(opt("port") || 7801);
const FS = opt("fs");
const VERBOSE = args.indexOf("--verbose") >= 0;

function loadPlaywright() {
  const tries = ["playwright", "/opt/node-tools/node_modules/playwright"];
  try {
    tries.push(path.join(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), "playwright"));
  } catch {
    /* 없어도 돼요 */
  }
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      /* 다음 */
    }
  }
  return null;
}
function chromiumPath() {
  for (const c of [process.env.AIMN_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    try {
      const st = fs.statSync(c);
      if (st.isFile()) return c;
      for (const sub of ["chrome", "chrome-linux/chrome", "chrome-linux64/chrome", "chromium"]) if (fs.existsSync(path.join(c, sub))) return path.join(c, sub);
    } catch {
      /* 다음 */
    }
  }
  return undefined;
}

const pw = loadPlaywright();
if (!pw) {
  console.error("playwright 를 찾지 못했어요");
  process.exit(2);
}
const { preview } = await import("vite");
const server = await preview({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), mode: "teacher", logLevel: "error", preview: { port: PORT, strictPort: true, host: "127.0.0.1", open: false } });
const base = `http://127.0.0.1:${PORT}`;
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plan.json"), "utf8"));
const { buildContentIndex } = await import("../tools/content-index.mjs");
const order = buildContentIndex().index.order.filter((id) => !LESSONS || LESSONS.indexOf(id) >= 0);

const bad = [];
let scenes = 0;
let steps = 0;
const browser = await pw.chromium.launch({ executablePath: chromiumPath(), headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "ko-KR", reducedMotion: "reduce" });
  const page = await ctx.newPage();
  for (const lid of order) {
    const periods = ((plan.lessons[lid] || {}).periods || [{ p: 1 }]).map((x) => x.p);
    for (const p of periods) {
      await page.goto(base + `/${FS ? "?fs=" + FS : ""}#/board/${lid}?p=${p}&s=0`, { waitUntil: "load" });
      await page.waitForSelector(".bd-scene", { timeout: 10000 }).catch(() => {});
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      await page.keyboard.press("Home").catch(() => {});
      const res = await page.evaluate(async () => {
        const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const out = { bad: [], scenes: {}, steps: 0, qscenes: 0 };
        const seenQ = {};
        let guard = 0;
        let lastSig = "";
        let same = 0;
        const sel = (el) => el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
        while (guard++ < 800) {
          await raf();
          await wait(30);
          await raf();
          const count = (document.querySelector(".bd-head-count") || {}).textContent || "";
          const nextBtn = document.querySelector(".bd-next");
          const label = nextBtn ? nextBtn.getAttribute("aria-label") || "" : "";
          out.steps++;
          out.scenes[count] = 1;
          const q = document.querySelector(".bd-scene .bdq");
          if (q) {
            seenQ[count] = 1;
            const stage = document.querySelector(".bd-stage");
            const sr = stage.getBoundingClientRect();
            const k = sr.width / (stage.offsetWidth || 1) || 1;
            const nodes = [q].concat(Array.prototype.slice.call(q.querySelectorAll("*")));
            for (const el of nodes) {
              const cs = getComputedStyle(el);
              if (cs.display === "none" || cs.visibility === "hidden") continue;
              if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
              if (el.closest(".bdq-groups")) continue; // 모둠 점수 팝업은 닫혀 있어요
              if (/(auto|scroll|hidden)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1)
                out.bad.push({ count, why: "스크롤 영역 " + sel(el) + " scrollHeight " + el.scrollHeight + " > clientHeight " + el.clientHeight });
              if (/(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) out.bad.push({ count, why: "가로 스크롤 영역 " + sel(el) });
              const r = el.getBoundingClientRect();
              if (!r.width && !r.height) continue;
              // 가림(overflow:hidden) 안에서 잘려 보이지 않는 .katex 내부 같은 것은 부모 검사로 충분
              if (r.top < -1 || r.bottom > 1080 + 1 || r.left < -1 || r.right > 1920 + 1) out.bad.push({ count, why: "무대 밖 " + sel(el) + " top " + Math.round(r.top) + " bottom " + Math.round(r.bottom) + " right " + Math.round(r.right) });
            }
            // 글자 28px 이상(풀이·힌트 카드 글)
            const tx = q.querySelectorAll(".bdq-card-txt, .bdq-card-txt p");
            for (const el of tx) {
              const f = parseFloat(getComputedStyle(el).fontSize);
              if (f < 28 - 0.01) out.bad.push({ count, why: "카드 글자 " + f + "px < 28" });
            }
          }
          if (/마지막 장면/.test(label) || !nextBtn) break;
          const sig = count + "|" + label + "|" + (document.querySelector(".bd-next-txt") || {}).textContent;
          same = sig === lastSig ? same + 1 : 0;
          lastSig = sig;
          if (same > 3) {
            out.bad.push({ count, why: "'다음'이 넘어가지 않아요" });
            break;
          }
          nextBtn.click();
        }
        out.qscenes = Object.keys(seenQ).length;
        return out;
      });
      scenes += res.qscenes;
      steps += res.steps;
      const seen = {};
      for (const b of res.bad) {
        const key = b.count + "|" + b.why;
        if (seen[key]) continue;
        seen[key] = 1;
        bad.push(`${lid} p${p} ${b.count}: ${b.why}`);
      }
      if (VERBOSE) console.log(`  · ${lid} p${p}: 문제 장면 ${res.qscenes}, 단계 ${res.steps}`);
    }
  }
  await ctx.close();
} finally {
  await browser.close();
  server.httpServer.close();
}
console.log(`check-board-fit: 레슨 ${order.length}개, 문제 장면 ${scenes}개, 공개 단계 ${steps}번(정답·힌트·풀이 모두 연 단계 포함)을 재었어요`);
if (bad.length) {
  console.log("위반 " + bad.length + "건");
  for (const b of bad) console.log("  ✗ " + b);
  process.exit(1);
}
console.log("위반 0");
