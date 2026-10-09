import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Slider, Stat, clamp, fitCanvas, useFrame } from "./kit";

// ==PURE-START==
// 단위: 바퀴의 외접원 반지름 R = 1. n = 0 이면 원.
export type Road = "flat" | "bumpy";
/** 정n각형의 변까지의 거리(변심거리) a = cos(π/n) */
export const apothem = (n: number) => Math.cos(Math.PI / n);
/** 변의 길이 s = 2 sin(π/n) */
export const sideLen = (n: number) => 2 * Math.sin(Math.PI / n);
/** 올록볼록 길 한 조각(뒤집힌 현수선 y = -a cosh(x/a))의 가로 반폭: 호의 길이 2a sinh(w/a) 가 변의 길이와 같도록 */
export const archHalf = (n: number) => apothem(n) * Math.asinh(Math.tan(Math.PI / n));
/** 평평한 길에서 중심 높이가 오르내리는 폭 (R에 대한 비율) */
export const wiggle = (n: number, road: Road) => (n === 0 || road === "bumpy" ? 0 : 1 - Math.cos(Math.PI / n));
/** 올록볼록 길이 맞게 걸리는 바퀴인가 (정삼각형은 변이 너무 길어서 이웃 둔덕에 걸려요) */
export const bumpyFits = (n: number) => n >= 4;
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** 길의 높이 (가장 낮은 곳을 0으로) */
export function roadY(n: number, road: Road, X: number): number {
  if (road === "flat" || n === 0) return 0;
  const a = apothem(n);
  const w = archHalf(n);
  const u = mod(X + w, 2 * w) - w;
  return 1 - a * Math.cosh(u / a);
}
/** 중심이 가로로 x만큼 갔을 때 중심의 높이 h와 꼭짓점 하나의 각도 rot (나머지는 2π/n씩) */
export function pose(n: number, road: Road, x: number): { h: number; rot: number } {
  if (n === 0) return { h: 1, rot: -x };
  if (road === "flat") {
    const s = sideLen(n);
    const dx = x - Math.round(x / s) * s;
    const th = Math.asin(dx);
    return { h: Math.cos(th), rot: -Math.PI / 2 - th };
  }
  const a = apothem(n);
  const w = archHalf(n);
  const u = mod(x + w, 2 * w) - w;
  return { h: 1, rot: -Math.PI / 2 + Math.PI / n + Math.atan(-Math.sinh(u / a)) };
}
// ==PURE-END==

const NAMES: Record<number, string> = { 0: "원", 3: "정삼각형", 4: "정사각형", 5: "정오각형", 6: "정육각형", 7: "정칠각형", 8: "정팔각형" };
const GRAPH_H = 124;
const H_LO = 0.42;
const H_HI = 1.1;

function sceneH(W: number) {
  return clamp(W * 0.4, 150, 230);
}

