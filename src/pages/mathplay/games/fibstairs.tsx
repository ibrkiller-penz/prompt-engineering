import { useState } from "react";
import { Board, GButton, Say, Stat } from "./kit";

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
type Msg = { tone: "info" | "ok" | "bad"; text: string };

export default function FibStairsGame() {
  const [n, setN] = useState(4);
  const [steps, setSteps] = useState<number[]>([]); // 지금 올라가는 중인 걸음들
  const [found, setFound] = useState<Record<number, string[]>>({});
  const [last, setLast] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "‘한 칸’ 또는 ‘두 칸’을 눌러 꼭대기까지 올라가 보세요." });

  const total = countWays(n);
  const list = found[n] ?? [];
  const pos = steps.reduce((a, b) => a + b, 0);
  const complete = list.length === total;

  const changeN = (k: number) => {
    setN(k);
    setSteps([]);
    setLast(null);
    const f = (found[k] ?? []).length;
    setMsg({ tone: "info", text: f === countWays(k) ? `${k}칸 계단은 이미 모두 찾았어요!` : `${k}칸 계단이에요. 방법은 모두 몇 가지일까요?` });
  };

  const go = (d: 1 | 2) => {
    let base = steps;
    if (pos === n) base = []; // 꼭대기에서 누르면 새로 시작
    const np = base.reduce((a, b) => a + b, 0) + d;
    if (np > n) {
      setMsg({ tone: "bad", text: "계단이 모자라요. 남은 칸은 한 칸뿐이에요." });
      return;
    }
    const ns = [...base, d];
    setSteps(ns);
    if (np < n) {
      setMsg({ tone: "info", text: `${np}칸째에 서 있어요. 계속 올라가요.` });
      return;
    }
    const key = ns.join("+");
    if (list.includes(key)) {
      setMsg({ tone: "bad", text: `${key} 은(는) 이미 찾은 방법이에요. 다른 순서로 올라가 보세요.` });
      setLast(key);
      return;
    }
    const nl = [...list, key];
    setFound({ ...found, [n]: nl });
    setLast(key);
    if (nl.length === total) setMsg({ tone: "ok", text: `대단해요! ${n}칸 계단의 방법 ${total}가지를 모두 찾았어요. 아래 표에서 규칙을 찾아봐요.` });
    else setMsg({ tone: "ok", text: `새로운 방법이에요! ${key} (${nl.length}/${total})` });
  };

  const undo = () => {
    if (steps.length === 0 || pos === n) return;
    setSteps(steps.slice(0, -1));
    setMsg({ tone: "info", text: "한 걸음 되돌렸어요." });
  };

  const restart = () => {
    setSteps([]);
    setMsg({ tone: "info", text: "아래로 내려왔어요. 다시 올라가 보세요." });
  };

  const resetAll = () => {
    setFound({ ...found, [n]: [] });
    setSteps([]);
    setLast(null);
    setMsg({ tone: "info", text: `${n}칸 계단의 기록을 지웠어요. 처음부터 찾아봐요.` });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "1") go(1);
    else if (e.key === "2") go(2);
    else if (e.key === "Backspace") undo();
  };

  // 그림 크기
  const SW = 56;
  const SH = 32;
  const VW = 560;
  const VH = MAXN * SH + 70;
  const x0 = (VW - n * SW) / 2;
  const base = VH - 24;
  const px = pos === 0 ? x0 - SW * 0.45 : x0 + (pos - 0.5) * SW;
  const py = base - pos * SH;

  return (
    <div className="space-y-3" onKeyDown={onKey}>
      <Board>
        <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="계단 칸 수 고르기">
          <span className="text-sm font-semibold">계단 칸 수</span>
          {Array.from({ length: MAXN }, (_, i) => i + 1).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => changeN(k)}
              aria-pressed={k === n}
              aria-label={`${k}칸 계단`}
              className={`h-11 w-11 rounded-card text-base font-bold ${k === n ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:bg-bg"} ${(found[k]?.length ?? 0) === countWays(k) ? "ring-2 ring-ok" : ""}`}
            >
              {k}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${VW} ${VH}`} className="block h-auto w-full select-none rounded-card bg-bg" role="img" aria-label={`${n}칸 계단. 지금 ${pos}칸째`}>
          <line x1="0" y1={base} x2={VW} y2={base} stroke="#94a3b8" strokeWidth="3" />
          {Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <rect x={x0 + i * SW} y={base - (i + 1) * SH} width={SW} height={(i + 1) * SH} fill={i + 1 === pos ? "#fde68a" : "#e2e8f0"} stroke="#64748b" strokeWidth="2" />
              <text x={x0 + i * SW + SW / 2} y={base - (i + 1) * SH + 20} textAnchor="middle" fontSize="15" fontWeight="700" fill="#475569">
                {i + 1}
              </text>
            </g>
          ))}
          <g transform={`translate(${x0 + n * SW - 6}, ${base - n * SH - 38})`}>
            <line x1="0" y1="0" x2="0" y2="38" stroke="#475569" strokeWidth="3" />
            <path d="M 0 0 L 24 7 L 0 14 Z" fill="#ef4444" />
          </g>
          <g style={{ transform: `translate(${px}px, ${py}px)`, transition: "transform 0.25s ease" }}>
            <circle cx="0" cy="-26" r="10" fill="#f97316" stroke="#fff" strokeWidth="2" />
            <rect x="-8" y="-17" width="16" height="17" rx="5" fill="#2563eb" />
          </g>
        </svg>

        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="primary" onClick={() => go(1)} className="min-w-[7rem]">한 칸 (1)</GButton>
          <GButton variant="primary" onClick={() => go(2)} disabled={n === 1 || (pos !== n && n - pos < 2)} className="min-w-[7rem]">두 칸 (2)</GButton>
          <GButton onClick={undo} disabled={steps.length === 0 || pos === n}>↶ 한 걸음 뒤로</GButton>
          <GButton onClick={restart} disabled={steps.length === 0}>↓ 아래로 내려가기</GButton>
        </div>
        <p className="mt-2 text-sm text-muted">지금까지 올라온 길: <strong className="text-ink">{steps.length ? steps.join(" + ") : "(아직 안 올랐어요)"}</strong></p>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="찾은 방법" value={`${list.length}/${total}`} tone={complete ? "ok" : "plain"} />
        <Stat label="지금 위치" value={`${pos}칸`} />
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <Board>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold">찾은 방법 목록</h3>
          <GButton onClick={resetAll} className="min-h-[44px] text-sm" disabled={list.length === 0}>이 계단 다시 하기</GButton>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-muted">아직 찾은 방법이 없어요.</p>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="찾은 방법">
            {list.map((w, i) => (
              <li key={w} className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${w === last ? "bg-ok-soft text-ok" : "bg-accent-soft text-accent"}`}>
                {i + 1}. {w}
              </li>
            ))}
          </ul>
        )}
      </Board>

      {complete && (
        <Board>
          <h3 className="mb-2 text-sm font-bold">칸 수별 방법의 수</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-center text-sm">
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
          <p className="mt-2 text-sm leading-relaxed text-muted">1, 2, 3, 5, 8, 13, 21, 34 … 앞의 두 수를 더하면 다음 수가 되는 피보나치 수가 나타나요. 왜 그럴까요? 마지막 걸음이 한 칸이었는지 두 칸이었는지로 나눠 생각해 봐요.</p>
        </Board>
      )}
    </div>
  );
}
