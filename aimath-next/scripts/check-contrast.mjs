#!/usr/bin/env node
// 토큰 색 대비 검사. src/styles/tokens.css(+ 있으면 visual.css)를 직접 읽어서
// 테마(light · dark · chalk · 대비 높이기) × 사이트 × 단원마다 변수를 풀고 WCAG 대비를 계산해요.
//   글자 4.5:1 이상, 그래픽(테두리·초점·장식 막대) 3:1 이상. 하나라도 모자라면 1로 끝나요.
// 글자 크기·터치 토큰 바닥값(휴대폰 13/44 · 준비 18/48, 터치 56 · 칠판 본문 32/64 · 주 단추 88 · 문제 36 · 보기 32 · 도구 28/24/72)을 면 × 글자 단계마다 계산하고,
// src 의 css 에 13px 미만 고정 글자가 있는지 봐요(공용 src/styles 는 실패, 나머지는 알림, --strict 면 모두 실패).
// 덤으로 src/styles/*.css 에 Chrome 80 에서 안 되는 CSS 가 있는지도 봐요(0건이어야 해요).
// 사용: node scripts/check-contrast.mjs [--verbose] [--strict]

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES = join(ROOT, "src", "styles");
const VERBOSE = process.argv.includes("--verbose");

/* ─────────── CSS 읽기 ─────────── */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** @media·@supports 같은 묶음 규칙은 통째로 빼고(테마는 html 속성으로만 정해요) 맨 위 규칙만 돌려줘요 */
function topLevelRules(css) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    // 짝 맞는 닫는 괄호 찾기
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (!head.startsWith("@")) rules.push({ head, body });
    i = j;
  }
  return rules;
}

function declarations(body) {
  const out = [];
  for (const part of body.split(";")) {
    const k = part.indexOf(":");
    if (k < 0) continue;
    const name = part.slice(0, k).trim();
    if (name.indexOf("--") === 0) out.push([name, part.slice(k + 1).trim()]);
  }
  return out;
}

/** 선택자 하나를 { attrs: {name:value}, spec, ok } 로. :root·html 과 html[...] 꼴만 다뤄요 */
function parseSelector(sel) {
  const s = sel.trim();
  if (s === ":root") return { attrs: {}, spec: [1, 0], ok: true };
  const m = /^html((?:\[[a-z-]+="[^"]*"\])*)$/.exec(s);
  if (!m) return { ok: false };
  const attrs = {};
  const re = /\[([a-z-]+)="([^"]*)"\]/g;
  let a;
  let n = 0;
  while ((a = re.exec(m[1]))) {
    attrs[a[1]] = a[2];
    n++;
  }
  return { attrs, spec: [n, 1], ok: true };
}

function loadDecls() {
  const files = ["tokens.css", "visual.css"].map((f) => join(STYLES, f)).filter((f) => existsSync(f));
  if (!files.length || !existsSync(join(STYLES, "tokens.css"))) {
    console.error("check-contrast: src/styles/tokens.css 가 없어요.");
    process.exit(1);
  }
  const list = [];
  let order = 0;
  for (const f of files) {
    for (const r of topLevelRules(stripComments(readFileSync(f, "utf8")))) {
      const decls = declarations(r.body);
      if (!decls.length) continue;
      for (const one of r.head.split(",")) {
        const p = parseSelector(one);
        if (!p.ok) continue;
        list.push({ attrs: p.attrs, spec: p.spec, order: order++, decls });
      }
    }
  }
  return list;
}

/** 상태(html 속성 묶음)에 맞는 규칙을 명시도·순서대로 쌓아서 변수 표를 만들어요 */
function varsFor(rules, state) {
  const hit = rules.filter((r) => Object.keys(r.attrs).every((k) => state[k] === r.attrs[k]));
  hit.sort((a, b) => a.spec[0] - b.spec[0] || a.spec[1] - b.spec[1] || a.order - b.order);
  const vars = {};
  for (const r of hit) for (const [k, v] of r.decls) vars[k] = v;
  return vars;
}

function resolve(vars, value, seen = new Set()) {
  let guard = 0;
  let v = value;
  while (v.indexOf("var(") >= 0 && guard++ < 20) {
    v = v.replace(/var\(\s*(--[a-z0-9-]+)\s*(?:,\s*([^()]*))?\)/i, (_, name, fb) => {
      if (seen.has(name)) throw new Error("변수 순환: " + name);
      if (vars[name] !== undefined) return resolve(vars, vars[name], new Set(seen).add(name));
      if (fb !== undefined) return fb.trim();
      throw new Error("정의되지 않은 변수: " + name);
    });
  }
  return v.trim();
}

/* ─────────── 색 계산 ─────────── */

function parseColor(str) {
  const s = str.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  if (s === "white") return { r: 255, g: 255, b: 255, a: 1 };
  if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
});

