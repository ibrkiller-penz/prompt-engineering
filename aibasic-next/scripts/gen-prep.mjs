#!/usr/bin/env node
// data/teacher/prep/u1..u4.json(교사 준비 자료)을 원본 레슨에서 만들어요(npm run gen:prep). 원본(content/aibasic)은 읽기만 해요.
// 새로 지어낸 문장은 없어요. 모두 레슨에 있는 글에서 골라 와요.
//   goals / goal   레슨 goals(학습 목표). goalSecs 는 목표마다 가장 가까운 소제목(계단) — gen-plan 과 같은 TF-IDF
//   asks           발문 3개: 레슨의 핵심 질문 + 계단 확인 문제 두 개(가운데·끝 계단)의 물음
//   questions      발문과 예상 답(문제 해설): 핵심 질문의 이야기는 빼고 계단 확인 문제 4개
//   stuck          막히는 곳: '헷갈리는 점' 상자(callout warn)의 첫 문장, 모자라면 뒤쪽 계단 확인 문제 해설의 첫 문장
//   misconceptions 흔한 오개념: '옳지 않은 것' 마무리 퀴즈의 해설 첫 문장(최대 4), 없으면 헷갈리는 점 상자 나머지
//   materials      준비물: 전자칠판·학생 휴대폰, 코드가 있으면 파이썬 실행 환경(선택)
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_DIR } from "../tools/content-index.mjs";
import { sectionScorer } from "./gen-plan.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../data/teacher/prep");

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
const first = (s) => {
  const t = clean(s);
  const m = t.match(/^[\s\S]*?[.!?요](?=\s|$)/);
  return (m ? m[0] : t).trim();
};
const sentences = (s) => (clean(s).match(/[^.!?]+[.!?]+/g) || [clean(s)]).map((x) => x.trim()).filter(Boolean);
const argmax = (a) => a.reduce((k, v, i) => (v > a[k] ? i : k), 0);

function prepOf(l) {
  const S = l.sections.length;
  const checks = l.practice.filter((q) => /^계단 확인/.test(q.group));
  const quiz = l.practice.filter((q) => !/^계단 확인/.test(q.group));
  const goals = (l.goals && l.goals.length ? l.goals : l.sections.map((s) => s.heading.replace(/^\d+계단 · /, ""))).map(clean);
  const score = sectionScorer(l);
  const goalSecs = goals.map((g) => {
    const sc = score(g);
    const best = Math.max(...sc) > 0 ? argmax(sc) : Math.min(S - 1, 0);
    return [best];
  });
  // 발문: 핵심 질문 + 가운데·끝 계단의 확인 문제
  // 말로 물어볼 만한 것(물음표로 끝나는 선택형)을 먼저 써요
  const askable = checks.filter((q) => q.type === "choice" && /[?？]$/.test(clean(q.prompt)) && !/[=(]|import |\.[a-z]+\(/.test(q.prompt));
  const pool = askable.length >= 4 ? askable : checks;
  const pickAt = (f) => pool[Math.min(pool.length - 1, Math.floor(f * pool.length))];
  const askQs = [pickAt(0.45), pickAt(0.95)].filter(Boolean);
  const asks = [clean(l.question)].concat(askQs.map((q) => clean(q.prompt)));
  while (asks.length < 3) asks.push(clean(l.question));
  const qsel = [0.1, 0.35, 0.6, 0.9].map(pickAt).filter((q, i, a) => q && a.indexOf(q) === i);
  const questions = qsel.map((q) => ({ q: clean(q.prompt), a: clean(q.solution) }));
  // 막히는 곳 · 오개념
  const warns = [];
  for (const s of l.sections) for (const b of s.blocks) if (b.t === "callout" && b.kind === "warn") warns.push(first(b.text));
  const stuck = warns.slice(0, 2);
  for (const q of checks.slice().reverse()) {
    if (stuck.length >= 3) break;
    const t = first(q.solution);
    if (t && stuck.indexOf(t) < 0) stuck.push(t);
  }
  const wrongQ = quiz.filter((q) => /옳지 않|틀린|아닌 것|거리가 먼/.test(q.prompt));
  const misconceptions = [];
  for (const q of wrongQ) {
    const t = first(q.solution);
    if (t && misconceptions.indexOf(t) < 0 && stuck.indexOf(t) < 0) misconceptions.push(t);
    if (misconceptions.length >= 4) break;
  }
  for (const w of warns.slice(2)) if (misconceptions.length < 4 && misconceptions.indexOf(w) < 0) misconceptions.push(w);
  if (!misconceptions.length) for (const q of quiz.slice(0, 2)) misconceptions.push(sentences(q.solution).slice(-1)[0]);
  // 준비물
  let hasCode = false;
  for (const s of l.sections) for (const b of s.blocks) if (b.t === "code") hasCode = true;
  const materials = ["전자칠판(교사용 사이트의 칠판 장면)", "학생 휴대폰(학생용 사이트, 수업 끝 QR)"];
  if (hasCode) materials.push("코드를 따라 쳐 볼 파이썬 실행 환경(선택)");
  return { goal: goals.join(" "), goals, goalSecs, asks: asks.slice(0, 3), questions, stuck, misconceptions, materials };
}

const units = JSON.parse(readFileSync(path.join(CONTENT_DIR, "units.json"), "utf8"));
mkdirSync(OUT, { recursive: true });
let n = 0;
for (const u of units) {
  const lessons = {};
  const dir = path.join(CONTENT_DIR, u.slug);
  const byId = {};
  for (const f of readdirSync(dir)) if (/^lesson-[0-9A-Za-z_]+\.json$/.test(f)) {
    const l = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
    byId[l.id] = l;
  }
  for (const m of u.lessons) {
    lessons[m.id] = prepOf(byId[m.id]);
    n++;
  }
  writeFileSync(path.join(OUT, u.slug + ".json"), JSON.stringify({ unit: u.id, lessons }, null, 2) + "\n");
}
console.log("data/teacher/prep/ 을 만들었어요(레슨 " + n + "개).");
