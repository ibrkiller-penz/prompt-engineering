// 레슨 id → 도식 연결표. 학생 카드(개발2)와 칠판 장면(개발5)은 이 파일만 import 해요.
//
// 쓰는 법
//   import { figuresFor, figuresInSection, Figure, Badge } from "@shared/figures";   (또는 상대 경로 …/shared/figures/index.ts)
//   const figs = figuresInSection("u1-1", 2, section.blocks); // { [블록번호]: FigureEntry[] } — 그 블록 '뒤'에 그려요
//   <Figure id="net-342" step={reveal} surface="board" />     // step 없으면 전부, 칠판은 0..entry.steps
//   <Badge who="서하" withName />
//
// 약속
//  - 도식은 문장을 새로 쓴 것이고, 레슨 본문(content/aimath)은 그대로 둬요. 그림 없이도 본문만으로 뜻이 통해요.
//  - 공개 단계 수는 entry.steps, 단계 이름은 entry.stepLabels. 칠판 '다음'은 step 을 1씩 올리다가 steps 에 닿으면 다음 장면으로.
//  - 높이: 가로 그림은 너비의 약 0.6~0.7배. 칠판 기본 최대 너비 960px(높이 ≤ 650px)라 896px 무대 안에 들어가요.
//    휴대폰에서 3-4-2 신경망은 세로로 그려요(최대 너비 420px).
import { createElement, type ComponentType } from "react";
import type { FigureId, FigureMeta, FigureProps } from "./types.ts";
import { FIGURE_META } from "./meta.ts";
import { placeInSection } from "./place.ts";
import AiNested from "./AiNested.tsx";
import Neuron from "./Neuron.tsx";
import Network342 from "./Network342.tsx";
import Turing from "./Turing.tsx";
import XorPoints from "./XorPoints.tsx";

export type { FigureAnchor, FigureId, FigureMeta, FigureProps } from "./types.ts";
export { FIGURE_META } from "./meta.ts";
export { anchorIndex, blockLead, clampStep, placeInSection } from "./place.ts";
export { default as Badge, characterInfo, useDarkTone, CHARACTER_NAMES } from "./Badge.tsx";
export type { BadgeProps, Character } from "./Badge.tsx";

const COMPONENTS: Record<FigureId, ComponentType<FigureProps>> = {
  "ai-nested": AiNested,
  neuron: Neuron,
  "net-342": Network342,
  turing: Turing,
  "xor-points": XorPoints,
};

export interface FigureEntry extends FigureMeta {
  Component: ComponentType<FigureProps>;
}

const ENTRIES: FigureEntry[] = FIGURE_META.map((m) => ({ ...m, Component: COMPONENTS[m.id] }));

/** 레슨 id → 도식 목록(소제목·블록 순서) */
export const FIGURES: Readonly<Record<string, readonly FigureEntry[]>> = (() => {
  const out: Record<string, FigureEntry[]> = {};
  for (const e of ENTRIES) (out[e.lid] || (out[e.lid] = [])).push(e);
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.section - b.section || a.after - b.after);
  return out;
})();

/** 이 레슨의 도식(없으면 빈 배열). section 을 주면 그 소제목 것만 */
export function figuresFor(lid: string, section?: number): readonly FigureEntry[] {
  const all = FIGURES[lid] || [];
  return typeof section === "number" ? all.filter((e) => e.section === section) : all;
}

/** 소제목 블록 사이 배치: 블록 번호 → 그 블록 뒤에 올 도식들 */
export function figuresInSection(
  lid: string,
  section: number,
  blocks: readonly { t: string }[],
): Record<number, FigureEntry[]> {
  return placeInSection(figuresFor(lid, section), section, blocks);
}

/** id 로 한 줄 찾기 */
export function figureEntry(id: string): FigureEntry | undefined {
  for (const e of ENTRIES) if (e.id === id) return e;
  return undefined;
}

/** id 로 도식 그리기. 모르는 id 면 아무것도 그리지 않아요 */
export function Figure(props: FigureProps & { id: string }) {
  const e = figureEntry(props.id);
  if (!e) return null;
  return createElement(e.Component, {
    step: props.step,
    surface: props.surface,
    caption: props.caption,
    maxWidth: props.maxWidth,
    className: props.className,
  });
}
