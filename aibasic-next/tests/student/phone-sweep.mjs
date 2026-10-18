#!/usr/bin/env node
// 학생 사이트 휴대폰(375×812) 훑어보기 — node --test 대상이 아니에요(브라우저가 필요해서 따로 돌려요).
//   먼저 학생 빌드(npm run build:s)를 해 두어야 해요.
//   node tests/student/phone-sweep.mjs [--lessons=u1-1,u2-3] [--flow]
//
//  1) 20레슨: 레슨 개요 → 카드를 '다음'으로 끝까지 넘기며 카드마다 가로 넘침 검사
//             → 계단 문제·더 풀기에서 문제마다 힌트·풀이를 다 열고 가로 넘침 검사
//  2) --flow: 가짜 기록(tools/fixtures/student.json)으로 이어서 하기·완료 판정·복습·백업 왕복을 화면에서 확인
//  3) 오답 직후(항상): 문제를 일부러 틀려서 '풀이 확인하기'·'이 개념 다시 보기' 단추가 보이고 375 폭 안에 드는지 확인
//  콘솔 오류·pageerror·외부 요청도 문제로 셉니다. 문제가 하나라도 있으면 1로 끝나요.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTENT = path.resolve(ROOT, "..", "content", "aimath");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (n) => {
  const a = args.find((x) => x.indexOf("--" + n + "=") === 0);
  return a ? a.slice(n.length + 3) : "";
};
const FLOW = args.indexOf("--flow") >= 0;
const ONLY_FLOW = args.indexOf("--only-flow") >= 0;
const FILTER = opt("lessons") ? opt("lessons").split(",") : null;
const SHOTS = path.join(ROOT, "tools", "shots");

function loadPlaywright() {
  const tries = ["playwright", "/opt/node-tools/node_modules/playwright"];
  try {
    tries.push(path.join(execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), "playwright"));
  } catch {
    /* 없음 */
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

const units = JSON.parse(fs.readFileSync(path.join(CONTENT, "units.json"), "utf8"));
const lessons = [];
for (const u of units) for (const l of u.lessons) if (!FILTER || FILTER.indexOf(l.id) >= 0) lessons.push(l.id);

const problems = [];
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "fixtures", "student.json"), "utf8"));

async function overflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const w = d.clientWidth;
    if (d.scrollWidth <= w + 1) return null;
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
          culprit = all[i].tagName.toLowerCase() + "." + String(all[i].className || "").trim().split(/\s+/).join(".") + " right=" + Math.round(r.right);
          break;
        }
      }
    }
    return d.scrollWidth + ">" + w + " " + culprit;
  });
}

async function settle(page) {
  await page.waitForFunction(() => {
    const r = document.getElementById("root");
    return !!r && r.children.length > 0 && !document.querySelector(".is-loading, [aria-busy='true']");
  }, null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true)).catch(() => {});
  await page.waitForTimeout(60);
}

async function check(page, where) {
  const ov = await overflow(page);
  if (ov) problems.push(where + ": 가로 넘침 " + ov);
}

async function newCtx(browser, base, data) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: "ko-KR", timezoneId: "Asia/Seoul", hasTouch: true, reducedMotion: "reduce", acceptDownloads: true });
  await ctx.addInitScript(
    ({ data }) => {
      try {
        if (!sessionStorage.getItem("__sweep")) {
          for (const k of Object.keys(localStorage)) if (k.indexOf("aibn:") === 0) localStorage.removeItem(k);
          for (const k of Object.keys(data)) localStorage.setItem(k, JSON.stringify(data[k]));
          sessionStorage.setItem("__sweep", "1");
        }
      } catch {
        /* 무시 */
      }
    },
    { data },
  );
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push("콘솔 오류(" + page.url().replace(base, "") + "): " + m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => problems.push("pageerror(" + page.url().replace(base, "") + "): " + String(e && e.message).slice(0, 160)));
  page.on("request", (r) => {
    const u = r.url();
    if (u.indexOf(base) !== 0 && !/^(data|blob|about):/.test(u)) problems.push("외부 요청: " + u.slice(0, 120));
  });
  return { ctx, page };
}

