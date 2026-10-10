import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, stageClear, svgPoint, tick, useFrame, useStage } from "./kit";
import { BIG, Stars } from "./easykit";

// ==PURE==
/** 경첩(hx,hy)에서 포인터(px,py)를 본 각도(0~180°). 화면 y는 아래로 늘어나므로 방 쪽(아래)이 +각도. */
export function angleFromPoint(hx: number, hy: number, px: number, py: number): number {
  const a = (Math.atan2(py - hy, px - hx) * 180) / Math.PI;
  if (a >= 0) return a;
  return a < -90 ? 180 : 0;
}

const range = (from: number, to: number, step: number) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

/** 레벨(1~10)별 규칙: 목표 각도 모음, 각도기를 쓸 수 있는지, 목표 별 표시, 통과 오차(도) */
export function levelSpec(level: number): { pool: number[]; prot: boolean; marker: boolean; tol: number } {
  const L = Math.max(1, Math.min(10, level));
  const pool =
    L <= 2 ? [30, 45, 60, 90] : L === 3 ? range(15, 90, 15) : L === 4 ? range(15, 165, 15) : L <= 6 ? range(10, 170, 10) : range(5, 175, 5);
  const tol = [10, 10, 9, 8, 7, 6, 14, 12, 10, 8][L - 1];
  return { pool, prot: L <= 6, marker: L <= 4, tol };
}

/** 오차에 따른 별: 통과 오차의 1/3 이내 3개, 통과 오차 이내 2개(통과), 그 밖은 1개(다시) */
export function starsFor(err: number, tol: number): number {
  const e = Math.abs(err);
  return e <= tol / 3 ? 3 : e <= tol ? 2 : 1;
}

export function pickGoal(level: number, prev: number, rnd: () => number = Math.random): number {
  const { pool } = levelSpec(level);
  for (;;) {
    const g = pool[Math.floor(rnd() * pool.length)];
    if (g !== prev || pool.length === 1) return g;
  }
}
// ==END==

