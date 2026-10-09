// 링크 미리보기(카카오톡 등)용 공유 이미지 1200×630 을 꼭지마다 만든다 → public/og/*.png
// 사용: node scripts/make-og.mjs   (Playwright 의 Chromium 이 필요. 글꼴은 public/aibasic/fonts 의 S-Core Dream 사용 —
//        없으면 `node scripts/fetch-aibasic.mjs` 로 먼저 받는다.) 결과 PNG 는 저장소에 들어 있으므로 문구를 바꿀 때만 다시 만든다.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = path.resolve(".");
const font = (w, f) => `@font-face{font-family:SCD;font-weight:${w};src:url("file://${ROOT}/public/aibasic/fonts/${f}.woff") format("woff")}`;
const avatar = `file://${ROOT}/public/icon-512.png`;

const CARDS = {
  hub:     { c1: "#0076fb", c2: "#00a6ff", glyph: "✦", tag: "교육자료 모음", title: "살빠진 임선생과\n함께하는 교육자료", sub: "AI·수학·메이커 수업 자료를 한곳에" },
  aimath:  { c1: "#4f46e5", c2: "#818cf8", glyph: "∑", tag: "고등 · 단원별 학습", title: "인공지능 수학", sub: "이야기로 시작해서 개념·체험·계단 문제까지" },
  aibasic: { c1: "#0f766e", c2: "#2dd4bf", glyph: "AI", tag: "고등 · 인공지능 기초", title: "인공지능 기초", sub: "교과서를 이야기와 계단식 학습으로 쉽게" },
  prompt:  { c1: "#0369a1", c2: "#38bdf8", glyph: "“ ”", tag: "프롬프트 엔지니어링 · 초중고 13차시", title: "다시 묻는 AI 교실", sub: "부탁하고, 확인하고, 바로잡는 연습" },
  board:   { c1: "#15803d", c2: "#4ade80", glyph: "▦", tag: "ESP32 터치 화면 · 따라 하기", title: "시간표 단말 만들기", sub: "시계·날씨·급식·내 시간표가 뜨는 작은 화면" },
  slides:  { c1: "#c2410c", c2: "#fb923c", glyph: "▤", tag: "슬라이드·인포그래픽", title: "노트북LM\n슬라이드 프롬프트", sub: "디자인을 고르면 프롬프트가 채워져요" },
  mathplay:{ c1: "#0f766e", c2: "#34d399", glyph: "▞", tag: "마우스로 하는 수학 게임 30가지", title: "온라인 수학 체험", sub: "끌고 누르며 해 보는 수학체험관 게임" },
  setup:   { c1: "#6d28d9", c2: "#a78bfa", glyph: "⚙", tag: "먼저 해 두면 좋아요", title: "AI 맞춤 설정", sub: "ChatGPT·Claude·Gemini에 한 번 넣어 두는 설정" },
};

const html = (k) => {
  const d = CARDS[k]; const t = d.title.replace(/\n/g, "<br>");
  const lines = d.title.split("\n");
  const longest = Math.max(...lines.map((l) => l.length));
  const size = longest <= 8 ? 100 : longest <= 10 ? 82 : longest <= 12 ? 70 : 62; // 한 줄이 700px 안에 들어오게
  const subTop = Math.round(170 + lines.length * size * 1.2 + 26);
  return `<!doctype html><meta charset="utf-8"><style>
${font(400, "S-CoreDream-4Regular")}${font(500, "S-CoreDream-5Medium")}${font(700, "S-CoreDream-6Bold")}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;font-family:SCD,sans-serif;color:#fff;overflow:hidden;position:relative;
  background:linear-gradient(135deg,${d.c1} 0%,${d.c2} 100%)}
.bubble{position:absolute;border-radius:50%;background:rgba(255,255,255,.10)}
.glyph{position:absolute;right:70px;top:90px;width:360px;height:360px;border-radius:50%;background:rgba(255,255,255,.16);
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${d.glyph.length > 1 ? 150 : 210}px;line-height:1;text-shadow:0 6px 30px rgba(0,0,0,.15)}
.tag{position:absolute;left:80px;top:86px;font-size:30px;font-weight:500;background:rgba(255,255,255,.2);padding:10px 24px;border-radius:99px}
h1{position:absolute;left:80px;top:170px;width:700px;white-space:nowrap;font-size:${size}px;line-height:1.2;font-weight:700;letter-spacing:-.02em}
.sub{position:absolute;left:80px;top:${subTop}px;width:700px;font-size:34px;line-height:1.45;font-weight:400;opacity:.95}
.foot{position:absolute;left:80px;bottom:52px;display:flex;align-items:center;gap:20px;font-size:28px;font-weight:500}
.foot img{width:76px;height:76px;border-radius:50%;border:4px solid rgba(255,255,255,.9);background:#fff}
.foot small{display:block;font-size:22px;font-weight:400;opacity:.85;margin-top:2px}
</style>
<div class="bubble" style="width:520px;height:520px;right:-120px;bottom:-200px"></div>
<div class="bubble" style="width:240px;height:240px;left:620px;top:-90px"></div>
<div class="glyph">${d.glyph}</div>
<div class="tag">${d.tag}</div>
<h1>${t}</h1>
<p class="sub">${d.sub}</p>
<div class="foot"><img src="${avatar}"><div>살빠진 임선생<small>penedu.web.app</small></div></div>`;
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync("public/og", { recursive: true });
for (const k of Object.keys(CARDS)) {
  const tmp = path.join(ROOT, `public/og/_${k}.html`);
  fs.writeFileSync(tmp, html(k));
  await page.goto("file://" + tmp); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150);
  await page.screenshot({ path: `public/og/${k}.png` });
  fs.unlinkSync(tmp);
  console.log("만듦 public/og/" + k + ".png");
}
await browser.close();