/** 문제 카드 안의 힌트·풀이 단추를 모두 열어요 */
async function openAll(page) {
  for (let k = 0; k < 4; k++) {
    const btns = await page.$$("main button");
    let clicked = false;
    for (const b of btns) {
      const t = ((await b.textContent()) || "").trim();
      if (/^(힌트|풀이|해설)|힌트 ?\d|풀이 보기/.test(t) && (await b.isEnabled()) && (await b.isVisible())) {
        await b.click().catch(() => {});
        clicked = true;
        await page.waitForTimeout(40);
        break;
      }
    }
    if (!clicked) break;
  }
}

async function sweepLesson(page, base, lid) {
  await page.goto(base + "/#/l/" + lid, { waitUntil: "load" });
  await settle(page);
  await check(page, lid + " 개요");
  // 카드 넘기기: 개요의 '시작' 대신 첫 단계로 바로 가요
  const first = await page.evaluate(() => {
    const a = Array.prototype.slice.call(document.querySelectorAll("a[href*='/s/']"));
    return a.length ? a[0].getAttribute("href") : "";
  });
  await page.goto(base + "/" + (first || "#/l/" + lid + "/s/c1/1"), { waitUntil: "load" });
  await settle(page);
  let n = 0;
  let firstCardSeen = false;
  for (; n < 300; n++) {
    const h = await page.evaluate(() => location.hash);
    if (h.indexOf("/s/") < 0) break;
    if (!firstCardSeen) {
      firstCardSeen = true;
      await page.screenshot({ path: path.join(SHOTS, "sweep-" + lid + "-first.png") }).catch(() => {});
    }
    await check(page, lid + " 카드 " + h);
    const next = await page.$(".s-next:not([disabled])");
    if (!next) {
      problems.push(lid + " 카드 " + h + ": '다음' 단추가 없거나 꺼져 있어요");
      break;
    }
    await next.click();
    await settle(page);
  }
  if (n >= 300) problems.push(lid + ": 카드가 300장을 넘어요(끝나지 않음?)");
  let qn = 0;
  for (const sub of ["q", "q/more"]) {
    await page.goto(base + "/#/l/" + lid + "/" + sub, { waitUntil: "load" });
    await settle(page);
    for (let i = 0; i < 80; i++) {
      const h = await page.evaluate(() => location.hash);
      if (h.indexOf("/" + sub) < 0) break;
      await check(page, lid + " 문제 " + h);
      await openAll(page);
      await check(page, lid + " 문제(힌트·풀이 열림) " + h);
      if (i === 0 && sub === "q") await page.screenshot({ path: path.join(SHOTS, "sweep-" + lid + "-q1.png") }).catch(() => {});
      qn++;
      const next = await page.$(".s-next:not([disabled])");
      if (!next) break;
      const before = h;
      await next.click();
      await settle(page);
      if ((await page.evaluate(() => location.hash)) === before) break;
    }
  }
  return { cards: n, qs: qn };
}

