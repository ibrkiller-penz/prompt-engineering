#!/usr/bin/env node
// data/plan.json 초안을 만들어요(npm run gen:plan). 원본 콘텐츠(content/aibasic)는 읽기만 해요.
//
// 레슨마다 만드는 것
//   secOf          문제 id → 소제목(계단) 번호 태그(내용 기준). 계단 확인 문제는 이름의 '계단' 번호가 그대로 소제목이에요.
//                  마무리 퀴즈는 문제 글(제시문·본문·보기·풀이)과 소제목 글의 두 글자 묶음을 TF-IDF 로 견줘 가장 가까운 소제목을 골라요.
//                  기본 규칙(pick.logic baseSections)과 다른 것만 적어요.
//   sectionOf      secOf 를 덧씌운 최종 문제 → 소제목 번호(학생 오답노트·교사 문제 고르기 공용)
//   periods        레슨당 1~2차시(26레슨 → 계단이 5개 이상이면 2차시로 분량이 고르게 절반씩, 4개 이하면 1차시)
//   periods[].question  2차시 레슨의 차시별 핵심 질문(1~2줄). 첫 물음표를 기준으로 나눠요
//   sectionChecks  소제목 i 끝에서 푸는 확인 문제(그 소제목으로 태그된 개념 확인 문제, 소제목마다 최대 2개).
//                  개념 확인이 없는 소제목은 그 소제목의 가장 쉬운 기초 문제(난이도 2 이하·선택형·OX 먼저) 1개로,
//                  기초도 없으면 그 소제목으로 태그된 쉬운 응용 → 실력 UP 1개로 채워요.
//   summaryOf      정리 줄 i → 소제목 번호(차시별 '오늘 정리'를 나눌 때). 같은 TF-IDF 로 정하고 차례가 거꾸로 가지 않게 다듬어요
//   corePath       학생 계단 문제 기본 길 8~10개(끝 확인 문제와 겹치지 않게, 유형마다 돌아가며 쉬운 것부터 + 쉬운 응용 1)
//   board·exit·hw  칠판 5~8 · 수업 끝 확인 3 · 숙제 5(교사 문제 고르기 pick.logic 과 같은 규칙, 레슨 전체 기준)
//   periods[].board·exit·hw  2차시 레슨은 차시별로도 골라 둬요(그 차시 소제목 문제만)
//
// 사람이 다듬은 것은 keep 으로 남겨요.
//   "keep": true                         레슨 전체를 그대로
//   "keep": ["sectionChecks", "secOf", "summaryOf", "question"]   적힌 필드만 그대로(question = periods[].question).
//                                         나머지 필드는 남긴 값을 바탕으로 다시 만들어요.
// 쓰는 법: node scripts/gen-plan.mjs [--check]   (--check: 파일을 쓰지 않고 지금 파일과 같은지만 확인, 다르면 종료 코드 1)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_DIR } from "../tools/content-index.mjs";
import { baseSections, pickAll, questionSections, qKind } from "../src/teacher/logic/pick.logic.ts";
import { sectionWeights, splitSections } from "../src/teacher/logic/periods.logic.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const CONTENT = CONTENT_DIR;
const OUT = path.join(ROOT, "data/plan.json");

/** 소제목(계단)이 이 수 이상이면 2차시 */
export const TWO_PERIOD_MIN_SECTIONS = 5;
/** 한 차시 분량(분). 2차시 레슨은 합이 90분이라 70분 수업에서도 한 차시로 합치지 않아요 */
export const PERIOD_MIN = 45;
export const CHECKS_PER_SECTION = 2;
export const CORE_MIN = 8;
export const CORE_MAX = 10;
const CORE_TARGET = 9;

const typeRank = (q, pref) => {
  const i = pref.indexOf(q.type);
  return i < 0 ? pref.length : i;
};

/* ─────────── 내용 기준 태그(TF-IDF) ─────────── */

