// 문제 고르기(칠판 · 수업 끝 확인 · 숙제)와 학생 링크 만들기. 순수 로직(DOM 없음), 늘 같은 결과(무작위 없음).
//  - 칠판 5~8개: 소제목 끝 확인 문제(소제목마다 1개, plan.sectionChecks) → 개념 확인 → 소제목별 기초 → 쉬운 응용 1 → 실력 UP 1. 서술형(open)은 빼요.
//  - 끝 확인 3개: choice·ox, 난이도 1~3, 칠판과 겹치지 않게.
//  - 숙제 5개: 칠판·끝 확인과 겹치지 않게.
//  - 차시를 나눈 레슨(2차시 이상)에서는 세 바구니 모두 이 차시 소제목에 속한 문제(inP)만 골라요.
//    쉬운 응용·실력 UP·도전처럼 원래 '레슨 전체'인 문제는 plan.json 의 secOf 태그로 소제목을 정해요.
//  - 학생 링크: https://aibasics.web.app/#/l/:lid?hw=…&ex=… (문제 id 만. 반·이름 같은 개인 정보는 넣지 않아요)
import type { Lesson, PlanLesson, Question } from "../../shared/contracts.ts";
import type { PeriodInfo } from "./periods.logic.ts";

export type QKind = "check" | "basic" | "easy" | "adv" | "chal";

export interface PickSet {
  board: string[];
  exit: string[];
  hw: string[];
}

export const BOARD_MIN = 5;
export const BOARD_MAX = 8;
export const EXIT_N = 3;
export const HW_N = 5;

type L = Pick<Lesson, "id" | "sections" | "practice">;

/** plan.json 레슨 항목 가운데 이 파일이 읽는 덧붙은 필드(contracts 의 PlanLesson 밖) */
export interface PlanTags {
  /** 문제 id → 소제목 번호 덧씌우기(내용 기준 태그). 기본 규칙과 다른 것만 적어요 */
  secOf?: Record<string, number>;
}
type PlanLike = (Partial<Pick<PlanLesson, "sectionChecks" | "board" | "exit" | "hw">> & PlanTags) | null | undefined;

function tagsOf(plan: PlanLike): PlanTags {
  return (plan || {}) as PlanTags;
}

/** group 첫머리로 문제 갈래를 정해요 */
export function qKind(q: Pick<Question, "group">): QKind {
  const g = (q.group || "").trim();
  if (g.indexOf("계단 확인") === 0 || g.indexOf("개념 확인") === 0) return "check";
  if (g.indexOf("쉬운 응용") === 0) return "easy";
  if (g.indexOf("실력") === 0) return "adv";
  if (g.indexOf("도전") === 0 || g.indexOf("수능") === 0) return "chal";
  return "basic";
}

/** "기초력 UP · 유형 2 · 합집합과 교집합" → "합집합과 교집합" */
export function groupTopic(group: string): string {
  const parts = group.split("·").map((s) => s.trim());
  const rest = parts.slice(1).join(" ");
  return rest.replace(/^유형\s*\d+\s*/, "").trim();
}

function bigrams(s: string): string[] {
  const t = s.replace(/\$[^$]*\$/g, " ").replace(/[^가-힣A-Za-z0-9]+/g, " ");
  const out: string[] = [];
  for (const w of t.split(" ")) {
    if (!w) continue;
    for (let i = 0; i + 2 <= w.length; i++) out.push(w.slice(i, i + 2));
  }
  return out;
}

/**
 * 문제 id → 소제목 번호(0부터).
 *  기본 규칙(plan 없이)
 *  - 기초력 UP: 유형 이름과 소제목 제목이 겹치는 두 글자 묶음이 2개 이상이면 그 소제목, 아니면 유형 순서대로 고르게 나눠요.
 *  - 개념 확인: 나온 순서대로 소제목에 고르게 나눠요.
 *  - 쉬운 응용·실력 UP·도전은 레슨 전체(-1).
 *  plan.secOf 가 있으면 그 값(내용 기준으로 붙인 태그)을 덧씌워요. 범위를 벗어난 값은 무시해요.
 */
