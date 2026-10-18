// 학생용 카드 위치 글·행동 띠 전수 검사(단독 실행, verify 에는 넣지 않아요).
//   node scripts/check-card-fit.mjs [--port=7951] [--widths=320,360,375,390,412] [--fs=0,1,2,3] [--lessons=u1-1,...] [--dist=dist-s]
// 모든 레슨의 모든 카드를 '다음' 단추로 끝까지 넘기며 폭×글자 크기마다 다음을 재요.
//   1) .s-pos 와 그 자식·손자의 말줄임(scrollWidth>clientWidth) 건수  → 0 이어야 해요
//   2) 행동 띠 y · 다음 단추 x·폭 · 이전 단추 x·폭이 모든 단계에서 같은지(서로 다른 값 개수 = 1)
//   3) 이전·다음 단추 높이·폭 44px 이상, 위치 글 상자가 두 단추 사이에 들어 있는지
// playwright 는 설치하지 않고 전역 것을 찾아 써요. 빌드: npx vite build --mode student
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => {
  const a = process.argv.find((x) => x.startsWith("--" + k + "="));
  return a ? a.slice(k.length + 3) : d;
};
const PORT = Number(arg("port", "7951"));
const WIDTHS = arg("widths", "320,360,375,390,412").split(",").map(Number);
const FSS = arg("fs", "0,1,2,3").split(",").map(Number);
const DIST = path.join(ROOT, arg("dist", "dist-s"));
const MAXSTEPS = 400;

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
      for (const sub of ["chrome", "chrome-linux/chrome", "chrome-linux64/chrome"]) if (fs.existsSync(path.join(c, sub))) return path.join(c, sub);
    } catch {
      /* 다음 */
    }
  }
  return undefined;
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".txt": "text/plain" };
function serve() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const f = path.join(DIST, p);
    if (!f.startsWith(DIST) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
      res.writeHead(404);
      res.end("no");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => srv.listen(PORT, "127.0.0.1", () => ok(srv)));
}

const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plan.json"), "utf8"));
const LESSONS = arg("lessons", "") ? arg("lessons", "").split(",") : Object.keys(plan.lessons);

/** 화면에서 한 번에 재는 함수(브라우저 안) */
const MEASURE = () => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.left, y: b.top, w: b.width, h: b.height };
  };
  const pos = document.querySelector(".s-pos");
  const bar = document.querySelector(".s-actionbar");
  const next = document.querySelector(".s-actionbar .s-next");
  const prev = document.querySelector(".s-actionbar .s-prev");
  if (!pos || !bar || !next || !prev) return null;
  let clipped = 0;
  const clippedWhat = [];
  const all = [pos].concat(Array.prototype.slice.call(pos.querySelectorAll("*")));
  all.forEach((el) => {
    if (el.classList.contains("sr-only")) return;
    if (el.scrollWidth > el.clientWidth + 0.5 && el.clientWidth > 0) {
      clipped++;
      clippedWhat.push(el.tagName + ":" + (el.textContent || "").slice(0, 20) + " " + el.scrollWidth + ">" + el.clientWidth);
    }
  });
  // 보이는 글자 범위가 상자 안에 있는지(sr-only 제외)
  let tl = Infinity, tr = -Infinity;
  const walker = document.createTreeWalker(pos, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const p = n.parentElement;
    if (p && p.closest(".sr-only")) continue;
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const b = rg.getBoundingClientRect();
    tl = Math.min(tl, b.left);
    tr = Math.max(tr, b.right);
  }
  const pb = r(pos), nb = r(next), vb = r(prev);
  const outside = tl < pb.x - 0.5 || tr > pb.x + pb.w + 0.5 || tr > nb.x + 0.5 || tl < vb.x + vb.w - 0.5 ? 1 : 0;
  return {
    clipped, clippedWhat, outside,
    text: (pos.textContent || "").replace(/\s+/g, " ").trim(),
    barY: r(bar).y, barH: r(bar).h,
    next: nb, prev: vb, pos: pb,
    nextDisabled: next.disabled,
    hash: location.hash,
    docW: document.documentElement.scrollWidth,
  };
};

