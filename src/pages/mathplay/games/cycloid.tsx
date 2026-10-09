import { useCallback, useRef, useState } from "react";
import { Board, GButton, Say, Slider, Stat, clamp, rand, svgPoint, useFrame } from "./kit";

// <pure>
/** 반지름 r 인 원이 θ(라디안)만큼 구른 뒤, 중심에서 d·r 떨어진 점의 위치 (x는 오른쪽, y는 땅 위 높이) */
function trochoidPoint(r: number, d: number, th: number): [number, number] {
  return [r * (th - d * Math.sin(th)), r * (1 - d * Math.cos(th))];
}
const circumference = (r: number) => 2 * Math.PI * r;
const archWidth = (r: number) => 2 * Math.PI * r;
const archHeight = (r: number) => 2 * r;
// </pure>

type Kind = "dist" | "width" | "height";
type Quest = { r: number; kind: Kind };

const W = 720;
const H = 250;
const R = 48; // 화면에서 원의 반지름(px)
const X0 = 60;
const GY = 140; // 땅 높이(y)
const TURNS = 2;
const TH_MAX = TURNS * 2 * Math.PI;

function newQuest(): Quest {
  const kinds: Kind[] = ["dist", "width", "height"];
  return { r: 2 + rand(8), kind: kinds[rand(3)] };
}

function questText(q: Quest) {
  if (q.kind === "dist") return `반지름이 ${q.r} cm 인 원이 한 바퀴 굴렀어요. 원의 중심은 몇 cm 나아갔을까요? (π = 3.14)`;
  if (q.kind === "width") return `반지름이 ${q.r} cm 인 원 위의 점이 그리는 사이클로이드 아치 하나의 너비는 몇 cm 일까요? (π = 3.14)`;
  return `반지름이 ${q.r} cm 인 원 위의 점이 그리는 사이클로이드 아치의 높이는 몇 cm 일까요?`;
}

