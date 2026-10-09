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
// ==END==

const TOTAL = 5;
const W = 400;
const H = 320;

function newQ(hard: boolean) {
  for (;;) {
    const poly = hard ? makePoly(Math.random, 200, 160, 10, 4) : makePoly(Math.random, 200, 160, 6, 3);
    const want = Math.random() < 0.5;
    const pt = makePoint(Math.random, poly, want, hard ? 9 : 18);
    if (pt) return { poly, pt };
  }
}

export default function InsideGame() {
  const [q, setQ] = useState(() => newQ(false));
  const [hard, setHard] = useState(false);
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
    setQ(newQ(hard));
    setIdx((i) => i + 1);
    setAns(null);
  };
  const restart = (h = hard) => {
    setQ(newQ(h));
    setIdx(0);
    setScore(0);
    setAns(null);
  };

  const count = hits.length;
  const why = `점에서 오른쪽으로 걸어가면 선을 ${count === 0 ? "한 번도 안 건너요" : `${count}번 건너요`}. ${count % 2 === 1 ? "홀수 번(1, 3, 5…)이면 안에 있어요" : "0번이나 짝수 번(2, 4…)이면 밖에 있어요"}. 그래서 ${inside ? "안" : "밖"}이에요!`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="문제" value={`${idx + 1}/${TOTAL}`} />
        <Stat label="점수" value={score} tone="ok" />
      </div>

      <Board>
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[560px] touch-none select-none rounded-card bg-bg" role="img" aria-label="닫힌 선과 빨간 점. 점이 선 안에 있는지 밖에 있는지 맞혀요.">
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
        {hint && !ans && <p className="mt-2 text-center text-base font-semibold">오른쪽으로 걸으면 선을 <span className="text-accent">{count}번</span> 건너요. 홀수 번이면 안, 짝수 번이면 밖이에요!</p>}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <GButton variant="primary" disabled={!!ans} onClick={() => answer("in")} className="min-w-[96px]">
          안에 있어요
        </GButton>
        <GButton variant="soft" disabled={!!ans} onClick={() => answer("out")} className="min-w-[96px]">
          밖에 있어요
        </GButton>
        {ans && !finished && (
          <GButton variant="primary" onClick={next}>
            다음 문제
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} disabled={!!ans}>
          힌트: 길 보기 {hint ? "끄기" : "켜기"}
        </GButton>
        <GButton onClick={() => restart()}>다시 하기</GButton>
        <GButton pressed={hard} onClick={() => { const h = !hard; setHard(h); restart(h); }}>더 어려운 도전</GButton>
      </div>

      {!ans && <Say>빨간 점이 선 안에 있을까요, 밖에 있을까요? 골라 보세요. 어려우면 ‘힌트: 길 보기’를 눌러요!</Say>}
      {ans && <Say tone={correct ? "ok" : "bad"}>{correct ? "정답이에요! 잘했어요! ⭐ " : "아쉬워요, 괜찮아요! "}{why}</Say>}
      {finished && (
        <Say tone={score >= 4 ? "ok" : "info"}>
          {TOTAL}문제 끝! {score}문제 맞혔어요. {score >= 4 ? "대단해요! 눈썰미가 최고예요!" : "잘했어요! ‘길 보기’ 힌트를 쓰면 더 잘 맞힐 수 있어요."}
        </Say>
      )}
      <p className="text-base text-muted">비밀 규칙: 점에서 오른쪽으로 걸으며 선을 몇 번 건너는지 세요. 홀수 번이면 안, 짝수 번이면 밖이에요.</p>
    </div>
  );
}
