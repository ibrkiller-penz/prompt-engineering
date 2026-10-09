// 인공지능 수학 콘텐츠 검사: node scripts/check-aimath.mjs [--strict] [파일 또는 폴더...]
// 형식 오류(error)가 있으면 종료 코드 1. --strict 이면 분량 부족(warn)도 오류로 본다.
import fs from "node:fs";
import path from "node:path";
import katex from "katex";

const ROOT = path.resolve(import.meta.dirname, "..", "content", "aimath");
const strict = process.argv.includes("--strict");
const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const WIDGETS = ["turing", "rulevslearn", "bigdata", "bow", "tfidf", "cosine", "sentiment", "pixels", "imgtransform", "knn", "bayes", "regression", "gradient", "truth", "flow", "vecops", "tangent"];
const BLOCKS = ["p", "math", "term", "callout", "table", "list", "example", "dialog", "widget"];

let errors = 0, warns = 0;
const err = (f, m) => { errors++; console.log(`ERROR ${f}: ${m}`); };
const warn = (f, m) => { warns++; if (strict) errors++; console.log(`${strict ? "ERROR" : "warn "} ${f}: ${m}`); };

function checkText(f, where, t) {
  if (typeof t !== "string" || !t.trim()) return err(f, `${where}: 글자가 비었거나 문자열이 아님`);
  if (/<\/?[a-zA-Z][^>]*>/.test(t)) err(f, `${where}: HTML 태그 사용 금지 → ${t.match(/<\/?[a-zA-Z][^>]*>/)[0]}`);
  // JSON 에서 \times 처럼 역슬래시를 한 번만 쓰면 \t(탭) 등으로 몰래 바뀐다 → 제어문자로 감지
  if (/[\t\f\x08\r]/.test(t)) err(f, `${where}: 탭·제어문자가 있음 → 역슬래시를 한 번만 쓴 것 같음(수식의 \\times, \\frac, \\beta, \\rightarrow 는 JSON 안에서 역슬래시 두 번). ${JSON.stringify(t.slice(0, 40))}`);
  for (const m of t.matchAll(/(?<!\\)\$([^$]+)\$/g)) if (m[1].includes("\n")) err(f, `${where}: 수식 안에 줄바꿈이 있음(\\neq 처럼 역슬래시를 한 번만 쓴 것 같음): ${JSON.stringify(m[1].slice(0, 40))}`);
  const dollars = (t.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2) err(f, `${where}: $ 개수가 홀수(수식이 닫히지 않음): ${t.slice(0, 50)}`);
  for (const m of t.matchAll(/(?<!\\)\$([^$]+)\$/g)) {
    try { katex.renderToString(m[1], { throwOnError: true, strict: "ignore" }); }
    catch (e) { err(f, `${where}: 수식 오류 [$${m[1]}$] ${String(e.message).slice(0, 80)}`); }
  }
  if ((t.match(/\*\*/g) || []).length % 2) err(f, `${where}: ** 개수가 홀수: ${t.slice(0, 50)}`);
}
function checkTex(f, where, t) {
  if (typeof t !== "string" || !t.trim()) return err(f, `${where}: 수식이 비었음`);
  try { katex.renderToString(t, { throwOnError: true, strict: "ignore" }); }
  catch (e) { err(f, `${where}: 수식 오류 [${t.slice(0, 40)}] ${String(e.message).slice(0, 80)}`); }
}
const len = (a) => (a || []).join("").length;