const ROUNDS = 3;
const HX = 210;
const HY = 40;
const L = 150; // 문 길이
const R = 118; // 각도기 반지름
const rad = (d: number) => (d * Math.PI) / 180;
const GF = { fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" };
/** 별 모양 경로(가운데 0,0) */
const starPath = (ro: number, ri: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? ri : ro;
    const t = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${i ? "L" : "M"} ${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`;
  }).join(" ") + " Z";
const CSS = `
@keyframes dg-bounce { 0%,100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-12px) scale(1.12); } 60% { transform: translateY(0) scale(.96); } 80% { transform: translateY(-4px); } }
@keyframes dg-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
.dg-bounce { animation: dg-bounce .8s ease-out; transform-box: fill-box; transform-origin: center bottom; }
.dg-shake { animation: dg-shake .45s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .dg-bounce, .dg-shake { animation: none; } }
`;
const pol = (r: number, d: number): [number, number] => [HX + r * Math.cos(rad(d)), HY + r * Math.sin(rad(d))];

export default function DoorAngleGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const timer = useRef(0);
  const level = useStage();
  const spec = levelSpec(level);
  const [goal, setGoal] = useState(() => pickGoal(level, -1));
  const [round, setRound] = useState(0); // 깬 라운드 수(0~3)
  const [stars, setStars] = useState<number[]>([]);
  const [judged, setJudged] = useState(false);
  const [touched, setTouched] = useState(false);
  const [target, setTarget] = useState(0); // 내가 정한 각도
  const [cur, setCur] = useState(0); // 화면에 그려지는 각도(부드럽게 따라감)
  const [prot, setProt] = useState(spec.prot);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);
  const [react, setReact] = useState<{ kind: "" | "ok" | "bad"; n: number }>({ kind: "", n: 0 });

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useFrame((_, dt) => {
    setCur((c) => {
      const d = target - c;
      return Math.abs(d) < 0.05 ? target : c + d * Math.min(1, dt * 14);
    });
  }, Math.abs(cur - target) > 0.05);

  const total = stars.reduce((a, b) => a + b, 0);
  const reading = Math.round(target);
  const showProt = (spec.prot && prot) || judged;
  const lastStar = judged ? stars[stars.length - 1] : 0;

  const setFromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setTarget(angleFromPoint(HX, HY, x, y));
  };
  const decide = (a = reading) => {
    const err = a - goal;
    const s = starsFor(err, spec.tol);
    const pass = s >= 2;
    setStars((v) => [...v, s]);
    setJudged(true);
    if (pass) cheer();
    else oops();
    setReact((r) => ({ kind: pass ? "ok" : "bad", n: r.n + 1 }));
    const diff = err === 0 ? "딱 맞았어요!" : `${Math.abs(err)}° ${err > 0 ? "더 열었어요" : "덜 열었어요"}.`;
    const cheerTxt = s === 3 ? "최고예요!" : s === 2 ? "아주 잘했어요!" : `괜찮아요! ${spec.tol}° 안으로 맞추면 통과예요. 다시 해 봐요!`;
    setMsg({ tone: pass ? "ok" : "bad", text: `목표 ${goal}°, 내 문은 ${a}° → ${diff} ${cheerTxt}` });
    const done = round + (pass ? 1 : 0);
    if (pass) setRound(done);
    if (done >= ROUNDS) {
      timer.current = window.setTimeout(stageClear, 1200);
      return;
    }
    timer.current = window.setTimeout(() => {
      if (pass) setGoal((g) => pickGoal(level, g));
      setJudged(false);
      setTarget(0);
      setMsg(null);
    }, pass ? 2000 : 2400);
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (judged) return;
    drag.current = true;
    setTouched(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPointer(e);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag.current && !judged) setFromPointer(e);
  };
  const up = () => {
    if (!drag.current) return;
    drag.current = false;
    if (!judged) decide();
  };
  const cancel = () => {
    drag.current = false;
  };
  const key = (e: React.KeyboardEvent) => {
    if (judged) return;
    setTouched(true);
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      decide();
      return;
    }
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? -1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? 1 : 0;
    if (step) {
      e.preventDefault();
      setTarget((t) => clamp(Math.round(t) + step * (e.shiftKey ? 10 : 1), 0, 180));
      tick();
    }
  };

  const a = clamp(cur, 0, 179.99);
  const tip = pol(L, a);
  const ticks: number[] = [];
  for (let d = 0; d <= 180; d += 5) ticks.push(d);
  const gm = pol(R, goal);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(round + (judged && round >= ROUNDS ? 0 : 1), ROUNDS)}/${ROUNDS}`} />
        <Stat label="별" value={total} tone="ok" />
        <Stat label="통과" value={`±${spec.tol}°`} />
      </div>

      <Board>
        <style>{CSS}</style>
        <p className="font-game mb-2 text-center text-2xl">
          문을 <span className="text-accent">{goal}°</span> 만큼 열어요
        </p>
        <svg
          ref={svgRef}
          viewBox="0 0 420 215"
          className="mx-auto block w-full max-w-[640px] touch-none select-none overflow-hidden rounded-card"
          style={{ touchAction: "none", cursor: judged ? "default" : "grab" }}
          role="slider"
          tabIndex={0}
          aria-label="문 열기. 끌어서 문을 열고 손을 떼면 점수가 나와요. 화살표 키로 조절하고 엔터로 정해요."
          aria-valuemin={0}
          aria-valuemax={180}
          aria-valuenow={reading}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={cancel}
          onKeyDown={key}
        >
          <defs>
            <linearGradient id="dg-floor" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f8d9a8" />
              <stop offset="1" stopColor="#eab676" />
            </linearGradient>
            <linearGradient id="dg-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c4b5fd" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="dg-door" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="1" stopColor="#0284c7" />
            </linearGradient>
            <radialGradient id="dg-knob" cx="0.35" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#fff7c2" />
              <stop offset="1" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
          {/* 마룻바닥 */}
          <rect x="0" y={HY} width="420" height="175" fill="url(#dg-floor)" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1="0" y1={HY + 14 + i * 28} x2="420" y2={HY + 14 + i * 28} stroke="#d39b5c" strokeWidth="1.5" opacity="0.55" />
          ))}
          {[30, 120, 260, 350, 80, 190, 310].map((x, i) => (
            <line key={`v${i}`} x1={x} y1={HY + 14 + (i % 6) * 28} x2={x} y2={HY + 42 + (i % 6) * 28} stroke="#d39b5c" strokeWidth="1.5" opacity="0.55" />
          ))}
          {/* 동그란 러그 */}
          <ellipse cx="370" cy="178" rx="38" ry="22" fill="#fda4af" stroke="#e11d48" strokeWidth="2.5" />
          <ellipse cx="370" cy="178" rx="24" ry="13" fill="#fecdd3" />
          <path d={`M ${HX + L} ${HY} A ${L} ${L} 0 0 1 ${HX - L} ${HY}`} fill="none" stroke="#b7793a" strokeWidth="1.5" strokeDasharray="4 5" />
          {/* 벽 */}
          <rect x="-6" y={HY - 16} width={HX + 6} height="16" rx="4" fill="url(#dg-wall)" stroke="#6d28d9" strokeWidth="2.5" />
          <rect x={HX + L} y={HY - 16} width={420 - HX - L + 6} height="16" rx="4" fill="url(#dg-wall)" stroke="#6d28d9" strokeWidth="2.5" />
          {[20, 60, 100, 140, 180, 385].map((x) => (
            <circle key={x} cx={x} cy={HY - 8} r="2.5" fill="#fff" opacity="0.8" />
          ))}
          {/* 문틀 */}
          <rect x={HX - 6} y={HY - 18} width="12" height="24" rx="4" fill="#f472b6" stroke="#be185d" strokeWidth="2" />
          <rect x={HX + L - 6} y={HY - 18} width="12" height="24" rx="4" fill="#f472b6" stroke="#be185d" strokeWidth="2" />
          {/* 고양이 친구: 맞히면 통통 */}
          <text key={`cat${react.n}`} x="34" y="200" fontSize="30" textAnchor="middle" className={react.kind === "ok" ? "dg-bounce" : react.kind === "bad" ? "dg-shake" : ""}>
            🐱
          </text>
          <text x="400" y="80" fontSize="24" textAnchor="middle">🪴</text>

          {showProt && (
            <g aria-hidden="true">
              <path d={`M ${HX + R} ${HY} A ${R} ${R} 0 0 1 ${HX - R} ${HY} Z`} fill="rgba(255,255,255,0.72)" />
              {["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6"].map((c, i) => {
                const r = R - 3 - i * 5;
                return <path key={c} d={`M ${HX + r} ${HY} A ${r} ${r} 0 0 1 ${HX - r} ${HY}`} fill="none" stroke={c} strokeWidth="5" opacity="0.85" />;
              })}
              {ticks.map((d) => {
                const len = d % 10 === 0 ? 12 : 6;
                const [x1, y1] = pol(R, d);
                const [x2, y2] = pol(R - len, d);
                return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b0764" strokeWidth={d % 30 === 0 ? 2 : 1} strokeLinecap="round" />;
              })}
              {[0, 30, 60, 90, 120, 150, 180].map((d) => {
                const [x, y] = pol(R - 44, d);
                return (
                  <text key={d} x={x} y={y + 5} fontSize="15" textAnchor="middle" fill="#3b0764" style={GF}>
                    {d}
                  </text>
                );
              })}
              <path d={`M ${HX + R} ${HY} A ${R} ${R} 0 0 1 ${HX - R} ${HY}`} fill="none" stroke="#7c3aed" strokeWidth="2.5" />
              {a > 0.5 && <path d={`M ${HX} ${HY} L ${pol(30, 0)[0]} ${pol(30, 0)[1]} A 30 30 0 0 1 ${pol(30, a)[0]} ${pol(30, a)[1]} Z`} fill="rgba(250,204,21,0.75)" stroke="#ca8a04" strokeWidth="1.5" />}
            </g>
          )}
          {/* 목표: 반짝이는 별 */}
          {((showProt && spec.marker) || judged) && (
            <g aria-hidden="true">
              <line x1={HX} y1={HY} x2={gm[0]} y2={gm[1]} stroke="#16a34a" strokeWidth="2.5" strokeDasharray="5 4" />
              <g transform={`translate(${gm[0]} ${gm[1]})`}>
                <path d={starPath(13, 6)} fill="#facc15" stroke="#b45309" strokeWidth="2" strokeLinejoin="round">
                  <animateTransform attributeName="transform" type="scale" values="1;1.18;1" dur="1.4s" repeatCount="indefinite" />
                </path>
              </g>
            </g>
          )}

          {/* 문 */}
          <g key={`door${react.n}`} className={react.kind === "bad" ? "dg-shake" : ""}>
            <g transform={`rotate(${a} ${HX} ${HY})`}>
              <rect x={HX + 2} y={HY + 3} width={L - 2} height="12" rx="6" fill="rgba(0,0,0,0.15)" />
              <rect x={HX} y={HY - 6} width={L} height="13" rx="6" fill="url(#dg-door)" stroke="#075985" strokeWidth="2.5" />
              <rect x={HX + 18} y={HY - 3} width={L - 40} height="6" rx="3" fill="#bae6fd" opacity="0.8" />
              <circle cx={HX + L - 16} cy={HY} r="7" fill="url(#dg-knob)" stroke="#b45309" strokeWidth="2" />
            </g>
            <circle cx={tip[0]} cy={tip[1]} r="14" fill="#fff" fillOpacity="0.55" stroke="#075985" strokeWidth="2" />
            {!touched && !judged && (
              <g aria-hidden="true">
                <circle cx={tip[0]} cy={tip[1]} r="14" fill="none" stroke="#e8552f" strokeWidth="3">
                  <animate attributeName="r" values="14;28;14" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <text x={tip[0] - 4} y={tip[1] + 40} fontSize="22" textAnchor="middle">
                  👆
                  <animateTransform attributeName="transform" type="translate" values="0,0;-70,50;0,0" dur="2.4s" repeatCount="indefinite" />
                </text>
              </g>
            )}
          </g>
          <circle cx={HX} cy={HY} r="7" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
          <text x={HX + 12} y={HY - 22} fontSize="13" fill="#5b21b6" style={GF}>경첩</text>
          {(showProt || judged) && (
            <g aria-hidden="true" key={`badge${react.n}`} className={react.kind === "ok" ? "dg-bounce" : ""}>
              <rect x="8" y="54" width="76" height="40" rx="14" fill="#e8552f" stroke="#9a2d14" strokeWidth="2.5" />
              <text x="46" y="83" fontSize="26" textAnchor="middle" fill="#fff" style={GF}>{reading}°</text>
            </g>
          )}
        </svg>
        <p className="mt-2 text-center text-base text-muted">
          {judged ? <Stars n={lastStar} /> : showProt && spec.marker ? "별까지 문을 끌고, 손을 떼면 점수가 나와요!" : showProt ? "눈금을 읽으며 문을 끌고, 손을 떼면 점수가 나와요!" : "각도기가 꺼져 있어요. 문을 끌고 손을 떼면 점수가 나와요!"}
        </p>
      </Board>

      {msg && <Say tone={msg.tone}>{msg.text}</Say>}
      {spec.prot && (
        <div className="flex flex-wrap gap-2">
          <GButton pressed={prot} onClick={() => setProt((p) => !p)} className={BIG} title="각도기를 켜면 눈금으로 각도를 읽을 수 있어요">
            각도기 {prot ? "끄기" : "켜기"}
          </GButton>
        </div>
      )}
      {!spec.prot && <p className="text-base text-muted">이 레벨은 각도기 없이 눈으로 어림해요. 직각(90°)과 일직선(180°)을 떠올려 봐요!</p>}
    </div>
  );
}
