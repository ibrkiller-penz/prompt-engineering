// 도식을 레슨 블록 사이 어디에 끼울지 정하는 순수 함수(DOM 없음, node --test 가능).
import type { FigureAnchor } from "./types.ts";

interface BlockLike {
  t: string;
  text?: unknown;
  items?: unknown;
  title?: unknown;
  head?: unknown;
}

/** 블록의 첫 글(비교용). 굵게(**)·공백 차이는 무시해요 */
export function blockLead(b: BlockLike): string {
  let s = "";
  if (typeof b.text === "string") s = b.text;
  else if (Array.isArray(b.items) && typeof b.items[0] === "string") s = b.items[0];
  else if (typeof b.title === "string") s = b.title;
  else if (Array.isArray(b.head) && typeof b.head[0] === "string") s = b.head.join(" ");
  return norm(s);
}

function norm(s: string): string {
  return s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

/**
 * 한 소제목 안에서 그림이 들어갈 블록 번호를 찾아요.
 * match 로 찾으면 그 블록, 못 찾으면 after(블록 수를 넘으면 마지막 블록). 블록이 없으면 -1.
 */
export function anchorIndex(a: FigureAnchor, blocks: readonly BlockLike[]): number {
  if (!blocks.length) return -1;
  if (a.match) {
    const m = norm(a.match);
    for (let i = 0; i < blocks.length; i++) {
      if (blockLead(blocks[i]).indexOf(m) === 0) return i;
    }
  }
  return Math.max(0, Math.min(blocks.length - 1, a.after));
}

/**
 * 소제목 하나의 블록 목록에 그림을 배치해요.
 * 결과: 블록 번호 → 그 블록 '뒤에' 올 그림들(연결표 순서 유지).
 */
export function placeInSection<T extends FigureAnchor>(
  entries: readonly T[],
  section: number,
  blocks: readonly BlockLike[],
): Record<number, T[]> {
  const out: Record<number, T[]> = {};
  for (const e of entries) {
    if (e.section !== section) continue;
    const i = anchorIndex(e, blocks);
    if (i < 0) continue;
    (out[i] || (out[i] = [])).push(e);
  }
  return out;
}

/** 공개 단계 계산: step 이 없으면 전부, 있으면 0..total 로 자름 */
export function clampStep(step: number | undefined, total: number): number {
  if (typeof step !== "number" || !isFinite(step)) return total;
  return Math.max(0, Math.min(total, Math.floor(step)));
}
