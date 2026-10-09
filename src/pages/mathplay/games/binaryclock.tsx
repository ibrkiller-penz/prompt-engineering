import { useEffect, useState } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";

// ==PURE-START==
/** 값 v를 len개 자리(왼쪽이 가장 큰 자리)의 이진 불로 */
export function toBits(v: number, len: number): boolean[] {
  return Array.from({ length: len }, (_, i) => ((v >> (len - 1 - i)) & 1) === 1);
}
export function fromBits(bits: boolean[]): number {
  return bits.reduce((a, b) => a * 2 + (b ? 1 : 0), 0);
}
export function weights(len: number): number[] {
  return Array.from({ length: len }, (_, i) => 2 ** (len - 1 - i));
}
export function sumText(bits: boolean[]): string {
  const w = weights(bits.length);
  const on = w.filter((_, i) => bits[i]);
  return on.length ? `${on.join(" + ")} = ${on.reduce((a, b) => a + b, 0)}` : "0";
}
// ==PURE-END==

type Mode = "quiz" | "free" | "clock";
type Msg = { tone: "info" | "ok" | "bad"; text: string };

const pad = (n: number) => String(n).padStart(2, "0");

function Bulbs({ bits, onToggle, label, size = "lg" }: { bits: boolean[]; onToggle?: (i: number) => void; label: string; size?: "lg" | "md" }) {
  const w = weights(bits.length);
  return (
    <div className="flex justify-center gap-1.5 sm:gap-3" role="group" aria-label={label}>
      {bits.map((on, i) => {
        const cls = `${size === "lg" ? "max-w-[68px]" : "max-w-[60px]"} aspect-square min-h-[44px] min-w-[44px] flex-1 rounded-full border-2 text-lg font-extrabold transition ${
          on ? "border-amber-500 bg-amber-300 text-amber-950 shadow-[0_0_18px_4px_rgba(251,191,36,0.55)]" : "border-line bg-bg text-muted"
        }`;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: size === "lg" ? 68 : 60 }}>
            {onToggle ? (
              <button type="button" aria-pressed={on} aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`} onClick={() => onToggle(i)} className={`${cls} w-full`} style={{ touchAction: "manipulation" }}>
                {on ? 1 : 0}
              </button>
            ) : (
              <div role="img" aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`} className={`${cls} flex w-full items-center justify-center`}>
                {on ? 1 : 0}
              </div>
            )}
            <span className="text-sm font-bold tabular-nums text-muted">{w[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function BinaryClockGame() {
  const [mode, setMode] = useState<Mode>("quiz");
  const [bits, setBits] = useState<boolean[]>(Array(5).fill(false));
  const [target, setTarget] = useState(() => 1 + rand(31));
  const [solved, setSolved] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(1);
  const [streak, setStreak] = useState(0);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "불을 눌러서 목표 수를 만들어 보세요." });
  const [now, setNow] = useState(() => new Date());
  const [hideDigits, setHideDigits] = useState(false);
  const [peek, setPeek] = useState(false);

  useEffect(() => {
    if (mode !== "clock") return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  const value = fromBits(bits);

  const nextQuestion = () => {
    let t = 1 + rand(31);
    while (t === target) t = 1 + rand(31);
    setTarget(t);
    setBits(Array(5).fill(false));
    setSolved(false);
    setHinted(false);
    setAsked((a) => a + 1);
    setMsg({ tone: "info", text: "새 문제예요. 불을 눌러서 목표 수를 만들어 보세요." });
  };

  const toggle = (i: number) => {
    if (mode === "quiz" && solved) return;
    const nb = bits.map((b, j) => (j === i ? !b : b));
    setBits(nb);
    const v = fromBits(nb);
    if (mode === "quiz") {
      if (v === target) {
        setSolved(true);
        if (hinted) {
          setStreak(0);
          setMsg({ tone: "ok", text: `맞았어요! ${sumText(nb)}. 힌트를 썼으니 점수는 올리지 않았어요.` });
        } else {
          setScore((s) => s + 1);
          setStreak((s) => s + 1);
          setMsg({ tone: "ok", text: `정답! ${sumText(nb)}. 1점을 얻었어요.` });
        }
      } else if (v > target) {
        setMsg({ tone: "bad", text: `지금 ${v}이에요. 목표 ${target}보다 커요. 큰 불을 꺼 보세요.` });
      } else {
        setMsg({ tone: "info", text: `지금 ${v}이에요. 목표까지 ${target - v} 남았어요.` });
      }
    } else if (mode === "free") {
      setMsg({ tone: v === 31 ? "ok" : "info", text: v === 31 ? "불 5개를 모두 켰어요. 16+8+4+2+1 = 31, 5개로 만들 수 있는 가장 큰 수예요!" : `지금 수는 ${v}이에요.` });
    }
  };

  const showHint = () => {
    setHinted(true);
    setMsg({ tone: "info", text: `힌트: ${target}은(는) ${sumText(toBits(target, 5))} 이에요. 이 불들을 켜 보세요.` });
  };

  const skip = () => {
    setStreak(0);
    nextQuestion();
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setBits(Array(5).fill(false));
    setSolved(false);
    setHinted(false);
    setPeek(false);
    if (m === "quiz") setMsg({ tone: "info", text: "불을 눌러서 목표 수를 만들어 보세요." });
    else if (m === "free") setMsg({ tone: "info", text: "불을 마음대로 켜고 꺼 보세요. 불마다 정해진 값을 더한 것이 수예요." });
  };

  const hh = now.getHours();
  const mm = now.getMinutes();

  return (
    <div className="space-y-3">
      <Board>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="놀이 방법 고르기">
          {([["quiz", "문제 풀기"], ["free", "마음대로"], ["clock", "시계 보기"]] as [Mode, string][]).map(([m, t]) => (
            <GButton key={m} variant={mode === m ? "soft" : "ghost"} pressed={mode === m} onClick={() => changeMode(m)} className="text-sm">
              {t}
            </GButton>
          ))}
        </div>

        {mode !== "clock" && (
          <div className="space-y-3">
            {mode === "quiz" && (
              <div className="text-center">
                <p className="text-sm text-muted">목표 수</p>
                <p className="text-5xl font-extrabold tabular-nums text-accent" aria-live="polite">{target}</p>
              </div>
            )}
            <Bulbs bits={bits} onToggle={toggle} label="이진 불 다섯 개: 16, 8, 4, 2, 1" />
            <div className="text-center">
              <p className="text-sm text-muted">지금 내가 만든 수</p>
              <p className={`text-4xl font-extrabold tabular-nums ${mode === "quiz" && solved ? "text-ok" : "text-ink"}`}>{value}</p>
              <p className="text-sm tabular-nums text-muted">{sumText(bits)}</p>
            </div>
          </div>
        )}

        {mode === "clock" && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-center text-sm font-semibold">시 (불 5개)</p>
              <Bulbs bits={toBits(hh, 5)} label={`시 ${hh}를 나타내는 이진 불`} size="md" />
            </div>
            <div>
              <p className="mb-1 text-center text-sm font-semibold">분 (불 6개)</p>
              <Bulbs bits={toBits(mm, 6)} label={`분 ${mm}을 나타내는 이진 불`} size="md" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted">지금 시각</p>
              <p className="text-4xl font-extrabold tabular-nums">
                {hideDigits && !peek ? "--시 --분" : `${pad(hh)}시 ${pad(mm)}분`}
              </p>
              <p className="text-sm tabular-nums text-muted">{hideDigits && !peek ? "불을 읽어서 시각을 맞혀 보세요" : `시: ${sumText(toBits(hh, 5))} / 분: ${sumText(toBits(mm, 6))}`}</p>
            </div>
          </div>
        )}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "quiz" && (
          <>
            <Stat label="점수" value={score} tone={score ? "ok" : "plain"} />
            <Stat label="문제" value={asked} />
            <Stat label="연속 정답" value={streak} />
          </>
        )}
        {mode === "free" && <Stat label="내 수" value={value} />}
        {mode === "clock" && <Stat label="시각" value={`${pad(hh)}:${pad(mm)}`} />}
      </div>

      {mode !== "clock" && <Say tone={msg.tone}>{msg.text}</Say>}
      {mode === "clock" && <Say>시계가 1초마다 갱신돼요. 시는 16·8·4·2·1, 분은 32·16·8·4·2·1 값의 불을 더해서 읽어요.</Say>}

      <div className="flex flex-wrap gap-2">
        {mode === "quiz" && (
          <>
            <GButton variant="primary" onClick={nextQuestion}>{solved ? "다음 문제 ▶" : "새 문제"}</GButton>
            <GButton onClick={showHint} disabled={solved}>힌트 보기</GButton>
            <GButton onClick={skip} disabled={solved}>건너뛰기</GButton>
            <GButton onClick={() => setBits(Array(5).fill(false))} disabled={solved}>불 모두 끄기</GButton>
          </>
        )}
        {mode === "free" && (
          <>
            <GButton variant="primary" onClick={() => setBits(Array(5).fill(false))}>다시 하기 (모두 끄기)</GButton>
            <GButton onClick={() => setBits(Array(5).fill(true))}>모두 켜기</GButton>
          </>
        )}
        {mode === "clock" && (
          <>
            <GButton variant="soft" pressed={hideDigits} onClick={() => { setHideDigits(!hideDigits); setPeek(false); }}>숫자 가리고 불만 읽기</GButton>
            {hideDigits && <GButton onClick={() => setPeek(!peek)}>{peek ? "다시 가리기" : "정답 보기"}</GButton>}
          </>
        )}
      </div>
    </div>
  );
}
