#!/usr/bin/env node
// 브라우저 촬영과 화면 검사(playwright, 설치하지 않고 전역 것을 찾아 써요).
//   먼저 빌드해 두어야 해요(npm run build). vite preview 로 학생 4301 · 교사 4302 를 띄우고
//   tools/fixtures/*.json 의 가짜 학습 기록을 localStorage 에 미리 넣은 뒤 찍어요.
//
//   node scripts/shots.mjs                학생 375×812 · 교사 1920×1080 주요 화면을 tools/shots/ 에 저장 + 검사
//   node scripts/shots.mjs --check        촬영하면서 콘솔 오류 · pageerror · 외부 요청 · 가로 넘침이 0건인지 봐요(기본으로 켜져 있어요)
//   node scripts/shots.mjs --all-scenes   26레슨 × 모든 차시의 모든 칠판 장면(공개 단계마다)이 본문 896px 안에 드는지 봐요
//   node scripts/shots.mjs --smoke        저장 없이 두 사이트 첫 화면과 몇 화면만 빠르게 검사(verify 마지막 단계)
//   node scripts/shots.mjs --qa           통합 점검 사진 qa-board-1920-01~12 · qa-phone-375-01~09 를 다시 찍어요(tools/shots/qa-*.png)
//   --only=s | --only=t                   한 사이트만
//   --lessons=u1_1_1,u2_1_3                   --all-scenes 대상 레슨 줄이기
// 화면마다 '불러오는 중'(.ui-loading · .t-loading · 글자 '불러오는 중')이 사라질 때까지 기다리고, 남아 있으면 문제로 적어요.
// 하나라도 문제가 있으면 1로 끝나요.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tools", "shots");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const has = (f) => args.indexOf(f) >= 0;
const opt = (name) => {
  const a = args.find((x) => x.indexOf("--" + name + "=") === 0);
  return a ? a.slice(name.length + 3) : "";
};
const SMOKE = has("--smoke");
const ALL_SCENES = has("--all-scenes");
const QA = has("--qa");
const ONLY = opt("only");
const LESSON_FILTER = opt("lessons") ? opt("lessons").split(",") : null;
const SAVE = !SMOKE && !has("--no-save");

/* ─────────── playwright 찾기 ─────────── */
function loadPlaywright() {
  const tries = ["playwright", "/opt/node-tools/node_modules/playwright"];
  try {
    tries.push(path.join(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), "playwright"));
  } catch {
    /* 없어도 괜찮아요 */
  }
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      /* 다음 후보 */
    }
  }
  return null;
}
function chromiumPath() {
  const cands = [process.env.AIBN_CHROMIUM, "/opt/pw-browsers/chromium"].filter(Boolean);
  for (const c of cands) {
    try {
      const st = fs.statSync(c);
      if (st.isFile()) return c;
      if (st.isDirectory()) {
        // 폴더면 안쪽 실행 파일을 찾아요
        for (const sub of ["chrome", "chrome-linux/chrome", "chrome-linux64/chrome", "chromium"]) if (fs.existsSync(path.join(c, sub))) return path.join(c, sub);
      }
    } catch {
      /* 다음 */
    }
  }
  return undefined; // PLAYWRIGHT_BROWSERS_PATH 기본값에 맡겨요
}

/* ─────────── 미리보기 서버 ─────────── */
async function startPreview(mode, port) {
  const { preview } = await import("vite");
  const server = await preview({
    root: ROOT,
    configFile: path.join(ROOT, "vite.config.ts"),
    mode,
    logLevel: "error",
    preview: { port, strictPort: true, host: "127.0.0.1", open: false },
  });
  return { server, base: `http://127.0.0.1:${port}` };
}

/* ─────────── 공통 ─────────── */
const problems = [];
const saved = [];
const fixture = (name) => {
  const f = path.join(ROOT, "tools", "fixtures", name + ".json");
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")).storage || {} : {};
};

async function newContext(browser, site, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: "ko-KR", timezoneId: "Asia/Seoul", hasTouch: site === "s", isMobile: false, reducedMotion: "reduce" });
  // 처음 한 번만 가짜 기록을 넣어요(이후 화면에서 바꾼 값은 지키도록 표시를 남겨요)
  await ctx.addInitScript(
    ({ data }) => {
      try {
        if (!sessionStorage.getItem("__aibn_fixture")) {
          for (const k of Object.keys(localStorage)) if (k.indexOf("aibn:") === 0) localStorage.removeItem(k);
          for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k]));
          sessionStorage.setItem("__aibn_fixture", "1");
        }
      } catch {
        /* 저장소가 막혀도 촬영은 계속 */
      }
    },
    { data: fixture(site === "s" ? "student" : "teacher") },
  );
  return ctx;
}

