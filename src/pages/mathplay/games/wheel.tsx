import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Slider, Stat, cheer, clamp, fitCanvas, tick, useFrame } from "./kit";

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

const NAMES: Record<number, string> = { 0: "동그라미", 3: "세모", 4: "네모", 5: "오각형", 6: "육각형", 7: "칠각형", 8: "팔각형" };
const BIG = "min-h-[48px]! text-base";
/** 덜컹거림을 쉬운 말로 */
function bumpWord(w: number) {
  return w === 0 ? "매끈매끈" : w <= 0.1 ? "조금" : w <= 0.2 ? "덜컹덜컹" : "아주 많이";
}
const GRAPH_H = 124;
const H_LO = 0.42;
const H_HI = 1.1;

const R_FRAC = 0.25; // 바퀴 반지름 = 장면 높이 × R_FRAC
const FONT = "Jua, Pretendard Variable, sans-serif";

function sceneH(W: number) {
  return clamp(W * 0.45, 170, 250);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.ellipse(x, y, 30 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.arc(x - 12 * s, y - 7 * s, 12 * s, 0, Math.PI * 2);
  ctx.arc(x + 10 * s, y - 9 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawAll(c: HTMLCanvasElement, W: number, n: number, road: Road, x: number) {
  const Hs = sceneH(W);
  const H = Hs + GRAPH_H;
  const ctx = fitCanvas(c, W, H);
  const R = Hs * R_FRAC;
  const groundY = Hs - 24;
  const cx0 = W * 0.36;
  const toX = (X: number) => cx0 + (X - x) * R;
  const fromSx = (sx: number) => x + (sx - cx0) / R;
  const wrap = (v: number, m: number) => ((v % m) + m) % m;

  // 하늘·해·구름·언덕 (멀리 있는 것은 천천히 움직여요)
  const g = ctx.createLinearGradient(0, 0, 0, Hs);
  g.addColorStop(0, "#7dd3fc");
  g.addColorStop(1, "#e0f2fe");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Hs);
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W - 38, 34, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let k = 0; k < 3; k++) cloud(ctx, wrap(k * 260 + 80 - x * R * 0.25, W + 160) - 80, 28 + (k % 2) * 22, 0.8 + (k % 2) * 0.25);
  ctx.fillStyle = "#86efac";
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  for (let sx = 0; sx <= W + 4; sx += 4) ctx.lineTo(sx, groundY - R * 1.15 - Math.sin((sx + x * R * 0.5) / 70) * R * 0.25 - Math.sin((sx + x * R * 0.5) / 31) * R * 0.08);
  ctx.lineTo(W, groundY);
  ctx.closePath();
  ctx.fill();

  // 길: 흙 + 풀
  const roadAt = (sx: number) => groundY - roadY(n, road, fromSx(sx)) * R;
  const soil = ctx.createLinearGradient(0, groundY - R * 0.5, 0, Hs);
  soil.addColorStop(0, "#f59e0b");
  soil.addColorStop(1, "#92400e");
  ctx.beginPath();
  ctx.moveTo(0, Hs);
  for (let sx = 0; sx <= W + 2; sx += 2) ctx.lineTo(sx, roadAt(sx));
  ctx.lineTo(W, Hs);
  ctx.closePath();
  ctx.fillStyle = soil;
  ctx.fill();
  // 길이 움직이는 것이 보이도록 흙 속 조약돌
  const step = 0.5;
  for (let X = Math.floor(fromSx(0) / step) * step; toX(X) < W + 4; X += step) {
    const sx = toX(X);
    const yy = groundY - roadY(n, road, X) * R;
    ctx.fillStyle = Math.round(X / step) % 2 ? "#fde68a" : "#b45309";
    ctx.beginPath();
    ctx.ellipse(sx, yy + 12 + (Math.round(X / step) % 3) * 3, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  for (let sx = 0; sx <= W + 2; sx += 2) {
    if (sx === 0) ctx.moveTo(sx, roadAt(sx));
    else ctx.lineTo(sx, roadAt(sx));
  }
  ctx.strokeStyle = "#15803d";
  ctx.lineWidth = 7;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 3;
  ctx.stroke();
  // 평평한 길에서 꼭짓점이 땅에 닿는 자리 표시
  if (road === "flat" && n > 0) {
    const s = sideLen(n);
    ctx.fillStyle = "#ea580c";
    for (let k = Math.floor(fromSx(0) / s); toX(k * s) < W + 4; k++) {
      ctx.beginPath();
      ctx.arc(toX(k * s), groundY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 가장 높을 때 기준선
  const { h, rot } = pose(n, road, x);
  const cy = groundY - h * R;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY - R);
  ctx.lineTo(W, groundY - R);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `15px ${FONT}`;
  ctx.textAlign = "left";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#fff";
  ctx.strokeText("가장 높을 때", 6, groundY - R - 6);
  ctx.fillStyle = "#dc2626";
  ctx.fillText("가장 높을 때", 6, groundY - R - 6);

  // 수레: 바퀴 가운데에 붙어서 같이 오르내리고, 길이 기울면 같이 기울어요
  const wg = wiggle(n, road);
  const tilt = clamp(((pose(n, road, x + 0.04).h - pose(n, road, x - 0.04).h) / 0.08) * -0.35, -0.3, 0.3);
  ctx.save();
  ctx.translate(cx0, cy);
  ctx.rotate(tilt);
  const cartB = -R - 8;
  ctx.strokeStyle = "#6d28d9";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(-R * 0.4, cartB);
  ctx.moveTo(3, 0);
  ctx.lineTo(R * 0.4, cartB);
  ctx.stroke();
  // 운전사 병아리
  const hr = R * 0.32;
  const hy = cartB - R * 0.45 - hr * 0.55;
  ctx.fillStyle = "#fde047";
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-2, hy - hr);
  ctx.quadraticCurveTo(-6, hy - hr - 10, 2, hy - hr - 8);
  ctx.stroke();
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.arc(-hr * 0.38, hy - hr * 0.12, 2.6, 0, Math.PI * 2);
  ctx.arc(hr * 0.38, hy - hr * 0.12, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(251,113,133,0.6)";
  ctx.beginPath();
  ctx.arc(-hr * 0.62, hy + hr * 0.22, 3, 0, Math.PI * 2);
  ctx.arc(hr * 0.62, hy + hr * 0.22, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  if (wg > 0.2) ctx.ellipse(0, hy + hr * 0.3, 3.5, 4.5, 0, 0, Math.PI * 2);
  else {
    ctx.moveTo(-5, hy + hr * 0.12);
    ctx.lineTo(5, hy + hr * 0.12);
    ctx.lineTo(0, hy + hr * 0.42);
    ctx.closePath();
  }
  ctx.fill();
  // 수레 몸통
  const body = ctx.createLinearGradient(0, cartB - R * 0.45, 0, cartB);
  body.addColorStop(0, "#fb7185");
  body.addColorStop(1, "#e11d48");
  roundRect(ctx, -R * 0.95, cartB - R * 0.45, R * 1.9, R * 0.45, 8);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = "#9f1239";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  roundRect(ctx, -R * 0.8, cartB - R * 0.38, R * 1.6, 4, 2);
  ctx.fill();
  ctx.restore();

  // 바퀴
  const wf = ctx.createRadialGradient(cx0 - R * 0.3, cy - R * 0.3, R * 0.1, cx0, cy, R);
  wf.addColorStop(0, "#fef3c7");
  wf.addColorStop(0.6, "#fbbf24");
  wf.addColorStop(1, "#f59e0b");
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
  ctx.fillStyle = wf;
  ctx.fill();
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();
  // 바퀴살
  const spokes = n === 0 ? 6 : n;
  ctx.strokeStyle = "#c2410c";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let k = 0; k < spokes; k++) {
    const al = rot + (k * 2 * Math.PI) / spokes;
    const rr = n === 0 ? R * 0.9 : R * 0.92;
    ctx.moveTo(cx0, cy);
    ctx.lineTo(cx0 + rr * Math.cos(al), cy - rr * Math.sin(al));
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx0, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#7c2d12";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx0 - 2, cy - 2, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = "#fde68a";
  ctx.fill();

  // 그래프
  const gy0 = Hs;
  ctx.fillStyle = "#fff7ed";
  ctx.fillRect(0, gy0, W, GRAPH_H);
  ctx.strokeStyle = "#fdba74";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, gy0 + 1, W - 2, GRAPH_H - 2);
  const top = gy0 + 28;
  const bot = gy0 + GRAPH_H - 12;
  const gyOf = (hh: number) => bot - ((hh - H_LO) / (H_HI - H_LO)) * (bot - top);
  const lowH = n === 0 || road === "bumpy" ? 1 : apothem(n);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.5;
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
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = "#dc2626";
  ctx.textAlign = "right";
  ctx.fillText("높음", W - 6, gyOf(1) - 4);
  if (lowH < 1) {
    ctx.fillStyle = "#2563eb";
    ctx.fillText("낮음", W - 6, gyOf(lowH) + 15);
  }
  ctx.fillStyle = "#7c2d12";
  ctx.textAlign = "left";
  ctx.font = `16px ${FONT}`;
  ctx.fillText(`바퀴 가운데 점의 높이 (덜컹거림: ${bumpWord(wg)})`, 10, gy0 + 20);
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
    ctx.lineCap = "round";
    ctx.stroke();
  };
  const sx0 = toX(0);
  draw(0, sx0, "#c4b5fd", 2.5);
  draw(sx0, cx0, "#2563eb", 4);
  draw(cx0, W, "#c4b5fd", 2.5);
  ctx.setLineDash([2, 4]);
  ctx.strokeStyle = "#a78bfa";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx0, Math.min(Hs, cy + R + 2));
  ctx.lineTo(cx0, gyOf(h));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(cx0, gyOf(h), 6, 0, Math.PI * 2);
  ctx.fillStyle = "#1d4ed8";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

type Msg = { tone: "info" | "ok" | "bad"; text: string };

function Icon({ n }: { n: number }) {
  const r = 18;
  const pts = Array.from({ length: n }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / n;
    return `${22 + r * Math.cos(a)},${22 + r * Math.sin(a)}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 44 44" width="40" height="40" aria-hidden="true">
      <defs>
        <radialGradient id="wh-ic" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fef3c7" />
          <stop offset="0.6" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      {n === 0 ? <circle cx="22" cy="23" r={r} fill="#b45309" opacity="0.3" /> : null}
      {n === 0 ? <circle cx="22" cy="22" r={r} fill="url(#wh-ic)" stroke="#b45309" strokeWidth="3" /> : <polygon points={pts} fill="url(#wh-ic)" stroke="#b45309" strokeWidth="3" strokeLinejoin="round" />}
      <circle cx="22" cy="22" r="3.5" fill="#7c2d12" />
    </svg>
  );
}

const NEED = 4; // 미션 성공에 필요한 굴린 거리 (바퀴 반지름의 몇 배)

export default function WheelGame() {
  const [n, setN] = useState(4);
  const [road, setRoad] = useState<Road>("flat");
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [more, setMore] = useState(false);
  const [m1, setM1] = useState(false);
  const [m2, setM2] = useState(false);
  const [touched, setTouched] = useState(false);
  const [prog, setProg] = useState(0);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "바퀴를 손가락으로 쓱 밀어 봐요! 네모 바퀴는 어떻게 굴러갈까요?" });
  const [W, setW] = useState(600);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const xRef = useRef(0);
  const vRef = useRef(0);
  const distRef = useRef(0);
  const drag = useRef<{ px: number; t: number; v: number } | null>(null);
  const cfg = useRef({ n, road, m1, m2 });
  cfg.current = { n, road, m1, m2 };

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
    if (c) drawAll(c, W, cfg.current.n, cfg.current.road, xRef.current);
  };
  useEffect(() => {
    paint();
  });

  const addDist = (d: number) => {
    distRef.current += d;
    const p = Math.min(1, distRef.current / NEED);
    setProg((old) => (Math.floor(p * 20) !== Math.floor(old * 20) ? p : old));
    if (distRef.current < NEED) return;
    const { n: cn, road: cr, m1: a, m2: b } = cfg.current;
    if (cr === "flat" && wiggle(cn, cr) <= 0.1 && !a) {
      setM1(true);
      setMore(true);
      cheer();
      setMsg({ tone: "ok", text: `⭐ 미션 1 성공! ${NAMES[cn]} 바퀴는 거의 덜컹거리지 않아요. 변이 많을수록 동그라미에 가까워져요. 이제 미션 2에 도전해 봐요!` });
    }
    if (cr === "bumpy" && cn === 4 && !b) {
      setM2(true);
      cheer();
      setMsg({ tone: "ok", text: "⭐ 미션 2 성공! 네모 바퀴도 물결 길에서는 덜컹거리지 않고 매끈하게 굴러가요!" });
    }
  };

  useFrame((_, dt) => {
    if (drag.current) return;
    let v: number;
    if (running) {
      v = speed * 0.3;
      vRef.current = v;
    } else {
      vRef.current *= Math.exp(-1.5 * dt);
      if (Math.abs(vRef.current) < 0.03) vRef.current = 0;
      v = vRef.current;
    }
    if (v !== 0) {
      xRef.current += v * dt;
      addDist(Math.abs(v * dt));
      paint();
    }
  });

  const resetDist = () => {
    distRef.current = 0;
    setProg(0);
  };

  const pickN = (k: number) => {
    let r = road;
    const reroad = !bumpyFits(k) && road === "bumpy";
    if (reroad) r = "flat";
    tick();
    setN(k);
    setRoad(r);
    resetDist();
    const w = wiggle(k, r);
    setMsg({
      tone: "info",
      text: reroad
        ? `${NAMES[k]} 바퀴는 물결 길에 안 맞아서 평평한 길로 바꿨어요.`
        : r === "bumpy"
          ? `${NAMES[k]} 바퀴에 꼭 맞는 물결 길이에요. 쓱 밀어 봐요!`
          : k === 0
            ? "동그라미 바퀴는 언제나 높이가 그대로예요. 매끈매끈!"
            : `${NAMES[k]} 바퀴예요. 쓱 밀어 봐요! 덜컹거림: ${bumpWord(w)} (${(w * 100).toFixed(0)}%)`,
    });
  };

  const pickRoad = (r: Road) => {
    if (r === "bumpy" && !bumpyFits(n)) {
      setMsg({ tone: "bad", text: n === 0 ? "동그라미는 평평한 길이 어울려요." : "세모 바퀴는 변이 너무 길어서 물결 길에 걸려요. 변이 4개 이상인 바퀴로 해 봐요." });
      return;
    }
    tick();
    setRoad(r);
    resetDist();
    setMsg(r === "bumpy" ? { tone: "info", text: "물결 길이에요. 바퀴 한 변의 길이와 둔덕 하나의 길이가 같게 만든 길이에요. 쓱 밀어서 점의 높이를 봐요!" } : { tone: "info", text: "평평한 길이에요. 모서리가 땅에 닿을 때마다 가운데 점이 올라갔다 내려와요." });
  };

  const giveHint = () => {
    if (!m1) setMsg({ tone: "info", text: "힌트: 바퀴의 변을 7개나 8개로 바꿔서 쓱 밀어 보세요. 변이 많을수록 동그라미에 가까워져요!" });
    else setMsg({ tone: "info", text: "힌트: ‘네모’ 바퀴를 고르고 ‘물결 길’을 누른 다음 바퀴를 쓱 밀어요." });
  };

  const restart = () => {
    setRunning(false);
    xRef.current = 0;
    vRef.current = 0;
    resetDist();
    setM1(false);
    setM2(false);
    setMsg({ tone: "info", text: "처음으로 돌아왔어요. 바퀴를 쓱 밀어 봐요!" });
  };

  const onDown = (e: React.PointerEvent) => {
    setRunning(false);
    setTouched(true);
    vRef.current = 0;
    drag.current = { px: e.clientX, t: performance.now(), v: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const R = sceneH(W) * R_FRAC;
    const now = performance.now();
    const dX = (e.clientX - d.px) / R;
    const dtS = Math.max(0.008, (now - d.t) / 1000);
    xRef.current += dX;
    addDist(Math.abs(dX));
    d.v = d.v * 0.6 + (dX / dtS) * 0.4;
    d.px = e.clientX;
    d.t = now;
    paint();
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && performance.now() - d.t < 90) vRef.current = clamp(d.v, -6, 6);
  };

  const w = wiggle(n, road);
  const H = sceneH(W) + GRAPH_H;
  const shapes = [3, 4, 5, 6, 7, 8, 0];

  return (
    <div className="space-y-3 text-base">
      <p className="rounded-card bg-accent-soft px-3 py-2 font-bold">
        {m1 ? "미션 2: 네모 바퀴를 덜컹거리지 않게 굴려 봐요! (길 모양을 바꿔 봐요)" : "미션 1: 바퀴를 바꿔서 덜컹거림을 ‘조금’ 이하로 만들고 쓱 밀어 굴려 봐요!"}
      </p>
      <Board>
        <div className="mb-3 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="바퀴 모양 고르기">
          {shapes.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => pickN(k)}
              aria-pressed={k === n}
              aria-label={k === 0 ? "동그라미 바퀴" : `변 ${k}개 바퀴`}
              className={`flex min-h-[72px] flex-col items-center justify-center rounded-card px-1 py-1 text-sm font-bold shadow-sm ${k === n ? "bg-accent-soft ring-2 ring-accent" : "border border-line bg-surface hover:bg-bg"}`}
              style={{ touchAction: "manipulation" }}
            >
              <Icon n={k} />
              <span>{k === 0 ? "동그라미" : `${NAMES[k]}`}</span>
            </button>
          ))}
        </div>

        <div ref={wrapRef} className="relative w-full overflow-hidden rounded-card border border-line">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${NAMES[n]} 바퀴가 ${road === "flat" ? "평평한" : "물결"} 길 위에 있어요. 좌우로 끌면 굴러가요. 덜컹거림 ${bumpWord(w)}`}
            style={{ width: W, height: H, display: "block", touchAction: "none", cursor: "grab" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          />
          {!touched && !running && (
            <div className="pointer-events-none absolute left-[18%] top-[30%]">
              <style>{`@keyframes wh-nudge{0%{transform:translateX(0);opacity:0}15%{opacity:1}80%{transform:translateX(110px);opacity:1}100%{transform:translateX(130px);opacity:0}}`}</style>
              <div style={{ animation: "wh-nudge 1.6s ease-in-out infinite" }} className="rounded-full bg-white/90 px-3 py-1.5 text-base font-extrabold text-orange-700 shadow-md">
                👉 쓱 밀어 봐요!
              </div>
            </div>
          )}
        </div>

        <div className="mt-3" aria-label="미션 진행">
          <p className="mb-1 text-sm text-muted">굴린 거리 (가득 차면 미션 확인!)</p>
          <div className="h-4 overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(prog * 100)}%` }} />
          </div>
        </div>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="덜컹거림" value={`${bumpWord(w)} (${(w * 100).toFixed(0)}%)`} tone={w === 0 ? "ok" : "plain"} />
        <Stat label="⭐ 미션" value={`${(m1 ? 1 : 0) + (m2 ? 1 : 0)}/2`} tone={m1 && m2 ? "ok" : "plain"} />
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton variant={running ? "primary" : "soft"} onClick={() => { setRunning(!running); setTouched(true); }} className={BIG}>{running ? "■ 멈추기" : "▶ 저절로 굴러가기"}</GButton>
        <GButton onClick={restart} className={BIG}>↻ 다시 하기</GButton>
        <GButton variant="soft" onClick={giveHint} className={BIG}>💡 힌트 보기</GButton>
        <GButton pressed={more} onClick={() => setMore(!more)} className={BIG}>{more ? "어려운 도전 닫기" : "더 어려운 도전"}</GButton>
      </div>

      {more && (
        <Board className="space-y-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="길 모양 고르기">
            <span className="font-semibold">길 모양</span>
            <GButton variant={road === "flat" ? "soft" : "ghost"} pressed={road === "flat"} onClick={() => pickRoad("flat")} className={BIG}>평평한 길</GButton>
            <GButton variant={road === "bumpy" ? "soft" : "ghost"} pressed={road === "bumpy"} onClick={() => pickRoad("bumpy")} className={BIG}>물결 길</GButton>
          </div>
          <Slider label="저절로 굴러가는 속도" value={speed} min={1} max={10} onChange={setSpeed} show={(v) => `${v}단계`} />
        </Board>
      )}

      <Board>
        <h3 className="mb-2 text-base font-bold">바퀴마다 얼마나 덜컹거릴까? (평평한 길)</h3>
        <ul className="space-y-1.5">
          {shapes.map((k) => {
            const v = wiggle(k, "flat");
            return (
              <li key={k} className="flex items-center gap-2 text-base">
                <span className="w-20 shrink-0">{k === 0 ? "동그라미" : `변 ${k}개`}</span>
                <span className="h-4 flex-1 overflow-hidden rounded-full bg-bg">
                  <span className={`block h-full rounded-full ${k === n ? "bg-accent" : "bg-accent-soft"}`} style={{ width: `${Math.max(v / 0.5, 0.01) * 100}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-muted">{(v * 100).toFixed(0)}%</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 leading-relaxed text-muted">막대가 짧을수록 덜컹거림이 작아요. 변이 많아질수록 막대가 줄어드는 걸 봐요!</p>
      </Board>
    </div>
  );
}
