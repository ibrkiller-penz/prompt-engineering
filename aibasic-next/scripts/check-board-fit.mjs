#!/usr/bin/env node
// 칠판 문제 장면 '한 화면' 전수 검사(단독 실행, verify 에는 넣지 않아요).
//   먼저 `npx vite build --mode teacher` 로 dist-t 를 만들어 두세요.
//   node scripts/check-board-fit.mjs [--lessons=u1_1_1,u2_A] [--port=7501] [--verbose]
// 26개 레슨 × 차시 × 모든 문제 장면 × 모든 공개 단계(보기 가리기 · 보기 · 힌트 · 정답 · 풀이)에서
//  1) 문제 영역(.bdq) 안에 scrollHeight>clientHeight 인 스크롤·잘림 칸이 없는지
//  2) 보기(.bdq-opt)·손들기 단추(.bdq-tally button)·정답/풀이 칸(.bdq-panel)·공개 단추가 무대(높이 0~1080) 안에, 그리고 어떤 조상 칸에도 잘리지 않고 보이는지
//  3) 제시문·보기·정답/풀이 글자가 28px 이상인지(코드 포함)
// 를 재요. 위반이 있으면 1 로 끝나요.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.resolve(ROOT, (args.find((x) => x.indexOf("--dist=") === 0) || "--dist=dist-t").slice(7));
const require = createRequire(import.meta.url);
const opt = (n) => {
  const a = args.find((x) => x.indexOf("--" + n + "=") === 0);
  return a ? a.slice(n.length + 3) : "";
};
const PORT = parseInt(opt("port") || "7501", 10);
const VERBOSE = args.indexOf("--verbose") >= 0;
const LESSONS = opt("lessons") ? opt("lessons").split(",") : null;

function loadPlaywright() {
  const tries = ["playwright", "/opt/node-tools/node_modules/playwright"];
  try {
    tries.push(path.join(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), "playwright"));
  } catch {}
  for (const t of tries) {
    try {
      return require(t);
    } catch {}
  }
  return null;
}
function chromiumPath() {
  for (const c of [process.env.AIBN_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean)) {
    try {
      const st = fs.statSync(c);
      if (st.isFile()) return c;
      for (const sub of ["chrome", "chrome-linux/chrome", "chrome-linux64/chrome", "chromium"]) if (fs.existsSync(path.join(c, sub))) return path.join(c, sub);
    } catch {}
  }
  return undefined;
}
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".txt": "text/plain" };
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    let f = path.join(DIST, p);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, "index.html");
    res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(PORT, "127.0.0.1", () => ok(srv)));
}

/** 브라우저 안에서 도는 측정 함수(문제 장면이 아니면 null) */
function measure() {
  const q = document.querySelector(".bdq");
  if (!q) return null;
  const stage = document.querySelector(".bd-stage");
  const sr = stage.getBoundingClientRect();
  const k = sr.width / 1920 || 1;
  const bad = [];
  const cnt = { opts: 0, tally: 0 };
  const rel = (r) => ({ t: (r.top - sr.top) / k, b: (r.bottom - sr.top) / k, l: (r.left - sr.left) / k, r: (r.right - sr.left) / k });
  // 1) 스크롤·잘림 칸
  const all = [q].concat(Array.prototype.slice.call(q.querySelectorAll("*")));
  for (const el of all) {
    if (el.classList.contains("sr-only")) continue;
    const cs = getComputedStyle(el);
    if (el.clientHeight && el.scrollHeight > el.clientHeight + 1 && (cs.overflowY !== "visible")) {
      bad.push("스크롤/잘림 칸 " + el.className.toString().slice(0, 40) + " " + el.scrollHeight + ">" + el.clientHeight);
    }
    if (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== "visible" && !el.closest(".ui-code-pre")) {
      bad.push("가로 잘림 " + el.className.toString().slice(0, 40) + " " + el.scrollWidth + ">" + el.clientWidth);
    }
  }
  // 2) 위치: 무대 안 + 조상에 안 잘림
  const clipped = (el, rr) => {
    for (let a = el.parentElement; a && a !== stage; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowY !== "visible" || cs.overflowX !== "visible") {
        const ar = rel(a.getBoundingClientRect());
        if (rr.b > ar.b + 1 || rr.t < ar.t - 1 || rr.r > ar.r + 1 || rr.l < ar.l - 1) return a.className.toString().slice(0, 30);
      }
    }
    return "";
  };
  const items = q.querySelectorAll(".bdq-opt, .bdq-tally button, .bdq-answer, .bdq-card, .bdq-step, .bdq-groups-open, .bdq-passage .ui-qpassage, .bdq-prompt, .bdq-head");
  for (const el of items) {
    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height) continue;
    const r = rel(r0);
    const nm = el.className.toString().split(" ")[0];
    if (el.matches(".bdq-opt")) cnt.opts++;
    if (el.matches(".bdq-tally button")) cnt.tally++;
    if (r.t < -0.5 || r.b > 1080.5 || r.l < -0.5 || r.r > 1920.5) bad.push("무대 밖 " + nm + " 위" + Math.round(r.t) + " 아래" + Math.round(r.b) + " 좌" + Math.round(r.l) + " 우" + Math.round(r.r));
    const c = clipped(el, r);
    if (c) bad.push("조상에 잘림 " + nm + " ← " + c);
  }
  // 본문(.bd-scene-inner)이 896 을 넘지 않는지
  const inner = document.querySelector(".bd-scene-inner");
  if (inner && inner.scrollHeight > 898) bad.push("본문 높이 " + inner.scrollHeight + ">896");
  // 겹침: 보기 · 손들기 단추 · 정답/힌트/풀이 칸 · 제시문 · 질문 · 공개 단추끼리(포함 관계는 빼요)
  const boxes = [];
  const add = (sel, nm) => q.querySelectorAll(sel).forEach((e) => { const r0 = e.getBoundingClientRect(); if (r0.width && r0.height) boxes.push({ e: e, nm: nm, r: rel(r0) }); });
  add(".bdq-opt", "보기"); add(".bdq-answer", "정답"); add(".bdq-card", "힌트/풀이"); add(".bdq-passage .ui-qpassage", "제시문"); add(".bdq-prompt", "질문"); add(".bdq-steps", "공개단추"); add(".bdq-groups-open", "모둠점수"); add(".bdq-head", "머리");
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
    if (a.r.l < b.r.r - 1 && b.r.l < a.r.r - 1 && a.r.t < b.r.b - 1 && b.r.t < a.r.b - 1) bad.push("겹침 " + a.nm + "·" + b.nm);
  }
  // 내용이 담은 칸 밖으로 삐져나감(보기 묶음이 본문 칸보다 큼)
  const bodyEl = q.querySelector(".bdq-body");
  if (bodyEl) { const br = rel(bodyEl.getBoundingClientRect()); q.querySelectorAll(".bdq-opt").forEach((o) => { const a = rel(o.getBoundingClientRect()); if (a.b > br.b + 1) bad.push("보기가 본문 칸 밖"); }); }
  // 3) 글자 28px
  const tx = q.querySelectorAll(".bdq-passage *, .bdq-opt-txt, .bdq-opt-txt *, .bdq-card-txt, .bdq-card-txt *, .bdq-answer, .bdq-prompt");
  let minFs = 999, minTxt = "";
  for (const el of tx) {
    if (el.closest("svg, .wg-host, [aria-hidden='true'], .bdq-cover, .katex-html, .ui-code-tag")) continue;
    let d = "";
    for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) d += c.textContent;
    if (d.trim().length < 1) continue;
    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height) continue;
    const f = parseFloat(getComputedStyle(el).fontSize);
    if (f < minFs) { minFs = f; minTxt = el.tagName + "." + (el.className || "").toString().slice(0, 20) + " '" + d.trim().slice(0, 12) + "'"; }
  }
  if (minFs < 27.99) bad.push("글자 " + Math.round(minFs * 10) / 10 + "px<28 " + minTxt);
  return { bad: bad, opts: cnt.opts, tally: cnt.tally, pass: !!q.querySelector(".bdq-passage .ui-qpassage") };
}

