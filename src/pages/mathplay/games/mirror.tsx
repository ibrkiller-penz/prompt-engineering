import { useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { Board, GButton, Say, Slider, Stat, clamp, rand, svgPoint } from "./kit";

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
const EASY_ANGLES = [180, 120, 90, 60];
const HARD_ANGLES = [72, 45, 40, 36, 30, 24];
const QN = 5;
const OX = 200;
const OY = 200;
const MLEN = 175;
const SHAPE: V[] = [[0, 11], [8, -8], [0, -3], [-8, -8]]; // 화살 모양(뒤집힘이 보이도록 비대칭)
const rad = (d: number) => (d * Math.PI) / 180;
const toS = (p: V): V => [OX + p[0], OY - p[1]];

const pickQuiz = (hard: boolean) => {
  const pool = hard ? [...EASY_ANGLES, ...HARD_ANGLES] : EASY_ANGLES;
  const out: number[] = [];
  while (out.length < QN) {
    const c = pool[rand(pool.length)];
    if (c !== out[out.length - 1]) out.push(c);
  }
  return out;
};
/** 정답 하나와 틀린 보기 셋을 섞어서 단추 네 개로 */
const makeOpts = (ans: number) => {
  const set = new Set<number>([ans]);
  while (set.size < 4) {
    const c = ans + rand(7) - 3;
    if (c >= 2 && c <= 25) set.add(c);
  }
  return [...set].sort((a, b) => a - b);
};
const defaultObj = (theta: number): V => {
  const a0 = rad(90 - theta / 2);
  const mid = a0 + rad(theta) * 0.42;
  return [95 * Math.cos(mid), 95 * Math.sin(mid)];
};

type Mode = "free" | "quiz";

export default function MirrorGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const [mode, setMode] = useState<Mode>("free");
  const [aIdx, setAIdx] = useState(ANGLES.indexOf(90));
  const [hard, setHard] = useState(false);
  const [qs, setQs] = useState(() => pickQuiz(false));
  const [qi, setQi] = useState(0);
  const [opts, setOpts] = useState(() => makeOpts(4));
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [nums, setNums] = useState(true);
  const [hint, setHint] = useState(false);
  const quiz = mode === "quiz";
  const deg = quiz ? qs[qi] : ANGLES[aIdx];
  const theta = rad(deg);
  const a0 = rad(90 - deg / 2);
  const [objRaw, setObj] = useState<V>(() => defaultObj(90));
  const obj = clampToWedge(objRaw, a0, theta, 30, 130);

  const imgs = imageSeqs(obj, a0, theta);
  const total = imgs.length + 1;
  const showImgs = !quiz || picked !== null;
  const finished = quiz && picked !== null && qi === QN - 1;

  const pointer = (e: RPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setObj(clampToWedge([x - OX, OY - y], a0, theta, 30, 130));
  };
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    drag.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointer(e);
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag.current) pointer(e);
  };
  const up = () => {
    drag.current = false;
  };

  const startQuiz = (h: boolean) => {
    const q = pickQuiz(h);
    setQs(q);
    setQi(0);
    setScore(0);
    setPicked(null);
    setOpts(makeOpts(360 / q[0]));
    setObj(defaultObj(q[0]));
  };
  const switchMode = (m: Mode) => {
    setMode(m);
    setHint(false);
    if (m === "quiz") startQuiz(hard);
    else setObj(defaultObj(ANGLES[aIdx]));
  };
  const choose = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    if (n === total) setScore((s) => s + 1);
  };
  const nextQ = () => {
    const n = qi + 1;
    setQi(n);
    setPicked(null);
    setOpts(makeOpts(360 / qs[n]));
    setObj(defaultObj(qs[n]));
  };
  const pickAngle = (d: number) => {
    setAIdx(ANGLES.indexOf(d));
    setObj(defaultObj(d));
  };

  const mA = toS([MLEN * Math.cos(a0), MLEN * Math.sin(a0)]);
  const mB = toS([MLEN * Math.cos(a0 + theta), MLEN * Math.sin(a0 + theta)]);
  const shapePts = (center: V, seq: (0 | 1)[]) =>
    SHAPE.map((s) => toS(applySeq([center[0] + s[0], center[1] + s[1]], seq, a0, theta))).map((q) => q.join(",")).join(" ");
  const formula = `360 ÷ ${deg} = ${360 / deg}. 실물 1개 + 상 ${imgs.length}개 = 모두 ${total}개`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <GButton pressed={mode === "free"} onClick={() => switchMode("free")}>마음대로 놀기</GButton>
        <GButton pressed={mode === "quiz"} onClick={() => switchMode("quiz")}>몇 개로 보일까? 퀴즈</GButton>
        {quiz && <Stat label="문제" value={`${qi + 1}/${QN}`} />}
        {quiz && <Stat label="맞힌 개수" value={score} tone="ok" />}
        <Stat label="거울 사이" value={`${deg}°`} />
      </div>

      <Board>
        <p className="mb-2 text-center text-base font-semibold">
          {quiz ? "빨간 물체가 거울에 비치면 모두 몇 개로 보일까요?" : "빨간 물체를 끌어 보세요. 거울에 비친 모습이 생겨요!"}
        </p>
        <svg
          ref={svgRef}
          viewBox="0 0 400 400"
          className="mx-auto block w-full max-w-[520px] touch-none select-none rounded-card bg-bg"
          style={{ touchAction: "none" }}
          role="img"
          aria-label={`점 O에서 ${deg}도로 만나는 두 거울과 그 사이의 물체${showImgs ? `, 비친 모습 ${imgs.length}개` : ""}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <path d={`M ${OX} ${OY} L ${mA[0]} ${mA[1]} A ${MLEN} ${MLEN} 0 ${deg > 180 ? 1 : 0} 0 ${mB[0]} ${mB[1]} Z`} fill="rgba(99,102,241,0.08)" />
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
          <text x={mA[0]} y={mA[1] - 8} fontSize="15" fontWeight="700" textAnchor="middle" fill="#0369a1">거울</text>
          <text x={mB[0]} y={mB[1] - 8} fontSize="15" fontWeight="700" textAnchor="middle" fill="#0369a1">거울</text>
          <circle cx={OX} cy={OY} r="5" fill="#1f2937" />
          <path
            d={`M ${toS([34 * Math.cos(a0), 34 * Math.sin(a0)]).join(" ")} A 34 34 0 0 0 ${toS([34 * Math.cos(a0 + theta), 34 * Math.sin(a0 + theta)]).join(" ")}`}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="1.5"
          />
          <g style={{ cursor: "grab" }}>
            <circle cx={toS(obj)[0]} cy={toS(obj)[1]} r="26" fill="transparent" />
            <polygon points={shapePts(obj, [])} fill="#ef4444" stroke="#991b1b" strokeWidth="1.5" strokeLinejoin="round" />
            {nums && showImgs && (
              <text x={toS(obj)[0]} y={toS(obj)[1] - 15} fontSize="17" fontWeight="800" textAnchor="middle" fill="#991b1b" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                1
              </text>
            )}
          </g>
        </svg>
        <p className="mt-1 text-center text-base text-muted">빨간 것이 진짜 물체, 주황색은 거울에 비친 모습이에요.</p>
      </Board>

      {!quiz && (
        <div className="space-y-2">
          <p className="text-base font-semibold">거울 사이를 바꿔 봐요</p>
          <div className="flex flex-wrap gap-2">
            {EASY_ANGLES.map((d) => (
              <GButton key={d} pressed={deg === d} onClick={() => pickAngle(d)} className="min-w-[72px]">
                {d}°
              </GButton>
            ))}
            <GButton pressed={nums} onClick={() => setNums((n) => !n)}>번호 {nums ? "끄기" : "켜기"}</GButton>
            <GButton pressed={hint} onClick={() => setHint((h) => !h)}>힌트 {hint ? "숨기기" : "보기"}</GButton>
          </div>
          <Say tone="ok">
            거울 사이가 {deg}°예요. 거울이 가까워질수록 더 많이 보여요! 지금은 물체 1개 + 비친 모습 {imgs.length}개 = 모두 {total}개예요.
          </Say>
          {hint && <Say>힌트: 한 바퀴는 360°예요. {formula}.</Say>}
          <details className="rounded-card bg-bg px-3 py-2 text-base">
            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">더 어려운 도전: 각도를 더 세밀하게</summary>
            <Slider label="거울 사이 각도" value={aIdx} min={0} max={ANGLES.length - 1} onChange={(v) => pickAngle(ANGLES[v])} show={(v) => `${ANGLES[v]}°`} />
          </details>
        </div>
      )}

      {quiz && (
        <div className="space-y-2">
          <p className="text-base font-bold">거울이 {deg}°로 벌어져 있어요. 진짜 물체와 비친 모습을 모두 합하면 몇 개일까요?</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="보기">
            {opts.map((n) => (
              <GButton
                key={n}
                variant={picked === null ? "soft" : n === total ? "primary" : "ghost"}
                pressed={picked === n}
                disabled={picked !== null}
                onClick={() => choose(n)}
                className="min-w-[72px] text-lg"
              >
                {n}개
              </GButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {picked !== null && !finished && (
              <GButton variant="primary" onClick={nextQ}>
                다음 문제
              </GButton>
            )}
            <GButton pressed={hint} onClick={() => setHint((h) => !h)} disabled={picked !== null}>
              힌트 {hint ? "숨기기" : "보기"}
            </GButton>
            <GButton onClick={() => startQuiz(hard)}>다시 하기</GButton>
            <GButton pressed={hard} onClick={() => { const h = !hard; setHard(h); startQuiz(h); }}>더 어려운 도전</GButton>
          </div>
          {picked === null && <Say>{hint ? "힌트: 거울이 가까워질수록 더 많이 보여요. 90°면 4개, 60°면 6개예요. 한 바퀴(360°)에 거울 사이 각도가 몇 번 들어가는지 생각해 봐요." : "거울이 가까울수록 더 많이 보여요. 하나를 골라 보세요!"}</Say>}
          {picked !== null && (
            <Say tone={picked === total ? "ok" : "bad"}>
              {picked === total ? "정답이에요! 잘했어요! ⭐ " : `아쉬워요, 괜찮아요! 정답은 ${total}개예요. `}
              물체 1개 + 비친 모습 {imgs.length}개 = 모두 {total}개예요. ({360 / deg === total ? `360 ÷ ${deg} = ${total}` : ""})
            </Say>
          )}
          {finished && (
            <Say tone={score >= 4 ? "ok" : "info"}>
              {QN}문제 끝! {score}문제 맞혔어요. {score >= 4 ? "거울 박사예요!" : "잘했어요! 또 해 보면 더 잘 맞힐 수 있어요."}
            </Say>
          )}
        </div>
      )}
    </div>
  );
}