function checkQuestion(f, q, i, ids) {
  const w = `문제[${i}] ${q?.id ?? "?"}`;
  if (!q || typeof q !== "object") return err(f, `${w}: 객체가 아님`);
  if (!q.id) err(f, `${w}: id 없음`); else if (ids.has(q.id)) err(f, `${w}: id 중복`); else ids.add(q.id);
  if (![1, 2, 3, 4, 5].includes(q.level)) err(f, `${w}: level 은 1~5`);
  checkText(f, `${w}.group`, q.group); checkText(f, `${w}.prompt`, q.prompt);
  if (q.new != null) checkText(f, `${w}.new`, q.new);
  const hints = (key) => {
    if (!Array.isArray(q.hints) || q.hints.length !== 2) return err(f, `${w}: hints 는 정확히 2개`);
    q.hints.forEach((h, k) => checkText(f, `${w}.hints[${k}]`, h));
  };
  switch (q.type) {
    case "choice":
      if (!Array.isArray(q.choices) || q.choices.length < 3 || q.choices.length > 5) err(f, `${w}: 보기는 3~5개`);
      else {
        q.choices.forEach((c, k) => checkText(f, `${w}.choices[${k}]`, c));
        if (new Set(q.choices).size !== q.choices.length) err(f, `${w}: 보기가 서로 같은 것이 있음`);
        if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) err(f, `${w}: answer 가 보기 번호 범위를 벗어남`);
        if (q.choices.some((c) => /모두|없음|위 보기/.test(c))) warn(f, `${w}: '모두/없음' 류 보기는 피하세요`);
      }
      hints(); checkText(f, `${w}.solution`, q.solution); break;
    case "number":
      if (typeof q.answer !== "number" || !Number.isFinite(q.answer)) err(f, `${w}: number 의 answer 는 숫자`);
      if (q.tolerance != null && !(q.tolerance >= 0)) err(f, `${w}: tolerance 는 0 이상`);
      hints(); checkText(f, `${w}.solution`, q.solution); break;
    case "ox":
      if (typeof q.answer !== "boolean") err(f, `${w}: ox 의 answer 는 true/false`);
      hints(); checkText(f, `${w}.solution`, q.solution); break;
    case "open":
      checkText(f, `${w}.model`, q.model);
      if (!Array.isArray(q.rubric) || q.rubric.length < 2 || q.rubric.length > 4) err(f, `${w}: rubric 은 2~4개`);
      else q.rubric.forEach((r, k) => checkText(f, `${w}.rubric[${k}]`, r));
      if (q.hints) { if (q.hints.length !== 2) err(f, `${w}: hints 는 2개`); } break;
    default: err(f, `${w}: type 은 choice/number/ox/open 중 하나`);
  }
}

function checkBlock(f, where, b) {
  if (!b || !BLOCKS.includes(b.t)) return err(f, `${where}: 알 수 없는 블록 t=${b?.t}`);
  switch (b.t) {
    case "p": checkText(f, where, b.text); break;
    case "math": (Array.isArray(b.tex) ? b.tex : [b.tex]).forEach((t, k) => checkTex(f, `${where}.tex[${k}]`, t)); break;
    case "term": checkText(f, `${where}.term`, b.term); checkText(f, `${where}.def`, b.def); break;
    case "callout":
      if (!["tip", "warn", "aha", "try"].includes(b.kind)) err(f, `${where}: callout kind 오류`);
      checkText(f, where, b.text); break;
    case "table":
      (b.head || []).forEach((h, k) => checkText(f, `${where}.head[${k}]`, h));
      if (!b.head?.length || !b.rows?.length) err(f, `${where}: 표에 head/rows 필요`);
      (b.rows || []).forEach((r, k) => {
        if (r.length !== b.head.length) err(f, `${where}.rows[${k}]: 칸 수(${r.length})가 head(${b.head.length})와 다름`);
        r.forEach((c, j) => checkText(f, `${where}.rows[${k}][${j}]`, c));
      }); break;
    case "list": (b.items || []).forEach((x, k) => checkText(f, `${where}.items[${k}]`, x)); if (!b.items?.length) err(f, `${where}: items 필요`); break;
    case "example":
      checkText(f, `${where}.title`, b.title); checkText(f, `${where}.problem`, b.problem); checkText(f, `${where}.answer`, b.answer);
      if (!b.steps?.length) err(f, `${where}: steps 필요`); else b.steps.forEach((s, k) => checkText(f, `${where}.steps[${k}]`, s)); break;
    case "dialog":
      if (!b.lines?.length) err(f, `${where}: lines 필요`);
      (b.lines || []).forEach((l, k) => { if (!l.who) err(f, `${where}.lines[${k}]: who 없음`); checkText(f, `${where}.lines[${k}]`, l.text); }); break;
    case "widget": if (!WIDGETS.includes(b.id)) err(f, `${where}: 알 수 없는 widget id=${b.id}`); break;
  }
}

