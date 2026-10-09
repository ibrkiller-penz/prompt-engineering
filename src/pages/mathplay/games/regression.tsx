import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, Say, Stat, clamp, svgPoint } from "./kit";
import { OUTLIER, X0, X1, leastSquares, lineAt, lsAt, makeData, sse } from "./regression.logic";

const W = 640,
  H = 400,
  L = 52,
  RR = 14,
  T = 14,
  B = 40;
const XMIN = 1988,
  XMAX = 2044,
  YMIN = -0.8,
  YMAX = 1.8;
const sx = (x: number) => L + ((x - XMIN) / (XMAX - XMIN)) * (W - L - RR);
const sy = (y: number) => H - B - ((y - YMIN) / (YMAX - YMIN)) * (H - B - T);
const inv = (py: number) => YMAX - ((py - T) / (H - B - T)) * (YMAX - YMIN);
const r2 = (v: number) => Math.round(v * 100) / 100;
const mean = (a: { y: number }[]) => a.reduce((s, p) => s + p.y, 0) / a.length;

export default function RegressionGame() {
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 9000));
  const data = makeData(seed);
  const [ya, setYa] = useState(() => r2(mean(makeData(seed))));
  const [yb, setYb] = useState(() => r2(mean(makeData(seed))));
  const [showLs, setShowLs] = useState(false);
  const [outlier, setOutlier] = useState(false);
  const [predict, setPredict] = useState(false);
  const [solved, setSolved] = useState(false);
  const [wins, setWins] = useState(0);
  const [moves, setMoves] = useState(0);
  const drag = useRef<"a" | "b" | null>(null);

  const pts = outlier ? [...data, OUTLIER] : data;
  const ls = leastSquares(pts);
  const ls0 = leastSquares(data);
  const mine = (x: number) => lineAt(ya, yb, x);
  const sseMine = sse(pts, mine);
  const sseLs = sse(pts, (x) => lsAt(ls, x));
  const ratio = sseMine / sseLs;
  const ok = ratio <= 1.2;

  useEffect(() => {
    if (ok && !solved) {
      setSolved(true);
      setWins((w) => w + 1);
    }
  }, [ok, solved]);

  const set = (which: "a" | "b", v: number) => {
    const c = r2(clamp(v, YMIN + 0.05, YMAX - 0.05));
    if (which === "a") setYa(c);
    else setYb(c);
  };
  const onDown = (which: "a" | "b") => (e: PointerEvent<SVGGElement>) => {
    e.currentTarget.ownerSVGElement!.setPointerCapture(e.pointerId);
    drag.current = which;
    setMoves((m) => m + 1);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const [, y] = svgPoint(e.currentTarget, e.clientX, e.clientY);
    set(drag.current, inv(y));
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (which: "a" | "b") => (e: KeyboardEvent<SVGGElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const cur = which === "a" ? ya : yb;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      set(which, cur + step);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      set(which, cur - step);
    }
  };

  const newData = () => {
    const s = 1 + Math.floor(Math.random() * 9000);
    const m = r2(mean(makeData(s)));
    setSeed(s);
    setYa(m);
    setYb(m);
    setSolved(false);
    setShowLs(false);
    setPredict(false);
    setOutlier(false);
    setMoves(0);
  };
  const flat = () => {
    const m = r2(mean(pts));
    setYa(m);
    setYb(m);
  };

  const pred = mine(2040);
  const predLs = lsAt(ls, 2040);
  const grid = [-0.5, 0, 0.5, 1, 1.5];

  const handle = (which: "a" | "b", x: number, y: number, label: string) => (
    <g
      key={which}
      onPointerDown={onDown(which)}
      onKeyDown={onKey(which)}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuemin={YMIN}
      aria-valuemax={YMAX}
      aria-valuenow={which === "a" ? ya : yb}
      aria-orientation="vertical"
      className="cursor-grab outline-none focus-visible:[&>circle:nth-of-type(2)]:stroke-[var(--ink)]"
    >
      <circle cx={sx(x)} cy={sy(y)} r={26} fill="transparent" />
      <circle cx={sx(x)} cy={sy(y)} r={11} fill="#f97316" stroke="#fff" strokeWidth={3} />
    </g>
  );

  return (
    <div className="space-y-3">
      <Board className="space-y-3">
        <p className="rounded-card bg-bad-soft px-3 py-2 text-sm font-bold text-bad">⚠ 가상의 예시 자료예요. 실제 기후 자료가 아니에요.</p>
        <div className="flex flex-wrap gap-2">
          <Stat label="내 오차 제곱합" value={sseMine.toFixed(2)} />
          <Stat label="평균 오차" value={`${Math.sqrt(sseMine / pts.length).toFixed(2)}℃`} />
          <Stat label="최소제곱선의" value={`${ratio.toFixed(2)}배`} tone={ok ? "ok" : "plain"} />
          <Stat label="성공" value={wins} tone={wins ? "ok" : "plain"} />
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none rounded-card bg-bg"
          role="group"
          aria-label="가상 기온 변화 산점도. 주황 손잡이 두 개를 위아래로 끌어 직선을 맞춰요"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {grid.map((g) => (
            <g key={g}>
              <line x1={L} x2={W - RR} y1={sy(g)} y2={sy(g)} stroke="var(--line)" />
              <text x={L - 6} y={sy(g) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">{g}</text>
            </g>
          ))}
          {[1990, 2000, 2010, 2020, 2030, 2040].map((x) => (
            <g key={x}>
              <line x1={sx(x)} x2={sx(x)} y1={T} y2={H - B} stroke="var(--line)" />
              <text x={sx(x)} y={H - B + 18} textAnchor="middle" fontSize={12} fill="var(--muted)">{x}</text>
            </g>
          ))}
          <text x={L} y={H - 6} fontSize={12} fill="var(--muted)">연도 (가상 자료: 1991~2020년)</text>
          <text x={W - RR} y={H - 6} textAnchor="end" fontSize={12} fill="var(--muted)">기온 변화(℃)</text>
          <rect x={sx(X1)} y={T} width={sx(XMAX) - sx(X1)} height={H - B - T} fill="var(--muted)" opacity={0.07} />
          <text x={(sx(X1) + sx(XMAX)) / 2} y={T + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">자료 없는 곳</text>

          {showLs && <line x1={sx(XMIN)} y1={sy(lsAt(ls, XMIN))} x2={sx(XMAX)} y2={sy(lsAt(ls, XMAX))} stroke="#16a34a" strokeWidth={3} />}
          <line x1={sx(XMIN)} y1={sy(mine(XMIN))} x2={sx(XMAX)} y2={sy(mine(XMAX))} stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.7} />
          <line x1={sx(X0)} y1={sy(ya)} x2={sx(X1)} y2={sy(yb)} stroke="#f97316" strokeWidth={3.5} />

          {data.map((p) => (
            <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={4.5} fill="#2563eb" opacity={0.85} />
          ))}
          {outlier && (
            <g>
              <circle cx={sx(OUTLIER.x)} cy={sy(OUTLIER.y)} r={7} fill="#dc2626" stroke="#fff" strokeWidth={2} />
              <text x={sx(OUTLIER.x) - 10} y={sy(OUTLIER.y) + 4} textAnchor="end" fontSize={12} fill="#dc2626" fontWeight={700}>이상한 점</text>
            </g>
          )}
          {predict && (
            <g>
              <line x1={sx(2040)} x2={sx(2040)} y1={T} y2={H - B} stroke="#7c3aed" strokeDasharray="4 3" />
              <circle cx={sx(2040)} cy={sy(pred)} r={7} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
              <text x={sx(2040) - 10} y={sy(pred) - 10} textAnchor="end" fontSize={12} fontWeight={700} fill="#7c3aed">2040년 약 {pred.toFixed(2)}℃</text>
            </g>
          )}
          {handle("a", X0, ya, `1990년 쪽 손잡이, 값 ${ya}`)}
          {handle("b", X1, yb, `2020년 쪽 손잡이, 값 ${yb}`)}
        </svg>
        <div className="flex flex-wrap gap-2">
          <GButton variant={showLs ? "soft" : "primary"} pressed={showLs} onClick={() => setShowLs((s) => !s)}>📏 최소제곱선 보기</GButton>
          <GButton pressed={outlier} onClick={() => setOutlier((o) => !o)}>⚡ 이상한 점 추가</GButton>
          <GButton onClick={flat}>선 평평하게</GButton>
          <GButton onClick={newData}>새 자료</GButton>
        </div>
        <Say tone={ok ? "ok" : moves ? "bad" : "info"}>
          {ok
            ? `성공! 오차가 최소제곱선의 ${ratio.toFixed(2)}배예요(1.2배 이내).`
            : moves
              ? `아직 최소제곱선의 ${ratio.toFixed(2)}배예요. 1.2배 이내로 줄여 봐요. 두 손잡이를 위아래로 끌어요(키보드는 ↑↓, Shift는 크게).`
              : "주황 손잡이 두 개를 끌어서 파란 점들 한가운데를 지나는 직선을 만들어 봐요. 목표: 오차를 최소제곱선의 1.2배 이내로!"}
        </Say>
        {showLs && (
          <p className="rounded-card bg-ok-soft p-2 text-sm text-ok">
            최소제곱선은 오차 제곱합을 가장 작게 만드는 직선이에요: 오차 제곱합 {sseLs.toFixed(2)}, 기울기 해마다 {ls.b.toFixed(4)}℃.
          </p>
        )}
      </Board>

      {outlier && (
        <Board className="text-sm">
          <strong>이상한 점이 선을 끌어당겨요.</strong> 최소제곱선의 기울기가 해마다 {ls0.b.toFixed(4)}℃에서 {ls.b.toFixed(4)}℃로 바뀌었어요. 점 하나 때문에 2040년 예측값이 {lsAt(ls0, 2040).toFixed(2)}℃에서 {lsAt(ls, 2040).toFixed(2)}℃로 달라져요. ‘최소제곱선 보기’를 켜고 선이 어떻게 기우는지 보세요.
        </Board>
      )}

      <Board className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <GButton variant="primary" disabled={!solved} onClick={() => setPredict((p) => !p)} pressed={predict}>🔮 2040년 값을 예측해 봐요</GButton>
          {!solved && <span className="text-sm text-muted">먼저 오차를 1.2배 이내로 맞추면 열려요.</span>}
        </div>
        {predict && (
          <div className="space-y-2 text-sm">
            <p>내 직선을 2040년까지 쭉 늘리면 약 <strong>{pred.toFixed(2)}℃</strong>, 최소제곱선으로는 약 <strong>{predLs.toFixed(2)}℃</strong>예요. (둘의 차이 {Math.abs(pred - predLs).toFixed(2)}℃)</p>
            <Say tone="bad">⚠ 자료는 2020년까지뿐이에요. 자료 범위 밖 예측은 불확실해요. 앞으로도 같은 기울기로 갈지는 알 수 없고, 선이 조금만 달라도 멀리 갈수록 차이가 커져요. 게다가 이 자료는 가상이에요.</Say>
          </div>
        )}
      </Board>
    </div>
  );
}
