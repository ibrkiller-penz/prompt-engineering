import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, Slider, cheer, oops, svgPoint, tick, useFrame } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { DEFAULT_P, DURATION, I, LEVELS, R, S, V, build, count, idx, shuffled, starsFor, stepSim, type Level, type Sim } from "./epidemic.logic";

type Phase = "ready" | "run" | "pause" | "done";
type Msg = { t: string; tone: "info" | "ok" | "bad" };
const COLOR: Record<number, string> = { [S]: "#cbd5e1", [I]: "#ef4444", [R]: "#22c55e", [V]: "#3b82f6" };
const FACE: Record<number, string> = { [S]: "🙂", [I]: "🤒", [R]: "😄", [V]: "💉" };
const CELL = 40;

function newVillage(level: Level) {
  const { size, starts: n } = LEVELS[level];
  const starts: number[] = [];
  while (starts.length < n) {
    const i = idx(size, 1 + Math.floor(Math.random() * (size - 2)), 1 + Math.floor(Math.random() * (size - 2)));
    if (!starts.includes(i)) starts.push(i);
  }
  return { starts, order: shuffled(size * size, Math.random), manual: new Uint8Array(size * size) };
}
const mcount = (m: Uint8Array) => m.reduce((a, b) => a + b, 0);

export default function EpidemicGame() {
  const [level, setLevel] = useState<Level>("easy");
  const [pPct, setPPct] = useState(Math.round(DEFAULT_P * 100));
  const [ratioPct, setRatioPct] = useState(0);
  const [init] = useState(() => newVillage("easy"));
  const [starts, setStarts] = useState(init.starts);
  const [order, setOrder] = useState<number[]>(init.order);
  const [manual, setManual] = useState<Uint8Array>(init.manual);
  const [sim, setSim] = useState<Sim>(() => build(LEVELS.easy.size, init.starts, init.order, 0, init.manual));
  const [phase, setPhase] = useState<Phase>("ready");
  const [hist, setHist] = useState<number[]>(() => [init.starts.length]);
  const [wins, setWins] = useState(0);
  const [result, setResult] = useState<{ ratio: number; peak: number; stars: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: "빨간 얼굴이 아픈 친구예요. 둘레를 쓱쓱 문질러 백신을 놓아 막아요!", tone: "info" });
  const [cursor, setCursor] = useState(0);
  const acc = useRef(0);
  const painting = useRef<"add" | "erase" | null>(null);
  const live = useRef<{ cells: Uint8Array; manual: Uint8Array; age: Uint8Array }>({ cells: new Uint8Array(0), manual: new Uint8Array(0), age: new Uint8Array(0) });

  const { size, budget } = LEVELS[level];
  const total = size * size;
  const p = pPct / 100;
  const cells = sim.cells;
  live.current = { cells, manual, age: sim.age };
  const nI = count(cells, I);
  const ever = nI + count(cells, R);
  const mUsed = mcount(manual);
  const peak = Math.max(...hist);
  const won = !!result && result.stars > 0 && count(cells, V) <= budget;

  const finish = (c: Uint8Array, h: number[]) => {
    const ratio = (count(c, R) + count(c, I)) / total;
    const vac = count(c, V);
    const stars = vac > budget ? 0 : starsFor(ratio);
    setResult({ ratio, peak: Math.max(...h), stars });
    setPhase("done");
    const pct = (ratio * 100).toFixed(0);
    if (vac > budget) {
      oops();
      setMsg({ t: `끝! 아팠던 친구는 ${pct}%예요. 백신을 너무 많이 썼어요. ${budget}개 이하로 해 봐요.`, tone: "info" });
    } else if (stars > 0) {
      cheer();
      setWins((w) => w + 1);
      setLeft(3.5);
      setMsg({ t: `대단해요! 아픈 친구가 ${pct}%만 나왔어요. 별 ${stars}개!`, tone: "ok" });
    } else {
      oops();
      setMsg({ t: `괜찮아요! 아팠던 친구가 ${pct}%예요. 아픈 친구를 빙 둘러 막으면 돼요. 다시 해 봐요!`, tone: "bad" });
    }
  };

  const doStep = () => {
    const ns = stepSim(sim, size, p, DURATION, Math.random);
    const h = [...hist, count(ns.cells, I)];
    setSim(ns);
    setHist(h);
    if (h[h.length - 1] === 0 || h.length > 300) finish(ns.cells, h);
  };

  useFrame((_t, dt) => {
    acc.current += dt;
    if (acc.current >= 0.35) {
      acc.current = 0;
      doStep();
    }
  }, phase === "run");

  // 이겼을 때 자동으로 새 마을로
  useFrame((_t, dt) => {
    if (left <= 0) return;
    const nl = left - dt;
    if (nl <= 0) {
      setLeft(0);
      newVillage2(level);
    } else setLeft(nl);
  }, phase === "done" && won && left > 0);

  const setup = (lv: Level, v: { starts: number[]; order: number[]; manual: Uint8Array }, pct = ratioPct) => {
    setStarts(v.starts);
    setOrder(v.order);
    setManual(v.manual);
    setSim(build(LEVELS[lv].size, v.starts, v.order, pct / 100, v.manual));
    setHist([v.starts.length]);
    setPhase("ready");
    setResult(null);
    setLeft(0);
    acc.current = 0;
  };
  function newVillage2(lv: Level) {
    setup(lv, newVillage(lv));
    setMsg({ t: "새 마을이에요! 아픈 친구 둘레에 백신을 놓아요.", tone: "info" });
  }
  const again = () => {
    setup(level, { starts, order, manual });
    setMsg({ t: "같은 마을에서 다시 해요. 이번엔 어떻게 막을까요?", tone: "info" });
  };
  const changeLevel = (lv: Level) => {
    setLevel(lv);
    setup(lv, newVillage(lv));
    setMsg({ t: lv === "hard" ? "큰 마을이에요! 아픈 친구가 3명이에요. 백신은 24개!" : "작은 마을로 돌아왔어요.", tone: "info" });
  };

  const cellAt = (e: PointerEvent<SVGSVGElement>) => {
    const [x, y] = svgPoint(e.currentTarget, e.clientX, e.clientY);
    const c = Math.floor(x / CELL),
      r = Math.floor(y / CELL);
    return c < 0 || r < 0 || c >= size || r >= size ? -1 : idx(size, r, c);
  };

  const apply = (i: number, mode: "add" | "erase") => {
    if (i < 0 || phase === "done") return;
    const { cells: lc, manual: lm, age } = live.current;
    const m = new Uint8Array(lm);
    const c = new Uint8Array(lc);
    if (mode === "add") {
      if (c[i] !== S || m[i]) return;
      if (mcount(m) >= budget) {
        if (painting.current) painting.current = null;
        oops();
        setMsg({ t: "백신을 다 썼어요! 파란 칸을 다시 누르면 백신을 되찾아요.", tone: "bad" });
        return;
      }
      m[i] = 1;
      c[i] = V;
      tick();
    } else {
      if (!m[i]) return;
      m[i] = 0;
      c[i] = S;
      tick();
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
    if (painting.current) apply(cellAt(e), painting.current);
  };
  const onUp = () => {
    painting.current = null;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const r = Math.floor(cursor / size),
      c = cursor % size;
    const mv: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (mv[e.key]) {
      e.preventDefault();
      const [dr, dc] = mv[e.key];
      setCursor(idx(size, Math.max(0, Math.min(size - 1, r + dr)), Math.max(0, Math.min(size - 1, c + dc))));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      apply(cursor, manual[cursor] ? "erase" : "add");
    }
  };

  const go = () => {
    if (phase === "ready" || phase === "pause") {
      setPhase("run");
      acc.current = 0.35;
      setMsg({ t: "퍼지고 있어요! 막혔을까요?", tone: "info" });
    } else if (phase === "run") setPhase("pause");
  };

  const onRatio = (v: number) => {
    setRatioPct(v);
    setSim(build(size, starts, order, v / 100, manual));
    setHist([starts.length]);
  };

  // 손짓 안내: 처음 아픈 친구 바로 아래(또는 위)
  const hs = starts[0];
  const hr = Math.floor(hs / size),
    hc = hs % size;
  const hintY = (hr + 1 < size ? hr + 1 : hr - 1) * CELL + CELL * 0.75;
  const showHint = phase === "ready" && mUsed === 0;

  const W = 320,
    H = 100,
    xMax = Math.max(24, hist.length - 1),
    yMax = Math.max(5, Math.ceil(peak / 5) * 5);
  const pts = hist.map((v, i) => `${(30 + (i / xMax) * (W - 40)).toFixed(1)},${(H - 18 - (v / yMax) * (H - 30)).toFixed(1)}`).join(" ");

  return (
    <div className="space-y-3">
      <Board className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-card bg-accent-soft px-4 py-2 text-center">
            <div className="text-sm font-bold">💉 남은 백신</div>
            <div className="text-4xl font-extrabold tabular-nums" aria-live="polite">{Math.max(0, budget - mUsed)}</div>
          </div>
          <div className="flex-1 text-base font-bold leading-snug">🎯 아픈 친구를 <span className="text-bad">20%보다 적게</span> 막아요!</div>
        </div>
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <div className="mx-auto w-full max-w-[440px]">
          <svg
            viewBox={`0 0 ${size * CELL} ${size * CELL}`}
            className="w-full touch-none select-none rounded-card bg-bg"
            style={{ touchAction: "none" }}
            role="application"
            aria-label={`${size} 곱하기 ${size} 친구들 마을. 칸을 누르거나 쓸어서 백신을 놓아요. 화살표 키와 스페이스로도 할 수 있어요`}
            tabIndex={0}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey}
          >
            {Array.from(cells, (s, i) => {
              const r = Math.floor(i / size),
                c = i % size;
              return (
                <g key={i}>
                  <rect x={c * CELL + 2} y={r * CELL + 2} width={CELL - 4} height={CELL - 4} rx={8} fill={COLOR[s]} stroke={manual[i] ? "#1e3a8a" : "none"} strokeWidth={3} />
                  <text x={c * CELL + CELL / 2} y={r * CELL + CELL / 2 + 8} textAnchor="middle" fontSize={22} pointerEvents="none">{FACE[s]}</text>
                </g>
              );
            })}
            <rect x={(cursor % size) * CELL + 2} y={Math.floor(cursor / size) * CELL + 2} width={CELL - 4} height={CELL - 4} rx={8} fill="none" stroke="var(--ink)" strokeWidth={2} pointerEvents="none" />
            {showHint && (
              <text x={hc * CELL + CELL / 2} y={hintY} textAnchor="middle" fontSize={34} pointerEvents="none">
                👆
                <animate attributeName="y" values={`${hintY};${hintY - 12};${hintY}`} dur="0.9s" repeatCount="indefinite" />
              </text>
            )}
          </svg>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm" aria-label="색 설명">
          {[[S, "건강한 친구"], [I, "아픈 친구(빨강)"], [R, "다 나은 친구(초록)"], [V, "백신 맞은 친구(파랑)"]].map(([k, l]) => (
            <li key={k as number} className="flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded" style={{ background: COLOR[k as number] }} />{l}</li>
          ))}
        </ul>
        {phase !== "done" ? (
          <div className="flex gap-2">
            <GButton variant="primary" className="min-h-[60px]! flex-1 text-2xl" onClick={go}>{phase === "run" ? "⏸ 멈춤" : phase === "pause" ? "▶ 계속" : "🦠 퍼져라!"}</GButton>
            <GButton className={`${BIG} min-h-[60px]!`} onClick={again}>다시 하기</GButton>
          </div>
        ) : (
          result && (
            <div className="space-y-2 rounded-card bg-bg p-4 text-center">
              <p className="text-3xl"><Stars n={result.stars} /></p>
              <p className="text-base">아팠던 친구는 <strong>{(result.ratio * 100).toFixed(0)}%</strong> · 가장 많이 아팠을 때 <strong>{result.peak}명</strong></p>
              <div className="flex flex-wrap justify-center gap-2">
                <GButton variant="primary" className={BIG} onClick={() => newVillage2(level)}>{won && left > 0 ? `새 마을 ▶ (${Math.ceil(left)})` : "새 마을 ▶"}</GButton>
                <GButton className={BIG} onClick={again}>이 마을 다시</GButton>
              </div>
            </div>
          )
        )}
        <div className="flex flex-wrap gap-2">
          <Pill label="아픈 친구" value={`${nI}명`} tone={nI ? "bad" : "plain"} />
          <Pill label="아팠던 친구" value={`${((ever / total) * 100).toFixed(0)}%`} />
          <Pill label="성공" value={`${wins}번`} tone={wins ? "ok" : "plain"} />
        </div>
      </Board>

      <Board>
        <p className="mb-1 text-base font-bold">아픈 친구는 몇 명이었을까요?</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`아픈 친구 수 그래프. 지금 ${nI}명, 가장 많았을 때 ${peak}명`}>
          <line x1={30} y1={H - 18} x2={W - 10} y2={H - 18} stroke="var(--line)" />
          <line x1={30} y1={8} x2={30} y2={H - 18} stroke="var(--line)" />
          <text x={26} y={16} textAnchor="end" fontSize={11} fill="var(--muted)">{yMax}명</text>
          <text x={26} y={H - 16} textAnchor="end" fontSize={11} fill="var(--muted)">0</text>
          <text x={W - 10} y={H - 4} textAnchor="end" fontSize={11} fill="var(--muted)">시간 →</text>
          <polyline points={pts} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" />
        </svg>
      </Board>

      <details className="rounded-card border border-line bg-surface p-3">
        <summary className="flex min-h-[48px] cursor-pointer items-center text-base font-bold">🏆 더 어려운 도전</summary>
        <div className="mt-2 space-y-2 text-base">
          <div className="flex flex-wrap gap-2">
            <GButton className={BIG} pressed={level === "easy"} onClick={() => changeLevel("easy")}>작은 마을</GButton>
            <GButton className={BIG} pressed={level === "hard"} onClick={() => changeLevel("hard")}>큰 마을 (아픈 친구 3명)</GButton>
          </div>
          <Slider label="친구들이 얼마나 가까이 지내요?" value={pPct} min={3} max={30} onChange={setPPct} show={(v) => (v < 10 ? "조금" : v < 20 ? "보통" : "많이")} />
          <Slider label="처음부터 백신 맞은 친구" value={ratioPct} min={0} max={80} step={5} onChange={onRatio} show={(v) => `${Math.round((v * total) / 100)}명`} />
          <p className="text-sm text-muted">‘처음부터 백신 맞은 친구’는 퍼져라! 전에만 바꿀 수 있어요{phase === "ready" ? "" : " (다시 하기를 누르세요)"}. 백신이 {budget}개를 넘으면 별을 받을 수 없어요.</p>
          <GButton className={BIG} onClick={doStep} disabled={phase === "run" || phase === "done"}>한 단계씩 보기</GButton>
        </div>
      </details>
    </div>
  );
}
