import { useState } from "react";
import { Board, GButton, Say, Stat } from "./kit";

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
export function makePoly(rnd: () => number, cx: number, cy: number): Pt[] {
  const n = 8 + Math.floor(rnd() * 6);
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

export function makePoint(rnd: () => number, poly: Pt[], wantInside: boolean): Pt | null {
  for (let t = 0; t < 600; t++) {
    const p: Pt = [25 + rnd() * 350, 20 + rnd() * 280];
    if (isInside(p, poly) !== wantInside) continue;
    let ok = true;
    for (let i = 0; i < poly.length && ok; i++) {
      if (distToSeg(p, poly[i], poly[(i + 1) % poly.length]) < 9) ok = false;
      if (Math.abs(poly[i][1] - p[1]) < 4) ok = false; // 반직선이 꼭짓점 높이를 스치지 않게
    }
    if (ok) return p;
  }
  return null;
}
// ==END==

const TOTAL = 10;
const W = 400;
const H = 320;

function newQ() {
  for (;;) {
    const poly = makePoly(Math.random, 200, 160);
    const want = Math.random() < 0.5;
    const pt = makePoint(Math.random, poly, want);
    if (pt) return { poly, pt };
  }
}

export default function InsideGame() {
  const [q, setQ] = useState(newQ);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [ans, setAns] = useState<null | "in" | "out">(null);
  const [hint, setHint] = useState(false);

  const hits = rayHits(q.pt, q.poly);
  const inside = hits.length % 2 === 1;
  const show = ans !== null || hint;
  const finished = ans !== null && idx === TOTAL - 1;
  const correct = ans !== null && (ans === "in") === inside;

  const answer = (a: "in" | "out") => {
    if (ans) return;
    setAns(a);
    if ((a === "in") === inside) setScore((s) => s + 1);
  };
  const next = () => {
    setQ(newQ());
    setIdx((i) => i + 1);
    setAns(null);
  };
  const restart = () => {
    setQ(newQ());
    setIdx(0);
    setScore(0);
    setAns(null);
  };

  const count = hits.length;
  const parity = count % 2 === 1 ? "홀수" : "짝수";
  const why = `점에서 오른쪽으로 뻗은 선이 곡선과 ${count}번 만나요${count === 0 ? "(한 번도 안 만나요)" : ""}. ${count}은(는) ${parity}이니까 ${inside ? "안" : "바깥"}이에요.`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="문제" value={`${idx + 1}/${TOTAL}`} />
        <Stat label="점수" value={score} tone="ok" />
      </div>

      <Board>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[560px] touch-none select-none rounded-card bg-bg" role="img" aria-label="닫힌 곡선과 빨간 점. 점이 곡선 안에 있는지 바깥에 있는지 맞혀요.">
          <polygon
            points={q.poly.map((p) => p.join(",")).join(" ")}
            fill={ans ? (inside ? "rgba(34,197,94,0.18)" : "none") : "none"}
            stroke="#4f46e5"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {show && (
            <g>
              <line x1={q.pt[0]} y1={q.pt[1]} x2={W - 4} y2={q.pt[1]} stroke="#f59e0b" strokeWidth="2" strokeDasharray="6 4" />
              <polygon points={`${W - 4},${q.pt[1]} ${W - 14},${q.pt[1] - 5} ${W - 14},${q.pt[1] + 5}`} fill="#f59e0b" />
              {hits.map((x, i) => (
                <g key={i}>
                  <circle cx={x} cy={q.pt[1]} r="8" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                  <text x={x} y={q.pt[1] + 4} fontSize="11" fontWeight="800" textAnchor="middle" fill="#fff">{i + 1}</text>
                </g>
              ))}
            </g>
          )}
          <circle cx={q.pt[0]} cy={q.pt[1]} r="9" fill="#ef4444" stroke="#fff" strokeWidth="2.5" />
        </svg>
        {hint && !ans && <p className="mt-2 text-center text-sm font-semibold">선이 곡선과 만나는 곳은 <span className="text-accent">{count}번</span>이에요. 이 수가 홀수인지 짝수인지 생각해 봐요.</p>}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <GButton variant="primary" disabled={!!ans} onClick={() => answer("in")} className="min-w-[96px]">
          안쪽이에요
        </GButton>
        <GButton variant="soft" disabled={!!ans} onClick={() => answer("out")} className="min-w-[96px]">
          바깥이에요
        </GButton>
        {ans && !finished && (
          <GButton variant="primary" onClick={next}>
            다음 문제
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} disabled={!!ans}>
          선 보기 {hint ? "끄기" : "켜기"}
        </GButton>
        <GButton onClick={restart}>다시 하기</GButton>
      </div>

      {!ans && <Say>빨간 점이 곡선 안에 있을까요, 바깥에 있을까요? 눈으로 보고 골라요. 어려우면 ‘선 보기’를 켜 봐요.</Say>}
      {ans && <Say tone={correct ? "ok" : "bad"}>{correct ? "정답이에요! " : "아쉬워요. "}{why}</Say>}
      {finished && (
        <Say tone={score >= 8 ? "ok" : "info"}>
          10문제 끝! {score}점이에요. {score >= 8 ? "눈썰미가 대단해요!" : "‘선 보기’로 홀짝 규칙을 써 보면 더 잘 맞힐 수 있어요."}
        </Say>
      )}
      <p className="text-xs text-muted">규칙: 점에서 한 방향(여기서는 오른쪽)으로 선을 그어 곡선과 만나는 횟수를 세요. 홀수면 안, 짝수면 바깥이에요.</p>
    </div>
  );
}