function drawAll(c: HTMLCanvasElement, W: number, n: number, road: Road, x: number) {
  const Hs = sceneH(W);
  const H = Hs + GRAPH_H;
  const ctx = fitCanvas(c, W, H);
  const R = Hs * 0.3;
  const groundY = Hs - 18;
  const cx0 = W * 0.36;
  const toX = (X: number) => cx0 + (X - x) * R;
  const fromSx = (sx: number) => x + (sx - cx0) / R;

  // 하늘
  const g = ctx.createLinearGradient(0, 0, 0, Hs);
  g.addColorStop(0, "#e0f2fe");
  g.addColorStop(1, "#f0f9ff");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Hs);

  // 길
  ctx.beginPath();
  ctx.moveTo(0, Hs);
  for (let sx = 0; sx <= W + 2; sx += 2) ctx.lineTo(sx, groundY - roadY(n, road, fromSx(sx)) * R);
  ctx.lineTo(W, Hs);
  ctx.closePath();
  ctx.fillStyle = "#a8a29e";
  ctx.fill();
  ctx.beginPath();
  for (let sx = 0; sx <= W + 2; sx += 2) {
    const yy = groundY - roadY(n, road, fromSx(sx)) * R;
    if (sx === 0) ctx.moveTo(sx, yy);
    else ctx.lineTo(sx, yy);
  }
  ctx.strokeStyle = "#57534e";
  ctx.lineWidth = 3;
  ctx.stroke();
  // 길이 움직이는 것이 보이도록 눈금
  ctx.strokeStyle = "rgba(68,64,60,0.35)";
  ctx.lineWidth = 2;
  const step = 0.5;
  for (let X = Math.floor(fromSx(0) / step) * step; toX(X) < W + 4; X += step) {
    const sx = toX(X);
    const yy = groundY - roadY(n, road, X) * R;
    ctx.beginPath();
    ctx.moveTo(sx, yy + 6);
    ctx.lineTo(sx, yy + 14);
    ctx.stroke();
  }
  // 평평한 길에서 꼭짓점이 땅에 닿는 자리 표시
  if (road === "flat" && n > 0) {
    const s = sideLen(n);
    ctx.fillStyle = "#b45309";
    for (let k = Math.floor(fromSx(0) / s); toX(k * s) < W + 4; k++) {
      ctx.beginPath();
      ctx.arc(toX(k * s), groundY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 바퀴
  const { h, rot } = pose(n, road, x);
  const cy = groundY - h * R;
  // 가장 높을 때 기준선
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, groundY - R);
  ctx.lineTo(W, groundY - R);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ef4444";
  ctx.font = "600 11px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("중심 높이 1", 6, groundY - R - 4);

  ctx.beginPath();
  if (n === 0) ctx.arc(cx0, cy, R, 0, Math.PI * 2);
  else
    for (let k = 0; k < n; k++) {
      const al = rot + (k * 2 * Math.PI) / n;
      const px = cx0 + R * Math.cos(al);
      const py = cy - R * Math.sin(al);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  if (n !== 0) ctx.closePath();
  ctx.fillStyle = "rgba(251,191,36,0.85)";
  ctx.fill();
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
  // 돌아가는 것이 보이는 바퀴살
  ctx.beginPath();
  ctx.moveTo(cx0, cy);
  ctx.lineTo(cx0 + R * 0.95 * Math.cos(rot), cy - R * 0.95 * Math.sin(rot));
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx0, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#1f2937";
  ctx.fill();

  // 그래프
  const gy0 = Hs;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, gy0, W, GRAPH_H);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, gy0 + 0.5, W - 1, GRAPH_H - 1);
  const top = gy0 + 26;
  const bot = gy0 + GRAPH_H - 12;
  const gyOf = (hh: number) => bot - ((hh - H_LO) / (H_HI - H_LO)) * (bot - top);
  const lowH = n === 0 || road === "bumpy" ? 1 : apothem(n);
  ctx.font = "600 11px sans-serif";
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(0, gyOf(1));
  ctx.lineTo(W, gyOf(1));
  ctx.stroke();
  if (lowH < 1) {
    ctx.strokeStyle = "#2563eb";
    ctx.beginPath();
    ctx.moveTo(0, gyOf(lowH));
    ctx.lineTo(W, gyOf(lowH));
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.fillStyle = "#ef4444";
  ctx.textAlign = "right";
  ctx.fillText("1", W - 6, gyOf(1) - 3);
  if (lowH < 1) {
    ctx.fillStyle = "#2563eb";
    ctx.fillText(lowH.toFixed(2), W - 6, gyOf(lowH) + 12);
  }
  ctx.fillStyle = "#334155";
  ctx.textAlign = "left";
  ctx.font = "700 12px sans-serif";
  const wg = wiggle(n, road);
  ctx.fillText(`중심 높이 그래프 · 흔들림 폭 ${(wg * 100).toFixed(1)}%`, 8, gy0 + 16);
  // 자취: 지나온 곳은 굵게, 앞으로 갈 곳은 연하게
  const draw = (from: number, to: number, color: string, lw: number) => {
    ctx.beginPath();
    let started = false;
    for (let sx = Math.max(0, from); sx <= Math.min(W, to); sx += 2) {
      const X = fromSx(sx);
      const yy = gyOf(pose(n, road, X).h);
      if (!started) {
        ctx.moveTo(sx, yy);
        started = true;
      } else ctx.lineTo(sx, yy);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  const sx0 = toX(0);
  draw(0, sx0, "#cbd5e1", 2);
  draw(sx0, cx0, "#2563eb", 3.5);
  draw(cx0, W, "#cbd5e1", 2);
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx0, cy + R + 2 > Hs ? Hs : cy + R + 2);
  ctx.lineTo(cx0, gyOf(h));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx0, gyOf(h), 5, 0, Math.PI * 2);
  ctx.fillStyle = "#1d4ed8";
  ctx.fill();
}

type Msg = { tone: "info" | "ok" | "bad"; text: string };

export default function WheelGame() {
  const [n, setN] = useState(4);
  const [road, setRoad] = useState<Road>("flat");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [m1, setM1] = useState(false);
  const [m2, setM2] = useState(false);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "‘굴리기’를 눌러 보세요. 정사각형 바퀴는 평평한 길에서 어떻게 굴러갈까요?" });
  const [W, setW] = useState(600);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const xRef = useRef(0);
  const distRef = useRef(0);
  const drag = useRef<{ px: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const upd = () => setW(Math.max(280, Math.floor(el.clientWidth)));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const paint = () => {
    const c = canvasRef.current;
    if (c) drawAll(c, W, n, road, xRef.current);
  };

  useEffect(() => {
    paint();
  });

  useFrame((_, dt) => {
    const v = speed * 0.3;
    xRef.current += v * dt;
    distRef.current += v * dt;
    paint();
    if (distRef.current >= 6) {
      if (road === "flat" && wiggle(n, road) <= 0.1 && !m1) {
        setM1(true);
        setMsg({ tone: "ok", text: `미션 1 성공! ${NAMES[n]} 바퀴는 평평한 길에서 중심이 ${(wiggle(n, road) * 100).toFixed(1)}%만 흔들려요. 변이 많을수록 원에 가까워져요.` });
      }
      if (road === "bumpy" && n === 4 && !m2) {
        setM2(true);
        setMsg({ tone: "ok", text: "미션 2 성공! 네모 바퀴가 올록볼록한 길 위에서 중심 높이가 늘 1로 일정해요. 흔들림이 없어요." });
      }
    }
  }, running);

  const resetDist = () => {
    distRef.current = 0;
  };

  const pickN = (k: number) => {
    let r = road;
    if (!bumpyFits(k) && road === "bumpy") r = "flat";
    setN(k);
    setRoad(r);
    resetDist();
    const w = wiggle(k, r);
    const base = k === 0 ? "원 바퀴는 어디서나 중심 높이가 1로 일정해요." : `${NAMES[k]} 바퀴(변 ${k}개): 평평한 길에서 중심 높이가 ${apothem(k).toFixed(3)}~1 사이를 오르내려요.`;
    setMsg({ tone: "info", text: r === "bumpy" ? `${NAMES[k]} 바퀴에 꼭 맞는 올록볼록 길로 바뀌었어요. 중심 높이는 늘 1이에요.` : `${base}${k ? ` 흔들림 폭 ${(w * 100).toFixed(1)}%.` : ""}` });
    if (!bumpyFits(k) && road === "bumpy") setMsg({ tone: "info", text: `${NAMES[k]} 바퀴는 올록볼록 길에 맞지 않아 평평한 길로 바꿨어요.` });
  };

  const pickRoad = (r: Road) => {
    if (r === "bumpy" && !bumpyFits(n)) {
      setMsg({ tone: "bad", text: n === 0 ? "원은 평평한 길이 가장 잘 맞아요." : "정삼각형은 변이 너무 길어서 올록볼록 길의 이웃 둔덕에 걸려요. 변이 4개 이상인 바퀴로 해 보세요." });
      return;
    }
    setRoad(r);
    resetDist();
    setMsg(r === "bumpy" ? { tone: "info", text: `${NAMES[n]} 바퀴 한 변의 길이와 둔덕 한 조각의 곡선 길이가 같아요. 굴려서 중심 높이 그래프를 봐요.` } : { tone: "info", text: "평평한 길이에요. 꼭짓점이 땅에 닿을 때마다 중심이 올라갔다 내려와요." });
  };

  const restart = () => {
    setRunning(false);
    xRef.current = 0;
    resetDist();
    setM1(false);
    setM2(false);
    setMsg({ tone: "info", text: "처음으로 돌아왔어요. 바퀴와 길을 골라 굴려 보세요. 화면을 끌어서 직접 굴릴 수도 있어요." });
  };

  const onDown = (e: React.PointerEvent) => {
    drag.current = { px: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const R = sceneH(W) * 0.3;
    xRef.current -= (e.clientX - drag.current.px) / R;
    drag.current.px = e.clientX;
    paint();
  };
  const onUp = () => {
    drag.current = null;
  };

  const w = wiggle(n, road);
  const H = sceneH(W) + GRAPH_H;
  const bars = [3, 4, 5, 6, 7, 8, 0];

  return (
    <div className="space-y-3">
      <Board>
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="바퀴 모양 고르기">
          <span className="text-sm font-semibold">바퀴</span>
          {bars.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pickN(k)}
              aria-pressed={k === n}
              aria-label={k === 0 ? "원 바퀴" : `변 ${k}개 바퀴`}
              className={`h-11 min-w-[44px] rounded-card px-3 text-base font-bold ${k === n ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:bg-bg"}`}
            >
              {k === 0 ? "원" : k}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="길 모양 고르기">
          <span className="text-sm font-semibold">길 모양</span>
          <GButton variant={road === "flat" ? "soft" : "ghost"} pressed={road === "flat"} onClick={() => pickRoad("flat")} className="text-sm">평평한 길</GButton>
          <GButton variant={road === "bumpy" ? "soft" : "ghost"} pressed={road === "bumpy"} onClick={() => pickRoad("bumpy")} className="text-sm">올록볼록 길 (현수선)</GButton>
        </div>

        <div ref={wrapRef} className="w-full overflow-hidden rounded-card border border-line">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${NAMES[n]} 바퀴가 ${road === "flat" ? "평평한" : "올록볼록한"} 길을 구르는 모습과 중심 높이 그래프. 흔들림 폭 ${(w * 100).toFixed(1)}퍼센트`}
            style={{ width: W, height: H, display: "block", touchAction: "pan-y", cursor: "grab" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
        </div>

        <div className="mt-3">
          <Slider label="굴러가는 속도" value={speed} min={1} max={10} onChange={setSpeed} show={(v) => `${v}단계`} />
        </div>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="흔들림 폭" value={`${(w * 100).toFixed(1)}%`} tone={w === 0 ? "ok" : "plain"} />
        <Stat label="미션" value={`${(m1 ? 1 : 0) + (m2 ? 1 : 0)}/2`} tone={m1 && m2 ? "ok" : "plain"} />
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton variant="primary" onClick={() => setRunning(!running)}>{running ? "■ 멈추기" : "▶ 굴리기"}</GButton>
        <GButton onClick={restart}>↻ 다시</GButton>
      </div>

      <Board>
        <h3 className="mb-2 text-sm font-bold">미션</h3>
        <ul className="space-y-1 text-sm">
          <li className={m1 ? "font-semibold text-ok" : ""}>{m1 ? "✔" : "○"} 평평한 길에서 흔들림 폭을 10% 이하로 만들어 굴려 보세요. 바퀴의 변은 몇 개가 필요할까요?</li>
          <li className={m2 ? "font-semibold text-ok" : ""}>{m2 ? "✔" : "○"} 네모 바퀴(변 4개)를 흔들림 없이 굴려 보세요.</li>
        </ul>
      </Board>

      <Board>
        <h3 className="mb-2 text-sm font-bold">평평한 길에서 바퀴마다 흔들리는 폭 (바퀴 반지름 기준)</h3>
        <ul className="space-y-1.5">
          {bars.map((k) => {
            const v = wiggle(k, "flat");
            return (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0">{k === 0 ? "원" : `변 ${k}개`}</span>
                <span className="h-4 flex-1 overflow-hidden rounded-full bg-bg">
                  <span className={`block h-full rounded-full ${k === n ? "bg-accent" : "bg-accent-soft"}`} style={{ width: `${Math.max(v / 0.5, 0.01) * 100}%` }} />
                </span>
                <span className="w-14 shrink-0 text-right tabular-nums text-muted">{(v * 100).toFixed(1)}%</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          정n각형 바퀴의 중심 높이는 cos(180°/n) 에서 1까지 오르내려서 흔들림 폭은 1 − cos(180°/n) 이에요. 올록볼록 길은 뒤집힌 현수선(y = −a·cosh(x/a), a는 중심에서 변까지의 거리) 조각을 이어 붙여 만들어요.
        </p>
      </Board>
    </div>
  );
}