/** 페이지에 검사 귀를 달아요. 반환한 함수로 이번 화면에서 모인 문제를 꺼내요 */
function watch(page, base) {
  let bag = [];
  // 상태 404 같은 응답은 주소와 함께 적어요. /favicon.ico 는 미리보기 서버에만 없어요(배포에서는 index.html 로 rewrite)
  let lastBad = [];
  page.on("response", (r) => {
    if (r.status() >= 400) {
      const u = r.url().replace(base, "");
      if (u === "/favicon.ico") lastBad.push("favicon");
      else bag.push("응답 " + r.status() + ": " + u.slice(0, 120));
    }
  });
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/Failed to load resource/.test(t)) {
      if (lastBad.length && lastBad[0] === "favicon") lastBad.shift();
      return; // 실패 응답은 위 response 에서 주소와 함께 적어요
    }
    bag.push("콘솔 오류: " + t.slice(0, 200));
  });
  page.on("pageerror", (e) => bag.push("pageerror: " + String(e && e.message).slice(0, 200)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.indexOf(base) !== 0 && !/^(data|blob|about|chrome-extension):/.test(u)) bag.push("외부 요청: " + u.slice(0, 120));
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    const why = (r.failure() && r.failure().errorText) || "";
    // 새로 고침·화면 이동으로 끊긴 요청(ERR_ABORTED)은 실패가 아니에요
    if (u.indexOf(base) === 0 && !/ERR_ABORTED/.test(why)) bag.push("요청 실패: " + u.replace(base, "") + " " + ((r.failure() && r.failure().errorText) || ""));
  });
  return () => {
    const out = bag;
    bag = [];
    return out;
  };
}

/** 불러오는 중 표시: 이것들이 남아 있으면 아직 덜 그려진 화면이에요 */
const LOADING_SEL = ".ui-loading, .t-loading, .is-loading, [aria-busy='true']";
const LOADING_TXT = "불러오는 중";

/** 화면이 다 그려질 때까지 기다려요. 끝내 '불러오는 중'이 남으면 그 설명을, 아니면 null 을 돌려줘요 */
async function settle(page, timeout = 10000) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* 계속 */
  }
  await page
    .waitForFunction(
      ({ sel, txt }) => {
        const r = document.getElementById("root");
        return !!r && r.children.length > 0 && !document.querySelector(sel) && (document.body.innerText || "").indexOf(txt) < 0;
      },
      { sel: LOADING_SEL, txt: LOADING_TXT },
      { timeout },
    )
    .catch(() => {});
  // 글꼴(KaTeX)까지 기다려요
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true)).catch(() => {});
  await page.waitForTimeout(250);
  return page
    .evaluate(
      ({ sel, txt }) => {
        const el = document.querySelector(sel);
        if (el) return "불러오는 중 표시가 남아 있어요(" + el.tagName.toLowerCase() + "." + String(el.className || "").trim().split(/\s+/).join(".") + ")";
        const t = document.body.innerText || "";
        const i = t.indexOf(txt);
        if (i >= 0) return "'" + t.slice(Math.max(0, i - 20), i + 20).replace(/\s+/g, " ") + "' 글자가 남아 있어요";
        return null;
      },
      { sel: LOADING_SEL, txt: LOADING_TXT },
    )
    .catch(() => null);
}

async function overflowX(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const w = d.clientWidth;
    if (d.scrollWidth <= w + 1) return null;
    // 범인 찾기: 화면 밖으로 나간 요소 하나
    let culprit = "";
    const all = document.body.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const r = all[i].getBoundingClientRect();
      if (r.right > w + 1 && r.width > 0) {
        let p = all[i].parentElement;
        let clipped = false;
        while (p && p !== document.body) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === "auto" || ov === "scroll" || ov === "hidden") {
            clipped = true;
            break;
          }
          p = p.parentElement;
        }
        if (!clipped) {
          culprit = all[i].tagName.toLowerCase() + (all[i].className && typeof all[i].className === "string" ? "." + all[i].className.trim().split(/\s+/).join(".") : "");
          break;
        }
      }
    }
    return { scrollWidth: d.scrollWidth, clientWidth: w, culprit };
  });
}

