// 칠판 진행 순수 로직(DOM 없음): 장면별 공개 횟수, 문제 단계, 쪽 나누기, '다음'·'이전' 한 번.
// '다음'은 ① 남은 공개 → ② 남은 쪽(넘친 장면의 "이어서") → ③ 다음 켜진 장면 순서로 써요.
import type { Lesson, Question, Scene } from "../../shared/contracts.ts";

/** 보기 기호(공용 QuestionCard 와 같은 차례) */
export const CHOICE_KEYS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];

/* ─────────── 문제 한 개 단계 ─────────── */

/** 문제 공개 단계 이름 */
export type QStage = "hide" | "show" | "hint1" | "hint2" | "answer" | "sol";

export const QSTAGE_LABEL: Record<QStage, string> = {
  hide: "보기 가림",
  show: "보기",
  hint1: "힌트 1",
  hint2: "힌트 2",
  answer: "정답",
  sol: "풀이",
};

/** 문제마다 쓰는 단계: 고르기는 보기 가리기부터, 힌트가 없으면 건너뛰어요 */
export function qStages(q: Pick<Question, "type"> & { hints?: unknown; solution?: unknown }): QStage[] {
  const out: QStage[] = [];
  if (q.type === "choice") out.push("hide");
  out.push("show");
  const hs = Array.isArray(q.hints) ? (q.hints as unknown[]).filter((h) => !!h) : [];
  if (hs.length > 0) out.push("hint1");
  if (hs.length > 1) out.push("hint2");
  out.push("answer");
  if (q.solution) out.push("sol");
  return out;
}

/** 단계 r(0부터)까지 열렸을 때 각 단계가 열렸는지 */
export function stageOpen(stages: readonly QStage[], r: number, st: QStage): boolean {
  const i = stages.indexOf(st);
  return i >= 0 && i <= r;
}

/* ─────────── 장면 공개 횟수 ─────────── */

/** 장면 하나에서 '다음'으로 공개할 수 있는 횟수. 문제는 단계 수 - 1, 먼저 알고 가요는 카드 수(하나씩 뒤집기) */
export function revealMax(scene: Scene, lesson: Lesson | undefined): number {
  if (scene.kind === "problem") {
    const qb = scene.blocks.filter((b) => b.t === "q")[0] as { t: "q"; id: string } | undefined;
    const q = qb && lesson ? lesson.practice.filter((x) => x.id === qb.id)[0] : undefined;
    return q ? qStages(q).length - 1 : 0;
  }
  if (scene.kind === "prereq") {
    let n = 0;
    for (const b of scene.blocks) if (b.t === "term") n++;
    return n;
  }
  // 이야기는 문장을 한 번에 한 줄씩(모두 열기로 한 번에도 볼 수 있어요)
  if (scene.kind === "story") {
    let n = 0;
    for (const b of scene.blocks) if (b.t === "lines") n += b.items.length;
    return Math.max(0, n - 1);
  }
  return Math.max(0, scene.reveal | 0);
}

/* ─────────── 쪽 나누기(렌더 뒤 실제 높이로) ─────────── */

/**
 * 블록 위치(top·height)로 쪽 시작 위치를 정해요. 한 쪽 높이는 limit(896).
 * 블록 하나가 limit 보다 크면 그 블록에서 쪽을 나눠요(블록 안은 잘리지만 다음 쪽에 이어져요).
 */
export function pageStarts(blocks: readonly { top: number; height: number }[], limit: number): number[] {
  const starts = [0];
  let start = 0;
  for (const b of blocks) {
    const bottom = b.top + b.height;
    if (bottom - start <= limit) continue;
    // 앞 쪽에 다른 내용이 있을 때만 이 블록에서 새 쪽을 열어요(쪽 첫머리 블록이면 그대로 이어서 나눠요)
    if (b.top > start + 48) {
      start = b.top;
      starts.push(start);
    }
    // 블록 하나가 한 쪽보다 크면 limit 씩 나눠요
    while (bottom - start > limit) {
      start += limit;
      starts.push(start);
    }
  }
  return starts;
}

