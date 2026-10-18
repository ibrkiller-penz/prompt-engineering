#!/usr/bin/env node
// Chrome 80 문법·API 검사. dist-s, dist-t 의 assets/*.js 를 acorn(ecmaVersion 2020)으로 파싱하고,
// Chrome 80 에 없는 API(.at( · replaceAll · Object.hasOwn · structuredClone · findLast · crypto.randomUUID)를 찾아요.
// ?. 와 ?? 는 Chrome 80 이 원래 지원해서 괜찮아요(ES2020).
// 사용: node scripts/check-es.mjs [dist-s dist-t ...]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function loadAcorn() {
  const tries = ["acorn", "/opt/node-tools/node_modules/acorn", path.join(ROOT, "../node_modules/acorn")];
  try {
    const { execSync } = require("node:child_process");
    tries.push(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "acorn"));
  } catch {
    /* npm 이 없어도 괜찮아요 */
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

const acorn = loadAcorn();
if (!acorn) {
  console.error("check-es: acorn 을 찾지 못했어요(/opt/node-tools/node_modules/acorn 확인)");
  process.exit(1);
}

/** 금지 API: [이름, 정규식]. 문자열·주석 속 우연한 일치를 줄이려고 호출 모양으로 찾아요 */
const BANNED = [
  [".at()", /\.at\(\s*-?[\w$.]/g],
  ["replaceAll", /\.replaceAll\(/g],
  ["Object.hasOwn", /Object\.hasOwn\(/g],
  ["structuredClone", /\bstructuredClone\(/g],
  ["findLast", /\.findLast(Index)?\(/g],
  ["crypto.randomUUID", /randomUUID\(/g],
  ["Object.groupBy", /\b(Object|Map)\.groupBy\(/g],
  ["Promise.any", /Promise\.any\(/g],
  ["WeakRef", /\bnew WeakRef\(/g],
  ["String.prototype.isWellFormed", /\.isWellFormed\(/g],
  ["toSorted/toReversed/toSpliced/with", /\.(toSorted|toReversed|toSpliced)\(/g],
];

/** 라이브러리(react-dom 등)가 기능 감지 뒤에만 쓰는 경우: 앞쪽에 typeof 검사가 붙은 일치는 봐줘요 */
function guarded(code, idx, name) {
  const before = code.slice(Math.max(0, idx - 160), idx);
  if (name === "structuredClone") return /typeof\s+structuredClone/.test(before);
  if (name === "crypto.randomUUID") return /typeof[\s\S]{0,40}randomUUID|randomUUID\s*\?|&&\s*[\w$.]*$/.test(before);
  return false;
}

const dirs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = (dirs.length ? dirs : ["dist-s", "dist-t"]).map((d) => path.resolve(ROOT, d));

let fail = 0;
let files = 0;
for (const dir of targets) {
  const assets = path.join(dir, "assets");
  if (!fs.existsSync(assets)) {
    console.error(`  ✗ ${path.relative(ROOT, dir)}/assets 가 없어요(먼저 빌드해요)`);
    fail++;
    continue;
  }
  const htmlFile = path.join(dir, "index.html");
  const sources = [];
  for (const f of fs.readdirSync(assets)) if (/\.(m?js)$/.test(f)) sources.push(path.join(assets, f));
  // index.html 안 인라인 스크립트도 봐요
  if (fs.existsSync(htmlFile)) {
    const html = fs.readFileSync(htmlFile, "utf8");
    let i = 0;
    for (const mm of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
      if (mm[1].trim()) sources.push({ name: `index.html#inline${i++}`, code: mm[1], module: /type="module"/.test(mm[0]) });
    }
  }
  for (const s of sources) {
    files++;
    const name = typeof s === "string" ? path.relative(ROOT, s) : `${path.relative(ROOT, dir)}/${s.name}`;
    const code = typeof s === "string" ? fs.readFileSync(s, "utf8") : s.code;
    try {
      acorn.parse(code, { ecmaVersion: 2020, sourceType: "module", allowHashBang: true });
    } catch (e) {
      const pos = e.pos || 0;
      console.error(`  ✗ ${name}: ES2020 으로 파싱되지 않아요 — ${e.message}\n      …${code.slice(Math.max(0, pos - 60), pos + 60).replace(/\s+/g, " ")}…`);
      fail++;
    }
    for (const [label, re] of BANNED) {
      re.lastIndex = 0;
      let mm;
      while ((mm = re.exec(code))) {
        if (guarded(code, mm.index, label)) continue;
        console.error(`  ✗ ${name}: Chrome 80 에 없는 API '${label}' — …${code.slice(Math.max(0, mm.index - 50), mm.index + 40).replace(/\s+/g, " ")}…`);
        fail++;
        break;
      }
    }
  }
}

if (fail) {
  console.error(`check-es: 실패 ${fail}건`);
  process.exit(1);
}
console.log(`check-es: 통과 — JS ${files}개가 ES2020 으로 파싱되고 금지 API 가 없어요`);