function strs(x, out) {
  if (typeof x === "string") out.push(x);
  else if (Array.isArray(x)) for (const y of x) strs(y, out);
  else if (x && typeof x === "object") for (const k of Object.keys(x)) if (k !== "t" && k !== "id" && k !== "widget") strs(x[k], out);
  return out;
}
/** 글 → 낱말 조각: 한글은 두 글자 묶음, 영문은 낱말 */
export function tokens(s) {
  const out = [];
  const t = s.replace(/[^가-힣A-Za-z0-9]+/g, " ");
  for (const w of t.split(" ")) {
    if (!w) continue;
    if (/^[A-Za-z]+$/.test(w)) {
      if (w.length > 1) out.push(w.toLowerCase());
      continue;
    }
    for (let i = 0; i + 2 <= w.length; i++) out.push(w.slice(i, i + 2));
  }
  return out;
}
function tf(text) {
  const m = {};
  for (const t of tokens(text)) m[t] = (m[t] || 0) + 1;
  return m;
}
/** 레슨 소제목마다 글 모음을 만들고, 아무 글에 대해 소제목별 점수 배열을 돌려주는 함수 */
export function sectionScorer(lesson) {
  const docs = lesson.sections.map((s) => tf(strs([s.heading, s.heading, s.blocks], []).join(" ")));
  const S = docs.length;
  const df = {};
  for (const d of docs) for (const t of Object.keys(d)) df[t] = (df[t] || 0) + 1;
  return (text) => {
    const q = tf(text);
    return docs.map((d) => {
      let sc = 0;
      for (const t of Object.keys(q)) if (d[t]) sc += Math.min(q[t], 3) * Math.log((S + 1) / df[t]) * Math.log(1 + d[t]);
      return sc;
    });
  };
}
const argmax = (a) => {
  let k = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[k]) k = i;
  return k;
};
const qText = (q) => strs([q.passage || [], q.prompt, q.choices || [], q.hints || [], q.solution || ""], []).join(" ");

/** 문제 → 소제목 태그(내용 기준). 기초력 UP 은 유형 단위로 점수를 더해 정해요. 점수가 0 이면 기본 규칙(없으면 마지막 소제목) */
export function contentSections(lesson) {
  const base = baseSections(lesson);
  const score = sectionScorer(lesson);
  const S = lesson.sections.length;
  const out = {};
  const per = {};
  for (const q of lesson.practice) per[q.id] = score(qText(q));
  for (const q of lesson.practice) {
    // 계단 확인은 이름의 계단 번호가 곧 소제목이에요
    if (qKind(q) === "check" && base[q.id] >= 0) {
      out[q.id] = base[q.id];
      continue;
    }
    const sc = per[q.id];
    const best = Math.max(...sc) > 0 ? argmax(sc) : base[q.id] >= 0 ? base[q.id] : S - 1;
    out[q.id] = best;
  }
  return out;
}

/** 기본 규칙과 다른 태그만(plan.secOf) */
export function makeSecOf(lesson) {
  const base = baseSections(lesson);
  const tags = contentSections(lesson);
  const out = {};
  for (const q of lesson.practice) if (tags[q.id] !== base[q.id]) out[q.id] = tags[q.id];
  return out;
}

/** 정리 줄 → 소제목. 내용 점수의 합이 가장 크면서 앞 줄보다 앞 소제목으로 돌아가지 않는 차례(동적 계획법)로 정해요 */
export function makeSummaryOf(lesson) {
  const score = sectionScorer(lesson);
  const lines = lesson.summary || [];
  const S = lesson.sections.length;
  if (!lines.length) return [];
  const sc = lines.map((l) => {
    const v = score(l);
    const mx = Math.max(...v);
    return v.map((x) => (mx > 0 ? x / mx : 0));
  });
  // dp[i][k]: i 번째 줄까지 보고 i 줄이 소제목 k 일 때 최고 점수
  const dp = sc.map(() => new Array(S).fill(-Infinity));
  const from = sc.map(() => new Array(S).fill(0));
  for (let k = 0; k < S; k++) dp[0][k] = sc[0][k];
  for (let i = 1; i < sc.length; i++) {
    let best = -Infinity;
    let bk = 0;
    for (let k = 0; k < S; k++) {
      if (dp[i - 1][k] > best) {
        best = dp[i - 1][k];
        bk = k;
      }
      dp[i][k] = best + sc[i][k] + 1e-6 * (k === bk ? 1 : 0);
      from[i][k] = bk;
    }
  }
  let k = dp[sc.length - 1].reduce((bk, v, i, a) => (v > a[bk] ? i : bk), 0);
  const out = new Array(sc.length);
  for (let i = sc.length - 1; i >= 0; i--) {
    out[i] = k;
    k = from[i][k];
  }
  return out;
}

/** 차시별 핵심 질문: 첫 물음표에서 나눠 1차시 = 앞, 2차시 = 나머지. 나눌 수 없으면 null */
export function splitQuestion(q, n) {
  if (n < 2) return null;
  const parts = [];
  const re = /[^?？]*[?？]/g;
  let m;
  let last = 0;
  while ((m = re.exec(q))) {
    if (m[0].trim()) parts.push(m[0].trim());
    last = re.lastIndex;
  }
  const tail = q.slice(last).trim();
  if (tail) parts.push(tail);
  if (parts.length < 2) return null;
  const out = [parts[0]];
  const rest = parts.slice(1).join(" ").replace(/^(그리고|또|또한)\s+/, "");
  out.push(rest);
  while (out.length < n) out.push(rest);
  return out.slice(0, n);
}

