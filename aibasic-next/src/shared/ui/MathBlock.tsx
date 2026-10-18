// math 블록(별도 줄 수식). 인공지능 기초에는 수식이 없어서 KaTeX 없이 원문을 줄마다 코드 모양으로만 보여 줘요.
import type { Surface } from "../contracts.ts";
import { Tex } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

export interface MathBlockProps {
  tex: string | string[];
  surface?: Surface;
  /** 읽기 도구용 이름표(없으면 '수식') */
  label?: string;
}

export function MathBlock(props: MathBlockProps) {
  const sf = useUiSurface(props.surface);
  const lines = Array.isArray(props.tex) ? props.tex : [props.tex];
  return (
    <div className={"ui-math is-" + sf} role="group" aria-label={props.label || "수식"}>
      {lines.map((l, i) => (
        <Tex key={i} tex={l} display />
      ))}
    </div>
  );
}