function checkLesson(f, L, meta) {
  const rel = path.relative(ROOT, f);
  const must = ["id", "unit", "order", "title", "subtitle", "minutes", "story", "question", "sections", "terms", "aiStory", "practice", "project", "summary"];
  for (const k of must) if (L[k] == null) err(rel, `필드 누락: ${k}`);
  if (must.some((k) => L[k] == null)) return;
  const m = meta?.lessons.find((x) => x.id === L.id);
  if (!m) err(rel, `id ${L.id} 가 units.json 에 없음`);
  else if (m.title !== L.title) warn(rel, `title 이 units.json 과 다름: ${L.title} / ${m.title}`);
  L.story.forEach((t, i) => checkText(rel, `story[${i}]`, t)); checkText(rel, "question", L.question);
  if (L.prereq) {
    checkText(rel, "prereq.title", L.prereq.title); if (L.prereq.intro) checkText(rel, "prereq.intro", L.prereq.intro);
    (L.prereq.items || []).forEach((it, i) => { checkText(rel, `prereq.items[${i}].term`, it.term); checkText(rel, `prereq.items[${i}].text`, it.text); });
    if ((L.prereq.items || []).length < 3) warn(rel, `prereq 카드 ${(L.prereq.items || []).length}개(3개 이상 권장)`);
  } else warn(rel, "prereq(먼저 알고 가요) 없음");
  const sc = len(L.story);
  if (L.story.length < 6 || sc < 900) warn(rel, `이야기가 짧음(문단 ${L.story.length}, ${sc}자; 문단 6+ · 1000자+ 권장)`);
  let chars = 0, examples = 0, widgets = 0, callouts = 0;
  L.sections.forEach((s, i) => {
    checkText(rel, `sections[${i}].heading`, s.heading);
    (s.blocks || []).forEach((b, k) => {
      checkBlock(rel, `sections[${i}].blocks[${k}]`, b);
      if (b.t === "p") chars += b.text.length; if (b.t === "example") { examples++; chars += b.problem.length + len(b.steps); }
      if (b.t === "widget") widgets++; if (b.t === "callout") { callouts++; chars += b.text.length; }
      if (b.t === "term") chars += b.term.length + b.def.length; if (b.t === "list") chars += len(b.items);
      if (b.t === "dialog") chars += b.lines.reduce((a, l) => a + l.text.length, 0);
      if (b.t === "table") chars += len(b.rows.flat());
    });
  });
  if (L.sections.length < 3) warn(rel, `섹션 ${L.sections.length}개(3개 이상 권장)`);
  if (chars < 2500) warn(rel, `개념 정리 분량 ${chars}자(2500자 이상 권장)`);
  if (examples < 3) warn(rel, `풀이 있는 예제 ${examples}개(3개 이상 권장)`);
  if (callouts < L.sections.length) warn(rel, `callout ${callouts}개 < 섹션 ${L.sections.length}개`);
  L.terms.forEach((t, i) => { checkText(rel, `terms[${i}].term`, t.term); checkText(rel, `terms[${i}].def`, t.def); });
  if (L.terms.length < 8) warn(rel, `용어 카드 ${L.terms.length}개(8개 이상 권장)`);
  checkText(rel, "aiStory.title", L.aiStory.title); L.aiStory.paragraphs.forEach((t, i) => checkText(rel, `aiStory[${i}]`, t));
  if (L.aiStory.paragraphs.length < 3) warn(rel, `AI 이야기 문단 ${L.aiStory.paragraphs.length}개(3개 이상 권장)`);
  const ids = new Set();
  L.practice.forEach((q, i) => checkQuestion(rel, q, i, ids));
  if (L.practice.length < 18) warn(rel, `연습 문제 ${L.practice.length}개(18개 이상 권장)`);
  const lv = new Set(L.practice.map((q) => q.level));
  if (lv.size < 4) warn(rel, `난이도 단계가 ${lv.size}가지뿐(4가지 이상 권장)`);
  for (let i = 1; i < L.practice.length; i++) if (L.practice[i].level + 1 < L.practice[i - 1].level) warn(rel, `문제 순서가 갑자기 쉬워짐: ${L.practice[i - 1].id}→${L.practice[i].id}`);
  const p = L.project;
  checkText(rel, "project.title", p.title); checkText(rel, "project.goal", p.goal);
  (p.steps || []).forEach((t, i) => checkText(rel, `project.steps[${i}]`, t)); (p.think || []).forEach((t, i) => checkText(rel, `project.think[${i}]`, t));
  if ((p.steps || []).length < 5) warn(rel, `프로젝트 단계 ${(p.steps || []).length}개(5개 이상 권장)`);
  if ((p.think || []).length < 3) warn(rel, `프로젝트 생각해 보기 ${(p.think || []).length}개(3개 이상 권장)`);
  L.summary.forEach((t, i) => checkText(rel, `summary[${i}]`, t));
  if (L.summary.length < 5) warn(rel, `요약 ${L.summary.length}줄(5줄 이상 권장)`);
  if (L.minutes < 10 || L.minutes > 90) warn(rel, `minutes ${L.minutes} 이상함`);
  console.log(`  ✓ ${rel}: 이야기 ${sc}자, 개념 ${chars}자, 예제 ${examples}, 위젯 ${widgets}, 용어 ${L.terms.length}, 문제 ${L.practice.length}`);
}

