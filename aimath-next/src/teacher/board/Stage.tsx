// 칠판 무대: 1920×1080 고정, 화면 크기에 맞춰 scale 해요.
//   위 64px: 진행 레일 + 레슨·장면 이름   ·   가운데: 좌우 120px 넘김 띠 + 본문 1680×896   ·   아래 120px: 도구띠
// 넘김: →·Space·PageDown(다음) / ←·PageUp(이전) / Home·End, 한 손가락 스와이프(두 손가락은 무시).
// 판서·확대·가림막·타이머·번호 뽑기·A±·전체 화면·칠판 테마는 이 무대가 맡아요(메모리에만, 저장 안 함).
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { BOARD_H, BOARD_W } from "../../shared/contracts.ts";
import { TIcon } from "../../shared/icons/teacher.tsx";
import type { AnyIconName } from "../../shared/icons/names.ts";
import { UiSurfaceContext } from "../../shared/ui/index.ts";
import { useTeacherPrefs, stepFs } from "../shell/prefs.ts";
import { InkLayer } from "./Ink.tsx";
import { addStroke, canUndo, clearPage, InkBook, undo, type InkColor, type InkTool, type Stroke } from "./ink.logic.ts";
import { Curtain, Picker, Timer, canFullscreen, isFullscreen, toggleFullscreen, useTimerBadge } from "./tools.tsx";

export const HEAD_H = 64;
export const BAR_H = 120;
export const SIDE_W = 120;
export const BODY_W = BOARD_W - SIDE_W * 2; // 1680
export const BODY_H = BOARD_H - HEAD_H - BAR_H; // 896

// 판서는 탭을 닫거나 새로 고치면 사라져요(저장 안 함)
const BOOK = new InkBook();
let memPrevTheme: "auto" | "light" | "dark" = "auto";

export interface RailItem {
  /** 장면 위치(전체 목록 안) */
  s: number;
  label: string;
}

export interface StageProps {
  /** 판서 장(장면 id 등) */
  inkKey: string;
  /** 머리 왼쪽(레슨) */
  lessonLabel: ReactNode;
  /** 머리 가운데(장면 이름) */
  title: ReactNode;
  /** 진행 레일 */
  rail?: { items: RailItem[]; cur: number; onJump: (s: number) => void };
  /** 머리 오른쪽(예: "3 / 18") */
  counter?: ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  /** '다음' 단추 글자(예: "공개 2/4", "다음 장면") */
  nextLabel: string;
  nextHint?: string;
  canPrev: boolean;
  /** 나가기(준비 화면) 주소 */
  exitHref: string;
  /** 스와이프 끄기(체험 도구 조작 중 등) */
  noSwipe?: boolean;
  children: ReactNode;
}

function useFit(): { k: number; x: number; y: number } {
  const calc = () => {
    const W = window.innerWidth || BOARD_W;
    const H = window.innerHeight || BOARD_H;
    const k = Math.min(W / BOARD_W, H / BOARD_H);
    return { k, x: Math.max(0, (W - BOARD_W * k) / 2), y: Math.max(0, (H - BOARD_H * k) / 2) };
  };
  const [fit, setFit] = useState(calc);
  useEffect(() => {
    const on = () => setFit(calc());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    document.addEventListener("fullscreenchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
      document.removeEventListener("fullscreenchange", on);
    };
  }, []);
  return fit;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
};

function ToolBtn(props: { icon: AnyIconName; label: string; on?: boolean; onClick: () => void; badge?: string | null; disabled?: boolean }) {
  return (
    <button type="button" className={"bd-tool" + (props.on ? " is-on" : "")} aria-pressed={props.on === undefined ? undefined : props.on} onClick={props.onClick} disabled={props.disabled}>
      <TIcon name={props.icon} size="lg" />
      <span className="bd-tool-txt">{props.badge || props.label}</span>
    </button>
  );
}