/* ─────────── 흐름: 이어서 하기·완료·복습·백업 ─────────── */
async function flow(browser, base) {
  const { ctx, page } = await newCtx(browser, base, fixture.storage);
  const text = async () => page.evaluate(() => document.body.innerText);
  // 이어서 하기: 홈의 큰 카드가 기록된 마지막 위치로 가요
  await page.goto(base + "/#/", { waitUntil: "load" });
  await settle(page);
  await check(page, "홈");
  const cont = await page.evaluate(() => {
    const a = document.querySelector("main a[href*='#/l/']");
    return a ? a.getAttribute("href") : "";
  });
  if (!cont) problems.push("홈: '이어서 공부하기' 링크가 없어요");
  // 카드 하나를 지나간 뒤 홈의 이어서 하기가 그 위치를 가리키는지
  await page.goto(base + "/#/l/u2-1/s/c1/2", { waitUntil: "load" });
  await settle(page);
  await page.goto(base + "/#/", { waitUntil: "load" });
  await settle(page);
  const cont2 = await page.evaluate(() => {
    const a = document.querySelector("main a[href*='#/l/']");
    return a ? a.getAttribute("href") + " | " + (a.textContent || "").slice(0, 80) : "";
  });
  if (cont2.indexOf("u2-1") < 0) problems.push("이어서 하기: 마지막으로 본 u2-1 을 가리키지 않아요 → " + cont2);
  await page.screenshot({ path: path.join(SHOTS, "sweep-flow-home.png") });

  // 완료 판정: 기록에 완료 레슨이 있으면 단원 화면에 완료 표시
  await page.goto(base + "/#/u/1", { waitUntil: "load" });
  await settle(page);
  await check(page, "단원 1");
  const u1 = await text();
  if (!/완료/.test(u1)) problems.push("단원 1: '완료' 표시가 하나도 없어요(가짜 기록에 완료 레슨이 있는데)");
  await page.screenshot({ path: path.join(SHOTS, "sweep-flow-unit1.png"), fullPage: true });

  // 복습: 가짜 기록의 복습 예정 문제가 오늘의 복습에 나와요
  await page.goto(base + "/#/review", { waitUntil: "load" });
  await settle(page);
  await check(page, "오늘의 복습");
  const rv = await text();
  if (/복습할 문제가 없|오늘은 쉬어/.test(rv)) problems.push("오늘의 복습: 예정 문제가 있는데 비어 있어요");
  await page.screenshot({ path: path.join(SHOTS, "sweep-flow-review.png") });
  await page.goto(base + "/#/note", { waitUntil: "load" });
  await settle(page);
  await check(page, "오답노트");

  // 백업 왕복: 내 기록 → 파일로 저장 → 모두 지우고 → 불러오기 → 같은 기록
  await page.goto(base + "/#/me", { waitUntil: "load" });
  await settle(page);
  await check(page, "내 기록");
  const snap = () =>
    page.evaluate(() => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf("aibn:s1:") === 0 && k !== "aibn:s1:prefs" && k.indexOf(":ui") < 0) o[k] = localStorage.getItem(k);
      }
      return o;
    });
  const before = await snap();
  const saveBtn = page.locator("main button, main a").filter({ hasText: /기록 파일 저장|파일로 저장/ }).first();
  if (!(await saveBtn.count())) {
    problems.push("내 기록: 저장 단추를 찾지 못했어요");
  } else {
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }).catch(() => null), saveBtn.click()]);
    if (!dl) problems.push("내 기록: 저장을 눌러도 파일이 내려오지 않아요");
    else {
      const file = await dl.path();
      const name = dl.suggestedFilename();
      if (/[가-힣a-z]+@|이름/.test(name)) problems.push("백업 파일 이름에 개인 정보처럼 보이는 것이 있어요: " + name);
      await page.evaluate(() => {
        for (const k of Object.keys(localStorage)) if (k.indexOf("aibn:s1:") === 0) localStorage.removeItem(k);
      });
      await page.reload({ waitUntil: "load" });
      await settle(page);
      const input = await page.$("main input[type=file]");
      if (!input) problems.push("내 기록: 불러오기 파일 칸이 없어요");
      else {
        await input.setInputFiles(file);
        await page.waitForTimeout(300);
        // 확인 단계가 있으면 눌러요
        const ok = page.locator("button").filter({ hasText: /불러오기|덮어쓰기|합치기|확인/ });
        for (let i = 0; i < 2; i++) {
          const c = await ok.count();
          if (!c) break;
          const b = ok.last();
          if (await b.isVisible()) await b.click().catch(() => {});
          await page.waitForTimeout(200);
        }
        const after = await snap();
        const miss = Object.keys(before).filter((k) => {
          if (!(k in after)) return true;
          try {
            return JSON.stringify(JSON.parse(before[k])) !== JSON.stringify(JSON.parse(after[k]));
          } catch {
            return before[k] !== after[k];
          }
        });
        if (miss.length) problems.push("백업 왕복: 돌아오지 않거나 달라진 키 " + miss.join(", "));
      }
    }
  }
  await page.screenshot({ path: path.join(SHOTS, "sweep-flow-me.png"), fullPage: true });
  await ctx.close();
}

