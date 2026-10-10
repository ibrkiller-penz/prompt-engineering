import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, rand, stageClear, svgPoint, tick, useStage } from "./kit";
import { BIG } from "./easykit";

// ==PURE==
export type V = [number, number];

/** O를 지나고 x축과 각 ang(라디안)을 이루는 직선에 대한 대칭 점 */
export function reflect(p: V, ang: number): V {
  const c = Math.cos(2 * ang);
  const s = Math.sin(2 * ang);
  return [c * p[0] + s * p[1], s * p[0] - c * p[1]];
}

/** 두 거울: 거울 A는 방향 a0, 거울 B는 방향 a0+theta (모두 O에서 시작, 라디안). 물체는 두 거울 사이(쐐기) 안. */
export type Seq = { seq: (0 | 1)[]; pt: V };

/** 거울에 번갈아 비춰 생기는 상. 거울 A·B에서 시작하는 두 갈래(A, BA, ABA… / B, AB, BAB…)를 각각
 *  floor(360°/각도 ÷ 2)번째까지 펼쳐 놓으면 쐐기를 펼친 조각이 한 바퀴를 딱 채우고, 겹치는 상은 하나로 센다.
 *  (각도가 360°를 나누어떨어지면 상은 360/각도 − 1개.) */
export function imageSeqs(p: V, a0: number, theta: number): Seq[] {
  const ang = [a0, a0 + theta];
  const kmax = Math.floor((2 * Math.PI) / theta / 2 + 1e-9);
  const out: Seq[] = [];
  for (const first of [0, 1] as const) {
    let cur = p;
    let m: 0 | 1 = first;
    const seq: (0 | 1)[] = [];
    for (let k = 0; k < kmax; k++) {
      cur = reflect(cur, ang[m]);
      seq.push(m);
      if (!out.some((o) => Math.hypot(o.pt[0] - cur[0], o.pt[1] - cur[1]) < 1e-6)) out.push({ seq: [...seq], pt: cur });
      m = m === 0 ? 1 : 0;
    }
  }
  return out;
}

export function applySeq(p: V, seq: (0 | 1)[], a0: number, theta: number): V {
  const ang = [a0, a0 + theta];
  return seq.reduce<V>((q, m) => reflect(q, ang[m]), p);
}

/** 점을 두 거울 사이(쐐기) 안으로 끌어 넣는다 */
export function clampToWedge(p: V, a0: number, theta: number, rMin: number, rMax: number): V {
  const r = clamp(Math.hypot(p[0], p[1]), rMin, rMax);
  const TAU = Math.PI * 2;
  let rel = (((Math.atan2(p[1], p[0]) - a0) % TAU) + TAU) % TAU;
  if (rel > theta) rel = rel > (theta + TAU) / 2 ? 0 : theta;
  const m = Math.min((8 * Math.PI) / 180, theta / 4);
  rel = clamp(rel, m, theta - m);
  return [r * Math.cos(a0 + rel), r * Math.sin(a0 + rel)];
}
/** 360°를 나누어떨어지게 하는 거울 각도(상의 수가 딱 정해져요) */
export const ANGLES = [15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180];

/** 레벨(1~10)별 규칙: 돌릴 수 있는 각도, '○개로 보이게' 목표 개수 */
export function levelSpec(level: number): { allowed: number[]; counts: number[] } {
  const L = Math.max(1, Math.min(10, level));
  const allowed =
    L <= 2 ? [60, 90, 120, 180] : L === 3 ? [60, 72, 90, 120, 180] : L === 4 ? [45, 60, 72, 90, 120, 180] : L === 5 ? [36, 40, 45, 60, 72, 90, 120, 180] : L === 6 ? [30, 36, 40, 45, 60, 72, 90, 120, 180] : ANGLES;
  const counts = [[2, 3, 4], [2, 3, 4, 6], [3, 4, 5, 6], [4, 5, 6, 8], [5, 6, 8, 9, 10], [6, 8, 9, 10, 12], [8, 9, 10, 12], [9, 10, 12, 15], [10, 12, 15, 18], [12, 15, 18, 20, 24]][L - 1];
  return { allowed, counts };
}
/** 라운드 종류: 레벨 4부터는 두 번째 라운드가 ‘몇 개일까?’ 퀴즈 */
export const roundKind = (level: number, r: number): "match" | "quiz" => (level >= 4 && r === 1 ? "quiz" : "match");
// ==END==

