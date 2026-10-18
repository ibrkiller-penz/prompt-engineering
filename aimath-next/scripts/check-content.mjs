#!/usr/bin/env node
// 콘텐츠·보조 데이터 검사. 원본 content/aimath 는 읽기만 해요.
//  1) 20레슨·5단원이 units.json 순서대로 모두 있는지(tools/content-index.mjs 로 읽어요)
//  2) 체험 도구가 옛 types.ts 의 WidgetId 와 같은 17종인지, 레슨이 쓰는 도구가 그 안에 있는지
//  3) data/plan.json: 레슨·문제 id·소제목 번호가 실제로 있는지
//  4) data/widget-guides.json: 17종 모두 predict·steps[3]·ask·reveal·mission{text,judge}
//  5) data/characters.json: 이야기에 나오는 인물이 모두 있는지
//  6) data/overrides/tone.json: where·path 가 실제로 있고, from(또는 match) 문장이 그 자리에 정확히 있는지
//  7) data/teacher/prep/u1..u5.json: 그 단원의 레슨만, 필수 항목(목표·발문 3개·막히는 곳·오개념·준비물)
//  8) 출판사 이름·교과서 쪽수 같은 금지어가 data/ 와 src/ 에 없는지
//  9) 해요체: 20레슨 문제(practice)·단원 마무리(test)의 prompt·choices·hints·solution 에
//     덧씌우기(tone.json 정확 일치 + src/content/tone.ts 규칙)를 거친 뒤 '한다.' '는가?' '인가?' '이다.' '하시오' 가 0건인지
//     (수식 $…$ · 따옴표 안 · 코드 안은 빼요). 정답(answer)·종류·보기 개수가 그대로인지도 봐요.
// 10) 화면 문구 띄어쓰기: 영문·숫자(또는 } · </b>) 뒤에 ' 로/을/를/에서/으로' 를 띄어 쓴 곳이 src/ 와 data/ 에 없는지(주석은 빼요)
// 하나라도 어긋나면 1로 끝나요. 사용: node scripts/check-content.mjs [--verbose]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentIndex } from "../tools/content-index.mjs";
import { applyTone, haeyoDoc, haeraLeft } from "../src/content/tone.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(ROOT, "..");
const VERBOSE = process.argv.includes("--verbose");

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const rel = (f) => path.relative(ROOT, f);

/* ───── 1) 콘텐츠 색인 ───── */
let built;
try {
  built = buildContentIndex();
} catch (e) {
  console.error("✗ 콘텐츠를 읽지 못했어요: " + (e && e.message));
  process.exit(1);
}
const { index, lessons, unitDocs } = built;
if (index.units.length !== 5) err(`단원이 5개가 아니에요: ${index.units.length}`);
if (index.order.length !== 20) err(`레슨이 20개가 아니에요: ${index.order.length}`);
for (const u of index.units) {
  if (!u.lessonIds.length) err(`단원 ${u.slug} 에 레슨이 없어요`);
  for (const lid of u.lessonIds) {
    const L = index.lessons[lid];
    if (!L.sections.length) err(`${lid}: 소제목(sections)이 없어요`);
    if (!L.basicIds.length) err(`${lid}: 기본 문제가 없어요(완료 기준을 셀 수 없어요)`);
  }
}

/* ───── 2) 체험 도구 17종 ───── */
const legacyTypes = fs.readFileSync(path.join(REPO, "src/aimath/types.ts"), "utf8");
const m = legacyTypes.match(/export type WidgetId\s*=([\s\S]*?);/);
const LEGACY_WIDGETS = m ? Array.from(m[1].matchAll(/"([a-z0-9]+)"/g)).map((x) => x[1]) : [];
if (LEGACY_WIDGETS.length !== 17) err(`옛 types.ts 의 WidgetId 가 17종이 아니에요: ${LEGACY_WIDGETS.length}`);
const idsSrc = fs.readFileSync(path.join(ROOT, "src/shared/widgets/ids.ts"), "utf8");
const im = idsSrc.match(/WIDGET_IDS[^=]*=\s*\[([\s\S]*?)\]/);
const NEW_WIDGETS = im ? Array.from(im[1].matchAll(/"([a-z0-9]+)"/g)).map((x) => x[1]) : [];
if (NEW_WIDGETS.join(",") !== LEGACY_WIDGETS.join(",")) err(`src/shared/widgets/ids.ts 의 WIDGET_IDS 가 옛 WidgetId 와 달라요`);
for (const w of NEW_WIDGETS) {
  const dir = path.join(ROOT, "src/shared/widgets", w);
  if (!fs.existsSync(path.join(dir, "index.tsx"))) err(`체험 도구 화면이 없어요: src/shared/widgets/${w}/index.tsx`);
  if (!fs.existsSync(path.join(dir, "mission.ts"))) err(`체험 도구 미션 판정이 없어요: src/shared/widgets/${w}/mission.ts`);
}
for (const w of index.widgets) if (LEGACY_WIDGETS.indexOf(w) < 0) err(`레슨이 모르는 체험 도구를 써요: ${w}`);

