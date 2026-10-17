// 응답 카드(#/card): 수업 중 선생님이 "몇 번이라고 생각해요?" 하고 물으면, 고른 답을 화면 가득 크게 띄워 들어 보여요.
// 아무것도 저장하지 않고 보내지도 않아요(선생님은 칠판에서 손든 수만 세요).
import { useState } from "react";
import { Screen, useDocTitle } from "../shell/Shell.tsx";

const CHOICES: { v: string; label: string; cls: string }[] = [
  { v: "①", label: "1번", cls: "c1" },
  { v: "②", label: "2번", cls: "c2" },
  { v: "③", label: "3번", cls: "c3" },
  { v: "④", label: "4번", cls: "c4" },
  { v: "⑤", label: "5번", cls: "c5" },
  { v: "O", label: "맞아요(O)", cls: "co" },
  { v: "X", label: "아니에요(X)", cls: "cx" },
  { v: "?", label: "잘 모르겠어요", cls: "cq" },
];

export default function AnswerCardPage() {
  useDocTitle("응답 카드");
  const [pick, setPick] = useState<number | null>(null);
  if (pick !== null) {
    const c = CHOICES[pick];
    return (
      <div className={"s-bigcard " + c.cls} role="dialog" aria-modal="true" aria-label={"내 답: " + c.label}>
        <span className="s-bigcard-v" aria-hidden="true">
          {c.v}
        </span>
        <span className="s-bigcard-l">{c.label}</span>
        <button type="button" className="btn btn-lg s-bigcard-close" onClick={() => setPick(null)} autoFocus>
          다른 답 고르기
        </button>
      </div>
    );
  }
  return (
    <Screen title="응답 카드" tab={null} backTo="/">
      <div className="page stack">
        <p>선생님이 물으면 내 답을 골라요. 화면 가득 크게 보이니 휴대폰을 들어 보여 줘요.</p>
        <p className="small muted">고른 답은 저장하지 않고 어디에도 보내지 않아요.</p>
        <div className="s-cardgrid" role="group" aria-label="내 답 고르기">
          {CHOICES.map((c, i) => (
            <button key={c.v} type="button" className={"s-cardbtn " + c.cls} onClick={() => setPick(i)} aria-label={c.label}>
              <span className="s-cardbtn-v" aria-hidden="true">
                {c.v}
              </span>
              <span className="tiny">{c.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