export function questionSections(lesson: L, plan?: PlanLike): Record<string, number> {
  const out = baseSections(lesson);
  const tags = tagsOf(plan).secOf;
  if (tags) {
    const S = lesson.sections.length;
    for (const q of lesson.practice) {
      const v = tags[q.id];
      if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < S) out[q.id] = v;
    }
  }
  return out;
}

/** plan 없이 쓰는 기본 규칙(위 설명) */
export function baseSections(lesson: L): Record<string, number> {
  const S = Math.max(1, lesson.sections.length);
  const out: Record<string, number> = {};
  const checks = lesson.practice.filter((q) => qKind(q) === "check");
  checks.forEach((q, i) => {
    // '계단 확인 3계단' 은 소제목(계단) 3번 = 번호 2. 그 밖의 이름이면 나온 순서대로 고르게 나눠요
    const m = /(\d+)\s*계단/.exec(q.group || "");
    const n = m ? parseInt(m[1], 10) - 1 : -1;
    out[q.id] = n >= 0 && n < S ? n : Math.min(S - 1, Math.floor((i * S) / checks.length));
  });

  const groups: string[] = [];
  for (const q of lesson.practice) if (qKind(q) === "basic" && groups.indexOf(q.group) < 0) groups.push(q.group);
  const heads = lesson.sections.map((s) => bigrams(s.heading));
  const gSec: Record<string, number> = {};
  groups.forEach((g, gi) => {
    const prop = Math.min(S - 1, Math.floor((gi * S) / groups.length));
    const gb = bigrams(groupTopic(g));
    let best = -1;
    let bestScore = 0;
    let tie = false;
    heads.forEach((hb, si) => {
      let sc = 0;
      for (const b of gb) if (hb.indexOf(b) >= 0) sc++;
      if (sc > bestScore) {
        bestScore = sc;
        best = si;
        tie = false;
      } else if (sc === bestScore && sc > 0) tie = true;
    });
    gSec[g] = bestScore >= 2 && !tie ? best : prop;
  });
  for (const q of lesson.practice) {
    const k = qKind(q);
    if (k === "basic") out[q.id] = gSec[q.group];
    else if (k !== "check") out[q.id] = -1;
  }
  return out;
}

const typeRank = (q: Question, pref: string[]) => {
  const i = pref.indexOf(q.type);
  return i < 0 ? pref.length : i;
};

function byLevelNear(target: number) {
  return (a: Question, b: Question) => Math.abs(a.level - target) - Math.abs(b.level - target) || a.level - b.level;
}

/** 안정 정렬(Chrome 80 의 sort 는 안정이지만, 원래 순서를 끝 비교로 넣어 확실히 해요) */
function stableSort<T>(arr: T[], cmp: (a: T, b: T) => number, order: (t: T) => number): T[] {
  return arr.slice().sort((a, b) => cmp(a, b) || order(a) - order(b));
}

/**
 * 소제목 끝 확인 문제(소제목마다 1개). 칠판에서는 그 소제목 개념 장면 바로 뒤에 나와요.
 *  - plan.sectionChecks[s] 가운데 실제로 있고 서술형이 아닌 첫 문제
 *  - 없으면: 그 소제목(secOf)의 개념 확인 문제 → 가장 쉬운 기초 문제(선택형·OX 먼저)
 */
