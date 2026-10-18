// 칠판 장면 자동 생성(buildScenes)과 시간 배분. 순수 로직(DOM 없음), 같은 입력이면 늘 같은 결과.
//
// 장면 차례
//   핵심 질문(차시 질문 1~2줄)
//   → 도입: 1차시는 [이야기 나머지(꺼짐) → 이야기 한 장면(켜짐, 이야기 마지막 문단)], 2차시부터는 '지난 시간 되짚기'(이전 차시 정리 2~3줄)
//   → 먼저 알고 가요(1차시)
//   → 소제목마다 [개념 장면(예산 100으로 나눔; example 은 단독) → 그 소제목의 체험 도구 → 소제목 끝 확인 문제 1개]
//   → 남은 칠판 문제('문제' 구간) → (AI 이야기: 기본 꺼짐, 마지막 차시) → 정리(summaryForPeriod) → 끝(QR)
//
// 시간: 기본은 장면을 자동으로 끄지 않아요. 넘치면 over(분)와 '줄이기 제안'(suggest: 끌 장면 목록)을 함께 돌려줘요.
//   제안도 소제목마다 확인 문제 1개는 남겨요.
//
// 개념 예산(measure.logic.ts 의 blockWeight): p = 글자수/6, math = 18/줄, table = 12/행 + 20.
//   6행 초과나 5열 이상인 표, example, widget 은 혼자 한 장면이에요.
// 높이: 모든 장면은 896px(BOARD_BODY_H) 안에 들어가야 해요. 넘치면 글자를 한 단계 줄이고(fsDown=1),
//   그래도 넘치면 "이어서" 장면으로 나눠요(part). 큰 표는 행을 나눠 머리줄을 다시 붙이고, 긴 예제는 풀이 단계를 나눠요.
import type { Block, Lesson, PlanLesson, Question, Scene, SceneBlock, SceneKind, SceneStage } from "../../shared/contracts.ts";
import { BODY_H, BOARD_FS, blockWeight, codeLines, exampleSceneHeight, isBigTable, linesSceneHeight, qHeight, stackHeight } from "./measure.logic.ts";
import { lessonPeriods, periodQuestion, pickPeriod, recapLines, summaryForPeriod, type PeriodInfo } from "./periods.logic.ts";
import { pickAll, questionSections, sectionCheckIds, type PickSet } from "./pick.logic.ts";

export const CONCEPT_BUDGET = 100;

/** 장면 + 만든 근거(검사·흐름 화면용). Scene 자리에 그대로 넘겨도 돼요 */
export interface BuiltScene extends Scene {
  /** 개념·예제·체험 장면이 담은 원본 블록 위치(소제목 번호, 블록 번호) */
  src?: { s: number; b: number }[];
  /** 어림 높이(px, fsDown 반영) */
  h: number;
  /** 기본 예상 분(시간 배분 전) */
  baseMin: number;
  /** 문제 장면이면 문제 id */
  qid?: string;
  /** 소제목 끝 확인 문제 장면이면 그 소제목 번호(줄이기 제안에서도 끄지 않아요) */
  secCheck?: number;
}

/** 줄이기 제안: 이 장면들을 끄면 수업 시간 안에 들어와요 */
export interface CutSuggestion {
  /** 끄자고 제안하는 장면 id(이어서 조각 포함) */
  dropped: string[];
  /** 제안대로 껐을 때(applyFlow 로 끈 흐름과 같은 계산) 켜진 장면 예상 분 합 */
  total: number;
  /** 제안대로 꺼도 남는 넘침(분). 필수 장면만으로도 길면 0 보다 커요 */
  over: number;
  /** 제안대로 껐을 때 숙제로 돌아갈 문제 id */
  toHw: string[];
}

export interface BuildOptions {
  /** 이야기 장면 켜기(기본 꺼짐) */
  story?: boolean;
  /** AI 이야기 장면 켜기(기본 꺼짐) */
  aiStory?: boolean;
  /** 칠판 문제를 직접 정해서 넘길 때(교사 바구니). 없으면 plan/자동 */
  board?: readonly string[];
  /** 시간 배분을 하지 않고 기본 예상 분만(검사용) */
  noAllocate?: boolean;
  /** 마지막 차시에서 정리를 '이 레슨 전체 정리'로(기본은 이 차시 소제목 줄만) */
  fullSummary?: boolean;
  /** 예전처럼 시간이 넘치면 덜 중요한 장면을 자동으로 끄기(기본 false: 끄지 않고 제안만) */
  autoDrop?: boolean;
}

export interface LessonFlow {
  lid: string;
  period: PeriodInfo;
  periods: PeriodInfo[];
  minutes: number;
  scenes: BuiltScene[];
  pick: PickSet;
  /** 켜진 장면 예상 분 합 */
  total: number;
  /** 수업 시간을 넘는 분(0 이면 들어맞아요). "시간이 n분 넘쳐요 · 줄이기" 안내에 써요 */
  over: number;
  /** 시간이 모자라 자동으로 끈 장면 id(autoDrop 일 때만. 기본은 빈 목록) */
  dropped: string[];
  /** 넘칠 때 줄이기 제안(넘치지 않으면 dropped 가 빈 목록) */
  suggest: CutSuggestion;
  /** 꺼진 문제 장면의 문제 id — '숙제로' 돌아가요 */
  toHw: string[];
}