function checkUnit(f, U) {
  const rel = path.relative(ROOT, f);
  for (const k of ["id", "why", "opening", "test", "future"]) if (U[k] == null) return err(rel, `필드 누락: ${k}`);
  for (const k of ["why", "opening", "future"]) { checkText(rel, `${k}.title`, U[k].title); (U[k].paragraphs || []).forEach((t, i) => checkText(rel, `${k}[${i}]`, t)); }
  (U.stories || []).forEach((s, si) => { checkText(rel, `stories[${si}].title`, s.title); (s.paragraphs || []).forEach((t, i) => checkText(rel, `stories[${si}][${i}]`, t)); if ((s.paragraphs || []).length < 5) warn(rel, `stories[${si}] 문단 ${(s.paragraphs || []).length}개(5개 이상 권장)`); });
  if ((U.stories || []).length < 3) warn(rel, `시작 전 이야기(stories) ${(U.stories || []).length}편(3편 이상 권장)`);
  if (U.why.paragraphs.length < 2) warn(rel, "why 문단 2개 이상 권장");
  if (U.opening.paragraphs.length < 4) warn(rel, `opening 문단 ${U.opening.paragraphs.length}개(4개 이상 권장)`);
  if (U.future.paragraphs.length < 3) warn(rel, `future 문단 ${U.future.paragraphs.length}개(3개 이상 권장)`);
  const ids = new Set();
  U.test.forEach((q, i) => checkQuestion(rel, q, i, ids));
  if (U.test.length < 15) warn(rel, `대단원 종합 ${U.test.length}문제(15개 이상 권장)`);
  if (U.test.filter((q) => q.type === "open").length > 3) warn(rel, "서술형(open)은 3개 이하 권장");
  console.log(`  ✓ ${rel}: 종합 문제 ${U.test.length}`);
}

const units = JSON.parse(fs.readFileSync(path.join(ROOT, "units.json"), "utf8"));
const files = [];
function walk(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) fs.readdirSync(p).forEach((n) => walk(path.join(p, n)));
  else if (p.endsWith(".json") && !p.endsWith("units.json")) files.push(p);
}
(targets.length ? targets.map((t) => path.resolve(t)) : [ROOT]).forEach(walk);
files.sort();
const seenLessons = new Set();
for (const f of files) {
  let J;
  try { J = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { err(path.relative(ROOT, f), `JSON 문법 오류: ${e.message}`); continue; }
  if (path.basename(f) === "unit.json") checkUnit(f, J);
  else if (/^lesson-\d+\.json$/.test(path.basename(f))) {
    const meta = units.find((u) => u.id === J.unit);
    if (!meta) { err(path.relative(ROOT, f), `unit ${J.unit} 이 units.json 에 없음`); continue; }
    if (seenLessons.has(J.id)) err(path.relative(ROOT, f), `레슨 id 중복 ${J.id}`); seenLessons.add(J.id);
    checkLesson(f, J, meta);
  } else warn(path.relative(ROOT, f), "알 수 없는 파일 이름(unit.json, lesson-N.json 만 사용)");
}
if (!targets.length) {
  for (const u of units) {
    if (!fs.existsSync(path.join(ROOT, `u${u.id}`, "unit.json"))) warn(`u${u.id}`, "unit.json 없음");
    for (const l of u.lessons) if (!seenLessons.has(l.id)) warn(l.id, "레슨 파일 없음");
  }
}
console.log(`\n파일 ${files.length}개 검사 · 오류 ${errors} · 경고 ${warns}`);
process.exit(errors ? 1 : 0);
