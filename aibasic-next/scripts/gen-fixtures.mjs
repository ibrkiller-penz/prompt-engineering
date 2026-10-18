#!/usr/bin/env node
// 촬영·시험용 가짜 학습 기록(tools/fixtures/student.json · teacher.json)을 현재 콘텐츠로 만들어요(개인 정보 없음).
// 사용: node scripts/gen-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentIndex } from "../tools/content-index.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "tools", "fixtures");
const NOW = Date.parse("2026-10-16T00:00:00.000Z");
const DAY = 86400000;
const { index } = buildContentIndex();
const A = index.order[0]; // 완료한 레슨(Ⅰ-1-1)
const B = index.order[1]; // 배우는 중인 레슨(Ⅰ-1-2)
const mA = index.lessons[A];
const mB = index.lessons[B];

const q = {};
const t0 = NOW - 3 * DAY;
const t1 = NOW - 2 * DAY;
mA.qids.forEach((id, i) => {
  // 4번째·8번째 문제는 틀려서 복습 예정(rv)
  if (i === 3 || i === 7) q[id] = { first: false, wrong: 2, hints: 1, sol: false, ok: false, lastWrong: t1, t0, t1, rv: { step: 0, due: NOW - DAY } };
  else q[id] = { first: true, wrong: 0, hints: 0, sol: false, ok: true, lastWrong: null, t0, t1 };
});
mB.qids.slice(0, 7).forEach((id, i) => {
  q[id] = i === 2 ? { first: false, wrong: 1, hints: 1, sol: false, ok: true, lastWrong: t1, t0, t1 } : { first: true, wrong: 0, hints: 0, sol: false, ok: true, lastWrong: null, t0, t1 };
});
const prefs = { fs: 1, theme: "light", motion: "reduce", speak: false, contrast: false };
const student = {
  "//": "촬영(scripts/shots.mjs)이 화면을 열기 전에 localStorage 에 넣는 가짜 학습 기록이에요. 개인 정보는 없어요. scripts/gen-fixtures.mjs 로 만들어요. 기준 시각 2026-10-16T00:00:00.000Z",
  now: NOW,
  storage: {
    "aibn:s1:q": q,
    "aibn:s1:read": { [A]: mA.sections.map((_, i) => i), [B]: [0, 1] },
    "aibn:s1:pos": { [B]: { step: "c2", card: 2, ts: NOW - DAY } },
    "aibn:s1:last": { path: `/l/${B}/s/c2/2`, title: `${mB.code} ${mB.title}`, ts: NOW - DAY },
    "aibn:s1:prefs": prefs,
    "aibn:s1:prereq": {},
    "aibn:s1:assigned": {},
    "aibn:s1:tools": {},
  },
};
const teacher = {
  "//": "촬영(scripts/shots.mjs)이 화면을 열기 전에 localStorage 에 넣는 가짜 교사 기록이에요. 개인 정보는 없어요. scripts/gen-fixtures.mjs 로 만들어요. 기준 시각 2026-10-16T00:00:00.000Z",
  now: NOW,
  storage: {
    "aibn:t1:prefs": prefs,
    "aibn:t1:last": { lid: B, p: 1, s: 3, ts: NOW - DAY },
    "aibn:t1:duration": 50,
    "aibn:t1:progress": { "2-3": { [A]: "done", [B]: "part" }, "2-4": { [A]: "done" } },
    "aibn:t1:results": {},
  },
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "student.json"), JSON.stringify(student, null, 2) + "\n");
fs.writeFileSync(path.join(OUT, "teacher.json"), JSON.stringify(teacher, null, 2) + "\n");
console.log("tools/fixtures/ 를 만들었어요(완료 " + A + ", 진행 " + B + ").");
