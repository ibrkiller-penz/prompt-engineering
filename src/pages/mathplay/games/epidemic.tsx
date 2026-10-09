import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, Say, Slider, Stat, svgPoint, useFrame } from "./kit";
import { BUDGET, DEFAULT_P, DURATION, I, R, S, SIZE, V, build, count, idx, shuffled, stepSim, type Sim } from "./epidemic.logic";

type Phase = "ready" | "run" | "pause" | "done";
type Msg = { t: string; tone: "info" | "ok" | "bad" };
const COLOR = { [S]: "#cbd5e1", [I]: "#ef4444", [R]: "#3b82f6", [V]: "#22c55e" } as Record<number, string>;
const TOTAL = SIZE * SIZE;

function pickStarts(n: number): number[] {
  const s: number[] = [];
  while (s.length < n) {
    const i = idx(2 + Math.floor(Math.random() * (SIZE - 4)), 2 + Math.floor(Math.random() * (SIZE - 4)));
    if (!s.includes(i)) s.push(i);
  }
  return s;
}
const fresh = () => ({ order: shuffled(TOTAL, Math.random), manual: new Uint8Array(TOTAL) });
const mcount = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

export default function EpidemicGame() {
  const [pPct, setPPct] = useState(Math.round(DEFAULT_P * 100));
  const [ratioPct, setRatioPct] = useState(0);
  const [nStart, setNStart] = useState(2);
  const [init] = useState(() => {
    const starts = pickStarts(2);
    const f = fresh();
    return { starts, ...f };
  });
  const [starts, setStarts] = useState(init.starts);
  const [order, setOrder] = useState(init.order);
  const [manual, setManual] = useState(init.manual);
  const [sim, setSim] = useState<Sim>(() => build(init.starts, init.order, 0, init.manual));
  const [phase, setPhase] = useState<Phase>("ready");
  const [hist, setHist] = useState<number[]>(() => [init.starts.length]);
  const [wins, setWins] = useState(0);
  const [plays, setPlays] = useState(0);
  const [result, setResult] = useState<{ ratio: number; peak: number } | null>(null);
  const [msg, setMsg] = useState<Msg>({ t: "빨간 칸이 처음 감염자예요. 칸을 눌러(끌어서) 접종하고 ‘시작’을 눌러요. 퀘스트: 접종 60명 이하로 감염 비율 20% 미만!", tone: "info" });
  const [cursor, setCursor] = useState(0);
  const acc = useRef(0);
  const painting = useRef<"add" | "erase" | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef<{ cells: Uint8Array; manual: Uint8Array; age: Uint8Array }>({ cells: new Uint8Array(0), manual: new Uint8Array(0), age: new Uint8Array(0) });

  const p = pPct / 100;
  const cells = sim.cells;
  live.current = { cells, manual, age: sim.age };
  const nI = count(cells, I);
  const nR = count(cells, R);
  const nV = count(cells, V);
  const ever = nI + nR;
  const mUsed = mcount(manual);
  const peak = Math.max(...hist);

  const finish = (c: Uint8Array, h: number[]) => {
    const e = count(c, R) + count(c, I);
    const ratio = e / TOTAL;
    const pk = Math.max(...h);
    const vac = count(c, V);
    setResult({ ratio, peak: pk });
    setPhase("done");
    setPlays((x) => x + 1);
    if (vac > BUDGET) setMsg({ t: `끝! 최종 감염 비율 ${(ratio * 100).toFixed(0)}%. 접종이 ${vac}명이라 퀘스트 예산(${BUDGET}명)을 넘었어요. 예산 안에서 다시 도전해요.`, tone: "info" });
    else if (ratio < 0.2) {
      setWins((w) => w + 1);
      setMsg({ t: `성공! 접종 ${vac}명으로 감염 비율을 ${(ratio * 100).toFixed(0)}%까지 막았어요.`, tone: "ok" });
    } else setMsg({ t: `아쉬워요. 감염 비율이 ${(ratio * 100).toFixed(0)}% 예요(목표 20% 미만). 감염자 주변을 빈틈없이 둘러싸 보면 어떨까요?`, tone: "bad" });
  };

  const doStep = () => {
    const ns = stepSim(sim, p, DURATION, Math.random);
    const h = [...hist, count(ns.cells, I)];
    setSim(ns);
    setHist(h);
    if (h[h.length - 1] === 0 || h.length > 300) finish(ns.cells, h);
  };

  useFrame((_t, dt) => {
    acc.current += dt;
    if (acc.current >= 0.3) {
      acc.current = 0;
      doStep();
    }
  }, phase === "run");

  const rebuild = (st: number[], ord: number[], pct: number, man: Uint8Array) => {
    setSim(build(st, ord, pct / 100, man));
    setHist([st.length]);
  };

  const toReady = (st = starts, ord = order, man = manual, pct = ratioPct) => {
    rebuild(st, ord, pct, man);
    setPhase("ready");
    setResult(null);
    acc.current = 0;
  };

  const cellAt = (e: PointerEvent<SVGSVGElement>) => {
    const [x, y] = svgPoint(e.currentTarget, e.clientX, e.clientY);
    const c = Math.floor(x / 20),
      r = Math.floor(y / 20);
    return c < 0 || r < 0 || c >= SIZE || r >= SIZE ? -1 : idx(r, c);
  };

  const apply = (i: number, mode: "add" | "erase") => {
    if (i < 0 || phase === "done") return;
    const { cells: lc, manual: lm, age } = live.current;
    const m = new Uint8Array(lm);
    const c = new Uint8Array(lc);
    if (mode === "add") {
      if (c[i] !== S || m[i]) return;
      if (mcount(m) >= BUDGET) {
        setMsg({ t: `접종 예산 ${BUDGET}명을 다 썼어요. 눌러서 되돌리면 다시 쓸 수 있어요.`, tone: "bad" });
        return;
      }
      m[i] = 1;
      c[i] = V;
    } else {
      if (!m[i]) return;
      m[i] = 0;
      c[i] = S;
    }
    live.current = { cells: c, manual: m, age };
    setManual(m);
    setSim({ cells: c, age });
  };

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    const i = cellAt(e);
    if (i < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    painting.current = manual[i] ? "erase" : "add";
    setCursor(i);
    apply(i, painting.current);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!painting.current) return;
    apply(cellAt(e), painting.current);
  };
  const onUp = () => {
    painting.current = null;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const r = Math.floor(cursor / SIZE),
      c = cursor % SIZE;
    const mv: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (mv[e.key]) {
      e.preventDefault();
      const [dr, dc] = mv[e.key];
      setCursor(idx(Math.max(0, Math.min(SIZE - 1, r + dr)), Math.max(0, Math.min(SIZE - 1, c + dc))));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      apply(cursor, manual[cursor] ? "erase" : "add");
    }
  };

  const startPause = () => {
    if (phase === "ready" || phase === "pause") {
      setPhase("run");
      acc.current = 0.3;
      if (phase === "ready") setMsg({ t: "퍼지는 중이에요! 일시정지하고 칸을 눌러 접종할 수도 있어요.", tone: "info" });
    } else if (phase === "run") setPhase("pause");
  };

  const reset = () => {
    toReady();
    setMsg({ t: "같은 자리에서 처음부터 다시 해요. 접종 위치를 바꿔 보세요.", tone: "info" });
  };
  const newProblem = () => {
    const st = pickStarts(nStart);
    const f = fresh();
    setStarts(st);
    setOrder(f.order);
    setManual(f.manual);
    toReady(st, f.order, f.manual);
    setMsg({ t: "새 문제예요. 감염자의 자리가 바뀌었어요.", tone: "info" });
  };

  const onRatio = (v: number) => {
    setRatioPct(v);
    rebuild(starts, order, v, manual);
  };
  const onStartN = (v: number) => {
    setNStart(v);
    const st = pickStarts(v);
    setStarts(st);
    rebuild(st, order, ratioPct, manual);
  };

  const ready = phase === "ready";
  const W = 320,
    H = 120,
    xMax = Math.max(24, hist.length - 1),
    yMax = Math.max(10, Math.ceil(peak / 10) * 10);
  const pts = hist.map((v, i) => `${(30 + (i / xMax) * (W - 40)).toFixed(1)},${(H - 20 - (v / yMax) * (H - 35)).toFixed(1)}`).join(" ");

  return (
    <div className="space-y-3">
      <Board className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Stat label="단계" value={hist.length - 1} />
          <Stat label="감염 중" value={nI} tone={nI ? "bad" : "plain"} />
          <Stat label="지금까지 감염" value={`${ever} (${((ever / TOTAL) * 100).toFixed(0)}%)`} />
          <Stat label="직접 접종" value={`${mUsed}/${BUDGET}`} />
          <Stat label="전체 접종" value={nV} tone={nV > BUDGET ? "bad" : "plain"} />
          <Stat label="성공" value={`${wins}/${plays}`} tone={wins ? "ok" : "plain"} />
        </div>
        <div className="mx-auto w-full max-w-[460px]">
          <svg
            ref={svgRef}
            viewBox="0 0 400 400"
            className="w-full touch-none select-none rounded-card bg-bg"
            role="application"
            aria-label="20 곱하기 20 사람 격자. 칸을 누르면 접종하고, 화살표 키와 스페이스로도 할 수 있어요"
            tabIndex={0}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          >
            {Array.from(cells, (s, i) => {
              const r = Math.floor(i / SIZE),
                c = i % SIZE;
              return <rect key={i} x={c * 20 + 1} y={r * 20 + 1} width={18} height={18} rx={4} fill={COLOR[s]} stroke={manual[i] ? "#14532d" : "none"} strokeWidth={3} />;
            })}
            <rect x={(cursor % SIZE) * 20 + 1} y={Math.floor(cursor / SIZE) * 20 + 1} width={18} height={18} rx={4} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />
          </svg>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs" aria-label="색 설명">
          {[[S, "건강"], [I, "감염"], [R, "회복(면역)"], [V, "접종(면역)"]].map(([k, l]) => (
            <li key={k as number} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded" style={{ background: COLOR[k as number] }} />{l}</li>
          ))}
          <li className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border-2 border-[#14532d]" />내가 접종</li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <GButton variant="primary" onClick={startPause} disabled={phase === "done"}>{phase === "run" ? "⏸ 일시정지" : phase === "pause" ? "▶ 계속" : "▶ 시작"}</GButton>
          <GButton onClick={doStep} disabled={phase === "run" || phase === "done"}>한 단계</GButton>
          <GButton onClick={reset}>처음부터</GButton>
          <GButton onClick={newProblem}>새 문제</GButton>
        </div>
        <Say tone={msg.tone}>{msg.t}</Say>
        {result && (
          <p className="rounded-card bg-bg p-3 text-sm">
            <strong>결과</strong> · 최종 감염 비율 <strong>{(result.ratio * 100).toFixed(1)}%</strong> · 최대 동시 감염자 <strong>{result.peak}명</strong>
          </p>
        )}
      </Board>

      <Board className="space-y-1">
        <Slider label="만나는 정도" value={pPct} min={3} max={30} onChange={setPPct} show={(v) => `${v}%`} />
        <Slider label="무작위 접종" value={ratioPct} min={0} max={80} step={5} onChange={onRatio} show={(v) => `${v}% (${Math.round(v * 4)}명)`} />
        <Slider label="처음 감염자" value={nStart} min={1} max={3} onChange={onStartN} show={(v) => `${v}명`} />
        <p className="text-xs text-muted">무작위 접종과 처음 감염자는 ‘시작’ 전에만 바꿀 수 있어요{ready ? "" : " (처음부터를 누르세요)"}. 만나는 정도는 이웃 감염자 한 명이 한 단계에 옮길 확률이에요.</p>
      </Board>

      <Board>
        <p className="mb-1 text-sm font-bold">시간별 감염자 수</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`시간별 감염자 수 그래프. 지금 ${nI}명, 최대 ${peak}명`}>
          <line x1={30} y1={H - 20} x2={W - 10} y2={H - 20} stroke="var(--line)" />
          <line x1={30} y1={10} x2={30} y2={H - 20} stroke="var(--line)" />
          <text x={26} y={16} textAnchor="end" fontSize={9} fill="var(--muted)">{yMax}</text>
          <text x={26} y={H - 18} textAnchor="end" fontSize={9} fill="var(--muted)">0</text>
          <text x={W - 10} y={H - 6} textAnchor="end" fontSize={9} fill="var(--muted)">단계 {xMax}</text>
          <polyline points={pts} fill="none" stroke="#ef4444" strokeWidth={2} strokeLinejoin="round" />
        </svg>
      </Board>
    </div>
  );
}
