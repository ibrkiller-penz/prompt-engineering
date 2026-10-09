import { useEffect, useRef, useState } from "react";
import { Board, GButton, cheer, oops, stageClear, svgPoint, tick, useStage } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { applyMove, canMove, hintMove, isGoal, levelRounds, stacks, starsFor, topOf, type HMove, type Pegs } from "./hanoi.logic";

const ROUNDS = 3;
const VW = 600;
const VH = 360;
const BASE = 300;
const PX = [110, 300, 490];
const PEG_NAME = ["왼쪽", "가운데", "오른쪽"];
const FONT = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
const COLORS: [string, string, string][] = [
  ["#fda4af", "#f43f5e", "#9f1239"],
  ["#fdba74", "#f97316", "#9a3412"],
  ["#fde047", "#eab308", "#854d0e"],
  ["#86efac", "#22c55e", "#166534"],
  ["#67e8f9", "#06b6d4", "#155e75"],
  ["#93c5fd", "#3b82f6", "#1e3a8a"],
  ["#d8b4fe", "#a855f7", "#6b21a8"],
];
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const pegAt = (x: number) => (x < 200 ? 0 : x < 400 ? 1 : 2);
const wOf = (d: number) => 48 + d * 20;

type Msg = { t: string; tone: "info" | "ok" | "bad" };