/* ─────────── 오답 직후 단추 ─────────── */
async function wrongAnswerCheck(page, base) {
  for (const lid of ["u1-1", "u2-3"]) {
    if (FILTER && FILTER.indexOf(lid) < 0 && lessons.indexOf(lid) < 0) continue;
    await page.goto(base + "/#/l/" + lid + "/q", { waitUntil: "load" });
    await settle(page);
    let bad = false;
    const tryCheck = async () => {
      const ok = page.getByRole("button", { name: "확인" }).first();
      if (await ok.count()) {
        await ok.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(150);
      }
      return (await page.$(".ui-fb.is-bad")) !== null;
    };
    // 서술형·자기 점검 같은 문제는 건너뛰고, 틀릴 수 있는 문제가 나올 때까지 최대 12문제를 넘겨 봐요
    for (let qi = 0; qi < 12 && !bad; qi++) {
      const input = await page.$("main input[type='text'], main input:not([type]):not([type=checkbox]), main input[inputmode]");
      if (input) {
        await input.fill("987654").catch(() => {});
        bad = await tryCheck();
      } else {
        const n = (await page.$$(".opt")).length;
        for (let i = 0; i < n && !bad; i++) {
          const opts = await page.$$(".opt");
          if (!opts[i]) break;
          await opts[i].click().catch(() => {});
          bad = await tryCheck();
        }
      }
      if (bad) break;
      const before = await page.evaluate(() => location.hash);
      const next = await page.$(".s-next:not([disabled])");
      if (!next) break;
      await next.click().catch(() => {});
      await settle(page);
      if ((await page.evaluate(() => location.hash)) === before) break;
    }
    if (!bad) {
      problems.push(lid + " 오답 확인: 일부러 틀렸는데 '아쉬워요' 안내(.ui-fb.is-bad)가 안 떠요");
      continue;
    }
    await check(page, lid + " 오답 직후");
    for (const [cls, name] of [[".ui-q-peek", "풀이 확인하기"], [".ui-q-concept", "이 개념 다시 보기"]]) {
      const b = await page.$(cls);
      if (!b || !(await b.isVisible())) {
        problems.push(lid + " 오답 직후: '" + name + "' 단추가 안 보여요(" + cls + ")");
        continue;
      }
      const box = await b.boundingBox();
      if (!box || box.x < 0 || box.x + box.width > 376) problems.push(lid + " 오답 직후: '" + name + "' 단추가 375 폭 밖이에요");
      const t = ((await b.textContent()) || "").trim();
      if (t.indexOf(name) < 0) problems.push(lid + " 오답 직후: 단추 글자가 '" + name + "' 이 아니에요 → " + t);
    }
    await page.screenshot({ path: path.join(SHOTS, "sweep-" + lid + "-wrong.png") }).catch(() => {});
    // 정답 처리 전: 카드 안에 '다음 문제' 단추가 없어야 해요(하단바 것만)
    if (await page.$(".s-q-after")) problems.push(lid + " 오답 직후: 카드 안 '다음 문제'(.s-q-after)가 남아 있어요");
    // '이 개념 다시 보기' 다녀와도 고른 답·적은 글이 남아야 해요
    const cbtn = await page.$(".ui-q-concept");
    if (cbtn) {
      await cbtn.click().catch(() => {});
      await settle(page);
      await page.goBack().catch(() => {});
      await settle(page);
      const kept = await page.evaluate(() => {
        if (document.querySelector(".opt.is-picked")) return true;
        const i = document.querySelector("main input[type='text'], main input[inputmode]");
        return !!(i && i.value);
      });
      if (!kept) problems.push(lid + " 개념 다녀온 뒤: 고른 답·적은 글이 사라졌어요");
      if (await page.$(".ui-q.is-solved")) problems.push(lid + " 개념 다녀온 뒤: 돌아온 문제가 정답 처리돼 있어요");
      await page.screenshot({ path: path.join(SHOTS, "sweep-" + lid + "-back.png") }).catch(() => {});
    }
  }
}

