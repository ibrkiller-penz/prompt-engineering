#!/usr/bin/env node
// 학생 번들 누출 검사. dist-s 의 모든 파일(js·css·html·txt)에 교사 전용 표식·문구·자료가 0건인지 봐요.
//   표식: __AIMN_TEACHER_ONLY__, 교사 저장 접두사 aimn:t1, 교사 화면 이름(정답 일괄 · 문제 고르기 · 수업 진행 · 교사 준비)
//   자료: data/teacher/prep/u1..u5.json 의 발문·오개념 문장(레슨마다 몇 줄씩 표본)
// 거꾸로 dist-t 에는 표식이 있어야 해요(표식이 사라져 검사가 헛도는 것을 막아요).
// 사용: node scripts/check-leak.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "__AIMN_TEACHER_ONLY__";
const FIXED = [MARK, "aimn:t1", "정답 일괄", "문제 고르기", "수업 진행", "교사 준비"];

function files(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) files(f, out);
    else if (/\.(m?js|css|html|txt|json|webmanifest|svg)$/.test(e.name)) out.push(f);
  }
  return out;
}

/** 교사 자료 표본: 각 레슨의 발문·막히는 곳·오개념 첫 문장. 짧은 문장은 우연히 겹칠 수 있어 12자 이상만 */
function prepSamples() {
  const out = [];
  const dir = path.join(ROOT, "data/teacher/prep");
  if (!fs.existsSync(dir)) return out;
  const pick = (v) => {
    if (typeof v === "string") return v;
    if (v && typeof v === "object") return v.q || v.text || v.what || v.a || Object.values(v).find((x) => typeof x === "string") || "";
    return "";
  };
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const x of Object.values(d.lessons || {})) {
      for (const k of ["asks", "stuck", "misconceptions"]) {
        const arr = Array.isArray(x[k]) ? x[k] : [];
        for (const v of arr.slice(0, 2)) {
          const s = pick(v).trim();
          // JS 문자열 안에서 이스케이프되는 따옴표·줄바꿈이 없는 앞부분만 써요
          const frag = s.split(/["'\\\n`]/)[0].slice(0, 40);
          if (frag.length >= 12) out.push(frag);
        }
      }
    }
  }
  return out;
}

const studentFiles = files(path.join(ROOT, "dist-s"));
const teacherFiles = files(path.join(ROOT, "dist-t"));
let fail = 0;
if (!studentFiles.length) {
  console.error("  ✗ dist-s 가 없어요(먼저 build:s)");
  process.exit(1);
}
if (!teacherFiles.length) {
  console.error("  ✗ dist-t 가 없어요(먼저 build:t)");
  process.exit(1);
}

// 교사 자료가 원본 콘텐츠 문장을 그대로 인용한 경우(예: 오개념 = 문제 지문)는 학생 번들에 있어도 누출이 아니에요
const contentText = (() => {
  try {
    const dir = path.resolve(ROOT, "../content/aimath");
    return files(dir).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  } catch {
    return "";
  }
})();
const samples = prepSamples().filter((s) => contentText.indexOf(s) < 0);
const needles = FIXED.concat(samples);
for (const f of studentFiles) {
  if (/robots-teacher\.txt$/.test(f)) continue; // firebase.json 이 학생 사이트에서는 올리지 않아요(ignore)
  const text = fs.readFileSync(f, "utf8");
  for (const s of needles) {
    const at = text.indexOf(s);
    if (at >= 0) {
      console.error(`  ✗ ${path.relative(ROOT, f)}: 교사 전용 '${s.slice(0, 30)}' 가 학생 번들에 있어요 — …${text.slice(Math.max(0, at - 40), at + 50).replace(/\s+/g, " ")}…`);
      fail++;
    }
  }
}

// dist-t 에는 표식과 교사 자료가 실제로 있어야 해요
const tText = teacherFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");
if (tText.indexOf(MARK) < 0) {
  console.error(`  ✗ dist-t 에 표식 ${MARK} 가 없어요(src/teacher/mark.ts 확인). 표식이 없으면 누출 검사가 헛돌아요`);
  fail++;
}
const inT = samples.filter((s) => tText.indexOf(s) >= 0).length;
if (samples.length && inT === 0) {
  console.error("  ✗ dist-t 에서 교사 준비 자료 문장을 하나도 찾지 못했어요(표본 추출이 어긋났을 수 있어요)");
  fail++;
}

if (fail) {
  console.error(`check-leak: 실패 ${fail}건`);
  process.exit(1);
}
console.log(`check-leak: 통과 — dist-s 파일 ${studentFiles.length}개에 교사 표식·문구 ${FIXED.length}종과 준비 자료 표본 ${samples.length}줄이 없어요(dist-t 에서는 ${inT}줄 확인)`);