/** 블록 k 의 아래 끝이 보이는 쪽 */
export function pageOfBlock(starts: readonly number[], block: { top: number; height: number }, limit: number): number {
  const bottom = block.top + block.height;
  // 블록이 통째로 들어가는 가장 앞 쪽
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= block.top && bottom - starts[i] <= limit) return i;
  }
  // 한 쪽보다 큰 블록이면 블록이 시작하는 쪽
  let p = 0;
  for (let i = 0; i < starts.length; i++) if (starts[i] <= block.top) p = i;
  return p;
}

/* ─────────── 한 걸음 ─────────── */

export interface Pos {
  /** 장면 위치(전체 목록 안, 0부터) */
  s: number;
  /** 공개한 횟수 */
  r: number;
  /** 쪽(0부터). -1 은 '마지막 쪽'(이전으로 돌아왔을 때 재고 나서 정해요) */
  page: number;
}

export interface StepEnv {
  scenes: readonly Scene[];
  /** 장면 s 의 공개 횟수 */
  max: (s: number) => number;
  /** 지금 장면의 쪽 수(재기 전이면 1) */
  pages: number;
  /** 공개 r 일 때 보여야 하는 쪽(재기 전이면 0) */
  pageForReveal: (r: number) => number;
}

export function firstOn(scenes: readonly Scene[]): number {
  for (let i = 0; i < scenes.length; i++) if (scenes[i].on) return i;
  return 0;
}
export function lastOn(scenes: readonly Scene[]): number {
  for (let i = scenes.length - 1; i >= 0; i--) if (scenes[i].on) return i;
  return 0;
}
/** s 가 꺼진 장면이면 뒤쪽 첫 켜진 장면(없으면 앞쪽) */
export function snapOn(scenes: readonly Scene[], s: number): number {
  const k = Math.max(0, Math.min(scenes.length - 1, s));
  if (!scenes.length || scenes[k].on) return k;
  for (let i = k + 1; i < scenes.length; i++) if (scenes[i].on) return i;
  for (let i = k - 1; i >= 0; i--) if (scenes[i].on) return i;
  return k;
}

export function stepNext(pos: Pos, env: StepEnv): { pos: Pos; done: boolean } {
  const max = env.max(pos.s);
  const page = pos.page < 0 ? env.pages - 1 : pos.page;
  if (pos.r < max) {
    const r = pos.r + 1;
    return { pos: { s: pos.s, r, page: Math.max(page, env.pageForReveal(r)) }, done: false };
  }
  if (page < env.pages - 1) return { pos: { s: pos.s, r: pos.r, page: page + 1 }, done: false };
  for (let i = pos.s + 1; i < env.scenes.length; i++) if (env.scenes[i].on) return { pos: { s: i, r: 0, page: 0 }, done: false };
  return { pos: { s: pos.s, r: pos.r, page }, done: true };
}

export function stepPrev(pos: Pos, env: StepEnv): Pos {
  const page = pos.page < 0 ? env.pages - 1 : pos.page;
  if (pos.r > 0) {
    const r = pos.r - 1;
    return { s: pos.s, r, page: Math.min(page, Math.max(0, env.pageForReveal(r))) };
  }
  if (page > 0) return { s: pos.s, r: pos.r, page: page - 1 };
  for (let i = pos.s - 1; i >= 0; i--) if (env.scenes[i].on) return { s: i, r: env.max(i), page: -1 };
  return { s: pos.s, r: 0, page: 0 };
}

/** 진행 레일: 켜진 장면 번호(1부터)와 전체 수 */
export function railInfo(scenes: readonly Scene[], s: number): { n: number; total: number } {
  let n = 0;
  let total = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (!scenes[i].on) continue;
    total++;
    if (i <= s) n = total;
  }
  return { n, total };
}

