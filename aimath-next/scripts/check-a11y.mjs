#!/usr/bin/env node
// 접근성 정적 검사(src 의 .tsx 를 읽어요).
//  1) 모든 <img> 에 alt 가 있어야 해요(장식이면 alt="")
//  2) 아이콘만 있는 <button> 에는 aria-label(또는 title)이 있어야 해요(안에 글자가 하나도 없는 단추)
// 사용: node scripts/check-a11y.mjs [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

function walk(dir, out) {
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n);
    const st = fs.statSync(f);
    if (st.isDirectory()) walk(f, out);
    else if (/\.tsx$/.test(n)) out.push(f);
  }
  return out;
}

/** 시작 태그의 끝(> 위치). { } 안의 > 와 문자열 안의 > 는 건너뛰어요 */
function tagEnd(s, i) {
  let depth = 0;
  let q = "";
  for (; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = "";
      continue;
    }
    if (depth === 0 && (c === '"' || c === "'")) q = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return -1;
}

const lineOf = (s, i) => s.slice(0, i).split("\n").length;
const problems = [];
let imgs = 0;
let btns = 0;

for (const f of walk(SRC, [])) {
  const s = fs.readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f);
  const reImg = /<img\b/g;
  let m;
  while ((m = reImg.exec(s))) {
    imgs++;
    const e = tagEnd(s, m.index);
    const tag = s.slice(m.index, e + 1);
    if (!/\balt\s*=/.test(tag) && !/\{\.\.\./.test(tag)) problems.push(`${rel}:${lineOf(s, m.index)} <img> 에 alt 가 없어요`);
  }
  const reBtn = /<button\b/g;
  while ((m = reBtn.exec(s))) {
    const e = tagEnd(s, m.index);
    if (e < 0 || s[e - 1] === "/") continue;
    const tag = s.slice(m.index, e + 1);
    const close = s.indexOf("</button>", e);
    if (close < 0) continue;
    btns++;
    if (/aria-label(ledby)?\s*=|\btitle\s*=|\{\.\.\./.test(tag)) continue;
    const inner = s.slice(e + 1, close);
    // 보이는 글자: 태그·aria-hidden 요소를 뺀 나머지
    let t = inner.replace(/<[^>]*aria-hidden[^>]*>[\s\S]*?<\/[a-z]+>/g, "").replace(/<Icon\b[^>]*\/>/g, "").replace(/<(?!Icon\b)[A-Z][^>]*\/>/g, " {c} ").replace(/<[^>]+>/g, " ");
    // {표현식}(변수·함수 결과)은 글자로 셈해요. Icon·aria-hidden 요소만 있으면 글자가 없는 단추예요
    if (!/[\p{L}\p{N}{]/u.test(t)) problems.push(`${rel}:${lineOf(s, m.index)} 아이콘만 있는 <button> 에 aria-label 이 없어요`);
  }
}

if (problems.length) {
  for (const p of problems) console.error("✗ " + p);
  console.error(`check-a11y: 문제 ${problems.length}건`);
  process.exit(1);
}
console.log(`check-a11y: <img> ${imgs}개, <button> ${btns}개 검사, 문제 없어요`);