async function visit(page, collect, base, site, name, hash, opts = {}) {
  const url = base + "/#" + hash;
  try {
    await page.goto(url, { waitUntil: "load" });
    if (opts.reload) await page.reload({ waitUntil: "load" });
    const stuck = await settle(page);
    if (stuck) problems.push(`[${site}] ${name} (${hash}): ${stuck}`);
    if (opts.after) {
      await opts.after(page);
      const stuck2 = await settle(page, 5000);
      if (stuck2 && !stuck) problems.push(`[${site}] ${name} (${hash}) 조작 뒤: ${stuck2}`);
    }
  } catch (e) {
    problems.push(`[${site}] ${name} (${hash}): 열지 못했어요 — ${e.message}`);
    return;
  }
  const ov = await overflowX(page);
  if (ov) problems.push(`[${site}] ${name} (${hash}): 가로 넘침 ${ov.scrollWidth}>${ov.clientWidth} ${ov.culprit}`);
  for (const p of collect()) problems.push(`[${site}] ${name} (${hash}): ${p}`);
  if (SAVE) {
    const file = path.join(OUT, opts.file ? opts.file + ".png" : `${site === "s" ? "student" : "teacher"}-${name}.png`);
    await page.screenshot({ path: file, fullPage: !!opts.full });
    saved.push(path.relative(ROOT, file));
  }
}

async function setPrefs(page, site, patch) {
  await page.evaluate(
    ({ key, patch }) => {
      try {
        const cur = JSON.parse(localStorage.getItem(key) || "{}");
        localStorage.setItem(key, JSON.stringify(Object.assign({}, cur, patch)));
      } catch {
        /* 무시 */
      }
    },
    { key: site === "s" ? "aibn:s1:prefs" : "aibn:t1:prefs", patch },
  );
}

/* ─────────── 학생 ─────────── */
async function studentShots(browser, base) {
  const ctx = await newContext(browser, "s", { width: 375, height: 812 });
  const page = await ctx.newPage();
  const collect = watch(page, base);
  const go = (name, hash, o) => visit(page, collect, base, "s", name, hash, o);

  if (SMOKE) {
    await go("home", "/");
    await go("lesson", "/l/u1_1_1");
    await go("card", "/l/u2_1_3/s/c1/1");
    await go("quiz", "/l/u1_1_1/q");
    await go("me", "/me");
    // 학생 첫 화면에 교사 화면이 없는지(주소로 들어가도 교사 화면이 아니어야 해요)
    await go("no-teacher-route", "/board/u1_1_1");
    const t = await page.evaluate(() => document.body.innerText);
    if (/정답 일괄|문제 고르기|수업 진행|교사 준비/.test(t)) problems.push("[s] 학생 사이트에 교사 화면 문구가 보여요");
    await ctx.close();
    return;
  }

  await go("01-home", "/");
  await go("02-unit1", "/u/1");
  await go("03-unit4", "/u/4");
  await go("04-lesson", "/l/u1_1_2");
  await go("05-story", "/l/u1_1_1/s/story/1");
  await go("06-prereq", "/l/u1_1_2/s/prereq/1");
  await go("07-concept", "/l/u1_1_2/s/c1/1");
  await go("08-concept-code", "/l/u2_1_3/s/c2/2");
  await go("09-concept-table", "/l/u4_1_2/s/c2/1");
  // 코드 블록이 나오는 카드(u2_1_3 소제목 3)와 그림 카드를 찍어요
  await go("10-code", "/l/u2_1_3/s/c3/1");
  await go("10b-image", "/l/u1_1_1/s/c1/2");
  await go("11-wrap", "/l/u1_1_1/s/wrap/1");
  await go("12-quiz", "/l/u1_1_1/q");
  await go("13-quiz-more", "/l/u1_1_1/q/more");
  await go("14-note", "/note");
  await go("15-review", "/review");
  await go("16-dict", "/dict");
  await go("17-me", "/me", { full: true });
  await go("18-privacy", "/privacy");
  await go("19-answer-card", "/card");
  await go("20-qr-entry", "/l/u1_1_1?hw=q6,q11&ex=q3,q5");
  // 어두운 화면·큰 글자
  await setPrefs(page, "s", { theme: "dark" });
  await go("21-home-dark", "/", { reload: true });
  await setPrefs(page, "s", { theme: "light", fs: 3 });
  await go("22-concept-fs3", "/l/u2_1_3/s/c1/2", { reload: true });
  await setPrefs(page, "s", { fs: 1 });
  // '교사용' 링크가 교사 주소로 가는지
  await page.goto(base + "/#/me", { waitUntil: "load" });
  await settle(page);
  const tlink = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") || "").filter((h) => /aibasict/.test(h)));
  if (!tlink.length) problems.push("[s] 내 기록(#/me)에 교사 주소(aibasict) 링크가 없어요");
  collect();
  await ctx.close();
}