/** 번호 뽑기: 1..max 에서 빼둔 번호(used)를 뺀 것 가운데 하나. rnd 는 0..1 */
export function drawNumber(max: number, used: readonly number[], rnd: number): number | null {
  const pool: number[] = [];
  for (let i = 1; i <= max; i++) if (used.indexOf(i) < 0) pool.push(i);
  if (!pool.length) return null;
  const k = Math.min(pool.length - 1, Math.floor(rnd * pool.length));
  return pool[k];
}

/** 타이머 표시 mm:ss */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + (r < 10 ? "0" : "") + r;
}

/* ─────────── 손들기 칸 ─────────── */

/** 손들기 칸 이름(보기 수만큼) */
export function tallyLabels(q: Question): string[] {
  if (q.type === "choice") return q.choices.map((_, i) => CHOICE_KEYS[i] || String(i + 1));
  if (q.type === "ox") return ["O", "X"];
  if (q.type === "number") return ["맞혔어요", "아직이에요"];
  return [];
}

/** 손들기 칸 가운데 정답 칸(없으면 -1) */
export function tallyAnswer(q: Question): number {
  if (q.type === "choice") return q.answer;
  if (q.type === "ox") return q.answer ? 0 : 1;
  if (q.type === "number") return 0;
  return -1;
}


/* ─────────── 머리: 구간 · 장면 번호 ─────────── */

/** 장면이 속한 구간 이름(도입·개념·문제·정리·수업 끝) */
export function segmentName(sc: Pick<Scene, "stage" | "kind">): string {
  switch (sc.stage) {
    case "open":
    case "prereq":
      return "도입";
    case "concept":
    case "tool":
      return "개념";
    case "practice":
      return "문제";
    case "wrap":
      return "정리";
    case "end":
      return "수업 끝";
  }
  return "수업";
}

/** 구간 열쇠: 소제목이 붙은 개념·체험·확인 문제는 소제목마다 한 구간이에요 */
function segmentKey(sc: Pick<Scene, "stage" | "kind" | "section">): string {
  const name = segmentName(sc);
  if (typeof sc.section === "number" && (sc.stage === "concept" || sc.stage === "tool" || sc.stage === "practice")) return "개념#" + sc.section;
  return name;
}

export interface SegmentInfo {
  /** 구간 이름(예: "개념②", "문제") */
  label: string;
  /** 지금 구간 번호(1부터)와 켜진 구간 수 */
  n: number;
  m: number;
  /** 켜진 장면 가운데 지금 번호(1부터)와 전체 */
  a: number;
  b: number;
  /** 꺼진 장면 수 */
  off: number;
}

/** 켜진 장면만 이어 보면서 같은 구간이 이어지는 덩어리를 한 구간으로 세요 */
export function segmentInfo(scenes: readonly Pick<Scene, "stage" | "kind" | "section" | "on">[], s: number): SegmentInfo {
  let m = 0;
  let n = 0;
  let a = 0;
  let b = 0;
  let off = 0;
  let prev = "";
  let label = "";
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    if (!sc.on) {
      off++;
      continue;
    }
    b++;
    const key = segmentKey(sc);
    if (key !== prev) {
      m++;
      prev = key;
    }
    if (i <= s) {
      a = b;
      n = m;
      label = key.indexOf("개념#") === 0 ? "개념" + circled((sc.section as number) + 1) : segmentName(sc);
    }
  }
  if (!label && scenes.length) label = segmentName(scenes[Math.max(0, Math.min(scenes.length - 1, s))]);
  return { label, n: Math.max(1, n), m: Math.max(1, m), a: Math.max(1, a), b: Math.max(1, b), off };
}

/* ─────────── 수업 끝 ─────────── */

