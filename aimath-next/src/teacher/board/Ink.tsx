// 판서 레이어: 펜 3색 · 형광펜(겹쳐 칠하기 multiply/screen) · 지우개. 켜져 있을 때만 입력을 가로채요.
// 획은 장면별로 메모리(InkBook)에만 두고 저장하지 않아요. 손바닥처럼 큰 터치는 무시해요.
import { useEffect, useRef, type PointerEvent as RPointerEvent } from "react";
import { farEnough, isPalm, toLogical, WIDTH, type InkColor, type InkPage, type InkTool, type Stroke } from "./ink.logic.ts";

export interface InkLayerProps {
  /** 논리 크기(px) */
  w: number;
  h: number;
  page: InkPage;
  /** 판서 켜짐(입력 가로채기) */
  active: boolean;
  tool: InkTool;
  color: InkColor;
  onAdd: (s: Stroke) => void;
}

function themeName(): string {
  try {
    return document.documentElement.getAttribute("data-theme") || "light";
  } catch {
    return "light";
  }
}

/** 색 열쇠 → 실제 색(테마에 맞춰) */
export function inkRgb(c: InkColor, theme: string): string {
  const dark = theme === "dark" || theme === "chalk";
  switch (c) {
    case "ink":
      return dark ? "#ffffff" : "#111827";
    case "red":
      return dark ? "#fca5a5" : "#dc2626";
    case "blue":
      return dark ? "#93c5fd" : "#1d4ed8";
    case "hl":
      return "#facc15";
  }
}

function strokePath(ctx: CanvasRenderingContext2D, s: Stroke, theme: string) {
  const p = s.pts;
  if (p.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.width;
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = inkRgb(s.color, theme);
    ctx.fillStyle = ctx.strokeStyle;
  }
  if (p.length === 2) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], s.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    // 가운데 점을 이어 부드럽게
    for (let i = 2; i < p.length - 2; i += 2) {
      const mx = (p[i] + p[i + 2]) / 2;
      const my = (p[i + 1] + p[i + 3]) / 2;
      ctx.quadraticCurveTo(p[i], p[i + 1], mx, my);
    }
    ctx.lineTo(p[p.length - 2], p[p.length - 1]);
    ctx.stroke();
  }
  ctx.restore();
}

function prep(c: HTMLCanvasElement | null, w: number, h: number, k: number): CanvasRenderingContext2D | null {
  if (!c) return null;
  const W = Math.round(w * k);
  const H = Math.round(h * k);
  if (c.width !== W) c.width = W;
  if (c.height !== H) c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  return ctx;
}

export function InkLayer(props: InkLayerProps) {
  const { w, h, page, active, tool, color, onAdd } = props;
  const hlRef = useRef<HTMLCanvasElement>(null);
  const penRef = useRef<HTMLCanvasElement>(null);
  const cur = useRef<{ id: number; s: Stroke } | null>(null);
  const k = typeof window !== "undefined" ? Math.min(2, Math.max(1, window.devicePixelRatio || 1)) : 1;

  const redraw = (extra?: Stroke) => {
    const theme = themeName();
    const a = prep(hlRef.current, w, h, k);
    const b = prep(penRef.current, w, h, k);
    if (!a || !b) return;
    a.clearRect(0, 0, w, h);
    b.clearRect(0, 0, w, h);
    const all = extra ? page.strokes.concat([extra]) : page.strokes;
    for (const s of all) {
      if (s.tool === "hl") strokePath(a, s, theme);
      else if (s.tool === "pen") strokePath(b, s, theme);
      else {
        strokePath(a, s, theme);
        strokePath(b, s, theme);
      }
    }
  };

  // 획 목록·테마가 바뀌면 다시 그려요
  useEffect(() => {
    redraw();
    let mo: MutationObserver | null = null;
    try {
      mo = new MutationObserver(() => redraw());
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch {
      mo = null;
    }
    return () => {
      if (mo) mo.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, w, h]);

  // 판서를 끄면(그리는 도중이어도) 그리던 획을 버려요. 꺼진 뒤에는 입력을 하나도 가로채지 않아요
  useEffect(() => {
    if (active || !cur.current) return;
    cur.current = null;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const pos = (e: RPointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    return toLogical(e.clientX, e.clientY, el.getBoundingClientRect(), w, h);
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (!active) return;
    if (isPalm(e.pointerType, e.width || 0, e.height || 0)) return;
    if (cur.current) return; // 한 번에 한 획
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    const [x, y] = pos(e);
    cur.current = { id: e.pointerId, s: { tool, color: tool === "hl" ? "hl" : color, width: WIDTH[tool], pts: [x, y] } };
    redraw(cur.current.s);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cur.current;
    if (!active || !c || c.id !== e.pointerId) return;
    e.preventDefault();
    const [x, y] = pos(e);
    if (!farEnough(c.s.pts, x, y)) return;
    c.s.pts.push(x, y);
    redraw(c.s);
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const c = cur.current;
    if (!c || c.id !== e.pointerId) return;
    cur.current = null;
    if (!active) return;
    onAdd({ ...c.s, pts: c.s.pts.slice() });
  };

  return (
    <div
      className={"bd-ink" + (active ? " is-on" : "") + (active ? " tool-" + tool : "")}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-hidden="true"
    >
      <canvas ref={hlRef} className="bd-ink-hl" style={{ width: w + "px", height: h + "px" }} />
      <canvas ref={penRef} className="bd-ink-pen" style={{ width: w + "px", height: h + "px" }} />
    </div>
  );
}
