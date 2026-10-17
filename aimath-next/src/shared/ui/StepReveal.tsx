// 예제(블록 t:"example"): 문제 → 풀이 단계를 한 줄씩 열고 → 답.
//  - 학생(휴대폰): '다음 단계 보기'로 한 단계씩, '모두 보기'도 있어요.
//  - 칠판: 바깥(장면)에서 shown 으로 몇 단계를 보일지 정해 줄 수 있어요('다음'이 먼저 공개).
//  - 인쇄·준비 화면: open 이면 처음부터 다 보여요.
import { useEffect, useState } from "react";
import type { Surface } from "../contracts.ts";
import { Rich } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

export interface StepRevealProps {
  title: string;
  problem: string;
  steps: string[];
  answer: string;
  surface?: Surface;
  /** 처음부터 모두 펼침 */
  open?: boolean;
  /** 바깥에서 공개 단계 수를 정할 때(0 = 문제만, steps.length+1 = 답까지). 주면 안쪽 단추는 숨겨요 */
  shown?: number;
  /** 공개 단계가 바뀔 때 */
  onStep?: (shown: number, total: number) => void;
}

/** 공개 단계 수(풀이 단계 + 답) */
export const revealTotal = (steps: string[]) => steps.length + 1;

export function StepReveal(props: StepRevealProps) {
  const { title, problem, steps, answer } = props;
  const sf = useUiSurface(props.surface);
  const total = revealTotal(steps);
  const controlled = typeof props.shown === "number";
  const [inner, setInner] = useState(props.open ? total : 0);
  useEffect(() => {
    if (props.open) setInner(total);
  }, [props.open, total]);
  const shown = controlled ? Math.max(0, Math.min(total, props.shown as number)) : inner;
  const more = (n: number) => {
    const v = Math.min(total, n);
    setInner(v);
    if (props.onStep) props.onStep(v, total);
  };
  return (
    <section className={"ui-example is-" + sf} aria-label={"예제: " + title.replace(/\$|\*\*/g, "")}>
      <header className="ui-example-head">
        <span className="ui-example-tag">예제</span>
        <span className="ui-example-title">
          <Rich text={title} />
        </span>
      </header>
      <div className="ui-example-problem">
        <Rich text={problem} />
      </div>
      <ol className="ui-example-steps" aria-live="polite">
        {steps.map((s, i) =>
          i < shown ? (
            <li key={i} className="reveal-step open ui-ex-step">
              <span className="ui-ex-n" aria-hidden="true">
                {i + 1}
              </span>
              <span className="ui-ex-txt">
                <Rich text={s} />
              </span>
            </li>
          ) : null,
        )}
      </ol>
      {shown >= total ? (
        <p className="ui-example-answer">
          <span className="ui-example-ans-tag">답</span> <Rich text={answer} />
        </p>
      ) : null}
      {!controlled && shown < total ? (
        <div className="ui-example-ctl">
          <button type="button" className="btn btn-soft" onClick={() => more(shown + 1)}>
            {shown < steps.length ? "다음 단계 보기 (" + (shown + 1) + "/" + steps.length + ")" : "답 보기"}
          </button>
          {shown < total - 1 ? (
            <button type="button" className="btn btn-ghost" onClick={() => more(total)}>
              모두 보기
            </button>
          ) : null}
        </div>
      ) : null}
      {!controlled && shown > 0 && !props.open ? (
        <div className="ui-example-ctl">
          <button type="button" className="btn btn-ghost ui-ex-reset" onClick={() => more(0)}>
            다시 가리기
          </button>
        </div>
      ) : null}
    </section>
  );
}
