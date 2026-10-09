import { useEffect, useMemo, useRef, useState } from "react";
import RichMath, { MathLine } from "../RichMath";
import { FUNCTIONS, classify, findMinima, stepOnce } from "./Gradient.logic";
import type { Fn, Status } from "./Gradient.logic";

const ETAS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.1, 1.2];
const MAX_STEPS = 50;
const VW = 400, VH = 260, ML = 36, MR = 12, MT = 12, MB = 28;

const fmt = (x: number, d = 3) => {
  if (!Number.isFinite(x)) return "∞";
  if (Math.abs(x) >= 1e5) return x.toExponential(2);
  return (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);
};
const paren = (x: number) => (x < 0 ? `(${fmt(x)})` : fmt(x));

interface Run { ws: number[]; etas: number[] }

const MESSAGES: Record<Status, { cls: string; text: string } | null> = {
  start: null,
  moving: null,
  converged: { cls: "bg-ok-soft text-ok", text: "수렴했어요! 기울기가 거의 0이라 더 움직여도 제자리예요. 골짜기 맨 아래(최솟값)에 도착했어요." },
  local: { cls: "bg-accent-soft text-ink", text: "멈췄지만 가장 깊은 골짜기는 아니에요. 지역 최솟값에 갇혔어요. 시작점을 바꿔 다른 골짜기로 내려가 보세요." },
  oscillating: { cls: "bg-bad-soft text-bad", text: "좌우로 왔다 갔다 하며 내려가지 못하고 있어요. 한 걸음이 너무 커서 골짜기를 건너뛰는 거예요. η를 줄여 보세요." },
  diverged: { cls: "bg-bad-soft text-bad", text: "발산해요! 걸음이 너무 커서 갈수록 f(w)가 커지고 있어요. η를 작게 줄이고 처음으로 돌아가 다시 해 보세요." },
};

