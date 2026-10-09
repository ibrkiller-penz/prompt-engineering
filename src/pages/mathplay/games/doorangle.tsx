import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, svgPoint, tick, useFrame } from "./kit";
import { BIG, Stars } from "./easykit";

// ==PURE==
export const EASY_GOALS = [30, 45, 60, 90];
export const GOALS = [30, 45, 60, 90, 120, 135];

/** 경첩(hx,hy)에서 포인터(px,py)를 본 각도(0~180°). 화면 y는 아래로 늘어나므로 방 쪽(아래)이 +각도. */
export function angleFromPoint(hx: number, hy: number, px: number, py: number): number {
  const a = (Math.atan2(py - hy, px - hx) * 180) / Math.PI;
  if (a >= 0) return a;
  return a < -90 ? 180 : 0;
}

/** 오차(도)에 따른 별 개수: 4° 이내 3개, 10° 이내 2개, 그 밖은 1개 */
export function starsFor(err: number): number {
  const e = Math.abs(err);
  return e <= 4 ? 3 : e <= 10 ? 2 : 1;
}

export function pickGoals(hard = false, n = 5): number[] {
  const pool = hard ? GOALS : EASY_GOALS;
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  const out = a.slice(0, n);
  while (out.length < n) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (c !== out[out.length - 1]) out.push(c);
  }
  return out;
}
// ==END==

const HX = 210;
const HY = 40;
const L = 150; // 문 길이
const R = 118; // 각도기 반지름
const rad = (d: number) => (d * Math.PI) / 180;
const pol = (r: number, d: number): [number, number] => [HX + r * Math.cos(rad(d)), HY + r * Math.sin(rad(d))];

