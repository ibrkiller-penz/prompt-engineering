// 레슨 카드 넘기기의 카드 목록 만들기. 순수 함수(DOM·저장소 없음, node --test 로 시험).
//
// 단계(step) 순서: story(이야기) → prereq(먼저 알고 가요) → c1…cN(개념 소제목) → wrap(정리)
//   story  : 문단 1개 = 카드 1장(말풍선으로 나눔) + 마지막 '오늘의 핵심 질문 · 내 생각 한 줄' 카드
//   prereq : 안내 카드 1장 + 항목마다 1장('알아요/헷갈려요')
//   cN     : splitSection 으로 나눈 카드들 + 소제목 끝 확인 문제 카드(plan.sectionChecks 가 있을 때)
//   wrap   : 정리 · 돌아보기 · 다음으로 3장
// 주소의 card 는 1부터 세요(#/l/:lid/s/:step/:card).
import type { LBlock } from "../../shared/logic/types.ts";
import { splitSection, type SectionCardKind } from "../../shared/logic/splitSection.ts";
import { splitStory, type StorySeg } from "../../shared/logic/splitStory.ts";

/** 카드 만들기에 필요한 레슨 모양(원본 Lesson 을 그대로 넘겨도 돼요) */
export interface DeckLesson {
  story: string[];
  question: string;
  prereq?: { title: string; intro?: string; items: { term: string; text: string }[] };
  sections: { heading: string; blocks: LBlock[] }[];
  summary: string[];
}

export type DeckCard =
  | { k: "story"; idx: number; segs: StorySeg[]; ok: boolean }
  | { k: "think" }
  | { k: "prereq-intro"; title: string; intro: string; count: number }
  | { k: "prereq"; i: number; term: string; text: string }
  | { k: "blocks"; sec: number; kind: SectionCardKind; idx: number[]; first: boolean; last: boolean }
  | { k: "check"; sec: number; qids: string[] }
  | { k: "summary" }
  | { k: "reflect" }
  | { k: "next" };

export type StepKind = "story" | "prereq" | "concept" | "wrap";

export interface DeckStep {
  id: string; // "story" | "prereq" | "c1".. | "wrap"
  kind: StepKind;
  label: string; // 화면 이름
  sec?: number; // 개념이면 소제목 번호(0부터)
  cards: DeckCard[];
}

export function buildDeck(l: DeckLesson, checks: readonly (readonly string[])[] = []): DeckStep[] {
  const steps: DeckStep[] = [];
  const story = (l.story || []).filter((p) => typeof p === "string" && p.trim().length > 0);
  if (story.length) {
    const cards: DeckCard[] = splitStory(story).map((c) => ({ k: "story" as const, idx: c.idx, segs: c.segs, ok: c.ok }));
    cards.push({ k: "think" });
    steps.push({ id: "story", kind: "story", label: "이야기", cards });
  }
  if (l.prereq && l.prereq.items && l.prereq.items.length) {
    const cards: DeckCard[] = [{ k: "prereq-intro", title: l.prereq.title || "먼저 알고 가요", intro: l.prereq.intro || "", count: l.prereq.items.length }];
    l.prereq.items.forEach((it, i) => cards.push({ k: "prereq", i, term: it.term, text: it.text }));
    steps.push({ id: "prereq", kind: "prereq", label: "먼저 알고 가요", cards });
  }
  l.sections.forEach((s, si) => {
    const parts = splitSection(s.blocks);
    const cards: DeckCard[] = parts.map((p, pi) => ({ k: "blocks" as const, sec: si, kind: p.kind, idx: p.idx, first: pi === 0, last: pi === parts.length - 1 }));
    if (!cards.length) cards.push({ k: "blocks", sec: si, kind: "flow", idx: [], first: true, last: true });
    const qids = (checks[si] || []).filter((x) => typeof x === "string" && x.length > 0);
    if (qids.length) cards.push({ k: "check", sec: si, qids: qids.slice() });
    steps.push({ id: "c" + (si + 1), kind: "concept", label: "개념 " + (si + 1), sec: si, cards });
  });
  steps.push({ id: "wrap", kind: "wrap", label: "정리", cards: [{ k: "summary" }, { k: "reflect" }, { k: "next" }] });
  return steps;
}

export interface DeckPos {
  s: number; // 단계 번호(0부터)
  c: number; // 카드 번호(0부터)
}