export function sectionCheckIds(lesson: L, plan: PlanLike, sections?: readonly number[]): { s: number; id: string }[] {
  const secOf = questionSections(lesson, plan);
  const S = lesson.sections.length;
  const list = sections && sections.length ? sections : lesson.sections.map((_, i) => i);
  const byId: Record<string, Question> = {};
  const order: Record<string, number> = {};
  lesson.practice.forEach((q, i) => {
    byId[q.id] = q;
    order[q.id] = i;
  });
  const out: { s: number; id: string }[] = [];
  const used: string[] = [];
  for (const s of list) {
    if (!(s >= 0 && s < S)) continue;
    const fromPlan = plan && plan.sectionChecks && plan.sectionChecks[s] ? plan.sectionChecks[s] : [];
    let id = "";
    for (const x of fromPlan) {
      const q = byId[x];
      if (q && q.type !== "open" && used.indexOf(x) < 0) {
        id = x;
        break;
      }
    }
    if (!id) {
      const mine = lesson.practice.filter((q) => q.type !== "open" && secOf[q.id] === s && used.indexOf(q.id) < 0);
      const chk = mine.filter((q) => qKind(q) === "check")[0];
      const basic = stableSort(
        mine.filter((q) => qKind(q) === "basic"),
        (a, b) => typeRank(a, ["choice", "ox", "number"]) - typeRank(b, ["choice", "ox", "number"]) || a.level - b.level,
        (q) => order[q.id],
      )[0];
      const q = chk || basic;
      if (q) id = q.id;
    }
    if (id) {
      out.push({ s, id });
      used.push(id);
    }
  }
  return out;
}

export interface PickContext {
  lesson: L;
  /** 이 차시 소제목. 없으면 레슨 전체 */
  sections?: number[];
  /** 차시 번호(1부터) — 레슨 전체 문제(쉬운 응용·실력 UP)를 차시마다 다르게 고를 때 */
  p?: number;
  /** plan.json 의 이 레슨(secOf 태그를 읽어요) */
  plan?: PlanLike;
  /** 차시를 나눈 레슨의 한 차시면 true: 모든 문제를 이 차시 소제목(inP) 안에서만 골라요 */
  split?: boolean;
}

function ctx(c: PickContext) {
  const { lesson } = c;
  const order: Record<string, number> = {};
  lesson.practice.forEach((q, i) => (order[q.id] = i));
  const secOf = questionSections(lesson, c.plan);
  const all = lesson.sections.map((_, i) => i);
  const P = c.sections && c.sections.length ? c.sections : all;
  const inP = (q: Question) => P.indexOf(secOf[q.id]) >= 0;
  /** 고를 수 있는 문제: 나눈 차시면 inP 만, 아니면 레슨 전체 */
  const okQ = (q: Question) => (c.split ? inP(q) : true);
  const ord = (q: Question) => order[q.id];
  return { lesson, order, secOf, P, inP, okQ, split: !!c.split, ord, p: c.p && c.p > 0 ? c.p : 1 };
}