export default function DoorAngleGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const timer = useRef(0);
  const [hard, setHard] = useState(false);
  const [goals, setGoals] = useState(() => pickGoals(false));
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState<number[]>([]);
  const [judged, setJudged] = useState(false);
  const [touched, setTouched] = useState(false);
  const [target, setTarget] = useState(0); // 내가 정한 각도
  const [cur, setCur] = useState(0); // 화면에 그려지는 각도(부드럽게 따라감)
  const [prot, setProt] = useState(true);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useFrame((_, dt) => {
    setCur((c) => {
      const d = target - c;
      return Math.abs(d) < 0.05 ? target : c + d * Math.min(1, dt * 14);
    });
  }, Math.abs(cur - target) > 0.05);

  const goal = goals[round];
  const last = round === goals.length - 1;
  const total = stars.reduce((a, b) => a + b, 0);
  const reading = Math.round(target);
  const showProt = prot || judged;
  const lastStar = judged ? stars[stars.length - 1] : 0;

  const setFromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setTarget(angleFromPoint(HX, HY, x, y));
  };
  const decide = (a = reading) => {
    const err = a - goal;
    const s = starsFor(err);
    setStars((v) => [...v, s]);
    setJudged(true);
    if (s >= 2) cheer();
    else oops();
    const diff = err === 0 ? "딱 맞았어요!" : `${Math.abs(err)}° ${err > 0 ? "더 열었어요" : "덜 열었어요"}.`;
    const cheerTxt = s === 3 ? "최고예요!" : s === 2 ? "아주 잘했어요!" : "괜찮아요. 다음엔 더 가까이 맞춰 봐요!";
    setMsg({ tone: s >= 2 ? "ok" : "bad", text: `목표 ${goal}°, 내 문은 ${a}° → ${diff} ${cheerTxt}` });
    if (round < goals.length - 1) {
      timer.current = window.setTimeout(() => {
        setRound((r) => r + 1);
        setJudged(false);
        setTarget(0);
        setMsg(null);
      }, 2200);
    }
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

  const restart = (h = hard) => {
    window.clearTimeout(timer.current);
    setGoals(pickGoals(h));
    setRound(0);
    setStars([]);
    setJudged(false);
    setTarget(0);
    setCur(0);
    setMsg(null);
  };

  const a = clamp(cur, 0, 179.99);
  const tip = pol(L, a);
  const ticks: number[] = [];
  for (let d = 0; d <= 180; d += 5) ticks.push(d);
  const gm = pol(R, goal);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${Math.min(round + 1, goals.length)}/${goals.length}`} />
        <Stat label="별" value={`${total}/${goals.length * 3}`} tone="ok" />
        <Stat label="모드" value={hard ? "어려운 도전" : "쉬운 모드"} />
      </div>

      <Board>
        <p className="mb-2 text-center text-xl font-extrabold">
          문을 <span className="text-accent">{goal}°</span> 만큼 열어요
        </p>
        <svg
          ref={svgRef}
          viewBox="0 0 420 215"
          className="mx-auto block w-full max-w-[640px] touch-none select-none rounded-card bg-bg"
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
          <rect x="0" y={HY} width="420" height="175" fill="#f1ead9" />
          <path d={`M ${HX + L} ${HY} A ${L} ${L} 0 0 1 ${HX - L} ${HY}`} fill="none" stroke="#b9a77a" strokeWidth="1" strokeDasharray="3 4" />
          <rect x="0" y={HY - 12} width={HX} height="12" fill="#6b7280" />
          <rect x={HX + L} y={HY - 12} width={420 - HX - L} height="12" fill="#6b7280" />
          <rect x={HX - 4} y={HY - 12} width="8" height="20" fill="#374151" />
          <rect x={HX + L - 4} y={HY - 12} width="8" height="20" fill="#374151" />

          {showProt && (
            <g aria-hidden="true">
              <path d={`M ${HX + R} ${HY} A ${R} ${R} 0 0 1 ${HX - R} ${HY} Z`} fill="rgba(56,189,248,0.18)" stroke="#0284c7" strokeWidth="1.2" />
              {ticks.map((d) => {
                const len = d % 10 === 0 ? 10 : 5;
                const [x1, y1] = pol(R, d);
                const [x2, y2] = pol(R - len, d);
                return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#0369a1" strokeWidth={d % 30 === 0 ? 1.6 : 0.9} />;
              })}
              {[0, 30, 60, 90, 120, 150, 180].map((d) => {
                const [x, y] = pol(R - 22, d);
                return (
                  <text key={d} x={x} y={y + 5} fontSize="13" fontWeight="700" textAnchor="middle" fill="#0369a1">
                    {d}
                  </text>
                );
              })}
              {a > 0.5 && <path d={`M ${HX} ${HY} L ${pol(44, 0)[0]} ${pol(44, 0)[1]} A 44 44 0 0 1 ${pol(44, a)[0]} ${pol(44, a)[1]} Z`} fill="rgba(250,204,21,0.45)" stroke="#ca8a04" strokeWidth="1" />}
            </g>
          )}
          {/* 목표 표시: 각도기가 켜져 있을 때(또는 결과를 보여 줄 때) 초록 점 */}
          {showProt && (
            <g aria-hidden="true">
              <line x1={HX} y1={HY} x2={gm[0]} y2={gm[1]} stroke="#16a34a" strokeWidth="2" strokeDasharray="4 3" />
              <circle cx={gm[0]} cy={gm[1]} r="9" fill="#16a34a" stroke="#fff" strokeWidth="2" />
              <text x={gm[0]} y={gm[1] + 4} fontSize="11" fontWeight="800" textAnchor="middle" fill="#fff">목표</text>
            </g>
          )}

          <g>
            <line x1={HX} y1={HY} x2={tip[0]} y2={tip[1]} stroke="#92400e" strokeWidth="9" strokeLinecap="round" />
            <line x1={HX} y1={HY} x2={tip[0]} y2={tip[1]} stroke="#b45309" strokeWidth="5" strokeLinecap="round" />
            <circle cx={pol(L - 14, a)[0]} cy={pol(L - 14, a)[1]} r="4" fill="#fcd34d" stroke="#92400e" />
            <circle cx={tip[0]} cy={tip[1]} r="13" fill="#fff" fillOpacity="0.7" stroke="#92400e" strokeWidth="2" />
            {!touched && !judged && (
              <g aria-hidden="true">
                <circle cx={tip[0]} cy={tip[1]} r="13" fill="none" stroke="#ef4444" strokeWidth="3">
                  <animate attributeName="r" values="13;26;13" dur="1.6s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <text x={tip[0] - 4} y={tip[1] + 40} fontSize="20" textAnchor="middle">
                  👆
                  <animateTransform attributeName="transform" type="translate" values="0,0;-70,50;0,0" dur="2.4s" repeatCount="indefinite" />
                </text>
              </g>
            )}
          </g>
          <circle cx={HX} cy={HY} r="6" fill="#1f2937" />
          <circle cx={HX} cy={HY} r="2" fill="#fbbf24" />
          <text x={HX + 9} y={HY - 14} fontSize="12" fill="#374151">경첩</text>
          {/* 지금 각도: 손가락에 가려지지 않는 왼쪽 위 */}
          {(showProt || judged) && (
            <g aria-hidden="true">
              <rect x="10" y="52" width="66" height="34" rx="9" fill="#fff" stroke="#0284c7" />
              <text x="43" y="76" fontSize="22" fontWeight="800" textAnchor="middle" fill="#0369a1">{reading}°</text>
            </g>
          )}
        </svg>
        <p className="mt-2 text-center text-base text-muted">
          {judged ? <Stars n={lastStar} /> : showProt ? "초록 점까지 문을 끌고, 손을 떼면 점수가 나와요!" : "각도기가 꺼져 있어요. 문을 끌고 손을 떼면 점수가 나와요!"}
        </p>
      </Board>

      {msg && <Say tone={msg.tone}>{msg.text}</Say>}
      {judged && last && (
        <Say tone={total >= 12 ? "ok" : "info"}>
          5번 다 했어요! 별 {total}개 / {goals.length * 3}개예요. {total >= 12 ? "대단해요! 각도 박사예요!" : "잘했어요! 한 번 더 하면 더 잘할 수 있어요."}
        </Say>
      )}

      <div className="flex flex-wrap gap-2">
        {judged && last && (
          <GButton variant="primary" onClick={() => restart()} className={BIG}>
            다시 하기
          </GButton>
        )}
        <GButton pressed={prot} onClick={() => setProt((p) => !p)} className={BIG} title="각도기를 켜면 눈금으로 각도를 읽을 수 있어요">
          각도기 {prot ? "끄기" : "켜기"}
        </GButton>
        <GButton
          pressed={hard}
          className={BIG}
          onClick={() => {
            const h = !hard;
            setHard(h);
            setProt(!h);
            restart(h);
          }}
          title="목표 각도가 더 다양해지고 각도기가 꺼져요"
        >
          더 어려운 도전
        </GButton>
        {!(judged && last) && (
          <GButton onClick={() => restart()} className={BIG}>
            다시 하기
          </GButton>
        )}
      </div>
    </div>
  );
}
