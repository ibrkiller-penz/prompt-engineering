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
        const cls = `${size === "lg" ? "max-w-[84px]" : "max-w-[64px]"} aspect-square min-h-[48px] min-w-[48px] flex-1 rounded-full border-2 text-lg font-extrabold transition ${
          on ? "border-amber-500 bg-amber-300 text-amber-950 shadow-[0_0_18px_4px_rgba(251,191,36,0.55)]" : "border-line bg-bg text-muted"
        }`;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" style={{ maxWidth: size === "lg" ? 84 : 64 }}>
            {onToggle ? (
              <button type="button" aria-pressed={on} aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`} onClick={() => onToggle(i)} className={`${cls} w-full`} style={{ touchAction: "manipulation" }}>
                {on ? 1 : 0}
              </button>
            ) : (
              <div role="img" aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`} className={`${cls} flex w-full items-center justify-center`}>
                {on ? 1 : 0}
              </div>
            )}
            <span className="text-base font-bold tabular-nums text-muted">{w[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

const BIG = "min-h-[48px]! text-base";
const ROUNDS = 5;

export default function BinaryClockGame() {
  const [mode, setMode] = useState<Mode>("quiz");
  const [len, setLen] = useState(3);
  const [more, setMore] = useState(false);
  const [bits, setBits] = useState<boolean[]>(Array(3).fill(false));
  const maxV = 2 ** len - 1;
  const [target, setTarget] = useState(() => 1 + rand(7));
  const [solved, setSolved] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [stars, setStars] = useState(0);
  const [round, setRound] = useState(1);
  const [finished, setFinished] = useState(false);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "불을 눌러서 켜요. 켜진 불의 숫자를 모두 더하면 돼요!" });
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
  const empty = (l = len) => Array<boolean>(l).fill(false);

  const newGame = (l = len) => {
    setTarget(1 + rand(2 ** l - 1));
    setBits(empty(l));
    setSolved(false);
    setHinted(false);
    setStars(0);
    setRound(1);
    setFinished(false);
    setMsg({ tone: "info", text: "새 게임이에요! 불을 눌러서 목표 수를 만들어 봐요." });
  };

  const nextQuestion = () => {
    if (round >= ROUNDS) {
      setFinished(true);
      setMsg({ tone: "ok", text: `끝! ${ROUNDS}문제 중 ⭐ ${stars}개를 받았어요. ${stars >= 4 ? "정말 잘했어요!" : "한 번 더 하면 더 잘할 수 있어요!"}` });
      return;
    }
    let t = 1 + rand(maxV);
    while (t === target && maxV > 1) t = 1 + rand(maxV);
    setTarget(t);
    setBits(empty());
    setSolved(false);
    setHinted(false);
    setRound(round + 1);
    setMsg({ tone: "info", text: "새 문제예요. 불을 눌러서 목표 수를 만들어 봐요." });
  };

  const toggle = (i: number) => {
    if (mode === "quiz" && (solved || finished)) return;
    const nb = bits.map((b, j) => (j === i ? !b : b));
    setBits(nb);
    const v = fromBits(nb);
    if (mode === "quiz") {
      if (v === target) {
        setSolved(true);
        if (hinted) setMsg({ tone: "ok", text: `맞았어요! ${sumText(nb)}. 힌트를 썼으니 별은 없지만 잘했어요!` });
        else {
          setStars((s) => s + 1);
          setMsg({ tone: "ok", text: `⭐ 정답! ${sumText(nb)}. 별을 받았어요!` });
        }
      } else if (v > target) {
        setMsg({ tone: "bad", text: `아깝다! 지금 ${v}이에요. 목표 ${target}보다 커요. 불을 하나 꺼 봐요.` });
      } else {
        setMsg({ tone: "info", text: `지금 ${v}이에요. 목표까지 ${target - v} 남았어요.` });
      }
    } else if (mode === "free") {
      setMsg({ tone: v === maxV ? "ok" : "info", text: v === maxV ? `⭐ 불을 모두 켰어요! ${sumText(nb)}. 불 ${len}개로 만들 수 있는 가장 큰 수예요!` : `지금 수는 ${v}이에요.` });
    }
  };

  const showHint = () => {
    setHinted(true);
    setMsg({ tone: "info", text: `힌트: ${target}은(는) ${sumText(toBits(target, len))} 이에요. 이 숫자의 불을 켜 봐요.` });
  };

  const changeMode = (m: Mode) => {
    setMode(m);
    setBits(empty());
    setSolved(false);
    setPeek(false);
    if (m === "quiz") setMsg({ tone: "info", text: "불을 눌러서 목표 수를 만들어 봐요." });
    else if (m === "free") setMsg({ tone: "info", text: "불을 마음대로 켜고 꺼 보세요. 켜진 불의 숫자를 모두 더한 값이 지금 수예요." });
  };

  const changeLen = (l: number) => {
    setLen(l);
    newGame(l);
  };

  const hh = now.getHours();
  const mm = now.getMinutes();

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="mb-3 rounded-card bg-accent-soft px-3 py-2 font-bold">
          {mode === "quiz" ? "불을 눌러서 목표 수를 만들어요! 켜진 불의 숫자를 모두 더해요." : mode === "free" ? "불을 켜고 꺼 보며 수가 어떻게 변하는지 봐요." : "지금 시각을 불로 나타냈어요. 켜진 불의 숫자를 더해 읽어 봐요."}
        </p>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="놀이 방법 고르기">
          {([["quiz", "문제 풀기"], ["free", "마음대로 켜 보기"]] as [Mode, string][]).map(([m, t]) => (
            <GButton key={m} variant={mode === m ? "soft" : "ghost"} pressed={mode === m} onClick={() => changeMode(m)} className={BIG}>
              {t}
            </GButton>
          ))}
          {more && (
            <GButton variant={mode === "clock" ? "soft" : "ghost"} pressed={mode === "clock"} onClick={() => changeMode("clock")} className={BIG}>
              시계 보기
            </GButton>
          )}
        </div>

        {mode !== "clock" && (
          <div className="space-y-3">
            {mode === "quiz" && (
              <div className="text-center">
                <p className="text-muted">목표 수 ({round}/{ROUNDS}번째 문제)</p>
                <p className="text-6xl font-extrabold tabular-nums text-accent" aria-live="polite">{target}</p>
              </div>
            )}
            <Bulbs bits={bits} onToggle={toggle} label={`불 ${len}개: ${weights(len).join(", ")}`} />
            <div className="text-center">
              <p className="text-muted">지금 내가 만든 수</p>
              <p className={`text-5xl font-extrabold tabular-nums ${mode === "quiz" && solved ? "text-ok" : "text-ink"}`}>{value}</p>
              <p className="tabular-nums text-muted">{sumText(bits)}</p>
            </div>
          </div>
        )}

        {mode === "clock" && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-center font-semibold">시 (불 5개)</p>
              <Bulbs bits={toBits(hh, 5)} label={`시 ${hh}를 나타내는 불`} size="md" />
            </div>
            <div>
              <p className="mb-1 text-center font-semibold">분 (불 6개)</p>
              <Bulbs bits={toBits(mm, 6)} label={`분 ${mm}을 나타내는 불`} size="md" />
            </div>
            <div className="text-center">
              <p className="text-muted">지금 시각</p>
              <p className="text-4xl font-extrabold tabular-nums">{hideDigits && !peek ? "--시 --분" : `${pad(hh)}시 ${pad(mm)}분`}</p>
              <p className="tabular-nums text-muted">{hideDigits && !peek ? "불을 읽어서 시각을 맞혀 봐요" : `시: ${sumText(toBits(hh, 5))} / 분: ${sumText(toBits(mm, 6))}`}</p>
            </div>
          </div>
        )}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "quiz" && (
          <>
            <Stat label="⭐ 별" value={stars} tone={stars ? "ok" : "plain"} />
            <Stat label="문제" value={`${round}/${ROUNDS}`} />
          </>
        )}
        {mode === "free" && <Stat label="내 수" value={value} />}
        {mode === "clock" && <Stat label="시각" value={`${pad(hh)}:${pad(mm)}`} />}
      </div>

      {mode !== "clock" && <Say tone={msg.tone}>{msg.text}</Say>}
      {mode === "clock" && <Say>시계는 1초마다 바뀌어요. 시는 16·8·4·2·1, 분은 32·16·8·4·2·1 불을 더해서 읽어요.</Say>}

      <div className="flex flex-wrap gap-2">
        {mode === "quiz" && (
          <>
            {finished ? (
              <GButton variant="primary" onClick={() => newGame()} className={BIG}>↻ 다시 하기</GButton>
            ) : (
              <>
                <GButton variant="primary" onClick={nextQuestion} disabled={!solved} className={BIG}>{round >= ROUNDS ? "결과 보기 ▶" : "다음 문제 ▶"}</GButton>
                <GButton onClick={showHint} disabled={solved} className={BIG}>💡 힌트 보기</GButton>
                <GButton onClick={() => setBits(empty())} disabled={solved} className={BIG}>불 모두 끄기</GButton>
                <GButton onClick={nextQuestion} disabled={solved} className={BIG}>모르겠어요 (건너뛰기)</GButton>
              </>
            )}
          </>
        )}
        {mode === "free" && (
          <>
            <GButton variant="primary" onClick={() => setBits(empty())} className={BIG}>↻ 다시 하기 (모두 끄기)</GButton>
            <GButton onClick={() => setBits(Array(len).fill(true))} className={BIG}>모두 켜기</GButton>
          </>
        )}
        {mode === "clock" && (
          <>
            <GButton variant="soft" pressed={hideDigits} onClick={() => { setHideDigits(!hideDigits); setPeek(false); }} className={BIG}>숫자 가리고 불만 읽기</GButton>
            {hideDigits && <GButton onClick={() => setPeek(!peek)} className={BIG}>{peek ? "다시 가리기" : "정답 보기"}</GButton>}
          </>
        )}
        <GButton pressed={more} onClick={() => { if (more && mode === "clock") changeMode("quiz"); setMore(!more); }} className={BIG}>{more ? "어려운 도전 닫기" : "더 어려운 도전"}</GButton>
      </div>

      {more && mode !== "clock" && (
        <Board className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">불 개수 (많을수록 어려워요)</span>
          {[3, 4, 5].map((l) => (
            <GButton key={l} variant={len === l ? "soft" : "ghost"} pressed={len === l} onClick={() => changeLen(l)} className={BIG}>
              {l}개
            </GButton>
          ))}
        </Board>
      )}
    </div>
  );
}