export default function Gradient() {
  const [fnId, setFnId] = useState(FUNCTIONS[0].id);
  const fn: Fn = FUNCTIONS.find((x) => x.id === fnId)!;
  const [start, setStart] = useState(FUNCTIONS[0].defaultStart);
  const [etaIdx, setEtaIdx] = useState(3);
  const [run, setRun] = useState<Run>({ ws: [FUNCTIONS[0].defaultStart], etas: [] });
  const [nSteps, setNSteps] = useState(20);
  const [playing, setPlaying] = useState(false);
  const eta = ETAS[etaIdx];
  const svgRef = useRef<SVGSVGElement>(null);

  const reset = (s: number) => { setStart(s); setRun({ ws: [s], etas: [] }); setPlaying(false); };
  const pickFn = (id: string) => {
    const f = FUNCTIONS.find((x) => x.id === id)!;
    setFnId(id); reset(f.defaultStart);
  };

  const doStep = (r: Run, e: number): Run => {
    if (r.etas.length >= MAX_STEPS) return r;
    const w = r.ws[r.ws.length - 1];
    return { ws: [...r.ws, stepOnce(fn, w, e).wNew], etas: [...r.etas, e] };
  };

  const status = classify(fn, run.ws);
  const steps = run.etas.length;
  const terminal = status === "converged" || status === "local" || status === "diverged";

  const etaRef = useRef(eta);
  etaRef.current = eta;
  useEffect(() => {
    if (!playing) return;
    if (steps >= Math.min(nSteps, MAX_STEPS) || terminal) { setPlaying(false); return; }
    const id = setTimeout(() => setRun((r) => doStep(r, etaRef.current)), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, run, nSteps, fnId]);

  // 그래프 좌표
  const { ymax, minima } = useMemo(() => {
    let m = 0;
    for (let i = 0; i <= 200; i++) m = Math.max(m, fn.f(fn.lo + ((fn.hi - fn.lo) * i) / 200));
    return { ymax: m * 1.05, minima: findMinima(fn) };
  }, [fn]);
  const pw = VW - ML - MR, ph = VH - MT - MB;
  const X = (w: number) => ML + ((Math.min(fn.hi, Math.max(fn.lo, w)) - fn.lo) / (fn.hi - fn.lo)) * pw;
  const Y = (v: number) => MT + ph - (Math.min(ymax, Math.max(0, v)) / ymax) * ph;
  const curve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 160; i++) { const w = fn.lo + ((fn.hi - fn.lo) * i) / 160; pts.push(`${X(w).toFixed(1)},${Y(fn.f(w)).toFixed(1)}`); }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, ymax]);

  const onClickChart = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * VW;
    const w = fn.lo + ((vx - ML) / pw) * (fn.hi - fn.lo);
    reset(Math.round(Math.min(fn.hi, Math.max(fn.lo, w)) * 20) / 20);
  };

  const cur = run.ws[run.ws.length - 1];
  const slope = fn.df(cur);
  const preview = stepOnce(fn, cur, eta);
  const off = cur < fn.lo || cur > fn.hi;
  const msg = MESSAGES[status];
  const startFalls = fn.id === "quartic";

  const btn = "min-h-11 rounded-card px-4 text-sm font-bold";
  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="경사하강법 체험 도구">
      <h3 className="text-base font-bold text-ink">체험 도구 · 경사하강법으로 내려가기</h3>
      <p className="mt-1 text-sm text-muted">곡선을 눌러 시작점을 고르고 '한 걸음'을 눌러 보세요. 기울기를 보고 내리막 쪽으로 η만큼씩 움직여요.</p>

      <label className="mt-3 block text-sm text-ink">손실 곡선 고르기
        <select value={fnId} onChange={(e) => pickFn(e.target.value)} className="mt-1 block min-h-11 w-full rounded-card border border-line bg-bg px-3 text-ink" aria-label="손실 곡선 고르기">
          {FUNCTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>

      <svg ref={svgRef} viewBox={`0 0 ${VW} ${VH}`} className="mt-3 w-full select-none rounded-card bg-bg text-ink" role="img"
        aria-label={`손실 곡선과 경사하강법 경로. 현재 w=${fmt(cur)}`} onPointerDown={onClickChart} style={{ cursor: "pointer" }}>
        <line x1={ML} y1={MT + ph} x2={ML + pw} y2={MT + ph} stroke="currentColor" opacity="0.4" />
        <line x1={ML} y1={MT} x2={ML} y2={MT + ph} stroke="currentColor" opacity="0.4" />
        {Array.from({ length: Math.floor(fn.hi) - Math.ceil(fn.lo) + 1 }, (_, i) => Math.ceil(fn.lo) + i).map((w) => (
          <g key={w} fontSize="10" fill="currentColor" opacity="0.7">
            <line x1={X(w)} y1={MT + ph} x2={X(w)} y2={MT + ph + 4} stroke="currentColor" />
            <text x={X(w)} y={MT + ph + 16} textAnchor="middle">{w}</text>
          </g>
        ))}
        <text x={ML + pw} y={VH - 2} textAnchor="end" fontSize="11" fill="currentColor">w</text>
        <text x={4} y={MT + 8} fontSize="11" fill="currentColor">f(w)</text>
        <polyline points={curve} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.75" />

        {minima.map((m, i) => (
          <g key={i} fontSize="10" fill="currentColor">
            <line x1={X(m.w)} y1={Y(m.f)} x2={X(m.w)} y2={MT + ph} stroke="currentColor" strokeDasharray="3 3" opacity="0.5" />
            <text x={X(m.w)} y={Y(m.f) + 14} textAnchor="middle" fontWeight="bold">{minima.length > 1 ? (m.isGlobal ? "전역 최솟값" : "지역 최솟값") : "최솟값"}</text>
          </g>
        ))}

        {run.ws.length > 1 && (
          <polyline points={run.ws.map((w) => `${X(w).toFixed(1)},${Y(fn.f(w)).toFixed(1)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="4 3" />
        )}
        {run.ws.map((w, i) => (
          <circle key={i} cx={X(w)} cy={Y(fn.f(w))} r={i === run.ws.length - 1 ? 7 : 4} fill="var(--accent)" opacity={i === run.ws.length - 1 ? 1 : 0.55} stroke="var(--surface, #fff)" strokeWidth="1.5" />
        ))}
        <text x={X(run.ws[0])} y={Y(fn.f(run.ws[0])) - 10} textAnchor="middle" fontSize="10" fill="currentColor">시작</text>
      </svg>
      {off && <p className="text-xs text-bad">점이 그래프 밖으로 나갔어요(w={fmt(cur)}).</p>}
      {startFalls && <p className="mt-1 text-xs text-muted">시작점에 따라 도착하는 골짜기가 달라요. 왼쪽 골짜기가 가장 깊고, 오른쪽은 얕은 골짜기예요.</p>}

      <div className="mt-3 grid gap-1 sm:grid-cols-2 sm:gap-4">
        <label className="block text-sm text-ink">시작점 w₀ = <b>{fmt(start, 2)}</b>
          <input type="range" aria-label="시작점" min={fn.lo} max={fn.hi} step={0.05} value={start} onChange={(e) => reset(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: "var(--accent)" }} />
        </label>
        <label className="block text-sm text-ink">학습률 η = <b>{eta}</b>
          <input type="range" aria-label="학습률 η" min={0} max={ETAS.length - 1} step={1} value={etaIdx} onChange={(e) => setEtaIdx(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: "var(--accent)" }} />
        </label>
        <label className="block text-sm text-ink">자동 재생 걸음 수 = <b>{nSteps}</b> (최대 {MAX_STEPS})
          <input type="range" aria-label="자동 재생 걸음 수" min={1} max={MAX_STEPS} step={1} value={nSteps} onChange={(e) => setNSteps(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: "var(--accent)" }} />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={`${btn} bg-accent text-accent-ink disabled:opacity-40`} disabled={steps >= MAX_STEPS || playing} onClick={() => setRun((r) => doStep(r, eta))}>한 걸음</button>
        <button type="button" className={`${btn} border border-line bg-bg text-ink disabled:opacity-40`} disabled={!playing && (steps >= Math.min(nSteps, MAX_STEPS) || terminal)} onClick={() => setPlaying((p) => !p)}>{playing ? "멈추기" : "자동 재생"}</button>
        <button type="button" className={`${btn} border border-line bg-bg text-ink`} onClick={() => reset(start)}>처음으로</button>
      </div>

      {msg && <p className={`mt-3 rounded-card p-3 text-sm ${msg.cls}`} role="status">{msg.text}</p>}

      <div className="mt-3 rounded-card border border-line bg-bg p-3">
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div><dt className="text-muted">현재 w</dt><dd className="font-bold text-ink">{fmt(cur)}</dd></div>
          <div><dt className="text-muted">f(w)</dt><dd className="font-bold text-ink">{fmt(fn.f(cur))}</dd></div>
          <div><dt className="text-muted">기울기 f′(w)</dt><dd className="font-bold text-ink">{fmt(slope)}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-muted"><RichMath text={`$${fn.tex}$, $${fn.dtex}$`} /></p>
        <p className="mt-2 text-sm font-bold text-ink">다음 걸음 계산</p>
        <MathLine tex={`w_{new}=w-\\eta\\, f'(w)=${paren(cur)}-${eta}\\times ${paren(slope)}=${fmt(preview.wNew)}`} />
        <p className="text-xs text-muted">기울기가 +이면 왼쪽으로, −이면 오른쪽으로 가요. 기울기가 작을수록 걸음도 작아져요.</p>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[300px] border-collapse text-right text-sm">
          <caption className="mb-1 text-left text-sm font-bold text-ink">걸음 기록</caption>
          <thead><tr className="text-muted"><th className="p-1.5 text-left">걸음</th><th className="p-1.5">w</th><th className="p-1.5">f(w)</th><th className="p-1.5">f′(w)</th><th className="p-1.5">η</th></tr></thead>
          <tbody>
            {run.ws.slice(-8).map((w, j, arr) => {
              const i = run.ws.length - arr.length + j;
              return (
                <tr key={i} className={`border-t border-line ${i === run.ws.length - 1 ? "bg-accent-soft font-bold" : ""}`}>
                  <td className="p-1.5 text-left">{i}</td><td className="p-1.5">{fmt(w)}</td><td className="p-1.5">{fmt(fn.f(w))}</td><td className="p-1.5">{fmt(fn.df(w))}</td><td className="p-1.5">{i < run.etas.length ? run.etas[i] : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {run.ws.length > 8 && <p className="mt-1 text-xs text-muted">최근 8개만 보여줘요. (지금까지 {steps}걸음)</p>}
      </div>
    </section>
  );
}