const pw = loadPlaywright();
if (!pw) { console.error("playwright 를 찾지 못했어요"); process.exit(2); }
if (!fs.existsSync(path.join(DIST, "index.html"))) { console.error("dist-t 가 없어요. 먼저 npx vite build --mode teacher"); process.exit(2); }
const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plan.json"), "utf8"));
const order = (LESSONS || Object.keys(plan.lessons)).slice();
const srv = await serve();
const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: "ko-KR", reducedMotion: "reduce" });
const page = await ctx.newPage();
const base = "http://127.0.0.1:" + PORT;
let lessons = 0, periodsN = 0, qScenes = 0, states = 0, withPass = 0, optsSeen = 0, tallySeen = 0;
const viol = [];
try {
  for (const lid of order) {
    lessons++;
    const periods = ((plan.lessons[lid] || {}).periods || [{ p: 1 }]).map((x) => x.p).filter((p) => p === 1 || p === 2);
    for (const p of periods) {
      periodsN++;
      await page.goto(base + "/#/board/" + lid + "?p=" + p + "&s=0", { waitUntil: "load" });
      await page.waitForSelector(".bd-scene", { timeout: 15000 }).catch(() => {});
      await page.keyboard.press("Home").catch(() => {});
      let guard = 0, last = "", same = 0;
      const seenQ = {};
      while (guard++ < 800) {
        await page.waitForTimeout(40);
        const info = await page.evaluate(`(${measure.toString()})()`);
        const meta = await page.evaluate(() => {
          const n = document.querySelector(".bd-next");
          return { count: (document.querySelector(".bd-head-count") || {}).textContent || "", label: n ? n.getAttribute("aria-label") || "" : "", has: !!n };
        });
        if (info) {
          states++;
          optsSeen += info.opts; tallySeen += info.tally;
          const qk = meta.count;
          if (!seenQ[qk]) { seenQ[qk] = 1; qScenes++; if (info.pass) withPass++; }
          for (const b of info.bad) viol.push(lid + " p" + p + " [" + meta.count + "] (" + meta.label.slice(0, 14) + ") " + b);
        }
        if (/마지막 장면/.test(meta.label) || !meta.has) break;
        const sig = meta.count + "|" + meta.label;
        same = sig === last ? same + 1 : 0;
        last = sig;
        if (same > 3) { viol.push(lid + " p" + p + " [" + meta.count + "] 다음이 안 넘어가요"); break; }
        await page.click(".bd-next");
      }
    }
  }
} finally {
  await browser.close();
  srv.close();
}
console.log("check-board-fit: 레슨 " + lessons + "개, 차시 " + periodsN + "개, 문제 장면 " + qScenes + "개(제시문 있는 것 " + withPass + "개), 측정한 공개 상태 " + states + "번, 보기 " + optsSeen + "개·손들기 단추 " + tallySeen + "개를 쟀어요");
const byKind = {};
for (const v of viol) { const k = v.replace(/^.*\) /, "").replace(/\d+/g, "N").slice(0, 40); byKind[k] = (byKind[k] || 0) + 1; }
if (VERBOSE || viol.length < 60) for (const v of viol) console.log("  ! " + v);
console.log("위반 " + viol.length + "건" + (viol.length ? " " + JSON.stringify(byKind) : ""));
process.exit(viol.length ? 1 : 0);
