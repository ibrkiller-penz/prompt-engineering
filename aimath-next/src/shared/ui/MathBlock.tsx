// 따로 한 줄로 보이는 수식(KaTeX htmlAndMathml).
// 넘치면 먼저 0.85배로 줄여 보고, 그래도 넘칠 때만 가로 스크롤과 '옆으로 밀어 봐요' 힌트를 보여요.
import { useEffect, useState } from "react";
import type { Surface } from "../contracts.ts";
import { Tex } from "./tex.tsx";
import { useOverflowX, useUiSurface } from "./surface.ts";

export interface MathBlockProps {
  tex: string | string[];
  surface?: Surface;
  /** 읽기 도구용 이름표(없으면 '수식') */
  label?: string;
}

export function MathBlock({ tex, surface, label }: MathBlockProps) {
  const sf = useUiSurface(surface);
  const lines = Array.isArray(tex) ? tex : [tex];
  const key = lines.join("\n");
  const [shrink, setShrink] = useState(false);
  const [ref, over] = useOverflowX<HTMLDivElement>([key, shrink, sf]);
  useEffect(() => setShrink(false), [key]);
  useEffect(() => {
    if (over && !shrink) setShrink(true);
  }, [over, shrink]);
  const stillOver = over && shrink;
  let cls = "ui-math scroll-x is-" + sf;
  if (shrink) cls += " is-shrink";
  if (stillOver) cls += " is-overflow";
  return (
    <div className="ui-math-wrap">
      <div ref={ref} className={cls} role="group" aria-label={label || "수식"} tabIndex={stillOver ? 0 : undefined}>
        {lines.map((t, i) => (
          <Tex key={i} tex={t} display />
        ))}
      </div>
      {stillOver ? (
        <p className="scroll-hint ui-scroll-hint" aria-hidden="true">
          옆으로 밀어서 끝까지 봐요 →
        </p>
      ) : null}
    </div>
  );
}