/* ─────────── 교사 ─────────── */
async function teacherShots(browser, base) {
  const ctx = await newContext(browser, "t", { width: 1920, height: 1080 });
  const page = await ctx.newPage();
  const collect = watch(page, base);
  const go = (name, hash, o) => visit(page, collect, base, "t", name, hash, o);

  if (SMOKE) {
    await go("today", "/");
    await go("board", "/board/u1_1_1?p=1&s=0");
    await go("board-end", "/board/u1_1_1/end");
    const qr = await page.$("svg, canvas, img");
    if (!qr) problems.push("[t] 수업 끝 화면에 QR 그림이 없어요");
    const t = await page.evaluate(() => document.body.innerText + " " + Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")).join(" "));
    if (!/aibasics\.web\.app/.test(t)) problems.push("[t] 수업 끝 화면에 학생 주소(aibasics.web.app)가 없어요");
    await ctx.close();
    return;
  }

  await go("01-today", "/");
  await go("02-find", "/find");
  await go("03-flow", "/flow/u1_1_1?p=1");
  await go("04-pick", "/pick/u1_1_1?p=1");
  await go("05-prep", "/prep/u1_1_1");
  await go("06-print", "/print/u1_1_1", { full: true });
  await go("07-progress", "/progress");
  await go("08-results", "/results");
  await go("09-board-question", "/board/u1_1_1?p=1&s=0");
  await go("10-board-s1", "/board/u1_1_1?p=1&s=1");
  await go("11-board-s2", "/board/u1_1_1?p=1&s=2");
  await go("12-board-code", "/board/u2_1_3?p=1&s=3");
  await go("13-board-q", "/board/u1_1_1/q/u1_1_1-q5");
  // 한 문제 크게: '다음'을 끝까지 눌러 풀이까지
  await go("14-board-q-solution", "/board/u1_1_1/q/u1_1_1-q5", {
    after: async (p) => {
      for (let i = 0; i < 6; i++) {
        const b = await p.$(".bd-next");
        if (!b) break;
        await b.click();
        await p.waitForTimeout(80);
      }
    },
  });
  await go("17-board-end", "/board/u1_1_1/end");
  const t = await page.evaluate(() => document.body.innerText + " " + Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href")).join(" "));
  if (!/aibasics\.web\.app/.test(t)) problems.push("[t] 수업 끝 화면에 학생 주소(aibasics.web.app)가 없어요");
  await setPrefs(page, "t", { theme: "chalk" });
  await go("18-board-chalk", "/board/u1_1_1?p=1&s=2", { reload: true });
  await setPrefs(page, "t", { theme: "dark" });
  await go("19-today-dark", "/", { reload: true });
  await setPrefs(page, "t", { theme: "light" });
  await go("20-privacy", "/privacy", { reload: true });
  await ctx.close();
}

/* ─────────── 모든 칠판 장면 높이 ─────────── */
async function allScenes(browser, base) {
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "plan.json"), "utf8"));
  const { buildContentIndex } = await import("../tools/content-index.mjs");
  const order = buildContentIndex().index.order.filter((id) => !LESSON_FILTER || LESSON_FILTER.indexOf(id) >= 0);
  const ctx = await newContext(browser, "t", { width: 1920, height: 1080 });
  const page = await ctx.newPage();
  const collect = watch(page, base);
  let steps = 0;
  let scenesSeen = 0;
  const summary = [];
  for (const lid of order) {
    const periods = ((plan.lessons[lid] || {}).periods || [{ p: 1 }]).map((x) => x.p);
    for (const p of periods) {
      const hash = `/board/${lid}?p=${p}&s=0`;
      await page.goto(base + "/#" + hash, { waitUntil: "load" });
      const stuck = await settle(page);
      if (stuck) problems.push(`[t] 장면 ${lid} p${p}: ${stuck}`);
      // 첫 켜진 장면으로 가요(Home)
      await page.keyboard.press("Home").catch(() => {});
      await page.waitForTimeout(60);
      const res = await page.evaluate(async () => {
        const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const out = { steps: 0, scenes: {}, bad: [], paged: 0, down: 0 };
        let guard = 0;
        let lastSig = "";
        let same = 0;
        while (guard++ < 600) {
          await raf();
          await wait(30);
          await raf();
          const body = document.getElementById("bd-body");
          const scene = document.querySelector(".bd-scene");
          const inner = document.querySelector(".bd-scene-inner");
          const title = (document.querySelector(".bd-head-title") || {}).textContent || "";
          const count = (document.querySelector(".bd-head-count") || {}).textContent || "";
          const nextBtn = document.querySelector(".bd-next");
          const label = nextBtn ? nextBtn.getAttribute("aria-label") || "" : "";
          if (!body || !scene || !inner) {
            out.bad.push({ count, title, why: "장면 본문(#bd-body/.bd-scene)이 없어요" });
            break;
          }
          out.steps++;
          out.scenes[count] = 1;
          const cls = scene.className;
          const paged = /\bis-paged\b/.test(cls);
          if (paged) out.paged++;
          if (/\bis-down\b/.test(cls)) out.down++;
          const H = inner.scrollHeight;
          if (!paged && H > 898) out.bad.push({ count, title, why: "본문 높이 " + H + "px > 896", label });
          if (paged) {
            const k = inner.getBoundingClientRect().height / (inner.offsetHeight || 1) || 1;
            const nodes = inner.querySelectorAll("[data-rv]");
            for (let i = 0; i < nodes.length; i++) {
              const h = nodes[i].getBoundingClientRect().height / k;
              if (h > 898) out.bad.push({ count, title, why: "한 조각 높이 " + Math.round(h) + "px > 896(쪽 나눔으로도 못 넣어요)", label });
            }
          }
          if (body.scrollWidth > body.clientWidth + 2) out.bad.push({ count, title, why: "가로 넘침 " + body.scrollWidth + "px", label });
          // 본문 글자 28px 이상(무대 1920 기준, scale 을 되돌려 재요). 수식 속·그림 속·번호표·작은 꼬리표는 빼요
          {
            const k2 = inner.getBoundingClientRect().width / (inner.offsetWidth || 1) || 1;
            const els = inner.querySelectorAll("p, li, h2, h3, td, th, .bd-q-prompt, .bd-opt, .bd-line");
            let minFs = 999;
            let minTxt = "";
            for (let i = 0; i < els.length; i++) {
              const el = els[i];
              if (el.closest("svg, .wg-host, .bd-qr, [aria-hidden='true'], .bd-cue, .bd-eyebrow, .bdq-sum, .bdq-tally, .bd-end-note, .bd-end-more, .bd-end-period, .bd-end-site, small, .chip, .bd-tag")) continue;
              const r = el.getBoundingClientRect();
              if (!r.width || !r.height) continue;
              let direct = "";
              for (let c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) direct += c.textContent;
              if (direct.trim().length < 2) continue;
              const fs = parseFloat(getComputedStyle(el).fontSize) * (k2 > 0 ? 1 : 1);
              if (fs < minFs) {
                minFs = fs;
                minTxt = direct.trim().slice(0, 20);
              }
            }
            if (minFs < 28) out.bad.push({ count, title, why: "본문 글자 " + Math.round(minFs) + "px < 28 ('" + minTxt + "')", label });
          }
          if (/마지막 장면/.test(label) || !nextBtn) break;
          const sig = count + "|" + label + "|" + (document.querySelector(".bd-next-txt") || {}).textContent;
          same = sig === lastSig ? same + 1 : 0;
          lastSig = sig;
          if (same > 3) {
            out.bad.push({ count, title, why: "'다음'을 눌러도 넘어가지 않아요", label });
            break;
          }
          nextBtn.click();
        }
        return out;
      });
      steps += res.steps;
      const n = Object.keys(res.scenes).length;
      scenesSeen += n;
      summary.push(`${lid} p${p}: 장면 ${n}, 단계 ${res.steps}, 쪽 나눔 ${res.paged}, 글자 줄임 ${res.down}`);
      const seenBad = {};
      for (const b of res.bad) {
        const key = b.count + "|" + b.why;
        if (seenBad[key]) continue;
        seenBad[key] = 1;
        problems.push(`[t] 장면 ${lid} p${p} ${b.count} '${b.title.trim().slice(0, 30)}': ${b.why}`);
      }
      for (const p2 of collect()) problems.push(`[t] 장면 ${lid} p${p}: ${p2}`);
    }
  }
  await ctx.close();
  console.log(`all-scenes: 레슨 ${order.length}개, 장면 ${scenesSeen}개, 공개 단계 ${steps}번을 재었어요`);
  if (has("--verbose")) for (const s of summary) console.log("  · " + s);
}