/** 칠판 문제 5~8개(쉬운 것부터) */
export function pickBoard(c: PickContext): string[] {
  const { lesson, secOf, P, inP, okQ, ord, p } = ctx(c);
  const usable = lesson.practice.filter((q) => q.type !== "open" && okQ(q));
  const taken: string[] = [];
  const take = (q: Question | undefined) => {
    if (q && taken.indexOf(q.id) < 0) taken.push(q.id);
    return !!q;
  };

  // 1) 개념 확인 2개: choice·ox 먼저, 앞쪽 하나 + 뒤쪽 하나
  const checks = stableSort(
    usable.filter((q) => qKind(q) === "check" && inP(q)),
    (a, b) => typeRank(a, ["choice", "ox", "number"]) - typeRank(b, ["choice", "ox", "number"]),
    ord,
  );
  const checkA = checks[0];
  take(checkA);
  if (checks.length > 1) {
    const rest = checks.slice(1).filter((q) => q.type === checkA.type || q.type !== "number");
    const later = rest.length ? rest : checks.slice(1);
    take(later.slice().sort((a, b) => ord(b) - ord(a))[0]);
  }
  const checkIds = taken.slice();

  // 2) 소제목별 기초: 난이도 2 근처 하나씩(소제목이 3개 이하면 둘씩)
  const per = P.length <= 3 ? 2 : 1;
  const basicPicks: string[][] = [];
  for (const s of P) {
    const cand = stableSort(
      usable.filter((q) => qKind(q) === "basic" && secOf[q.id] === s),
      byLevelNear(2),
      ord,
    );
    const got: Question[] = [];
    if (cand.length) got.push(cand[0]);
    if (per > 1 && cand.length > 1) {
      // 둘째는 다른 유형에서(없으면 같은 유형의 다음 것)
      const other = cand.filter((x) => x !== cand[0] && x.group !== cand[0].group)[0];
      got.push(other || cand[1]);
    }
    basicPicks.push(got.map((q) => q.id));
  }

  // 3) 쉬운 응용 1, 실력 UP 1: 나눈 차시면 이 차시 소제목 것만(usable 이 이미 걸러요), 아니면 차시마다 돌아가며 골라요
  const rot = (arr: Question[]) => (arr.length ? arr[(p - 1) % arr.length] : undefined);
  const easy = rot(stableSort(usable.filter((q) => qKind(q) === "easy" && q.level <= 3), byLevelNear(2), ord));
  const adv = rot(stableSort(usable.filter((q) => qKind(q) === "adv"), (a, b) => a.level - b.level, ord));

  // 개수 맞추기: 8개를 넘으면 소제목별 둘째부터 덜어내요
  const tail = (easy ? 1 : 0) + (adv ? 1 : 0);
  let room = BOARD_MAX - checkIds.length - tail;
  const firsts = basicPicks.map((g) => g.slice(0, 1));
  const seconds = basicPicks.map((g) => g.slice(1));
  let nFirst = firsts.reduce((a, g) => a + g.length, 0);
  if (nFirst > room) {
    // 소제목이 많아 첫째만으로도 넘치면, 고르게 솎아요
    const flat = ([] as string[]).concat(...firsts);
    const keep: string[] = [];
    for (let i = 0; i < room; i++) keep.push(flat[Math.floor((i * flat.length) / room)]);
    firsts.forEach((g, i) => (firsts[i] = g.filter((id) => keep.indexOf(id) >= 0)));
    nFirst = room;
  }
  room -= nFirst;
  const basics: string[] = [];
  firsts.forEach((g, i) => {
    for (const id of g) basics.push(id);
    for (const id of seconds[i]) {
      if (room <= 0) break;
      basics.push(id);
      room--;
    }
  });
  basics.sort((a, b) => P.indexOf(secOf[a]) - P.indexOf(secOf[b]) || ordId(a) - ordId(b));
  function ordId(id: string) {
    return lesson.practice.findIndex((q) => q.id === id);
  }
  for (const id of basics) if (taken.indexOf(id) < 0) taken.push(id);
  take(easy);
  take(adv);

  // 5개가 안 되면: 이 차시 기초 → 쉬운 응용 → 레슨 전체 기초 순으로 채워요
  if (taken.length < BOARD_MIN) {
    const fill = stableSort(
      usable.filter((q) => taken.indexOf(q.id) < 0 && qKind(q) !== "chal"),
      (a, b) =>
        (inP(a) ? 0 : 1) - (inP(b) ? 0 : 1) ||
        kindRank(qKind(a)) - kindRank(qKind(b)) ||
        byLevelNear(2)(a, b),
      ord,
    );
    for (const q of fill) {
      if (taken.length >= BOARD_MIN) break;
      taken.push(q.id);
    }
  }
  // 칠판에 보일 차례: 개념 확인 → 기초(소제목 순) → 쉬운 응용 → 실력 UP → 그 밖
  return stableSort(taken, (a, b) => boardRank(a) - boardRank(b), ordId);

  function boardRank(id: string): number {
    const q = lesson.practice[ordId(id)];
    const k = qKind(q);
    if (k === "basic") return 10 + Math.max(0, P.indexOf(secOf[id]));
    return k === "check" ? 0 : k === "easy" ? 100 : k === "adv" ? 200 : 300;
  }
}