/** 주소의 step·card 를 위치로. 없는 단계면 null, 카드 번호는 범위 안으로 맞춰요 */
export function locate(steps: readonly DeckStep[], stepId: string, card: string | number): DeckPos | null {
  let s = -1;
  for (let i = 0; i < steps.length; i++) if (steps[i].id === stepId) s = i;
  if (s < 0) return null;
  const n = typeof card === "number" ? card : /^\d+$/.test(String(card)) ? parseInt(String(card), 10) : 1;
  const max = steps[s].cards.length;
  const c = Math.max(1, Math.min(max, n || 1)) - 1;
  return { s, c };
}

/** 다음 카드(없으면 null = 레슨 끝) */
export function nextPos(steps: readonly DeckStep[], p: DeckPos): DeckPos | null {
  if (p.c + 1 < steps[p.s].cards.length) return { s: p.s, c: p.c + 1 };
  if (p.s + 1 < steps.length) return { s: p.s + 1, c: 0 };
  return null;
}

/** 이전 카드(없으면 null = 레슨 처음) */
export function prevPos(steps: readonly DeckStep[], p: DeckPos): DeckPos | null {
  if (p.c > 0) return { s: p.s, c: p.c - 1 };
  if (p.s > 0) return { s: p.s - 1, c: steps[p.s - 1].cards.length - 1 };
  return null;
}

/** 전체에서 몇 번째 카드인지(0부터)와 모두 몇 장인지 */
export function flatIndex(steps: readonly DeckStep[], p: DeckPos): { i: number; total: number } {
  let i = 0;
  let total = 0;
  steps.forEach((st, si) => {
    if (si < p.s) i += st.cards.length;
    total += st.cards.length;
  });
  return { i: i + p.c, total };
}

/** 카드를 떠나 앞으로 갈 때 '소제목 끝을 지나감'으로 칠 소제목 번호(없으면 null).
 *  끝 확인 문제가 있으면 확인 카드에 닿을 때, 없으면 마지막 카드에서 '다음'을 누를 때예요. */
export function passedSectionOnArrive(card: DeckCard): number | null {
  return card.k === "check" ? card.sec : null;
}
export function passedSectionOnLeave(steps: readonly DeckStep[], p: DeckPos): number | null {
  const st = steps[p.s];
  if (st.kind !== "concept" || st.sec === undefined) return null;
  const card = st.cards[p.c];
  const isLast = p.c === st.cards.length - 1;
  if (isLast && card.k === "blocks") return st.sec;
  return null;
}

/** 레슨에 처음 들어올 때 시작할 단계: 이야기 → 먼저 알고 가요 → 개념 1 */
export function firstStepId(steps: readonly DeckStep[]): string {
  return steps.length ? steps[0].id : "c1";
}

/** 개념 단계 id("c3") → 소제목 번호(2). 아니면 -1 */
export function secOfStep(id: string): number {
  const m = /^c(\d+)$/.exec(id);
  return m ? parseInt(m[1], 10) - 1 : -1;
}

/** 머리 제목용 짧은 소제목: 앞 번호·괄호 풀이를 걷고, 길면 뒤쪽을 '…'로 줄여요(앞에는 말줄임을 붙이지 않아요).
 *  수식($…$)이 들어 있으면 수식 가운데서 자르지 않아요. */
export function shortHeading(h: string, max = 16): string {
  let t = String(h || "")
    .replace(/^\s*\d+\.\s*/, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // "A: B", "A — B" 처럼 덧붙인 설명은 앞부분만
  const m = /^(.{4,}?)\s*(?::|—|–| - )\s+/.exec(t);
  if (m && t.length > max) t = m[1].trim();
  if (t.length <= max) return t;
  let cut = t.slice(0, max);
  if ((cut.match(/\$/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  const sp = cut.lastIndexOf(" ");
  if (sp >= Math.floor(max / 2)) cut = cut.slice(0, sp);
  cut = cut.replace(/[\s,.·:;—–-]+$/, "");
  return cut ? cut + "…" : t.slice(0, max) + "…";
}

/** 머리 제목: 개념 단계면 "개념 n · 짧은 제목", 그 밖이면 단계 이름 */
export function deckTitle(step: DeckStep, headings: readonly string[]): string {
  if (step.kind === "concept" && step.sec !== undefined && headings[step.sec] !== undefined) {
    const s = shortHeading(headings[step.sec]);
    return s ? step.label + " · " + s : step.label;
  }
  return step.label;
}

/** 이야기 단계의 위치(위 칩과 아래 막대가 같은 값을 쓰게): n 은 1부터, total 은 그 단계 카드 수 */
export function storyCount(steps: readonly DeckStep[], p: DeckPos): { n: number; total: number } | null {
  const st = steps[p.s];
  if (!st || st.kind !== "story") return null;
  return { n: p.c + 1, total: st.cards.length };
}
