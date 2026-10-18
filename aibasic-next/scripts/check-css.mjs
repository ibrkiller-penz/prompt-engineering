#!/usr/bin/env node
// Chrome 80 CSS 검사. 규칙 블록(선택자 + 선언) 단위로 읽어서 Chrome 80 에 없는 CSS 를 찾아요.
//   금지: flex gap(grid 가 아닌 규칙의 gap/row-gap/column-gap), aspect-ratio, :has, :is, :where, :focus-visible,
//         inset 속성, dvh/svh/lvh 단위, @layer, @property, @container, oklch(), color-mix(), CSS 중첩
//   대신 쓸 것: > * + * margin, grid-gap, padding-top 비율 상자, html.kbd :focus
// 대상: src/**/*.css(원본)와 dist-s, dist-t 의 assets/*.css(빌드 결과).
// 사용: node scripts/check-css.mjs [--src-only] [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ONLY = process.argv.includes("--src-only");
const VERBOSE = process.argv.includes("--verbose");

/** 주석은 같은 길이의 공백으로 바꿔서(줄 번호 유지) 빼고, 문자열은 그대로 둬요 */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * CSS 를 블록 나무로 읽어요. 문자열 속 괄호는 건너뛰어요.
 * @returns {{head:string, decls:string, children:any[], line:number}[]}
 */
function parse(css) {
  let i = 0;
  const n = css.length;
  const lineAt = (pos) => css.slice(0, pos).split("\n").length;
  function block(end) {
    const out = [];
    let decls = "";
    let start = i;
    while (i < n) {
      const c = css[i];
      if (c === '"' || c === "'") {
        const q = c;
        i++;
        while (i < n && css[i] !== q) i += css[i] === "\\" ? 2 : 1;
        i++;
        continue;
      }
      if (c === "{") {
        const head = css.slice(start, i).trim();
        const line = lineAt(start + (css.slice(start, i).length - css.slice(start, i).trimStart().length));
        i++;
        const inner = block(true);
        out.push({ head, decls: inner.decls, children: inner.out, line });
        start = i;
        continue;
      }
      if (c === "}") {
        decls += css.slice(start, i);
        i++;
        if (end) return { out, decls };
        start = i;
        continue;
      }
      if (c === ";") {
        decls += css.slice(start, i + 1);
        start = i + 1;
      }
      i++;
    }
    decls += css.slice(start, i);
    return { out, decls };
  }
  return block(false).out;
}

/** 선언 문자열 → [속성, 값] 목록 */
function declsOf(text) {
  const out = [];
  for (const part of text.split(";")) {
    const k = part.indexOf(":");
    if (k < 0) continue;
    const prop = part.slice(0, k).trim().toLowerCase();
    if (!prop || /[\s{}]/.test(prop)) continue;
    out.push([prop, part.slice(k + 1).trim()]);
  }
  return out;
}

