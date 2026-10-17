// 개념 소제목(Section)의 블록들을 휴대폰 카드 여러 장으로 나눠요.
// 규칙
//  - 카드 한 장의 무게 예산은 기본 6이에요(weightOf 참고).
//  - example(예제)과 widget(체험 도구)은 늘 혼자 한 장을 써요.
//  - callout aha(아하!)는 새 카드를 열지 않고 바로 앞 카드에 붙어요(예산을 넘어도 붙어요).
//  - 이어지는 term(용어) 블록은 한 묶음으로 같은 카드에 들어가요(묶음이 예산보다 크면 예산 단위로 나눠요).
//  - math·table·list 가 넘쳐서 새 카드로 갈 때, 바로 앞의 문단(p)도 함께 데려가요(설명과 식이 떨어지지 않게).
// 블록을 빠뜨리거나 겹치지 않아요: 모든 카드의 idx 를 이으면 0..n-1 이 순서대로 나와요.

import type { LBlock } from "./types.ts";

export type SectionCardKind = "flow" | "example" | "widget";

export interface SectionCard<B = LBlock> {
  kind: SectionCardKind;
  blocks: B[];
  /** 원래 blocks 배열에서의 위치 */
  idx: number[];
  weight: number;
}

export interface SplitSectionOptions {
  /** 카드 한 장의 무게 예산(기본 6) */
  budget?: number;
}

function textLen(s: string): number {
  // 수식은 글자 수가 실제 보이는 폭보다 길어서 절반으로 쳐요.
  let n = 0;
  const parts = s.split("$");
  for (let i = 0; i < parts.length; i++) n += i % 2 === 1 ? Math.ceil(parts[i].length / 2) : parts[i].length;
  return n;
}

function lenWeight(s: string): number {
  const n = textLen(s);
  if (n <= 60) return 1;
  if (n <= 140) return 2;
  if (n <= 260) return 3;
  return 4;
}

/** 블록 한 개의 무게(대략 휴대폰 한 화면의 1/6 을 1로 봐요). */
export function weightOf(b: LBlock): number {
  switch (b.t) {
    case "p":
      return lenWeight(b.text);
    case "math":
      return Array.isArray(b.tex) ? Math.max(1, b.tex.length) : 1;
    case "term":
      return textLen(b.def) > 120 ? 2 : 1;
    case "callout":
      return 1 + (textLen(b.text) > 120 ? 1 : 0);
    case "table":
      return Math.min(6, 1 + Math.ceil(b.rows.length / 2));
    case "list": {
      let w = 0;
      for (const it of b.items) w += textLen(it) > 60 ? 1 : 0.5;
      return Math.max(1, Math.ceil(w));
    }
    case "dialog":
      return Math.max(1, Math.ceil(b.lines.length / 2));
    case "example":
      return 6;
    case "widget":
      return 6;
  }
}

const isAlone = (b: LBlock) => b.t === "example" || b.t === "widget";
const isAha = (b: LBlock) => b.t === "callout" && b.kind === "aha";
const isGlued = (b: LBlock) => b.t === "math" || b.t === "table" || b.t === "list";

export function splitSection<B extends LBlock>(blocks: readonly B[], opts: SplitSectionOptions = {}): SectionCard<B>[] {
  const budget = opts.budget && opts.budget > 0 ? opts.budget : 6;
  const cards: SectionCard<B>[] = [];
  // 함수 안에서 바꾸는 값이라 상자에 담아요(타입 좁히기가 꼬이지 않게).
  const st: { cur: SectionCard<B> | null } = { cur: null };

  const flush = () => {
    if (st.cur && st.cur.blocks.length) cards.push(st.cur);
    st.cur = null;
  };
  const open = (kind: SectionCardKind = "flow"): SectionCard<B> => {
    flush();
    const c: SectionCard<B> = { kind, blocks: [], idx: [], weight: 0 };
    st.cur = c;
    return c;
  };
  const put = (c: SectionCard<B>, i: number, w: number) => {
    c.blocks.push(blocks[i]);
    c.idx.push(i);
    c.weight += w;
  };

  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const w = weightOf(b);

    if (isAha(b)) {
      // 앞 카드(열린 카드가 없으면 마지막으로 닫힌 카드)에 붙여요.
      const target: SectionCard<B> | undefined = st.cur ? st.cur : cards.length ? cards[cards.length - 1] : undefined;
      if (target) put(target, i, w);
      else put(open(), i, w);
      i++;
      continue;
    }

    if (isAlone(b)) {
      const c = open(b.t === "example" ? "example" : "widget");
      put(c, i, w);
      flush();
      i++;
      continue;
    }

    if (b.t === "term") {
      // 이어지는 용어를 한 묶음으로 모아요.
      let j = i;
      const ws: number[] = [];
      while (j < blocks.length && blocks[j].t === "term") ws.push(weightOf(blocks[j++]));
      const total = ws.reduce((a, x) => a + x, 0);
      let c: SectionCard<B> = st.cur && st.cur.kind === "flow" && st.cur.weight + total <= budget ? st.cur : open();
      for (let k = i; k < j; k++) {
        const wk = ws[k - i];
        if (c.blocks.length && c.weight + wk > budget) c = open();
        put(c, k, wk);
      }
      i = j;
      continue;
    }

    let c: SectionCard<B> = st.cur && st.cur.kind === "flow" ? st.cur : open();
    if (c.blocks.length && c.weight + w > budget) {
      const prevPos = c.blocks.length - 1;
      const prev = c.blocks[prevPos];
      const pw = weightOf(prev);
      const carry = isGlued(b) && prev.t === "p" && c.blocks.length >= 2 && pw + w <= budget;
      if (carry) {
        const pi = c.idx[prevPos];
        c.blocks.pop();
        c.idx.pop();
        c.weight -= pw;
        c = open();
        put(c, pi, pw);
      } else {
        c = open();
      }
    }
    put(c, i, w);
    i++;
  }
  flush();
  return cards;
}
