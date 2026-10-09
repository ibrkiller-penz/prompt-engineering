import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, rand, svgPoint, tick } from "./kit";
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
// ==END==

const ANGLES = [15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180];
const EASY_ANGLES = [60, 90, 120, 180];
const EASY_COUNTS = [2, 3, 4, 6];
const HARD_COUNTS = [2, 3, 4, 5, 6, 8, 9, 10, 12];
const HARD_QUIZ = [72, 45, 40, 36, 30, 24];
const QN = 5;
const OX = 200;
const OY = 205;
const MLEN = 175;
const HANDLE = 160; // 돌리는 손잡이가 있는 거리
const SHAPE: V[] = [[0, 11], [8, -8], [0, -3], [-8, -8]]; // 화살 모양(뒤집힘이 보이도록 비대칭)
const rad = (d: number) => (d * Math.PI) / 180;
const toS = (p: V): V => [OX + p[0], OY - p[1]];
const A0 = 0; // 거울 A는 오른쪽으로 고정, 거울 B를 끌어 돌려요

const pickList = (pool: number[]) => {
  const out: number[] = [];
  while (out.length < QN) {
    const c = pool[rand(pool.length)];
    if (c !== out[out.length - 1]) out.push(c);
  }
  return out;
};
const startDegFor = (count: number, hard: boolean) => (count === (hard ? 4 : 2) ? (hard ? 180 : 90) : hard ? 90 : 180);
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

type Mode = "match" | "free" | "quiz";
type Grab = "none" | "mirror" | "obj";