function lum(c) {
  const ch = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

function ratio(fg, bg) {
  const f = fg.a < 1 ? over(fg, bg) : fg;
  const a = lum(f);
  const b = lum(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/* ─────────── 검사할 쌍 ─────────── */

const TEXT = 4.5;
const GFX = 3;
const PAIRS = [
  // 본문 글자
  ...["--ink", "--ink-2", "--ink-3"].flatMap((f) => ["--bg", "--surface", "--surface-2"].map((b) => [f, b, TEXT])),
  ["--ink", "--accent-soft", TEXT],
  ["--ink-2", "--accent-soft", TEXT],
  // 상태 글자(이름표·정오 표시) — 바탕과 옅은 바탕 둘 다
  ...["ok", "bad", "warn", "info", "aha"].flatMap((k) => [
    [`--${k}`, `--${k}-bg`, TEXT],
    [`--${k}`, "--surface", TEXT],
    ["--ink", `--${k}-bg`, TEXT],
  ]),
  // 단원·사이트 포인트
  ["--accent-ink", "--surface", TEXT],
  ["--accent-ink", "--bg", TEXT],
  ["--accent-ink", "--accent-soft", TEXT],
  ["--on-accent", "--accent", TEXT],
  ["--on-site", "--site", TEXT],
  // 그래픽
  ["--accent", "--surface", GFX],
  ["--accent", "--bg", GFX],
  ["--site", "--surface", GFX],
  ["--line-strong", "--surface", GFX],
  ["--line-strong", "--bg", GFX],
  ["--focus", "--surface", GFX],
  ["--focus", "--bg", GFX],
  // 비활성 단추: 글자는 비활성 바탕·카드 바탕 위에서 4.5, 회색 테두리는 3 이상(opacity 로 흐리게 하지 않아요)
  ["--disabled-ink", "--disabled-bg", TEXT],
  ["--disabled-ink", "--surface", TEXT],
  ["--disabled-ink", "--bg", TEXT],
  ["--disabled-line", "--surface", GFX],
  ["--disabled-line", "--bg", GFX],
  ["--disabled-line", "--disabled-bg", GFX],
  // 단계 공개 자리표시: 점선 테두리(그래픽)와 흐린 단서 글자(첫 단어)
  ["--ph-line", "--surface", GFX],
  ["--ph-line", "--surface-2", GFX],
  ["--ph-line", "--bg", GFX],
  ["--hint-ink", "--surface", TEXT],
  ["--hint-ink", "--surface-2", TEXT],
  ["--hint-ink", "--bg", TEXT],
];
// visual.css 의 그래프 계열색(있을 때만)
const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--axis"];

const THEMES = [
  { name: "light", attrs: { "data-theme": "light" } },
  { name: "dark", attrs: { "data-theme": "dark" } },
  { name: "chalk", attrs: { "data-theme": "chalk" }, teacherOnly: true },
  { name: "more", attrs: { "data-theme": "light", "data-contrast": "more" } },
  { name: "dark+more", attrs: { "data-theme": "dark", "data-contrast": "more" } },
  { name: "chalk+more", attrs: { "data-theme": "chalk", "data-contrast": "more" }, teacherOnly: true },
];
const SITES = ["student", "teacher"];
const UNITS = [null, "u1", "u2", "u3", "u4", "u5"];

/* ─────────── 대비 실행 ─────────── */

const rules = loadDecls();
const fails = [];
let checked = 0;
const worst = {};

for (const th of THEMES) {
  for (const site of SITES) {
    if (th.teacherOnly && site !== "teacher") continue;
    for (const unit of UNITS) {
      const state = { "data-site": site, "data-surface": "phone", "data-fs": "1", ...th.attrs };
      if (unit) state["data-unit"] = unit;
      const vars = varsFor(rules, state);
      const where = `${th.name}/${site}/${unit || "-"}`;
      const pairs = PAIRS.slice();
      if (unit === null) for (const s of SERIES) if (vars[s] !== undefined) pairs.push([s, "--surface", s === "--axis" ? TEXT : GFX]);
      for (const [fgName, bgName, min] of pairs) {
        let fg;
        let bg;
        try {
          fg = parseColor(resolve(vars, `var(${fgName})`));
          bg = parseColor(resolve(vars, `var(${bgName})`));
        } catch (e) {
          fails.push(`${where}  ${fgName} / ${bgName}: ${e.message}`);
          continue;
        }
        if (!fg || !bg) {
          fails.push(`${where}  ${fgName} / ${bgName}: 색을 읽지 못했어요`);
          continue;
        }
        if (bg.a < 1) bg = over(bg, parseColor(resolve(vars, "var(--bg)")) || { r: 255, g: 255, b: 255, a: 1 });
        const r = ratio(fg, bg);
        checked++;
        const key = `${th.name} ${fgName}/${bgName}`;
        if (!worst[key] || worst[key].r > r) worst[key] = { r, where, min };
        if (r + 1e-9 < min) fails.push(`${where}  ${fgName} / ${bgName} = ${r.toFixed(2)} (기준 ${min})`);
      }
    }
  }
}

/* ─────────── 글자 크기·터치 대상 바닥값(토큰) ───────────
 * 면(phone · prep · board) × 글자 단계(data-fs 0..3)마다 토큰을 풀어 px 로 계산해요.
 *   휴대폰: 모든 글자 13px 이상, 본문 17 이상(기본 단계), 터치 44 이상
 *   준비 화면: 터치 56 이상, 칠판: 본문 32 이상(모든 단계), 터치 64 · 주 단추 88 이상 */

/** "max(13px, calc(13px * 0.9))" 같은 값을 숫자(px)로. px·단위 없는 수·+-*÷·calc/min/max/clamp 만 다뤄요 */
function evalPx(expr) {
  const e = expr.replace(/(\d*\.?\d+)px\b/g, "$1").trim();
  if (!/^[\d.+\-*/(),\s]*$/.test(e.replace(/\b(calc|min|max|clamp)\(/g, "("))) return NaN;
  try {
    // eslint-disable-next-line no-new-func
    return Function("calc", "min", "max", "clamp", `return (${e});`)(
      (x) => x,
      Math.min,
      Math.max,
      (lo, v, hi) => Math.max(lo, Math.min(v, hi)),
    );
  } catch {
    return NaN;
  }
}

// 준비 화면은 모든 글자 18 · 터치 48 이상, 칠판 문제 본문 36 · 보기 32 · 도구 글자 28 · 도구 라벨 24 · 도구 터치 72 이상
const SIZE_RULES = {
  phone: {
    "--t-xs": 13, "--t-sm": 13, "--t-md": 13, "--t-min": 13, "--t-q": 13, "--t-opt": 13, "--t-tool": 13, "--t-tool-label": 13,
    "--tap": 44, "--tap-main": 44, "--tap-tool": 44, "--tap-min": 44,
  },
  prep: {
    "--t-xs": 18, "--t-sm": 18, "--t-md": 18, "--t-min": 18, "--t-q": 18, "--t-opt": 18, "--t-tool": 18, "--t-tool-label": 18,
    "--tap": 56, "--tap-main": 56, "--tap-tool": 48, "--tap-min": 48,
  },
  board: {
    "--t-xs": 22, "--t-sm": 22, "--t-md": 32, "--t-min": 22, "--t-q": 36, "--t-opt": 32, "--t-tool": 28, "--t-tool-label": 24,
    "--tap": 64, "--tap-main": 88, "--tap-tool": 72, "--tap-min": 64,
  },
};
const BODY_AT_DEFAULT = { phone: 17, prep: 22, board: 32 };
const sizeFails = [];
let sizeChecked = 0;
for (const surface of Object.keys(SIZE_RULES)) {
  for (const fsStep of ["0", "1", "2", "3"]) {
    const vars = varsFor(rules, { "data-site": surface === "phone" ? "student" : "teacher", "data-surface": surface, "data-fs": fsStep, "data-theme": "light" });
    const need = Object.assign({}, SIZE_RULES[surface]);
    if (fsStep === "1") need["--t-md"] = Math.max(need["--t-md"], BODY_AT_DEFAULT[surface]);
    for (const name of Object.keys(need)) {
      let px;
      try {
        px = evalPx(resolve(vars, `var(${name})`));
      } catch (e) {
        sizeFails.push(`${surface}/fs${fsStep}  ${name}: ${e.message}`);
        continue;
      }
      sizeChecked++;
      if (!(px >= need[name] - 1e-6)) sizeFails.push(`${surface}/fs${fsStep}  ${name} = ${isNaN(px) ? "계산 못 함" : px.toFixed(1) + "px"} (기준 ${need[name]}px 이상)`);
    }
  }
}

/* 고정 px 로 13px 보다 작게 쓴 글자(인쇄용 css·@media print 는 빼요). src/styles 는 실패, 나머지 src 는 알림만(--strict 면 실패) */
const STRICT = process.argv.includes("--strict");
const tinyFails = [];
const tinyNotes = [];
function walkCss(dir, acc) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walkCss(p, acc);
    else if (ent.name.endsWith(".css")) acc.push(p);
  }
  return acc;
}
function withoutPrintMedia(css) {
  let out = "";
  let i = 0;
  const re = /@media[^{]*\bprint\b[^{]*\{/g;
  let m;
  while ((m = re.exec(css))) {
    out += css.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    i = j;
    re.lastIndex = j;
  }
  return out + css.slice(i);
}
const SRC = join(ROOT, "src");
if (existsSync(SRC)) {
  for (const f of walkCss(SRC, [])) {
    const rel = f.slice(ROOT.length + 1);
    if (/print[^/]*\.css$/.test(rel)) continue;
    const css = withoutPrintMedia(stripComments(readFileSync(f, "utf8")));
    const re = /font-size\s*:\s*([0-9.]+)px/g;
    let m;
    while ((m = re.exec(css))) {
      if (+m[1] >= 13) continue;
      const line = css.slice(0, m.index).split("\n").length;
      const msg = `${rel}:${line} font-size ${m[1]}px (13px 미만)`;
      if (rel.indexOf("src/styles/") === 0 || STRICT) tinyFails.push(msg);
      else tinyNotes.push(msg);
    }
  }
}

/* ─────────── 금지 CSS 검사(src/styles) ─────────── */

const BANNED = [
  [/(^|[;{\s])gap\s*:/m, "flex gap(gap:) — grid 는 grid-gap 을 써요"],
  [/(^|[;{\s])row-gap\s*:|(^|[;{\s])column-gap\s*:/m, "row-gap/column-gap"],
  [/aspect-ratio\s*:/, "aspect-ratio"],
  [/:has\(/, ":has()"],
  [/:is\(/, ":is()"],
  [/:where\(/, ":where()"],
  [/:focus-visible/, ":focus-visible"],
  [/(^|[;{\s])inset\s*:/m, "inset 속성"],
  [/\d(dvh|svh|lvh)\b/, "dvh/svh/lvh"],
  [/@layer\b/, "@layer"],
  [/@container\b/, "@container"],
  [/@property\b/, "@property"],
  [/\boklch\(|\boklab\(|\blch\(/, "oklch/oklab/lch"],
  [/color-mix\(/, "color-mix()"],
  [/(^|[{;\s])&/m, "CSS 중첩(&)"],
];
const cssFails = [];
if (existsSync(STYLES)) {
  for (const f of readdirSync(STYLES).filter((x) => x.endsWith(".css"))) {
    const css = stripComments(readFileSync(join(STYLES, f), "utf8"));
    for (const [re, label] of BANNED) if (re.test(css)) cssFails.push(`src/styles/${f}: ${label}`);
    // 중첩 규칙: 일반 규칙 몸통 안에 또 { 가 있는지
    for (const r of topLevelRules(css)) if (r.body.indexOf("{") >= 0) cssFails.push(`src/styles/${f}: 규칙 안에 규칙(중첩) — ${r.head.slice(0, 40)}`);
  }
}

/* ─────────── 결과 ─────────── */

if (VERBOSE) {
  for (const [k, v] of Object.entries(worst).sort()) console.log(`${v.r.toFixed(2).padStart(6)}  ${k}  (가장 낮은 곳 ${v.where}, 기준 ${v.min})`);
}
console.log(
  `check-contrast: 색 쌍 ${checked}개 검사, 대비 부족 ${fails.length}건, 크기 토큰 ${sizeChecked}개 중 기준 미달 ${sizeFails.length + tinyFails.length}건, 금지 CSS ${cssFails.length}건`,
);
for (const f of fails) console.log("  대비 부족  " + f);
for (const f of sizeFails) console.log("  크기 미달  " + f);
for (const f of tinyFails) console.log("  작은 글자  " + f);
for (const f of cssFails) console.log("  금지 CSS  " + f);
if (tinyNotes.length) {
  console.log(`  알림: 공용 밖 css 에 13px 미만 고정 글자 ${tinyNotes.length}곳(담당 파일에서 고쳐 주세요, --strict 면 실패)`);
  for (const f of tinyNotes) console.log("    " + f);
}
process.exit(fails.length || cssFails.length || sizeFails.length || tinyFails.length ? 1 : 0);
