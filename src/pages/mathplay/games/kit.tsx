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
