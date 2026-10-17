// 학생 기록 v2(aimn:s1:*) — 학생 화면은 모두 여기를 거쳐 기록을 읽고 써요.
// 기록은 이 기기의 브라우저(localStorage)에만 남고 서버로 보내지 않아요. 모든 읽기·쓰기는 try/catch 로 감싼
// 공용 저장 계층(src/shared/storage)을 써서, 저장이 막혀도(사생활 보호 창 등) 화면은 그대로 돌아가요.
// 계산은 *.logic.ts(순수 함수, node --test 로 시험)에 있고, 이 파일은 저장소에 묶는 일만 해요.
import type { CardPos, LessonStep, Plan, PlanLesson, Prefs, QMap, QRec, StudentData } from "../../shared/contracts.ts";
import { DEFAULT_PREFS } from "../../shared/contracts.ts";
import { createStore, S_PREFIX, studentKeyList, backupFileName, useStored } from "../../shared/storage/index.ts";
import { INDEX } from "../../content/index.ts";
import PLAN_JSON from "../../../data/plan.json";
import { extraKeyList, THINK_MAX, type SelfLevel, type StudentExtra } from "./extra.ts";
import { applyAnswer, applyHint, applySolution, type AnswerOpts } from "./record.logic.ts";
import { dayKey, todayReview } from "./review.logic.ts";
import { lessonMastery, lessonStatus, settleRead, unitStatus, type LessonStatus, type Mastery, type UnitStatus } from "./status.logic.ts";
import { parseStudentBackup, serializeStudentBackup, type StudentImport } from "./backup.logic.ts";
import { parseAssignQuery } from "./assign.logic.ts";

export * from "./record.logic.ts";
export * from "./review.logic.ts";
export * from "./status.logic.ts";
export * from "./backup.logic.ts";
export * from "./assign.logic.ts";
export * from "./extra.ts";

/** 학생 저장 값 전체(공용 키 + 학생 전용 키) */
export type StudentAll = StudentData & StudentExtra;

const ALL_KEYS: string[] = (studentKeyList as string[]).concat(extraKeyList.filter((k) => (studentKeyList as string[]).indexOf(k) < 0));

/** 학생 저장소(공용 studentStore 와 같은 접두사, 학생 전용 키까지 아는 것) */
export const sStore = createStore<StudentAll>(S_PREFIX, ALL_KEYS);

/* ─────────── 기본값 ─────────── */

export const FALLBACK = {
  q: {} as QMap,
  read: {} as Record<string, number[]>,
  seen: {} as Record<string, number[]>,
  pos: {} as Record<string, CardPos>,
  last: null as StudentData["last"],
  prefs: DEFAULT_PREFS as Prefs,
  prereq: {} as StudentData["prereq"],
  assigned: {} as StudentData["assigned"],
  tools: {} as StudentData["tools"],
  think: {} as StudentExtra["think"],
  self: {} as StudentExtra["self"],
  proj: {} as StudentExtra["proj"],
  rvday: null as StudentExtra["rvday"],
};

const now = () => Date.now();

/* ─────────── 레슨 계획(소제목 끝 확인 문제) ─────────── */

const PLAN = PLAN_JSON as unknown as Plan;

export function planOf(lid: string): PlanLesson | undefined {
  return PLAN && PLAN.lessons ? PLAN.lessons[lid] : undefined;
}
/** 소제목 i 끝에서 푸는 확인 문제 id */
export function sectionChecks(lid: string, i?: number): string[][] | string[] {
  const p = planOf(lid);
  const all = p && p.sectionChecks ? p.sectionChecks : [];
  return i === undefined ? all : all[i] || [];
}
/** 계단 문제 기본 길(1장 = 1문제) */
export function corePath(lid: string): string[] {
  const p = planOf(lid);
  return p && p.corePath ? p.corePath.slice() : [];
}

/** 문제 id 의 레슨 id("u1-1-q06" → "u1-1"). 단원 문제면 null */
export function lessonOfQ(qid: string): string | null {
  const m = /^(u\d+-\d+)-/.exec(qid);
  return m && INDEX.lessons[m[1]] ? m[1] : null;
}

/** 읽음 다시 맞추기(지나간 소제목 + 확인 문제 풀어 봄) */
function settle(lid: string, q?: QMap) {
  const meta = INDEX.lessons[lid];
  if (!meta) return;
  const seen = sStore.read("seen", FALLBACK.seen)[lid];
  if (!seen || !seen.length) return;
  const read = sStore.read("read", FALLBACK.read);
  const prev = read[lid];
  const next = settleRead(prev, seen, sectionChecks(lid) as string[][], q || sStore.read("q", FALLBACK.q), meta.sections.length);
  if (next !== prev) {
    const out: Record<string, number[]> = {};
    for (const k of Object.keys(read)) out[k] = read[k];
    out[lid] = next;
    sStore.write("read", out);
  }
}