const ROUNDS = 3;
const OX = 200;
const OY = 205;
const MLEN = 175;
const HANDLE = 160; // 돌리는 손잡이가 있는 거리
const GF = { fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" };
const CSS = `
@keyframes mr-hop { 0%,100% { transform: translateY(0) scale(1); } 35% { transform: translateY(-10px) scale(1.08); } 70% { transform: translateY(0) scale(.98); } }
@keyframes mr-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-7px); } 50% { transform: translateX(7px); } 75% { transform: translateX(-4px); } }
.mr-hop { animation: mr-hop .7s ease-out; }
.mr-shake { animation: mr-shake .45s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .mr-hop, .mr-shake { animation: none; } }
`;
/** 반사 순서(seq)를 합친 2×2 행렬(수학 좌표) */
function seqMatrix(seq: (0 | 1)[], theta: number): [number, number, number, number] {
  let m: [number, number, number, number] = [1, 0, 0, 1]; // [m11, m12, m21, m22]
  for (const k of seq) {
    const a = k === 0 ? A0 : A0 + theta;
    const c = Math.cos(2 * a);
    const s2 = Math.sin(2 * a);
    // R·m
    m = [c * m[0] + s2 * m[2], c * m[1] + s2 * m[3], s2 * m[0] - c * m[2], s2 * m[1] - c * m[3]];
  }
  return m;
}
/** 화면 좌표에서 쓰는 SVG matrix(): O를 중심으로 같은 반사를 적용 */
function svgMatrix(seq: (0 | 1)[], theta: number) {
  const [m11, m12, m21, m22] = seqMatrix(seq, theta);
  const a = m11;
  const b = -m21;
  const c = -m12;
  const d = m22;
  const e = OX - (a * OX + c * OY);
  const f = OY - (b * OX + d * OY);
  return `matrix(${a} ${b} ${c} ${d} ${e} ${f})`;
}
/** 장난감 곰(왼쪽 귀에 리본, 오른손에 별: 거울에 비치면 좌우가 바뀌어 보여요) */
function Teddy({ x, y, ghost }: { x: number; y: number; ghost?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.3)`} opacity={ghost ? 0.82 : 1}>
      <ellipse cx="0" cy="19" rx="11" ry="3" fill="rgba(0,0,0,0.15)" />
      <circle cx="0" cy="8" r="10.5" fill="#d08b52" stroke="#7c3f12" strokeWidth="2" />
      <ellipse cx="0" cy="10" rx="5.5" ry="5" fill="#f6d3a8" />
      <circle cx="-7.5" cy="-12" r="4.5" fill="#d08b52" stroke="#7c3f12" strokeWidth="2" />
      <circle cx="7.5" cy="-12" r="4.5" fill="#d08b52" stroke="#7c3f12" strokeWidth="2" />
      <circle cx="0" cy="-5" r="9.5" fill="#d08b52" stroke="#7c3f12" strokeWidth="2" />
      <ellipse cx="0" cy="-2" rx="4.5" ry="3.4" fill="#f6d3a8" />
      <circle cx="0" cy="-3.2" r="1.5" fill="#3b1d0a" />
      <circle cx="-3.4" cy="-7.5" r="1.4" fill="#3b1d0a" />
      <circle cx="3.4" cy="-7.5" r="1.4" fill="#3b1d0a" />
      <path d="M -12 -17 L -7 -14 L -12 -11 Z M -2 -17 L -7 -14 L -2 -11 Z" fill="#ec4899" stroke="#9d174d" strokeWidth="1" />
      <path d="M 13 -1 L 14.6 2.6 L 18.5 3 L 15.5 5.5 L 16.4 9.4 L 13 7.3 L 9.6 9.4 L 10.5 5.5 L 7.5 3 L 11.4 2.6 Z" fill="#facc15" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" />
    </g>
  );
}
const rad = (d: number) => (d * Math.PI) / 180;
const toS = (p: V): V => [OX + p[0], OY - p[1]];
const A0 = 0; // 거울 A는 오른쪽으로 고정, 거울 B를 끌어 돌려요

/** 정답 하나와 틀린 보기 셋을 섞어서 단추 네 개로 */
const makeOpts = (ans: number) => {
  const set = new Set<number>([ans]);
  while (set.size < 4) {
    const c = ans + rand(7) - 3;
    if (c >= 2 && c <= 25) set.add(c);
  }
  return [...set].sort((x, y) => x - y);
};
const defaultObj = (theta: number): V => {
  const mid = rad(theta) * 0.42;
  return [95 * Math.cos(mid), 95 * Math.sin(mid)];
};

type Grab = "none" | "mirror" | "obj";

export default function MirrorGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const grab = useRef<Grab>("none");
  const timer = useRef(0);
  const level = useStage();
  const spec = levelSpec(level);
  type Task = { kind: "match" | "quiz"; v: number }; // match: 목표 개수, quiz: 거울 각도
  const pickFrom = (pool: number[], prev: number) => {
    for (;;) {
      const c = pool[rand(pool.length)];
      if (c !== prev || pool.length === 1) return c;
    }
  };
  const makeTask = (r: number, prev = -1): Task => {
    const kind = roundKind(level, r);
    return kind === "quiz" ? { kind, v: pickFrom(spec.allowed, prev) } : { kind, v: pickFrom(spec.counts, prev) };
  };
  /** 목표와 다른 개수로 보이는 시작 각도 */
  const startDeg = (count: number) => {
    const others = spec.allowed.filter((a) => 360 / a !== count);
    return others.includes(180) && count !== 2 ? 180 : others[rand(others.length)];
  };
  const [free, setFree] = useState(false);
  const [task, setTask] = useState<Task>(() => makeTask(0));
  const [score, setScore] = useState(0); // 깬 라운드 수
  const [userDeg, setUserDeg] = useState(() => (task.kind === "match" ? startDeg(task.v) : 90));
  const [picked, setPicked] = useState<number | null>(null);
  const [opts, setOpts] = useState<number[]>(() => (task.kind === "quiz" ? makeOpts(360 / task.v) : []));
  const [solved, setSolved] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);
  const [nums, setNums] = useState(true);
  const [hint, setHint] = useState(false);
  const [touched, setTouched] = useState(false);
  const [objRaw, setObj] = useState<V>(() => defaultObj(task.kind === "quiz" ? task.v : 180));
  const [react, setReact] = useState<{ kind: "" | "ok" | "bad"; n: number }>({ kind: "", n: 0 });
  const mode: "match" | "quiz" | "free" = free ? "free" : task.kind;
  const quiz = mode === "quiz";
  const deg = quiz ? task.v : userDeg;
  const theta = rad(deg);
  const obj = clampToWedge(objRaw, A0, theta, 30, 125);
  const allowed = free ? ANGLES : spec.allowed;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const imgs = imageSeqs(obj, A0, theta);
  const total = imgs.length + 1;
  const showImgs = !quiz || picked !== null;
  const goal = mode === "match" ? task.v : 0;

  const loadTask = (t: Task) => {
    setTask(t);
    setSolved(false);
    setPicked(null);
    setMsg(null);
    setHint(false);
    if (t.kind === "match") {
      const d = startDeg(t.v);
      setUserDeg(d);
      setObj(defaultObj(d));
    } else {
      setOpts(makeOpts(360 / t.v));
      setObj(defaultObj(t.v));
    }
  };
  /** 라운드 결과: 성공하면 다음 라운드(3개 다 깨면 레벨 클리어), 퀴즈를 틀리면 같은 라운드에서 새 문제 */
  const afterRoundSafe = (ok: boolean) => {
    if (ok) {
      const n = score + 1;
      setScore(n);
      if (n >= ROUNDS) {
        timer.current = window.setTimeout(stageClear, 1200);
        return;
      }
      timer.current = window.setTimeout(() => loadTask(makeTask(n, -1)), 1800);
    } else {
      const prev = task.v;
      timer.current = window.setTimeout(() => loadTask(makeTask(score, prev)), 3000);
    }
  };

  // ── 포인터: 거울 손잡이를 끌어 돌리기 / 물체 끌기 ──
  const toMath = (e: React.PointerEvent): V | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    return [x - OX, OY - y];
  };
  const rotateTo = (p: V) => {
    let ang = (Math.atan2(p[1], p[0]) * 180) / Math.PI;
    if (ang < 0) ang = ang < -90 ? 180 : 0;
    let best = allowed[0];
    for (const a of allowed) if (Math.abs(a - ang) < Math.abs(best - ang)) best = a;
    if (best !== userDeg) {
      setUserDeg(best);
      tick();
    }
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (quiz || solved) return;
    const p = toMath(e);
    if (!p) return;
    setTouched(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const hx = HANDLE * Math.cos(theta);
    const hy = HANDLE * Math.sin(theta);
    if (Math.hypot(p[0] - hx, p[1] - hy) < 44) {
      grab.current = "mirror";
      rotateTo(p);
    } else {
      grab.current = "obj";
      setObj(clampToWedge(p, A0, theta, 30, 125));
    }
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (grab.current === "none") return;
    const p = toMath(e);
    if (!p) return;
    if (grab.current === "mirror") rotateTo(p);
    else setObj(clampToWedge(p, A0, theta, 30, 125));
  };
  const up = () => {
    const g = grab.current;
    grab.current = "none";
    if (g !== "mirror" || mode !== "match" || solved) return;
    // 손을 떼는 순간 판정
    const n = 360 / userDeg;
    if (n === goal) {
      setSolved(true);
      cheer();
      setReact((r) => ({ kind: "ok", n: r.n + 1 }));
      setMsg({ tone: "ok", text: `와, ${goal}개로 보여요! 잘했어요! ⭐` });
      afterRoundSafe(true);
    } else {
      oops();
      setReact((r) => ({ kind: "bad", n: r.n + 1 }));
      setMsg({ tone: "bad", text: `지금은 ${n}개로 보여요. 괜찮아요! ${n < goal ? "거울 사이를 더 좁혀 봐요. 가까울수록 더 많이 보여요." : "거울 사이를 더 벌려 봐요. 벌릴수록 적게 보여요."}` });
    }
  };

  const choose = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    const ok = n === total;
    if (ok) cheer();
    else oops();
    afterRoundSafe(ok);
  };

  const mB = toS([MLEN * Math.cos(theta), MLEN * Math.sin(theta)]);
  const mA = toS([MLEN, 0]);
  const hnd = toS([HANDLE * Math.cos(theta), HANDLE * Math.sin(theta)]);
  const formula = `360 ÷ ${deg} = ${360 / deg}. 물체 1개 + 비친 모습 ${imgs.length}개 = 모두 ${total}개`;
  const wedge = `M ${OX} ${OY} L ${mA[0]} ${mA[1]} A ${MLEN} ${MLEN} 0 0 0 ${mB[0]} ${mB[1]} Z`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode !== "free" && <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(score + 1, ROUNDS)}/${ROUNDS}`} />}
        {mode !== "free" && <Stat label="별" value={score} tone="ok" />}
        <Stat label="거울 사이" value={`${deg}°`} />
      </div>

      <Board>
        <style>{CSS}</style>
        <p className="font-game mb-1 text-center text-2xl">
          {mode === "match" && <>물체가 <span className="text-accent">{goal}개</span>로 보이게 해요!</>}
          {mode === "free" && <>거울을 돌려 보세요!</>}
          {mode === "quiz" && <>물체가 모두 몇 개로 보일까요?</>}
        </p>
        {!quiz && (
          <p key={react.n} className={`font-game mb-2 text-center text-xl ${react.kind === "ok" ? "mr-hop" : react.kind === "bad" ? "mr-shake" : ""}`}>
            지금 <span className="text-3xl text-accent tabular-nums">{total}개</span>로 보여요
          </p>
        )}
        <svg
          ref={svgRef}
          viewBox="0 0 400 380"
          className="mx-auto block w-full max-w-[520px] touch-none select-none overflow-hidden rounded-card"
          style={{ touchAction: "none" }}
          role="img"
          aria-label={`점 O에서 ${deg}도로 만나는 두 거울과 그 사이의 물체${showImgs ? `, 비친 모습 ${imgs.length}개` : ""}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => (grab.current = "none")}
        >
          <defs>
            <radialGradient id="mr-bg" cx="0.5" cy="0.55" r="0.75">
              <stop offset="0" stopColor="#fdf4ff" />
              <stop offset="1" stopColor="#e9d5ff" />
            </radialGradient>
            <radialGradient id="mr-gem" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#ffd5c7" />
              <stop offset="1" stopColor="#e8552f" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="400" height="380" fill="url(#mr-bg)" />
          {[[30, 40], [370, 34], [24, 350], [376, 356], [200, 370]].map(([x, y], i) => (
            <text key={i} x={x} y={y} fontSize="16" textAnchor="middle" opacity="0.7">✨</text>
          ))}
          <path d={wedge} fill="#fff7d6" stroke="#fcd34d" strokeWidth="2" strokeDasharray="6 6" />
          {showImgs &&
            imgs.map((im, i) => (
              <g key={i}>
                <g transform={svgMatrix(im.seq, theta)}>
                  <Teddy x={toS(obj)[0]} y={toS(obj)[1]} ghost />
                </g>
                {nums && (
                  <text x={toS(im.pt)[0]} y={toS(im.pt)[1] - 30} fontSize="17" textAnchor="middle" fill="#7c2d92" stroke="#fff" strokeWidth="4" paintOrder="stroke" style={GF}>
                    {i + 2}
                  </text>
                )}
              </g>
            ))}
          {/* 거울: 분홍 장식 테두리 + 하늘색 유리 */}
          {[mA, mB].map((m, i) => (
            <g key={i}>
              <line x1={OX} y1={OY} x2={m[0]} y2={m[1]} stroke="#be185d" strokeWidth="14" strokeLinecap="round" />
              <line x1={OX} y1={OY} x2={m[0]} y2={m[1]} stroke="#f9a8d4" strokeWidth="10" strokeLinecap="round" />
              <line x1={OX} y1={OY} x2={m[0]} y2={m[1]} stroke="#7dd3fc" strokeWidth="5" strokeLinecap="round" />
              <line x1={OX} y1={OY} x2={m[0]} y2={m[1]} stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeDasharray="10 14" />
              <circle cx={m[0]} cy={m[1]} r="6" fill="#facc15" stroke="#b45309" strokeWidth="2" />
            </g>
          ))}
          <path
            d={`M ${toS([34, 0]).join(" ")} A 34 34 0 0 0 ${toS([34 * Math.cos(theta), 34 * Math.sin(theta)]).join(" ")}`}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={OX} cy={OY} r="7" fill="#facc15" stroke="#b45309" strokeWidth="2.5" />
          {/* 거울을 돌리는 보석 손잡이 */}
          {!quiz && (
            <g aria-hidden="true" style={{ cursor: "grab" }}>
              <circle cx={hnd[0]} cy={hnd[1] + 3} r="19" fill="rgba(0,0,0,0.15)" />
              <circle cx={hnd[0]} cy={hnd[1]} r="19" fill="url(#mr-gem)" stroke="#9a2d14" strokeWidth="3" />
              <text x={hnd[0]} y={hnd[1] + 7} fontSize="21" textAnchor="middle" fill="#fff" style={GF}>⟳</text>
              {!touched && (
                <circle cx={hnd[0]} cy={hnd[1]} r="19" fill="none" stroke="#e8552f" strokeWidth="3">
                  <animate attributeName="r" values="19;34;19" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )}
          {/* 진짜 곰 */}
          <g style={{ cursor: quiz ? "default" : "grab" }}>
            <circle cx={toS(obj)[0]} cy={toS(obj)[1]} r="28" fill="transparent" />
            <Teddy x={toS(obj)[0]} y={toS(obj)[1]} />
            {nums && showImgs && (
              <text x={toS(obj)[0]} y={toS(obj)[1] - 30} fontSize="17" textAnchor="middle" fill="#9a2d14" stroke="#fff" strokeWidth="4" paintOrder="stroke" style={GF}>
                1
              </text>
            )}
          </g>
          {!quiz && !touched && <text x={hnd[0] + (hnd[0] > 300 ? -4 : 4)} y={hnd[1] - 30} fontSize="15" textAnchor="middle" fill="#9a2d14" style={GF}>돌려 보세요</text>}
        </svg>
        <p className="mt-1 text-center text-base text-muted">
          {quiz ? "진한 곰이 진짜, 흐린 곰은 거울에 비친 모습이에요." : "⟳ 보석 손잡이를 끌어 거울을 돌려요. 곰도 끌 수 있어요. 가까울수록 더 많이 보여요!"}
        </p>
      </Board>

      {quiz && (
        <div className="space-y-2">
          <p className="text-base font-bold">거울이 {deg}°로 벌어져 있어요. 진짜 물체와 비친 모습을 모두 합하면 몇 개일까요?</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="보기">
            {opts.map((n) => (
              <GButton
                key={n}
                variant={picked === null ? "soft" : n === total ? "primary" : "ghost"}
                pressed={picked === n}
                disabled={picked !== null}
                onClick={() => choose(n)}
                className="min-h-[64px]! text-xl"
              >
                {n}개
              </GButton>
            ))}
          </div>
        </div>
      )}

      {msg && <Say tone={msg.tone}>{msg.text}</Say>}
      {quiz && picked === null && <Say>{hint ? `힌트: 거울이 가까워질수록 더 많이 보여요. 90°면 4개, 60°면 6개예요. 한 바퀴(360°)에 ${deg}°가 몇 번 들어가는지 생각해 봐요.` : "거울이 가까울수록 더 많이 보여요. 하나를 골라 보세요!"}</Say>}
      {quiz && picked !== null && (
        <Say tone={picked === total ? "ok" : "bad"}>
          {picked === total ? "정답이에요! 잘했어요! ⭐ " : `아쉬워요, 괜찮아요! 정답은 ${total}개예요. `}
          물체 1개 + 비친 모습 {imgs.length}개 = 모두 {total}개예요.
        </Say>
      )}
      {mode === "free" && <Say tone="ok">거울 사이가 {deg}°예요. 물체 1개 + 비친 모습 {imgs.length}개 = 모두 {total}개!</Say>}
      {hint && mode !== "quiz" && <Say>힌트: 한 바퀴는 360°예요. {formula}.</Say>}
      <div className="flex flex-wrap gap-2">
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
          힌트 {hint ? "숨기기" : "보기"}
        </GButton>
        {!quiz && (
          <GButton pressed={nums} onClick={() => setNums((n) => !n)} className={BIG}>
            번호 {nums ? "끄기" : "켜기"}
          </GButton>
        )}
        <GButton
          pressed={free}
          className={BIG}
          onClick={() => {
            window.clearTimeout(timer.current);
            if (free) {
              setFree(false);
              loadTask(makeTask(score));
            } else {
              setFree(true);
              setMsg(null);
              setUserDeg(90);
              setObj(defaultObj(90));
            }
          }}
        >
          {free ? "레벨로 돌아가기" : "마음대로 놀기"}
        </GButton>
      </div>
    </div>
  );
}