/* ─────────── 통합 점검 사진(--qa) ─────────── */
// 시험·통합 점검에서 보던 사진을 같은 이름으로 다시 찍어요. 장면 위치는 칠판을 차례로 열어 종류(kind-*)로 찾아요.
const QA_BOARD = "qa-board-1920-";
const QA_PHONE = "qa-phone-375-";

/** 칠판 '다음'을 눌러요. pred(라벨)가 참인 동안만(최대 n번) */
async function pressNext(page, n, pred) {
  for (let i = 0; i < n; i++) {
    const b = await page.$(".bd-next");
    if (!b) break;
    const label = (await b.getAttribute("aria-label")) || "";
    if (pred && !pred(label)) break;
    await b.click();
    await page.waitForTimeout(120);
  }
}

/** 칠판 한 차시의 장면을 차례로 열어 종류별 첫 위치를 찾아요(math: 코드 블록이 있는 개념 장면) */
async function findScenes(page, base, lid, want, max = 60) {
  const found = {};
  for (let s = 0; s < max; s++) {
    await page.goto(base + `/#/board/${lid}?p=1&s=${s}`, { waitUntil: "load" });
    await settle(page, 6000);
    const info = await page.evaluate(() => {
      const sc = document.querySelector(".bd-scene");
      return sc ? { cls: sc.className, math: !!sc.querySelector(".ui-code"), count: (document.querySelector(".bd-head-count") || {}).textContent || "" } : null;
    });
    if (!info) continue;
    const k = (info.cls.match(/kind-(\w+)/) || [])[1];
    if (k && want.indexOf(k) >= 0 && found[k] === undefined) found[k] = s;
    if (k === "concept" && info.math && want.indexOf("math") >= 0 && found.math === undefined) found.math = s;
    if (want.every((w) => found[w] !== undefined)) break;
  }
  return found;
}

