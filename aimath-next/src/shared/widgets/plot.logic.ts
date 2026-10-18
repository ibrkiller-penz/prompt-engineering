// 그래프 그리기에 쓰는 순수 계산(DOM 없음): 눈금, 좌표 변환, 계열 모양, 숫자 표기, 읽어 줄 요약.

export interface XY {
  x: number;
  y: number;
}

export type SeriesNo = 1 | 2 | 3 | 4 | 5;
export type Marker = "circle" | "square" | "triangle" | "diamond" | "cross";

/** 계열 s1~s5 는 색만으로 구분하지 않아요: 색 + 선 모양 + 표식 */
export interface SeriesStyle {
  cls: string; // CSS 클래스(색은 CSS 변수 --s1..--s5)
  dash: string; // stroke-dasharray("" 이면 실선)
  marker: Marker;
  name: string; // 선 모양 이름(표·읽어 주기용)
}

const STYLES: Record<SeriesNo, SeriesStyle> = {
  1: { cls: "wg-s1", dash: "", marker: "circle", name: "실선·동그라미" },
  2: { cls: "wg-s2", dash: "10 6", marker: "square", name: "긴 점선·네모" },
  3: { cls: "wg-s3", dash: "3 5", marker: "triangle", name: "짧은 점선·세모" },
  4: { cls: "wg-s4", dash: "12 4 3 4", marker: "diamond", name: "점쇄선·마름모" },
  5: { cls: "wg-s5", dash: "6 3", marker: "cross", name: "점선·가위표" },
};

export function seriesStyle(n: number): SeriesStyle {
  const k = (((Math.round(n) - 1) % 5) + 5) % 5;
  return STYLES[(k + 1) as SeriesNo];
}

/** 표식 모양을 path 의 d 로(중심 cx,cy, 반지름 r) */
export function markerPath(m: Marker, cx: number, cy: number, r: number): string {
  const f = (v: number) => String(Math.round(v * 100) / 100);
  switch (m) {
    case "circle":
      return `M${f(cx - r)},${f(cy)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0Z`;
    case "square":
      return `M${f(cx - r)},${f(cy - r)}h${f(2 * r)}v${f(2 * r)}h${f(-2 * r)}Z`;
    case "triangle":
      return `M${f(cx)},${f(cy - r * 1.15)}L${f(cx + r * 1.1)},${f(cy + r * 0.85)}L${f(cx - r * 1.1)},${f(cy + r * 0.85)}Z`;
    case "diamond":
      return `M${f(cx)},${f(cy - r * 1.25)}L${f(cx + r * 1.25)},${f(cy)}L${f(cx)},${f(cy + r * 1.25)}L${f(cx - r * 1.25)},${f(cy)}Z`;
    default:
      return `M${f(cx - r)},${f(cy - r)}L${f(cx + r)},${f(cy + r)}M${f(cx + r)},${f(cy - r)}L${f(cx - r)},${f(cy + r)}`;
  }
}

/** 1·2·5 단위로 보기 좋은 눈금(양 끝 포함 범위 안의 것만) */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (hi < lo) [lo, hi] = [hi, lo];
  if (hi === lo) return [lo];
  const raw = (hi - lo) / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / p;
  const s = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p;
  const out: number[] = [];
  const k0 = Math.ceil(lo / s - 1e-9);
  for (let i = 0; i <= 50; i++) {
    const v = (k0 + i) * s;
    if (v > hi + s * 1e-9) break;
    out.push(clean(v));
  }
  return out;
}

/** 부동소수 잡음 지우기(-0 은 0) */
export function clean(v: number, digits = 10): number {
  const r = Math.round(v * Math.pow(10, digits)) / Math.pow(10, digits);
  return Object.is(r, -0) ? 0 : r;
}

