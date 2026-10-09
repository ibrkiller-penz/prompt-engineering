import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, svgPoint, tick } from "./kit";
import { MISSIONS, ceil2, circumscribed, floor2, gap, inscribed, missionOk } from "./archpi.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
const CHAIN = [6, 12, 24, 48, 96];
const BIG = "!min-h-[48px] !text-base";
const f2 = (v: number) => v.toFixed(2);
const AUTO_MS = 3000;
const JUA = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
/** 반지름 22인 통통한 별 */
const STAR = Array.from({ length: 10 }, (_, k) => {
  const a = -Math.PI / 2 + (k * Math.PI) / 5;
  const r = k % 2 ? 11 : 24;
  return `${k ? "L" : "M"}${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
}).join("") + "Z";

const RD = 188; // 손잡이가 도는 고리 반지름
const R = 104; // 단위원 반지름(그림에서)
const SWEEP = 270; // 고리가 도는 각도(위에서 시계 방향)
const HALF = 224;

/** n → 고리 위치 비율 0~1 (6→0, 12→1/4, … 96→1) */
const fOf = (n: number) => (n <= 6 ? 0 : n >= 96 ? 1 : Math.log2(n / 6) / 4);
const polar = (f: number, r: number) => {
  const a = (f * SWEEP * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)] as const;
};
const arc = (f0: number, f1: number, r: number) => {
  const [x0, y0] = polar(f0, r), [x1, y1] = polar(f1, r);
  const large = (f1 - f0) * SWEEP > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
};

function missionText(i: number) {
  const m = MISSIONS[i];
  return m.is314 ? "두 값이 ‘3.14’와 ‘3.15’ 사이로 모일 때까지 늘려요!" : `두 값의 차이를 ${m.gap} 보다 작게 만들어요!`;
}

export default function ArchPiGame() {
  const [n, setN] = useState(6);
  const [mi, setMi] = useState(0);
  const [stars, setStars] = useState(0);
  const [ok, setOk] = useState(false);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "반짝이는 별 손잡이 ⭐을 잡고 고리를 따라 돌려 보세요. 도형의 변이 늘어나요!" });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const lo = inscribed(n), hi = circumscribed(n);
  const ptsIn = useMemo(() => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / n; return [R * Math.cos(a), R * Math.sin(a)]; }), [n]);
  const ptsOut = useMemo(() => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / n; const r2 = R / Math.cos(Math.PI / n); return [r2 * Math.cos(a), r2 * Math.sin(a)]; }), [n]);
  const poly = (p: number[][]) => p.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");

  const span = Math.max(hi - Math.PI, Math.PI - lo) * 1.6;
  const a0 = Math.PI - span, a1 = Math.PI + span;
  const bx = (v: number) => 20 + ((v - a0) / (a1 - a0)) * 360;

  const last = mi === MISSIONS.length - 1;

  function apply(v: number, sound = true) {
    const m = Math.max(3, Math.min(96, Math.round(v)));
    if (m === n) return;
    setN(m);
    if (ok) {
      if (sound) tick();
      return;
    }
    if (missionOk(mi, m)) {
      setOk(true);
      setStars((s) => s + 1);
      cheer();
      setMsg({
        t: "ok",
        s: last
          ? `대단해요! ⭐ ${m}각형이면 원의 둘레 ÷ 지름이 ${f2(floor2(inscribed(m)))} 와 ${f2(ceil2(circumscribed(m)))} 사이예요. 그래서 3.14쯤이에요! 별 ${stars + 1}개를 모았어요!`
          : `잘했어요! ⭐ ${m}각형에서 성공! 두 값의 차이가 ${f2(gap(m))} 로 줄었어요. 곧 다음 미션이에요!`,
      });
    } else {
      if (sound) tick();
      setMsg({ t: "info", s: `${m}각형이에요. 두 값의 차이는 ${f2(gap(m))} 예요. 더 돌리면 차이가 더 줄어요!` });
    }
  }

  // 성공하면 잠깐 보여 주고 저절로 다음 미션
  useEffect(() => {
    if (ok && !last) {
      const id = setTimeout(nextMission, AUTO_MS);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, mi]);

  function nextMission() {
    setMi((x) => x + 1);
    setOk(false);
    setHint(false);
    setN(6);
    setMsg({ t: "info", s: "새 미션이에요! 다시 6각형에서 시작해요. 손잡이를 돌려 보세요!" });
  }
  const reset = () => {
    setMi(0); setStars(0); setOk(false); setHint(false); setN(6);
    setMsg({ t: "info", s: "처음부터 다시 해요. 별 손잡이 ⭐을 고리를 따라 돌려 보세요!" });
  };

  const fromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [px, py] = svgPoint(svg, e.clientX, e.clientY);
    let deg = (Math.atan2(px, -py) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    if (deg > SWEEP) deg = deg < (SWEEP + 360) / 2 ? SWEEP : 0;
    const idx = Math.round((deg / SWEEP) * 4);
    apply(CHAIN[idx]);
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [px, py] = svgPoint(svg, e.clientX, e.clientY);
    if (Math.hypot(px, py) < RD - 60) return; // 고리 근처만 잡히게
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    fromPointer(e);
  };
  const idxNow = CHAIN.indexOf(n);
  const step = (d: number) => {
    const cur = CHAIN.findIndex((c) => c >= n);
    const base = idxNow >= 0 ? idxNow : d > 0 ? cur - 1 : cur;
    const j = Math.max(0, Math.min(4, base + d));
    apply(CHAIN[j]);
  };

  const f = fOf(n);
  const [hx, hy] = polar(f, RD);

  return (
    <Board>
      <p className="font-game text-xl">🎯 미션 {mi + 1}/{MISSIONS.length} · {missionText(mi)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Stat label="별" value={"⭐".repeat(stars) || "0"} tone={stars ? "ok" : "plain"} />
        <Stat label="변" value={`${n}개`} />
      </div>

      <svg
        ref={svgRef}
        viewBox={`${-HALF} ${-HALF} ${2 * HALF} ${2 * HALF}`}
        className="mx-auto mt-2 w-full max-w-[460px] select-none rounded-card"
        style={{ touchAction: "none", cursor: "grab" }}
        onPointerDown={onDown}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        role="group"
        aria-label={`원 안팎의 ${n}각형. 바깥 고리의 손잡이를 돌려 변의 수를 바꿔요`}
      >
        <defs>
          <linearGradient id="ap-table" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fde7c4" />
            <stop offset="1" stopColor="#f6c48a" />
          </linearGradient>
          <radialGradient id="ap-pie" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#fff7d6" />
            <stop offset="0.6" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </radialGradient>
          <radialGradient id="ap-star" cx="0.4" cy="0.35" r="0.75">
            <stop offset="0" stopColor="#fffbeb" />
            <stop offset="0.5" stopColor="#fde047" />
            <stop offset="1" stopColor="#f59e0b" />
          </radialGradient>
          <linearGradient id="ap-track" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c084fc" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
          <style>{`
            .ap-pop { animation: ap-pop .6s cubic-bezier(.2,1.6,.4,1) both; transform-box: fill-box; transform-origin: center; }
            @keyframes ap-pop { 0% { transform: scale(.9); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
            .ap-tw { animation: ap-tw 1.2s ease-in-out infinite; }
            @keyframes ap-tw { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .ap-pop, .ap-tw { animation: none; } }
          `}</style>
        </defs>
        {/* 부엌 테이블 */}
        <rect x={-HALF} y={-HALF} width={2 * HALF} height={2 * HALF} rx={26} fill="url(#ap-table)" />
        {[-150, -75, 0, 75, 150].map((y) => <line key={y} x1={-HALF} x2={HALF} y1={y} y2={y} stroke="#e7a964" strokeWidth={2} opacity={0.5} />)}
        <circle cx={0} cy={6} r={RD - 22} fill="#000" opacity={0.08} />
        <circle cx={0} cy={0} r={RD - 24} fill="#ffffff" stroke="#ede9fe" strokeWidth={8} />
        {/* 고리 */}
        <path d={arc(0, 1, RD)} fill="none" stroke="#6b21a8" strokeWidth={22} strokeLinecap="round" />
        <path d={arc(0, 1, RD)} fill="none" stroke="#ede9fe" strokeWidth={16} strokeLinecap="round" />
        <path d={arc(0, Math.max(f, 0.0001), RD)} fill="none" stroke="url(#ap-track)" strokeWidth={16} strokeLinecap="round" />
        {CHAIN.map((c, i) => {
          const [x, y] = polar(i / 4, RD);
          const [tx, ty] = polar(i / 4, RD - 40);
          const on = n >= c;
          return (
            <g key={c}>
              <circle cx={x} cy={y} r={30} fill="transparent" onClick={() => apply(c)} style={{ cursor: "pointer" }} />
              <circle cx={x} cy={y} r={9} fill={on ? "#f472b6" : "#ffffff"} stroke="#6b21a8" strokeWidth={3} pointerEvents="none" />
              <text x={tx} y={ty + 8} fontSize={24} fill={n === c ? "#7c3aed" : "#6b21a8"} textAnchor="middle" stroke="#fff" strokeWidth={5} paintOrder="stroke" pointerEvents="none" style={JUA}>{c}</text>
            </g>
          );
        })}
        {/* 파이와 쿠키 틀 */}
        <g key={stars} className={stars ? "ap-pop" : ""} pointerEvents="none">
          <circle cx={0} cy={0} r={R} fill="url(#ap-pie)" />
          {Array.from({ length: 16 }, (_, k) => {
            const a = (2 * Math.PI * k) / 16;
            return <circle key={k} cx={(R - 2) * Math.cos(a)} cy={(R - 2) * Math.sin(a)} r={6} fill="#f59e0b" opacity={0.55} />;
          })}
          <circle cx={0} cy={0} r={R} fill="none" stroke="#92400e" strokeWidth={4} />
          <polygon points={poly(ptsOut)} fill="none" stroke="#9d174d" strokeWidth={7} strokeLinejoin="round" />
          <polygon points={poly(ptsOut)} fill="none" stroke="#f472b6" strokeWidth={3.5} strokeLinejoin="round" />
          <polygon points={poly(ptsIn)} fill="#ffffff2e" stroke="#1e3a8a" strokeWidth={7} strokeLinejoin="round" />
          <polygon points={poly(ptsIn)} fill="none" stroke="#60a5fa" strokeWidth={3.5} strokeLinejoin="round" />
          <text x={0} y={10} fontSize={34} fill="#4c1d95" textAnchor="middle" stroke="#fff" strokeWidth={7} paintOrder="stroke" style={JUA}>{n}각형</text>
        </g>
        {ok && (
          <g className="ap-tw" pointerEvents="none">
            {[[-130, -150, 1], [140, -140, 0.8], [-150, 140, 0.7], [150, 150, 0.9]].map(([x, y, k], i) => (
              <path key={i} transform={`translate(${x} ${y}) scale(${k})`} d="M0 -14 L3.5 -3.5 L14 0 L3.5 3.5 L0 14 L-3.5 3.5 L-14 0 L-3.5 -3.5 Z" fill="#fde047" stroke="#f59e0b" strokeWidth={2} />
            ))}
          </g>
        )}
        {/* 손잡이: 반짝이는 별 */}
        <g
          role="slider"
          tabIndex={0}
          aria-label="변의 수 손잡이"
          aria-valuemin={6}
          aria-valuemax={96}
          aria-valuenow={n}
          aria-valuetext={`${n}각형`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") (e.preventDefault(), step(1));
            else if (e.key === "ArrowLeft" || e.key === "ArrowDown") (e.preventDefault(), step(-1));
          }}
        >
          <circle cx={hx} cy={hy} r={34} fill="transparent" />
          {n === 6 && !ok && <circle cx={hx} cy={hy} r={32} fill="#fde047" opacity={0.45} className="animate-pulse" pointerEvents="none" />}
          <g transform={`translate(${hx} ${hy})`} pointerEvents="none">
            <ellipse cx={0} cy={22} rx={16} ry={4} fill="#000" opacity={0.15} />
            <path d={STAR} fill="url(#ap-star)" stroke="#b45309" strokeWidth={3} strokeLinejoin="round" />
            <circle cx={-6} cy={-3} r={2.4} fill="#4c1d95" />
            <circle cx={6} cy={-3} r={2.4} fill="#4c1d95" />
            <path d="M-4 4 Q0 8 4 4" fill="none" stroke="#4c1d95" strokeWidth={2} strokeLinecap="round" />
          </g>
        </g>
      </svg>

      {/* 큰 값 두 개 */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center" aria-label="도형의 둘레 ÷ 지름">
        <div className="rounded-card border-2 border-[#93c5fd] bg-[#eff6ff] py-2 shadow-[0_4px_0_#93c5fd]">
          <div className="text-sm font-semibold text-[#1d4ed8]">🔷 안쪽(파랑) 둘레 ÷ 지름</div>
          <div className="font-game text-4xl tabular-nums text-[#1d4ed8]">{f2(floor2(lo))}</div>
        </div>
        <div className="rounded-card border-2 border-[#f9a8d4] bg-[#fdf2f8] py-2 shadow-[0_4px_0_#f9a8d4]">
          <div className="text-sm font-semibold text-[#be185d]">🩷 바깥(분홍) 둘레 ÷ 지름</div>
          <div className="font-game text-4xl tabular-nums text-[#be185d]">{f2(ceil2(hi))}</div>
        </div>
      </div>
      <p className="mt-2 text-center text-base">🥧 파이(원)의 둘레 ÷ 지름 = <strong className="font-game text-xl text-[#7c3aed]">3.14쯤</strong> 은 이 두 수 사이에 있어요!</p>

      <svg viewBox="0 0 400 74" className="mt-2 w-full rounded-card" role="img" aria-label={`원주율은 ${f2(floor2(lo))} 과 ${f2(ceil2(hi))} 사이에 있어요`}>
        <defs>
          <linearGradient id="ap-bar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#93c5fd" />
            <stop offset="1" stopColor="#f9a8d4" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={400} height={74} rx={16} fill="#faf5ff" />
        <line x1={20} x2={380} y1={44} y2={44} stroke="#ddd6fe" strokeWidth={6} strokeLinecap="round" />
        <rect x={bx(lo)} y={31} width={Math.max(4, bx(hi) - bx(lo))} height={26} rx={13} fill="url(#ap-bar)" stroke="#6b21a8" strokeWidth={2.5} />
        <line x1={bx(Math.PI)} x2={bx(Math.PI)} y1={22} y2={66} stroke="#7c3aed" strokeWidth={4} strokeLinecap="round" />
        <text x={bx(Math.PI)} y={18} fontSize={15} fill="#7c3aed" textAnchor="middle" style={JUA}>3.14쯤</text>
      </svg>

      <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>
      {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">💡 변이 많아질수록 도형이 원을 꼭 닮아서, 파랑 값은 커지고 분홍 값은 작아져요. 둘이 3.14 근처로 모여요!</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GButton className={BIG} onClick={() => step(-1)} disabled={n <= 6}>◀ 줄이기</GButton>
        <GButton variant="primary" className={BIG} onClick={() => step(1)} disabled={n >= 96}>늘리기 ▶</GButton>
        <GButton className={BIG} pressed={hint} onClick={() => setHint((v) => !v)}>💡 힌트</GButton>
        {last && ok ? <GButton variant="soft" className={BIG} onClick={reset}>🔄 한 번 더</GButton> : <GButton className={BIG} onClick={reset}>다시 하기</GButton>}
      </div>

      <details className="mt-4 rounded-card border border-line p-3">
        <summary className="cursor-pointer text-base font-bold">더 어려운 도전: 변의 수를 마음대로 바꿔요</summary>
        <div className="mt-2">
          <label className="flex min-h-[48px] flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold">
            <span>변의 수</span>
            <input type="range" min={3} max={96} step={1} value={n} onChange={(e) => apply(+e.target.value, false)} className="h-6 min-w-[8rem] flex-1 accent-[var(--accent)]" aria-label="변의 수" />
            <span className="w-14 text-right tabular-nums">{n}개</span>
          </label>
          <p className="mt-2 text-sm text-muted">자세한 값: 안쪽 {lo.toFixed(4)}, 바깥 {hi.toFixed(4)} (원주율은 3.14159…)</p>
        </div>
      </details>

      <p className="mt-4 rounded-card bg-bg p-3 text-base">
        📜 아주 옛날 그리스의 아르키메데스는 6각형에서 시작해 12, 24, 48, 96각형까지 변을 두 배씩 늘려서, 원주율이 3과 10/71보다 크고 3과 1/7보다 작다는 것을 알아냈어요.
      </p>
    </Board>
  );
}