/** 소제목 끝 확인 문제 */
export function makeSectionChecks(lesson, secOf) {
  const S = lesson.sections.length;
  const order = {};
  lesson.practice.forEach((q, i) => (order[q.id] = i));
  const out = [];
  for (let i = 0; i < S; i++) {
    const checks = lesson.practice
      .filter((q) => qKind(q) === "check" && q.type !== "open" && secOf[q.id] === i)
      .sort((a, b) => order[a.id] - order[b.id]);
    let picked = checks.slice(0, CHECKS_PER_SECTION);
    if (!picked.length) {
      const basic = lesson.practice
        .filter((q) => qKind(q) === "basic" && q.type !== "open" && secOf[q.id] === i)
        .sort((a, b) => typeRank(a, ["choice", "ox", "number"]) - typeRank(b, ["choice", "ox", "number"]) || a.level - b.level || order[a.id] - order[b.id]);
      // 쉬운 것(난이도 2 이하)을 먼저, 없으면 그 소제목에서 가장 쉬운 것
      const easyFirst = basic.filter((q) => q.level <= 2);
      picked = (easyFirst.length ? easyFirst : basic.slice().sort((a, b) => a.level - b.level || order[a.id] - order[b.id])).slice(0, 1);
    }
    if (!picked.length) {
      // 기초도 없으면 그 소제목으로 태그된 쉬운 응용 → 실력 UP 가운데 가장 쉬운 것(선택형·OX 먼저)
      const rank = { easy: 0, adv: 1, chal: 2 };
      picked = lesson.practice
        .filter((q) => q.type !== "open" && secOf[q.id] === i && rank[qKind(q)] !== undefined)
        .sort(
          (a, b) =>
            rank[qKind(a)] - rank[qKind(b)] ||
            typeRank(a, ["choice", "ox", "number"]) - typeRank(b, ["choice", "ox", "number"]) ||
            a.level - b.level ||
            order[a.id] - order[b.id],
        )
        .slice(0, 1);
    }
    out.push(picked.map((q) => q.id));
  }
  return out;
}

/** 학생 계단 문제 기본 길 */
export function makeCorePath(lesson, exclude) {
  const order = {};
  lesson.practice.forEach((q, i) => (order[q.id] = i));
  const free = lesson.practice.filter((q) => q.type !== "open" && exclude.indexOf(q.id) < 0);
  const easy = free
    .filter((q) => qKind(q) === "easy")
    .sort((a, b) => a.level - b.level || order[a.id] - order[b.id])[0];
  const groups = [];
  const byGroup = {};
  for (const q of free) {
    if (qKind(q) !== "basic") continue;
    if (!byGroup[q.group]) {
      byGroup[q.group] = [];
      groups.push(q.group);
    }
    byGroup[q.group].push(q);
  }
  for (const g of groups) byGroup[g].sort((a, b) => a.level - b.level || order[a.id] - order[b.id]);
  const basicTarget = (easy ? CORE_TARGET - 1 : CORE_TARGET);
  const out = [];
  for (let round = 0; out.length < basicTarget && groups.some((g) => byGroup[g].length > round); round++) {
    for (const g of groups) {
      if (out.length >= basicTarget) break;
      const q = byGroup[g][round];
      if (q) out.push(q.id);
    }
  }
  // 기초가 모자라면 남은 개념 확인·쉬운 응용(나온 순서) → 실력 UP(쉬운 것부터)으로 채워요(8개까지)
  if (out.length + (easy ? 1 : 0) < CORE_MIN) {
    const kr = { check: 0, easy: 1, adv: 2 };
    const fill = free
      .filter((q) => out.indexOf(q.id) < 0 && (!easy || q.id !== easy.id) && kr[qKind(q)] !== undefined)
      .sort((a, b) => (kr[qKind(a)] >> 1) - (kr[qKind(b)] >> 1) || (qKind(a) === "adv" ? a.level - b.level : 0) || order[a.id] - order[b.id]);
    for (const q of fill) {
      if (out.length + (easy ? 1 : 0) >= CORE_MIN) break;
      out.push(q.id);
    }
  }
  out.sort((a, b) => order[a] - order[b]);
  if (easy) out.push(easy.id);
  return out.slice(0, CORE_MAX);
}

