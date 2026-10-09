import { useEffect, useMemo, useState } from "react";
import { Board, GButton, cheer, oops, stageClear, tick, useStage } from "./kit";
import { BIG, Pill, Talk } from "./easykit";
import { cpuAdd, makeRounds, moverWins, safeNumbers, winningAdd, type GRound } from "./gotit.logic";

const GF = "Jua, Pretendard Variable, sans-serif";
const COLS = 10;
const CELL = 34;
const ROW_H = 50;
const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 귀여운 로봇 친구 얼굴 */
function Robot({ mood, size = 56 }: { mood: "think" | "happy" | "sad" | "idle"; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={mood === "think" ? "gz-bob" : mood === "sad" ? "am-shake" : ""}>
      <line x1="32" y1="6" x2="32" y2="14" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="4" fill={mood === "think" ? "#fde047" : "#f472b6"} stroke="#0f766e" strokeWidth="2" />
      <rect x="8" y="14" width="48" height="40" rx="14" fill="#5eead4" stroke="#0f766e" strokeWidth="3" />
      <rect x="3" y="28" width="6" height="12" rx="3" fill="#99f6e4" stroke="#0f766e" strokeWidth="2" />
      <rect x="55" y="28" width="6" height="12" rx="3" fill="#99f6e4" stroke="#0f766e" strokeWidth="2" />
      <rect x="14" y="22" width="36" height="20" rx="9" fill="#ecfeff" stroke="#0f766e" strokeWidth="2" />
      {mood === "happy" ? (
        <>
          <path d="M20 33 Q24 27 28 33" stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M36 33 Q40 27 44 33" stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="24" cy="32" r="4" fill="#0f766e" />
          <circle cx="40" cy="32" r="4" fill="#0f766e" />
          <circle cx="25.4" cy="30.6" r="1.4" fill="#fff" />
          <circle cx="41.4" cy="30.6" r="1.4" fill="#fff" />
        </>
      )}
      <path d={mood === "sad" ? "M25 49 Q32 44 39 49" : "M25 46 Q32 52 39 46"} stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="45" r="3" fill="#fda4af" opacity="0.8" />
      <circle cx="47" cy="45" r="3" fill="#fda4af" opacity="0.8" />
    </svg>
  );
}