/** 표시용 숫자: 소수 d 자리까지, 뒤의 0 은 지워요 */
export function fmtNum(v: number, d = 3): string {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : v < 0 ? "−∞" : "—";
  const r = clean(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
  const s = String(r);
  return r < 0 ? "−" + s.slice(1) : s;
}

export interface Scale {
  (v: number): number;
  inv(px: number): number;
}

/** 선형 변환: 값 [d0,d1] → 화면 [r0,r1] */
export function linScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  const f = ((v: number) => r0 + (v - d0) * k) as Scale;
  f.inv = (px: number) => (k === 0 ? d0 : d0 + (px - r0) / k);
  return f;
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * 그림 크기 정하기. width 는 실제 px.
 * equal 이면 x·y 한 칸 길이를 같게(높이를 범위 비율로), 아니면 ratio·최소·최대 높이로.
 */
export function plotHeight(width: number, ratio: number, minH: number, maxH: number, equal?: { x: [number, number]; y: [number, number]; pad: Box }): number {
  let h = width * ratio;
  if (equal) {
    const iw = Math.max(1, width - equal.pad.left - equal.pad.right);
    const dx = equal.x[1] - equal.x[0];
    const dy = equal.y[1] - equal.y[0];
    if (dx > 0 && dy > 0) h = (iw * dy) / dx + equal.pad.top + equal.pad.bottom;
  }
  return Math.round(Math.max(minH, Math.min(maxH, h)));
}

/** 범위 밖으로 크게 나가는 값은 그리기 좋게 자르기(선이 화면 밖 수만 px 로 가지 않게) */
export function clampTo(v: number, lo: number, hi: number): number {
  const span = hi - lo;
  return Math.max(lo - span * 2, Math.min(hi + span * 2, v));
}

export interface SummarySeries {
  label: string;
  data: XY[];
}

/** 화면 읽기 프로그램이 읽을 짧은 요약(해요체) */
export function summarize(series: SummarySeries[], d = 2): string {
  const parts = series
    .filter((s) => s.data.length > 0)
    .map((s) => {
      if (s.data.length === 1) return `${s.label}: 점 (${fmtNum(s.data[0].x, d)}, ${fmtNum(s.data[0].y, d)})`;
      const ys = s.data.map((p) => p.y).filter((v) => Number.isFinite(v));
      if (ys.length === 0) return `${s.label}: 점 ${s.data.length}개`;
      const lo = Math.min.apply(null, ys);
      const hi = Math.max.apply(null, ys);
      return `${s.label}: 점 ${s.data.length}개, y 는 ${fmtNum(lo, d)}부터 ${fmtNum(hi, d)}까지`;
    });
  return parts.length ? parts.join(". ") + "." : "그림에 아직 아무것도 없어요.";
}

/** 함수 y=f(x) 를 n 등분으로 표본(유한한 값만) */
export function sampleFn(f: (x: number) => number, lo: number, hi: number, n = 120): XY[] {
  const out: XY[] = [];
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const y = f(x);
    if (Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

/* ── 끌기(손잡이) ── */

export type SurfaceName = "phone" | "prep" | "board";

/** 손잡이 크기(px, 반지름): 보이는 원과 손가락이 잡히는 영역. 칠판은 지름 48 / 잡히는 영역 80, 휴대폰은 잡히는 영역 44 이상 */
export function handleSize(surface: SurfaceName): { r: number; hit: number } {
  if (surface === "board") return { r: 24, hit: 40 };
  if (surface === "prep") return { r: 15, hit: 28 };
  return { r: 11, hit: 22 };
}

/**
 * 화면 좌표(client) → 그림 데이터 좌표. rect 는 svg 의 화면 사각형, width/height 는 viewBox 크기.
 * 그림 범위 밖으로 끌면 범위 끝에 붙여요.
 */
export function clientToData(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  width: number,
  height: number,
  sx: Scale,
  sy: Scale,
  xr: [number, number],
  yr: [number, number],
): XY {
  const px = ((clientX - rect.left) * width) / (rect.width || width);
  const py = ((clientY - rect.top) * height) / (rect.height || height);
  const x = sx.inv(px);
  const y = sy.inv(py);
  return {
    x: Math.max(Math.min(xr[0], xr[1]), Math.min(Math.max(xr[0], xr[1]), x)),
    y: Math.max(Math.min(yr[0], yr[1]), Math.min(Math.max(yr[0], yr[1]), y)),
  };
}

/** 값을 눈금(step)에 맞추고 범위 안으로 */
export function snapTo(v: number, step: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  const k = Math.round(v / step);
  const s = clean(k * step, 8);
  return Math.max(lo, Math.min(hi, s));
}

/** 키보드 화살표로 손잡이 옮기기: 키 이름 → (dx, dy) 칸 수. 모르는 키면 null */
export function arrowDelta(key: string): [number, number] | null {
  if (key === "ArrowLeft" || key === "Left") return [-1, 0];
  if (key === "ArrowRight" || key === "Right") return [1, 0];
  if (key === "ArrowUp" || key === "Up") return [0, 1];
  if (key === "ArrowDown" || key === "Down") return [0, -1];
  return null;
}

/**
 * 한 번에 손가락 하나만 받는 문지기(순수). 첫 손가락이 끌기를 잡으면, 그 손가락을 뗄 때까지
 * 다른 손가락(두 번째 손가락, 손바닥)은 모두 무시해요.
 */
export class PointerGate {
  private id: number | null = null;
  private key: string | null = null;
  /** 끌기 시작. 받아들였으면 true */
  down(pointerId: number, isPrimary: boolean | undefined, key: string): boolean {
    if (this.id !== null) return false;
    if (isPrimary === false) return false;
    this.id = pointerId;
    this.key = key;
    return true;
  }
  /** 이 포인터가 지금 끄는 손가락이면 끄는 대상 이름 */
  move(pointerId: number): string | null {
    return this.id !== null && pointerId === this.id ? this.key : null;
  }
  /** 끌기 끝. 지금 끄는 손가락이었으면 true */
  up(pointerId: number): boolean {
    if (this.id === null || pointerId !== this.id) return false;
    this.id = null;
    this.key = null;
    return true;
  }
  get active(): string | null {
    return this.key;
  }
  reset(): void {
    this.id = null;
    this.key = null;
  }
}
