import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, tick } from "./kit";

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
const BIG = "min-h-[48px]! text-base";
const ROUNDS = 5;

function Bulbs({ bits, onToggle, label, size = "lg", guide }: { bits: boolean[]; onToggle?: (i: number) => void; label: string; size?: "lg" | "md"; guide?: number | null }) {
  const w = weights(bits.length);
  const sweep = useRef<Set<number> | null>(null);
  const idxAt = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-bulb]");
    return el ? Number(el.getAttribute("data-bulb")) : null;
  };
  const maxW = size === "lg" ? 84 : 64;
  return (
    <div
      className="flex justify-center gap-1.5 sm:gap-3"
      role="group"
      aria-label={label}
      style={onToggle ? { touchAction: "none" } : undefined}
      onPointerDown={(e) => {
        if (!onToggle) return;
        const i = idxAt(e);
        sweep.current = new Set();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
        if (i !== null) {
          sweep.current.add(i);
          onToggle(i);
        }
      }}
      onPointerMove={(e) => {
        if (!onToggle || !sweep.current) return;
        const i = idxAt(e);
        if (i !== null && !sweep.current.has(i)) {
          sweep.current.add(i);
          onToggle(i);
        }
      }}
      onPointerUp={() => (sweep.current = null)}
      onPointerCancel={() => (sweep.current = null)}
    >
      {bits.map((on, i) => {
        const cls = "relative block w-full min-h-[48px] min-w-[44px] rounded-2xl bg-transparent";
        const art = (
          <svg key={on ? "on" : "off"} viewBox="0 0 60 84" className="gz-pop pointer-events-none block w-full" style={{ filter: on ? "drop-shadow(0 0 10px rgba(251,191,36,0.9))" : "drop-shadow(0 3px 0 rgba(67,56,202,0.25))" }} aria-hidden="true">
            <defs>
              <radialGradient id="bc-on" cx="0.45" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#fffbeb" />
                <stop offset="0.55" stopColor="#fde047" />
                <stop offset="1" stopColor="#f59e0b" />
              </radialGradient>
              <radialGradient id="bc-off" cx="0.4" cy="0.35" r="0.7">
                <stop offset="0" stopColor="#f5f3ff" />
                <stop offset="1" stopColor="#c7d2fe" />
              </radialGradient>
              <linearGradient id="bc-brass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#b45309" />
                <stop offset="0.45" stopColor="#fde68a" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
            </defs>
            {on && (
              <g stroke="#f59e0b" strokeWidth="3" strokeLinecap="round">
                <line x1="30" y1="1" x2="30" y2="5" />
                <line x1="6" y1="10" x2="9" y2="13" />
                <line x1="54" y1="10" x2="51" y2="13" />
                <line x1="1" y1="30" x2="5" y2="30" />
                <line x1="59" y1="30" x2="55" y2="30" />
              </g>
            )}
            <path d="M 30 7 C 15 7 8 18 8 29 C 8 39 15 44 19 52 L 41 52 C 45 44 52 39 52 29 C 52 18 45 7 30 7 Z" fill={on ? "url(#bc-on)" : "url(#bc-off)"} stroke={on ? "#d97706" : "#6366f1"} strokeWidth="3" strokeLinejoin="round" />
            <ellipse cx="21" cy="20" rx="5" ry="8" fill="#fff" opacity="0.7" transform="rotate(25 21 20)" />
            <path d="M 24 52 L 24 44 Q 27 38 30 44 Q 33 38 36 44 L 36 52" fill="none" stroke={on ? "#ea580c" : "#818cf8"} strokeWidth="2" />
            <rect x="18" y="52" width="24" height="16" rx="4" fill="url(#bc-brass)" stroke="#92400e" strokeWidth="2" />
            <line x1="19" y1="57" x2="41" y2="57" stroke="#92400e" strokeWidth="1.5" />
            <line x1="19" y1="62" x2="41" y2="62" stroke="#92400e" strokeWidth="1.5" />
            <path d="M 24 68 L 36 68 L 33 74 L 27 74 Z" fill="#78350f" />
            <text x="30" y="36" textAnchor="middle" fontSize={w[i] >= 10 ? 17 : 20} fill={on ? "#78350f" : "#4338ca"} stroke={on ? "#fffbeb" : "#fff"} strokeWidth="3" paintOrder="stroke" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>
              {w[i]}
            </text>
          </svg>
        );
        return (
          <div key={i} className="relative flex flex-1 flex-col items-center gap-1" style={{ maxWidth: maxW }}>
            {guide === i && <span className="pointer-events-none absolute left-0 right-0 top-0 aspect-square animate-ping rounded-full border-4 border-orange-500" />}
            {onToggle ? (
              <button
                type="button"
                data-bulb={i}
                aria-pressed={on}
                aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(i);
                  }
                }}
                className={cls}
              >
                {art}
              </button>
            ) : (
              <div role="img" aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`} className={cls}>
                {art}
              </div>
            )}
            <span className={`font-game rounded-full px-2.5 text-lg leading-7 tabular-nums ${on ? "bg-amber-300 text-amber-950" : "bg-indigo-100 text-indigo-700"}`}>{on ? 1 : 0}</span>
          </div>
        );
      })}
    </div>
  );
}

function Balloon({ n, ok, sad }: { n: number; ok: boolean; sad: boolean }) {
  const c = ok ? ["#bbf7d0", "#22c55e", "#15803d"] : ["#fecdd3", "#f43f5e", "#9f1239"];
  return (
    <div className="flex flex-col items-center" aria-live="polite" data-target={n}>
      <style>{`
        @keyframes bc-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
        @keyframes bc-yay{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-14px) scale(1.12)}}
        .bc-shake{animation:bc-shake .35s ease-in-out 2;transform-origin:50% 100%}
        .bc-yay{animation:bc-yay .6s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.bc-shake,.bc-yay{animation:none}}
      `}</style>
      <div className="gz-float">
        <div key={`${n}-${ok}-${sad}`} className={ok ? "bc-yay" : sad ? "bc-shake" : "gz-pop"}>
          <svg viewBox="0 0 100 150" width="104" height="156" role="img" aria-label={`풍선 숫자 ${n}`} style={{ fontFamily: "Jua, Pretendard Variable, sans-serif", overflow: "visible" }}>
            <defs>
              <radialGradient id={`bc-bal-${ok ? "ok" : "no"}`} cx="0.35" cy="0.3" r="0.75">
                <stop offset="0" stopColor={c[0]} />
                <stop offset="0.5" stopColor={c[1]} />
                <stop offset="1" stopColor={c[2]} />
              </radialGradient>
            </defs>
            <path d="M 50 104 C 46 114 56 120 50 130 C 44 140 54 144 50 150" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="54" cy="57" rx="40" ry="47" fill="rgba(0,0,0,0.12)" />
            <path d="M 50 104 C 18 92 8 70 8 50 C 8 24 27 6 50 6 C 73 6 92 24 92 50 C 92 70 82 92 50 104 Z" fill={`url(#bc-bal-${ok ? "ok" : "no"})`} stroke={c[2]} strokeWidth="3" />
            <path d="M 44 104 L 56 104 L 52 98 L 48 98 Z" fill={c[2]} />
            <ellipse cx="32" cy="30" rx="8" ry="14" fill="#fff" opacity="0.6" transform="rotate(25 32 30)" />
            <text x="50" y="66" textAnchor="middle" fontSize={n >= 10 ? 44 : 52} fill="#fff" stroke={c[2]} strokeWidth="5" paintOrder="stroke">
              {n}
            </text>
          </svg>
        </div>
      </div>
      <p className="font-game text-lg text-muted">이 수를 만들어요!</p>
    </div>
  );
}

export default function BinaryClockGame() {
  const [mode, setMode] = useState<Mode>("quiz");
  const [len, setLen] = useState(3);
  const [more, setMore] = useState(false);
  const [bits, setBits] = useState<boolean[]>(Array(3).fill(false));
  const [target, setTarget] = useState(() => 1 + rand(7));
  const [solved, setSolved] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [stars, setStars] = useState(0);
  const [round, setRound] = useState(1);
  const [finished, setFinished] = useState(false);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "불을 톡 눌러 켜요. 켜진 불의 숫자를 모두 더하면 풍선의 수가 돼요!" });
  const [now, setNow] = useState(() => new Date());
  const [hideDigits, setHideDigits] = useState(false);
  const [peek, setPeek] = useState(false);

  const st = useRef({ bits, target, solved, finished, hinted, mode, len, round, stars });
  st.current = { bits, target, solved, finished, hinted, mode, len, round, stars };
  const bitsRef = useRef(bits);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (mode !== "clock") return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  const value = fromBits(bits);
  const setB = (b: boolean[]) => {
    bitsRef.current = b;
    setBits(b);
  };
  const empty = (l = len) => Array<boolean>(l).fill(false);

  const newGame = (l = len) => {
    window.clearTimeout(timer.current);
    setTarget(1 + rand(2 ** l - 1));
    setB(empty(l));
    setSolved(false);
    setHinted(false);
    setStars(0);
    setRound(1);
    setFinished(false);
    setTouched(false);
    setMsg({ tone: "info", text: "새 게임이에요! 불을 톡 눌러서 풍선의 수를 만들어 봐요." });
  };

  const advance = (curRound: number, curStars: number, curTarget: number) => {
    if (curRound >= ROUNDS) {
      setFinished(true);
      setMsg({ tone: "ok", text: `끝! ${ROUNDS}문제 중 ⭐ ${curStars}개를 받았어요. ${curStars >= 4 ? "정말 잘했어요!" : "한 번 더 하면 더 잘할 수 있어요!"}` });
      return;
    }
    const mv = 2 ** st.current.len - 1;
    let t = 1 + rand(mv);
    while (t === curTarget && mv > 1) t = 1 + rand(mv);
    setTarget(t);
    setB(empty(st.current.len));
    setSolved(false);
    setHinted(false);
    setRound(curRound + 1);
    setMsg({ tone: "info", text: "새 풍선이에요! 불을 눌러서 수를 만들어 봐요." });
  };

  const toggle = (i: number) => {
    const S = st.current;
    if (S.mode === "quiz" && (S.solved || S.finished)) return;
    const prev = bitsRef.current;
    const nb = prev.map((b, j) => (j === i ? !b : b));
    setB(nb);
    setTouched(true);
    const v = fromBits(nb);
    const pv = fromBits(prev);
    if (S.mode === "quiz") {
      if (v === S.target) {
        setSolved(true);
        cheer();
        const gain = S.hinted ? 0 : 1;
        const ns = S.stars + gain;
        setStars(ns);
        setMsg({ tone: "ok", text: gain ? `⭐ 정답! ${sumText(nb)}. 별을 받았어요!` : `맞았어요! ${sumText(nb)}. 힌트를 썼으니 별은 없지만 잘했어요!` });
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => advance(S.round, ns, S.target), 1700);
      } else if (v > S.target) {
        if (pv <= S.target) oops();
        else tick();
        setMsg({ tone: "bad", text: `아깝다! 지금 ${v}이에요. 풍선의 ${S.target}보다 커요. 불을 하나 꺼 봐요.` });
      } else {
        tick();
        setMsg({ tone: "info", text: `지금 ${v}이에요. 풍선까지 ${S.target - v} 남았어요.` });
      }
    } else if (S.mode === "free") {
      const mx = 2 ** S.len - 1;
      if (v === mx) cheer();
      else tick();
      setMsg({ tone: v === mx ? "ok" : "info", text: v === mx ? `⭐ 불을 모두 켰어요! ${sumText(nb)}. 불 ${S.len}개로 만들 수 있는 가장 큰 수예요!` : `지금 수는 ${v}이에요.` });
    }
  };

  const showHint = () => {
    setHinted(true);
    setMsg({ tone: "info", text: `힌트: ${target}은(는) ${sumText(toBits(target, len))} 이에요. 이 숫자의 불을 켜 봐요.` });
  };

  const changeMode = (m: Mode) => {
    window.clearTimeout(timer.current);
    setMode(m);
    setB(empty());
    setSolved(false);
    setPeek(false);
    if (m === "quiz") newGame();
    else if (m === "free") setMsg({ tone: "info", text: "불을 마음대로 켜고 꺼 보세요. 켜진 불의 숫자를 모두 더한 값이 지금 수예요." });
  };

  const changeLen = (l: number) => {
    setLen(l);
    newGame(l);
  };

  const hh = now.getHours();
  const mm = now.getMinutes();
  const needFirst = !touched && round === 1 && mode === "quiz" ? toBits(target, len).findIndex(Boolean) : null;

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="mb-3 rounded-card bg-accent-soft px-3 py-2 font-bold">
          {mode === "quiz" ? "풍선의 수가 되도록 불을 톡 눌러요! (쓱 문지르면 여러 개가 한꺼번에 바뀌어요)" : mode === "free" ? "불을 켜고 꺼 보며 수가 어떻게 변하는지 봐요." : "지금 시각을 불로 나타냈어요. 켜진 불의 숫자를 더해 읽어 봐요."}
        </p>

        {mode !== "clock" && (
          <div className="space-y-3">
            {mode === "quiz" && <Balloon n={target} ok={solved} sad={!solved && value > target} />}
            <Bulbs bits={bits} onToggle={toggle} guide={needFirst} label={`불 ${len}개: ${weights(len).join(", ")}`} />
            <div className="text-center">
              <p className="text-muted">지금 내가 만든 수</p>
              <p className={`font-game text-5xl tabular-nums ${mode === "quiz" && solved ? "text-ok" : "text-ink"}`}>{value}</p>
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
              <p className="font-game text-4xl tabular-nums">{hideDigits && !peek ? "--시 --분" : `${pad(hh)}시 ${pad(mm)}분`}</p>
              <p className="tabular-nums text-muted">{hideDigits && !peek ? "불을 읽어서 시각을 맞혀 봐요" : `시: ${sumText(toBits(hh, 5))} / 분: ${sumText(toBits(mm, 6))}`}</p>
            </div>
          </div>
        )}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "quiz" && (
          <>
            <Stat label="⭐ 별" value={stars} tone={stars ? "ok" : "plain"} />
            <Stat label="풍선" value={`${round}/${ROUNDS}`} />
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
                <GButton variant="soft" onClick={showHint} disabled={solved} className={BIG}>💡 힌트 보기</GButton>
                <GButton onClick={() => setB(empty())} disabled={solved} className={BIG}>불 모두 끄기</GButton>
              </>
            )}
          </>
        )}
        {mode === "free" && (
          <>
            <GButton variant="primary" onClick={() => setB(empty())} className={BIG}>↻ 다시 하기 (모두 끄기)</GButton>
            <GButton onClick={() => setB(Array(len).fill(true))} className={BIG}>모두 켜기</GButton>
          </>
        )}
        {mode === "clock" && (
          <>
            <GButton variant="soft" pressed={hideDigits} onClick={() => { setHideDigits(!hideDigits); setPeek(false); }} className={BIG}>숫자 가리고 불만 읽기</GButton>
            {hideDigits && <GButton onClick={() => setPeek(!peek)} className={BIG}>{peek ? "다시 가리기" : "정답 보기"}</GButton>}
          </>
        )}
        <GButton pressed={more} onClick={() => { if (more && mode !== "quiz") changeMode("quiz"); setMore(!more); }} className={BIG}>{more ? "어려운 도전 닫기" : "더 어려운 도전"}</GButton>
      </div>

      {more && (
        <Board className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">놀이 고르기</span>
            {([["quiz", "풍선 맞히기"], ["free", "마음대로 켜 보기"], ["clock", "시계 보기"]] as [Mode, string][]).map(([m, t]) => (
              <GButton key={m} variant={mode === m ? "soft" : "ghost"} pressed={mode === m} onClick={() => changeMode(m)} className={BIG}>
                {t}
              </GButton>
            ))}
          </div>
          {mode !== "clock" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">불 개수 (많을수록 어려워요)</span>
              {[3, 4, 5].map((l) => (
                <GButton key={l} variant={len === l ? "soft" : "ghost"} pressed={len === l} onClick={() => changeLen(l)} className={BIG}>
                  {l}개
                </GButton>
              ))}
            </div>
          )}
        </Board>
      )}
    </div>
  );
}
