import { useEffect, useMemo, useRef, useState } from "react";
import { makeColorSquare } from "./poly";
import { cheer, oops, stageClear, tick, useStage } from "./games/kit";

/** 칩 색: 사진 속 교구처럼 1 빨강 · 2 노랑 · 3 초록 · 4 파랑 · 5 주황. 숫자도 같이 써서 색을 구분하기 어려워도 풀 수 있다. */
const CHIP = [
  "",
  "#d63b3b", // 1
  "#e3a21a", // 2
  "#1f7a5f", // 3
  "#244f93", // 4
  "#e8742f", // 5
];

type Puzzle = { solution: number[][]; given: boolean[][] };

function conflicts(g: number[][]): boolean[][] {
  const n = g.length;
  const bad = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const mark = (cells: [number, number][]) => {
    const seen = new Map<number, [number, number][]>();
    for (const [r, c] of cells) {
      const v = g[r][c];
      if (!v) continue;
      seen.set(v, [...(seen.get(v) ?? []), [r, c]]);
    }
    seen.forEach((list) => list.length > 1 && list.forEach(([r, c]) => (bad[r][c] = true)));
  };
  for (let i = 0; i < n; i++) {
    mark([...Array(n)].map((_, j) => [i, j] as [number, number]));
    mark([...Array(n)].map((_, j) => [j, i] as [number, number]));
  }
  mark([...Array(n)].map((_, i) => [i, i] as [number, number]));
  mark([...Array(n)].map((_, i) => [i, n - 1 - i] as [number, number]));
  return bad;
}