async function main() {
  const pw = loadPlaywright();
  if (!pw) {
    console.error("playwright 를 찾지 못했어요(설치하지 않아요).");
    process.exit(2);
  }
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    console.error("dist-s 가 없어요. 먼저 npx vite build --mode student");
    process.exit(2);
  }
  const srv = await serve();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const rows = [];
  let bad = 0;
  const details = [];
  try {
    for (const fsStep of FSS) {
      for (const w of WIDTHS) {
        const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 1, locale: "ko-KR", hasTouch: true, reducedMotion: "reduce" });
        const page = await ctx.newPage();
        await page.goto("http://127.0.0.1:" + PORT + "/", { waitUntil: "load" });
        const agg = { steps: 0, clipped: 0, outside: 0, barY: new Set(), nextX: new Set(), nextW: new Set(), prevX: new Set(), prevW: new Set(), minTap: 999, doc: 0, noCard: 0, errs: 0, where: {} };
        for (const lid of LESSONS) {
          let started = false;
          for (const st of ["story", "prereq", "c1"]) {
            await page.evaluate((h) => { location.hash = h; }, "#/l/" + lid + "/s/" + st + "/1");
            await page.evaluate((n) => document.documentElement.setAttribute("data-fs", String(n)), fsStep);
            try {
              await page.waitForSelector(".s-actionbar .s-next", { timeout: 4000 });
              started = true;
              break;
            } catch {
              /* 다음 단계 이름으로 */
            }
          }
          if (!started) {
            agg.noCard++;
            details.push("[시작 못 함] fs" + fsStep + " " + w + " " + lid);
            continue;
          }
          // 한 레슨을 브라우저 안에서 끝까지 넘기며 재요(클릭마다 왕복하지 않아 빨라요)
          const res = await page.evaluate(async ({ measureSrc, fsStep, max }) => {
            const measure = eval("(" + measureSrc + ")");
            const out = { steps: 0, clipped: 0, outside: 0, barY: [], nextX: [], nextW: [], prevX: [], prevW: [], minTap: 999, doc: 0, errs: [], loop: false, where: {}, wide: [] };
            const add = (arr, v) => { if (arr.indexOf(v) < 0) arr.push(v); };
            const tick = () => new Promise((ok) => setTimeout(ok, 0));
            for (let g = 0; ; g++) {
              document.documentElement.setAttribute("data-fs", String(fsStep));
              const m = measure();
              if (!m || m.hash.indexOf("/s/") < 0) break;
              if (m.docW > window.innerWidth) {
                // 카드가 들어오는 움직임 중의 잠깐 넘침은 빼고, 가라앉은 뒤에도 넘치는지 다시 재요
                await new Promise((ok) => setTimeout(ok, 450));
                m.docW = document.documentElement.scrollWidth;
              }
              out.steps++;
              out.clipped += m.clipped;
              out.outside += m.outside;
              add(out.barY, m.barY.toFixed(1)); add(out.nextX, m.next.x.toFixed(1)); add(out.nextW, m.next.w.toFixed(1)); add(out.prevX, m.prev.x.toFixed(1)); add(out.prevW, m.prev.w.toFixed(1));
              out.minTap = Math.min(out.minTap, m.prev.w, m.prev.h, m.next.w, m.next.h);
              out.doc = Math.max(out.doc, m.docW);
              ["nextW:" + m.next.w.toFixed(1), "nextX:" + m.next.x.toFixed(1), "barY:" + m.barY.toFixed(1)].forEach((k) => { if (!out.where[k]) out.where[k] = m.hash + " '" + m.text.slice(0, 16) + "'"; });
              if (m.docW > window.innerWidth && out.wide.length < 2) out.wide.push(m.hash + " docW " + m.docW);
              if (m.clipped || m.outside) out.errs.push(m.hash + " '" + m.text + "' " + m.clippedWhat.join(" | ") + (m.outside ? " (글자가 상자 밖)" : ""));
              if (m.nextDisabled) break;
              if (g > max) { out.loop = true; break; }
              const before = location.hash;
              document.querySelector(".s-actionbar .s-next").click();
              let w = 0;
              while (location.hash === before && w < 30) { await tick(); w++; }
              if (location.hash === before) break;
              await tick();
            }
            return out;
          }, { measureSrc: MEASURE.toString(), fsStep, max: MAXSTEPS });
          agg.steps += res.steps;
          agg.clipped += res.clipped;
          agg.outside += res.outside;
          res.barY.forEach((v) => agg.barY.add(v));
          res.nextX.forEach((v) => agg.nextX.add(v));
          res.nextW.forEach((v) => agg.nextW.add(v));
          res.prevX.forEach((v) => agg.prevX.add(v));
          res.prevW.forEach((v) => agg.prevW.add(v));
          agg.minTap = Math.min(agg.minTap, res.minTap);
          agg.doc = Math.max(agg.doc, res.doc);
          agg.errs += res.errs.length;
          res.errs.slice(0, 3).forEach((e) => details.push("[잘림] fs" + fsStep + " " + w + " " + lid + " " + e));
          Object.keys(res.where).forEach((k) => { (agg.where[k] = agg.where[k] || res.where[k] ? agg.where[k] || lid + " " + res.where[k] : 0); });
          res.wide.forEach((x) => details.push("[가로 넘침] fs" + fsStep + " " + w + " " + lid + " " + x));
          if (res.loop) details.push("[무한 반복 의심] " + lid);
        }
        if (agg.nextW.size > 1 || agg.nextX.size > 1 || agg.barY.size > 1) Object.keys(agg.where).forEach((k) => details.push("[값 처음 나온 곳] fs" + fsStep + " " + w + " " + k + " ← " + agg.where[k]));
        const row = { fs: fsStep, w, steps: agg.steps, clipped: agg.clipped, outside: agg.outside, barY: [...agg.barY].join("/"), nextX: [...agg.nextX].join("/"), nextW: [...agg.nextW].join("/"), prevX: [...agg.prevX].join("/"), prevW: [...agg.prevW].join("/"), minTap: agg.minTap, docW: agg.doc, noCard: agg.noCard };
        const viol = agg.clipped + agg.outside + agg.noCard + (agg.barY.size > 1 ? 1 : 0) + (agg.nextX.size > 1 ? 1 : 0) + (agg.nextW.size > 1 ? 1 : 0) + (agg.prevX.size > 1 ? 1 : 0) + (agg.prevW.size > 1 ? 1 : 0) + (agg.minTap < 44 ? 1 : 0) + (agg.doc > w ? 1 : 0);
        row.viol = viol;
        bad += viol;
        rows.push(row);
        console.log("fs" + fsStep + " w" + w + " 단계 " + row.steps + " 말줄임 " + row.clipped + " 상자밖 " + row.outside + " | 띠y " + row.barY + " 다음x " + row.nextX + " 다음폭 " + row.nextW + " 이전x " + row.prevX + " 이전폭 " + row.prevW + " 최소터치 " + row.minTap + " 가로스크롤 " + row.docW + " → " + (viol ? "위반 " + viol : "통과"));
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    srv.close();
  }
  details.slice(0, 40).forEach((d) => console.log(d));
  console.log("레슨 " + LESSONS.length + "개 · 조합 " + rows.length + "개 · 총 단계 " + rows.reduce((a, r) => a + r.steps, 0) + " · 위반 합계 " + bad);
  process.exit(bad ? 1 : 0);
}
main();