const PENS: { tool: InkTool; color: InkColor; label: string; cls: string }[] = [
  { tool: "pen", color: "ink", label: "검정 펜", cls: "c-ink" },
  { tool: "pen", color: "red", label: "빨강 펜", cls: "c-red" },
  { tool: "pen", color: "blue", label: "파랑 펜", cls: "c-blue" },
  { tool: "hl", color: "hl", label: "형광펜", cls: "c-hl" },
  { tool: "eraser", color: "ink", label: "지우개", cls: "c-eraser" },
];

export function Stage(props: StageProps) {
  const fit = useFit();
  const [prefs, patch] = useTeacherPrefs();
  const [ink, setInk] = useState(false);
  const [tool, setTool] = useState<InkTool>("pen");
  const [color, setColor] = useState<InkColor>("ink");
  const [page, setPage] = useState(() => BOOK.get(props.inkKey));
  const [pop, setPop] = useState<null | "timer" | "picker">(null);
  const [curtain, setCurtain] = useState(false);
  const [zoom, setZoom] = useState<{ armed: boolean; on: boolean; x: number; y: number }>({ armed: false, on: false, x: 50, y: 50 });
  const [fsOn, setFsOn] = useState(false);
  const timerBadge = useTimerBadge();
  const swipe = useRef<{ id: number; x: number; y: number; t: number; multi: boolean } | null>(null);
  const touches = useRef<Record<number, true>>({});
  const nextRef = useRef(props.onNext);
  const prevRef = useRef(props.onPrev);
  const firstRef = useRef(props.onFirst);
  const lastRef = useRef(props.onLast);
  nextRef.current = props.onNext;
  prevRef.current = props.onPrev;
  firstRef.current = props.onFirst;
  lastRef.current = props.onLast;

  // 장면이 바뀌면 그 장면 판서를 꺼내요. 확대는 풀어요
  useEffect(() => {
    setPage(BOOK.get(props.inkKey));
    setZoom({ armed: false, on: false, x: 50, y: 50 });
  }, [props.inkKey]);

  const addInk = useCallback(
    (s: Stroke) => {
      setPage((p) => {
        const n = addStroke(p, s);
        BOOK.set(props.inkKey, n);
        return n;
      });
    },
    [props.inkKey],
  );
  const undoInk = () =>
    setPage((p) => {
      const n = undo(p);
      BOOK.set(props.inkKey, n);
      return n;
    });
  const clearInk = () =>
    setPage((p) => {
      const n = clearPage(p);
      BOOK.set(props.inkKey, n);
      return n;
    });

  // 키보드 넘김
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTyping(e.target)) return;
      const k = e.key;
      const onButton = !!(e.target && (e.target as HTMLElement).tagName === "BUTTON");
      if (k === "ArrowRight" || k === "PageDown" || ((k === " " || k === "Spacebar") && !onButton)) {
        e.preventDefault();
        nextRef.current();
      } else if (k === "ArrowLeft" || k === "PageUp") {
        e.preventDefault();
        prevRef.current();
      } else if (k === "Home" && firstRef.current) {
        e.preventDefault();
        firstRef.current();
      } else if (k === "End" && lastRef.current) {
        e.preventDefault();
        lastRef.current();
      } else if (k === "Escape") {
        setPop(null);
        setInk(false);
        setZoom({ armed: false, on: false, x: 50, y: 50 });
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  useEffect(() => {
    const on = () => setFsOn(isFullscreen());
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);

  // 한 손가락 스와이프(두 손가락이 닿으면 그 동작은 무시)
  const noSwipeTarget = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    if (!el || !el.closest) return false;
    return !!el.closest("input, textarea, select, .wg-host, .bd-noswipe, .bd-curtain, .bd-pop");
  };
  const sDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    touches.current[e.pointerId] = true;
    const n = Object.keys(touches.current).length;
    if (n > 1) {
      if (swipe.current) swipe.current.multi = true;
      return;
    }
    if (ink || props.noSwipe || noSwipeTarget(e.target)) {
      swipe.current = null;
      return;
    }
    swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: Date.now(), multi: false };
  };
  const sUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    delete touches.current[e.pointerId];
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    swipe.current = null;
    if (s.multi) return;
    const dx = (e.clientX - s.x) / (fit.k || 1);
    const dy = (e.clientY - s.y) / (fit.k || 1);
    if (Date.now() - s.t > 800) return;
    if (Math.abs(dx) < 120 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx < 0) nextRef.current();
    else prevRef.current();
  };
  const sCancel = (e: RPointerEvent<HTMLDivElement>) => {
    delete touches.current[e.pointerId];
    swipe.current = null;
  };

  const zoomTap = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / (r.width || 1)) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / (r.height || 1)) * 100));
    setZoom({ armed: false, on: true, x, y });
  };

  const toggleChalk = () => {
    if (prefs.theme === "chalk") patch({ theme: memPrevTheme });
    else {
      memPrevTheme = prefs.theme === "light" || prefs.theme === "dark" ? prefs.theme : "auto";
      patch({ theme: "chalk" });
    }
  };

  const zoomed = zoom.on || zoom.armed;
  const rail = props.rail;

  return (
    <UiSurfaceContext.Provider value="board">
      <div className="bd-viewport">
        <div
          className={"bd-stage" + (ink ? " is-inking" : "")}
          style={{ width: BOARD_W + "px", height: BOARD_H + "px", transform: "translate(" + fit.x + "px," + fit.y + "px) scale(" + fit.k + ")" }}
          onPointerDownCapture={sDown}
          onPointerUpCapture={sUp}
          onPointerCancelCapture={sCancel}
        >
          {/* ── 머리: 진행 레일 + 이름 ── */}
          <header className="bd-head">
            {rail ? (
              <ol className="bd-rail" aria-label="장면 진행">
                {rail.items.map((it, i) => (
                  <li key={it.s} className={it.s === rail.cur ? "is-cur" : it.s < rail.cur ? "is-past" : ""}>
                    <button type="button" onClick={() => rail.onJump(it.s)} aria-label={i + 1 + "번 장면: " + it.label} aria-current={it.s === rail.cur ? "step" : undefined} />
                  </li>
                ))}
              </ol>
            ) : null}
            <div className="bd-head-row">
              <span className="bd-head-lesson">{props.lessonLabel}</span>
              <span className="bd-head-title">{props.title}</span>
              <span className="bd-head-count num">{props.counter}</span>
              <span className="site-tag bd-tag">교사용</span>
            </div>
          </header>

          {/* ── 좌우 넘김 띠 ── */}
          <button type="button" className="bd-side is-prev" onClick={props.onPrev} disabled={!props.canPrev} aria-label="이전">
            <TIcon name="prev" size="xl" />
          </button>
          <button type="button" className="bd-side is-next" onClick={props.onNext} aria-label={"다음: " + props.nextLabel}>
            <TIcon name="next" size="xl" />
          </button>

          {/* ── 본문 ── */}
          <div className="bd-frame" style={{ width: BODY_W + "px", height: BODY_H + "px" }}>
            <div
              className={"bd-zoom" + (zoom.on ? " is-zoomed" : "")}
              style={zoom.on ? { transform: "scale(2)", transformOrigin: zoom.x + "% " + zoom.y + "%" } : undefined}
            >
              <div className="bd-body" id="bd-body">
                {props.children}
              </div>
              <InkLayer w={BODY_W} h={BODY_H} page={page} active={ink} tool={tool} color={color} onAdd={addInk} />
            </div>
            {zoomed && !ink ? (
              <div className={"bd-zoom-catch" + (zoom.armed ? " is-armed" : "")} onPointerUp={zoomTap}>
                {zoom.armed ? <p className="bd-zoom-tip">크게 볼 곳을 눌러요</p> : null}
              </div>
            ) : null}
            {curtain ? <Curtain h={BODY_H} onClose={() => setCurtain(false)} /> : null}
            {pop === "timer" ? <Timer onClose={() => setPop(null)} /> : null}
            {pop === "picker" ? <Picker onClose={() => setPop(null)} /> : null}
          </div>

          {/* ── 아래 도구띠 ── */}
          <footer className="bd-bar">
            <div className="bd-bar-tools" role="toolbar" aria-label="칠판 도구">
              <ToolBtn icon="pen" label={ink ? "판서 끄기" : "판서"} on={ink} onClick={() => setInk((v) => !v)} />
              {ink ? (
                <div className="bd-pens" role="group" aria-label="펜 고르기">
                  {PENS.map((p) => {
                    const on = tool === p.tool && (p.tool !== "pen" || color === p.color);
                    return (
                      <button
                        key={p.label}
                        type="button"
                        className={"bd-pen " + p.cls + (on ? " is-on" : "")}
                        aria-pressed={on}
                        aria-label={p.label}
                        title={p.label}
                        onClick={() => {
                          setTool(p.tool);
                          if (p.tool === "pen") setColor(p.color);
                        }}
                      >
                        {p.tool === "eraser" ? <TIcon name="eraser" size="lg" /> : p.tool === "hl" ? <TIcon name="marker" size="lg" /> : <i aria-hidden="true" />}
                      </button>
                    );
                  })}
                  <button type="button" className="bd-pen" onClick={undoInk} disabled={!canUndo(page)} aria-label="되돌리기" title="되돌리기">
                    <TIcon name="undo" size="lg" />
                  </button>
                  <button type="button" className="bd-pen" onClick={clearInk} disabled={!page.strokes.length} aria-label="모두 지우기" title="모두 지우기">
                    <TIcon name="trash" size="lg" />
                  </button>
                </div>
              ) : (
                <>
                  <ToolBtn icon="timer" label="타이머" badge={timerBadge} on={pop === "timer"} onClick={() => setPop(pop === "timer" ? null : "timer")} />
                  <ToolBtn icon="curtain" label="가림막" on={curtain} onClick={() => setCurtain((v) => !v)} />
                  <ToolBtn icon="zoom" label={zoom.on ? "확대 끄기" : "확대"} on={zoomed} onClick={() => setZoom(zoomed ? { armed: false, on: false, x: 50, y: 50 } : { armed: true, on: false, x: 50, y: 50 })} />
                  <button type="button" className="bd-tool" onClick={() => patch({ fs: stepFs(prefs.fs, -1) })} disabled={prefs.fs <= 0} aria-label="글자 작게">
                    <span className="bd-tool-big">A−</span>
                  </button>
                  <button type="button" className="bd-tool" onClick={() => patch({ fs: stepFs(prefs.fs, 1) })} disabled={prefs.fs >= 3} aria-label="글자 크게">
                    <span className="bd-tool-big">A+</span>
                  </button>
                  <ToolBtn icon="dice" label="번호 뽑기" on={pop === "picker"} onClick={() => setPop(pop === "picker" ? null : "picker")} />
                  {canFullscreen() ? <ToolBtn icon="full" label={fsOn ? "전체 화면 끄기" : "전체 화면"} on={fsOn} onClick={toggleFullscreen} /> : null}
                  <ToolBtn icon="theme" label="칠판색" on={prefs.theme === "chalk"} onClick={toggleChalk} />
                  <a className="bd-tool" href={props.exitHref}>
                    <TIcon name="home" size="lg" />
                    <span className="bd-tool-txt">나가기</span>
                  </a>
                </>
              )}
            </div>
            <div className="bd-bar-nav">
              <button type="button" className="btn bd-prev" onClick={props.onPrev} disabled={!props.canPrev}>
                <TIcon name="prev" size="lg" />
                <span>이전</span>
              </button>
              <button type="button" className="btn btn-primary bd-next" onClick={props.onNext}>
                <span className="bd-next-txt">
                  <span>{props.nextLabel}</span>
                  {props.nextHint ? <small>{props.nextHint}</small> : null}
                </span>
                <TIcon name="next" size="lg" />
              </button>
            </div>
          </footer>
        </div>
      </div>
    </UiSurfaceContext.Provider>
  );
}
