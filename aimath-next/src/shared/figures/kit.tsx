// 도식 공용 부품: 틀(figure + svg + title/desc), 공개 단계 묶음, 아래첨자 글자, 화살촉.
// 색은 모두 tokens.css 의 CSS 변수로 칠해요(밝은·어두운·칠판 테마를 저절로 따라가요).
// CSS 파일은 따로 두지 않고(담당 구역 밖) style 속성으로만 꾸며요. Chrome 80 에서 안전한 SVG 기능만 써요.
import { useId, type CSSProperties, type ReactNode } from "react";
import type { Surface } from "../contracts.ts";
import { useUiSurface } from "../ui/surface.ts";
import type { FigureMeta, FigureProps } from "./types.ts";
import { clampStep } from "./place.ts";

/** 자주 쓰는 색(변수 + 대체값) */
export const C = {
  ink: "var(--ink, #1f2430)",
  ink2: "var(--ink-2, #4b5563)",
  line: "var(--line-strong, #7b8494)",
  soft: "var(--line, #d5dae3)",
  surface: "var(--surface, #ffffff)",
  surface2: "var(--surface-2, #eef1f6)",
  accent: "var(--accent, #4f46e5)",
  accentInk: "var(--accent-ink, #4338ca)",
  accentSoft: "var(--accent-soft, #eef0ff)",
  onAccent: "var(--on-accent, #ffffff)",
  ok: "var(--ok, #157238)",
  okBg: "var(--ok-bg, #e7f6ec)",
  bad: "var(--bad, #b91c1c)",
  badBg: "var(--bad-bg, #fdecec)",
  info: "var(--info, #1d4ed8)",
  infoBg: "var(--info-bg, #e8effe)",
  warn: "var(--warn, #9a3412)",
  warnBg: "var(--warn-bg, #fff3e0)",
} as const;

/** 수식 글꼴(번들에 든 KaTeX 글꼴이 있으면 그것, 없으면 시스템 세리프) */
export const MATH_FONT = '"KaTeX_Math", "Times New Roman", "Cambria Math", serif';

const DEFAULT_MAX: Record<Surface, number | undefined> = { phone: undefined, prep: 720, board: 960 };

interface FrameProps {
  meta: FigureMeta;
  props: FigureProps;
  viewBox: string;
  children: ReactNode;
  /** 표면별로 viewBox 가로 비율이 다를 때(세로 배치) 최대 너비를 따로 */
  maxWidth?: number;
}

/**
 * 그림 틀. <figure> 안에 role="img" svg 를 두고 title·desc 를 aria-labelledby/aria-describedby 로 이어요.
 * 공개 단계가 남아 있어도 desc 는 전체 설명이에요(스크린 리더는 그림 전체를 한 번에 들어요).
 */
export function FigureFrame({ meta, props, viewBox, children, maxWidth }: FrameProps) {
  const sf = useUiSurface(props.surface);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tId = "fig-t-" + uid;
  const dId = "fig-d-" + uid;
  const mw = props.maxWidth || maxWidth || DEFAULT_MAX[sf];
  const style: CSSProperties = { marginLeft: "auto", marginRight: "auto" };
  if (mw) style.maxWidth = mw + "px";
  const showCap = props.caption !== false;
  return (
    <figure
      className={"figure fig fig-" + meta.id + " is-" + sf + (props.className ? " " + props.className : "")}
      style={style}
      data-figure={meta.id}
    >
      <svg
        viewBox={viewBox}
        role="img"
        aria-labelledby={tId}
        aria-describedby={dId}
        focusable="false"
        style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        fontFamily="inherit"
      >
        <title id={tId}>{meta.title}</title>
        <desc id={dId}>{meta.desc}</desc>
        {children}
      </svg>
      {showCap ? <figcaption>{meta.caption}</figcaption> : null}
    </figure>
  );
}

/** 공개 단계 계산 훅 비슷한 도우미: shown(i) 는 i 번째 부분(1부터)이 보이는가 */
export function useReveal(meta: FigureMeta, props: FigureProps): { shown: (part: number) => boolean; step: number } {
  const step = clampStep(props.step, meta.steps);
  return { step, shown: (part: number) => part <= step };
}

/** 공개 단계 묶음. 숨겨도 자리는 그대로(장면 높이가 흔들리지 않아요) */
export function Part({ on, children }: { on: boolean; children: ReactNode }) {
  const style: CSSProperties = {
    opacity: on ? 1 : 0,
    transition: "opacity var(--d-mid, 240ms) ease-out",
    pointerEvents: on ? undefined : "none",
  };
  return (
    <g style={style} aria-hidden={on ? undefined : true}>
      {children}
    </g>
  );
}

/**
 * 아래첨자 붙은 기호(예: x₁). <text> 안에 넣어요.
 * 다음 글자가 아래로 밀리지 않게 끝에서 기준선을 되돌려요.
 */
export function Sub({ base, sub, italic = true }: { base: string; sub: string; italic?: boolean }) {
  return (
    <>
      <tspan fontFamily={MATH_FONT} fontStyle={italic ? "italic" : undefined}>
        {base}
      </tspan>
      <tspan fontSize="0.68em" dy="0.32em">
        {sub}
      </tspan>
      <tspan dy="-0.32em">{"​"}</tspan>
    </>
  );
}

/** 기울인 수학 기호 하나 */
export function M({ children }: { children: ReactNode }) {
  return (
    <tspan fontFamily={MATH_FONT} fontStyle="italic">
      {children}
    </tspan>
  );
}

/** 화살촉 marker. 같은 화면에 그림이 여럿이어도 id 가 겹치지 않게 uid 를 받아요 */
export function ArrowDefs({ id, color }: { id: string; color: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M0,0 L10,5 L0,10 z" style={{ fill: color }} />
      </marker>
    </defs>
  );
}

/** svg 안 marker 용 고유 id */
export function useSvgId(prefix: string): string {
  return prefix + "-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

/** 글자 공통 style(SVG 표현 속성은 var() 를 못 받아서 style 로 줘요) */
export function fillStyle(color: string, extra?: CSSProperties): CSSProperties {
  return extra ? { fill: color, ...extra } : { fill: color };
}
export function strokeStyle(color: string, width: number, extra?: CSSProperties): CSSProperties {
  return { stroke: color, strokeWidth: width, fill: "none", ...(extra || {}) };
}