/** 색동 마방진: 가로줄·세로줄·두 대각선에 같은 색이 겹치지 않게 칩을 놓는다. */
export default function ColorSquare() {
  // 레벨 1~5는 4×4, 레벨 6부터 5×5
  const stage = useStage();
  const first: 4 | 5 = stage >= 6 ? 5 : 4;
  const [n, setN] = useState<4 | 5>(first);
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makeColorSquare(first));
  const [grid, setGrid] = useState<number[][]>(() => puzzle.given.map((row, r) => row.map((g, c) => (g ? puzzle.solution[r][c] : 0))));
  // pick=0 이면 ‘누를 때마다 색이 바뀜’, 색 칩을 고르면 그 색으로 칠함
  const [pick, setPick] = useState(0);
  const [peek, setPeek] = useState(false);

  const start = (size: 4 | 5) => {
    const p = makeColorSquare(size);
    setN(size);
    setPuzzle(p);
    setGrid(p.given.map((row, r) => row.map((g, c) => (g ? p.solution[r][c] : 0))));
    setPick(0);
    setPeek(false);
  };

  const shown = peek ? puzzle.solution : grid;
  const bad = useMemo(() => conflicts(shown), [shown]);
  const filled = shown.flat().filter(Boolean).length;
  const anyBad = bad.flat().some(Boolean);
  const done = !peek && filled === n * n && !anyBad;
  const wasDone = useRef(false);
  const wasBad = useRef(false);
  useEffect(() => {
    if (done && !wasDone.current) cheer();
    wasDone.current = done;
  }, [done]);
  // 다 맞추면 2.5초 뒤 자동으로 새 문제
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => stageClear(), 2500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);
  useEffect(() => {
    if (anyBad && !wasBad.current) oops();
    wasBad.current = anyBad;
  }, [anyBad]);
  const counts = useMemo(() => {
    const m = Array<number>(n + 1).fill(0);
    shown.flat().forEach((v) => v && m[v]++);
    return m;
  }, [shown, n]);

  const S = 64;
  const onCell = (r: number, c: number) => {
    if (peek || puzzle.given[r][c]) return;
    tick();
    setGrid((g) => g.map((row, i) => row.map((v, j) => (i === r && j === c ? (pick === 0 ? (v + 1) % (n + 1) : v === pick ? 0 : pick) : v))));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-game rounded-full bg-accent-soft px-4 py-2 text-lg text-accent">
          레벨 {stage} · {n}×{n} 판 ({n}색)
        </span>
        <button type="button" onClick={() => start(n)} className="font-game min-h-[48px] rounded-2xl border-2 border-line bg-surface px-4 text-[1.05rem] shadow-[0_4px_0_0_rgba(0,0,0,0.08)] hover:bg-bg active:translate-y-[2px]">
          다른 문제
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <svg
          viewBox={`0 0 ${n * S + 8} ${n * S + 8}`}
          className="mx-auto block w-full shrink-0 sm:mx-0"
          style={{ maxWidth: n * S * 1.5 + 8 }}
          role="grid"
          aria-label={`${n}×${n} 색동 마방진 판`}
        >
          {/* 두 대각선 안내선 */}
          <defs>
            <radialGradient id="cs-shine" cx="35%" cy="30%" r="70%">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x={0} y={0} width={n * S + 8} height={n * S + 8} rx={16} fill="#f3cf9c" />
          <line x1={4} y1={4} x2={n * S + 4} y2={n * S + 4} stroke="#d4a373" strokeWidth="3" strokeDasharray="6 6" />
          <line x1={n * S + 4} y1={4} x2={4} y2={n * S + 4} stroke="#d4a373" strokeWidth="3" strokeDasharray="6 6" />
          {shown.map((row, r) =>
            row.map((v, c) => {
              const given = puzzle.given[r][c];
              const x = 4 + c * S;
              const y = 4 + r * S;
              return (
                <g key={`${r}-${c}`} onClick={() => onCell(r, c)} role="gridcell" style={{ cursor: given || peek ? "default" : "pointer" }}>
                  <rect x={x + 4} y={y + 4} width={S - 8} height={S - 8} rx={v ? (S - 8) / 2 : 12} style={{ fill: v ? CHIP[v] : "#fffaf0", stroke: bad[r][c] ? "#dc2626" : v ? `color-mix(in srgb, ${CHIP[v]} 60%, black)` : "#ecd2ab" }} strokeWidth={bad[r][c] ? 4.5 : v ? 3 : 1.5} fillOpacity={v ? 1 : 0.9} />
                  {v > 0 && <rect x={x + 4} y={y + 4} width={S - 8} height={S - 8} rx={(S - 8) / 2} fill="url(#cs-shine)" pointerEvents="none" />}
                  {v > 0 && (
                    <text x={x + S / 2} y={y + S / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={S * 0.42} fontWeight={800} fill="#fff" pointerEvents="none" style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" }}>
                      {v}
                    </text>
                  )}
                  {given && <circle cx={x + S - 12} cy={y + 12} r={7} fill="#fff" stroke="#b45309" strokeWidth="2" pointerEvents="none" />}
                  {given && <text x={x + S - 12} y={y + 15.5} textAnchor="middle" fontSize="10" pointerEvents="none">📌</text>}
                </g>
              );
            }),
          )}
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">👆 칸을 누를 때마다 색이 바뀌어요. 색 칩을 고르면 그 색으로 칠해요(칩을 한 번 더 누르면 해제).</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {[...Array(n)].map((_, i) => {
              const v = i + 1;
              return (
                <li key={v}>
                  <button
                    type="button"
                    onClick={() => setPick(pick === v ? 0 : v)}
                    disabled={peek}
                    aria-pressed={pick === v}
                    aria-label={`${v}번 칩, 지금 ${counts[v]}개 놓음`}
                    className={`font-game flex h-16 w-16 flex-col items-center justify-center rounded-full text-2xl text-white shadow-[0_4px_0_0_rgba(0,0,0,0.25)] transition active:translate-y-[2px] ${pick === v && !peek ? "scale-110 ring-4 ring-white outline-4 outline-accent" : ""} disabled:opacity-50`}
                    style={{ background: CHIP[v] }}
                  >
                    {v}
                    <span className="-mt-1 text-[10px] font-semibold opacity-90">{counts[v]}/{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-muted">
            📌 핀이 꽂힌 칩은 처음부터 놓인 칩이에요. 가로줄·세로줄·<strong className="text-ink">두 대각선</strong> 어디에도 같은 색이 겹치면 빨간 테두리가 떠요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setGrid(puzzle.given.map((row, r) => row.map((g, c) => (g ? puzzle.solution[r][c] : 0))));
                setPeek(false);
              }}
              className="font-game min-h-[48px] rounded-2xl border-2 border-line bg-surface px-4 text-[1.05rem] shadow-[0_4px_0_0_rgba(0,0,0,0.08)] hover:bg-bg active:translate-y-[2px]"
            >
              다시 시작
            </button>
            {peek ? (
              <button type="button" onClick={() => setPeek(false)} className="font-game min-h-[48px] rounded-2xl bg-accent px-4 text-[1.05rem] text-accent-ink shadow-[0_4px_0_0_rgba(0,0,0,0.2)] hover:brightness-110">
                내 풀이로 돌아가기
              </button>
            ) : (
              <button type="button" onClick={() => setPeek(true)} className="font-game min-h-[48px] rounded-2xl border-2 border-line bg-surface px-4 text-[1.05rem] shadow-[0_4px_0_0_rgba(0,0,0,0.08)] hover:bg-bg active:translate-y-[2px]">
                답 보기
              </button>
            )}
          </div>
          <p className="mt-3 text-sm" aria-live="polite">
            {peek ? (
              <span className="text-muted">이 문제의 답이에요. 처음 놓인 칩에서 시작하면 답은 하나뿐이에요.</span>
            ) : anyBad ? (
              <span className="font-semibold text-bad">겹친 색이 있어요. 빨간 테두리 칸을 살펴봐요.</span>
            ) : (
              <span className="text-muted">채운 칸 {filled} / {n * n}</span>
            )}
          </p>
          {done && (
            <p className="gz-pop mt-2 rounded-2xl border-2 border-ok/40 bg-ok-soft p-3 text-lg font-semibold text-ok" role="status">
              🎉 모든 줄과 두 대각선에 색이 하나씩! 완성했어요. 곧 다음 레벨로 넘어가요!
              <button type="button" onClick={() => stageClear()} className="font-game ml-3 min-h-[52px] rounded-full bg-accent px-6 text-xl text-accent-ink shadow-[0_5px_0_0_rgba(0,0,0,0.2)] hover:brightness-110">
                다음 레벨 →
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
