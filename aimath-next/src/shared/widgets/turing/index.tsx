// 튜링 테스트 체험: 질문 하나에 두 대답(A·B). 어느 쪽이 기계인지 골라요.
import { useMemo, useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { buildGame, scoreGame } from "@legacy/widgets/Turing.logic";
import { Big, Btn, Note, Readout, Verdict, useIsBoard } from "../kit.tsx";
import { toneRound } from "./tone.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const ROUNDS = 8;

export default function Turing(props: WidgetProps) {
  const [game, setGame] = useState(1);
  const board = useIsBoard();
  // 화면 문장만 해요체로 고쳐요(정답·순서는 그대로)
  const rounds = useMemo(() => buildGame(game, ROUNDS).map(toneRound), [game]);
  const [picks, setPicks] = useState<("A" | "B")[]>([]);
  const idx = picks.length;
  const done = idx >= rounds.length;
  const score = scoreGame(rounds, picks);
  useMission(props, mission, { answered: picks.length, total: rounds.length, score });

  const [shown, setShown] = useState<number | null>(null); // 방금 고른 판 해설
  const pick = (c: "A" | "B") => {
    setShown(idx);
    setPicks(picks.concat([c]));
  };
  const again = () => {
    setGame(game + 1);
    setPicks([]);
    setShown(null);
  };
  const last = shown !== null ? rounds[shown] : null;

  // 한 흐름: 진행 → (방금 판 결과) → 질문 → A 대답과 단추 · B 대답과 단추. 칠판에서도 두 단으로 나누지 않아요
  return (
    <div className="wg-body wg-body-split wg-turing">
      {board ? null : <Note>질문 하나에 대답이 두 개 있어요. 하나는 사람, 하나는 정해진 규칙으로 대답하는 기계예요. 기계라고 생각하는 쪽을 골라요.</Note>}
      <div className="wg-turing-top">
        <Readout label="진행" keep>
          {Math.min(idx + 1, rounds.length)} / {rounds.length}판 · 맞힌 판 {score}
        </Readout>
        {last && shown !== null ? (
          <Verdict keep ok={picks[shown] === last.machineIs}>
            {picks[shown] === last.machineIs ? "맞혔어요. " : "아쉬워요. "}기계는 {last.machineIs}였어요. {last.tell}
          </Verdict>
        ) : null}
      </div>
      {!done ? (
        <div className="wg-card">
          <p className="wg-q">
            <span className="wg-chip">질문</span> {rounds[idx].q}
          </p>
          <div className="wg-two">
            <div className="wg-pick">
              <div className="wg-answer">
                <span className="wg-chip">A</span> {rounds[idx].a}
              </div>
              <Btn primary onClick={() => pick("A")}>
                A가 기계 같아요
              </Btn>
            </div>
            <div className="wg-pick">
              <div className="wg-answer">
                <span className="wg-chip">B</span> {rounds[idx].b}
              </div>
              <Btn primary onClick={() => pick("B")}>
                B가 기계 같아요
              </Btn>
            </div>
          </div>
        </div>
      ) : (
        <div className="wg-card">
          <Big label="맞힌 판" tone={score >= 6 ? "ok" : "plain"} sub={`${rounds.length}판 중 ${score}판을 맞혔어요.`}>
            {score} / {rounds.length}
          </Big>
          <Note>기계가 사람인 척을 잘하면 맞히기 어려워져요. 튜링은 '사람과 구별하기 어려우면 생각한다고 볼 수 있을까?'라고 물었어요.</Note>
          <Btn onClick={again}>새 판으로 다시 하기</Btn>
        </div>
      )}
    </div>
  );
}