function kindRank(k: QKind): number {
  return k === "basic" ? 0 : k === "check" ? 1 : k === "easy" ? 2 : k === "adv" ? 3 : 4;
}

/** 수업 끝 확인 3개: choice·ox, 난이도 1~3, exclude 와 겹치지 않게, 서로 다른 유형을 먼저 */
export function pickExit(c: PickContext, exclude: readonly string[] = []): string[] {
  const { lesson, inP, okQ, ord } = ctx(c);
  const free = lesson.practice.filter((q) => exclude.indexOf(q.id) < 0 && q.type !== "open" && okQ(q));
  const lvRank = (q: Question) => (q.level === 2 ? 0 : q.level === 1 ? 1 : 2);
  const tiers: Question[][] = [
    free.filter((q) => (q.type === "choice" || q.type === "ox") && q.level <= 3 && inP(q)),
    free.filter((q) => (q.type === "choice" || q.type === "ox") && q.level <= 3 && !inP(q) && qKind(q) !== "chal"),
    free.filter((q) => q.type === "number" && q.level <= 3 && inP(q)),
    free.filter((q) => q.type === "number" && q.level <= 3 && !inP(q)),
    // 계단이 뒤로 갈수록 난이도가 올라가서(4~5) 위 조건에 안 걸리면 이 차시 안의 선택형·OX 를 그대로 써요
    free.filter((q) => (q.type === "choice" || q.type === "ox") && inP(q)),
    free.filter((q) => (q.type === "choice" || q.type === "ox") && !inP(q)),
  ];
  const out: string[] = [];
  const groups: string[] = [];
  for (const tier of tiers) {
    const sorted = stableSort(tier, (a, b) => lvRank(a) - lvRank(b), ord);
    // 다른 유형부터
    for (const q of sorted) {
      if (out.length >= EXIT_N) break;
      if (groups.indexOf(q.group) >= 0) continue;
      out.push(q.id);
      groups.push(q.group);
    }
    for (const q of sorted) {
      if (out.length >= EXIT_N) break;
      if (out.indexOf(q.id) < 0) out.push(q.id);
    }
    if (out.length >= EXIT_N) break;
  }
  return out.sort((a, b) => ordOf(lesson, a) - ordOf(lesson, b));
}

function ordOf(lesson: L, id: string): number {
  return lesson.practice.findIndex((q) => q.id === id);
}

/** 숙제 5개: 소제목마다 돌아가며 기초(난이도 2~3) → 쉬운 응용 1 → 실력 UP 1 → 나머지로 채움 */
export function pickHw(c: PickContext, exclude: readonly string[] = []): string[] {
  const { lesson, secOf, P, inP, okQ, ord } = ctx(c);
  const free = lesson.practice.filter((q) => exclude.indexOf(q.id) < 0 && q.type !== "open" && okQ(q));
  const out: string[] = [];
  const add = (q: Question | undefined) => {
    if (q && out.length < HW_N && out.indexOf(q.id) < 0) out.push(q.id);
  };
  const bySec = P.map((s) =>
    stableSort(
      free.filter((q) => qKind(q) === "basic" && secOf[q.id] === s && q.level >= 2 && q.level <= 3),
      (a, b) => b.level - a.level,
      ord,
    ),
  );
  const basicTarget = HW_N - 2;
  for (let round = 0; out.length < basicTarget && bySec.some((l) => l.length > round); round++) {
    for (const list of bySec) {
      if (out.length >= basicTarget) break;
      add(list[round]);
    }
  }
  add(stableSort(free.filter((q) => qKind(q) === "easy"), byLevelNear(3), ord)[0]);
  add(stableSort(free.filter((q) => qKind(q) === "adv" && q.level <= 4), (a, b) => a.level - b.level, ord)[0]);
  const rest = stableSort(
    free.filter((q) => out.indexOf(q.id) < 0),
    (a, b) => (inP(a) ? 0 : 1) - (inP(b) ? 0 : 1) || kindRank(qKind(a)) - kindRank(qKind(b)) || byLevelNear(2)(a, b),
    ord,
  );
  for (const q of rest) add(q);
  return out.sort((a, b) => ordOf(lesson, a) - ordOf(lesson, b));
}