export default function CycloidGame() {
  const [th, setTh] = useState(0);
  const [d, setD] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [quest, setQuest] = useState<Quest>(newQuest);
  const [ans, setAns] = useState("");
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "원을 끌어서 굴려 보거나 ‘굴리기’를 눌러 보세요. 한 바퀴를 굴린 뒤 문제에 답해 봐요." });
  const [score, setScore] = useState({ ok: 0, tries: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  useFrame((_t, dt) => {
    setTh((v) => {
      const n = v + dt * 1.6;
      if (n >= TH_MAX) {
        setPlaying(false);
        return TH_MAX;
      }
      return n;
    });
  }, playing);

  const setFromPointer = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x] = svgPoint(svg, cx, cy);
    let v = clamp((x - X0) / R, 0, TH_MAX);
    for (const k of [2 * Math.PI, 4 * Math.PI]) if (Math.abs(v - k) < 0.1) v = k; // 한 바퀴 위치에 달라붙게
    setTh(v);
  }, []);

  const doneTurn = th >= 2 * Math.PI - 0.02;
  const cx = X0 + R * th;
  const cy = GY - R;
  const [px, py] = trochoidPoint(R, d, th);
  const penX = X0 + px;
  const penY = GY - py;

  // 자취
  const pts: string[] = [];
  const steps = Math.max(2, Math.ceil(th / 0.05));
  for (let i = 0; i <= steps; i++) {
    const t = (th * i) / steps;
    const [x, y] = trochoidPoint(R, d, t);
    pts.push(`${(X0 + x).toFixed(1)},${(GY - y).toFixed(1)}`);
  }
  const rollDist = R * th; // 중심이 나아간 화면 거리
  const circ = circumference(R);

  const check = () => {
    const v = parseFloat(ans.replace(",", "."));
    if (!isFinite(v)) {
      setMsg({ t: "bad", s: "숫자로 답을 써 주세요." });
      return;
    }
    if (!doneTurn) {
      setMsg({ t: "info", s: "먼저 원을 한 바퀴(위 막대의 2π 표시) 이상 굴려 보고 답해 봐요." });
      return;
    }
    const want = quest.kind === "height" ? archHeight(quest.r) : quest.kind === "width" ? archWidth(quest.r) : circumference(quest.r);
    const tol = quest.kind === "height" ? 0.01 : 0.5;
    const ok = Math.abs(v - want) <= tol;
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), tries: s.tries + 1 }));
    if (ok) {
      setMsg({
        t: "ok",
        s:
          quest.kind === "height"
            ? `맞아요! 아치의 높이는 지름 2r = ${want} cm 예요. 점이 맨 위에 왔을 때가 가장 높아요.`
            : `맞아요! 한 바퀴 구르면 원둘레만큼 나아가요. 2π × ${quest.r} ≈ ${want.toFixed(2)} cm 예요.`,
      });
    } else {
      setMsg({
        t: "bad",
        s:
          quest.kind === "height"
            ? "아쉬워요. 점이 가장 높이 올라가는 때를 찾아봐요. 원의 지름과 같아요(d/r = 1 일 때)."
            : "아쉬워요. 한 바퀴 구르면 원둘레(2πr)만큼 나아가요. 위 그림에서 펴 놓은 원둘레와 비교해 봐요.",
      });
    }
  };
  const next = () => {
    const q = newQuest();
    setQuest(q);
    setAns("");
    setTh(0);
    setPlaying(false);
    if (q.kind !== "dist") setD(1);
    setMsg({ t: "info", s: "새 문제예요. 원을 한 바퀴 굴린 뒤 답해 봐요." });
  };

  const barW = 2 * Math.PI * R;
  return (
    <div className="space-y-3">
      <Board>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="수평선 위를 굴러가는 원과 원 위 점이 그리는 자취"
          className="block w-full select-none rounded-card bg-bg"
          style={{ touchAction: "none", cursor: "ew-resize" }}
          onPointerDown={(e) => {
            dragging.current = true;
            setPlaying(false);
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            setFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => dragging.current && setFromPointer(e.clientX, e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* 땅 */}
          <line x1={10} y1={GY} x2={W - 10} y2={GY} stroke="#64748b" strokeWidth={2} />
          {/* 한 바퀴마다 눈금 */}
          {Array.from({ length: TURNS + 1 }, (_, i) => (
            <g key={i}>
              <line x1={X0 + i * circ} y1={GY - 4} x2={X0 + i * circ} y2={GY + 6} stroke="#64748b" strokeWidth={2} />
              <text x={X0 + i * circ} y={GY + 20} textAnchor="middle" fontSize={12} fill="#64748b">
                {i === 0 ? "출발" : `${i}바퀴`}
              </text>
            </g>
          ))}
          {/* 굴러온 길 표시 */}
          <line x1={X0} y1={GY} x2={X0 + rollDist} y2={GY} stroke="#0ea5e9" strokeWidth={5} strokeLinecap="round" />
          {/* 자취 */}
          <polyline points={pts.join(" ")} fill="none" stroke="#ef4444" strokeWidth={2.5} strokeLinejoin="round" />
          {/* 원 */}
          <circle cx={cx} cy={cy} r={R} fill="#38bdf8" fillOpacity={0.18} stroke="#0284c7" strokeWidth={2} />
          <line x1={cx} y1={cy} x2={penX} y2={penY} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" />
          <circle cx={cx} cy={cy} r={3} fill="#0284c7" />
          {/* 중심이 지나온 길 */}
          <line x1={X0} y1={cy} x2={cx} y2={cy} stroke="#0284c7" strokeOpacity={0.4} strokeDasharray="3 4" />
          <circle cx={penX} cy={penY} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />

          {/* 원둘레를 펴 보이기 */}
          <text x={X0} y={H - 52} fontSize={12} fill="#64748b">
            원둘레를 길 위에 펴 보면 (2πr)
          </text>
          <rect x={X0} y={H - 44} width={barW} height={10} rx={5} fill="none" stroke="#0284c7" strokeWidth={1.5} />
          <rect x={X0} y={H - 44} width={Math.min(barW, rollDist)} height={10} rx={5} fill="#0ea5e9" />
          <text x={X0 + barW + 8} y={H - 35} fontSize={12} fill="#0284c7" fontWeight={700}>
            2πr
          </text>
          <text x={X0} y={H - 14} fontSize={12} fill="#64748b">
            중심이 나아간 거리 = {(rollDist / R).toFixed(2)} r {th >= 2 * Math.PI - 0.005 && th <= 2 * Math.PI + 0.005 ? "(한 바퀴!)" : ""}
          </text>
        </svg>

        <div className="mt-3 space-y-1">
          <Slider label="굴리기 (끌기)" value={th} min={0} max={TH_MAX} step={0.01} onChange={(v) => { setPlaying(false); setTh(v); }} show={(v) => `${(v / (2 * Math.PI)).toFixed(2)}바퀴`} />
          <Slider label="점 위치 d/r" value={d} min={0} max={1.5} step={0.05} onChange={setD} show={(v) => (v === 0 ? "중심" : v < 1 ? `안 ${v.toFixed(2)}` : v === 1 ? "원 위" : `밖 ${v.toFixed(2)}`)} />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <GButton variant="primary" onClick={() => { if (th >= TH_MAX) setTh(0); setPlaying((p) => !p); }}>
            {playing ? "멈추기" : "굴리기"}
          </GButton>
          <GButton onClick={() => { setPlaying(false); setTh(0); }}>다시 하기</GButton>
          <GButton variant="soft" onClick={() => { setPlaying(false); setTh(2 * Math.PI); }}>한 바퀴 위치로</GButton>
        </div>
        <p className="mt-2 text-sm text-muted">
          d/r = 1 이면 원 위의 점(사이클로이드), 1보다 작으면 원 안쪽, 크면 원 바깥쪽 점이에요. 사이클로이드의 점은 (x, y) = r(θ − d·sinθ, 1 − d·cosθ) 에 있어요.
        </p>
      </Board>

      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="맞힌 문제" value={`${score.ok} / ${score.tries}`} tone={score.ok > 0 ? "ok" : "plain"} />
          <Stat label="지금 굴린 거리" value={`${(th / (2 * Math.PI)).toFixed(2)}바퀴`} />
        </div>
        <p className="font-semibold">{questText(quest)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={ans}
            onChange={(e) => setAns(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            aria-label="답"
            placeholder="답"
            className="min-h-[44px] w-28 rounded-card border border-line bg-surface px-3 text-right tabular-nums"
          />
          <span className="text-sm text-muted">cm</span>
          <GButton variant="primary" onClick={check}>답 확인</GButton>
          <GButton onClick={next}>새 문제</GButton>
        </div>
        <div className="mt-3">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
      </Board>
    </div>
  );
}
