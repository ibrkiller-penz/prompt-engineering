// 인공지능 기초 콘텐츠 검사: node scripts/check-aibasic.mjs [--strict] [파일 또는 폴더...]
// content/aibasic/** 의 형식·id 중복·정답 범위·수식/HTML 잔재를 검사한다. 오류가 있으면 종료 코드 1.
// --strict 이면 경고(warn)도 오류로 본다. (scripts/check-aimath.mjs 와 같은 방식, katex 는 쓰지 않는다: 이 과목에는 수식이 없다.)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "content", "aibasic");
const strict = process.argv.includes("--strict");
const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const BLOCKS = ["p", "term", "callout", "table", "list", "example", "dialog", "code", "image"];

let errors = 0, warns = 0;
const err = (f, m) => { errors++; console.log(`ERROR ${f}: ${m}`); };
const warn = (f, m) => { warns++; if (strict) errors++; console.log(`${strict ? "ERROR" : "warn "} ${f}: ${m}`); };

const TAG = /<\/?[a-zA-Z][^>]*>/;
const ENTITY = /&(?:nbsp|amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+);/;
const CTRL = /[\t\f\x08\r\x00-\x07\x0b\x0e-\x1f]/;

// 글자(Text): 비어 있지 않고, HTML·엔티티·수식($, LaTeX) 잔재가 없고, ** 와 ` 가 짝이 맞아야 한다.
function checkText(f, where, t, { allowEmpty = false } = {}) {
  if (typeof t !== "string") return err(f, `${where}: 문자열이 아님`);
  if (!t.trim()) { if (!allowEmpty) err(f, `${where}: 글자가 비었음`); return; }
  if (TAG.test(t)) err(f, `${where}: HTML 태그 잔재 → ${t.match(TAG)[0]}`);
  if (ENTITY.test(t)) err(f, `${where}: HTML 엔티티 잔재 → ${t.match(ENTITY)[0]}`);
  if (CTRL.test(t)) err(f, `${where}: 탭·제어문자가 있음 ${JSON.stringify(t.slice(0, 40))}`);
  if (/(?<!\\)\$/.test(t)) err(f, `${where}: 이스케이프 안 된 $ (수식 잔재?) → ${t.slice(0, 50)}`);
  if (/\\(?:frac|times|alpha|beta|sqrt|sum|cdot|left|right|begin|end|\(|\[)/.test(t)) err(f, `${where}: LaTeX 잔재 ${t.slice(0, 50)}`);
  const stars = (t.match(/\*\*/g) || []).length;
  if (stars % 2) err(f, `${where}: ** 개수가 홀수: ${t.slice(0, 50)}`);
  if (/\*\*\*/.test(t)) err(f, `${where}: *** 가 붙어 있음(굵게 표시와 글자 * 가 겹침): ${t.slice(0, 50)}`);
  for (const m of t.matchAll(/\*\*(.+?)\*\*/gs)) {
    if (!m[1].trim()) { err(f, `${where}: 빈 굵은 글 → ${JSON.stringify(m[0])}`); break; }
    if (/^\s|\s$/.test(m[1])) { warn(f, `${where}: 굵은 글 안쪽 끝에 공백 → ${JSON.stringify(m[0].slice(0, 30))}`); break; }
  }
  if ((t.match(/`/g) || []).length % 2) err(f, `${where}: 백틱(\`) 개수가 홀수: ${t.slice(0, 50)}`);
  if (/^\s|\s$/.test(t)) warn(f, `${where}: 앞뒤 공백`);
}
const len = (a) => (a || []).join("").length;
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);

function checkBlock(f, where, b, lessonDir) {
  if (!isObj(b) || !BLOCKS.includes(b.t)) return err(f, `${where}: 알 수 없는 블록 t=${b?.t}`);
  switch (b.t) {
    case "p": checkText(f, where, b.text); break;
    case "term": checkText(f, `${where}.term`, b.term); checkText(f, `${where}.def`, b.def); break;
    case "callout":
      if (!["tip", "warn", "aha", "try"].includes(b.kind)) err(f, `${where}: callout kind 오류 ${b.kind}`);
      if (b.title != null) checkText(f, `${where}.title`, b.title);
      checkText(f, where, b.text); break;
    case "table": {
      if (!Array.isArray(b.head) || !b.head.length || !Array.isArray(b.rows) || !b.rows.length) { err(f, `${where}: 표에 head/rows 필요`); break; }
      if (!b.head.some((h) => String(h).trim())) err(f, `${where}: 표 머리글이 모두 비었음`);
      b.head.forEach((h, k) => checkText(f, `${where}.head[${k}]`, h, { allowEmpty: true }));
      b.rows.forEach((r, k) => {
        if (!Array.isArray(r) || r.length !== b.head.length) return err(f, `${where}.rows[${k}]: 칸 수(${r?.length})가 head(${b.head.length})와 다름`);
        r.forEach((c, j) => checkText(f, `${where}.rows[${k}][${j}]`, c, { allowEmpty: true }));
        if (r.every((c) => !String(c).trim())) err(f, `${where}.rows[${k}]: 모든 칸이 빔`);
      });
      if (b.caption != null) checkText(f, `${where}.caption`, b.caption);
      break;
    }
    case "list":
      if (!Array.isArray(b.items) || !b.items.length) err(f, `${where}: items 필요`);
      else b.items.forEach((x, k) => checkText(f, `${where}.items[${k}]`, x));
      if (b.ordered != null && typeof b.ordered !== "boolean") err(f, `${where}: ordered 는 boolean`);
      break;
    case "example":
      checkText(f, `${where}.title`, b.title); checkText(f, `${where}.problem`, b.problem); checkText(f, `${where}.answer`, b.answer);
      if (!b.steps?.length) err(f, `${where}: steps 필요`); else b.steps.forEach((s, k) => checkText(f, `${where}.steps[${k}]`, s)); break;
    case "dialog":
      if (!b.lines?.length) err(f, `${where}: lines 필요`);
      (b.lines || []).forEach((l, k) => { if (!l.who) err(f, `${where}.lines[${k}]: who 없음`); checkText(f, `${where}.lines[${k}]`, l.text); }); break;
    case "code":
      if (typeof b.code !== "string" || !b.code.trim()) err(f, `${where}: code 가 비었음`);
      else {
        if (ENTITY.test(b.code)) err(f, `${where}: 코드에 HTML 엔티티 잔재 → ${b.code.match(ENTITY)[0]}`);
        if (/<\/?(?:pre|code|p|div|table|tr|td|th|ul|ol|li|b|br|span)\b[^>]*>/i.test(b.code)) err(f, `${where}: 코드에 HTML 태그 잔재`);
      }
      if (b.lang != null && b.lang !== "python") err(f, `${where}: lang 은 python 만`);
      break;
    case "image":
      checkText(f, `${where}.alt`, b.alt);
      if (b.caption != null) checkText(f, `${where}.caption`, b.caption);
      if (typeof b.src !== "string" || !/^img\/[\w.-]+\.(jpg|jpeg|png|svg|webp)$/.test(b.src)) err(f, `${where}: src 모양 오류 ${b.src}`);
      else if (!fs.existsSync(path.join(ROOT, b.src))) err(f, `${where}: 그림 파일 없음 ${b.src}`);
      break;
  }
}

function checkQuestion(f, q, i, ids, idRe) {
  const w = `문제[${i}] ${q?.id ?? "?"}`;
  if (!isObj(q)) return err(f, `${w}: 객체가 아님`);
  if (!q.id) err(f, `${w}: id 없음`);
  else {
    if (ids.has(q.id)) err(f, `${w}: id 중복`); else ids.add(q.id);
    if (idRe && !idRe.test(q.id)) err(f, `${w}: id 모양이 ${idRe} 와 다름`);
  }
  if (![1, 2, 3, 4, 5].includes(q.level)) err(f, `${w}: level 은 1~5`);
  checkText(f, `${w}.group`, q.group); checkText(f, `${w}.prompt`, q.prompt);
  if (q.passage != null) {
    if (!Array.isArray(q.passage) || !q.passage.length) err(f, `${w}: passage 는 블록 배열`);
    else q.passage.forEach((b, k) => checkBlock(f, `${w}.passage[${k}]`, b));
  }
  if (!Array.isArray(q.hints) || q.hints.length !== 2) err(f, `${w}: hints 는 정확히 2개`);
  else {
    q.hints.forEach((h, k) => checkText(f, `${w}.hints[${k}]`, h));
    if (q.hints[0] === q.hints[1]) warn(f, `${w}: 힌트 두 개가 같음`);
  }
  checkText(f, `${w}.solution`, q.solution);
  switch (q.type) {
    case "choice":
      if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 5) err(f, `${w}: 보기는 3~5개`);
      else {
        q.choices.forEach((c, k) => checkText(f, `${w}.choices[${k}]`, c));
        if (new Set(q.choices).size !== q.choices.length) err(f, `${w}: 보기가 서로 같은 것이 있음`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) err(f, `${w}: answer(${q.answer}) 가 보기 번호 범위를 벗어남`);
      }
      break;
    case "ox":
      if (typeof q.answer !== "boolean") err(f, `${w}: ox 의 answer 는 true/false`);
      if (q.choices != null) err(f, `${w}: ox 에는 choices 가 없어야 함`);
      break;
    default: err(f, `${w}: type 은 choice/ox 중 하나(지금 ${q.type})`);
  }
}

function checkLesson(f, L, meta, unitMeta) {
  const rel = path.relative(ROOT, f);
  const must = ["id", "unit", "order", "title", "subtitle", "minutes", "story", "question", "sections", "terms", "practice", "summary"];
  for (const k of must) if (L[k] == null) err(rel, `필드 누락: ${k}`);
  if (must.some((k) => L[k] == null)) return;
  if (!/^u[1-4](_[0-9A]+)+$/.test(L.id)) err(rel, `레슨 id 모양 오류 ${L.id} (u + 원본 id 의 - 를 _ 로, 예: u2_1_3)`);
  if (path.basename(f) !== `lesson-${L.id}.json`) err(rel, `파일 이름이 lesson-${L.id}.json 이어야 함`);
  if (path.basename(path.dirname(f)) !== `u${L.unit}`) err(rel, `폴더가 u${L.unit} 이어야 함`);
  if (L.origId && "u" + L.origId.replace(/-/g, "_") !== L.id) err(rel, `origId(${L.origId}) 와 id(${L.id}) 가 맞지 않음`);
  const m = meta?.lessons.find((x) => x.id === L.id);
  if (!m) err(rel, `id ${L.id} 가 units.json 에 없음`);
  else {
    if (m.title !== L.title) err(rel, `title 이 units.json 과 다름: ${L.title} / ${m.title}`);
    if (unitMeta && unitMeta.lessons.findIndex((x) => x.id === L.id) + 1 !== L.order) err(rel, `order(${L.order}) 가 units.json 의 순서와 다름`);
  }
  checkText(rel, "title", L.title); checkText(rel, "subtitle", L.subtitle); checkText(rel, "question", L.question);
  if (L.storyTitle != null) checkText(rel, "storyTitle", L.storyTitle);
  if (L.pages != null) checkText(rel, "pages", L.pages);
  if (!Number.isInteger(L.minutes) || L.minutes < 10 || L.minutes > 90) warn(rel, `minutes ${L.minutes} 이상함`);
  if (!Array.isArray(L.story) || !L.story.length) err(rel, "story 는 문단 배열");
  else L.story.forEach((t, i) => checkText(rel, `story[${i}]`, t));
  if (L.goals != null) { if (!Array.isArray(L.goals) || !L.goals.length) err(rel, "goals 는 비어 있지 않은 배열"); else L.goals.forEach((t, i) => checkText(rel, `goals[${i}]`, t)); }
  if (!Array.isArray(L.sections) || !L.sections.length) err(rel, "sections 가 비었음");
  let chars = 0;
  (L.sections || []).forEach((s, i) => {
    checkText(rel, `sections[${i}].heading`, s.heading);
    if (!Array.isArray(s.blocks) || !s.blocks.length) err(rel, `sections[${i}].blocks 가 비었음`);
    (s.blocks || []).forEach((b, k) => {
      checkBlock(rel, `sections[${i}].blocks[${k}]`, b);
      if (b.t === "p") chars += (b.text || "").length;
      if (b.t === "callout") chars += (b.text || "").length;
      if (b.t === "list") chars += len(b.items);
      if (b.t === "table") chars += len((b.rows || []).flat());
    });
    if (s.keypoints != null) { if (!Array.isArray(s.keypoints) || !s.keypoints.length) err(rel, `sections[${i}].keypoints 는 비어 있지 않은 배열`); else s.keypoints.forEach((t, k) => checkText(rel, `sections[${i}].keypoints[${k}]`, t)); }
    const last = (s.blocks || []).at(-1);
    if (s.keypoints && !(last?.t === "callout" && last.kind === "aha" && last.title === "한 줄 정리")) warn(rel, `sections[${i}]: keypoints 가 있는데 끝에 '한 줄 정리' callout 이 없음`);
  });
  if (chars < 1500) warn(rel, `개념 정리 분량 ${chars}자(너무 짧음)`);
  if (!Array.isArray(L.terms) || !L.terms.length) err(rel, "terms 가 비었음");
  (L.terms || []).forEach((t, i) => { checkText(rel, `terms[${i}].term`, t.term); checkText(rel, `terms[${i}].def`, t.def); });
  if (!Array.isArray(L.summary) || !L.summary.length) err(rel, "summary 가 비었음");
  (L.summary || []).forEach((t, i) => checkText(rel, `summary[${i}]`, t));
  const ids = new Set();
  const idRe = new RegExp(`^${L.id}-q[1-9]\\d*$`);
  if (!Array.isArray(L.practice) || !L.practice.length) err(rel, "practice 가 비었음");
  (L.practice || []).forEach((q, i) => {
    checkQuestion(rel, q, i, ids, idRe);
    if (q.id && q.id !== `${L.id}-q${i + 1}`) err(rel, `문제[${i}] id 가 순서(${L.id}-q${i + 1})와 다름: ${q.id}`);
  });
  // 계단 확인 문제가 섹션 수만큼의 묶음으로 들어 있는지
  const groups = new Set((L.practice || []).filter((q) => /^계단 확인 /.test(q.group)).map((q) => q.group));
  if (groups.size !== L.sections.length) warn(rel, `'계단 확인' 묶음 ${groups.size}개 ≠ 섹션 ${L.sections.length}개`);
  L.sections.forEach((s) => { const lv = String(s.heading).split(" · ")[0]; if (!groups.has("계단 확인 " + lv)) warn(rel, `섹션 '${lv}' 의 계단 확인 문제가 없음`); });
  if (!(L.practice || []).some((q) => q.group === "마무리 퀴즈")) warn(rel, "마무리 퀴즈가 없음");
  console.log(`  ✓ ${rel}: 계단 ${L.sections.length}, 개념 ${chars}자, 용어 ${L.terms.length}, 문제 ${L.practice.length}`);
}

function checkUnit(f, U, meta) {
  const rel = path.relative(ROOT, f);
  for (const k of ["id", "why", "opening", "test", "future"]) if (U[k] == null) return err(rel, `필드 누락: ${k}`);
  if (!meta || meta.id !== U.id) err(rel, `id ${U.id} 가 units.json 과 맞지 않음`);
  for (const k of ["why", "opening", "future"]) {
    checkText(rel, `${k}.title`, U[k].title);
    if (!Array.isArray(U[k].paragraphs) || !U[k].paragraphs.length) err(rel, `${k}.paragraphs 가 비었음`);
    (U[k].paragraphs || []).forEach((t, i) => checkText(rel, `${k}[${i}]`, t));
  }
  const ids = new Set();
  if (!Array.isArray(U.test) || !U.test.length) err(rel, "test 가 비었음");
  (U.test || []).forEach((q, i) => checkQuestion(rel, q, i, ids, new RegExp(`^u${U.id}-t[1-9]\\d*$`)));
  if (U.enrich) warn(rel, "enrich:true — 원본에 없는 why/opening/future 가 최소 내용임(보강 대상)");
  console.log(`  ✓ ${rel}: 종합 문제 ${(U.test || []).length}`);
}

// ---------------------------------------------------------------- 실행
const readJSON = (f, rel) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { err(rel, `JSON 문법 오류: ${e.message}`); return null; } };
const unitsFile = path.join(ROOT, "units.json");
if (!fs.existsSync(unitsFile)) { console.log("ERROR units.json 이 없음"); process.exit(1); }
const units = readJSON(unitsFile, "units.json");
if (!units) process.exit(1);
if (units.length !== 4) err("units.json", `단원은 4개여야 함(지금 ${units.length})`);
const lessonIds = new Set();
for (const [i, u] of units.entries()) {
  if (u.id !== i + 1 || u.slug !== `u${u.id}`) err("units.json", `단원 id/slug 오류 ${u.id}/${u.slug}`);
  for (const k of ["roman", "title", "short", "icon"]) checkText("units.json", `단원 ${u.id}.${k}`, u[k]);
  for (const k of ["color", "soft"]) if (!/^#[0-9a-f]{6}$/i.test(u[k] || "")) err("units.json", `단원 ${u.id}.${k} 는 #rrggbb`);
  if (!u.lessons?.length) err("units.json", `단원 ${u.id} 에 lessons 가 없음`);
  for (const l of u.lessons || []) {
    if (lessonIds.has(l.id)) err("units.json", `레슨 id 중복 ${l.id}`); lessonIds.add(l.id);
    checkText("units.json", `${l.id}.title`, l.title); checkText("units.json", `${l.id}.short`, l.short);
    if (!l.id.startsWith(`u${u.id}`)) err("units.json", `레슨 ${l.id} 가 단원 ${u.id} 에 있음`);
  }
}
if (lessonIds.size !== 26) err("units.json", `레슨은 26개여야 함(지금 ${lessonIds.size})`);

const files = [];
function walk(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) { if (path.basename(p) === "img") return; fs.readdirSync(p).forEach((n) => walk(path.join(p, n))); }
  else if (p.endsWith(".json") && !p.endsWith("units.json")) files.push(p);
}
(targets.length ? targets.map((t) => path.resolve(t)) : [ROOT]).forEach(walk);
files.sort();
const seenLessons = new Set(), questionIds = new Map();
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const J = readJSON(f, rel);
  if (!J) continue;
  const base = path.basename(f);
  if (base === "unit.json") checkUnit(f, J, units.find((u) => u.id === J.id));
  else if (/^lesson-u[1-4](_[0-9A]+)+\.json$/.test(base)) {
    const unitMeta = units.find((u) => u.id === J.unit);
    if (!unitMeta) { err(rel, `unit ${J.unit} 이 units.json 에 없음`); continue; }
    if (seenLessons.has(J.id)) err(rel, `레슨 id 중복 ${J.id}`); seenLessons.add(J.id);
    checkLesson(f, J, unitMeta, unitMeta);
    for (const q of J.practice || []) if (q.id) { if (questionIds.has(q.id)) err(rel, `문제 id 가 다른 레슨과 겹침: ${q.id} (${questionIds.get(q.id)})`); else questionIds.set(q.id, rel); }
  } else warn(rel, "알 수 없는 파일 이름(unit.json, lesson-<id>.json 만 사용)");
}
if (!targets.length) {
  for (const u of units) {
    if (!fs.existsSync(path.join(ROOT, `u${u.id}`, "unit.json"))) err(`u${u.id}`, "unit.json 없음");
    for (const l of u.lessons) if (!seenLessons.has(l.id)) err(l.id, "레슨 파일 없음");
  }
  // img 폴더에 아무도 쓰지 않는 파일이 있는지
  const used = new Set();
  const scan = (o) => { if (Array.isArray(o)) o.forEach(scan); else if (isObj(o)) { if (o.t === "image" && o.src) used.add(o.src); Object.values(o).forEach(scan); } };
  for (const f of files) { try { scan(JSON.parse(fs.readFileSync(f, "utf8"))); } catch { /* 위에서 보고함 */ } }
  const imgDir = path.join(ROOT, "img");
  if (fs.existsSync(imgDir)) for (const n of fs.readdirSync(imgDir)) if (!used.has("img/" + n)) warn("img/" + n, "어느 블록도 쓰지 않는 그림");
}
console.log(`\n파일 ${files.length}개 검사 · 오류 ${errors} · 경고 ${warns}`);
process.exit(errors ? 1 : 0);