/* 문제 id → 레슨/단원 */
const qOwner = {};
for (const lid of index.order) for (const q of lessons[lid].practice) qOwner[q.id] = lid;
for (const u of index.units) for (const q of unitDocs[u.id].test) qOwner[q.id] = u.slug;

/* ───── 3) plan.json ───── */
const planFile = path.join(ROOT, "data/plan.json");
if (!fs.existsSync(planFile)) err("data/plan.json 이 없어요(npm run gen:plan)");
else {
  const plan = readJson(planFile);
  const pl = plan.lessons || {};
  for (const lid of index.order) if (!pl[lid]) err(`plan.json 에 레슨이 없어요: ${lid}`);
  for (const lid of Object.keys(pl)) {
    const L = index.lessons[lid];
    if (!L) {
      err(`plan.json 에 모르는 레슨이 있어요: ${lid}`);
      continue;
    }
    const P = pl[lid];
    const nSec = L.sections.length;
    const checkQ = (q, where) => {
      if (qOwner[q] !== lid) err(`plan.json ${lid}.${where}: 이 레슨에 없는 문제 id ${q}`);
    };
    if (!Array.isArray(P.sectionChecks) || P.sectionChecks.length !== nSec)
      err(`plan.json ${lid}.sectionChecks 수(${P.sectionChecks && P.sectionChecks.length})가 소제목 수(${nSec})와 달라요`);
    (P.sectionChecks || []).forEach((arr, i) => (arr || []).forEach((q) => checkQ(q, `sectionChecks[${i}]`)));
    for (const k of ["corePath", "board", "exit", "hw"]) {
      if (!Array.isArray(P[k])) err(`plan.json ${lid}.${k} 가 배열이 아니에요`);
      else P[k].forEach((q) => checkQ(q, k));
    }
    if (Array.isArray(P.board) && (P.board.length < 5 || P.board.length > 8)) warn(`plan.json ${lid}.board 가 ${P.board.length}문제예요(5~8 권장)`);
    if (!Array.isArray(P.periods) || !P.periods.length) err(`plan.json ${lid}.periods 가 비어 있어요`);
    else {
      const covered = new Set();
      P.periods.forEach((pp, i) => {
        if (pp.p !== i + 1) err(`plan.json ${lid}.periods[${i}].p 가 ${i + 1} 이 아니에요`);
        (pp.sections || []).forEach((s) => {
          if (!(s >= 0 && s < nSec)) err(`plan.json ${lid}.periods[${i}] 소제목 번호 ${s} 가 없어요(0~${nSec - 1})`);
          covered.add(s);
        });
        for (const k of ["board", "exit", "hw"]) (pp[k] || []).forEach((q) => checkQ(q, `periods[${i}].${k}`));
        if (!(pp.minutes > 0)) err(`plan.json ${lid}.periods[${i}].minutes 가 없어요`);
      });
      for (let s = 0; s < nSec; s++) if (!covered.has(s)) err(`plan.json ${lid}: 소제목 ${s} 가 어느 차시에도 없어요`);
    }
    if (P.sectionOf)
      for (const [q, s] of Object.entries(P.sectionOf)) {
        checkQ(q, "sectionOf");
        if (!(s === -1 || (s >= 0 && s < nSec))) err(`plan.json ${lid}.sectionOf[${q}] = ${s} 는 없는 소제목이에요`);
      }
  }
}

