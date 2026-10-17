// 체험 도구의 틀: ① 예상해요 → ② 해 봐요(조작) → ③ 알게 된 점.
// 휴대폰·준비 화면은 위에서 아래로 한 줄, 칠판은 왼쪽 안내판(360px) + 오른쪽 그림판이에요.
// 칠판 안내판은 세로 1080 안에 들어가도록 ①②③ 중 한 단계만 크게 보여 주고, 단계 단추로 넘겨요.
// 예상·알게 된 점에 적은 글은 저장하지 않아요(화면을 떠나면 사라져요).
import { useId, useState } from "react";
import type { ReactNode } from "react";
import type { Surface, WidgetEvent, WidgetGuide } from "../contracts.ts";
import { Rich } from "./kit.tsx";
import "./widgets.css";

export interface ToolFrameProps {
  title: string;
  surface: Surface;
  guide?: WidgetGuide;
  /** 미션을 해냈는지(도구가 판정해서 알려 줘요) */
  missionOk?: boolean;
  onEvent?: (e: WidgetEvent) => void;
  /** 칠판에서 왼쪽 안내판 아래에 둘 도구 단추(처음으로·결과 가리기) */
  sideTools?: ReactNode;
  children: ReactNode;
}

const MAX_NOTE = 200;

export default function ToolFrame(props: ToolFrameProps) {
  const { guide, surface, onEvent } = props;
  const board = surface === "board";
  const uid = useId();
  const [guess, setGuess] = useState("");
  const [guessed, setGuessed] = useState(false);
  const [learned, setLearned] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState(0);

  const sendGuess = () => {
    setGuessed(true);
    if (onEvent) onEvent({ type: "predict", value: guess.trim() });
  };
  const reveal = () => {
    setRevealed(true);
    if (onEvent) onEvent({ type: "learned", value: learned.trim() });
  };

  if (!guide) {
    return (
      <div className={"wf wf-" + surface + " wf-bare"}>
        <h3 className="wf-title">{props.title}</h3>
        <div className="wf-stage">{props.children}</div>
      </div>
    );
  }

  const predict = (
    <section className="wf-step" aria-labelledby={uid + "p"}>
      <h4 id={uid + "p"} className="wf-h">
        <span className="wf-no" aria-hidden="true">1</span>예상해요
      </h4>
      <p className="wf-text">
        <Rich text={guide.predict} />
      </p>
      {board ? null : guessed ? (
        guess.trim() ? <p className="wf-mine">내 예상: {guess.trim()}</p> : null
      ) : (
        <div className="wf-form">
          <label className="wg-sr" htmlFor={uid + "pi"}>
            내 예상
          </label>
          <input id={uid + "pi"} className="wg-input" maxLength={MAX_NOTE} value={guess} placeholder="짧게 적어 봐요(저장하지 않아요)" onChange={(e) => setGuess(e.target.value)} />
          <button type="button" className="wg-btn" onClick={sendGuess}>
            {guess.trim() ? "예상 적었어요" : "건너뛸게요"}
          </button>
        </div>
      )}
    </section>
  );

  const mission = guide.mission;
  const doIt = (
    <section className="wf-step" aria-labelledby={uid + "d"}>
      <h4 id={uid + "d"} className="wf-h">
        <span className="wf-no" aria-hidden="true">2</span>해 봐요
      </h4>
      <ol className="wf-steps">
        {guide.steps.map((s, i) => (
          <li key={i}>
            <Rich text={s} />
          </li>
        ))}
      </ol>
      {mission ? (
        <div className={"wf-mission" + (props.missionOk ? " is-ok" : "")}>
          <span className="wf-mission-tag">{props.missionOk ? "✓ 미션 성공" : "미션"}</span>
          <span className="wf-mission-text">
            <Rich text={mission.text} />
          </span>
        </div>
      ) : null}
    </section>
  );

  const learn = (
    <section className="wf-step" aria-labelledby={uid + "l"}>
      <h4 id={uid + "l"} className="wf-h">
        <span className="wf-no" aria-hidden="true">3</span>알게 된 점
      </h4>
      <p className="wf-text">
        <Rich text={guide.ask} />
      </p>
      {revealed ? (
        <>
          {!board && learned.trim() ? <p className="wf-mine">내 생각: {learned.trim()}</p> : null}
          <p className="wf-reveal">
            <Rich text={guide.reveal} />
          </p>
        </>
      ) : board ? (
        <button type="button" className="wg-btn wg-btn-primary" onClick={reveal}>
          정리 보기
        </button>
      ) : (
        <div className="wf-form">
          <label className="wg-sr" htmlFor={uid + "li"}>
            알게 된 점
          </label>
          <textarea id={uid + "li"} className="wg-input" rows={2} maxLength={MAX_NOTE} value={learned} placeholder="한 줄로 적어 봐요(저장하지 않아요)" onChange={(e) => setLearned(e.target.value)} />
          <button type="button" className="wg-btn wg-btn-primary" onClick={reveal}>
            정리 보기
          </button>
        </div>
      )}
    </section>
  );

  if (board) {
    const names = ["예상해요", "해 봐요", "알게 된 점"];
    return (
      <div className="wf wf-board">
        <div className="wf-side">
          <h3 className="wf-title">{props.title}</h3>
          <div className="wf-tabs" role="group" aria-label="체험 단계">
            {names.map((n, i) => (
              <button key={i} type="button" className={"wg-btn wg-btn-small wf-tab" + (phase === i ? " is-on" : "")} aria-pressed={phase === i} onClick={() => setPhase(i)}>
                {i + 1} {n}
              </button>
            ))}
          </div>
          {phase === 0 ? predict : phase === 1 ? doIt : learn}
          {phase < 2 ? (
            <button type="button" className="wg-btn wg-btn-primary" onClick={() => setPhase(phase + 1)}>
              다음 단계: {names[phase + 1]}
            </button>
          ) : null}
          {phase !== 1 && mission ? (
            <p className={"wf-mission-mini" + (props.missionOk ? " is-ok" : "")}>{props.missionOk ? "✓ 미션 성공" : "미션은 ② 해 봐요에 있어요"}</p>
          ) : null}
          {props.sideTools ? <div className="wf-side-tools">{props.sideTools}</div> : null}
        </div>
        <div className="wf-stage">{props.children}</div>
      </div>
    );
  }

  return (
    <div className={"wf wf-" + surface}>
      <h3 className="wf-title">{props.title}</h3>
      {predict}
      {doIt}
      <div className="wf-stage">{props.children}</div>
      {learn}
    </div>
  );
}