// 보기마다 손든 수를 올린 뒤 정답을 열어요(08b 1920·1366 공용)
async function voteAndReveal(p) {
  const plus = await p.$$(".bdq-tally-step.is-plus");
  for (let i = 0; i < plus.length; i++) for (let k = 0; k < (i === 0 ? 7 : 3); k++) await plus[i].click().catch(() => {});
  await pressNext(p, 6);
}

async function qaShots(browser, sBase, tBase) {
  if (tBase) {
    const ctx = await newContext(browser, "t", { width: 1920, height: 1080 });
    const page = await ctx.newPage();
    const collect = watch(page, tBase);
    const go = (file, hash, o = {}) => visit(page, collect, tBase, "t", "qa " + file, hash, Object.assign({ file: QA_BOARD + file }, o));
    const miss = (what) => problems.push(`[t] qa: ${what} 장면을 찾지 못했어요`);

    const at = await findScenes(page, tBase, "u1_1_1", ["question", "story", "concept", "problem", "summary"]);
    collect();
    const b = (s) => `/board/u1_1_1?p=1&s=${s}`;
    await go("01-교사첫화면-오늘수업", "/");
    await go("02-차시시작-핵심질문", b(at.question !== undefined ? at.question : 0));
    if (at.story !== undefined) {
      await go("03-이야기", b(at.story));
      await go("03b-이야기-공개진행", b(at.story), { after: (p) => pressNext(p, 3) });
    } else miss("이야기");
    if (at.concept !== undefined) await go("04-개념설명", b(at.concept));
    else miss("개념");
    for (const [lid, name] of [
      ["u2_1_3", "05-코드-u2_1_3"],
      ["u4_3", "05b-코드-u4_3"],
    ]) {
      const m = await findScenes(page, tBase, lid, ["math"], 40);
      collect();
      if (m.math !== undefined) await go(name, `/board/${lid}?p=1&s=${m.math}`, { after: (p) => pressNext(p, 12, (l) => /공개/.test(l)) });
      else miss(lid + " 코드");
    }
    if (at.problem !== undefined) await go("07-문제", b(at.problem));
    else miss("칠판 문제");
    await go("07b-한문제-보기가림", "/board/u1_1_1/q/u1_1_1-q5");
    // 득표가 없을 때: 정답을 열어도 '정답률' 한 줄이 없어야 해요
    await go("08-정답공개-풀이", "/board/u1_1_1/q/u1_1_1-q5", { after: (p) => pressNext(p, 6) });
    if (await page.$(".bdq-rate")) problems.push("[t] qa: 득표가 없는데 정답 공개에 '정답률' 줄이 떠요(.bdq-rate)");
    // 득표가 있을 때: 보기마다 손든 수를 올린 뒤 정답을 열면 '정답률 N% · 다음 행동' 한 줄이 떠요
    await go("08b-정답공개-득표있음", "/board/u1_1_1/q/u1_1_1-q5", { after: voteAndReveal });
    {
      const rate = await page.$(".bdq-rate");
      const txt = rate ? ((await rate.textContent()) || "").trim() : "";
      if (!rate) problems.push("[t] qa: 득표가 있는데 정답 공개에 '정답률' 줄(.bdq-rate)이 없어요");
      else if (!/정답률\s*\d+\s*%/.test(txt)) problems.push("[t] qa: 정답률 줄 문구가 '정답률 N%' 로 시작하지 않아요 → " + txt.slice(0, 60));
    }
    if (at.summary !== undefined) {
      await go("09-마무리-오늘정리", b(at.summary));
      await go("09b-마무리-오늘정리-모두공개", b(at.summary), { after: (p) => pressNext(p, 12, (l) => /공개/.test(l)) });
    } else miss("정리");
    await go("10-마무리-수업끝QR", "/board/u1_1_1/end");
    await go("11-교사준비화면", "/prep/u1_1_1");
    await go("12-수업흐름", "/flow/u1_1_1?p=1");
    await ctx.close();
    // 작은 칠판(1366×768): 화면이 깨지지 않는지(가로 넘침은 visit 이 검사해요)
    {
      const ctx2 = await newContext(browser, "t", { width: 1366, height: 768 });
      const p2 = await ctx2.newPage();
      const c2 = watch(p2, tBase);
      const g2 = (file, hash, o = {}) => visit(p2, c2, tBase, "t", "qa " + file, hash, Object.assign({ file: "qa-board-1366-" + file }, o));
      await g2("01-오늘수업", "/");
      await g2("02-한문제-보기가림", "/board/u1_1_1/q/u1_1_1-q5");
      await g2("03-정답공개-풀이", "/board/u1_1_1/q/u1_1_1-q5", { after: (p) => pressNext(p, 6) });
      await g2("04-수업끝QR", "/board/u1_1_1/end");
      await g2("05-정답공개-득표있음", "/board/u1_1_1/q/u1_1_1-q5", { after: voteAndReveal });
      c2();
      await ctx2.close();
    }
    const ctx3 = await newContext(browser, "t", { width: 1920, height: 1080 });
    const page3 = await ctx3.newPage();
    // 첫 화면 '수업 시작' 단추 검사는 1920 에서
    {
      const page = page3;
      const collect = watch(page, tBase);
      await page.goto(tBase + "/#/", { waitUntil: "load" });
      await settle(page);
      const st = await page.evaluate(() => {
        const a = document.querySelector(".t-start");
        if (!a) return null;
        const r = a.getBoundingClientRect();
        return { bottom: Math.round(r.bottom), h: window.innerHeight };
      });
      if (!st) problems.push("[t] qa: 오늘 수업에 '수업 시작' 단추(.t-start)가 없어요");
      else if (st.bottom > st.h) problems.push(`[t] qa: 오늘 수업의 '수업 시작' 단추가 첫 화면 밖이에요(아래 끝 ${st.bottom}px > ${st.h}px)`);
      collect();
    }
    await ctx3.close();
  }
  await qaPhone(browser, sBase);
}