/* ─────────── 문제 기록 ─────────── */

function updateQ(qid: string, fn: (prev: QRec | undefined) => QRec): QRec {
  let rec: QRec | undefined;
  const q = sStore.update("q", FALLBACK.q, (cur) => {
    const out: QMap = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    rec = fn(cur[qid]);
    out[qid] = rec;
    return out;
  });
  const lid = lessonOfQ(qid);
  if (lid) settle(lid, q);
  return rec as QRec;
}

/** 답 제출. review: 오늘의 복습 화면에서 푼 것 */
export function recordAnswer(qid: string, correct: boolean, opts: AnswerOpts = {}): QRec {
  const t = now();
  const rec = updateQ(qid, (prev) => applyAnswer(prev, correct, t, opts));
  if (opts.review) {
    const d = dayKey(t);
    sStore.update("rvday", FALLBACK.rvday, (cur) => ({ day: d, n: cur && cur.day === d ? cur.n + 1 : 1 }));
  }
  return rec;
}
export const recordHint = (qid: string, level: 1 | 2): QRec => updateQ(qid, (prev) => applyHint(prev, level));
export const recordSolution = (qid: string): QRec => updateQ(qid, (prev) => applySolution(prev, now()));
export const getQ = (): QMap => sStore.read("q", FALLBACK.q);

/** 오답노트에서 '지우기' */
export function clearQ(qid: string) {
  sStore.update("q", FALLBACK.q, (cur) => {
    const out: QMap = {};
    for (const k of Object.keys(cur)) if (k !== qid) out[k] = cur[k];
    return out;
  });
}

/** 오늘의 복습 문제 id(하루 최대 5, 오늘 이미 푼 만큼 덜). 학생 사이트에 있는 문제만 */
export function reviewToday(): string[] {
  const t = now();
  const rd = sStore.read("rvday", FALLBACK.rvday);
  const done = rd && rd.day === dayKey(t) ? rd.n : 0;
  return todayReview(getQ(), t, done, (id) => !!lessonOfQ(id) || isUnitTestQ(id));
}

let testSet: Record<string, true> | null = null;
/** 단원 마무리 도전 문제인가(학력진단 A·B회는 학생 사이트에 없어요) */
export function isUnitTestQ(id: string): boolean {
  if (!testSet) {
    testSet = {};
    for (const u of INDEX.units) for (const t of u.testIds) testSet[t] = true;
  }
  return testSet[id] === true;
}

/* ─────────── 카드 넘기기 ─────────── */

/** 소제목 i 의 마지막 카드를 지나갔을 때(그 뒤 확인 문제를 풀면 읽음) */
export function passSectionEnd(lid: string, i: number) {
  sStore.update("seen", FALLBACK.seen, (cur) => {
    const list = cur[lid] || [];
    if (list.indexOf(i) >= 0) return cur;
    const out: Record<string, number[]> = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    out[lid] = list.concat([i]).sort((a, b) => a - b);
    return out;
  });
  settle(lid);
}

export function setPos(lid: string, step: LessonStep, card: number) {
  sStore.update("pos", FALLBACK.pos, (cur) => {
    const out: Record<string, CardPos> = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    out[lid] = { step, card: Math.max(1, Math.floor(card)), ts: now() };
    return out;
  });
}
export const getPos = (lid: string): CardPos | undefined => sStore.read("pos", FALLBACK.pos)[lid];

/** 이어서 공부하기(경로는 "#" 뒤, 예 "/l/u1-1/s/c2/3") */
export function setLast(path: string, title: string) {
  sStore.write("last", { path, title, ts: now() });
}
export const getLast = () => sStore.read("last", FALLBACK.last);

/* ─────────── 먼저 알고 가요 · 생각해 보기 · 돌아보기 · 프로젝트 · 체험 ─────────── */

export function setPrereq(lid: string, term: string, v: "know" | "unsure") {
  sStore.update("prereq", FALLBACK.prereq, (cur) => {
    const out: StudentData["prereq"] = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    const m: Record<string, "know" | "unsure"> = {};
    const old = cur[lid] || {};
    for (const k of Object.keys(old)) m[k] = old[k];
    m[term] = v;
    out[lid] = m;
    return out;
  });
}

/** '생각해 보기' 글 저장(빈 글이면 지워요). key 예: "p0"(프로젝트 생각해 보기 0번) */
export function setThink(lid: string, key: string, text: string) {
  sStore.update("think", FALLBACK.think, (cur) => {
    const out: StudentExtra["think"] = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    const m: Record<string, string> = {};
    const old = cur[lid] || {};
    for (const k of Object.keys(old)) m[k] = old[k];
    const v = String(text || "").slice(0, THINK_MAX);
    if (v.trim()) m[key] = v;
    else delete m[key];
    out[lid] = m;
    return out;
  });
}

