import { useRef, useState } from "react";
import RichMath from "../RichMath";
import { PRESETS, computeStats, predict, sseFor, xRange } from "./Regression.logic";
import type { Pt } from "./Regression.logic";

const MAX_POINTS = 20;
// 그림 좌표: 눈금 0~10 → 픽셀
const L = 36, T = 12, S = 330; // 왼쪽 여백, 위쪽 여백, 한 변 길이(정사각형: x·y 눈금 간격이 같다)
const W = L + S + 14, H = T + S + 30;
const px = (x: number) => L + (x / 10) * S;
const py = (y: number) => T + S - (y / 10) * S;
const TICKS = [0, 2, 4, 6, 8, 10];

const num = (x: number, d = 3) => (Math.round(x * 10 ** d) / 10 ** d).toString();
const sgn = (x: number, d = 3) => (x < 0 ? `- ${num(-x, d)}` : `+ ${num(x, d)}`);
const snap = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));

const PRESET_BTNS: [keyof typeof PRESETS, string][] = [
  ["positive", "양의 상관"], ["negative", "음의 상관"], ["none", "상관 없음"], ["outlier", "이상치 포함"],
];

export default function Regression() {
  const [pts, setPts] = useState<Pt[]>(PRESETS.positive);
  const [showRes, setShowRes] = useState(false);
  const [showSq, setShowSq] = useState(false);
  const [mine, setMine] = useState(false);
  const [ma, setMa] = useState(0.5);
  const [mb, setMb] = useState(2);
  const [xin, setXin] = useState("11");
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);

  const st = computeStats(pts);
  const ok = st.problem === null && st.a !== null && st.b !== null;
  const a = st.a ?? 0, b = st.b ?? 0;
  const rng = xRange(pts);

  const toData = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const vy = ((e.clientY - r.top) / r.height) * H;
    return { x: snap(((vx - L) / S) * 10), y: snap(((T + S - vy) / S) * 10) };
  };

  const onBg = (e: React.PointerEvent) => {
    if (drag.current !== null) return;
    if (pts.length >= MAX_POINTS) return;
    setPts([...pts, toData(e)]);
  };
  const onDown = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = i;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const i = drag.current;
    if (i === null) return;
    const d = toData(e);
    setPts((p) => p.map((q, j) => (j === i ? d : q)));
  };
  const onUp = () => { setTimeout(() => { drag.current = null; }, 0); };

  // 그릴 직선: 내 직선 모드이면 residual 은 내 직선 기준
  const resLine = mine ? { a: ma, b: mb } : ok ? { a, b } : null;
  const mySse = sseFor(pts, ma, mb);
  const xv = Number(xin);
  const xValid = xin.trim() !== "" && Number.isFinite(xv);
  const outside = xValid && rng !== null && (xv < rng[0] || xv > rng[1]);

  const lineEnds = (la: number, lb: number) => ({ x1: px(0), y1: py(lb), x2: px(10), y2: py(la * 10 + lb) });

  let rText = "";
  if (st.r !== null) {
    const m = Math.abs(st.r);
    rText = `${m >= 0.7 ? "강한" : m >= 0.3 ? "약한" : "거의 없는"} ${st.r > 0 ? "양의" : st.r < 0 ? "음의" : ""} 상관`.replace("거의 없는 양의", "거의 없는").replace("거의 없는 음의", "거의 없는").replace("  ", " ");
  }

  const btn = "min-h-11 rounded-card border border-line bg-bg px-3 text-sm text-ink";
  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="회귀직선 체험 도구">
      <h3 className="text-base font-bold text-ink">체험 도구 · 점을 찍으면 회귀직선</h3>
      <p className="mt-1 text-sm text-muted">그래프를 눌러 점을 찍고(최대 {MAX_POINTS}개), 점을 끌어서 옮겨 보세요. 점들에 가장 가까운 직선이 바로 그려져요.</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="예시 데이터">
        {PRESET_BTNS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setPts(PRESETS[k])} className={btn}>{label}</button>
        ))}
        <button type="button" onClick={() => setPts([])} className={`${btn} text-bad`}>모두 지우기</button>
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full select-none rounded-card bg-bg text-ink" role="img"
        aria-label={`점 ${pts.length}개가 있는 산점도`} onPointerDown={onBg} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ cursor: "crosshair" }}>
        <defs><clipPath id="rg-clip"><rect x={L} y={T} width={S} height={S} /></clipPath></defs>
        <rect x={L} y={T} width={S} height={S} fill="none" stroke="currentColor" opacity="0.25" />
        {TICKS.map((t) => (
          <g key={t} fontSize="10" fill="currentColor" opacity="0.7">
            <line x1={px(t)} y1={T} x2={px(t)} y2={T + S} stroke="currentColor" opacity="0.12" />
            <line x1={L} y1={py(t)} x2={L + S} y2={py(t)} stroke="currentColor" opacity="0.12" />
            <text x={px(t)} y={T + S + 14} textAnchor="middle">{t}</text>
            <text x={L - 6} y={py(t) + 3} textAnchor="end">{t}</text>
          </g>
        ))}
        <text x={L + S / 2} y={H - 3} textAnchor="middle" fontSize="11" fill="currentColor">x</text>
        <text x={10} y={T + 8} fontSize="11" fill="currentColor">y</text>

        <g clipPath="url(#rg-clip)">
          {showSq && resLine && pts.map((p, i) => {
            const r = p.y - (resLine.a * p.x + resLine.b);
            const side = Math.abs(r) * (S / 10);
            return <rect key={i} x={px(p.x)} y={r >= 0 ? py(p.y) : py(p.y) - side} width={side} height={side} fill="var(--accent)" opacity="0.18" stroke="var(--accent)" strokeOpacity="0.5" />;
          })}
          {showRes && resLine && pts.map((p, i) => (
            <line key={i} x1={px(p.x)} y1={py(p.y)} x2={px(p.x)} y2={py(resLine.a * p.x + resLine.b)} stroke="#d4472f" strokeWidth="1.8" />
          ))}
          {ok && <line {...lineEnds(a, b)} stroke="var(--accent)" strokeWidth="3" />}
          {mine && <line {...lineEnds(ma, mb)} stroke="#d98324" strokeWidth="2.5" strokeDasharray="6 4" />}
        </g>

        {pts.map((p, i) => (
          <g key={i} onPointerDown={onDown(i)} style={{ touchAction: "none", cursor: "grab" }}>
            <circle cx={px(p.x)} cy={py(p.y)} r={16} fill="transparent" />
            <circle cx={px(p.x)} cy={py(p.y)} r={5.5} fill="currentColor" stroke="var(--surface, #fff)" strokeWidth="1.5" />
          </g>
        ))}
        {pts.length === 0 && <text x={L + S / 2} y={T + S / 2} textAnchor="middle" fontSize="13" fill="currentColor" opacity="0.5">여기를 눌러 점을 찍어 보세요</text>}
      </svg>
      <p className="mt-1 text-xs text-muted">점 {pts.length}/{MAX_POINTS}개{pts.length >= MAX_POINTS ? " · 가득 찼어요. 점을 끌어 옮기거나 지워 보세요." : ""}</p>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={showRes} onChange={(e) => setShowRes(e.target.checked)} />잔차 선분 보기</label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink"><input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={showSq} onChange={(e) => setShowSq(e.target.checked)} />잔차의 제곱(정사각형) 보기</label>
      </div>
      {(showRes || showSq) && <p className="text-xs text-muted">{mine ? "지금은 '내 직선' 기준으로 그려요." : "최적 직선 기준으로 그려요."} 정사각형 넓이의 합이 SSE예요.</p>}

      {/* 결과 */}
      <div className="mt-3 rounded-card border border-line bg-bg p-3">
        {st.problem === "few" && <p className="text-sm text-ink">점이 {pts.length}개예요. <b>2개 이상</b> 찍어야 직선을 그릴 수 있어요.</p>}
        {st.problem === "vertical" && <p className="text-sm text-ink">모든 점의 x가 같아서 직선 y=ax+b로는 나타낼 수 없어요(수직선이 돼요). x가 다른 점을 하나 더 찍어 보세요.</p>}
        {ok && (
          <>
            <p className="text-base font-bold text-accent"><RichMath text={`$y=${num(a)}x ${sgn(b)}$`} /></p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-3">
              <div><dt className="text-muted">기울기 a</dt><dd className="font-bold text-ink">{num(a)}</dd></div>
              <div><dt className="text-muted">절편 b</dt><dd className="font-bold text-ink">{num(b)}</dd></div>
              <div><dt className="text-muted">상관계수 r</dt><dd className="font-bold text-ink">{st.r === null ? "계산 불가" : num(st.r)}</dd></div>
              <div><dt className="text-muted">x 평균</dt><dd className="font-bold text-ink">{num(st.mx)}</dd></div>
              <div><dt className="text-muted">y 평균</dt><dd className="font-bold text-ink">{num(st.my)}</dd></div>
              <div><dt className="text-muted">SSE (오차 제곱합)</dt><dd className="font-bold text-ink">{num(st.sse!)}</dd></div>
            </dl>
            <p className="mt-2 text-xs text-muted"><RichMath text={`$a=\\frac{\\sum(x-\\bar x)(y-\\bar y)}{\\sum(x-\\bar x)^2}=\\frac{${num(st.sxy)}}{${num(st.sxx)}}$, $b=\\bar y-a\\bar x$ (직선은 항상 $(\\bar x,\\bar y)$ 를 지나요)`} /></p>
            {st.r === null ? <p className="mt-1 text-sm text-ink">y가 모두 같아서 상관계수는 계산할 수 없어요(수평선).</p> : <p className="mt-1 text-sm text-ink">r={num(st.r, 2)} → {rText}이에요.</p>}
            {rng && pts.length >= 5 && Math.abs(st.r ?? 0) < 0.3 && <p className="mt-1 text-sm text-muted">r이 0에 가까워도 직선이 아닌 다른 관계가 있을 수 있어요.</p>}
          </>
        )}
      </div>

      {/* 내 직선 */}
      <div className="mt-3 rounded-card border border-line p-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-ink">
          <input type="checkbox" className="h-5 w-5" style={{ accentColor: "var(--accent)" }} checked={mine} onChange={(e) => setMine(e.target.checked)} />내 직선 만들기 (주황 점선)
        </label>
        {mine && (
          <div className="mt-1">
            <label className="block text-sm text-ink">기울기 a = <b>{num(ma, 2)}</b>
              <input type="range" aria-label="내 직선의 기울기 a" min={-3} max={3} step={0.05} value={ma} onChange={(e) => setMa(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: "var(--accent)" }} />
            </label>
            <label className="block text-sm text-ink">절편 b = <b>{num(mb, 1)}</b>
              <input type="range" aria-label="내 직선의 절편 b" min={-10} max={15} step={0.1} value={mb} onChange={(e) => setMb(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: "var(--accent)" }} />
            </label>
            {pts.length === 0 ? <p className="text-sm text-muted">점을 찍으면 SSE를 비교할 수 있어요.</p> : (
              <div className="mt-1 text-sm text-ink">
                <p>내 직선의 SSE: <b>{num(mySse)}</b>{ok && <> · 최적 직선의 SSE: <b>{num(st.sse!)}</b></>}</p>
                {ok && (mySse <= st.sse! + 1e-9
                  ? <p className="mt-1 rounded-card bg-ok-soft p-2 text-ok">거의 최적이에요! 최소제곱 직선과 같은 수준이에요.</p>
                  : <p className="mt-1 rounded-card bg-accent-soft p-2 text-ink">최적 직선이 더 작아요 (차이 {num(mySse - st.sse!)}). a와 b를 조금씩 조절해 따라잡아 보세요. 최적 직선보다 작게 만들 수는 없어요.</p>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 예측 */}
      <div className="mt-3 rounded-card border border-line p-3">
        <label className="block text-sm font-bold text-ink">예측하기 — x를 넣어 보세요
          <input type="number" inputMode="decimal" aria-label="예측할 x 값" value={xin} onChange={(e) => setXin(e.target.value)} className="mt-1 block min-h-11 w-full rounded-card border border-line bg-bg px-3 text-ink" />
        </label>
        {!ok ? <p className="mt-2 text-sm text-muted">직선이 그려지면 예측할 수 있어요.</p> : !xValid ? <p className="mt-2 text-sm text-muted">숫자를 입력해 주세요.</p> : (
          <>
            <p className="mt-2 text-sm text-ink"><RichMath text={`$\\hat y=${num(a)}\\times ${xv < 0 ? `(${num(xv)})` : num(xv)} ${sgn(b)}=$ **${num(predict(a, b, xv))}**`} /></p>
            {outside && <p className="mt-2 rounded-card bg-bad-soft p-2 text-sm text-bad">범위 밖 예측 주의! 지금 데이터의 x는 {num(rng![0], 1)}~{num(rng![1], 1)} 사이예요. 이 밖에서는 직선이 맞는지 알 수 없어서 예측이 틀리기 쉬워요.</p>}
          </>
        )}
      </div>
    </section>
  );
}
