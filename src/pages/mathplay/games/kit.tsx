// 게임 공통 도구. 모든 게임은 이 파일의 부품만 써서 모양을 맞춘다.
import { useEffect, useRef, type ReactNode } from "react";

/** 누르는 단추. primary=강조, ghost=테두리 */
export function GButton({ children, onClick, variant = "ghost", disabled, pressed, className = "", title }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "soft"; disabled?: boolean; pressed?: boolean; className?: string; title?: string }) {
  const style = {
    primary: "bg-accent text-accent-ink hover:brightness-110",
    soft: "bg-accent-soft text-accent hover:brightness-95",
    ghost: "border border-line bg-surface hover:bg-bg",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      title={title}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-card px-4 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${style} ${pressed ? "ring-2 ring-accent" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

/** 점수·상태를 보여 주는 작은 알약 */
export function Stat({ label, value, tone = "plain" }: { label: string; value: ReactNode; tone?: "plain" | "ok" | "bad" }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-bg text-ink";
  return (
    <span className={`inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 text-sm ${c}`}>
      <span className="text-xs opacity-70">{label}</span>
      <strong className="text-base font-extrabold tabular-nums">{value}</strong>
    </span>
  );
}

/** 안내·결과 말풍선. tone=ok 성공, bad 아쉬움, info 안내 */
export function Say({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "ok" | "bad" }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-accent-soft/70 text-ink";
  return (
    <p className={`rounded-card px-3 py-2 text-[0.95rem] font-semibold ${c}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

/** 슬라이더(범위 막대) 한 줄 */
export function Slider({ label, value, min, max, step = 1, onChange, show }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show?: (v: number) => string }) {
  return (
    <label className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
      <span className="w-28 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="h-6 min-w-[8rem] flex-1 accent-[var(--accent)]" />
      <span className="w-16 shrink-0 text-right tabular-nums text-muted">{show ? show(value) : value}</span>
    </label>
  );
}

/** requestAnimationFrame 반복. running 이 true 인 동안 매 프레임 cb(경과 초, 지난 프레임과의 간격 초)를 부른다. */
export function useFrame(cb: (t: number, dt: number) => void, running = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!running) return;
    let id = 0;
    let t0 = 0;
    let last = 0;
    const loop = (now: number) => {
      if (!t0) {
        t0 = now;
        last = now;
      }
      ref.current((now - t0) / 1000, Math.min(0.05, (now - last) / 1000));
      last = now;
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

/** 포인터(마우스·터치) 위치를 SVG 좌표(viewBox 기준)로 바꾼다 */
export function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number): [number, number] {
  const p = svg.createSVGPoint();
  p.x = clientX;
  p.y = clientY;
  const m = svg.getScreenCTM();
  if (!m) return [0, 0];
  const q = p.matrixTransform(m.inverse());
  return [q.x, q.y];
}

/** 캔버스를 화면 배율(devicePixelRatio)에 맞춰 선명하게 맞추고 그리기 좌표계는 CSS 픽셀로 쓰게 한다 */
export function fitCanvas(c: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** 게임 판을 감싸는 상자 */
export function Board({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-surface p-3 sm:p-4 ${className}`}>{children}</div>;
}

export const rand = (n: number) => Math.floor(Math.random() * n);
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

// ───── 게임 느낌 내기: 성공 효과(색종이·진동·소리) ─────
let soundOn = false;
try {
  soundOn = localStorage.getItem("penedu:mathplay:sound") === "1";
} catch {
  /* 저장소를 못 쓰는 환경이면 소리는 꺼 둔다 */
}
export const getSound = () => soundOn;
export const setSound = (v: boolean) => {
  soundOn = v;
  try {
    localStorage.setItem("penedu:mathplay:sound", v ? "1" : "0");
  } catch {
    /* 무시 */
  }
};

let audio: AudioContext | null = null;
function beep(freqs: number[], dur = 0.12, type: OscillatorType = "sine") {
  if (!soundOn) return;
  try {
    audio ??= new AudioContext();
    const t0 = audio.currentTime;
    freqs.forEach((f, i) => {
      const o = audio!.createOscillator();
      const g = audio!.createGain();
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(0.15, t0 + i * dur + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur);
      o.connect(g).connect(audio!.destination);
      o.start(t0 + i * dur);
      o.stop(t0 + (i + 1) * dur + 0.02);
    });
  } catch {
    /* 소리를 못 내면 조용히 넘어간다 */
  }
}
const vibrate = (p: number | number[]) => {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* 무시 */
  }
};

/** 작은 ‘톡’: 놓기·고르기 같은 짧은 반응 */
export function tick() {
  beep([740], 0.05);
  vibrate(8);
}
/** 아쉬움: 틀렸을 때(부드럽게) */
export function oops() {
  beep([260, 220], 0.12, "triangle");
  vibrate(40);
}
/** 성공! 색종이 + 진동 + 소리 */
export function cheer() {
  beep([523, 659, 784, 1047], 0.1);
  vibrate([30, 40, 30]);
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:80";
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = W * dpr;
  c.height = H * dpr;
  document.body.appendChild(c);
  const x = c.getContext("2d")!;
  x.scale(dpr, dpr);
  const colors = ["#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#eab308"];
  const ps = Array.from({ length: 70 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.45,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 11 - 3,
    r: Math.random() * 6 + 3,
    c: colors[Math.floor(Math.random() * colors.length)],
    a: Math.random() * 6,
  }));
  const t0 = performance.now();
  const loop = (now: number) => {
    const t = (now - t0) / 1000;
    x.clearRect(0, 0, W, H);
    for (const p of ps) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.2;
      x.save();
      x.globalAlpha = Math.max(0, 1 - t / 1.4);
      x.translate(p.x, p.y);
      x.rotate(p.a);
      x.fillStyle = p.c;
      x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      x.restore();
    }
    if (t < 1.4) requestAnimationFrame(loop);
    else c.remove();
  };
  requestAnimationFrame(loop);
}
