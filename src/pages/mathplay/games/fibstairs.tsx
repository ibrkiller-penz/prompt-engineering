import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, tick } from "./kit";

// ==PURE-START==
/** n칸 계단을 한 칸·두 칸씩 올라 정확히 끝까지 가는 모든 방법 (예: "1+2+1") */
export function allWays(n: number): string[] {
  const out: string[] = [];
  const go = (left: number, acc: number[]) => {
    if (left === 0) {
      out.push(acc.join("+"));
      return;
    }
    go(left - 1, [...acc, 1]);
    if (left >= 2) go(left - 2, [...acc, 2]);
  };
  go(n, []);
  return out;
}
export function countWays(n: number): number {
  let a = 1; // 0칸
  let b = 1; // 1칸
  for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
// ==PURE-END==

const MAXN = 8;
const REDUCE = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// 계단 색: [윗면, 몸통, 테두리]
const STEP_COLORS: [string, string, string][] = [
  ["#fecaca", "#f87171", "#b91c1c"],
  ["#fed7aa", "#fb923c", "#c2410c"],
  ["#fef08a", "#facc15", "#a16207"],
  ["#bbf7d0", "#4ade80", "#15803d"],
  ["#bae6fd", "#38bdf8", "#0369a1"],
  ["#c7d2fe", "#818cf8", "#4338ca"],
  ["#f5d0fe", "#e879f9", "#a21caf"],
  ["#fbcfe8", "#f472b6", "#be185d"],
];

/** 토끼 (발 아래 가운데가 0,0) */
function Bunny({ happy }: { happy: boolean }) {
  return (
    <g>
      <ellipse cx="0" cy="1" rx="16" ry="4" fill="rgba(0,0,0,0.2)" />
      <ellipse cx="-7" cy="-56" rx="6" ry="16" fill="#fff" stroke="#9f1239" strokeWidth="2.5" transform="rotate(-10 -7 -56)" />
      <ellipse cx="7" cy="-56" rx="6" ry="16" fill="#fff" stroke="#9f1239" strokeWidth="2.5" transform="rotate(10 7 -56)" />
      <ellipse cx="-7" cy="-55" rx="2.8" ry="11" fill="#fda4af" transform="rotate(-10 -7 -55)" />
      <ellipse cx="7" cy="-55" rx="2.8" ry="11" fill="#fda4af" transform="rotate(10 7 -55)" />
      <ellipse cx="0" cy="-14" rx="14" ry="14" fill="#fff" stroke="#9f1239" strokeWidth="2.5" />
      <ellipse cx="-8" cy="-2" rx="6" ry="3.5" fill="#fff" stroke="#9f1239" strokeWidth="2" />
      <ellipse cx="8" cy="-2" rx="6" ry="3.5" fill="#fff" stroke="#9f1239" strokeWidth="2" />
      <circle cx="0" cy="-33" r="14" fill="#fff" stroke="#9f1239" strokeWidth="2.5" />
      <circle cx="-5" cy="-35" r="2.6" fill="#1c1917" />
      <circle cx="5" cy="-35" r="2.6" fill="#1c1917" />
      <circle cx="-4.2" cy="-36" r="0.9" fill="#fff" />
      <circle cx="5.8" cy="-36" r="0.9" fill="#fff" />
      <circle cx="-9" cy="-29" r="3" fill="#fb7185" opacity="0.6" />
      <circle cx="9" cy="-29" r="3" fill="#fb7185" opacity="0.6" />
      <ellipse cx="0" cy="-30" rx="2" ry="1.5" fill="#f43f5e" />
      <path d={happy ? "M -5 -27 Q 0 -21 5 -27" : "M -3 -26 Q 0 -24 3 -26"} fill={happy ? "#be123c" : "none"} stroke="#1c1917" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="13" cy="-12" r="5" fill="#fff" stroke="#9f1239" strokeWidth="2" />
    </g>
  );
}
const AUTO_MAX = 5;
const BIG = "min-h-[48px]! text-base";
type Msg = { tone: "info" | "ok" | "bad"; text: string };

export default function FibStairsGame() {
  const [n, setN] = useState(1);
  const [more, setMore] = useState(false);
  const [steps, setSteps] = useState<number[]>([]); // 지금 올라가는 중인 걸음들
  const [found, setFound] = useState<Record<number, string[]>>({});
  const [last, setLast] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "깜빡이는 계단을 눌러서 깃발까지 올라가요!" });
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const total = countWays(n);
  const list = found[n] ?? [];
  const pos = steps.reduce((a, b) => a + b, 0);
  const complete = list.length === total;
  const busy = pos === n; // 꼭대기에서 잠깐 쉬는 중

  const gotoN = (k: number, text?: string) => {
    window.clearTimeout(timer.current);
    setN(k);
    setSteps([]);
    setLast(null);
    setMsg({ tone: "info", text: text ?? ((found[k] ?? []).length === countWays(k) ? `${k}칸 계단은 이미 다 찾았어요!` : `${k}칸 계단이에요. 깜빡이는 계단을 눌러요! 방법이 모두 몇 가지일까요?`) });
  };

  const go = (d: number) => {
    if (busy || d < 1 || d > 2) return;
    const np = pos + d;
    if (np > n) {
      oops();
      setMsg({ tone: "bad", text: "앗, 계단이 모자라요. 남은 칸은 한 칸뿐이에요." });
      return;
    }
    tick();
    const ns = [...steps, d];
    setSteps(ns);
    if (np < n) {
      setMsg({ tone: "info", text: `${np}칸째에 서 있어요. 다음 계단을 눌러요!` });
      return;
    }
    const key = ns.join("+");
    window.clearTimeout(timer.current);
    if (list.includes(key)) {
      oops();
      setLast(key);
      setMsg({ tone: "bad", text: `아깝다! ${key} 는 이미 찾은 방법이에요. 다른 순서로 올라가 봐요.` });
      timer.current = window.setTimeout(() => setSteps([]), 1100);
      return;
    }
    const nl = [...list, key];
    setFound({ ...found, [n]: nl });
    setLast(key);
    if (nl.length === total) {
      cheer();
      if (n < AUTO_MAX) {
        setMsg({ tone: "ok", text: `⭐ 대단해요! ${n}칸 계단의 방법 ${total}가지를 모두 찾았어요! 곧 ${n + 1}칸 계단이 나와요.` });
        timer.current = window.setTimeout(() => gotoN(n + 1), 2600);
      } else setMsg({ tone: "ok", text: `⭐ 대단해요! ${n}칸 계단의 방법 ${total}가지를 모두 찾았어요! 아래 표도 구경해 봐요.` });
    } else {
      tick();
      setMsg({ tone: "ok", text: `좋아요! 새로운 방법을 찾았어요: ${key} (${nl.length}/${total}). 다시 올라가 봐요!` });
      timer.current = window.setTimeout(() => setSteps([]), 1000);
    }
  };

  const tapStep = (k: number) => {
    if (busy) return;
    const d = k - pos;
    if (d === 1 || d === 2) go(d);
    else if (d > 2) setMsg({ tone: "info", text: "한 번에 한 칸이나 두 칸만 갈 수 있어요. 깜빡이는 계단을 눌러요!" });
    else setMsg({ tone: "info", text: "앞쪽에 있는 계단을 눌러요!" });
  };

  const undo = () => {
    if (steps.length === 0 || busy) return;
    setSteps(steps.slice(0, -1));
    setMsg({ tone: "info", text: "한 걸음 뒤로 갔어요." });
  };

  const hint = () => {
    const rest = allWays(n).filter((w) => !list.includes(w));
    if (rest.length === 0) setMsg({ tone: "ok", text: "이미 모두 찾았어요!" });
    else setMsg({ tone: "info", text: `힌트: 이런 방법이 아직 남았어요 → ${rest[0]} (1은 한 칸, 2는 두 칸이에요)` });
  };

  const resetAll = () => {
    window.clearTimeout(timer.current);
    setFound({});
    setSteps([]);
    setLast(null);
    setN(1);
    setMsg({ tone: "info", text: "처음부터 다시 해요. 깜빡이는 계단을 눌러요!" });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "1") go(1);
    else if (e.key === "2") go(2);
    else if (e.key === "Backspace") undo();
  };

  const SW = 72;
  const SH = 36;
  const X0 = 64;
  const VW = X0 + n * SW + 40;
  const VH = Math.max(n, 3) * SH + 120;
  const base = VH - 28;
  const px = pos === 0 ? X0 - 36 : X0 + (pos - 0.5) * SW;
  const py = base - pos * SH;
  const firstEver = Object.keys(found).length === 0 && steps.length === 0;

  return (
    <div className="space-y-3 text-base" onKeyDown={onKey}>
      <p className="rounded-card bg-accent-soft px-3 py-2 font-bold">깜빡이는 계단을 눌러 깃발까지 올라가요. 방법을 모두 찾아봐요!</p>
      <Board>
        <style>{`
          @keyframes fs-hop{0%{transform:translateY(0) scale(1,1)}20%{transform:translateY(2px) scale(1.15,.85)}55%{transform:translateY(-26px) scale(.92,1.1)}85%{transform:translateY(0) scale(1.1,.9)}100%{transform:translateY(0) scale(1,1)}}
          @keyframes fs-cheer{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-16px) rotate(-8deg)}50%{transform:translateY(0) rotate(0)}75%{transform:translateY(-16px) rotate(8deg)}}
          @keyframes fs-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
          .fs-hop{animation:fs-hop .42s ease-out;transform-box:fill-box;transform-origin:50% 100%}
          .fs-cheer{animation:fs-cheer .9s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
          .fs-shake{animation:fs-shake .3s ease-in-out 2}
          @media (prefers-reduced-motion: reduce){.fs-hop,.fs-cheer,.fs-shake{animation:none}}
        `}</style>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full select-none rounded-card" style={{ touchAction: "manipulation", fontFamily: "Jua, Pretendard Variable, sans-serif" }} role="group" aria-label={`${n}칸 계단. 지금 ${pos}칸째. 계단을 눌러 올라가요`}>
          <defs>
            <linearGradient id="fs-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#e0f2fe" />
            </linearGradient>
            <linearGradient id="fs-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#86efac" />
              <stop offset="1" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <rect width={VW} height={VH} fill="url(#fs-sky)" />
          <circle cx="34" cy="30" r="18" fill="#fde047" stroke="#f59e0b" strokeWidth="3" />
          {[[VW * 0.35, 34, 1], [VW * 0.7, 22, 0.8]].map(([x, y, sc], i) => (
            <g key={i} transform={`translate(${x} ${y}) scale(${sc})`} opacity="0.95">
              <ellipse cx="0" cy="0" rx="30" ry="13" fill="#fff" />
              <circle cx="-12" cy="-7" r="12" fill="#fff" />
              <circle cx="10" cy="-9" r="15" fill="#fff" />
              {!REDUCE && <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0; 14 0; 0 0" dur={`${7 + i * 3}s`} repeatCount="indefinite" />}
            </g>
          ))}
          <rect x="0" y={base} width={VW} height={VH - base} fill="url(#fs-grass)" />
          <path d={`M 0 ${base} ${Array.from({ length: Math.ceil(VW / 16) }, (_, i) => `L ${i * 16 + 8} ${base - 6} L ${i * 16 + 16} ${base}`).join(" ")}`} fill="#4ade80" />
          <rect x={X0 - 64} y={base - 2} width="56" height="12" rx="6" fill="#fbbf24" stroke="#b45309" strokeWidth="2" />
          <text x={X0 - 36} y={base + 26} textAnchor="middle" fontSize="18" fill="#14532d" stroke="#fff" strokeWidth="3" paintOrder="stroke">출발</text>
          {Array.from({ length: n }, (_, i) => {
            const k = i + 1;
            const d = k - pos;
            const hot = !busy && (d === 1 || d === 2);
            const x = X0 + i * SW;
            const top = base - k * SH;
            const [c1, c2, c3] = STEP_COLORS[i % STEP_COLORS.length];
            return (
              <g key={k} role="button" tabIndex={0} aria-label={`${k}번 계단${hot ? `, 눌러서 ${d}칸 올라가기` : ""}`} onClick={() => tapStep(k)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), tapStep(k))} style={{ cursor: "pointer", outline: "none" }}>
                <rect x={x + 4} y={top + 6} width={SW} height={k * SH} rx="6" fill="rgba(0,0,0,0.15)" />
                <rect x={x} y={top} width={SW} height={k * SH} rx="6" fill={c2} stroke={c3} strokeWidth="3" />
                <rect x={x + 1.5} y={top + 1.5} width={SW - 3} height="11" rx="5" fill={c1} />
                {hot && (
                  <g className="animate-pulse">
                    <rect x={x + 3} y={top + 3} width={SW - 6} height={k * SH - 6} rx="5" fill="#fff" opacity="0.45" />
                    <rect x={x - 3} y={top - 3} width={SW + 6} height={k * SH + 6} rx="8" fill="none" stroke={d === 1 ? "#2563eb" : "#ea580c"} strokeWidth="5" />
                  </g>
                )}
                {hot ? (
                  <text x={x + SW / 2} y={top + 36} textAnchor="middle" fontSize="23" fill={d === 1 ? "#1d4ed8" : "#c2410c"} stroke="#fff" strokeWidth="5" paintOrder="stroke">
                    {d === 1 ? "한 칸" : "두 칸"}
                  </text>
                ) : (
                  <text x={x + SW / 2} y={top + 34} textAnchor="middle" fontSize="22" fill="#fff" stroke={c3} strokeWidth="4" paintOrder="stroke">
                    {k}
                  </text>
                )}
              </g>
            );
          })}
          <g pointerEvents="none" transform={`translate(${X0 + n * SW - 10}, ${base - n * SH - 52})`}>
            <line x1="0" y1="0" x2="0" y2="52" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
            <circle cx="0" cy="-2" r="5" fill="#fde047" stroke="#b45309" strokeWidth="2" />
            <path d="M 2 3 Q 18 -2 34 8 Q 18 18 2 20 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="2">
              {!REDUCE && <animate attributeName="d" values="M 2 3 Q 18 -2 34 8 Q 18 18 2 20 Z; M 2 3 Q 18 6 34 10 Q 18 22 2 20 Z; M 2 3 Q 18 -2 34 8 Q 18 18 2 20 Z" dur="1.2s" repeatCount="indefinite" />}
            </path>
          </g>
          <g pointerEvents="none" style={{ transform: `translate(${px}px, ${py}px)`, transition: "transform 0.3s cubic-bezier(.3,1.6,.5,1)" }}>
            <g key={`${pos}-${steps.length}`} className={complete && busy ? "fs-cheer" : "fs-hop"}>
              <Bunny happy={busy} />
            </g>
          </g>
          {firstEver && (
            <text x={X0 + SW / 2} y={base - SH - 50} textAnchor="middle" fontSize="24" fill="#c2410c" stroke="#fff" strokeWidth="5" paintOrder="stroke" pointerEvents="none">
              👇 여기를 눌러요!
            </text>
          )}
        </svg>
        <p className="mt-2 text-base text-muted">지금까지 올라온 길: <strong className="text-ink">{steps.length ? steps.join(" + ") : "(아직 안 올랐어요)"}</strong></p>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="계단" value={`${n}칸`} />
        <Stat label="⭐ 찾은 방법" value={`${list.length}/${total}`} tone={complete ? "ok" : "plain"} />
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton onClick={undo} disabled={steps.length === 0 || busy} className={BIG}>↶ 한 걸음 뒤로</GButton>
        <GButton variant="soft" onClick={hint} className={BIG}>💡 힌트 보기</GButton>
        <GButton pressed={more} onClick={() => { if (more && n > AUTO_MAX) gotoN(AUTO_MAX); setMore(!more); }} className={BIG}>{more ? "어려운 도전 닫기" : "더 어려운 도전"}</GButton>
        <GButton onClick={resetAll} className={BIG}>↻ 처음부터</GButton>
      </div>

      {more && (
        <Board className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">계단 몇 칸으로 할까?</span>
          {Array.from({ length: MAXN }, (_, i) => i + 1).map((k) => (
            <button key={k} type="button" onClick={() => gotoN(k)} aria-pressed={k === n} aria-label={`${k}칸 계단`} className={`h-12 w-12 rounded-card text-lg font-bold ${k === n ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:bg-bg"} ${(found[k]?.length ?? 0) === countWays(k) ? "ring-2 ring-ok" : ""}`}>
              {k}
            </button>
          ))}
        </Board>
      )}

      <Board>
        <h3 className="mb-2 text-base font-bold">찾은 방법 목록</h3>
        {list.length === 0 ? (
          <p className="text-base text-muted">아직 찾은 방법이 없어요. (1은 한 칸, 2는 두 칸)</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="찾은 방법">
            {list.map((w, i) => (
              <li key={w} className={`rounded-full px-3 py-1.5 text-base font-semibold tabular-nums ${w === last ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent"}`}>
                {i + 1}. {w}
              </li>
            ))}
          </ul>
        )}
      </Board>

      {complete && n >= 3 && (
        <Board>
          <h3 className="mb-2 text-base font-bold">계단 칸 수마다 방법이 몇 가지일까?</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-center text-base">
              <thead>
                <tr>
                  <th className="border border-line bg-bg px-2 py-1">계단 칸 수</th>
                  {Array.from({ length: MAXN }, (_, i) => (
                    <th key={i} className={`border border-line px-2 py-1 ${i + 1 === n ? "bg-accent text-accent-ink" : "bg-bg"}`}>{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="border border-line bg-bg px-2 py-1">방법의 수</th>
                  {Array.from({ length: MAXN }, (_, i) => (
                    <td key={i} className={`border border-line px-2 py-1 font-bold tabular-nums ${i + 1 === n ? "bg-accent-soft" : ""}`}>{countWays(i + 1)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-base leading-relaxed text-muted">1, 2, 3, 5, 8, 13, 21, 34 … 앞의 두 수를 더하면 다음 수가 돼요! (이런 수를 피보나치 수라고 불러요.) 왜 그럴까요? 마지막에 한 칸을 올랐는지, 두 칸을 올랐는지 나눠서 생각해 봐요.</p>
        </Board>
      )}
    </div>
  );
}