export default function MirrorGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const grab = useRef<Grab>("none");
  const timer = useRef(0);
  const [mode, setMode] = useState<Mode>("match");
  const [hard, setHard] = useState(false);
  const [goals, setGoals] = useState(() => pickList(EASY_COUNTS)); // match: 목표 개수, quiz: 각도
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [userDeg, setUserDeg] = useState(() => startDegFor(goals[0], false));
  const [picked, setPicked] = useState<number | null>(null);
  const [opts, setOpts] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);
  const [nums, setNums] = useState(true);
  const [hint, setHint] = useState(false);
  const [over, setOver] = useState(false);
  const [touched, setTouched] = useState(false);
  const [objRaw, setObj] = useState<V>(() => defaultObj(180));
  const quiz = mode === "quiz";
  const deg = quiz ? goals[round] : userDeg;
  const theta = rad(deg);
  const obj = clampToWedge(objRaw, A0, theta, 30, 125);
  const allowed = hard ? ANGLES : EASY_ANGLES;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const imgs = imageSeqs(obj, A0, theta);
  const total = imgs.length + 1;
  const showImgs = !quiz || picked !== null;
  const goal = mode === "match" ? goals[round] : 0;

  const begin = (m: Mode, h: boolean) => {
    window.clearTimeout(timer.current);
    setMode(m);
    setHard(h);
    setRound(0);
    setScore(0);
    setSolved(false);
    setPicked(null);
    setMsg(null);
    setOver(false);
    setHint(false);
    if (m === "match") {
      const g = pickList(h ? HARD_COUNTS : EASY_COUNTS);
      setGoals(g);
      const d = startDegFor(g[0], h);
      setUserDeg(d);
      setObj(defaultObj(d));
    } else if (m === "quiz") {
      const g = pickList(h ? [...EASY_ANGLES, ...HARD_QUIZ] : EASY_ANGLES);
      setGoals(g);
      setOpts(makeOpts(360 / g[0]));
      setObj(defaultObj(g[0]));
    } else {
      setUserDeg(90);
      setObj(defaultObj(90));
    }
  };
  const advance = () => {
    const n = round + 1;
    setRound(n);
    setSolved(false);
    setPicked(null);
    setMsg(null);
    if (mode === "match") {
      const d = startDegFor(goals[n], hard);
      setUserDeg(d);
      setObj(defaultObj(d));
    } else {
      setOpts(makeOpts(360 / goals[n]));
      setObj(defaultObj(goals[n]));
    }
  };
  // advance 는 최신 상태를 써야 해서 ref 로 부른다
  const advRef = useRef(advance);
  advRef.current = advance;
  const afterRoundSafe = (ok: boolean) => {
    if (round >= QN - 1) setOver(true);
    else timer.current = window.setTimeout(() => advRef.current(), ok ? 1800 : 3000);
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
      setScore((v) => v + 1);
      cheer();
      setMsg({ tone: "ok", text: `와, ${goal}개로 보여요! 잘했어요! ⭐` });
      afterRoundSafe(true);
    } else {
      oops();
      setMsg({ tone: "bad", text: `지금은 ${n}개로 보여요. 괜찮아요! ${n < goal ? "거울 사이를 더 좁혀 봐요. 가까울수록 더 많이 보여요." : "거울 사이를 더 벌려 봐요. 벌릴수록 적게 보여요."}` });
    }
  };

  const choose = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    const ok = n === total;
    if (ok) {
      setScore((s) => s + 1);
      cheer();
    } else oops();
    afterRoundSafe(ok);
  };

  const mB = toS([MLEN * Math.cos(theta), MLEN * Math.sin(theta)]);
  const mA = toS([MLEN, 0]);
  const hnd = toS([HANDLE * Math.cos(theta), HANDLE * Math.sin(theta)]);
  const shapePts = (center: V, seq: (0 | 1)[]) =>
    SHAPE.map((s) => toS(applySeq([center[0] + s[0], center[1] + s[1]], seq, A0, theta))).map((q) => q.join(",")).join(" ");
  const formula = `360 ÷ ${deg} = ${360 / deg}. 물체 1개 + 비친 모습 ${imgs.length}개 = 모두 ${total}개`;
  const wedge = `M ${OX} ${OY} L ${mA[0]} ${mA[1]} A ${MLEN} ${MLEN} 0 0 0 ${mB[0]} ${mB[1]} Z`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode !== "free" && <Stat label="문제" value={`${Math.min(round + 1, QN)}/${QN}`} />}
        {mode !== "free" && <Stat label="별" value={score} tone="ok" />}
        <Stat label="거울 사이" value={`${deg}°`} />
      </div>

      <Board>
        <p className="mb-1 text-center text-xl font-extrabold">
          {mode === "match" && <>물체가 <span className="text-accent">{goal}개</span>로 보이게 해요!</>}
          {mode === "free" && <>거울을 돌려 보세요!</>}
          {mode === "quiz" && <>물체가 모두 몇 개로 보일까요?</>}
        </p>
        {!quiz && <p className="mb-2 text-center text-lg font-bold">지금 <span className="text-accent tabular-nums">{total}개</span>로 보여요</p>}
        <svg
          ref={svgRef}
          viewBox="0 0 400 380"
          className="mx-auto block w-full max-w-[520px] touch-none select-none rounded-card bg-bg"
          style={{ touchAction: "none" }}
          role="img"
          aria-label={`점 O에서 ${deg}도로 만나는 두 거울과 그 사이의 물체${showImgs ? `, 비친 모습 ${imgs.length}개` : ""}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => (grab.current = "none")}
        >
          <path d={wedge} fill="rgba(99,102,241,0.08)" />
          {showImgs &&
            imgs.map((im, i) => (
              <g key={i}>
                <polygon points={shapePts(obj, im.seq)} fill="#f59e0b" fillOpacity="0.6" stroke="#b45309" strokeWidth="1.2" strokeLinejoin="round" />
                {nums && (
                  <text x={toS(im.pt)[0]} y={toS(im.pt)[1] - 13} fontSize="17" fontWeight="800" textAnchor="middle" fill="#92400e" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                    {i + 2}
                  </text>
                )}
              </g>
            ))}
          <line x1={OX} y1={OY} x2={mA[0]} y2={mA[1]} stroke="#0ea5e9" strokeWidth="6" strokeLinecap="round" />
          <line x1={OX} y1={OY} x2={mB[0]} y2={mB[1]} stroke="#0ea5e9" strokeWidth="6" strokeLinecap="round" />
          <line x1={OX} y1={OY} x2={mA[0]} y2={mA[1]} stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" />
          <line x1={OX} y1={OY} x2={mB[0]} y2={mB[1]} stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" />
          <circle cx={OX} cy={OY} r="5" fill="#1f2937" />
          <path
            d={`M ${toS([34, 0]).join(" ")} A 34 34 0 0 0 ${toS([34 * Math.cos(theta), 34 * Math.sin(theta)]).join(" ")}`}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2"
          />
          {/* 거울을 돌리는 손잡이 */}
          {!quiz && (
            <g aria-hidden="true" style={{ cursor: "grab" }}>
              <circle cx={hnd[0]} cy={hnd[1]} r="17" fill="#fff" stroke="#0284c7" strokeWidth="3" />
              <text x={hnd[0]} y={hnd[1] + 7} fontSize="20" textAnchor="middle" fill="#0284c7">⟳</text>
              {!touched && (
                <circle cx={hnd[0]} cy={hnd[1]} r="17" fill="none" stroke="#ef4444" strokeWidth="3">
                  <animate attributeName="r" values="17;32;17" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
            </g>
          )}
          {/* 물체 */}
          <g style={{ cursor: quiz ? "default" : "grab" }}>
            <circle cx={toS(obj)[0]} cy={toS(obj)[1]} r="26" fill="transparent" />
            <polygon points={shapePts(obj, [])} fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" strokeLinejoin="round" />
            {nums && showImgs && (
              <text x={toS(obj)[0]} y={toS(obj)[1] - 15} fontSize="17" fontWeight="800" textAnchor="middle" fill="#991b1b" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                1
              </text>
            )}
          </g>
          {!quiz && !touched && <text x={hnd[0] + (hnd[0] > 300 ? -4 : 4)} y={hnd[1] - 28} fontSize="14" fontWeight="700" textAnchor="middle" fill="#0369a1">돌려 보세요</text>}
        </svg>
        <p className="mt-1 text-center text-base text-muted">
          {quiz ? "빨간 것이 진짜 물체, 주황색은 거울에 비친 모습이에요." : "⟳ 손잡이를 끌어 거울을 돌려요. 빨간 물체도 끌 수 있어요. 가까울수록 더 많이 보여요!"}
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
      {over && (
        <Say tone={score >= 4 ? "ok" : "info"}>
          {QN}문제 끝! 별 {score}개예요. {score >= 4 ? "거울 박사예요!" : "잘했어요! 또 해 보면 더 잘할 수 있어요."}
        </Say>
      )}

      <div className="flex flex-wrap gap-2">
        {over && (
          <GButton variant="primary" onClick={() => begin(mode, hard)} className={BIG}>
            다시 하기
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
          힌트 {hint ? "숨기기" : "보기"}
        </GButton>
        {!over && mode !== "free" && (
          <GButton onClick={() => begin(mode, hard)} className={BIG}>
            다시 하기
          </GButton>
        )}
        {!quiz && (
          <GButton pressed={nums} onClick={() => setNums((n) => !n)} className={BIG}>
            번호 {nums ? "끄기" : "켜기"}
          </GButton>
        )}
        <GButton pressed={hard} className={BIG} onClick={() => begin(mode, !hard)}>
          더 어려운 도전
        </GButton>
        <GButton pressed={mode === "free"} className={BIG} onClick={() => begin(mode === "free" ? "match" : "free", hard)}>
          마음대로 놀기
        </GButton>
        <GButton pressed={quiz} className={BIG} onClick={() => begin(quiz ? "match" : "quiz", hard)}>
          몇 개일까? 퀴즈
        </GButton>
      </div>
    </div>
  );
}