/** 차시 */
export function makePeriods(lesson, partial, questions) {
  const S = lesson.sections.length;
  const n = S >= TWO_PERIOD_MIN_SECTIONS ? 2 : 1;
  let groups = n === 1 ? [lesson.sections.map((_, i) => i)] : splitSections(sectionWeights(lesson), 2);
  // 한 차시에 소제목이 하나뿐이면 문제가 모자라서, 그럴 때는 소제목 개수로 반씩 나눠요
  if (groups.some((g) => g.length < 2)) {
    const idx = lesson.sections.map((_, i) => i);
    const half = Math.ceil(idx.length / 2);
    groups = [idx.slice(0, half), idx.slice(half)];
  }
  const per = PERIOD_MIN;
  const qs = questions || splitQuestion(lesson.question || "", n);
  return groups.map((sections, i) => {
    const pp = { p: i + 1, sections, minutes: per };
    if (n > 1 && qs && qs[i]) pp.question = qs[i];
    if (n > 1) {
      const set = pickAll(lesson, partial, { p: i + 1, n, sections, plan: undefined });
      pp.board = set.board;
      pp.exit = set.exit;
      pp.hw = set.hw;
    }
    return pp;
  });
}

export const KEEP_FIELDS = ["sectionChecks", "secOf", "summaryOf", "question"];

/** 레슨 하나의 plan. old 의 keep 배열에 적힌 필드는 old 값을 그대로 써요 */
export function planLesson(lesson, old) {
  const keep = old && Array.isArray(old.keep) ? old.keep.filter((k) => KEEP_FIELDS.indexOf(k) >= 0) : [];
  const kept = (k) => keep.indexOf(k) >= 0;
  const tags = kept("secOf") && old.secOf ? old.secOf : makeSecOf(lesson);
  const secOf = questionSections(lesson, { secOf: tags });
  const sectionChecks = kept("sectionChecks") && old.sectionChecks ? old.sectionChecks : makeSectionChecks(lesson, secOf);
  const summaryOf = kept("summaryOf") && old.summaryOf ? old.summaryOf : makeSummaryOf(lesson);
  const flat = [].concat(...sectionChecks);
  const corePath = makeCorePath(lesson, flat);
  const partial = { lid: lesson.id, sectionChecks, corePath, board: [], exit: [], hw: [], periods: [], secOf: tags };
  const whole = pickAll(lesson, partial, null);
  const oldQs = kept("question") && old.periods ? old.periods.map((pp) => pp.question) : null;
  const out = {
    lid: lesson.id,
    sectionChecks,
    corePath,
    board: whole.board,
    exit: whole.exit,
    hw: whole.hw,
    periods: makePeriods(lesson, partial, oldQs && oldQs.some((x) => x) ? oldQs : null),
    summaryOf,
    secOf: tags,
    sectionOf: secOf,
  };
  return keep.length ? Object.assign({ lid: out.lid, keep }, out) : out;
}

function readLessons() {
  const units = JSON.parse(readFileSync(path.join(CONTENT, "units.json"), "utf8"));
  const byId = {};
  for (const d of readdirSync(CONTENT)) {
    if (!/^u\d+$/.test(d)) continue;
    for (const f of readdirSync(path.join(CONTENT, d))) {
      if (!/^lesson-[0-9A-Za-z_]+\.json$/.test(f)) continue;
      const l = JSON.parse(readFileSync(path.join(CONTENT, d, f), "utf8"));
      byId[l.id] = l;
    }
  }
  const out = [];
  for (const u of units) for (const x of u.lessons) if (byId[x.id]) out.push(byId[x.id]);
  return out;
}

export function buildPlan(prev) {
  const lessons = {};
  for (const l of readLessons()) {
    const old = prev && prev.lessons ? prev.lessons[l.id] : undefined;
    lessons[l.id] = old && old.keep === true ? old : planLesson(l, old);
  }
  return { v: 1, lessons };
}

/** 사람이 읽기 쉬운 JSON(짧은 배열은 한 줄) */
export function stringifyPlan(plan) {
  const s = JSON.stringify(plan, null, 2);
  return s.replace(/\[\s+([^\[\]{}]*?)\s+\]/g, (_m, inner) => "[" + inner.split(/,\s+/).join(", ") + "]") + "\n";
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const prev = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const text = stringifyPlan(buildPlan(prev));
  if (process.argv.indexOf("--check") >= 0) {
    const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (cur !== text) {
      console.error("data/plan.json 이 지금 콘텐츠로 만든 초안과 달라요. npm run gen:plan 으로 다시 만들어요(사람이 고친 레슨은 keep: true).");
      process.exit(1);
    }
    console.log("plan.json 이 최신이에요.");
  } else {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, text);
    const n = Object.keys(JSON.parse(text).lessons).length;
    console.log("data/plan.json 을 만들었어요(레슨 " + n + "개).");
  }
}
