import { useStored } from "../../lib/storage";
import { Button, Reveal } from "../ui";

interface Row {
  want: string;
  got: string;
  answer: "o" | "x";
  reason: string;
}

interface Props {
  storeKey: string;
  leftLabel: string;
  rightLabel: string;
  rows: Row[];
}

type State = { marks: Record<number, "o" | "x">; reasons: Record<number, string>; checked: boolean };

/** 원한 것 vs 만든 것을 ○/×로 비교하고 이유를 쓴다. */
export default function CompareTable({ storeKey, leftLabel, rightLabel, rows }: Props) {
  const [s, setS] = useStored<State>(storeKey, { marks: {}, reasons: {}, checked: false });
  const allMarked = rows.every((_, i) => s.marks[i]);

  return (
    <div>
      <div className="space-y-3">
        {rows.map((r, i) => {
          const mark = s.marks[i];
          const right = s.checked && mark === r.answer;
          const miss = s.checked && mark && mark !== r.answer;
          return (
            <div
              key={i}
              className={`rounded-card border-2 p-3 ${right ? "border-ok" : miss ? "border-bad" : "border-line"}`}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-muted">{leftLabel}</p>
                  <p className="font-semibold">{r.want}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-muted">{rightLabel}</p>
                  <p>{r.got}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(["o", "x"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mark === m}
                    aria-label={m === "o" ? "맞음 ○" : "틀림 ×"}
                    onClick={() => setS((p) => ({ ...p, marks: { ...p.marks, [i]: m }, checked: false }))}
                    className={`h-11 w-11 rounded-full border-2 text-xl font-bold ${
                      mark === m ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
                    }`}
                  >
                    {m === "o" ? "○" : "×"}
                  </button>
                ))}
                <input
                  value={s.reasons[i] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setS((p) => ({ ...p, reasons: { ...p.reasons, [i]: v } }));
                  }}
                  placeholder="이유"
                  aria-label={`${r.want} 이유`}
                  className="min-h-[44px] min-w-0 flex-1 rounded-card border border-line px-3 outline-none focus:border-accent"
                />
              </div>
              {s.checked && (
                <p className={`mt-2 text-sm ${right ? "text-ok" : "text-bad"}`}>
                  {right ? "✓ " : "다시 볼까요? "}
                  예시 이유: {r.reason}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => setS({ ...s, checked: true })} disabled={!allMarked}>
          확인하기
        </Button>
      </div>
      {s.checked && rows.every((r, i) => s.marks[i] === r.answer) && (
        <p className="mt-3 font-semibold text-ok" aria-live="polite">
          잘 찾았어요! 매끄러워 보여도 조건은 하나도 채워지지 않았어요. 고칠 곳을 찾은 건 실패가 아니라 진짜 판단의
          시작이에요.
        </p>
      )}
      <Reveal>{rows.map((r) => `${r.want}: ${r.answer === "o" ? "○" : "×"} (${r.reason})`).join(" / ")}</Reveal>
    </div>
  );
}