/* ─────────── 단원 1~5 삽화(머리가 잘리지 않게 위쪽 기준) ─────────── */
async function unitArtCheck(page, base) {
  for (let n = 1; n <= 5; n++) {
    await page.goto(base + "/#/u/" + n, { waitUntil: "load" });
    await settle(page);
    await page.waitForSelector("img.s-unit-art", { timeout: 4000 }).catch(() => {});
    await page.evaluate(() => (document.querySelector("img.s-unit-art") && !document.querySelector("img.s-unit-art").complete ? new Promise((r) => { const i = document.querySelector("img.s-unit-art"); i.onload = i.onerror = r; setTimeout(r, 3000); }) : 0));
    await check(page, "단원 " + n);
    const art = await page.evaluate(() => {
      const im = document.querySelector("img.s-unit-art");
      if (!im) return null;
      const r = im.getBoundingClientRect();
      return { pos: getComputedStyle(im).objectPosition, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    });
    // 단원 2~5 는 지금 콘텐츠에 삽화가 없어요(단원 1 만 있음). 없으면 화면만 찍고 넘어가요
    if (!art) console.log("단원 " + n + ": 삽화 없음(콘텐츠에 이미지 없음) — 화면만 촬영");
    else {
      if (!/ 0%$|top/.test(art.pos) && art.pos.split(" ")[1] !== "0%") problems.push("단원 " + n + ": 삽화 object-position 이 위쪽 기준이 아니에요 → " + art.pos);
      if (art.w > 376) problems.push("단원 " + n + ": 삽화가 375 폭 밖이에요");
    }
    await page.screenshot({ path: path.join(SHOTS, "sweep-unit" + n + ".png") }).catch(() => {});
  }
}

async function main() {
  const pw = loadPlaywright();
  if (!pw) {
    console.log("playwright 를 찾지 못해 건너뛰어요.");
    return;
  }
  if (!fs.existsSync(path.join(ROOT, "dist-s", "index.html"))) {
    console.error("dist-s 가 없어요. 먼저 npm run build:s 를 해 주세요.");
    process.exit(1);
  }
  fs.mkdirSync(SHOTS, { recursive: true });
  const { preview } = await import("vite");
  const server = await preview({ root: ROOT, configFile: path.join(ROOT, "vite.config.ts"), mode: "student", logLevel: "error", preview: { port: 4311, strictPort: true, host: "127.0.0.1", open: false } });
  const base = "http://127.0.0.1:4311";
  const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await pw.chromium.launch({ executablePath: exe });
  try {
    if (!ONLY_FLOW) {
      const { ctx, page } = await newCtx(browser, base, {});
      for (const lid of lessons) {
        const r = await sweepLesson(page, base, lid);
        console.log(`${lid}: 카드 ${r.cards}장 · 문제 화면 ${r.qs}개`);
      }
      await wrongAnswerCheck(page, base);
      await unitArtCheck(page, base);
      await ctx.close();
    }
    if (FLOW || ONLY_FLOW) await flow(browser, base);
  } finally {
    await browser.close();
    await new Promise((r) => server.httpServer.close(r));
  }
  if (problems.length) {
    console.log("\n문제 " + problems.length + "건");
    for (const p of problems) console.log(" ✗ " + p);
    process.exit(1);
  }
  console.log("\n문제 0건 ✓");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