/** plan 에 적힌 id 가운데 실제로 있고(서술형 제외 옵션) 겹치지 않는 것만 남겨요 */
export function validIds(lesson: L, ids: readonly string[] | undefined, opts: { noOpen?: boolean; exclude?: readonly string[] } = {}): string[] {
  if (!ids) return [];
  const out: string[] = [];
  for (const id of ids) {
    const q = lesson.practice.filter((x) => x.id === id)[0];
    if (!q) continue;
    if (opts.noOpen && q.type === "open") continue;
    if (opts.exclude && opts.exclude.indexOf(id) >= 0) continue;
    if (out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

/** 차시를 나눈 레슨의 한 차시인가(이때는 모든 바구니를 그 차시 소제목 안에서만 골라요) */
export function isSplitPeriod(period?: Pick<PeriodInfo, "p" | "n"> | null): boolean {
  return !!period && period.n > 1 && period.p > 0;
}

/** 칠판 목록 = 소제목 끝 확인(소제목 차례) + 나머지(모두 max 개까지, 기본 BOARD_MAX) */
export function mergeBoard(checks: readonly string[], rest: readonly string[], max: number = BOARD_MAX): string[] {
  const out = checks.slice();
  const room = Math.max(0, max - out.length);
  let n = 0;
  for (const id of rest) {
    if (n >= room) break;
    if (out.indexOf(id) >= 0) continue;
    out.push(id);
    n++;
  }
  return out;
}

/**
 * 한 차시의 문제 바구니 3개. plan.json 에 차시(또는 1차시 레슨)용 목록이 있으면 그것을 쓰고, 없으면 자동으로 골라요.
 *  - 칠판 앞머리에는 늘 이 차시 소제목들의 끝 확인 문제(소제목마다 1개)가 소제목 차례로 들어가요.
 *  - 차시를 나눈 레슨이면 plan 목록도 이 차시 소제목(inP) 문제만 남겨요.
 * 교사가 바구니를 고친 값(TeacherData.pick)은 화면 쪽에서 이 결과 위에 덮어써요.
 */
export function pickAll(lesson: L, plan?: (PlanLesson & PlanTags) | null, period?: Pick<PeriodInfo, "p" | "n" | "sections" | "plan"> | null): PickSet {
  const split = isSplitPeriod(period);
  const c: PickContext = { lesson, sections: period ? period.sections : undefined, p: period ? period.p : 1, plan, split };
  const { okQ } = ctx(c);
  const pp = period && period.plan ? period.plan : undefined;
  const whole = !period || period.n <= 1 || period.p === 0;
  const keepOk = (ids: string[]) => (split ? ids.filter((id) => okQ(lesson.practice.filter((q) => q.id === id)[0])) : ids);
  const checks = sectionCheckIds(lesson, plan, period ? period.sections : undefined).map((x) => x.id);

  // 나눈 차시는 고를 문제가 적을 수 있어요: 끝 확인 3 · 숙제 5 몫을 남기도록 칠판을 줄여요(5개 아래로는 줄이지 않아요)
  let cap = BOARD_MAX;
  if (split) {
    const pool = lesson.practice.filter((q) => q.type !== "open" && okQ(q)).length;
    cap = Math.max(BOARD_MIN, Math.min(BOARD_MAX, pool - EXIT_N - HW_N));
  }
  // plan 목록을 이 차시 것만 남겼더니 모자라면 자동으로 고른 것으로 채워요
  const topUp = (have: string[], auto: () => string[], n: number) => {
    if (!have.length) return auto();
    if (!split || have.length >= n) return have;
    const out = have.slice();
    for (const id of auto()) {
      if (out.length >= n) break;
      if (out.indexOf(id) < 0) out.push(id);
    }
    return out;
  };
  let board = keepOk(validIds(lesson, pp && pp.board ? pp.board : whole && plan ? plan.board : undefined, { noOpen: true }));
  board = topUp(board, () => pickBoard(c), BOARD_MIN);
  board = mergeBoard(checks, board, cap);

  let exit = keepOk(validIds(lesson, pp && pp.exit ? pp.exit : whole && plan ? plan.exit : undefined, { noOpen: true, exclude: board }));
  exit = topUp(exit, () => pickExit(c, board.concat(exit)), EXIT_N);

  let hw = keepOk(validIds(lesson, pp && pp.hw ? pp.hw : whole && plan ? plan.hw : undefined, { noOpen: true, exclude: board.concat(exit) }));
  hw = topUp(hw, () => pickHw(c, board.concat(exit, hw)), HW_N);
  return { board, exit, hw };
}

/* ─────────── 학생 링크(수업 끝 QR) ─────────── */

const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const LID_RE = /^u\d+_\w+$/;

/** 레슨 id 앞머리를 떼서 짧게: "u1_1_1-q6" → "q6" (QR 을 작게). 앞머리가 다르면 그대로 */
export function shortId(lid: string, id: string): string {
  return id.indexOf(lid + "-") === 0 ? id.slice(lid.length + 1) : id;
}

/** 짧은 id 를 다시 늘려요: "q6" → "u1_1_1-q6". 이미 긴 id 는 그대로. 학생 쪽 해석과 같은 규칙 */
export function expandId(lid: string, id: string): string {
  return /^u\d+_\w+-/.test(id) ? id : lid + "-" + id;
}

export interface StudentLinkOpts {
  hw?: readonly string[];
  ex?: readonly string[];
  /** 레슨 앞머리를 떼서 짧게(기본 true) */
  short?: boolean;
}

/**
 * 학생 사이트 레슨 주소. 문제 id 만 담아요.
 *   studentLink("https://aibasics.web.app", "u1_1_1", { hw: ["u1_1_1-q6"], ex: ["u1_1_1-q3"] })
 *   → "https://aibasics.web.app/#/l/u1_1_1?hw=q06&ex=q03"
 */
export function studentLink(base: string, lid: string, opts: StudentLinkOpts = {}): string {
  if (!LID_RE.test(lid)) throw new RangeError("레슨 id 가 올바르지 않아요: " + lid);
  const short = opts.short !== false;
  const clean = (ids: readonly string[] | undefined) => {
    const out: string[] = [];
    for (const id of ids || []) {
      if (!ID_RE.test(id)) continue;
      const s = short ? shortId(lid, id) : id;
      if (out.indexOf(s) < 0) out.push(s);
    }
    return out;
  };
  const hw = clean(opts.hw);
  const ex = clean(opts.ex);
  const q: string[] = [];
  if (hw.length) q.push("hw=" + hw.join(","));
  if (ex.length) q.push("ex=" + ex.join(","));
  return base.replace(/\/+$/, "") + "/#/l/" + lid + (q.length ? "?" + q.join("&") : "");
}

/** 학생 링크의 쿼리를 다시 읽어요(시험·미리보기용). 학생 사이트는 같은 규칙을 따로 구현해요 */
export function parseStudentLink(url: string): { lid: string; hw: string[]; ex: string[] } | null {
  const m = /#\/l\/(u\d+_\w+)(?:\?(.*))?$/.exec(url);
  if (!m) return null;
  const lid = m[1];
  const out = { lid, hw: [] as string[], ex: [] as string[] };
  for (const kv of (m[2] || "").split("&")) {
    const [k, v] = kv.split("=");
    if ((k === "hw" || k === "ex") && v) out[k] = v.split(",").filter((x) => ID_RE.test(x)).map((x) => expandId(lid, x));
  }
  return out;
}
