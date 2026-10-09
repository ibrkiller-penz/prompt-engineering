import { useMemo, useState } from "react";
import { TRUE_MEAN, histogram, interpret, mean, runningMeans, sample, sd } from "./BigData.logic";

const SIZES = [5, 20, 100, 1000, 10000];
const btn = "min-h-[44px] rounded-card px-4 py-2 font-semibold";

export default function BigData() {
  const [n, setN] = useState(20);
  const [seed, setSeed] = useState(1);
  const [biased, setBiased] = useState(false);

  const data = useMemo(() => sample(n, seed, biased), [n, seed, biased]);
  const m = mean(data);
  const s = sd(data);
  const hist = useMemo(() => histogram(data), [data]);
  const run = useMemo(() => runningMeans(data), [data]);

  // 꺾은선 차트: x는 로그 스케일, y는 40~100
  const W = 320, H = 170, L = 34, R = 8, T = 10, B = 22;
  const yMin = 40, yMax = 100;
  const px = (k: number) => L + (n <= 1 ? 0 : (Math.log(k) / Math.log(Math.max(n, 2))) * (W - L - R));
  const py = (v: number) => T + (1 - (Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * (H - T - B);
  const path = run.map((p, i) => `${i ? "L" : "M"}${px(p.k).toFixed(1)},${py(p.m).toFixed(1)}`).join(" ");

  const hmax = Math.max(1, ...hist);
  const HW = 320, HH = 110, hb = 18;
  const bw = (HW - 20) / hist.length;

  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="데이터가 많아지면">
      <h3 className="font-bold text-ink">체험 도구 · 데이터가 많아지면</h3>
      <p className="mt-1 text-sm text-muted">전교생 시험 점수의 진짜 평균은 비밀이에요(점선). 표본을 뽑아 평균이 어디로 모이는지 보세요. '편향된 표집'을 켜면 어떻게 될까요?</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="표본 크기">
        {SIZES.map((v) => (
          <button key={v} type="button" onClick={() => setN(v)} aria-pressed={n === v}
            className={`${btn} ${n === v ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"}`}>
            n={v.toLocaleString()}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm text-ink">
        표본 크기 n = <b>{n.toLocaleString()}</b>
        <input type="range" min={0} max={100} value={Math.round((Math.log(n / 5) / Math.log(2000)) * 100)}
          onChange={(e) => setN(Math.max(5, Math.round(5 * Math.pow(2000, Number(e.target.value) / 100))))}
          className="mt-1 block h-11 w-full" />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setSeed((x) => x + 1)} className={`${btn} bg-accent text-accent-ink`}>다시 뽑기</button>
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={biased} onChange={(e) => setBiased(e.target.checked)} className="h-5 w-5" />
          편향된 표집 (공부 많이 하는 학생들만 조사)
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-ink">표본 평균이 모이는 모습</p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="누적 평균 꺾은선 그래프">
            {[40, 60, 80, 100].map((v) => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={py(v)} y2={py(v)} stroke="currentColor" className="text-line" strokeWidth={1} />
                <text x={L - 4} y={py(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">{v}</text>
              </g>
            ))}
            <line x1={L} x2={W - R} y1={py(TRUE_MEAN)} y2={py(TRUE_MEAN)} stroke="currentColor" className="text-ok" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={W - R} y={py(TRUE_MEAN) - 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-ok">진짜 평균 {TRUE_MEAN}</text>
            <path d={path} fill="none" stroke="currentColor" className="text-accent" strokeWidth={2} />
            <text x={L} y={H - 6} fontSize={9} fill="currentColor" className="text-muted">1</text>
            <text x={W - R} y={H - 6} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">n={n.toLocaleString()} (로그 눈금)</text>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">점수 분포 (히스토그램)</p>
          <svg viewBox={`0 0 ${HW} ${HH + hb}`} className="w-full" role="img" aria-label="점수 히스토그램">
            {hist.map((c, i) => {
              const h = (c / hmax) * (HH - 10);
              return <rect key={i} x={10 + i * bw + 1} y={HH - h} width={bw - 2} height={h} fill="currentColor" className="text-accent" opacity={0.75} />;
            })}
            <line x1={10 + (m / 100) * (HW - 20)} x2={10 + (m / 100) * (HW - 20)} y1={0} y2={HH} stroke="currentColor" className="text-ink" strokeWidth={1.5} />
            <line x1={10 + (TRUE_MEAN / 100) * (HW - 20)} x2={10 + (TRUE_MEAN / 100) * (HW - 20)} y1={0} y2={HH} stroke="currentColor" className="text-ok" strokeWidth={1.5} strokeDasharray="5 4" />
            {[0, 50, 100].map((v) => (
              <text key={v} x={10 + (v / 100) * (HW - 20)} y={HH + 13} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted">{v}점</text>
            ))}
          </svg>
          <p className="text-xs text-muted">검은 선 = 표본 평균, 점선 = 진짜 평균</p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-card bg-bg p-2"><dt className="text-xs text-muted">표본 평균</dt><dd className="font-bold text-ink">{m.toFixed(1)}</dd></div>
        <div className="rounded-card bg-bg p-2"><dt className="text-xs text-muted">표준편차</dt><dd className="font-bold text-ink">{s.toFixed(1)}</dd></div>
        <div className="rounded-card bg-bg p-2"><dt className="text-xs text-muted">진짜 평균과 차이</dt><dd className={`font-bold ${Math.abs(m - TRUE_MEAN) > 5 ? "text-bad" : "text-ok"}`}>{(m - TRUE_MEAN).toFixed(1)}</dd></div>
      </dl>
      <p className={`mt-3 rounded-card p-3 text-sm ${biased && n >= 100 ? "bg-bad-soft text-ink" : "bg-accent-soft text-accent"}`} aria-live="polite">
        {interpret(n, m, biased)}
      </p>
    </section>
  );
}
