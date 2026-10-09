import { useMemo, useRef, useState } from "react";
import {
  CLASS_COLORS, CLASS_NAMES, PRESET_POINTS, classify, decisionGrid, type Labeled, type Metric, type Pt,
} from "./Knn.logic";

const CELLS = 20;
const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

export default function Knn() {
  const [points, setPoints] = useState<Labeled[]>(PRESET_POINTS);
  const [query, setQuery] = useState<Pt | null>({ x: 5, y: 5 });
  const [k, setK] = useState(3);
  const [metric, setMetric] = useState<Metric>("euclid");
  const [addMode, setAddMode] = useState(false);
  const [addCls, setAddCls] = useState(0);
  const [shade, setShade] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const kk = Math.min(k, points.length);
  const result = useMemo(() => (query ? classify(points, query, kk, metric, 3) : null), [points, query, kk, metric]);
  const region = useMemo(() => (shade ? decisionGrid(points, kk, metric, 3, CELLS) : null), [shade, points, kk, metric]);

  const toData = (e: React.MouseEvent<SVGSVGElement>): Pt | null => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const q = pt.matrixTransform(m.inverse());
    return { x: Math.min(10, Math.max(0, Math.round(q.x * 10) / 10)), y: Math.min(10, Math.max(0, Math.round((10 - q.y) * 10) / 10)) };
  };
  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = toData(e);
    if (!p) return;
    if (addMode) setPoints((s) => [...s, { ...p, cls: addCls }]);
    else setQuery(p);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (addMode) return;
    const d: Record<string, [number, number]> = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, 0.5], ArrowDown: [0, -0.5] };
    const v = d[e.key];
    if (!v) return;
    e.preventDefault();
    setQuery((q) => {
      const b = q ?? { x: 5, y: 5 };
      return { x: Math.min(10, Math.max(0, b.x + v[0])), y: Math.min(10, Math.max(0, b.y + v[1])) };
    });
  };

  const btn = "min-h-[44px] rounded-lg border border-line bg-bg px-3 text-sm font-medium text-ink";
  const unit = metric === "euclid" ? "유클리드 거리 √(Δx²+Δy²)" : "맨해튼 거리 |Δx|+|Δy|";

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="text-sm font-bold text-accent">체험 도구 · 거리 기반 분류 (k-NN)</h3>
      <p className="mt-1 text-sm text-muted">
        그래프를 눌러 새 점(검은 별)을 놓으면, 가장 가까운 k개의 이웃이 투표해서 분류해요. 화살표 키로 별을 옮길 수도 있어요.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <label className="flex min-h-[44px] flex-1 basis-56 items-center gap-2 text-sm font-medium text-ink">
          k = <b className="w-4 text-center text-accent">{k}</b>
          <input
            type="range" min={1} max={9} value={k} aria-label="이웃의 수 k"
            onChange={(e) => setK(Number(e.target.value))}
            className="h-11 flex-1 accent-[var(--color-accent,#4263eb)]"
          />
        </label>
        <div className="flex gap-2" role="group" aria-label="거리 종류">
          {(["euclid", "manhattan"] as Metric[]).map((m) => (
            <button
              key={m} type="button" aria-pressed={metric === m} onClick={() => setMetric(m)}
              className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium ${metric === m ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink"}`}
            >
              {m === "euclid" ? "유클리드" : "맨해튼"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" aria-pressed={addMode} onClick={() => setAddMode((v) => !v)}
          className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium ${addMode ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink"}`}>
          {addMode ? "학습 점 추가 중 (눌러서 끄기)" : "학습 점 추가 모드"}
        </button>
        {addMode &&
          CLASS_NAMES.map((n, c) => (
            <button key={n} type="button" aria-pressed={addCls === c} onClick={() => setAddCls(c)}
              className="min-h-[44px] rounded-lg border-2 bg-bg px-3 text-sm font-medium text-ink"
              style={{ borderColor: addCls === c ? CLASS_COLORS[c] : "transparent", outline: "1px solid var(--color-line, #ddd)" }}>
              <span style={{ color: CLASS_COLORS[c] }}>●</span> {n}
            </button>
          ))}
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-5 w-5" checked={shade} onChange={(e) => setShade(e.target.checked)} />
          결정 영역 색칠
        </label>
        <button type="button" className={btn} onClick={() => { setPoints(PRESET_POINTS); setQuery({ x: 5, y: 5 }); setAddMode(false); }}>처음으로</button>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,420px)_1fr]">
        <svg
          ref={svgRef}
          viewBox="-1 -0.5 11.7 11.7"
          role="application"
          tabIndex={0}
          aria-label="k-NN 산점도. 클릭하거나 화살표 키로 새 점을 놓아요"
          onClick={onClick}
          onKeyDown={onKey}
          className="w-full max-w-[420px] cursor-crosshair touch-manipulation rounded-lg border border-line bg-bg"
        >
          {region?.map((r, i) =>
            r.map((c, j) => (
              <rect key={`${i}-${j}`} x={(j * 10) / CELLS} y={(i * 10) / CELLS} width={10 / CELLS + 0.01} height={10 / CELLS + 0.01}
                fill={CLASS_COLORS[c]} opacity={0.2} />
            )),
          )}
          {[0, 2, 4, 6, 8, 10].map((t) => (
            <g key={t} fontSize={0.38} fill="currentColor" className="text-muted">
              <line x1={t} y1={0} x2={t} y2={10} stroke="currentColor" strokeWidth={0.02} opacity={0.2} />
              <line x1={0} y1={10 - t} x2={10} y2={10 - t} stroke="currentColor" strokeWidth={0.02} opacity={0.2} />
              <text x={t} y={10.6} textAnchor="middle">{t}</text>
              <text x={-0.2} y={10 - t + 0.13} textAnchor="end">{t}</text>
            </g>
          ))}
          <rect x={0} y={0} width={10} height={10} fill="none" stroke="currentColor" strokeWidth={0.04} className="text-muted" />
          {query && result?.neighbors.map((n, i) => (
            <line key={`l${i}`} x1={query.x} y1={10 - query.y} x2={n.x} y2={10 - n.y}
              stroke={CLASS_COLORS[n.cls]} strokeWidth={0.07} strokeDasharray="0.2 0.12" />
          ))}
          {points.map((p, i) => {
            const isN = result?.neighbors.some((n) => n.idx === i);
            return (
              <g key={i}>
                {isN && <circle cx={p.x} cy={10 - p.y} r={0.42} fill="none" stroke="currentColor" strokeWidth={0.06} className="text-ink" />}
                <circle cx={p.x} cy={10 - p.y} r={0.26} fill={CLASS_COLORS[p.cls]} />
              </g>
            );
          })}
          {query && (
            <text x={query.x} y={10 - query.y + 0.3} textAnchor="middle" fontSize={0.9} fill="currentColor" className="text-ink">★</text>
          )}
        </svg>

        <div className="min-w-0">
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink">
            {CLASS_NAMES.map((n, c) => (
              <li key={n}><span style={{ color: CLASS_COLORS[c] }}>●</span> {n} ({points.filter((p) => p.cls === c).length}개)</li>
            ))}
            <li className="text-muted">◯ = 선택된 이웃</li>
          </ul>

          {query && result ? (
            <>
              <div className="mt-2 rounded-lg bg-accent-soft p-3 text-sm text-accent">
                새 점 ★ ({fmt(query.x)}, {fmt(query.y)}) →{" "}
                <b style={{ color: CLASS_COLORS[result.winner] }}>예측: {CLASS_NAMES[result.winner]}</b>
                <div className="mt-1 text-ink">
                  투표: {CLASS_NAMES.map((n, c) => `${n} ${result.votes[c]}표`).join(" · ")}
                </div>
                {result.tieBroken && (
                  <div className="mt-1 text-bad">동점이에요! 규칙에 따라 가장 가까운 이웃이 속한 {CLASS_NAMES[result.winner]}가 이겼어요.</div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                규칙: 표가 가장 많은 쪽이 이겨요. 동점이면 동점인 쪽들 중 가장 가까운 이웃이 속한 쪽이 이겨요. (거리: {unit})
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[280px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="py-1 pr-2 font-medium">순위</th>
                      <th className="pr-2 font-medium">점 (x, y)</th>
                      <th className="pr-2 font-medium">반</th>
                      <th className="font-medium">거리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.neighbors.map((n, i) => (
                      <tr key={n.idx} className="border-b border-line/60 text-ink">
                        <td className="py-1 pr-2">{i + 1}</td>
                        <td className="pr-2">({fmt(n.x)}, {fmt(n.y)})</td>
                        <td className="pr-2" style={{ color: CLASS_COLORS[n.cls] }}>{CLASS_NAMES[n.cls]}</td>
                        <td>{fmt(n.dist)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">그래프를 눌러 새 점을 놓아 보세요.</p>
          )}
          {addMode && <p className="mt-2 text-sm text-accent">학습 점 추가 모드: 그래프를 누르면 {CLASS_NAMES[addCls]} 점이 늘어나요.</p>}
        </div>
      </div>
    </section>
  );
}
