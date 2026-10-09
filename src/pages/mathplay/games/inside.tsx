import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, stageClear, tick, useFrame, useStage } from "./kit";
import { BIG } from "./easykit";

// ==PURE==
export type Pt = [number, number];

/** 점 p에서 오른쪽(+x)으로 뻗은 반직선이 다각형과 만나는 x좌표들(작은 순서).
 *  꼭짓점을 지날 때는 ‘위쪽 끝점은 포함, 아래쪽 끝점은 제외’ 규칙으로 한 번만 센다. */
export function rayHits(p: Pt, poly: Pt[]): number[] {
  const xs: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (a[1] > p[1] !== b[1] > p[1]) {
      const x = a[0] + ((p[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      if (x > p[0]) xs.push(x);
    }
  }
  return xs.sort((u, v) => u - v);
}

/** 교점이 홀수 개면 안쪽 */
export const isInside = (p: Pt, poly: Pt[]) => rayHits(p, poly).length % 2 === 1;

export function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** 중심에서 본 각도 순서대로 꼭짓점을 잡으면 자기 자신과 교차하지 않는 별 모양 다각형이 된다 */
export function makePoly(rnd: () => number, cx: number, cy: number, nMin = 8, span = 6): Pt[] {
  const n = nMin + Math.floor(rnd() * span);
  const step = (Math.PI * 2) / n;
  const start = rnd() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const ang = start + i * step + (rnd() - 0.5) * step * 0.6;
    const r = 45 + rnd() * 100;
    pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
  }
  return pts;
}

export function makePoint(rnd: () => number, poly: Pt[], wantInside: boolean, margin = 9): Pt | null {
  for (let t = 0; t < 600; t++) {
    const p: Pt = [25 + rnd() * 350, 20 + rnd() * 280];
    if (isInside(p, poly) !== wantInside) continue;
    let ok = true;
    for (let i = 0; i < poly.length && ok; i++) {
      if (distToSeg(p, poly[i], poly[(i + 1) % poly.length]) < margin) ok = false;
      if (Math.abs(poly[i][1] - p[1]) < 4) ok = false; // 반직선이 꼭짓점 높이를 스치지 않게
    }
    if (ok) return p;
  }
  return null;
}
/** 레벨(1~10)별 규칙: 울타리 꼭짓점 수(nMin~nMin+span-1), 점과 울타리 사이 최소 거리, 최소 교차 횟수 */
export function levelSpec(level: number) {
  const L = Math.max(1, Math.min(10, level));
  return {
    nMin: [5, 6, 6, 7, 8, 9, 10, 11, 12, 12][L - 1],
    span: L <= 3 ? 2 : L <= 6 ? 3 : 4,
    margin: [24, 22, 20, 18, 16, 14, 12, 10, 9, 8][L - 1],
    minHits: L >= 8 ? 2 : L >= 5 ? 1 : 0,
  };
}

/** 레벨에 맞는 울타리와 점 하나(안/밖 반반) */
export function makeLevelQ(rnd: () => number, level: number): { poly: Pt[]; pt: Pt } {
  const sp = levelSpec(level);
  for (;;) {
    const poly = makePoly(rnd, 200, 160, sp.nMin, sp.span);
    const want = rnd() < 0.5;
    for (let k = 0; k < 20; k++) {
      const pt = makePoint(rnd, poly, want, sp.margin);
      if (pt && rayHits(pt, poly).length >= sp.minHits) return { poly, pt };
    }
  }
}
// ==END==

const ROUNDS = 3;
const W = 400;
const H = 320;
const WALK = 1.5; // 걸어가는 데 걸리는 시간(초)
const GF = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
/** 풀밭 장식(꽃·풀) */
const DECOR: [number, number, string][] = [[24, 30, "🌼"], [380, 28, "🌷"], [30, 300, "🌱"], [372, 304, "🌼"], [200, 14, "🌱"], [14, 160, "🌷"], [392, 170, "🌱"], [120, 312, "🌷"], [290, 312, "🌱"]];
const CSS = `
@keyframes in-hop { 0%,100% { transform: translateY(0); } 35% { transform: translateY(-14px); } 65% { transform: translateY(0); } 82% { transform: translateY(-5px); } }
@keyframes in-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } }
.in-hop { animation: in-hop .8s ease-out; transform-box: fill-box; transform-origin: center bottom; }
.in-shake { animation: in-shake .45s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .in-hop, .in-shake { animation: none; } }
`;

type Phase = "ask" | "walk" | "shown";

export default function InsideGame() {
  const timer = useRef(0);
  const finishedRef = useRef(false);
  const level = useStage();
  const [q, setQ] = useState(() => makeLevelQ(Math.random, level));
  const [score, setScore] = useState(0);
  const [ans, setAns] = useState<null | "in" | "out">(null);
  const [phase, setPhase] = useState<Phase>("ask");
  const [walkX, setWalkX] = useState(0);
  const [hint, setHint] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const hits = rayHits(q.pt, q.poly);
  const inside = hits.length % 2 === 1;
  const correct = ans !== null && (ans === "in") === inside;
  const passed = phase === "walk" ? hits.filter((x) => x <= walkX).length : hits.length;

  useFrame((t) => {
    const f = Math.min(1, t / WALK);
    setWalkX(q.pt[0] + (W - 4 - q.pt[0]) * f);
    if (f >= 1 && !finishedRef.current) {
      finishedRef.current = true;
      setPhase("shown");
      const ok = (ans === "in") === inside;
      if (ok) {
        cheer();
        const n = score + 1;
        setScore(n);
        if (n >= ROUNDS) {
          timer.current = window.setTimeout(stageClear, 1200);
          return;
        }
      } else oops();
      // 틀리면 같은 라운드에서 새 문제를 풀어요
      timer.current = window.setTimeout(next, ok ? 1800 : 3200);
    }
  }, phase === "walk");

  const answer = (a: "in" | "out") => {
    if (phase !== "ask") return;
    tick();
    finishedRef.current = false;
    setAns(a);
    setWalkX(q.pt[0]);
    setPhase("walk");
  };
  const next = () => {
    setQ(makeLevelQ(Math.random, level));
    setAns(null);
    setPhase("ask");
  };

  const showRay = hint || phase !== "ask";
  const rayEnd = phase === "walk" ? walkX : W - 4;
  const why = `양이 오른쪽으로 걸어가면 울타리를 ${hits.length === 0 ? "한 번도 안 넘어요" : `${hits.length}번 넘어요`}. ${hits.length % 2 === 1 ? "홀수 번(1, 3, 5…)이면 안에 있어요" : "0번이나 짝수 번(2, 4…)이면 밖에 있어요"}. 그래서 ${inside ? "안" : "밖"}이에요!`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(score + 1, ROUNDS)}/${ROUNDS}`} />
      </div>

      <Board>
        <style>{CSS}</style>
        <p className="font-game mb-2 text-center text-2xl">🐑 양은 울타리 안에 있을까요, 밖에 있을까요?</p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[560px] touch-none select-none overflow-hidden rounded-card" role="img" aria-label="울타리와 양. 양이 울타리 안에 있는지 밖에 있는지 맞혀요.">
          <defs>
            <linearGradient id="in-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#bbf7d0" />
              <stop offset="1" stopColor="#4ade80" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="url(#in-grass)" />
          {DECOR.map(([x, y, e], i) => (
            <text key={i} x={x} y={y} fontSize="13" textAnchor="middle" opacity="0.75">{e}</text>
          ))}
          {/* 울타리 안 마당(맞힌 뒤에 보여요) */}
          <polygon points={q.poly.map((p) => p.join(",")).join(" ")} fill={phase === "shown" && inside ? "#fef3c7" : "rgba(255,255,255,0.12)"} />
          {/* 울타리: 굵은 나무 + 말뚝 */}
          <polygon points={q.poly.map((p) => p.join(",")).join(" ")} fill="none" stroke="#7c3f12" strokeWidth="9" strokeLinejoin="round" />
          <polygon points={q.poly.map((p) => p.join(",")).join(" ")} fill="none" stroke="#d6923a" strokeWidth="4.5" strokeLinejoin="round" />
          <polygon points={q.poly.map((p) => p.join(",")).join(" ")} fill="none" stroke="#7c3f12" strokeWidth="9" strokeLinejoin="round" strokeDasharray="3 15" />
          {showRay && (
            <g>
              <line x1={q.pt[0]} y1={q.pt[1]} x2={rayEnd} y2={q.pt[1]} stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
              {Array.from({ length: Math.max(0, Math.floor((rayEnd - q.pt[0] - 16) / 22)) }, (_, i) => (
                <text key={i} x={q.pt[0] + 26 + i * 22} y={q.pt[1] + (i % 2 ? 9 : -2)} fontSize="11" textAnchor="middle" opacity="0.85">🐾</text>
              ))}
              {hits.map((x, i) => (
                <g key={i} opacity={x <= rayEnd ? 1 : 0}>
                  <circle cx={x} cy={q.pt[1]} r="12" fill="#e8552f" stroke="#fff" strokeWidth="3" />
                  <text x={x} y={q.pt[1] + 5} fontSize="15" textAnchor="middle" fill="#fff" style={GF}>{i + 1}</text>
                </g>
              ))}
            </g>
          )}
          {phase === "walk" && <text x={walkX} y={q.pt[1] - 14} fontSize="24" textAnchor="middle">🐕</text>}
          {/* 양(정확한 위치는 가운데 점) */}
          <g key={`sheep${q.pt[0]}${phase}`} className={phase === "shown" ? (correct ? "in-hop" : "in-shake") : ""}>
            <circle cx={q.pt[0]} cy={q.pt[1]} r="17" fill="#fff" stroke="#e8552f" strokeWidth="3" />
            <text x={q.pt[0]} y={q.pt[1] + 8} fontSize="22" textAnchor="middle">🐑</text>
            <circle cx={q.pt[0]} cy={q.pt[1]} r="3" fill="#e8552f" />
          </g>
        </svg>
        <p className="font-game mt-2 min-h-[2.25rem] text-center text-xl" aria-live="polite">
          {phase === "ask" && hint && <>오른쪽으로 걸으면 울타리를 <span className="text-accent">{hits.length}번</span> 넘어요.</>}
          {phase !== "ask" && <>울타리를 넘은 횟수: <span className="text-3xl text-accent tabular-nums">{passed}</span>번</>}
        </p>
      </Board>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={phase !== "ask"}
          onClick={() => answer("out")}
          className={`min-h-[72px] touch-manipulation rounded-card border-2 text-xl font-extrabold transition active:scale-[0.98] disabled:opacity-50 ${ans === "out" ? "border-accent bg-accent text-accent-ink" : "border-accent bg-accent-soft text-accent"}`}
        >
          🌾 밖에 있어요
        </button>
        <button
          type="button"
          disabled={phase !== "ask"}
          onClick={() => answer("in")}
          className={`min-h-[72px] touch-manipulation rounded-card border-2 text-xl font-extrabold transition active:scale-[0.98] disabled:opacity-50 ${ans === "in" ? "border-accent bg-accent text-accent-ink" : "border-accent bg-accent-soft text-accent"}`}
        >
          🏡 안에 있어요
        </button>
      </div>

      {phase === "ask" && <Say>양이 울타리 안이면 오른쪽 단추, 밖이면 왼쪽 단추를 눌러요. 어려우면 ‘길 보기’ 힌트!</Say>}
      {phase === "walk" && <Say>양이 오른쪽으로 걸어가며 울타리를 세고 있어요…</Say>}
      {phase === "shown" && <Say tone={correct ? "ok" : "bad"}>{correct ? "정답이에요! 잘했어요! ⭐ " : "아쉬워요, 괜찮아요! "}{why}</Say>}
      <div className="flex flex-wrap gap-2">
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} disabled={phase !== "ask"} className={BIG}>
          힌트: 길 보기 {hint ? "끄기" : "켜기"}
        </GButton>
      </div>
      <p className="text-base text-muted">비밀 규칙: 양이 오른쪽으로 쭉 걸어가며 울타리를 몇 번 넘는지 세요. 홀수 번이면 안, 짝수 번이면 밖이에요.</p>
    </div>
  );
}