type L = Lesson;

/* ─────────── 장면 하나 만들기 ─────────── */

interface Draft {
  id: string;
  stage: SceneStage;
  kind: SceneKind;
  title?: string;
  blocks: SceneBlock[];
  reveal: number;
  required: boolean;
  on: boolean;
  baseMin: number;
  section?: number;
  src?: { s: number; b: number }[];
  qid?: string;
  /** 문제 장면 높이 계산용 */
  q?: Question;
  /** "이어서"로 나눈 조각(머리줄에 이어서 이름표가 붙어요) */
  split?: boolean;
  /** 소제목 끝 확인 문제 */
  secCheck?: number;
}

const LINES_KINDS: SceneKind[] = ["story", "aiStory", "summary"];
const isLinesKind = (k: SceneKind) => LINES_KINDS.indexOf(k) >= 0;

function linesItems(blocks: readonly SceneBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) if (b.t === "lines") for (const it of b.items) out.push(it);
  return out;
}

function exampleOf(blocks: readonly SceneBlock[]): Extract<Block, { t: "example" }> | null {
  for (const b of blocks) if (b.t === "example") return b;
  return null;
}

function heightOf(d: Draft, fs: number): number {
  if (d.kind === "widget" || d.kind === "qr") return BODY_H;
  if (d.kind === "problem" && d.q) {
    const q = d.q as Question & { choices?: string[] };
    return qHeight({ prompt: q.prompt, type: q.type, choices: q.choices }, fs);
  }
  // 정리·이야기 줄과 예제는 실제 그리기(제목 줄·상자·안쪽 여백)에 맞춘 어림을 써요
  if (isLinesKind(d.kind) && d.blocks.every((b) => b.t === "lines")) return linesSceneHeight(linesItems(d.blocks), fs, { title: d.title, summary: d.kind === "summary" });
  const ex = d.kind === "example" ? exampleOf(d.blocks) : null;
  if (ex && d.blocks.length === 1) return exampleSceneHeight(ex, fs, !!d.split);
  return stackHeight(d.blocks, fs);
}

/** 높이에 맞춰 fsDown 을 정하거나 "이어서" 장면으로 나눠요 */
function fit(d: Draft, splitter?: (d: Draft) => Draft[] | null): BuiltScene[] {
  const h0 = heightOf(d, BOARD_FS[0]);
  if (h0 <= BODY_H) return [finish(d, 0, h0)];
  const h1 = heightOf(d, BOARD_FS[1]);
  if (h1 <= BODY_H) return [finish(d, 1, h1)];
  const parts = splitter ? splitter(d) : null;
  if (parts && parts.length > 1) {
    const out: BuiltScene[] = [];
    const n = parts.length;
    parts.forEach((pd, i) => {
      for (const s of fit(pd)) {
        s.part = { i: i + 1, n };
        out.push(s);
      }
    });
    // 나눈 조각이 다시 나뉘었으면 번호를 다시 매겨요
    out.forEach((s, i) => (s.part = { i: i + 1, n: out.length }));
    return out;
  }
  // 더 나눌 수 없으면 줄인 글자로 둬요(검사에서 걸려요)
  return [finish(d, 1, h1)];
}

function finish(d: Draft, fsDown: 0 | 1, h: number): BuiltScene {
  const s: BuiltScene = {
    id: d.id,
    stage: d.stage,
    kind: d.kind,
    blocks: d.blocks,
    reveal: d.reveal,
    required: d.required,
    on: d.on,
    estMin: d.baseMin,
    baseMin: d.baseMin,
    h,
  };
  if (d.title !== undefined) s.title = d.title;
  if (d.section !== undefined) s.section = d.section;
  if (d.src) s.src = d.src;
  if (d.qid) s.qid = d.qid;
  if (d.secCheck !== undefined) s.secCheck = d.secCheck;
  if (fsDown) s.fsDown = 1;
  return s;
}