const SEL_BANNED = [
  [":has()", /:has\(/],
  [":is()", /:is\(/],
  [":where()", /:where\(/],
  [":focus-visible", /:focus-visible/],
  [":matches()", /:matches\(/],
];
const AT_BANNED = [
  ["@layer", /^@layer\b/],
  ["@property", /^@property\b/],
  ["@container", /^@container\b/],
  ["@scope", /^@scope\b/],
];
const VAL_BANNED = [
  ["dvh/svh/lvh 단위", /\b\d*\.?\d+(dvh|svh|lvh|dvw|svw|lvw)\b/],
  ["oklch()", /\boklch\(/],
  ["oklab()", /\boklab\(/],
  ["color-mix()", /\bcolor-mix\(/],
  ["lab()/lch()", /(^|[\s,(])(lab|lch)\(/],
];
const PROP_BANNED = [
  ["aspect-ratio", (p) => p === "aspect-ratio"],
  ["inset 속성", (p) => p === "inset" || p.indexOf("inset-") === 0],
  ["content-visibility", (p) => p === "content-visibility"],
  ["container", (p) => p === "container" || p === "container-type" || p === "container-name"],
  ["translate/rotate/scale 단독 속성", (p) => p === "translate" || p === "rotate" || p === "scale"],
];

const problems = [];

/** 한 파일 검사 */
function checkFile(file, label) {
  const css = stripComments(fs.readFileSync(file, "utf8"));
  const tree = parse(css);
  const report = (line, what, head) => problems.push(`${label}:${line}  ${what}  — ${String(head).replace(/\s+/g, " ").slice(0, 90)}`);

  function visit(nodes, inStyleRule) {
    for (const b of nodes) {
      const head = b.head;
      const isAt = head.charAt(0) === "@";
      if (isAt) {
        for (const [name, re] of AT_BANNED) if (re.test(head)) report(b.line, name, head);
        if (/^@supports/.test(head) && /selector\(/.test(head)) report(b.line, "@supports selector()", head);
        if (inStyleRule) report(b.line, "CSS 중첩(규칙 안의 @규칙)", head);
        // @font-face·@keyframes 의 선언은 속성 검사만
        const kf = /^@(-webkit-)?keyframes/.test(head);
        if (!kf) checkDecls(b, head, false);
        visit(b.children, kf ? false : inStyleRule);
        continue;
      }
      if (inStyleRule) report(b.line, "CSS 중첩", head);
      for (const [name, re] of SEL_BANNED) if (re.test(head)) report(b.line, name, head);
      if (/(^|[\s,])&/.test(head)) report(b.line, "CSS 중첩(&)", head);
      checkDecls(b, head, true);
      visit(b.children, true);
    }
  }

  function checkDecls(b, head, style) {
    const decls = declsOf(b.decls);
    let grid = false;
    let flex = false;
    for (const [p, v] of decls) {
      if (p === "display" && /grid/.test(v)) grid = true;
      if (p === "display" && /flex/.test(v)) flex = true;
    }
    for (const [p, v] of decls) {
      for (const [name, test] of PROP_BANNED) if (test(p)) report(b.line, name, head);
      for (const [name, re] of VAL_BANNED) if (re && re.test(v)) report(b.line, name + ` (${p})`, head);
      if (style && (p === "gap" || p === "row-gap" || p === "column-gap")) {
        // gap 은 grid 규칙 안에서만 써요. flex 와 함께 있거나 display 가 없는 규칙의 gap 은 flex gap 일 수 있어요
        if (flex || !grid) report(b.line, `flex gap 의심(${p}: ${v}) — grid 가 아니면 > * + * margin 으로`, head);
      }
    }
  }

  visit(tree, false);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith(".css")) out.push(f);
  }
  return out;
}

const srcFiles = walk(path.join(ROOT, "src"), []);
for (const f of srcFiles) checkFile(f, path.relative(ROOT, f));
let distCount = 0;
if (!SRC_ONLY) {
  for (const d of ["dist-s", "dist-t"]) {
    const assets = path.join(ROOT, d, "assets");
    if (!fs.existsSync(assets)) {
      problems.push(`${d}/assets 가 없어요(먼저 빌드해요)`);
      continue;
    }
    for (const f of fs.readdirSync(assets)) {
      if (!f.endsWith(".css")) continue;
      distCount++;
      checkFile(path.join(assets, f), `${d}/assets/${f}`);
    }
  }
}

// TSX 의 인라인 style 객체에서 자주 실수하는 것(aspectRatio, gap 을 flex 에, inset)
const tsx = [];
(function walkTs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walkTs(f);
    else if (/\.tsx?$/.test(e.name)) tsx.push(f);
  }
})(path.join(ROOT, "src"));
for (const f of tsx) {
  const lines = fs.readFileSync(f, "utf8").split("\n");
  lines.forEach((ln, i) => {
    if (/\baspectRatio\s*:/.test(ln)) problems.push(`${path.relative(ROOT, f)}:${i + 1}  인라인 style aspectRatio`);
    if (/[{,]\s*inset\s*:\s*["'\d]/.test(ln)) problems.push(`${path.relative(ROOT, f)}:${i + 1}  인라인 style inset`);
    if (/display\s*:\s*["']flex["'][^}]*\bgap\s*:/.test(ln) || /\bgap\s*:[^}]*display\s*:\s*["']flex/.test(ln))
      problems.push(`${path.relative(ROOT, f)}:${i + 1}  인라인 style flex gap`);
  });
}

if (problems.length) {
  for (const p of problems) console.error("  ✗ " + p);
  console.error(`check-css: 실패 ${problems.length}건`);
  process.exit(1);
}
console.log(`check-css: 통과 — 원본 CSS ${srcFiles.length}개, 빌드 CSS ${distCount}개, TS ${tsx.length}개에 Chrome 80 금지 CSS 가 없어요`);
if (VERBOSE) for (const f of srcFiles) console.log("  · " + path.relative(ROOT, f));
