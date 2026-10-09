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
        <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full select-none rounded-card bg-bg" style={{ touchAction: "manipulation" }} role="group" aria-label={`${n}칸 계단. 지금 ${pos}칸째. 계단을 눌러 올라가요`}>
          <line x1="0" y1={base} x2={VW} y2={base} stroke="#94a3b8" strokeWidth="4" />
          <text x={X0 - 36} y={base + 22} textAnchor="middle" fontSize="16" fontWeight="700" fill="#64748b">출발</text>
          {Array.from({ length: n }, (_, i) => {
            const k = i + 1;
            const d = k - pos;
            const hot = !busy && (d === 1 || d === 2);
            const x = X0 + i * SW;
            const top = base - k * SH;
            return (
              <g key={k} role="button" tabIndex={0} aria-label={`${k}번 계단${hot ? `, 눌러서 ${d}칸 올라가기` : ""}`} onClick={() => tapStep(k)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), tapStep(k))} style={{ cursor: "pointer", outline: "none" }}>
                <rect x={x} y={top} width={SW} height={k * SH} fill={k === pos ? "#fde68a" : "#e2e8f0"} stroke="#64748b" strokeWidth="2.5" />
                <rect x={x} y={top} width={SW} height="9" fill={hot ? (d === 1 ? "#3b82f6" : "#f97316") : "#cbd5e1"} />
                {hot && (
                  <g className="animate-pulse">
                    <rect x={x + 2} y={top + 2} width={SW - 4} height={k * SH - 4} fill={d === 1 ? "#3b82f6" : "#f97316"} opacity="0.3" />
                    <text x={x + SW / 2} y={top + 34} textAnchor="middle" fontSize="22" fontWeight="800" fill={d === 1 ? "#1d4ed8" : "#c2410c"}>
                      {d === 1 ? "한 칸" : "두 칸"}
                    </text>
                  </g>
                )}
                {!hot && (
                  <text x={x + SW / 2} y={top + 32} textAnchor="middle" fontSize="20" fontWeight="700" fill="#475569">
                    {k}
                  </text>
                )}
              </g>
            );
          })}
          <g pointerEvents="none" transform={`translate(${X0 + n * SW - 8}, ${base - n * SH - 46})`}>
            <line x1="0" y1="0" x2="0" y2="46" stroke="#475569" strokeWidth="4" />
            <path d="M 0 0 L 30 9 L 0 18 Z" fill="#ef4444" />
          </g>
          <g pointerEvents="none" style={{ transform: `translate(${px}px, ${py}px)`, transition: "transform 0.28s cubic-bezier(.3,1.6,.5,1)" }}>
            <ellipse cx="0" cy="2" rx="14" ry="4" fill="rgba(0,0,0,0.2)" />
            <circle cx="0" cy="-34" r="13" fill="#f97316" stroke="#fff" strokeWidth="3" />
            <rect x="-11" y="-22" width="22" height="22" rx="7" fill="#2563eb" />
          </g>
          {firstEver && (
            <text x={X0 + SW / 2} y={base - SH - 50} textAnchor="middle" fontSize="22" fontWeight="800" fill="#c2410c" stroke="#fff" strokeWidth="4" paintOrder="stroke" pointerEvents="none">
              ↓ 여기를 눌러요!
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
