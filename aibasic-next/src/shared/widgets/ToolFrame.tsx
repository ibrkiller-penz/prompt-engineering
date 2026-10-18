// 체험 도구의 틀: ① 예상해요 → ② 해 봐요(조작) → ③ 알게 된 점.
// 휴대폰·준비 화면은 위에서 아래로 한 줄, 칠판은 위쪽 안내 띠 + 무대 폭을 다 쓰는 도구예요.
// 칠판 안내 띠는 ①②③ 중 지금 단계의 안내를 한 줄로만 보여 주고, '다음' 단추로 넘겨요.
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

/** 칠판 ② 해 봐요에서 한 줄씩 넘길 안내: 할 일 세 줄 + (있으면) 미션 한 줄 */
export function boardDoItems(guide: WidgetGuide): { text: string; mission: boolean }[] {
  const out = guide.steps.map((s) => ({ text: s, mission: false }));
  if (guide.mission) out.push({ text: guide.mission.text, mission: true });
  return out;
}

export default function ToolFrame(props: ToolFrameProps) {
  const { guide, surface, onEvent } = props;
  const board = surface === "board";
  const uid = useId();
  const [guess, setGuess] = useState("");
  const [guessed, setGuessed] = useState(false);
  const [learned, setLearned] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState(0);
  const [sub, setSub] = useState(0);

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
        <span className="wf-no" aria-hidden="true">
          1
        </span>
        예상해요
      </h4>
      <p className="wf-text">
        <Rich text={guide.predict} />
      </p>
      {board ? null : guessed ? (
        guess.trim() ? (
          <p className="wf-mine">내 예상: {guess.trim()}</p>
        ) : null
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
        <span className="wf-no" aria-hidden="true">
          2
        </span>
        해 봐요
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
        <span className="wf-no" aria-hidden="true">
          3
        </span>
        알게 된 점
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
    // 칠판: 위쪽 안내 띠(단계 단추·도구 단추 한 줄 + 지금 안내 한 줄) 아래에 도구가 무대 폭을 다 써요.
    // ② 해 봐요는 할 일을 한 줄씩(1/3 → 2/3 → 3/3 → 미션) 넘겨요. '다음' 한 번에 한 줄이에요.
    const names = ["예상해요", "해 봐요", "알게 된 점"];
    const items = boardDoItems(guide);
    const si = Math.min(sub, items.length - 1);
    const go = (p: number) => {
      setPhase(p);
      setSub(0);
    };
    let line: ReactNode;
    let tag = "";
    let next: { label: string; run: () => void } | null = null;
    if (phase === 0) {
      line = <Rich text={guide.predict} />;
      next = { label: "다음: 해 봐요", run: () => go(1) };
    } else if (phase === 1) {
      const it = items[si];
      tag = it.mission ? (props.missionOk ? "✓ 미션 성공" : "미션") : si + 1 + " / " + guide.steps.length;
      line = <Rich text={it.text} />;
      next = si < items.length - 1 ? { label: items[si + 1].mission ? "다음: 미션" : "다음 할 일", run: () => setSub(si + 1) } : { label: "다음: 알게 된 점", run: () => go(2) };
    } else {
      if (revealed) tag = "정리";
      line = <Rich text={revealed ? guide.reveal : guide.ask} />;
      next = revealed ? null : { label: "정리 보기", run: reveal };
    }
    const nextBtn = next ? (
      <button type="button" className="wg-btn wg-btn-primary wf-next" onClick={next.run}>
        {next.label}
        <span aria-hidden="true"> →</span>
      </button>
    ) : null;
    return (
      <div className="wf wf-board">
        <h3 className="wg-sr">{props.title}</h3>
        <div className="wf-bar">
          <div className="wf-bar-top">
            <div className="wf-tabs" role="group" aria-label="체험 단계">
              {names.map((n, i) => (
                <button key={i} type="button" className={"wg-btn wf-tab" + (phase === i ? " is-on" : "")} aria-pressed={phase === i} onClick={() => go(i)}>
                  <span className="wf-tab-no" aria-hidden="true">
                    {i + 1}
                  </span>
                  {n}
                </button>
              ))}
            </div>
            {nextBtn}
            {mission && props.missionOk && !(phase === 1 && items[si].mission) ? <span className="wg-mission-chip wf-ok-chip">✓ 미션 성공</span> : null}
            {props.sideTools ? <div className="wf-bar-tools">{props.sideTools}</div> : null}
          </div>
          <div className={"wf-line" + (phase === 1 && items[si].mission ? " is-mission" + (props.missionOk ? " is-ok" : "") : "") + (phase === 2 && revealed ? " is-reveal" : "")} aria-live="polite">
            {tag ? <span className="wf-line-tag">{tag}</span> : null}
            <p className="wf-line-text">{line}</p>
          </div>
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
