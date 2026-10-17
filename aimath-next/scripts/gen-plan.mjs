#!/usr/bin/env node
// data/plan.json 초안을 만들어요(npm run gen:plan). 원본 콘텐츠(content/aimath)는 읽기만 해요.
//
// 레슨마다 만드는 것
//   periods        원본 minutes 가 50분을 넘으면 2차시(소제목을 분량이 고르게 절반씩), 아니면 1차시
//   sectionChecks  소제목 i 끝에서 푸는 확인 문제(개념 확인 문제를 나온 순서대로 소제목에 나눔, 소제목마다 최대 2개).
//                  개념 확인이 모자란 소제목은 그 소제목의 가장 쉬운 기초 문제(난이도 2 이하·선택형·OX 먼저) 1개로 채워요.
//   sectionOf      문제 id → 소제목 번호(레슨 전체 문제는 -1) — 교사 문제 고르기와 같은 규칙
//   corePath       학생 계단 문제 기본 길 8~10개(끝 확인 문제와 겹치지 않게, 유형마다 돌아가며 쉬운 것부터 + 쉬운 응용 1)
//   board·exit·hw  칠판 5~8 · 수업 끝 확인 3 · 숙제 5(교사 문제 고르기 pick.logic 과 같은 규칙, 레슨 전체 기준)
//   periods[].board·exit·hw  2차시 레슨은 차시별로도 골라 둬요
//
// 사람이 다듬은 레슨은 "keep": true 를 붙여 두면 다시 만들 때 그대로 남겨요.
// 쓰는 법: node scripts/gen-plan.mjs [--check]   (--check: 파일을 쓰지 않고 지금 파일과 같은지만 확인, 다르면 종료 코드 1)
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickAll, questionSections, qKind } from "../src/teacher/logic/pick.logic.ts";
import { sectionWeights, splitSections } from "../src/teacher/logic/periods.logic.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const CONTENT = path.resolve(ROOT, "../content/aimath");
const OUT = path.join(ROOT, "data/plan.json");

export const TWO_PERIOD_OVER = 50; // 원본 분량이 이 분을 넘으면 2차시
export const CHECKS_PER_SECTION = 2;
export const CORE_MIN = 8;
export const CORE_MAX = 10;
const CORE_TARGET = 9;

const typeRank = (q, pref) => {
  const i = pref.indexOf(q.type);
  return i < 0 ? pref.length : i;
};

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
  // 기초가 모자라면 남은 개념 확인 → 쉬운 응용 순으로 채워요(8개까지)
  if (out.length + (easy ? 1 : 0) < CORE_MIN) {
    const fill = free
      .filter((q) => out.indexOf(q.id) < 0 && (!easy || q.id !== easy.id) && (qKind(q) === "check" || qKind(q) === "easy"))
      .sort((a, b) => order[a.id] - order[b.id]);
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
export function makePeriods(lesson) {
  const S = lesson.sections.length;
  const n = lesson.minutes > TWO_PERIOD_OVER && S >= 2 ? 2 : 1;
  const groups = n === 1 ? [lesson.sections.map((_, i) => i)] : splitSections(sectionWeights(lesson), 2);
  const per = Math.round(lesson.minutes / n);
  return groups.map((sections, i) => {
    const pp = { p: i + 1, sections, minutes: per };
    if (n > 1) {
      const set = pickAll(lesson, null, { p: i + 1, n, sections, plan: undefined });
      pp.board = set.board;
      pp.exit = set.exit;
      pp.hw = set.hw;
    }
    return pp;
  });
}

export function planLesson(lesson) {
  const secOf = questionSections(lesson);
  const sectionChecks = makeSectionChecks(lesson, secOf);
  const flat = [].concat(...sectionChecks);
  const corePath = makeCorePath(lesson, flat);
  const whole = pickAll(lesson, null, null);
  return {
    lid: lesson.id,
    sectionChecks,
    corePath,
    board: whole.board,
    exit: whole.exit,
    hw: whole.hw,
    periods: makePeriods(lesson),
    sectionOf: secOf,
  };
}

function readLessons() {
  const units = JSON.parse(readFileSync(path.join(CONTENT, "units.json"), "utf8"));
  const byId = {};
  for (const d of readdirSync(CONTENT)) {
    if (!/^u\d+$/.test(d)) continue;
    for (const f of readdirSync(path.join(CONTENT, d))) {
      if (!/^lesson-\d+\.json$/.test(f)) continue;
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
    lessons[l.id] = old && old.keep ? old : planLesson(l);
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
