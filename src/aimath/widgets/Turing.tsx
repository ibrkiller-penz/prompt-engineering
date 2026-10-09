import { useMemo, useState } from "react";
import { buildGame, scoreGame } from "./Turing.logic";

const btn = "min-h-[44px] rounded-card px-4 py-2 font-semibold";

export default function Turing() {
  const [game, setGame] = useState(1);
  const rounds = useMemo(() => buildGame(game), [game]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<("A" | "B")[]>([]);

  const done = idx >= rounds.length;
  const answered = picks.length > idx;
  const r = rounds[Math.min(idx, rounds.length - 1)];
  const score = scoreGame(rounds, picks);

  function pick(c: "A" | "B") {
    if (!answered) setPicks((p) => [...p, c]);
  }
  function next() {
    setIdx((i) => i + 1);
  }
  function restart() {
    setGame((g) => g + 1);
    setIdx(0);
    setPicks([]);
  }

  const msg =
    score >= 7
      ? "기계를 거의 다 알아봤어요! 규칙대로만 말하는 문장은 티가 나죠."
      : score >= 4
        ? "반반이에요. 어떤 답은 사람 같아서 헷갈렸죠?"
        : "기계에게 많이 속았어요! 그만큼 말투만으로는 구별이 어려워요.";

  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="튜링 테스트 체험">
      <h3 className="font-bold text-ink">체험 도구 · 튜링 테스트 체험</h3>
      <p className="mt-1 text-sm text-muted">질문 하나에 두 개의 익명 답변(A, B)이 나와요. 둘 중 <b className="text-ink">기계(프로그램)</b>가 쓴 답을 골라 보세요. 총 8라운드!</p>

      {!done ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>라운드 {idx + 1} / {rounds.length}</span>
            <span>맞힌 개수 {score}</span>
          </div>
          <div className="rounded-card bg-accent-soft p-3 font-semibold text-accent">Q. {r.q}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["A", "B"] as const).map((c) => {
              const text = c === "A" ? r.a : r.b;
              const chosen = answered && picks[idx] === c;
              const isMachine = r.machineIs === c;
              let cls = "border-line bg-bg text-ink";
              if (answered) cls = isMachine ? "border-ok bg-ok-soft text-ink" : "border-line bg-bg text-ink";
              if (answered && chosen && !isMachine) cls = "border-bad bg-bad-soft text-ink";
              return (
                <button
                  key={c}
                  type="button"
                  disabled={answered}
                  onClick={() => pick(c)}
                  className={`min-h-[44px] rounded-card border-2 p-3 text-left ${cls} ${answered ? "" : "hover:border-accent"}`}
                >
                  <span className="block text-xs font-bold text-muted">답변 {c}{answered ? (isMachine ? " · 기계" : " · 사람") : ""}</span>
                  <span className="mt-1 block break-words">{text}</span>
                  {!answered && <span className="mt-2 block text-xs text-accent">이게 기계라고 생각해요</span>}
                </button>
              );
            })}
          </div>
          {answered && (
            <div className="space-y-2" aria-live="polite">
              <p className={picks[idx] === r.machineIs ? "font-semibold text-ok" : "font-semibold text-bad"}>
                {picks[idx] === r.machineIs ? "정답! 기계를 찾았어요." : `아쉬워요. 기계는 ${r.machineIs}였어요.`}
              </p>
              <p className="text-sm text-muted">단서: {r.tell}</p>
              <button type="button" onClick={next} className={`${btn} bg-accent text-accent-ink`}>
                {idx + 1 === rounds.length ? "결과 보기" : "다음 라운드"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3" aria-live="polite">
          <p className="text-2xl font-bold text-ink">{score} / {rounds.length} 점</p>
          <p className="text-ink">{msg}</p>
          <div className="rounded-card bg-bg p-3 text-sm text-muted">
            <b className="text-ink">튜링 테스트</b>는 "대화만 보고 사람과 기계를 구별할 수 없다면, 그 기계는 생각한다고 볼 수 있을까?"를 묻는 실험이에요.
            <br />
            한계도 있어요. 오직 <b className="text-ink">말솜씨</b>만 보기 때문에, 진짜로 이해하는지가 아니라 그럴듯하게 흉내 내는지를 재요. 여기 나온 기계는 키워드와 정해진 문장으로 답하는 <b className="text-ink">규칙 기반</b> 프로그램이었어요. 다음 도구에서 규칙 기반과 학습 기반을 비교해 봐요.
          </div>
          <button type="button" onClick={restart} className={`${btn} bg-accent text-accent-ink`}>새 게임</button>
        </div>
      )}
    </section>
  );
}
