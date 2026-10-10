import { useEffect, useRef, useState } from "react";
import { Board, GButton, cheer, oops, stageClear, tick, useStage } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { allOff, levelRounds, press, solve, starsFor, type Board as Grid } from "./lightsout.logic";

const ROUNDS = 3;
const FONT = { fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" };
type Msg = { t: string; tone: "info" | "ok" | "bad" };

/** 귀여운 전구: 켜지면 노랗게 빛나고, 꺼지면 졸린 얼굴 */
function Bulb({ on, win, hot }: { on: boolean; win: boolean; hot: boolean }) {
  return (
    <svg viewBox="0 0 80 90" className="pointer-events-none block h-full w-full" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <radialGradient id="lo-on" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fffbeb" />
          <stop offset="0.5" stopColor="#fde047" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
        <radialGradient id="lo-off" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#312e81" />
        </radialGradient>
        <radialGradient id="lo-halo" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fde047" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
      </defs>
      {on && <circle cx="40" cy="38" r="46" fill="url(#lo-halo)" />}
      <path d="M 40 8 C 20 8 11 22 11 35 C 11 47 20 52 25 62 L 55 62 C 60 52 69 47 69 35 C 69 22 60 8 40 8 Z" fill={on ? "url(#lo-on)" : "url(#lo-off)"} stroke={on ? "#d97706" : "#1e1b4b"} strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx="28" cy="25" rx="6" ry="10" fill="#fff" opacity={on ? 0.75 : 0.25} transform="rotate(25 28 25)" />
      <rect x="25" y="62" width="30" height="18" rx="5" fill={on ? "#fbbf24" : "#4338ca"} stroke={on ? "#92400e" : "#1e1b4b"} strokeWidth="3" />
      <line x1="26" y1="68" x2="54" y2="68" stroke={on ? "#92400e" : "#1e1b4b"} strokeWidth="2" />
      <line x1="26" y1="74" x2="54" y2="74" stroke={on ? "#92400e" : "#1e1b4b"} strokeWidth="2" />
      {on ? (
        <>
          <circle cx="31" cy="34" r="3.5" fill="#1c1917" />
          <circle cx="49" cy="34" r="3.5" fill="#1c1917" />
          <circle cx="30" cy="33" r="1.1" fill="#fff" />
          <circle cx="48" cy="33" r="1.1" fill="#fff" />
          <path d="M 33 43 Q 40 51 47 43 Z" fill="#be123c" stroke="#1c1917" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="23" cy="42" r="4" fill="#fb7185" opacity="0.6" />
          <circle cx="57" cy="42" r="4" fill="#fb7185" opacity="0.6" />
        </>
      ) : (
        <>
          <path d="M 26 35 Q 31 39 36 35" fill="none" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" />
          <path d="M 44 35 Q 49 39 54 35" fill="none" stroke="#c7d2fe" strokeWidth="3" strokeLinecap="round" />
          <circle cx="40" cy="45" r="2.6" fill="#c7d2fe" />
          <text x="60" y="14" fontSize="14" fill="#a5b4fc" style={FONT}>z</text>
          {win && <text x="8" y="12" fontSize="16" fill="#fde047">★</text>}
        </>
      )}
      {hot && <circle cx="40" cy="40" r="44" fill="none" stroke="#a78bfa" strokeWidth="5" strokeDasharray="8 6" className="lo-pulse" />}
    </svg>
  );
}

export default function LightsOutGame() {
  const level = useStage();
  const [rounds] = useState(() => levelRounds(level));
  const [ri, setRi] = useState(0);
  const R = rounds[ri];
  const N = R.N;
  const [board, setBoard] = useState<Grid>(R.board);
  const [presses, setPresses] = useState(0);
  const [hint, setHint] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [stars, setStars] = useState(0);
  const [total, setTotal] = useState(0);
  const [touched, setTouched] = useState(false);
  const [flip, setFlip] = useState<{ k: number; cells: number[] }>({ k: 0, cells: [] });
  const [msg, setMsg] = useState<Msg>({ t: "불을 누르면 그 불과 위·아래·양옆 불이 같이 바뀌어요. 모든 불을 꺼요!", tone: "info" });

  const st = useRef({ board, presses, won, ri });
  st.current = { board, presses, won, ri };
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const lit = board.filter(Boolean).length;
  const left = won ? 0 : (solve(board, N)?.length ?? 0);

  const finish = (np: number) => {
    const S = st.current;
    const s = starsFor(np, R.min);
    setWon(true);
    setStars(s);
    setTotal((t) => t + s);
    cheer();
    const base = np === R.min ? `⭐ 최고예요! ${np}번, 가장 적게 눌러서 모두 껐어요!` : `⭐ 모두 껐어요! ${np}번 눌렀어요. (가장 적게는 ${R.min}번)`;
    window.clearTimeout(timer.current);
    if (S.ri + 1 >= ROUNDS) {
      setMsg({ t: `${base} 레벨 ${level} 끝!`, tone: "ok" });
      timer.current = window.setTimeout(() => stageClear(), 1200);
    } else {
      setMsg({ t: `${base} 곧 다음 판이 나와요.`, tone: "ok" });
      timer.current = window.setTimeout(() => {
        const nr = rounds[S.ri + 1];
        setRi(S.ri + 1);
        setBoard(nr.board);
        setPresses(0);
        setHint(null);
        setWon(false);
        setStars(0);
        setMsg({ t: nr.N !== N ? `새 판이에요! 이번엔 ${nr.N}×${nr.N} 판이에요. 모든 불을 꺼요!` : "새 판이에요! 모든 불을 꺼요!", tone: "info" });
      }, 2400);
    }
  };

  const tap = (i: number) => {
    const S = st.current;
    if (S.won) return;
    setTouched(true);
    const before = solve(S.board, N)?.length ?? 0;
    const nb = press(S.board, N, i);
    const np = S.presses + 1;
    const x = i % N;
    const y = Math.floor(i / N);
    setFlip({ k: Date.now(), cells: [i, x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1].filter((v) => v >= 0) });
    setBoard(nb);
    setPresses(np);
    setHint(null);
    if (allOff(nb)) {
      finish(np);
      return;
    }
    const after = solve(nb, N)?.length ?? 0;
    if (after > before) {
      oops();
      setMsg({ t: `아깝다! 끄는 길이 더 멀어졌어요. 같은 불을 한 번 더 누르면 돌아가요. (남은 최소 ${after}번)`, tone: "bad" });
    } else {
      tick();
      setMsg({ t: after < before ? `좋아요! 켜진 불이 ${nb.filter(Boolean).length}개 남았어요. 잘 가고 있어요!` : `켜진 불이 ${nb.filter(Boolean).length}개 남았어요. 계속해 봐요!`, tone: "info" });
    }
  };

  const giveHint = () => {
    if (st.current.won) return;
    const s = solve(st.current.board, N);
    if (!s || !s.length) return;
    const c = s[0];
    setHint(c);
    setMsg({ t: `💡 ${Math.floor(c / N) + 1}줄 ${(c % N) + 1}번째 불을 눌러 봐요! (보라색 점선이에요)`, tone: "info" });
  };
  const reset = () => {
    if (st.current.won) return;
    setBoard(R.board);
    setPresses(0);
    setHint(null);
    setMsg({ t: "처음 모습으로 돌렸어요. 다시 해 봐요!", tone: "info" });
  };

  // 처음 3초 손짓: 첫 판에서는 눌러야 할 불에 손가락
  const guide = level === 1 && ri === 0 && presses === 0 && !touched ? (solve(R.board, N) ?? [])[0] : null;
  const size = N === 3 ? "max-w-[330px]" : N === 4 ? "max-w-[340px]" : "max-w-[360px]";

  return (
    <div className="space-y-3 text-base">
      <p className="font-game text-center text-xl text-accent">레벨 {level} · 라운드 {ri + 1}/{ROUNDS}</p>
      <Talk tone={msg.tone}>{msg.t}</Talk>

      <Board className="!p-2">
        <style>{`
          @keyframes lo-flip{0%{transform:scale(.7) rotate(-8deg)}60%{transform:scale(1.12) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
          @keyframes lo-pulse{0%,100%{opacity:.3}50%{opacity:1}}
          @keyframes lo-twinkle{0%,100%{opacity:.25}50%{opacity:1}}
          @keyframes lo-party{0%,100%{transform:translateY(0)}40%{transform:translateY(-10px)}}
          .lo-flip{animation:lo-flip .32s ease-out}
          .lo-pulse{animation:lo-pulse 1s ease-in-out infinite}
          .lo-tw{animation:lo-twinkle 2.4s ease-in-out infinite}
          .lo-party{animation:lo-party .7s ease-in-out infinite}
          @media (prefers-reduced-motion: reduce){.lo-flip,.lo-pulse,.lo-tw,.lo-party{animation:none}}
        `}</style>
        <div className="relative overflow-hidden rounded-[18px] border-[3px] border-[#1e1b4b] px-3 pb-6 pt-8 shadow-[0_4px_0_0_#1e1b4b]" style={{ background: "linear-gradient(180deg,#1e1b4b 0%,#3730a3 60%,#6d28d9 100%)" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            {[[30, 30], [90, 70], [160, 24], [250, 50], [320, 28], [370, 90], [60, 150], [350, 180], [20, 260], [380, 300], [200, 380], [90, 360]].map(([x, y], i) => (
              <path key={i} className="lo-tw" style={{ animationDelay: `${i * 0.3}s` }} d={`M ${x} ${y - 6} l 2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 z`} fill="#fef08a" />
            ))}
            <circle cx="345" cy="45" r="22" fill="#fef3c7" stroke="#fcd34d" strokeWidth="3" />
            <circle cx="353" cy="38" r="20" fill="#3730a3" />
            <path d="M 0 400 L 0 360 Q 60 330 120 360 T 260 350 T 400 355 L 400 400 Z" fill="#1e1b4b" />
          </svg>
          <div className={`relative mx-auto grid w-full gap-1.5 ${size}`} style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, touchAction: "manipulation" }} role="group" aria-label={`불 ${N}×${N}`}>
            {board.map((on, i) => {
              const flipped = flip.cells.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  aria-label={`${Math.floor(i / N) + 1}줄 ${(i % N) + 1}번째 불, ${on ? "켜짐" : "꺼짐"}`}
                  aria-pressed={on}
                  onClick={() => tap(i)}
                  className={`relative aspect-square min-h-[48px] rounded-2xl border-2 p-1 transition-colors ${on ? "border-amber-300/70 bg-amber-200/10" : "border-white/10 bg-white/5"} ${won ? "lo-party" : ""}`}
                  style={won ? { animationDelay: `${(i % N) * 0.1}s` } : undefined}
                >
                  <span key={flipped ? flip.k : "s"} className={`block h-full w-full ${flipped ? "lo-flip" : ""}`}>
                    <Bulb on={on} win={won} hot={hint === i} />
                  </span>
                  {guide === i && (
                    <span className="gz-bob pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 text-4xl" aria-hidden="true">
                      👆
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {guide !== null && <p className="relative mt-5 text-center text-lg text-amber-200" style={FONT}>이 불을 눌러 봐요!</p>}
        </div>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Pill label="누른 횟수" value={presses} tone={won ? "ok" : "plain"} />
        <Pill label="켜진 불" value={lit} />
        <Pill label="가장 적게" value={R.min} />
        {won ? <Stars n={stars} /> : <Pill label="남은 최소" value={left} />}
        <Pill label="⭐ 모은 별" value={total} tone={total ? "ok" : "plain"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <GButton variant="soft" onClick={giveHint} disabled={won} className={BIG}>💡 힌트 보기</GButton>
        <GButton variant="primary" onClick={reset} disabled={won} className={BIG}>↻ 다시 하기</GButton>
      </div>
      <p className="text-muted">같은 불을 두 번 누르면 원래대로 돌아와요. 누르는 순서는 상관없고, 어느 불을 몇 번 누르는지가 중요해요!</p>
    </div>
  );
}