function Disk({ d, dh, mood }: { d: number; dh: number; mood: "ok" | "oops" | "happy" }) {
  const w = wOf(d);
  const [c1, c2, c3] = COLORS[d];
  const e = Math.min(9, w / 6);
  return (
    <g>
      <ellipse cx="0" cy={dh / 2 + 1} rx={w / 2 - 2} ry="4" fill="rgba(0,0,0,0.22)" />
      <rect x={-w / 2} y={-dh / 2 + 1} width={w} height={dh - 2} rx={(dh - 2) / 2} fill={`url(#hn-g${d})`} stroke={c3} strokeWidth="3" />
      <rect x={-w / 2 + 8} y={-dh / 2 + 4} width={w * 0.34} height="4" rx="2" fill="#fff" opacity="0.55" />
      <circle cx={-e} cy="0" r="2.8" fill="#1c1917" />
      <circle cx={e} cy="0" r="2.8" fill="#1c1917" />
      <circle cx={-e - 0.8} cy="-1" r="0.9" fill="#fff" />
      <circle cx={e - 0.8} cy="-1" r="0.9" fill="#fff" />
      <path d={mood === "oops" ? "M -4 6 Q 0 3 4 6" : mood === "happy" ? "M -5 3 Q 0 9 5 3 Z" : "M -4 4 Q 0 7 4 4"} fill={mood === "happy" ? "#be123c" : "none"} stroke="#1c1917" strokeWidth="1.8" strokeLinecap="round" />
      {w > 90 && (
        <>
          <circle cx={-w / 2 + 14} cy="0" r="2" fill={c3} opacity="0.5" />
          <circle cx={w / 2 - 14} cy="0" r="2" fill={c3} opacity="0.5" />
          <circle cx={-w / 2 + 24} cy="-5" r="2" fill="#fff" opacity="0.6" />
          <circle cx={w / 2 - 24} cy="-5" r="2" fill="#fff" opacity="0.6" />
        </>
      )}
      <title>{`원반 ${d + 1}`}</title>
      <defs>
        <linearGradient id={`hn-g${d}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c1} />
          <stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
    </g>
  );
}

export default function HanoiGame() {
  const level = useStage();
  const [rounds] = useState(() => levelRounds(level));
  const [ri, setRi] = useState(0);
  const R = rounds[ri];
  const [pegs, setPegs] = useState<Pegs>(R.pegs);
  const [moves, setMoves] = useState(0);
  const [hist, setHist] = useState<Pegs[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; x: number; y: number } | null>(null);
  const [hint, setHint] = useState<HMove | null>(null);
  const [bad, setBad] = useState<{ moving: number; blocker: number; k: number } | null>(null);
  const [won, setWon] = useState(false);
  const [stars, setStars] = useState(0);
  const [total, setTotal] = useState(0);
  const [why, setWhy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<Msg>({ t: `원반을 끌어서 ${PEG_NAME[R.goal]} 기둥으로 모두 옮겨요! 맨 위 원반만 움직일 수 있어요.`, tone: "info" });

  const st = useRef({ pegs, moves, ri, won, hist });
  st.current = { pegs, moves, ri, won, hist };
  const svgRef = useRef<SVGSVGElement>(null);
  const gest = useRef<{ from: number; px: number; py: number; moved: boolean } | null>(null);
  const timer = useRef(0);
  const badTimer = useRef(0);
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(badTimer.current);
    },
    [],
  );

  const n = R.n;
  const dh = n >= 6 ? 26 : 32;
  const pegTop = BASE - Math.max(150, n * dh + 40);
  const stk = stacks(pegs);
  const dpos = (d: number): [number, number] => {
    const p = pegs[d];
    return [PX[p], BASE - dh * (stk[p].indexOf(d) + 0.5)];
  };

  const finish = (np: Pegs, nm: number) => {
    const S = st.current;
    const s = starsFor(nm, R.min);
    setWon(true);
    setStars(s);
    const nt = total + s;
    setTotal(nt);
    cheer();
    const base = nm === R.min ? `⭐ 최고예요! ${nm}번, 가장 적게 옮겼어요!` : `⭐ 성공! ${nm}번 옮겼어요. (가장 적게는 ${R.min}번)`;
    window.clearTimeout(timer.current);
    if (S.ri + 1 >= ROUNDS) {
      setMsg({ t: `${base} 레벨 ${level} 끝!`, tone: "ok" });
      timer.current = window.setTimeout(() => stageClear(), 1200);
    } else {
      setMsg({ t: `${base} 곧 다음 판이 나와요.`, tone: "ok" });
      timer.current = window.setTimeout(() => {
        const nr = rounds[S.ri + 1];
        setRi(S.ri + 1);
        setPegs(nr.pegs);
        setMoves(0);
        setHist([]);
        setSel(null);
        setHint(null);
        setWon(false);
        setStars(0);
        setMsg({ t: `새 판이에요! 원반 ${nr.n}개를 ${PEG_NAME[nr.goal]} 기둥으로 옮겨요.`, tone: "info" });
      }, 2400);
    }
    void np;
  };

  const tryMove = (from: number, to: number) => {
    const S = st.current;
    if (S.won || from === to || topOf(S.pegs, from) < 0) return;
    if (!canMove(S.pegs, from, to)) {
      oops();
      const moving = topOf(S.pegs, from);
      const blocker = topOf(S.pegs, to);
      window.clearTimeout(badTimer.current);
      setBad({ moving, blocker, k: Date.now() });
      badTimer.current = window.setTimeout(() => setBad(null), 900);
      setMsg({ t: "앗, 큰 원반은 작은 원반 위에 올릴 수 없어요! 다른 기둥으로 해 봐요.", tone: "bad" });
      return;
    }
    tick();
    const np = applyMove(S.pegs, from, to);
    const nm = S.moves + 1;
    setHist([...S.hist, S.pegs]);
    setPegs(np);
    setMoves(nm);
    setHint(null);
    setSel(null);
    if (isGoal(np, R.goal)) finish(np, nm);
    else setMsg({ t: `${PEG_NAME[from]} → ${PEG_NAME[to]}로 옮겼어요. (${nm}번째)`, tone: "info" });
  };

  const tapPeg = (p: number) => {
    const S = st.current;
    if (S.won) return;
    setTouched(true);
    if (sel === null) {
      if (topOf(S.pegs, p) < 0) {
        setMsg({ t: "이 기둥은 비었어요. 원반이 있는 기둥을 눌러요.", tone: "info" });
        return;
      }
      tick();
      setSel(p);
      setMsg({ t: "원반이 들렸어요! 옮길 기둥을 눌러요.", tone: "info" });
    } else if (sel === p) {
      setSel(null);
      setMsg({ t: "취소했어요.", tone: "info" });
    } else tryMove(sel, p);
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (st.current.won) return;
    const [x, y] = svgPoint(svgRef.current!, e.clientX, e.clientY);
    const p = pegAt(x);
    setTouched(true);
    gest.current = { from: p, px: x, py: y, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gest.current;
    if (!g) return;
    const [x, y] = svgPoint(svgRef.current!, e.clientX, e.clientY);
    if (!g.moved && Math.hypot(x - g.px, y - g.py) < 14) return;
    if (!g.moved) {
      if (topOf(st.current.pegs, g.from) < 0) return;
      g.moved = true;
      setSel(null);
    }
    setDrag({ from: g.from, x, y });
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const g = gest.current;
    gest.current = null;
    setDrag(null);
    if (!g) return;
    const [x] = svgPoint(svgRef.current!, e.clientX, e.clientY);
    if (g.moved) tryMove(g.from, pegAt(x));
    else tapPeg(g.from);
  };

  const undo = () => {
    const S = st.current;
    if (S.won || !S.hist.length) return;
    const prev = S.hist[S.hist.length - 1];
    setPegs(prev);
    setHist(S.hist.slice(0, -1));
    setHint(null);
    setSel(null);
    tick();
    setMsg({ t: "한 수 되돌렸어요. (이동 횟수는 그대로 세요)", tone: "info" });
  };
  const reset = () => {
    if (st.current.won) return;
    setPegs(R.pegs);
    setMoves(0);
    setHist([]);
    setSel(null);
    setHint(null);
    setMsg({ t: "처음 모습으로 돌렸어요. 다시 해 봐요!", tone: "info" });
  };
  const giveHint = () => {
    const S = st.current;
    if (S.won) return;
    const h = hintMove(S.pegs, R.goal);
    if (!h) return;
    setHint(h);
    setMsg({ t: `💡 ${PEG_NAME[h.from]} 기둥의 맨 위 원반을 ${PEG_NAME[h.to]} 기둥으로 옮겨 봐요! (이대로만 하면 가장 적게 옮겨요)`, tone: "info" });
  };

  const showGuide = level === 1 && ri === 0 && moves === 0 && !touched;
  const rm = reduced();
  const dragDisk = drag ? topOf(pegs, drag.from) : -1;

  return (
    <div className="space-y-3 text-base">
      <p className="font-game text-center text-xl text-accent">레벨 {level} · 라운드 {ri + 1}/{ROUNDS}</p>
      <Talk tone={msg.tone}>{msg.t}</Talk>

      <Board className="!p-2">
        <style>{`
          @keyframes hn-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}75%{transform:translateX(7px)}}
          @keyframes hn-blink{0%,100%{opacity:1}50%{opacity:.25}}
          @keyframes hn-party{0%,100%{transform:translateY(0)}40%{transform:translateY(-14px)}}
          @keyframes hn-pulse{0%,100%{opacity:.35}50%{opacity:1}}
          @keyframes hn-cloud{0%,100%{transform:translateX(0)}50%{transform:translateX(18px)}}
          .hn-shake{animation:hn-shake .35s ease-in-out 2}
          .hn-blink{animation:hn-blink .3s ease-in-out 3}
          .hn-party{animation:hn-party .6s ease-in-out infinite}
          .hn-pulse{animation:hn-pulse 1s ease-in-out infinite}
          .hn-cloud{animation:hn-cloud 9s ease-in-out infinite}
          @media (prefers-reduced-motion: reduce){.hn-shake,.hn-blink,.hn-party,.hn-pulse,.hn-cloud{animation:none}}
        `}</style>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="block h-auto w-full select-none rounded-[18px]"
          style={{ touchAction: "none", ...FONT }}
          role="group"
          aria-label={`하노이의 탑. 원반 ${n}개를 ${PEG_NAME[R.goal]} 기둥으로 옮겨요`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            gest.current = null;
            setDrag(null);
          }}
        >
          <defs>
            <linearGradient id="hn-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#e0f2fe" />
            </linearGradient>
            <linearGradient id="hn-table" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbbf24" />
              <stop offset="1" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="hn-peg" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#92400e" />
              <stop offset="0.4" stopColor="#d97706" />
              <stop offset="1" stopColor="#78350f" />
            </linearGradient>
            <radialGradient id="hn-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fef08a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={VW} height={VH} fill="url(#hn-sky)" />
          <circle cx="545" cy="48" r="24" fill="#fde047" stroke="#f59e0b" strokeWidth="3" />
          <g className="hn-cloud" opacity="0.95">
            <ellipse cx="120" cy="52" rx="42" ry="16" fill="#fff" />
            <circle cx="98" cy="42" r="16" fill="#fff" />
            <circle cx="132" cy="38" r="20" fill="#fff" />
          </g>
          <g className="hn-cloud" opacity="0.9" style={{ animationDelay: "-4s" }}>
            <ellipse cx="380" cy="30" rx="34" ry="12" fill="#fff" />
            <circle cx="366" cy="22" r="12" fill="#fff" />
            <circle cx="394" cy="20" r="15" fill="#fff" />
          </g>
          <path d={`M 0 ${BASE - 40} Q 90 ${BASE - 90} 200 ${BASE - 50} T 400 ${BASE - 55} T ${VW} ${BASE - 45} V ${BASE} H 0 Z`} fill="#86efac" stroke="#16a34a" strokeWidth="3" />
          {/* 탁자 */}
          <rect x="0" y={BASE - 6} width={VW} height={VH - BASE + 6} fill="url(#hn-table)" />
          <rect x="0" y={BASE - 6} width={VW} height="10" fill="#fcd34d" />
          <line x1="0" y1={BASE + 4} x2={VW} y2={BASE + 4} stroke="#92400e" strokeWidth="3" />

          {PX.map((x, p) => {
            const isGoalPeg = p === R.goal;
            const isSel = sel === p;
            return (
              <g key={p}>
                {isGoalPeg && <circle cx={x} cy={BASE - 70} r="92" fill="url(#hn-glow)" className="hn-pulse" />}
                <rect x={x - 70} y={BASE - 8} width="140" height="16" rx="8" fill="#92400e" stroke="#78350f" strokeWidth="3" />
                <rect x={x - 8} y={pegTop} width="16" height={BASE - pegTop} rx="8" fill="url(#hn-peg)" stroke="#78350f" strokeWidth="2.5" />
                {isGoalPeg && (
                  <g transform={`translate(${x} ${pegTop - 4})`} pointerEvents="none">
                    <line x1="0" y1="0" x2="0" y2="-34" stroke="#78350f" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 2 -34 L 34 -26 L 2 -16 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="2" />
                  </g>
                )}
                {isSel && <rect x={x - 90} y={pegTop - 30} width="180" height={BASE - pegTop + 50} rx="16" fill="none" stroke="#0d9488" strokeWidth="4" strokeDasharray="8 6" />}
                <text x={x} y={BASE + 36} textAnchor="middle" fontSize="20" fill="#fff7ed" stroke="#78350f" strokeWidth="4" paintOrder="stroke">
                  {PEG_NAME[p]}
                  {isGoalPeg ? " (도착!)" : ""}
                </text>
              </g>
            );
          })}

          {Array.from({ length: n }, (_, d) => {
            const [bx, by] = dpos(d);
            const isTop = topOf(pegs, pegs[d]) === d;
            let x = bx;
            let y = by;
            let lift = false;
            if (drag && d === dragDisk) {
              x = drag.x;
              y = drag.y - 36;
              lift = true;
            } else if (sel !== null && isTop && pegs[d] === sel) {
              y = pegTop - dh;
              lift = true;
            }
            const cls = bad && bad.moving === d ? "hn-shake" : bad && bad.blocker === d ? "hn-blink" : won ? "hn-party" : "";
            return (
              <g key={d} pointerEvents="none" style={{ transform: `translate(${x}px, ${y}px)`, transition: drag && d === dragDisk ? "none" : rm ? "none" : "transform 0.22s cubic-bezier(.3,1.4,.5,1)" }}>
                <g className={cls} style={won ? { animationDelay: `${d * 0.08}s` } : undefined}>
                  <Disk d={d} dh={dh} mood={won ? "happy" : bad && bad.moving === d ? "oops" : "ok"} />
                  {bad && bad.blocker === d && <rect x={-wOf(d) / 2 - 3} y={-dh / 2 - 1} width={wOf(d) + 6} height={dh + 2} rx={dh / 2 + 2} fill="none" stroke="#dc2626" strokeWidth="4" />}
                  {lift && <ellipse cx="0" cy={dh / 2 + 24} rx={wOf(d) / 2 - 6} ry="4" fill="rgba(0,0,0,0.14)" />}
                </g>
              </g>
            );
          })}

          {hint && (
            <g pointerEvents="none">
              <path d={`M ${PX[hint.from]} ${pegTop - 24} Q ${(PX[hint.from] + PX[hint.to]) / 2} ${pegTop - 90} ${PX[hint.to]} ${pegTop - 24}`} fill="none" stroke="#7c3aed" strokeWidth="6" strokeDasharray="10 8" strokeLinecap="round" className="hn-pulse" />
              <path d={`M ${PX[hint.to] - 12} ${pegTop - 40} L ${PX[hint.to]} ${pegTop - 20} L ${PX[hint.to] + 12} ${pegTop - 40}`} fill="none" stroke="#7c3aed" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )}

          {showGuide && (
            <g pointerEvents="none">
              <text fontSize="40" textAnchor="middle">
                👆
                {!rm && <animateMotion dur="2s" repeatCount="indefinite" path={`M ${PX[rounds[0].pegs[0]]} ${BASE - dh * (n + 0.2) - 4} L ${PX[R.goal]} ${pegTop - 40}`} />}
              </text>
              <text x={VW / 2} y={36} textAnchor="middle" fontSize="26" fill="#c2410c" stroke="#fff" strokeWidth="5" paintOrder="stroke">
                맨 위 원반을 끌어서 깃발 기둥으로!
              </text>
            </g>
          )}
        </svg>

        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="기둥 누르기">
          {PEG_NAME.map((nm, p) => (
            <GButton key={p} variant={sel === p ? "primary" : "soft"} pressed={sel === p} onClick={() => tapPeg(p)} className={BIG}>
              {nm} 기둥
            </GButton>
          ))}
        </div>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Pill label="옮긴 횟수" value={moves} tone={won ? "ok" : "plain"} />
        <Pill label="가장 적게" value={R.min} />
        <Pill label="원반" value={`${n}개`} />
        {won && <Stars n={stars} />}
        <Pill label="⭐ 모은 별" value={total} tone={total ? "ok" : "plain"} />
      </div>

      <div className="flex flex-wrap gap-2">
        <GButton variant="soft" onClick={giveHint} disabled={won} className={BIG}>💡 힌트 보기</GButton>
        <GButton onClick={undo} disabled={won || hist.length === 0} className={BIG}>↶ 한 수 되돌리기</GButton>
        <GButton variant="primary" onClick={reset} disabled={won} className={BIG}>↻ 다시 하기</GButton>
        {n >= 3 && <GButton pressed={why} onClick={() => setWhy(!why)} className={BIG}>🤔 왜 이만큼일까?</GButton>}
      </div>

      {why && n >= 3 && (
        <Board className="gz-pop space-y-2 leading-relaxed">
          <p className="font-game text-lg">원반이 늘면 횟수가 2배보다 1번 더 많아져요</p>
          <p>가장 큰 원반을 옮기려면 ① 나머지 원반을 모두 다른 기둥으로 옮기고, ② 가장 큰 원반을 옮기고, ③ 나머지 원반을 다시 그 위로 옮겨야 해요. 그래서 (한 개 적을 때 횟수) × 2 + 1번이에요.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[18rem] border-collapse text-center">
              <thead>
                <tr>
                  <th className="border border-line bg-bg px-2 py-1">원반</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((k) => (
                    <th key={k} className={`border border-line px-2 py-1 ${k === n ? "bg-accent text-accent-ink" : "bg-bg"}`}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="border border-line bg-bg px-2 py-1">가장 적게</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((k) => (
                    <td key={k} className={`font-game border border-line px-2 py-1 ${k === n ? "bg-accent-soft" : ""}`}>{2 ** k - 1}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-muted">1, 3, 7, 15, 31 … 앞의 수의 2배에 1을 더하면 다음 수예요. (2를 n번 곱한 수에서 1을 뺀 값이기도 해요)</p>
          {!R.std && <p className="text-muted">※ 이번 판은 원반이 처음부터 흩어져 있어서 위 표보다 적게 옮길 수도 있어요.</p>}
        </Board>
      )}
    </div>
  );
}