const TAIL_PUNCT = /[\s.,!?;:·…、。，！？：；~\-–—(（[「『"'“‘]+$/;

/**
 * 한 줄 미리보기: 줄바꿈은 빈칸으로, 길면 잘라요. 수식($…$) 가운데서는 자르지 않고,
 * 자른 끝의 구두점·여는 괄호를 지운 뒤 '…'을 붙여요(예: "확률은," → "확률은…").
 */
export function clip(s: string, n: number): string {
  const t = (s || "").replace(/\s*\n\s*/g, " ").trim();
  if (t.length <= n) return t;
  let cut = t.slice(0, n);
  // 낱말 가운데서 자르지 않아요(남는 글이 너무 짧아지면 그대로)
  const word = cut.replace(/\s+\S*$/, "");
  if (word.length >= Math.min(8, n / 2)) cut = word;
  // 수식($…$) 가운데면 그 수식 앞에서 잘라요
  if ((cut.match(/\$/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  // 굵게(**) 표시가 짝이 안 맞으면 지워요
  if ((cut.match(/\*\*/g) || []).length % 2 === 1) cut = cut.replace(/\*\*(?!.*\*\*)/, "");
  cut = cut.replace(TAIL_PUNCT, "");
  return cut + "…";
}

/** 숙제 미리보기: 앞 max 개만 보이고 나머지는 '+n문제' */
export function hwPreview<T>(ids: readonly T[], max = 3): { shown: T[]; more: number } {
  const k = Math.max(0, max | 0);
  return { shown: ids.slice(0, k), more: Math.max(0, ids.length - k) };
}

/* ─────────── 개념 단계 공개 자리표시 ─────────── */

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

/** 1→①, 21 이상은 (21) */
export function circled(n: number): string {
  return n >= 1 && n <= 20 ? CIRCLED.charAt(n - 1) : "(" + n + ")";
}

/** 글 속 표시(수식·굵게)를 걷어낸 맨 글자 */
function plain(t: string): string {
  return (t || "")
    .replace(/\$\$[\s\S]*?\$\$/g, " 식 ")
    .replace(/\$[^$]*\$/g, " 식 ")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 공개 전 블록의 짧은 단서: 종류 이름과 첫 낱말(흐리게 보여 줘요) */
export function cueOf(b: { t: string; [k: string]: unknown }): { kind: string; word: string } {
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  let kind = "글";
  let src = "";
  switch (b.t) {
    case "p":
      src = str(b.text);
      break;
    case "math":
      return { kind: "수식", word: "" };
    case "table":
      kind = "표";
      src = Array.isArray(b.head) ? str((b.head as unknown[])[0]) : "";
      break;
    case "list":
      kind = "목록";
      src = Array.isArray(b.items) ? str((b.items as unknown[])[0]) : "";
      break;
    case "callout":
      kind = b.kind === "warn" ? "주의" : b.kind === "aha" ? "아하" : b.kind === "try" ? "해 봐요" : "도움말";
      src = str(b.title) || str(b.text);
      break;
    case "term":
      kind = "용어";
      src = str(b.term);
      break;
    case "dialog":
      kind = "대화";
      src = Array.isArray(b.lines) && b.lines.length ? str((b.lines[0] as { who?: unknown }).who) : "";
      break;
    case "example":
      kind = "예제";
      src = str(b.title);
      break;
    case "widget":
      return { kind: "체험", word: "" };
    default:
      src = str(b.text);
  }
  const p = plain(src);
  const first = p.split(" ")[0] || "";
  const word = first === "식" ? "" : first.replace(/[.,!?;:·…]+$/, "").slice(0, 10);
  return { kind, word };
}


/* ─────────── 정답 공개 한 줄 · 구간 막대 · 꺼진 장면 · 삽화 ─────────── */

/** 정답률 한 줄(득표 없으면 null): 80% 이상 다음으로 / 50~80% 풀이 한 번 더 / 50% 미만 개념 카드로 */
export function rateAdvice(rate: number | null): string | null {
  if (rate == null || !isFinite(rate)) return null;
  const r = Math.max(0, Math.min(100, Math.round(rate)));
  const tail = r >= 80 ? "다음으로 넘어가요" : r >= 50 ? "풀이를 한 번 더 봐요" : "개념 카드로 돌아가요";
  return "정답률 " + r + "% · " + tail;
}

export const PHASES = ["도입", "개념", "문제", "정리", "수업 끝"];

export interface PhaseItem {
  label: string;
  state: "past" | "cur" | "next";
}

/** 5구간(도입·개념·문제·정리·수업 끝) 가운데 켜진 장면이 있는 구간과 지금 구간 */
export function phaseBar(scenes: readonly Pick<Scene, "stage" | "kind" | "on">[], s: number): PhaseItem[] {
  const present: Record<string, boolean> = {};
  let cur = "";
  for (let i = 0; i < scenes.length; i++) {
    if (!scenes[i].on) continue;
    const n = segmentName(scenes[i]);
    present[n] = true;
    if (i <= s) cur = n;
  }
  if (!cur && scenes.length) cur = segmentName(scenes[0]);
  const list = PHASES.filter((n) => present[n] || n === cur);
  const ci = list.indexOf(cur);
  return list.map((label, i) => ({ label, state: i < ci ? "past" : i === ci ? "cur" : "next" }));
}

/** 꺼진 장면 위치 목록 */
export function offScenes(scenes: readonly Pick<Scene, "on">[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < scenes.length; i++) if (!scenes[i].on) out.push(i);
  return out;
}

/** 이야기 삽화: 공개 단계 step(0부터)에 맞춰 n 줄 가운데 어느 그림을 보일지(그림이 없으면 -1) */
export function storyImageAt(count: number, step: number, n: number): number {
  if (count <= 0) return -1;
  if (n <= 1) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor((Math.max(0, step) / n) * count)));
}

/** 첫 문장(수식 $…$ 안의 마침표는 문장 끝이 아니에요). 너무 길면 max 글자에서 자르지 않고 그대로 둬요 */
export function firstSentence(s: string): string {
  const t = (s || "").replace(/\s*\n\s*/g, " ").trim();
  let inMath = false;
  for (let i = 0; i < t.length; i++) {
    const c = t.charAt(i);
    if (c === "$") inMath = !inMath;
    if (inMath) continue;
    if ((c === "." || c === "!" || c === "?" || c === "。") && (i + 1 >= t.length || /\s/.test(t.charAt(i + 1)))) return t.slice(0, i + 1);
  }
  return t;
}

/** 숙제 문제 번호(레슨 연습 순서 기준 1부터, 없으면 0) */
export function practiceNo(practiceIds: readonly string[], id: string): number {
  const k = practiceIds.indexOf(id);
  return k < 0 ? 0 : k + 1;
}

/** 수업 끝 숙제 번호 줄: "6번 · 7번 · 10번"(번호를 못 찾은 문제는 순서로) */
export function hwNumbers(pids: readonly string[], hw: readonly string[]): string {
  return hw
    .map((id, i) => {
      const no = practiceNo(pids, id);
      return (no ? no : i + 1) + "번";
    })
    .join(" · ");
}

/** '수업 마치기' 단추가 하는 일: 이미 '끝'인 레슨을 '진행 중'으로 되돌리지 않아요 */
export function finishPlan(klass: string | null, cur: "done" | "part" | null | undefined, lastPeriod: boolean): { mark: "done" | "part" | null; hint: string } {
  if (!klass) return { mark: null, hint: "오늘 수업으로 돌아가요" };
  if (cur === "done" && !lastPeriod) return { mark: null, hint: klass + " 진도는 '끝' 그대로 둬요" };
  if (cur === "done") return { mark: "done", hint: klass + " 진도는 이미 '끝'이에요" };
  return { mark: lastPeriod ? "done" : "part", hint: klass + " 진도에 '" + (lastPeriod ? "끝" : "진행 중") + "' 표시" };
}