/** 블록 목록을 896px 에 맞게 여러 묶음으로(앞에서부터 채움). 첫 묶음 앞머리(heading)는 첫 조각에만 */
function packByHeight(blocks: SceneBlock[], fs: number, cap: number = BODY_H): SceneBlock[][] {
  const out: SceneBlock[][] = [];
  let cur: SceneBlock[] = [];
  for (const b of blocks) {
    const next = cur.concat([b]);
    if (cur.length && stackHeight(next, fs) > cap) {
      out.push(cur);
      cur = [b];
    } else cur = next;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** 블록 하나가 혼자서도 넘칠 때 잘게: 표는 행을 나누고(머리줄 반복), 예제는 풀이 단계를 나눠요 */
function splitBlock(b: SceneBlock, fs: number): SceneBlock[] {
  if (stackHeight([b], fs) <= BODY_H) return [b];
  if (b.t === "table" && b.rows.length > 1) {
    const half = Math.ceil(b.rows.length / 2);
    const a: Block = { t: "table", head: b.head, rows: b.rows.slice(0, half) };
    const c: Block = b.caption ? { t: "table", head: b.head, rows: b.rows.slice(half), caption: b.caption } : { t: "table", head: b.head, rows: b.rows.slice(half) };
    return splitBlock(a, fs).concat(splitBlock(c, fs));
  }
  if (b.t === "example" && b.steps.length > 1) {
    const half = Math.ceil(b.steps.length / 2);
    const a: Block = { t: "example", title: b.title, problem: b.problem, steps: b.steps.slice(0, half), answer: "" };
    const c: Block = { t: "example", title: b.title + " (이어서)", problem: "", steps: b.steps.slice(half), answer: b.answer };
    return splitBlock(a, fs).concat(splitBlock(c, fs));
  }
  if (b.t === "code" && codeLines(b.code) > 1) {
    const lines = b.code.replace(/\s+$/, "").split("\n");
    const half = Math.ceil(lines.length / 2);
    const a: Block = { t: "code", code: lines.slice(0, half).join("\n"), lang: b.lang };
    const c: Block = { t: "code", code: lines.slice(half).join("\n"), lang: b.lang };
    return splitBlock(a, fs).concat(splitBlock(c, fs));
  }
  if (b.t === "lines" && b.items.length > 1) {
    const half = Math.ceil(b.items.length / 2);
    return splitBlock({ t: "lines", items: b.items.slice(0, half) }, fs).concat(splitBlock({ t: "lines", items: b.items.slice(half) }, fs));
  }
  if (b.t === "list" && b.items.length > 1) {
    const half = Math.ceil(b.items.length / 2);
    const a: Block = { t: "list", items: b.items.slice(0, half), ordered: b.ordered };
    const c: Block = { t: "list", items: b.items.slice(half), ordered: b.ordered };
    return splitBlock(a, fs).concat(splitBlock(c, fs));
  }
  return [b];
}

/** 조각 Draft 들에 id·제목·공개·시간을 매겨요 */
function asParts(d: Draft, groups: SceneBlock[][], contTitle = true): Draft[] {
  const totalW = groups.length;
  return groups.map((blocks, i) => ({
    ...d,
    id: i === 0 ? d.id : d.id + "+" + (i + 1),
    title: contTitle && d.title !== undefined && i > 0 ? d.title + " (이어서)" : d.title,
    blocks,
    reveal: revealFor(d.kind, blocks),
    baseMin: Math.max(0.5, Math.round((d.baseMin / totalW) * 2) / 2),
    required: d.required,
    split: true,
  }));
}

/**
 * 정리·이야기 줄 나누기: 기본 글자(32px)에서 896px 에 들도록 줄을 앞에서부터 채워요.
 * 한 줄이 혼자서도 넘치면 그 줄만 한 장면에 둬요(fit 이 글자를 줄여요).
 */
function splitLines(d: Draft): Draft[] | null {
  const fs = BOARD_FS[0];
  const items = linesItems(d.blocks);
  if (items.length < 2) return null;
  const opts = { title: d.title + " (이어서)", summary: d.kind === "summary" };
  const groups: string[][] = [];
  let cur: string[] = [];
  for (const it of items) {
    const next = cur.concat([it]);
    if (cur.length && linesSceneHeight(next, fs, opts) > BODY_H) {
      groups.push(cur);
      cur = [it];
    } else cur = next;
  }
  if (cur.length) groups.push(cur);
  if (groups.length < 2) {
    // 32px 로는 한 장면에 다 들어가는데 fit 이 여기까지 왔으면 반으로 나눠요(안전)
    const half = Math.ceil(items.length / 2);
    groups.length = 0;
    groups.push(items.slice(0, half), items.slice(half));
  }
  return asParts(
    d,
    groups.map((g) => [{ t: "lines", items: g } as SceneBlock]),
  );
}

/**
 * 예제 나누기: 첫 조각은 문제 + 앞 풀이 단계, 다음 조각은 "(이어서)" 제목과 남은 단계, 답은 마지막 조각에.
 * 기본 글자(32px)에서 896px 에 들도록 단계를 앞에서부터 채워요.
 */
function splitExample(d: Draft): Draft[] | null {
  const ex = exampleOf(d.blocks);
  if (!ex || d.blocks.length !== 1 || ex.steps.length < 2) return null;
  const fs = BOARD_FS[0];
  type Ex = Extract<Block, { t: "example" }>;
  const parts: Ex[] = [];
  let cur: Ex = { t: "example", title: ex.title, problem: ex.problem, steps: [], answer: "" };
  const fits = (e: Ex) => exampleSceneHeight(e, fs, true) <= BODY_H;
  for (const st of ex.steps) {
    const next: Ex = { ...cur, steps: cur.steps.concat([st]) };
    if (cur.steps.length && !fits(next)) {
      parts.push(cur);
      cur = { t: "example", title: ex.title + " (이어서)", problem: "", steps: [st], answer: "" };
    } else cur = next;
  }
  const withAns: Ex = { ...cur, answer: ex.answer };
  if (!ex.answer || fits(withAns) || !cur.steps.length) parts.push(withAns);
  else {
    parts.push(cur);
    parts.push({ t: "example", title: ex.title + " (이어서)", problem: "", steps: [], answer: ex.answer });
  }
  if (parts.length < 2) {
    const half = Math.ceil(ex.steps.length / 2);
    parts.length = 0;
    parts.push({ t: "example", title: ex.title, problem: ex.problem, steps: ex.steps.slice(0, half), answer: "" });
    parts.push({ t: "example", title: ex.title + " (이어서)", problem: "", steps: ex.steps.slice(half), answer: ex.answer });
  }
  // 예제 제목은 블록 안 제목을 쓰므로 장면 제목은 그대로 둬요(머리띠·레일에 같은 이름 + 이어서 번호)
  return asParts(
    d,
    parts.map((p) => [p as SceneBlock]),
    false,
  );
}

/** 일반 장면 나누기: 기본 글자(32px) 기준으로 높이에 맞춰 조각내요 */
function splitDraft(d: Draft): Draft[] | null {
  if (isLinesKind(d.kind)) return splitLines(d);
  if (d.kind === "example") {
    const r = splitExample(d);
    if (r) return r;
  }
  const fs = BOARD_FS[0];
  let pieces: SceneBlock[] = [];
  for (const b of d.blocks) pieces = pieces.concat(splitBlock(b, fs));
  let groups = packByHeight(pieces, fs);
  if (groups.length < 2) return null;
  // 고르게 나눠요: 같은 조각 수가 나오는 가장 낮은 한도로 다시 채워요(앞 조각만 꽉 차서 어림 오차로 넘치는 일을 막아요)
  const n = groups.length;
  const total = stackHeight(pieces, fs);
  for (let cap = Math.ceil(total / n); cap < BODY_H; cap += 16) {
    const g = packByHeight(pieces, fs, cap);
    if (g.length === n) {
      groups = g;
      break;
    }
  }
  return asParts(d, groups);
}

/** 단계 공개 횟수: 개념은 블록 하나씩, 예제는 풀이 단계 + 답, 정리·이야기는 한 줄씩 */
export function revealFor(kind: SceneKind, blocks: readonly SceneBlock[]): number {
  if (kind === "concept") {
    const n = blocks.filter((b) => b.t !== "heading").length;
    return Math.max(0, n - 1);
  }
  if (kind === "example") {
    let n = 0;
    for (const b of blocks) if (b.t === "example") n += b.steps.length + (b.answer ? 1 : 0);
    return n;
  }
  if (kind === "summary" || kind === "prereq") {
    let n = 0;
    for (const b of blocks) n += b.t === "lines" ? b.items.length : b.t === "term" ? 1 : 0;
    return Math.max(0, n - 1);
  }
  if (kind === "problem") return 2; // 정답 → 풀이
  return 0;
}

/**
 * 장면 안 블록 k 가 몇 번째 공개에서 보이는지(0 = 처음부터).
 * 개념: 블록 하나씩(소제목 줄은 처음부터). 정리·먼저 알고 가요: 줄 하나씩. 그 밖은 0.
 */
export function revealStepOf(scene: Pick<Scene, "kind" | "blocks">, k: number): number {
  if (scene.kind === "concept") {
    let n = -1;
    for (let i = 0; i <= k && i < scene.blocks.length; i++) if (scene.blocks[i].t !== "heading") n++;
    return Math.max(0, n);
  }
  return 0;
}

const round05 = (x: number) => Math.max(0.5, Math.round(x * 2) / 2);

/* ─────────── 개념 묶기(예산 100) ─────────── */

function conceptDrafts(lesson: L, s: number): { concept: Draft[]; widgets: Draft[] } {
  const sec = lesson.sections[s];
  const concept: Draft[] = [];
  const widgets: Draft[] = [];
  let cur: { blocks: SceneBlock[]; src: { s: number; b: number }[]; w: number } | null = null;
  let k = 0;
  let ex = 0;
  const heading: SceneBlock = { t: "heading", text: sec.heading };

  const flush = () => {
    if (!cur || !cur.blocks.length) {
      cur = null;
      return;
    }
    const blocks: SceneBlock[] = k === 0 ? [heading as SceneBlock].concat(cur.blocks) : cur.blocks;
    concept.push({
      id: "c" + (s + 1) + "-" + (k + 1),
      stage: "concept",
      kind: "concept",
      title: sec.heading,
      blocks,
      reveal: revealFor("concept", blocks),
      required: true,
      on: true,
      baseMin: round05(Math.min(3, 1 + cur.w / 60)),
      section: s,
      src: cur.src,
    });
    k++;
    cur = null;
  };

  sec.blocks.forEach((b, bi) => {
    if (b.t === "widget") {
      widgets.push({
        id: "w" + (s + 1) + "-" + b.id,
        stage: "tool",
        kind: "widget",
        title: b.caption || sec.heading,
        blocks: [b],
        reveal: 0,
        required: false,
        on: true,
        baseMin: 6,
        section: s,
        src: [{ s, b: bi }],
      });
      return;
    }
    if (b.t === "example") {
      flush();
      // 소제목 첫 장면이 예제면 소제목 줄을 예제 앞에 붙이지 않고, 개념 장면 번호도 쓰지 않아요
      const blocks: SceneBlock[] = [b];
      concept.push({
        id: "ex" + (s + 1) + "-" + ++ex,
        stage: "concept",
        kind: "example",
        title: b.title,
        blocks,
        reveal: revealFor("example", blocks),
        required: false,
        on: true,
        baseMin: round05(Math.min(5, 2 + 0.4 * b.steps.length)),
        section: s,
        src: [{ s, b: bi }],
      });
      return;
    }
    const w = blockWeight(b);
    if (isBigTable(b)) {
      flush();
      cur = { blocks: [b], src: [{ s, b: bi }], w: Math.max(w, CONCEPT_BUDGET) };
      flush();
      return;
    }
    if (cur && cur.w + w > CONCEPT_BUDGET) {
      // 식·표·목록이 넘칠 때 바로 앞 설명 문단을 데려가요(설명과 식이 떨어지지 않게)
      const glued = b.t === "math" || b.t === "table" || b.t === "list" || b.t === "code";
      const last = cur.blocks[cur.blocks.length - 1];
      if (glued && last && last.t === "p" && cur.blocks.length >= 2) {
        const lw = blockWeight(last as Block);
        if (lw + w <= CONCEPT_BUDGET) {
          const lsrc = cur.src[cur.src.length - 1];
          cur.blocks.pop();
          cur.src.pop();
          cur.w -= lw;
          flush();
          cur = { blocks: [last], src: [lsrc], w: lw };
        } else flush();
      } else flush();
    }
    if (!cur) cur = { blocks: [], src: [], w: 0 };
    cur.blocks.push(b);
    cur.src.push({ s, b: bi });
    cur.w += w;
  });
  flush();
  return { concept, widgets };
}

/* ─────────── 레슨 → 장면 ─────────── */

function linesScenes(base: Omit<Draft, "blocks" | "reveal">, items: string[]): BuiltScene[] {
  const blocks: SceneBlock[] = [{ t: "lines", items }];
  const d: Draft = { ...base, blocks, reveal: revealFor(base.kind, blocks) };
  return fit(d, splitDraft);
}

/** 칠판 문제 장면 하나 */
function problemDraft(q: Question, secCheck?: number): Draft {
  const blocks: SceneBlock[] = [{ t: "q", id: q.id }];
  const d: Draft = {
    id: "q:" + q.id,
    stage: "practice",
    kind: "problem",
    title: q.group,
    blocks,
    reveal: revealFor("problem", blocks),
    required: false,
    on: true,
    baseMin: q.level <= 2 ? 1.5 : q.level === 3 ? 2 : 3,
    qid: q.id,
    q,
  };
  if (secCheck !== undefined) {
    d.secCheck = secCheck;
    d.section = secCheck;
  }
  return d;
}

/**
 * 한 차시의 장면 흐름을 만들어요(시간 배분 포함).
 * @param lesson  레슨 원본(content/aimath 의 lesson-N.json)
 * @param plan    data/plan.json 의 이 레슨 항목(없으면 자동)
 * @param minutes 수업 시간(45·50·70)
 * @param period  차시 번호(1부터). 0 이면 레슨 전체
 */
export function buildLessonFlow(lesson: L, plan: PlanLesson | null | undefined, minutes: number, period: number, opts: BuildOptions = {}): LessonFlow {
  const periods = lessonPeriods(lesson, plan, minutes);
  const per = pickPeriod(periods, period, lesson.sections.length);
  const pick = pickAll(lesson, plan, per);
  const has = (id: string) => lesson.practice.some((q) => q.id === id);
  const board = opts.board ? opts.board.filter(has) : pick.board;
  const byId = (id: string) => lesson.practice.filter((x) => x.id === id)[0];
  const scenes: BuiltScene[] = [];
  const push = (arr: BuiltScene[]) => {
    for (const s of arr) scenes.push(s);
  };

  // 소제목 끝 확인: 칠판 목록에 든 것만 소제목 자리로 옮겨요(교사가 바구니에서 뺀 것은 넣지 않아요)
  const checkOf: Record<number, string> = {};
  for (const c of sectionCheckIds(lesson, plan, per.sections)) if (board.indexOf(c.id) >= 0) checkOf[c.s] = c.id;
  // 바구니를 직접 정했는데 그 소제목 확인 문제가 없으면, 바구니 안에서 그 소제목 문제 하나를 자리로 옮겨요
  if (opts.board) {
    const secOf = questionSections(lesson, plan);
    const used: string[] = [];
    for (const k in checkOf) used.push(checkOf[k]);
    for (const s of per.sections) {
      if (checkOf[s]) continue;
      const id = board.filter((x) => used.indexOf(x) < 0 && secOf[x] === s)[0];
      if (id) {
        checkOf[s] = id;
        used.push(id);
      }
    }
  }
  const checkIds: string[] = [];
  for (const k in checkOf) checkIds.push(checkOf[k]);

  // 1) 핵심 질문(차시 질문 1~2줄)
  push(
    linesScenes(
      { id: "question", stage: "open", kind: "question", title: "오늘의 핵심 질문", required: true, on: true, baseMin: 1.5 },
      periodQuestion(lesson, plan, per),
    ),
  );

  // 2) 도입: 1차시는 이야기(나머지 꺼짐 + 한 장면 켜짐), 2차시부터는 지난 시간 되짚기
  if (per.first && lesson.story && lesson.story.length) {
    const story = lesson.story.slice();
    const brief = story.pop() as string;
    if (story.length)
      push(
        linesScenes(
          { id: "story", stage: "open", kind: "story", title: "이야기", required: false, on: !!opts.story, baseMin: round05(1 + story.length * 0.5) },
          story,
        ),
      );
    push(
      linesScenes(
        { id: "story-brief", stage: "open", kind: "story", title: "이야기 한 장면", required: false, on: true, baseMin: 1.5 },
        [brief],
      ),
    );
  }
  if (!per.first && per.p > 1) {
    const prev = periods[per.p - 2];
    const lines = prev ? recapLines(lesson, plan, prev) : [];
    if (lines.length)
      push(
        linesScenes({ id: "recap", stage: "open", kind: "summary", title: "지난 시간 되짚기", required: false, on: true, baseMin: round05(0.5 + lines.length * 0.5) }, lines),
      );
  }

  // 3) 먼저 알고 가요(첫 차시만)
  if (per.first && lesson.prereq && lesson.prereq.items.length) {
    const pr = lesson.prereq;
    const blocks: SceneBlock[] = [];
    if (pr.intro) blocks.push({ t: "p", text: pr.intro });
    for (const it of pr.items) blocks.push({ t: "term", term: it.term, def: it.text });
    push(
      fit(
        {
          id: "prereq",
          stage: "prereq",
          kind: "prereq",
          title: pr.title || "먼저 알고 가요",
          blocks,
          reveal: revealFor("prereq", blocks),
          required: false,
          on: true,
          baseMin: round05(1.5 + 0.4 * pr.items.length),
        },
        splitDraft,
      ),
    );
  }

  // 4) 소제목마다 [개념 → 체험 → 확인 문제 1개]
  for (const s of per.sections) {
    const { concept, widgets } = conceptDrafts(lesson, s);
    for (const d of concept) push(fit(d, splitDraft));
    for (const w of widgets) push(fit(w));
    const cid = checkOf[s];
    const cq = cid ? byId(cid) : undefined;
    if (cq) push(fit(problemDraft(cq, s)));
  }

  // 5) 남은 칠판 문제('문제' 구간)
  for (const qid of board) {
    if (checkIds.indexOf(qid) >= 0) continue;
    const q = byId(qid);
    if (q) push(fit(problemDraft(q)));
  }

  // 6) AI 이야기(기본 꺼짐, 마지막 차시만)
  if (per.last && lesson.aiStory && lesson.aiStory.paragraphs && lesson.aiStory.paragraphs.length) {
    push(
      linesScenes(
        { id: "ai", stage: "wrap", kind: "aiStory", title: lesson.aiStory.title, required: false, on: !!opts.aiStory, baseMin: 3 },
        lesson.aiStory.paragraphs.slice(),
      ),
    );
  }

  // 7) 정리(이 차시 소제목 줄. 마지막 차시에서 fullSummary 면 레슨 전체)
  const sum = summaryForPeriod(lesson, plan, per, { whole: !!opts.fullSummary });
  push(linesScenes({ id: "summary", stage: "wrap", kind: "summary", title: sum.title, required: true, on: true, baseMin: 2 }, sum.lines));

  // 8) 끝(QR)
  scenes.push(finish({ id: "end", stage: "end", kind: "qr", title: "수업 끝", blocks: [], reveal: 0, required: true, on: true, baseMin: 1.5 }, 0, BODY_H));

  const res = opts.noAllocate
    ? { scenes, total: sumOn(scenes), dropped: [] as string[], over: Math.max(0, sumOn(scenes) - minutes) }
    : allocate(scenes, minutes, { drop: !!opts.autoDrop });
  const suggest = opts.noAllocate ? { dropped: [], total: res.total, over: res.over, toHw: [] } : suggestCuts(scenes, minutes);
  return {
    lid: lesson.id,
    period: per,
    periods,
    minutes,
    scenes: res.scenes,
    pick: { board: board.slice(), exit: pick.exit, hw: pick.hw },
    total: res.total,
    over: res.over,
    dropped: res.dropped,
    suggest,
    toHw: homeworkFromOff(res.scenes),
  };
}

/** 칠판 장면 목록(시간 배분까지 한 결과). 자세한 정보가 필요하면 buildLessonFlow */
export function buildScenes(lesson: L, plan: PlanLesson | null | undefined, minutes: number, period: number, opts: BuildOptions = {}): BuiltScene[] {
  return buildLessonFlow(lesson, plan, minutes, period, opts).scenes;
}

/* ─────────── 시간 배분 ─────────── */

/** 예상 분을 이만큼까지 줄여 맞출 수 있다고 봐요(그 아래로는 장면을 꺼요) */
export const SQUEEZE = 0.7;
/** 한 차시에 켜 둘 장면 수 상한(넘으면 덜 중요한 장면부터 꺼요) */
export const MAX_ON = 45;

export function sumOn(scenes: readonly Scene[]): number {
  let t = 0;
  for (const s of scenes) if (s.on) t += s.estMin;
  return Math.round(t * 2) / 2;
}

export interface AllocateResult<S> {
  scenes: S[];
  total: number;
  /** 이번 배분에서 끈 장면 id(drop: false 면 빈 목록) */
  dropped: string[];
  /** 수업 시간을 넘는 분(0.5분 단위, 0 이상) */
  over: number;
}

/**
 * 켜진 장면의 예상 분을 수업 시간에 맞춰요.
 *  1) drop(기본 true)일 때만: 0.7배로 줄여도 넘치면 덜 중요한 것부터 꺼요: 소제목마다 둘째 이후 예제 → '문제' 구간 칠판 문제 6번째부터
 *     → 먼저 알고 가요 → 이야기 한 장면 · 지난 시간 되짚기 → 남은 예제 → 둘째 이후 체험 → '문제' 구간 칠판 문제 4·5번째.
 *     필수(질문·개념·정리·끝)와 소제목 끝 확인 문제(secCheck)는 끄지 않아요. 칠판 문제는 적어도 3개는 남겨요.
 *  2) 남거나 모자란 시간은 장면 분량에 비례해 늘리거나(최대 1.5배) 줄여요(drop 이면 최소 0.5배, 아니면 0.7배). 0.5분 단위.
 *     그래도 넘치면 over 에 넘친 분을 적어요.
 */
export function allocate<S extends Scene & { baseMin?: number; secCheck?: number }>(
  input: readonly S[],
  minutes: number,
  opts: { drop?: boolean } = {},
): AllocateResult<S> {
  const drop = opts.drop !== false;
  const scenes = input.map((s) => ({ ...s, estMin: s.baseMin !== undefined ? s.baseMin : s.estMin }));
  const dropped: string[] = [];
  const base = () => {
    let t = 0;
    for (const s of scenes) if (s.on) t += s.estMin;
    return t;
  };
  const off = (s: S) => {
    if (!s.on || s.required || s.secCheck !== undefined) return;
    s.on = false;
    dropped.push(s.id);
  };
  const problems = scenes.filter((s) => s.kind === "problem" && s.secCheck === undefined);
  const examples = scenes.filter((s) => s.kind === "example");
  const firstEx: Record<number, string> = {};
  for (const e of examples) if (e.section !== undefined && firstEx[e.section] === undefined) firstEx[e.section] = e.id.replace(/\+\d+$/, "");
  const exRoot = (e: S) => e.id.replace(/\+\d+$/, "");
  const steps: (() => S[])[] = [
    () => examples.filter((e) => e.section === undefined || firstEx[e.section] !== exRoot(e)).reverse(),
    () => problems.slice(5).reverse(),
    () => scenes.filter((s) => s.kind === "prereq"),
    () => scenes.filter((s) => s.id === "story-brief" || s.id === "recap"),
    () => examples.slice().reverse(),
    () => scenes.filter((s) => s.kind === "widget").slice(1).reverse(),
    () => problems.slice(3, 5).reverse(),
  ];
  // 예상 분은 0.7배까지는 줄여서 맞출 수 있다고 보고, 그래도 넘칠 때만 꺼요
  const room = minutes / SQUEEZE;
  const onCount = () => scenes.filter((s) => s.on).length;
  const tooMuch = () => base() > room || onCount() > MAX_ON;
  for (const step of drop ? steps : []) {
    if (!tooMuch()) break;
    for (const s of step()) {
      if (!tooMuch()) break;
      // "이어서" 조각은 한꺼번에 꺼요
      const root = exRoot(s);
      for (const t of scenes) if (exRoot(t) === root) off(t);
    }
  }
  const t0 = base();
  if (t0 > 0) {
    const floor = drop ? 0.5 : SQUEEZE;
    const f = Math.max(floor, Math.min(1.5, minutes / t0));
    for (const s of scenes) s.estMin = round05(s.estMin * f);
    // 0.5분 반올림으로 생긴 차이를 큰 장면부터 0.5분씩 고쳐요(배율 한도 안에서)
    const lo = t0 * floor;
    const hi = t0 * 1.5;
    const target = Math.max(lo, Math.min(hi, minutes));
    const ons = scenes.filter((s) => s.on).sort((a, b) => b.estMin - a.estMin);
    for (let guard = 0; guard < 400 && ons.length; guard++) {
      const t = base();
      if (t > target + 0.25) {
        const s = ons.filter((x) => x.estMin > 1)[guard % Math.max(1, ons.filter((x) => x.estMin > 1).length)];
        if (!s) break;
        s.estMin -= 0.5;
      } else if (t < target - 0.25) {
        ons[guard % ons.length].estMin += 0.5;
      } else break;
    }
  }
  const total = sumOn(scenes);
  return { scenes, total, dropped, over: Math.max(0, total - minutes) };
}

/**
 * 줄이기 제안: 지금 켜진 장면 그대로 자동 끄기(allocate drop)를 해 보고, 끄게 되는 장면을 돌려줘요(장면은 바꾸지 않아요).
 * 넘치지 않으면 빈 목록. 소제목 끝 확인 문제는 제안에도 넣지 않아요.
 */
export function suggestCuts<S extends Scene & { baseMin?: number; secCheck?: number; qid?: string }>(scenes: readonly S[], minutes: number): CutSuggestion {
  const r = allocate(scenes, minutes, { drop: true });
  // 제안대로 끈 흐름을 다시 배분(자동 끄기 없이)한 합 — 교사가 '줄이기'를 누른 뒤 보게 될 값과 같아요
  const offs = r.dropped;
  const after = allocate(
    scenes.map((s) => (offs.indexOf(s.id) >= 0 ? { ...s, on: false } : s)),
    minutes,
    { drop: false },
  );
  return { dropped: offs, total: after.total, over: after.over, toHw: homeworkFromOff(after.scenes) };
}

/** '필수만': 필수 장면(과 소제목 끝 확인 문제)만 켜고 다시 배분해요 */
export function requiredOnly<S extends Scene & { baseMin?: number; secCheck?: number }>(scenes: readonly S[], minutes: number): AllocateResult<S> {
  return allocate(
    scenes.map((s) => ({ ...s, on: s.required || s.secCheck !== undefined })),
    minutes,
    { drop: false },
  );
}

/** "이어서" 조각 id(ex1-2+2)의 뿌리 id(ex1-2). 조각이 아니면 그대로 */
export function sceneRoot(id: string): string {
  return id.replace(/\+\d+$/, "");
}

/** 교사가 흐름 화면에서 바꾼 값(켜기/끄기·분)을 덮어써요. 필수 장면은 끌 수 없어요 */
export function applyFlow<S extends Scene & { baseMin?: number; secCheck?: number; qid?: string }>(
  scenes: readonly S[],
  state: { off?: readonly string[]; on?: readonly string[]; min?: Record<string, number> } | null | undefined,
  minutes: number,
): AllocateResult<S> & { suggest: CutSuggestion } {
  if (!state) {
    const r0 = allocate(scenes, minutes, { drop: false });
    return { ...r0, suggest: suggestCuts(scenes, minutes) };
  }
  // "이어서" 조각(id+2, id+3…)은 한 장면처럼 함께 켜고 꺼요(예제 앞쪽만 켜져 답이 빠지는 일이 없게)
  const offs = (state.off || []).map(sceneRoot);
  const ons = (state.on || []).map(sceneRoot);
  const toggled = scenes.map((s) => {
    let on = s.on;
    const root = sceneRoot(s.id);
    if (ons.indexOf(root) >= 0) on = true;
    if (offs.indexOf(root) >= 0 && !s.required) on = false;
    return { ...s, on };
  });
  // 교사가 직접 켠 장면은 자동으로 끄지 않게 필수처럼 다뤄요(배분이 끝나면 원래대로)
  const pinned = toggled.map((s) => (ons.indexOf(sceneRoot(s.id)) >= 0 ? { ...s, required: true } : s));
  // 교사가 고친 흐름은 자동으로 끄지 않아요(넘치면 over 와 제안만)
  const res = allocate(pinned, minutes, { drop: false });
  const suggest = suggestCuts(pinned, minutes);
  res.scenes = res.scenes.map((s, i) => {
    const m = state.min ? state.min[s.id] : undefined;
    const out = { ...s, required: toggled[i].required };
    if (typeof m === "number" && m > 0 && m <= 60) out.estMin = round05(m);
    return out;
  });
  res.total = sumOn(res.scenes);
  res.over = Math.max(0, res.total - minutes);
  return { ...res, suggest };
}

/** 꺼진 칠판 문제는 숙제로 돌아가요 */
export function homeworkFromOff(scenes: readonly (Scene & { qid?: string })[]): string[] {
  const out: string[] = [];
  for (const s of scenes) {
    if (s.kind !== "problem" || s.on) continue;
    const id = s.qid || (s.id.indexOf("q:") === 0 ? s.id.slice(2) : "");
    if (id && out.indexOf(id) < 0) out.push(id);
  }
  return out;
}

/** 시간 배분 막대: 단계별 켜진 장면 분 합(차례 고정) */
export const STAGE_ORDER: SceneStage[] = ["open", "prereq", "concept", "tool", "practice", "wrap", "end"];
export const STAGE_LABEL: Record<SceneStage, string> = {
  open: "질문",
  prereq: "먼저 알고 가요",
  concept: "개념",
  tool: "체험",
  practice: "문제",
  wrap: "정리",
  end: "끝",
};
export function timeBars(scenes: readonly Scene[]): { stage: SceneStage; label: string; min: number; count: number }[] {
  return STAGE_ORDER.map((stage) => {
    let min = 0;
    let count = 0;
    for (const s of scenes)
      if (s.on && s.stage === stage) {
        min += s.estMin;
        count++;
      }
    return { stage, label: STAGE_LABEL[stage], min: Math.round(min * 2) / 2, count };
  }).filter((b) => b.count > 0);
}

/** 켜진 장면만, 화면 번호(1부터)와 함께 */
export function onScenes<S extends Scene>(scenes: readonly S[]): { n: number; scene: S }[] {
  const out: { n: number; scene: S }[] = [];
  for (const s of scenes) if (s.on) out.push({ n: out.length + 1, scene: s });
  return out;
}

/** '다음' 한 번: 남은 공개가 있으면 공개, 없으면 다음 켜진 장면으로 */
export function nextStep(scenes: readonly Scene[], s: number, r: number): { s: number; r: number; done: boolean } {
  const cur = scenes[s];
  if (cur && r < cur.reveal) return { s, r: r + 1, done: false };
  for (let i = s + 1; i < scenes.length; i++) if (scenes[i].on) return { s: i, r: 0, done: false };
  return { s, r, done: true };
}

/** '이전' 한 번: 공개를 되돌리고, 처음이면 앞 켜진 장면(다 공개된 상태)으로 */
export function prevStep(scenes: readonly Scene[], s: number, r: number): { s: number; r: number } {
  if (r > 0) return { s, r: r - 1 };
  for (let i = s - 1; i >= 0; i--) if (scenes[i].on) return { s: i, r: scenes[i].reveal };
  return { s, r };
}
