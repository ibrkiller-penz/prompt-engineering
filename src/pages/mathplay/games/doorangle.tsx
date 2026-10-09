import { useRef, useState } from "react";
import type { PointerEvent as RPointerEvent, KeyboardEvent as RKeyboardEvent } from "react";
import { Board, GButton, Say, Stat, clamp, svgPoint, useFrame } from "./kit";

// ==PURE==
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

export function pickGoals(n = 5): number[] {
  const a = [...GOALS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
// ==END==

const HX = 210;
const HY = 40;
const L = 150; // 문 길이
const R = 118; // 각도기 반지름
const rad = (d: number) => (d * Math.PI) / 180;
const pol = (r: number, d: number): [number, number] => [HX + r * Math.cos(rad(d)), HY + r * Math.sin(rad(d))];
const starText = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);

export default function DoorAngleGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const [goals, setGoals] = useState(() => pickGoals());
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState<number[]>([]);
  const [judged, setJudged] = useState(false);
  const [target, setTarget] = useState(0); // 내가 정한 각도
  const [cur, setCur] = useState(0); // 화면에 그려지는 각도(부드럽게 따라감)
  const [prot, setProt] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);

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

  const setFromPointer = (e: RPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setTarget(angleFromPoint(HX, HY, x, y));
  };
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (judged) return;
    drag.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromPointer(e);
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag.current && !judged) setFromPointer(e);
  };
  const up = () => {
    drag.current = false;
  };
  const key = (e: RKeyboardEvent) => {
    if (judged) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? -1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? 1 : 0;
    // 오른쪽·위 화살표는 문을 닫는 쪽, 왼쪽·아래는 여는 쪽
    if (step) {
      e.preventDefault();
      setTarget((t) => clamp(Math.round(t) + step * (e.shiftKey ? 10 : 1), 0, 180));
    } else if (e.key === "PageDown") setTarget((t) => clamp(Math.round(t) + 10, 0, 180));
    else if (e.key === "PageUp") setTarget((t) => clamp(Math.round(t) - 10, 0, 180));
  };

  const decide = () => {
    const err = reading - goal;
    const s = starsFor(err);
    setStars((a) => [...a, s]);
    setJudged(true);
    const diff = err === 0 ? "딱 맞았어요!" : `${Math.abs(err)}° ${err > 0 ? "더 열었어요" : "덜 열었어요"}.`;
    setMsg({ tone: s >= 2 ? "ok" : "bad", text: `목표 ${goal}°, 내 문은 ${reading}° → ${diff} ${starText(s)}` });
  };
  const next = () => {
    setRound((r) => r + 1);
    setJudged(false);
    setTarget(0);
    setMsg(null);
  };
  const restart = () => {
    setGoals(pickGoals());
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${round + 1}/${goals.length}`} />
        <Stat label="별" value={`${total}/${goals.length * 3}`} tone="ok" />
        {prot && <Stat label="모드" value="쉬운 모드" />}
      </div>

      <Board>
        <p className="mb-2 text-center text-lg font-extrabold">
          목표 각도 <span className="text-accent">{goal}°</span>
          {!showProt && <span className="ml-2 text-sm font-semibold text-muted">(각도기를 숨겼어요. 눈대중으로!)</span>}
        </p>
        <svg
          ref={svgRef}
          viewBox="0 0 420 215"
          className="mx-auto block w-full max-w-[560px] touch-none select-none rounded-card bg-bg"
          style={{ touchAction: "none", cursor: judged ? "default" : "grab" }}
          role="slider"
          tabIndex={0}
          aria-label="문 열기. 끌어서 문을 열어요. 화살표 키로도 조절할 수 있어요."
          aria-valuemin={0}
          aria-valuemax={180}
          aria-valuenow={reading}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        >
          {/* 방 바닥 */}
          <rect x="0" y={HY} width="420" height="175" fill="#f1ead9" />
          <text x="26" y="205" fontSize="11" fill="#8a7a55">위에서 내려다본 방</text>
          {/* 문이 지나는 길 */}
          <path d={`M ${HX + L} ${HY} A ${L} ${L} 0 0 1 ${HX - L} ${HY}`} fill="none" stroke="#b9a77a" strokeWidth="1" strokeDasharray="3 4" />
          {/* 벽 */}
          <rect x="0" y={HY - 12} width={HX} height="12" fill="#6b7280" />
          <rect x={HX + L} y={HY - 12} width={420 - HX - L} height="12" fill="#6b7280" />
          <text x="14" y={HY - 16} fontSize="11" fill="#6b7280">벽</text>
          {/* 문틀 */}
          <rect x={HX - 4} y={HY - 12} width="8" height="20" fill="#374151" />
          <rect x={HX + L - 4} y={HY - 12} width="8" height="20" fill="#374151" />

          {/* 각도기 */}
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
                  <text key={d} x={x} y={y + 4} fontSize="11" fontWeight="700" textAnchor="middle" fill="#0369a1">
                    {d}
                  </text>
                );
              })}
              {/* 목표 표시는 하지 않고, 지금 각도 부채꼴만 */}
              {a > 0.5 && <path d={`M ${HX} ${HY} L ${pol(44, 0)[0]} ${pol(44, 0)[1]} A 44 44 0 0 1 ${pol(44, a)[0]} ${pol(44, a)[1]} Z`} fill="rgba(250,204,21,0.45)" stroke="#ca8a04" strokeWidth="1" />}
            </g>
          )}

          {/* 문 */}
          <g>
            <line x1={HX} y1={HY} x2={tip[0]} y2={tip[1]} stroke="transparent" strokeWidth="40" strokeLinecap="round" />
            <line x1={HX} y1={HY} x2={tip[0]} y2={tip[1]} stroke="#92400e" strokeWidth="9" strokeLinecap="round" />
            <line x1={HX} y1={HY} x2={tip[0]} y2={tip[1]} stroke="#b45309" strokeWidth="5" strokeLinecap="round" />
            <circle cx={pol(L - 14, a)[0]} cy={pol(L - 14, a)[1]} r="4" fill="#fcd34d" stroke="#92400e" />
            <circle cx={tip[0]} cy={tip[1]} r="10" fill="#fff" fillOpacity="0.55" stroke="#92400e" strokeWidth="1.5" />
          </g>
          {/* 경첩 */}
          <circle cx={HX} cy={HY} r="6" fill="#1f2937" />
          <circle cx={HX} cy={HY} r="2" fill="#fbbf24" />
          <text x={HX + 9} y={HY - 14} fontSize="11" fill="#374151">경첩</text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {showProt ? (
            <p className="text-base font-bold" aria-live="polite">
              지금 문 각도: <span className="text-accent tabular-nums">{reading}°</span>
            </p>
          ) : (
            <p className="text-sm text-muted">문을 끌어서 열어 보세요. (키보드: 화살표)</p>
          )}
        </div>
      </Board>

      <div className="flex flex-wrap gap-2">
        <GButton pressed={prot} onClick={() => setProt((p) => !p)} title="각도기를 켜면 지금 각도를 읽을 수 있어요">
          각도 읽기 {prot ? "끄기" : "켜기"}
        </GButton>
        {!judged && (
          <GButton variant="primary" onClick={decide}>
            이 각도로 정했어요
          </GButton>
        )}
        {judged && !last && (
          <GButton variant="primary" onClick={next}>
            다음 라운드
          </GButton>
        )}
        <GButton onClick={restart}>다시 하기</GButton>
      </div>

      {msg && <Say tone={msg.tone}>{msg.text}</Say>}
      {judged && last && (
        <Say tone={total >= 12 ? "ok" : "info"}>
          5라운드 끝! 모두 {total}점 / {goals.length * 3}점이에요. {total >= 12 ? "각도 눈대중 달인이에요!" : "각도기를 끄고 한 번 더 도전해 봐요."}
        </Say>
      )}
      {!msg && <Say>문을 끌어 목표 각도에 맞추고 ‘정했어요’를 눌러요. 오차가 작을수록 별이 많아요. (3개: 4° 이내, 2개: 10° 이내)</Say>}
    </div>
  );
}
