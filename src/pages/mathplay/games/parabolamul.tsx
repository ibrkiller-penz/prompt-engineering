import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Slider, Stat, cheer, clamp, oops, rand, stageClear, svgPoint, useStage } from "./kit";

// <pure>
/** y = x² 위의 두 점 (a, a²), (−b, b²) 를 잇는 직선: 기울기와 y절편 */
function chord(a: number, b: number) {
  const x1 = a;
  const x2 = -b;
  if (x1 === x2) {
    // 두 점이 겹치면 접선
    return { slope: 2 * a, intercept: -a * a, tangent: true };
  }
  const slope = (x2 * x2 - x1 * x1) / (x2 - x1);
  const intercept = x1 * x1 - slope * x1;
  return { slope, intercept, tangent: false };
}
// </pure>

const VW = 660;
const VH = 460;
const OX = 330;
const OY = 232;
const SX = 56;
const SY = 8.2;
const px = (x: number) => OX + SX * x;
const py = (y: number) => OY - SY * y;
const half = (v: number) => Math.round(v * 2) / 2;
const fmt = (v: number) => (Math.round(v * 100) / 100).toString();

type Quest = { kind: "compute"; a: number; b: number } | { kind: "find"; target: number };

/** 레벨이 오를수록: 양의 정수 → 0·음수 → 0.5 단위 곱 */
function newQuest(level: number): Quest {
  const L = Math.min(10, Math.max(1, level));
  if (rand(2) === 0) {
    const m = Math.min(5, 2 + L);
    let a = 0;
    let b = 0;
    while (a === 0 || b === 0) {
      a = L <= 3 ? 1 + rand(m) : rand(2 * m + 1) - m;
      b = L <= 3 ? 1 + rand(m) : rand(2 * m + 1) - m;
      if (L >= 4 && L <= 6 && rand(6) === 0) return { kind: "compute", a: rand(5) + 1, b: 0 };
    }
    return { kind: "compute", a, b };
  }
  const pool = L <= 3 ? [2, 3, 4, 6, 8, 9, 10, 12] : L <= 6 ? [12, 15, 16, 20, -4, -6, -8, -10, -12, 0] : [2.5, -2.5, 4.5, -7.5, 0.25, 12.5, 6.25, -20, 25];
  return { kind: "find", target: pool[rand(pool.length)] };
}