export default function GotItGame() {
  const level = useStage();
  const rounds = useMemo<GRound[]>(() => makeRounds(level), [level]);
  const [ri, setRi] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const r = rounds[ri];
  const { T, k } = r;
  const [s, setS] = useState(r.s0);
  const [turn, setTurn] = useState<"me" | "cpu">(r.first);
  const [phase, setPhase] = useState<"play" | "won" | "lost">("play");
  const [owners, setOwners] = useState<Record<number, "me" | "cpu">>({});
  const [hint, setHint] = useState(0);
  const [fx, setFx] = useState<{ n: number; t: "ok" | "bad" | "" }>({ n: 0, t: "" });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>(() => ({ t: "info", s: startText(rounds[0]) }));
  const [moved, setMoved] = useState(false);

  const safes = useMemo(() => safeNumbers(T, k), [T, k]);
  const reveal = hint >= 1 || phase !== "play";
  const left = T - s;
  const win = winningAdd(T, k, s);

  function startText(x: GRound) {
    return x.first === "me" ? `내가 먼저 해요! 합계가 ${x.T} 이 되게 만들면 이겨요.` : `이번엔 로봇이 먼저 해요. 로봇이 더한 다음, 내가 ★ 에 닿게 더해 봐요!`;
  }

  const finish = (who: "me" | "cpu") => {
    if (who === "me") {
      cheer();
      setFx((f) => ({ n: f.n + 1, t: "ok" }));
      setPhase("won");
      setMsg({ t: "ok", s: `${T} 을 만들었어요! 내가 이겼어요! ⭐ 별(★) 자리를 기억해요: ${safes.join(", ")}. 이 수를 먼저 만들면 늘 이겨요!` });
    } else {
      oops();
      setFx((f) => ({ n: f.n + 1, t: "bad" }));
      setPhase("lost");
      setMsg({ t: "bad", s: `로봇이 ${T} 을 만들었어요. 아쉬워요! 별(★) 자리 ${safes.join(", ")} 를 먼저 밟으면 이겨요. 곧 다시 해 봐요!` });
    }
  };
  const addNum = (a: number, who: "me" | "cpu") => {
    const n = s + a;
    setS(n);
    setOwners((o) => ({ ...o, [n]: who }));
    tick();
    if (n === T) {
      finish(who);
      return;
    }
    setTurn(who === "me" ? "cpu" : "me");
    if (who === "me") {
      if (moverWins(T, k, n)) setMsg({ t: "info", s: `${n} 은 ★ 자리가 아니에요. 로봇이 이길 수도 있어요! 힌트를 눌러 봐요.` });
      else setMsg({ t: "info", s: `좋아요, ${n} 은 ★ 자리예요! 로봇이 뭘 더해도 내가 다음에 ★ 로 갈 수 있어요.` });
    } else setMsg({ t: "info", s: `로봇이 ${a} 을 더해서 ${n} 이 됐어요. 이제 내 차례!` });
  };

  // 로봇 차례
  useEffect(() => {
    if (phase !== "play" || turn !== "cpu") return;
    const id = setTimeout(() => addNum(cpuAdd(T, k, s, r.err, Math.random), "cpu"), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, s, ri, attempt]);

  // 끝난 뒤: 이기면 다음 라운드(마지막이면 레벨 클리어), 지면 같은 라운드 다시
  useEffect(() => {
    if (phase === "play") return;
    const last = ri >= rounds.length - 1;
    const id = setTimeout(
      () => {
        if (phase === "lost") {
          resetRound(ri, attempt + 1);
        } else if (last) stageClear();
        else resetRound(ri + 1, 0);
      },
      phase === "lost" ? 3200 : last ? 3800 : 2800,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function resetRound(i: number, att: number) {
    const x = rounds[i];
    setRi(i);
    setAttempt(att);
    setS(x.s0);
    setTurn(x.first);
    setPhase("play");
    setOwners({});
    setHint(0);
    setMoved(false);
    setFx((f) => ({ ...f, t: "" }));
    setMsg({ t: "info", s: att > 0 ? `같은 판을 다시 해 봐요. ${startText(x)}` : startText(x) });
  }

  const press = (a: number) => {
    if (phase !== "play" || turn !== "me" || s + a > T) return;
    setMoved(true);
    addNum(a, "me");
  };
  const askHint = () => {
    if (phase !== "play") return;
    if (hint === 0) {
      setHint(1);
      setMsg({ t: "info", s: `🤖 로봇은 이렇게 생각해요: 목표 ${T} 에서 거꾸로 ${k + 1}씩 빼요. ★ 자리는 ${safes.join(", ")}! 이 수를 만들면 로봇이 뭘 더해도 내가 다시 ★ 에 닿을 수 있어요.` });
    } else {
      setHint(2);
      if (turn !== "me") setMsg({ t: "info", s: "로봇이 더하는 중이에요. 잠깐만 기다려요!" });
      else if (win === null) setMsg({ t: "info", s: "지금은 ★ 에 닿을 수 없어요. 1을 더하고 로봇이 실수하길 기다려요!" });
      else setMsg({ t: "info", s: `지금 합계는 ${s} 예요. ${win} 을 더하면 ★ ${s + win} 에 닿아요! (${s} + ${win} = ${s + win})` });
    }
  };

  // 말판 좌표 (뱀 모양: 아래 줄은 왼→오, 다음 줄은 오→왼)
  const rowsN = Math.ceil((T + 1) / COLS);
  const W = COLS * CELL + 20;
  const H = rowsN * ROW_H + 34;
  const pos = (i: number): [number, number] => {
    const row = Math.floor(i / COLS);
    const c = i % COLS;
    const x = 10 + CELL / 2 + (row % 2 === 0 ? c : COLS - 1 - c) * CELL;
    return [x, H - 30 - row * ROW_H];
  };
  const pts = Array.from({ length: T + 1 }, (_, i) => pos(i));
  const [tx, ty] = pos(s);
  const rm = reduceMotion();

  return (
    <div className="space-y-3 text-base">
      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Pill label={`레벨 ${level} · 라운드`} value={`${ri + 1} / ${rounds.length}`} />
          <Pill label="목표" value={T} tone="ok" />
          <Pill label="한 번에" value={`1~${k}`} />
        </div>

        <div className="mb-2 flex items-center gap-3">
          <Robot mood={phase === "won" ? "sad" : phase === "lost" ? "happy" : turn === "cpu" ? "think" : "idle"} />
          <p className="font-game text-xl leading-snug">
            {phase === "play" ? (turn === "me" ? "🐣 내 차례! 숫자를 눌러 더해요" : "🤖 로봇이 생각 중이에요…") : phase === "won" ? "🎉 내가 이겼어요!" : "😅 로봇이 이겼어요"}
          </p>
        </div>

        <div key={fx.n} className={fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`수 말판. 지금 합계 ${s}, 목표 ${T}`} className="mx-auto block w-full max-w-[560px] select-none overflow-hidden rounded-card shadow-[0_6px_0_rgba(15,118,110,0.25)]" style={{ fontFamily: GF }}>
            <defs>
              <linearGradient id="gi-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#a5f3fc" />
                <stop offset="1" stopColor="#ecfccb" />
              </linearGradient>
              <linearGradient id="gi-grass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#86efac" />
                <stop offset="1" stopColor="#34d399" />
              </linearGradient>
            </defs>
            <rect width={W} height={H} fill="url(#gi-sky)" />
            <circle cx={W - 30} cy={26} r={15} fill="#fde047" stroke="#f59e0b" strokeWidth={3} />
            <g fill="#fff" opacity="0.9" aria-hidden>
              <ellipse cx={40} cy={22} rx={24} ry={9} />
              <circle cx={30} cy={17} r={9} />
              <circle cx={50} cy={15} r={11} />
            </g>
            <path d={`M0 ${H} L0 ${H - 26} Q ${W / 4} ${H - 46} ${W / 2} ${H - 26} T ${W} ${H - 24} L ${W} ${H} Z`} fill="url(#gi-grass)" stroke="#16a34a" strokeWidth={2} />
            <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fde68a" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke="#fbbf24" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} strokeDasharray="1 11" />
            {pts.map(([x, y], i) => {
              const own = owners[i];
              const isSafe = safes.includes(i);
              const fill = i === T ? "#86efac" : own === "me" ? "#7dd3fc" : own === "cpu" ? "#fdba74" : "#fffbeb";
              const stroke = i === T ? "#15803d" : own === "me" ? "#0369a1" : own === "cpu" ? "#c2410c" : "#b45309";
              return (
                <g key={i}>
                  <ellipse cx={x} cy={y + 3} rx={14} ry={11} fill="#000" opacity={0.12} />
                  <ellipse cx={x} cy={y} rx={14} ry={11} fill={fill} stroke={stroke} strokeWidth={2.5} />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize={i >= 10 ? 13 : 14} fill="#422006" style={{ fontFamily: GF }}>
                    {i}
                  </text>
                  {reveal && isSafe && (
                    <text x={x} y={y - 12} textAnchor="middle" fontSize={17} fill="#facc15" stroke="#b45309" strokeWidth={1.2} paintOrder="stroke" aria-hidden>
                      ★
                    </text>
                  )}
                  {i === T && (
                    <text x={x} y={y - 15} textAnchor="middle" fontSize={16} aria-hidden>
                      🏁
                    </text>
                  )}
                </g>
              );
            })}
            <g style={{ transform: `translate(${tx}px, ${ty - 4}px)`, transition: rm ? "none" : "transform 0.55s cubic-bezier(.3,1.5,.5,1)" }} aria-hidden>
              <ellipse cx={0} cy={9} rx={9} ry={4} fill="#000" opacity={0.2} />
              <text x={0} y={4} textAnchor="middle" fontSize={24}>
                {turn === "me" || phase === "won" ? "🐣" : "🤖"}
              </text>
            </g>
          </svg>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-game leading-none">
            <span className="text-base text-muted">지금 합계 </span>
            <span className="text-6xl text-accent tabular-nums">{s}</span>
            <span className="ml-1 text-2xl text-muted tabular-nums">/ {T}</span>
          </p>
          <p className="font-game rounded-full bg-accent-soft px-3 py-1 text-lg">목표까지 {left}</p>
        </div>

        <div className="relative mt-3">
          {!moved && phase === "play" && turn === "me" && (
            <p className="font-game gz-bob mb-1 text-center text-xl text-accent" aria-hidden>
              👆 숫자 단추를 눌러요!
            </p>
          )}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${k}, minmax(0, 1fr))` }} role="group" aria-label="더할 수 고르기">
            {Array.from({ length: k }, (_, i) => i + 1).map((a) => {
              const off = phase !== "play" || turn !== "me" || s + a > T;
              const glow = hint >= 2 && turn === "me" && win === a && phase === "play";
              return (
                <button
                  key={a}
                  type="button"
                  disabled={off}
                  onClick={() => press(a)}
                  aria-label={`${a} 더하기`}
                  className={`font-game min-h-[64px] rounded-2xl border-[3px] text-4xl text-white transition active:translate-y-1 disabled:opacity-40 ${glow ? "gz-bob ring-4 ring-yellow-300" : ""}`}
                  style={{ background: "radial-gradient(circle at 35% 25%, #5eead4, #0d9488)", borderColor: "#115e59", boxShadow: "0 5px 0 #115e59", textShadow: "0 2px 0 #115e59" }}
                >
                  +{a}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3">
          <Talk tone={msg.t}>{msg.s}</Talk>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="soft" className={BIG} onClick={askHint} disabled={phase !== "play"}>
            💡 힌트{hint === 0 ? "" : hint === 1 ? " (한 번 더 누르면 정답)" : ""}
          </GButton>
          <GButton className={BIG} onClick={() => resetRound(ri, attempt + 1)}>↺ 이 판 다시</GButton>
        </div>
      </Board>
    </div>
  );
}
