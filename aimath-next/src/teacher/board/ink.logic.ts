// 판서 순수 로직(DOM 없음). 장면별 획 목록과 되돌리기(최대 50번)를 메모리에만 둬요 — 저장하지 않아요.
// 좌표는 칠판 본문 논리 좌표(px, 무대 scale 과 무관)예요.

export type InkTool = "pen" | "hl" | "eraser";
/** 펜 색 열쇠: 화면 테마에 맞춰 실제 색으로 바꿔 그려요 */
export type InkColor = "ink" | "red" | "blue" | "hl";

export interface Stroke {
  tool: InkTool;
  color: InkColor;
  width: number;
  /** x0,y0,x1,y1,… */
  pts: number[];
}

type Action = { t: "add"; s: Stroke } | { t: "clear"; before: Stroke[] };

export interface InkPage {
  strokes: Stroke[];
  undo: Action[];
}

export const UNDO_MAX = 50;
export const WIDTH: Record<InkTool, number> = { pen: 5, hl: 30, eraser: 48 };
/** 이보다 큰 접촉 면(px)은 손바닥으로 보고 무시해요 */
export const PALM = 42;
/** 점 사이가 이보다 가까우면 건너뛰어요(px) */
export const MIN_STEP = 1.5;

export const emptyPage = (): InkPage => ({ strokes: [], undo: [] });

function pushUndo(u: Action[], a: Action): Action[] {
  const out = u.concat([a]);
  return out.length > UNDO_MAX ? out.slice(out.length - UNDO_MAX) : out;
}

export function addStroke(p: InkPage, s: Stroke): InkPage {
  if (s.pts.length < 2) return p;
  return { strokes: p.strokes.concat([s]), undo: pushUndo(p.undo, { t: "add", s }) };
}

export function clearPage(p: InkPage): InkPage {
  if (!p.strokes.length) return p;
  return { strokes: [], undo: pushUndo(p.undo, { t: "clear", before: p.strokes }) };
}

export function undo(p: InkPage): InkPage {
  if (!p.undo.length) return p;
  const last = p.undo[p.undo.length - 1];
  const rest = p.undo.slice(0, -1);
  if (last.t === "add") {
    const i = p.strokes.lastIndexOf(last.s);
    const strokes = i >= 0 ? p.strokes.slice(0, i).concat(p.strokes.slice(i + 1)) : p.strokes;
    return { strokes, undo: rest };
  }
  return { strokes: last.before.slice(), undo: rest };
}

export const canUndo = (p: InkPage) => p.undo.length > 0;

/** 손바닥처럼 큰 접촉인지(터치일 때만 봐요) */
export function isPalm(pointerType: string, w: number, h: number): boolean {
  return pointerType === "touch" && (w > PALM || h > PALM);
}

/** 새 점을 붙일지(너무 가까우면 false) */
export function farEnough(pts: readonly number[], x: number, y: number): boolean {
  const n = pts.length;
  if (n < 2) return true;
  const dx = x - pts[n - 2];
  const dy = y - pts[n - 1];
  return dx * dx + dy * dy >= MIN_STEP * MIN_STEP;
}

/** 화면 좌표 → 논리 좌표(무대가 scale·확대되어 있어도 맞아요) */
export function toLogical(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, w: number, h: number): [number, number] {
  const x = ((clientX - rect.left) * w) / (rect.width || 1);
  const y = ((clientY - rect.top) * h) / (rect.height || 1);
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** 장면별 판서(메모리). 새로 고치면 사라져요 */
export class InkBook {
  private pages = new Map<string, InkPage>();
  get(id: string): InkPage {
    return this.pages.get(id) || emptyPage();
  }
  set(id: string, p: InkPage): void {
    if (!p.strokes.length && !p.undo.length) this.pages.delete(id);
    else this.pages.set(id, p);
  }
  has(id: string): boolean {
    const p = this.pages.get(id);
    return !!p && p.strokes.length > 0;
  }
  reset(): void {
    this.pages.clear();
  }
}