/* ───── 4) widget-guides.json ───── */
const guidesFile = path.join(ROOT, "data/widget-guides.json");
if (!fs.existsSync(guidesFile)) err("data/widget-guides.json 이 없어요");
else {
  const g = readJson(guidesFile);
  for (const w of LEGACY_WIDGETS) {
    const G = g[w];
    if (!G) {
      err(`widget-guides.json 에 ${w} 가 없어요`);
      continue;
    }
    for (const k of ["title", "predict", "ask", "reveal"]) if (typeof G[k] !== "string" || !G[k].trim()) err(`widget-guides.json ${w}.${k} 가 비어 있어요`);
    if (!Array.isArray(G.steps) || G.steps.length !== 3) err(`widget-guides.json ${w}.steps 는 3줄이어야 해요`);
    if (!G.mission || !G.mission.text || !G.mission.judge) err(`widget-guides.json ${w}.mission{text,judge} 가 비어 있어요`);
  }
  for (const k of Object.keys(g)) if (LEGACY_WIDGETS.indexOf(k) < 0) err(`widget-guides.json 에 모르는 도구가 있어요: ${k}`);
}

/* ───── 5) characters.json ───── */
const charFile = path.join(ROOT, "data/characters.json");
if (!fs.existsSync(charFile)) err("data/characters.json 이 없어요");
else {
  const chars = readJson(charFile);
  const who = new Set();
  const collect = (arr) => (arr || []).forEach((s) => s && typeof s === "object" && s.who && who.add(s.who));
  for (const lid of index.order) collect(lessons[lid].story);
  for (const u of index.units) (unitDocs[u.id].stories || []).forEach((st) => collect(st && (st.lines || st.story || st.paragraphs)));
// 이야기 삽화: 문단 번호 범위·설명 글·파일(저장소 public/ 아래)이 있어야 해요
for (const u of index.units) {
  const d = unitDocs[u.id];
  const imgCheck = (label, imgs, n) =>
    (imgs || []).forEach((im, k) => {
      if (!Number.isInteger(im.after) || im.after < 0 || im.after >= n) err(`${u.slug} ${label}.images[${k}].after 가 문단 범위(0~${n - 1}) 밖`);
      if (!im.alt) err(`${u.slug} ${label}.images[${k}].alt 없음`);
      if (!im.src || !fs.existsSync(path.join(REPO, "public", String(im.src).replace(/^\//, "")))) err(`${u.slug} ${label}.images[${k}] 파일 없음: ${im.src}`);
    });
  imgCheck("opening", d.opening && d.opening.images, d.opening ? d.opening.paragraphs.length : 0);
  (d.stories || []).forEach((st, si) => imgCheck(`stories[${si}]`, st.images, (st.paragraphs || []).length));
}
  for (const w of who) if (!chars[w]) err(`characters.json 에 이야기 인물이 없어요: ${w}`);
  for (const [k, c] of Object.entries(chars)) if (!c.name || !c.line || !c.color) err(`characters.json ${k}: name·line·color 가 필요해요`);
}

/* ───── 6) overrides/tone.json ───── */
const toneFile = path.join(ROOT, "data/overrides/tone.json");
function docOf(where) {
  if (lessons[where]) return lessons[where];
  const u = index.units.find((x) => x.slug === where);
  return u ? unitDocs[u.id] : null;
}
function atPath(doc, p) {
  let cur = doc;
  for (const part of String(p).split(".")) {
    if (cur == null) return undefined;
    cur = cur[/^\d+$/.test(part) ? Number(part) : part];
  }
  return cur;
}
if (fs.existsSync(toneFile)) {
  const tone = readJson(toneFile);
  const seen = new Set();
  (tone.replace || []).forEach((r, i) => {
    const doc = docOf(r.where);
    if (!doc) return err(`tone.json replace[${i}]: 모르는 where ${r.where}`);
    const v = atPath(doc, r.path);
    if (typeof v !== "string") return err(`tone.json replace[${i}]: ${r.where} ${r.path} 에 글이 없어요`);
    if (!r.from || v.indexOf(r.from) < 0) err(`tone.json replace[${i}]: ${r.where} ${r.path} 에 원문이 정확히 없어요: ${String(r.from).slice(0, 40)}`);
    if (!r.to || r.to === r.from) err(`tone.json replace[${i}]: 바꿀 문장(to)이 비었거나 원문과 같아요`);
    const key = r.where + "|" + r.path + "|" + r.from;
    if (seen.has(key)) warn(`tone.json replace[${i}]: 같은 치환이 두 번 있어요`);
    seen.add(key);
  });
  (tone.chips || []).forEach((c, i) => {
    const doc = docOf(c.where);
    const v = doc ? atPath(doc, c.path) : undefined;
    if (typeof v !== "string" || v.indexOf(c.match) < 0) err(`tone.json chips[${i}]: ${c.where} ${c.path} 에 '${c.match}' 가 없어요`);
  });
  const turing = (tone.chips || []).some((c) => /심판 30명/.test(c.match) && /가상의 예/.test(c.label));
  if (!turing) err("tone.json: 튜링 '심판 30명'에 '가상의 예' 칩이 없어요");
} else err("data/overrides/tone.json 이 없어요");

/* ───── 7) 교사 준비 자료 ───── */
for (const u of index.units) {
  const f = path.join(ROOT, `data/teacher/prep/${u.slug}.json`);
  if (!fs.existsSync(f)) {
    err(`교사 준비 자료가 없어요: ${rel(f)}`);
    continue;
  }
  const d = readJson(f);
  if (d.unit !== u.id) err(`${rel(f)}: unit 이 ${u.id} 가 아니에요`);
  for (const lid of u.lessonIds) {
    const x = d.lessons && d.lessons[lid];
    if (!x) {
      err(`${rel(f)}: 레슨 ${lid} 가 없어요`);
      continue;
    }
    if (!x.goal && !(x.goals && x.goals.length)) err(`${rel(f)} ${lid}: 목표가 없어요`);
    const asks = x.asks || (x.questions || []).map((q) => q.q);
    if (!asks || asks.length < 3) err(`${rel(f)} ${lid}: 발문이 3개보다 적어요`);
    for (const k of ["stuck", "misconceptions", "materials"]) if (!x[k] || (Array.isArray(x[k]) && !x[k].length)) err(`${rel(f)} ${lid}: ${k} 가 비어 있어요`);
  }
  for (const lid of Object.keys(d.lessons || {})) if (u.lessonIds.indexOf(lid) < 0) err(`${rel(f)}: 이 단원이 아닌 레슨 ${lid}`);
}

/* ───── 8) 출판사 금지어 ───── */
const BANNED = [
  "천재교육", "미래엔", "비상교육", "교학사", "지학사", "씨마스", "금성출판", "동아출판", "좋은책신사고", "신사고", "능률교육", "NE능률", "YBM", "와이비엠", "해냄에듀", "창비교육", "길벗",
  "교과서 p.", "교과서 쪽", "교과서 몇 쪽", "익힘책",
];
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.(json|ts|tsx|css|md|html)$/.test(e.name)) out.push(f);
  }
  return out;
}
for (const f of walk(path.join(ROOT, "data"), walk(path.join(ROOT, "src"), [path.join(ROOT, "index.html")]))) {
  const text = fs.readFileSync(f, "utf8");
  for (const b of BANNED) if (text.indexOf(b) >= 0) err(`출판사·교과서 금지어 '${b}' 가 있어요: ${rel(f)}`);
}
for (const f of built.files) {
  const text = fs.readFileSync(f, "utf8");
  for (const b of BANNED) if (text.indexOf(b) >= 0) warn(`원본 콘텐츠에 '${b}' 가 있어요(원본은 고치지 않아요): ${path.relative(REPO, f)}`);
}

/* ───── 9) 문제 본문 해요체 ───── */
{
  const tone = fs.existsSync(toneFile) ? readJson(toneFile) : null;
  const QFIELDS = ["prompt", "solution", "choices", "hints"];
  let nQ = 0;
  let nLeft = 0;
  const checkDoc = (raw, where, key) => {
    const out = haeyoDoc(applyTone(raw, where, tone));
    const before = raw[key] || [];
    const after = out[key] || [];
    if (before.length !== after.length) err(`해요체: ${where} ${key} 문제 수가 바뀌었어요`);
    before.forEach((q, i) => {
      const o = after[i];
      nQ++;
      // 정답·종류·보기 개수는 그대로여야 해요
      if (!o || o.id !== q.id || o.type !== q.type || JSON.stringify(o.answer) !== JSON.stringify(q.answer) || o.tolerance !== q.tolerance || o.unit !== q.unit)
        err(`해요체: ${q.id} 정답·종류가 바뀌었어요`);
      if (Array.isArray(q.choices) && (!o || !Array.isArray(o.choices) || o.choices.length !== q.choices.length)) err(`해요체: ${q.id} 보기 개수가 바뀌었어요`);
      for (const f of QFIELDS) {
        const v = o ? o[f] : undefined;
        const arr = Array.isArray(v) ? v : v == null ? [] : [v];
        arr.forEach((t, k) => {
          for (const hit of haeraLeft(t)) {
            nLeft++;
            err(`해요체: ${q.id} ${f}${Array.isArray(v) ? "[" + k + "]" : ""} 에 해라체가 남았어요: '${hit}' (tone.ts 규칙이나 tone.json 정확 일치로 바꿔 주세요)`);
          }
        });
      }
    });
  };
  for (const lid of index.order) checkDoc(lessons[lid], lid, "practice");
  for (const u of index.units) checkDoc(unitDocs[u.id], u.slug, "test");
  if (VERBOSE) console.log(`  · 해요체 검사: 문제 ${nQ}개, 남은 해라체 ${nLeft}건`);
}

/* ───── 10) 화면 문구 띄어쓰기(영문·숫자 뒤 조사) ───── */
// 주석을 같은 자리의 공백으로 지워요(줄 번호는 그대로). 문자열·템플릿·정규식 안의 '//' 는 주석이 아니에요.
function stripComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let prevSig = "";
  const blank = (x) => x.replace(/[^\n]/g, " ");
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      let j = src.indexOf("\n", i);
      if (j < 0) j = n;
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }
    if (c === "/" && d === "*") {
      let j = src.indexOf("*/", i + 2);
      j = j < 0 ? n : j + 2;
      out += blank(src.slice(i, j));
      i = j;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      prevSig = c;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== "`") j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      prevSig = c;
      continue;
    }
    if (c === "/" && (prevSig === "" || /[(,=:[!&|?{};+\-*%~^]/.test(prevSig) || /\b(return|typeof|case)$/.test(out.trimEnd()))) {
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== "\n") {
        if (src[j] === "\\") {
          j += 2;
          continue;
        }
        if (src[j] === "[") cls = true;
        else if (src[j] === "]") cls = false;
        else if (src[j] === "/" && !cls) break;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      prevSig = "/";
      continue;
    }
    out += c;
    if (!/\s/.test(c)) prevSig = c;
    i++;
  }
  return out;
}
{
  const SPACING = [/[A-Za-z0-9] (로|을|를|에서|으로)(?![가-힣])/, /(\}|<\/[a-z]+>) (로|을|를|에서|으로)(?![가-힣])/];
  const files = walk(path.join(ROOT, "src"), []).concat(walk(path.join(ROOT, "data"), [])).filter((f) => /\.(ts|tsx|json)$/.test(f));
  let n = 0;
  for (const f of files) {
    const raw = fs.readFileSync(f, "utf8");
    // JSON 의 tone 원문(from)·칩 찾기(match)는 원본 콘텐츠 글이라 화면에 그대로 나오지 않아요 — 빼고 봐요
    const text = /\.json$/.test(f) ? raw.replace(/"(from|match)"\s*:\s*"(?:[^"\\]|\\.)*"/g, '""') : stripComments(raw);
    text.split("\n").forEach((line, i) => {
      for (const re0 of SPACING) {
        const re = new RegExp(re0.source, "g");
        let m;
        while ((m = re.exec(line))) {
          n++;
          err(`띄어쓰기: ${rel(f)}:${i + 1} '${line.slice(Math.max(0, m.index - 12), m.index + m[0].length + 4).trim()}' — 조사는 붙여 써요(예: 'QR로', 'web.app에서')`);
        }
      }
    });
  }
  if (VERBOSE) console.log(`  · 띄어쓰기 검사: 파일 ${files.length}개, ${n}건`);
}

/* ───── 결과 ───── */
if (VERBOSE || warns.length) for (const w of warns) console.log("  ! " + w);
if (errors.length) {
  for (const e of errors) console.error("  ✗ " + e);
  console.error(`check-content: 실패 ${errors.length}건`);
  process.exit(1);
}
console.log(
  `check-content: 통과 — 단원 ${index.units.length}, 레슨 ${index.order.length}, 문제 ${index.totals.practice}+${index.totals.test}+${index.totals.diag}, 체험 도구 ${LEGACY_WIDGETS.length}종` +
    (warns.length ? `, 알림 ${warns.length}건` : ""),
);
