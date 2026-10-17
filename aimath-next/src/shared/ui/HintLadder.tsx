// 힌트 계단: 힌트 1 → 힌트 2 → 풀이를 차례로 열어요(앞 단계를 열어야 다음 단추가 열려요).
// 몇 단계까지 열었는지는 onOpen 으로 알려요(기록은 쓰는 쪽에서).
import type { Surface } from "../contracts.ts";
import { Icon } from "../icons/index.ts";
import { Rich } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

export interface HintLadderProps {
  hints?: [string, string] | string[];
  /** 풀이(서술형이면 없음) */
  solution?: string;
  /** 지금 열린 단계: 0 아무것도, 1 힌트1, 2 힌트2, 3 풀이 */
  level: number;
  onOpen: (level: number) => void;
  surface?: Surface;
  /** 풀이 단추 글자(기본 '풀이 보기') */
  solutionLabel?: string;
}

export function HintLadder({ hints, solution, level, onOpen, surface, solutionLabel }: HintLadderProps) {
  const sf = useUiSurface(surface);
  const hs = (hints || []).filter((h) => !!h);
  const steps: { kind: "hint" | "sol"; text: string; n: number }[] = [];
  hs.forEach((h, i) => steps.push({ kind: "hint", text: h, n: i + 1 }));
  if (solution) steps.push({ kind: "sol", text: solution, n: 3 });
  if (!steps.length) return null;
  // 단계 번호: 힌트 i → i+1, 풀이 → 3 (힌트가 하나뿐이어도 풀이는 3)
  const levelOf = (s: { kind: string; n: number }) => (s.kind === "sol" ? 3 : s.n);
  const next = steps.filter((s) => levelOf(s) > level)[0];
  return (
    <div className={"ui-hints is-" + sf}>
      {steps
        .filter((s) => levelOf(s) <= level)
        .map((s) => (
          <div key={s.kind + s.n} className={"reveal-step open ui-hint" + (s.kind === "sol" ? " is-sol" : "")}>
            <span className="ui-hint-tag">{s.kind === "sol" ? "풀이" : "힌트 " + s.n}</span>
            <div className="ui-hint-txt">
              <Rich text={s.text} />
            </div>
          </div>
        ))}
      {next ? (
        <button type="button" className="btn btn-soft ui-hint-btn" onClick={() => onOpen(levelOf(next))}>
          <Icon name={next.kind === "sol" ? "solution" : "hint"} />
          <span>{next.kind === "sol" ? solutionLabel || "풀이 보기" : "힌트 " + next.n + " 보기"}</span>
        </button>
      ) : null}
    </div>
  );
}