async function qaPhone(browser, sBase) {
  if (sBase) {
    const ctx = await newContext(browser, "s", { width: 375, height: 812 });
    const page = await ctx.newPage();
    const collect = watch(page, sBase);
    const go = (file, hash, o = {}) => visit(page, collect, sBase, "s", "qa " + file, hash, Object.assign({ file: QA_PHONE + file }, o));
    // 문제에 답하기: 적는 칸이 있으면 값을 적고, 보기면 i번째 보기를 골라 '확인'
    const answer = (val, optIdx) => async (p) => {
      const input = await p.$("main input[type='text'], main input:not([type]), main input[inputmode]");
      if (input) await input.fill(val);
      else {
        const opts = await p.$$(".opt");
        if (opts[optIdx]) await opts[optIdx].click();
      }
      await p.waitForTimeout(100);
      const ok = p.getByRole("button", { name: "확인" }).first();
      if (await ok.count()) await ok.click().catch(() => {});
      await p.waitForTimeout(300);
    };
    await go("01-첫화면-홈", "/");
    await go("02-레슨진행-개요", "/l/u1_1_2");
    await go("03-레슨진행-이야기카드", "/l/u1_1_1/s/story/1");
    await go("04-개념카드", "/l/u1_1_2/s/c1/1");
    await go("05-개념카드-코드", "/l/u2_1_3/s/c3/1");
    await go("06-문제", "/l/u1_1_1/q");
    await go("07-문제-오답피드백", "/l/u1_1_1/q", { after: answer("5", 0) });
    // 오답 직후, 스크롤을 끝까지 내린 사진: '풀이 확인하기'·'이 개념 다시 보기' 단추가 하단바에 가리지 않고 보여야 해요
    await go("07a-문제-오답직후-끝까지", "/l/u1_1_1/q", {
      after: async (p) => {
        await answer("5", 0)(p);
        await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await p.waitForTimeout(400);
        const hid = await p.evaluate(() => {
          const bar = document.querySelector(".s-actionbar, .s-tabbar");
          const top = bar ? bar.getBoundingClientRect().top : window.innerHeight;
          const btns = Array.from(document.querySelectorAll(".ui-q-peek, .ui-q-concept"));
          if (!btns.length) return "단추 없음";
          const bad = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > top + 1 || r.top < 0; });
          return bad.length ? "가려짐 " + bad.length + "개" : "";
        });
        if (hid) problems.push("[s] qa: 오답 직후 단추 — " + hid);
      },
    });
    await go("07b-문제-정답피드백", "/l/u1_1_1/q", { after: answer("10", 1) });
    await go("08-오답노트", "/note");
    await go("09-오늘의복습", "/review");
    await ctx.close();
  }
}

