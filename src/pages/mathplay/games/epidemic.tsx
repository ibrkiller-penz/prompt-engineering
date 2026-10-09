import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, Slider, svgPoint, useFrame } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { BUDGET, DEFAULT_P, DURATION, I, R, S, SIZE, V, build, count, idx, shuffled, stepSim, type Sim } from "./epidemic.logic";

type Phase = "ready" | "run" | "pause" | "done";
type Msg = { t: string; tone: "info" | "ok" | "bad" };
const COLOR = { [S]: "#cbd5e1", [I]: "#ef4444", [R]: "#22c55e", [V]: "#3b82f6" } as Record<number, string>;
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
  const [nStart, setNStart] = useState(1);
  const [init] = useState(() => {
    const starts = pickStarts(1);
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
  const [result, setResult] = useState<{ ratio: number; peak: number; stars: number } | null>(null);
  const [msg, setMsg] = useState<Msg>({ t: "빨간 칸은 아픈 친구예요. 칸을 눌러서 파란 백신을 놓아, 아픈 친구 둘레를 빙 둘러 막아 보세요. 다 놓았으면 ‘시작’을 눌러요!", tone: "info" });
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
  const ever = nI + nR;
  const mUsed = mcount(manual);
  const peak = Math.max(...hist);

  const finish = (c: Uint8Array, h: number[]) => {
    const e = count(c, R) + count(c, I);
    const ratio = e / TOTAL;
    const pk = Math.max(...h);
    const vac = count(c, V);
    const stars = vac > BUDGET ? 0 : ratio < 0.05 ? 3 : ratio < 0.1 ? 2 : ratio < 0.2 ? 1 : 0;
    setResult({ ratio, peak: pk, stars });
    setPhase("done");
    const pct = (ratio * 100).toFixed(0);
    if (vac > BUDGET) setMsg({ t: `끝났어요! 아팠던 친구는 ${pct}%예요. 백신을 ${vac}개나 썼어요. ${BUDGET}개 이하로 다시 해 봐요.`, tone: "info" });
    else if (stars > 0) {
      setWins((w) => w + 1);
      setMsg({ t: `와, 대단해요! 백신 ${vac}개로 아픈 친구를 ${pct}%만 나오게 막았어요. 별 ${stars}개!`, tone: "ok" });
    } else setMsg({ t: `괜찮아요! 아팠던 친구가 ${pct}%예요. 아픈 친구 둘레를 빈틈없이 둘러싸면 더 잘 막을 수 있어요. 다시 해 봐요!`, tone: "bad" });
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
        setMsg({ t: `백신 ${BUDGET}개를 다 썼어요. 파란 칸을 다시 누르면 백신을 되찾아요.`, tone: "bad" });
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
      if (phase === "ready") setMsg({ t: "병이 퍼지고 있어요! 멈춤을 누르고 백신을 더 놓을 수도 있어요.", tone: "info" });
    } else if (phase === "run") setPhase("pause");
  };

  const reset = () => {
    toReady();
    setMsg({ t: "같은 자리에서 다시 해요. 이번엔 백신 놓는 자리를 바꿔 봐요!", tone: "info" });
  };
  const newProblem = () => {
    const st = pickStarts(nStart);
    const f = fresh();
    setStarts(st);
    setOrder(f.order);
    setManual(f.manual);
    toReady(st, f.order, f.manual);
    setMsg({ t: "새 문제예요. 아픈 친구의 자리가 바뀌었어요.", tone: "info" });
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
        <p className="text-base font-bold">🎯 목표: 백신 {BUDGET}개로 아픈 친구를 20%보다 적게 만들어요!</p>
        <div className="flex flex-wrap gap-2">
          <Pill label="남은 백신" value={Math.max(0, BUDGET - mUsed)} />
          <Pill label="아픈 친구" value={`${nI}명`} tone={nI ? "bad" : "plain"} />
          <Pill label="아팠던 친구" value={`${((ever / TOTAL) * 100).toFixed(0)}%`} />
          <Pill label="성공" value={`${wins}번`} tone={wins ? "ok" : "plain"} />
        </div>
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <div className="mx-auto w-full max-w-[480px]">
          <svg
            ref={svgRef}
            viewBox="0 0 400 400"
            className="w-full touch-none select-none rounded-card bg-bg"
            role="application"
            aria-label="20 곱하기 20 친구들 판. 칸을 누르면 백신을 놓고, 화살표 키와 스페이스로도 할 수 있어요"
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
              return <rect key={i} x={c * 20 + 1} y={r * 20 + 1} width={18} height={18} rx={4} fill={COLOR[s]} stroke={manual[i] ? "#1e3a8a" : "none"} strokeWidth={3} />;
            })}
            <rect x={(cursor % SIZE) * 20 + 1} y={Math.floor(cursor / SIZE) * 20 + 1} width={18} height={18} rx={4} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />
          </svg>
        </div>
        <p className="text-center text-sm text-muted">칸을 누르거나, 손가락·마우스로 쓱 끌어서 백신을 놓아요. 파란 칸을 다시 누르면 취소돼요.</p>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-base" aria-label="색 설명">
          {[[S, "건강한 친구"], [I, "아픈 친구(빨강)"], [R, "다 나은 친구(초록)"], [V, "백신 맞은 친구(파랑)"]].map(([k, l]) => (
            <li key={k as number} className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded" style={{ background: COLOR[k as number] }} />{l}</li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <GButton variant="primary" className={BIG} onClick={startPause} disabled={phase === "done"}>{phase === "run" ? "⏸ 멈춤" : phase === "pause" ? "▶ 계속" : "▶ 시작"}</GButton>
          <GButton className={BIG} onClick={reset}>다시 하기</GButton>
          <GButton className={BIG} onClick={newProblem}>새 문제</GButton>
        </div>
        {result && (
          <div className="rounded-card bg-bg p-4 text-base">
            <p className="font-bold">결과 <Stars n={result.stars} /></p>
            <p className="mt-1">아팠던 친구는 <strong>{(result.ratio * 100).toFixed(0)}%</strong>였어요. 한꺼번에 가장 많이 아팠을 때는 <strong>{result.peak}명</strong>이었어요.</p>
          </div>
        )}
      </Board>

      <Board>
        <p className="mb-1 text-base font-bold">아픈 친구가 몇 명이었을까요?</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`아픈 친구 수 그래프. 지금 ${nI}명, 가장 많았을 때 ${peak}명`}>
          <line x1={30} y1={H - 20} x2={W - 10} y2={H - 20} stroke="var(--line)" />
          <line x1={30} y1={10} x2={30} y2={H - 20} stroke="var(--line)" />
          <text x={26} y={18} textAnchor="end" fontSize={11} fill="var(--muted)">{yMax}명</text>
          <text x={26} y={H - 18} textAnchor="end" fontSize={11} fill="var(--muted)">0</text>
          <text x={W - 10} y={H - 6} textAnchor="end" fontSize={11} fill="var(--muted)">시간 →</text>
          <polyline points={pts} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" />
        </svg>
      </Board>

      <details className="rounded-card border border-line bg-surface p-3">
        <summary className="flex min-h-[48px] cursor-pointer items-center text-base font-bold">⚙ 더 해 보기 (어려운 설정)</summary>
        <div className="mt-2 space-y-1 text-base">
          <Slider label="친구들이 얼마나 가까이 지내요?" value={pPct} min={3} max={30} onChange={setPPct} show={(v) => (v < 8 ? "조금" : v < 18 ? "보통" : "많이")} />
          <Slider label="처음부터 백신 맞은 친구" value={ratioPct} min={0} max={80} step={5} onChange={onRatio} show={(v) => `${Math.round(v * 4)}명`} />
          <Slider label="처음 아픈 친구" value={nStart} min={1} max={3} onChange={onStartN} show={(v) => `${v}명`} />
          <p className="text-sm text-muted">‘처음부터 백신 맞은 친구’와 ‘처음 아픈 친구’는 시작 전에만 바꿀 수 있어요{ready ? "" : " (다시 하기를 누르세요)"}. 백신이 {BUDGET}개를 넘으면 별을 받을 수 없어요.</p>
          <GButton className={BIG} onClick={doStep} disabled={phase === "run" || phase === "done"}>한 단계씩 보기</GButton>
        </div>
      </details>
    </div>
  );
}