export default function ParabolaMulGame() {
  const [a, setA] = useState(3);
  const [b, setB] = useState(2);
  const level = useStage();
  const [quest, setQuest] = useState<Quest>(() => newQuest(level));
  const [round, setRound] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [ans, setAns] = useState("");
  const [score, setScore] = useState({ ok: 0, tries: 0 });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "점을 끌거나 슬라이더로 a, b 를 정해 보세요. 직선이 세로축과 만나는 곳이 a × b 예요." });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<"a" | "b" | null>(null);

  const { slope, intercept, tangent } = chord(a, b);
  const prod = a * b;
  const x1 = a;
  const x2 = -b;

  const onMove = (cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg || !drag.current) return;
    const [sx] = svgPoint(svg, cx, cy);
    const v = clamp(half((sx - OX) / SX), -5, 5);
    if (drag.current === "a") setA(v);
    else setB(-v);
  };

  const result = (ok: boolean) => {
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), tries: s.tries + 1 }));
    if (ok) {
      cheer();
      setCleared(true);
    } else oops();
  };
  // 맞히면 잠깐 뒤 다음 문제, 3문제를 풀면 레벨 클리어
  useEffect(() => {
    if (!cleared) return;
    if (round >= 2) {
      const id = setTimeout(stageClear, 1200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      setRound((r) => r + 1);
      setCleared(false);
      setQuest(newQuest(level));
      setAns("");
      setMsg({ t: "info", s: "다음 문제예요!" });
    }, 1500);
    return () => clearTimeout(id);
  }, [cleared, round, level]);

  const check = () => {
    if (cleared) return;
    if (quest.kind === "compute") {
      const v = parseFloat(ans.replace(",", "."));
      const same = (a === quest.a && b === quest.b) || (a === quest.b && b === quest.a);
      if (!same) {
        setMsg({ t: "info", s: `먼저 a = ${quest.a}, b = ${quest.b} (또는 반대로)로 맞춰 놓고 직선이 세로축과 만나는 값을 읽어 봐요.` });
        return;
      }
      if (!isFinite(v)) {
        setMsg({ t: "bad", s: "세로축과 만나는 값을 숫자로 써 주세요." });
        return;
      }
      const ok = Math.abs(v - quest.a * quest.b) < 1e-9;
      result(ok);
      setMsg(ok ? { t: "ok", s: `맞아요! ${quest.a} × ${quest.b} = ${quest.a * quest.b}. 포물선과 직선만으로 곱셈을 했어요.` } : { t: "bad", s: "아쉬워요. 빨간 점이 세로축에서 가리키는 눈금을 다시 읽어 봐요." });
    } else {
      const ok = Math.abs(prod - quest.target) < 1e-9;
      result(ok);
      setMsg(ok ? { t: "ok", s: `맞아요! ${fmt(a)} × ${fmt(b)} = ${fmt(prod)} 예요. 곱이 ${quest.target} 이 되는 짝은 여러 개 있어요.` } : { t: "bad", s: `지금은 ${fmt(a)} × ${fmt(b)} = ${fmt(prod)} 이에요. 빨간 점이 ${quest.target} 에 오도록 해 봐요.` });
    }
  };
  const next = () => {
    if (cleared) return;
    setQuest(newQuest(level));
    setAns("");
    setMsg({ t: "info", s: "새 문제예요!" });
  };
  const reset = () => {
    setA(3);
    setB(2);
    setAns("");
    setMsg({ t: "info", s: "처음 모양으로 돌렸어요." });
  };

  let note = "";
  if (a === 0 || b === 0) note = "0 을 곱하면 0 이에요. 한 점이 원점에 놓여서 직선이 원점을 지나요.";
  else if (tangent) note = "두 점이 하나로 겹쳤어요. 이때 직선은 포물선에 닿는 접선이고, 곱 a × (−a) = −a² 를 가리켜요.";
  else if (prod < 0) note = "곱이 음수예요. 두 점이 같은 쪽에 있고, 직선이 세로축 아래에서 만나요.";
  else if (a === b) note = "a 와 b 가 같으면 두 점이 세로축에 대칭이고 직선이 수평이에요. 만나는 값은 제곱 a² 이에요.";
  else note = "곱이 양수예요. 두 점이 세로축 양쪽에 있고 직선은 세로축 위쪽에서 만나요.";

  // 직선 그리기 (x=-5.5..5.5)
  const lx0 = -5.5;
  const lx1 = 5.5;
  const parab: string[] = [];
  for (let x = -5.2; x <= 5.2001; x += 0.1) parab.push(`${px(x).toFixed(1)},${py(x * x).toFixed(1)}`);

  const stepBtn = (label: string, val: number, set: (v: number) => void, delta: number) => (
    <GButton onClick={() => set(clamp(half(val + delta), -5, 5))} className="!px-0 w-11" title={label}>
      {delta > 0 ? "+" : "−"}
    </GButton>
  );

  return (
    <div className="space-y-3">
      <Board>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          width="100%"
          role="img"
          aria-label="포물선 y=x² 과 두 점을 잇는 직선, 세로축과 만나는 점"
          className="block w-full select-none rounded-card bg-bg"
          style={{ touchAction: "none" }}
          onPointerMove={(e) => onMove(e.clientX, e.clientY)}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* 눈금 */}
          {Array.from({ length: 11 }, (_, i) => i - 5).map((x) => (
            <g key={x}>
              <line x1={px(x)} y1={OY - 4} x2={px(x)} y2={OY + 4} stroke="#94a3b8" />
              {x !== 0 && (
                <text x={px(x)} y={OY + 18} fontSize={11} textAnchor="middle" fill="#64748b">
                  {x}
                </text>
              )}
            </g>
          ))}
          {[-25, -20, -15, -10, -5, 5, 10, 15, 20, 25].map((y) => (
            <g key={y}>
              <line x1={OX - 4} y1={py(y)} x2={OX + 4} y2={py(y)} stroke="#94a3b8" />
              <text x={OX + 8} y={py(y) + 4} fontSize={11} fill="#64748b">
                {y}
              </text>
            </g>
          ))}
          <line x1={10} y1={OY} x2={VW - 10} y2={OY} stroke="#94a3b8" strokeWidth={1.5} />
          <line x1={OX} y1={8} x2={OX} y2={VH - 8} stroke="#94a3b8" strokeWidth={1.5} />
          <polyline points={parab.join(" ")} fill="none" stroke="#0284c7" strokeWidth={2.5} />
          <text x={px(3.6)} y={py(14.5)} fontSize={13} fill="#0284c7" fontWeight={700}>
            y = x²
          </text>
          {/* 직선 */}
          <line x1={px(lx0)} y1={py(slope * lx0 + intercept)} x2={px(lx1)} y2={py(slope * lx1 + intercept)} stroke="#f59e0b" strokeWidth={2.5} />
          {/* 절편 점 */}
          <circle cx={OX} cy={py(intercept)} r={7} fill="#ef4444" stroke="#fff" strokeWidth={2} />
          <text x={OX - 12} y={py(intercept) - 10} textAnchor="end" fontSize={14} fontWeight={800} fill="#ef4444">
            {fmt(intercept)}
          </text>
          {/* 끌 수 있는 두 점 */}
          <g onPointerDown={(e) => { drag.current = "a"; (e.currentTarget as Element).setPointerCapture(e.pointerId); }} style={{ cursor: "grab" }} role="slider" aria-label="점 A 의 가로 위치 a" aria-valuenow={a} aria-valuemin={-5} aria-valuemax={5}>
            <circle cx={px(x1)} cy={py(x1 * x1)} r={20} fill="transparent" />
            <circle cx={px(x1)} cy={py(x1 * x1)} r={8} fill="#16a34a" stroke="#fff" strokeWidth={2} />
            <text x={px(x1)} y={py(x1 * x1) - 13} textAnchor="middle" fontSize={13} fontWeight={800} fill="#16a34a">
              a={fmt(a)}
            </text>
          </g>
          <g onPointerDown={(e) => { drag.current = "b"; (e.currentTarget as Element).setPointerCapture(e.pointerId); }} style={{ cursor: "grab" }} role="slider" aria-label="점 B 의 가로 위치 −b" aria-valuenow={-b} aria-valuemin={-5} aria-valuemax={5}>
            <circle cx={px(x2)} cy={py(x2 * x2)} r={20} fill="transparent" />
            <circle cx={px(x2)} cy={py(x2 * x2)} r={8} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
            <text x={px(x2)} y={py(x2 * x2) + 24} textAnchor="middle" fontSize={13} fontWeight={800} fill="#7c3aed">
              −b={fmt(-b)}
            </text>
          </g>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Stat label="a × b" value={`${fmt(a)} × ${fmt(b)} = ${fmt(prod)}`} tone="ok" />
          <Stat label="직선이 세로축과 만나는 값" value={fmt(intercept)} />
        </div>
        <p className="mt-2 text-sm text-muted">
          초록 점은 x = a, 보라 점은 x = −b 에 있어요. 두 점을 잇는 직선은 y = {fmt(slope)}x {intercept < 0 ? "−" : "+"} {fmt(Math.abs(intercept))} 이에요.
        </p>

        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Slider label="a (초록)" value={a} min={-5} max={5} step={0.5} onChange={setA} show={fmt} />
            </div>
            {stepBtn("a 줄이기", a, setA, -0.5)}
            {stepBtn("a 늘리기", a, setA, 0.5)}
          </div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Slider label="b (보라)" value={b} min={-5} max={5} step={0.5} onChange={setB} show={fmt} />
            </div>
            {stepBtn("b 줄이기", b, setB, -0.5)}
            {stepBtn("b 늘리기", b, setB, 0.5)}
          </div>
        </div>
        <div className="mt-2">
          <Say>{note}</Say>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <GButton onClick={reset}>다시 하기</GButton>
          <GButton variant="soft" onClick={() => { setA(2); setB(2); }}>같은 수 (2×2)</GButton>
          <GButton variant="soft" onClick={() => { setA(3); setB(-3); }}>접선 (3×−3)</GButton>
          <GButton variant="soft" onClick={() => { setA(0); setB(4); }}>0 곱하기</GButton>
        </div>
      </Board>

      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label={`레벨 ${level} · 라운드`} value={`${round + 1} / 3`} />
          <Stat label="맞힌 문제" value={`${score.ok} / ${score.tries}`} tone={score.ok > 0 ? "ok" : "plain"} />
        </div>
        {quest.kind === "compute" ? (
          <>
            <p className="font-semibold">
              {quest.a} × {quest.b} 를 포물선으로 구해 봐요. a 와 b 를 맞춰 놓고, 직선이 세로축과 만나는 값을 써 주세요.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input type="text" inputMode="decimal" value={ans} onChange={(e) => setAns(e.target.value)} onKeyDown={(e) => e.key === "Enter" && check()} aria-label="답" placeholder="답" className="min-h-[44px] w-28 rounded-card border border-line bg-surface px-3 text-right tabular-nums" />
              <GButton variant="primary" onClick={check}>답 확인</GButton>
              <GButton onClick={next}>새 문제</GButton>
            </div>
          </>
        ) : (
          <>
            <p className="font-semibold">곱 a × b 가 {quest.target} 이 되도록 a 와 b 를 맞춰 보세요. (0.5 단위, −5 ~ 5)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <GButton variant="primary" onClick={check}>이대로 확인</GButton>
              <GButton onClick={next}>새 문제</GButton>
            </div>
          </>
        )}
        <div className="mt-3">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
      </Board>
    </div>
  );
}
