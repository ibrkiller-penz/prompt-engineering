#!/usr/bin/env node
// import 규칙 검사(원본 src/ 와 tests/ 를 읽어요).
//  1) src/student · src/shared · src/content · src/styles 는 src/teacher 를 가져오면 안 돼요(상대 경로·별칭 모두)
//  2) @site 별칭은 src/main.tsx 에서만(공용 코드가 @site 를 쓰면 교사 빌드에서 교사 코드를 가리켜요)
//  3) 저장소 뿌리 src(옛 사이트 코드)는 가져오지 않아요(@legacy 별칭은 없어요)
//  4) data/teacher/** 는 src/teacher 에서만
//  5) 순수 로직(src/shared/logic · src/teacher/logic · widgets/*/mission.ts · *.logic.ts)은 react·DOM 없이,
//     상대 import 에 .ts 를 붙이고 별칭을 쓰지 않아요(node --test 가 바로 돌아요)
//  6) 쓰지 않기로 한 패키지(react-router, tailwind 등)와 외부 주소 import 금지
// 사용: node scripts/check-imports.mjs [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_DIR } from "../tools/content-index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const DATA_TEACHER = path.join(ROOT, "data", "teacher");
const TEACHER = path.join(SRC, "teacher");
const VERBOSE = process.argv.includes("--verbose");

const ALIAS = {
  "@shared/": path.join(SRC, "shared") + "/",
  "@data/": path.join(ROOT, "data") + "/",
  "@content/": CONTENT_DIR + "/",
};
const BANNED_PKG = [/^react-router/, /^tailwindcss/, /^@tailwind/, /^@vitejs\/plugin-legacy/, /^qrcode/, /^(https?:)?\/\//];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.(tsx?|mjs|js|css)$/.test(e.name)) out.push(f);
  }
  return out;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/** 파일 안의 모든 가져오기 지정자 */
function specifiers(file, code) {
  const out = [];
  const add = (s, kind) => out.push({ s, kind });
  if (file.endsWith(".css")) {
    for (const m of code.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/g)) add(m[1], "css");
    return out;
  }
  const c = stripComments(code);
  for (const m of c.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[\w$*{}\s,]+?\s+from\s+)?["']([^"']+)["']/g)) add(m[1], "static");
  for (const m of c.matchAll(/\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) add(m[1], "dynamic");
  for (const m of c.matchAll(/import\.meta\.glob(?:<[^>]*>)?\(\s*(\[[^\]]*\]|["'`][^"'`]+["'`])/g)) {
    for (const g of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) add(g[1].replace(/^!/, ""), "glob");
  }
  return out;
}

/** 지정자 → 절대 경로(패키지면 null) */
function resolveSpec(file, s) {
  for (const [k, v] of Object.entries(ALIAS)) if (s.indexOf(k) === 0) return v + s.slice(k.length);
  if (s.indexOf("@site/") === 0) return "@site";
  if (s.charAt(0) === "." || s.charAt(0) === "/") return path.resolve(path.dirname(file), s);
  return null;
}

const inside = (p, dir) => p === dir || p.indexOf(dir + path.sep) === 0;
const rel = (f) => path.relative(ROOT, f);

const problems = [];
const files = walk(SRC, []);
const testFiles = walk(path.join(ROOT, "tests"), []);

function isPure(f) {
  return (
    inside(f, path.join(SRC, "shared", "logic")) ||
    inside(f, path.join(SRC, "teacher", "logic")) ||
    /[\\/]widgets[\\/][a-z0-9]+[\\/]mission\.ts$/.test(f) ||
    /\.logic\.ts$/.test(f)
  );
}

let count = 0;
for (const f of files) {
  const code = fs.readFileSync(f, "utf8");
  const isTeacher = inside(f, TEACHER);
  const isMain = f === path.join(SRC, "main.tsx");
  const pure = isPure(f);
  for (const { s, kind } of specifiers(f, code)) {
    count++;
    const where = `${rel(f)}: '${s}'`;
    for (const re of BANNED_PKG) if (re.test(s)) problems.push(`${where} — 쓰지 않기로 한 패키지·외부 주소예요`);
    const abs = resolveSpec(f, s);
    if (abs === "@site") {
      if (!isMain) problems.push(`${where} — @site 는 src/main.tsx 에서만 써요`);
      continue;
    }
    if (abs && !isTeacher && inside(abs, TEACHER)) problems.push(`${where} — 학생·공용 코드가 교사 코드를 가져와요`);
    if (abs && !isTeacher && inside(abs, DATA_TEACHER)) problems.push(`${where} — data/teacher 는 src/teacher 에서만 가져와요`);
    if (abs && inside(abs, path.resolve(ROOT, "../src"))) problems.push(`${where} — 저장소 뿌리 src(옛 사이트 코드)는 가져오지 않아요`);
    if (pure && kind !== "glob") {
      const isType = /^\s*import\s+type\b/m.test(code) && new RegExp(`import\\s+type[^;]*["']${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(code);
      if (/^(react|react-dom|katex)(\/|$)/.test(s)) problems.push(`${where} — 순수 로직은 react·katex 를 가져오지 않아요`);
      if (/^@(shared|data|content|site)\//.test(s) && !isType) problems.push(`${where} — 순수 로직은 별칭 대신 상대 경로를 써요(node --test)`);
      if ((s.charAt(0) === ".") && !/\.(ts|json|mjs|js)$/.test(s) && !isType) problems.push(`${where} — 순수 로직의 상대 import 에는 .ts 를 붙여요`);
      if (/\.css$/.test(s)) problems.push(`${where} — 순수 로직은 CSS 를 가져오지 않아요`);
    }
  }
  if (pure) {
    const c = stripComments(code).replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
    const dom = c.match(/\b(document|window|localStorage|sessionStorage|navigator|HTMLElement)\s*[.\[]/);
    if (dom) problems.push(`${rel(f)}: 순수 로직이 DOM/브라우저 전역 '${dom[1]}' 을 써요`);
  }
}

// 시험: 학생·공용 시험이 교사 코드를 가져오는 것은 괜찮지만, 별칭은 node 가 못 풀어요
for (const f of testFiles) {
  if (!/\.test\.ts$/.test(f)) continue;
  const code = fs.readFileSync(f, "utf8");
  for (const { s } of specifiers(f, code)) {
    if (/^@(site|shared|data|content)\//.test(s) && !/^\s*import\s+type/m.test(code.split(s)[0].split("\n").pop() || "")) {
      problems.push(`${rel(f)}: '${s}' — node --test 는 별칭을 못 풀어요(상대 경로로)`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.error("  ✗ " + p);
  console.error(`check-imports: 실패 ${problems.length}건`);
  process.exit(1);
}
console.log(`check-imports: 통과 — 파일 ${files.length}개, 가져오기 ${count}건이 규칙을 지켜요`);
if (VERBOSE) console.log("  (시험 파일 " + testFiles.length + "개도 봤어요)");