export function setSelf(lid: string, level: SelfLevel) {
  sStore.update("self", FALLBACK.self, (cur) => {
    const out: StudentExtra["self"] = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    out[lid] = { level, ts: now() };
    return out;
  });
}

/** 프로젝트 단계 하나를 켜고 끄기. total 을 주면 다 했는지도 맞춰요 */
export function toggleProjStep(lid: string, step: number, total?: number) {
  sStore.update("proj", FALLBACK.proj, (cur) => {
    const out: StudentExtra["proj"] = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    const old = cur[lid] || { steps: [], done: false, ts: 0 };
    const has = old.steps.indexOf(step) >= 0;
    const steps = has ? old.steps.filter((s) => s !== step) : old.steps.concat([step]).sort((a, b) => a - b);
    out[lid] = { steps, done: total ? steps.length >= total : old.done, ts: now() };
    return out;
  });
}

export function setToolDone(wid: keyof StudentData["tools"]) {
  sStore.update("tools", FALLBACK.tools, (cur) => {
    const out: StudentData["tools"] = {};
    for (const k of Object.keys(cur) as (keyof StudentData["tools"])[]) out[k] = cur[k];
    out[wid] = { done: true, ts: now() };
    return out;
  });
}

/* ─────────── 선생님 QR(#/l/:lid?hw=…&ex=…) ─────────── */

/** 레슨 주소의 쿼리를 읽어 저장해요. 받은 게 있으면 그 값을, 없으면 null */
export function acceptAssignment(lid: string, query: string): { hw: string[]; ex: string[] } | null {
  if (!INDEX.lessons[lid]) return null;
  const a = parseAssignQuery(lid, query, (id) => INDEX.lessons[lid].qids.indexOf(id) >= 0);
  if (!a.hw.length && !a.ex.length) return null;
  sStore.update("assigned", FALLBACK.assigned, (cur) => {
    const out: StudentData["assigned"] = {};
    for (const k of Object.keys(cur)) out[k] = cur[k];
    out[lid] = { hw: a.hw, ex: a.ex, ts: now() };
    return out;
  });
  return a;
}

/* ─────────── 상태 계산(색인만으로, 레슨 본문 없이) ─────────── */

export function statusOf(lid: string, q = getQ(), read = sStore.read("read", FALLBACK.read)): LessonStatus | null {
  const m = INDEX.lessons[lid];
  return m ? lessonStatus(m, q, read, sStore.read("seen", FALLBACK.seen)) : null;
}
export function masteryOf(lid: string, q = getQ(), read = sStore.read("read", FALLBACK.read)): Mastery {
  const m = INDEX.lessons[lid];
  return m ? lessonMastery(m, q, read, sStore.read("seen", FALLBACK.seen)) : 0;
}
export function unitStatusOf(n: number, q = getQ(), read = sStore.read("read", FALLBACK.read)): UnitStatus | null {
  const u = INDEX.units.filter((x) => x.id === n)[0];
  return u ? unitStatus(u, INDEX.lessons, q, read) : null;
}

/* ─────────── 기록 파일 ─────────── */

export function exportBackup(): { name: string; text: string } {
  return { name: backupFileName("student"), text: serializeStudentBackup(sStore.dump()) };
}

/** 기록 파일을 불러와 지금 기록을 바꿔요(이 사이트 학생 기록만). 실패하면 아무것도 바꾸지 않아요 */
export function importBackup(text: string): StudentImport {
  const r = parseStudentBackup(text);
  if (!r.ok) return r;
  sStore.clear();
  sStore.restore(r.data);
  return r;
}

/** 이 기기의 학생 기록을 모두 지워요 */
export const resetAll = () => sStore.clear();

/* ─────────── React 훅 ─────────── */

export const useQ = () => useStored(sStore, "q", FALLBACK.q)[0];
export const useRead = () => useStored(sStore, "read", FALLBACK.read)[0];
export const useSeen = () => useStored(sStore, "seen", FALLBACK.seen)[0];
export const useLast = () => useStored(sStore, "last", FALLBACK.last)[0];
export const usePosMap = () => useStored(sStore, "pos", FALLBACK.pos)[0];
export const useAssigned = () => useStored(sStore, "assigned", FALLBACK.assigned)[0];
export const usePrefs = () => useStored(sStore, "prefs", FALLBACK.prefs);
export const usePrereq = () => useStored(sStore, "prereq", FALLBACK.prereq)[0];
export const useThink = () => useStored(sStore, "think", FALLBACK.think)[0];
export const useSelf = () => useStored(sStore, "self", FALLBACK.self)[0];
export const useProj = () => useStored(sStore, "proj", FALLBACK.proj)[0];
export const useTools = () => useStored(sStore, "tools", FALLBACK.tools)[0];
export const useRvDay = () => useStored(sStore, "rvday", FALLBACK.rvday)[0];