/* ─────────── 실행 ─────────── */
/** vite preview 서버를 모두 닫아요(남은 연결도 끊어서 프로세스가 남지 않게 해요) */
async function closeServers(servers) {
  for (const s of servers.splice(0)) {
    const h = s.httpServer;
    if (!h) continue;
    await new Promise((r) => {
      const t = setTimeout(() => r(null), 2000);
      h.close(() => {
        clearTimeout(t);
        r(null);
      });
      if (h.closeAllConnections) h.closeAllConnections();
    });
  }
}

async function main() {
  const pw = loadPlaywright();
  if (!pw) {
    console.error("shots: playwright 를 찾지 못했어요(/opt/node-tools/node_modules/playwright 확인). 설치하지 않아요.");
    process.exit(1);
  }
  for (const d of [ONLY !== "t" ? "dist-s" : "", ONLY !== "s" ? "dist-t" : ""].filter(Boolean))
    if (!fs.existsSync(path.join(ROOT, d, "index.html"))) {
      console.error(`shots: ${d} 가 없어요. 먼저 npm run build 를 해요.`);
      process.exit(1);
    }
  if (SAVE) fs.mkdirSync(OUT, { recursive: true });
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-color-profile=srgb"] });
  const servers = [];
  const onSig = () => closeServers(servers).then(() => process.exit(130));
  process.on("SIGINT", onSig);
  process.on("SIGTERM", onSig);
  try {
    const wantS = ONLY !== "t" && !ALL_SCENES;
    const wantT = ONLY !== "s";
    if (QA) {
      let sb = "";
      let tb = "";
      if (wantS) {
        const s = await startPreview("student", 4301);
        servers.push(s.server);
        sb = s.base;
      }
      if (wantT) {
        const t = await startPreview("teacher", 4302);
        servers.push(t.server);
        tb = t.base;
      }
      await qaShots(browser, sb, tb);
    } else if (wantS) {
      const s = await startPreview("student", 4301);
      servers.push(s.server);
      await studentShots(browser, s.base);
    }
    if (wantT && !QA) {
      const t = await startPreview("teacher", 4302);
      servers.push(t.server);
      if (ALL_SCENES) await allScenes(browser, t.base);
      else await teacherShots(browser, t.base);
    }
  } finally {
    await browser.close().catch(() => {});
    await closeServers(servers);
  }
  if (SAVE && saved.length) {
    const s = saved.filter((f) => /student-/.test(f)).length;
    const t = saved.filter((f) => /teacher-/.test(f)).length;
    const q = saved.filter((f) => /qa-/.test(f)).length;
    console.log(`shots: 학생 ${s}장 · 교사 ${t}장${q ? " · 통합 점검 " + q + "장" : ""}을 ${path.relative(ROOT, OUT)}/에 저장했어요`);
  }
  if (problems.length) {
    for (const p of problems) console.error("  ✗ " + p);
    console.error(`shots: 문제 ${problems.length}건`);
    process.exit(1);
  }
  console.log(`shots: 통과 — 콘솔 오류·pageerror·외부 요청·가로 넘침 0건${ALL_SCENES ? ", 모든 장면이 896px 안" : ""}`);
}

main().catch((e) => {
  console.error("shots: " + (e && e.stack ? e.stack : e));
  process.exit(1);
});
