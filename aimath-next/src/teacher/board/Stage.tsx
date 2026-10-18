// 칠판 무대: 1920×1080 고정, 화면 크기에 맞춰 scale 해요.
//   위 72px: 브랜드·단원 + 번호 칩 탭(1 도입 2 개념 …)   ·   가운데: 본문 1760×896(좌우 80px 여백)   ·   아래 112px: 키 안내·진행 표시(32) + 도구띠(80)
// 이전·다음은 아래 막대의 단추 하나로만 해요(가장자리 화살표는 없앴어요). '다음' 단추 폭은 고정이라 글자가 바뀌어도 자리가 그대로예요.
// 넘김: →·Space·PageDown(다음) / ←·PageUp(이전) / Home·End, 한 손가락 스와이프(두 손가락은 무시).
// 판서·확대·가림막·타이머·번호 뽑기·A±·전체 화면·칠판 테마는 이 무대가 맡아요(메모리에만, 저장 안 함).
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { BOARD_H, BOARD_W } from "../../shared/contracts.ts";
import { TIcon } from "../../shared/icons/teacher.tsx";
import { UiSurfaceContext } from "../../shared/ui/index.ts";
import { useTeacherPrefs, stepFs } from "../shell/prefs.ts";
import { InkLayer } from "./Ink.tsx";
import type { PhaseItem } from "./board.logic.ts";
import { addStroke, canUndo, clearPage, InkBook, undo, type InkColor, type InkTool, type Stroke } from "./ink.logic.ts";
import { BoardToolbar, Curtain, Picker, Timer, canFullscreen, isFullscreen, toggleFullscreen, useTimerBadge } from "./tools.tsx";

export const HEAD_H = 72;
export const BAR_H = 112;
export const SIDE_W = 80;
export const BODY_W = BOARD_W - SIDE_W * 2; // 1760(measure.logic 의 BODY_W 와 같아요)
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
  /** 5구간 막대(도입·개념·문제·정리·수업 끝): 지금 구간을 크게 */
  phases?: PhaseItem[];
  /** 머리 오른쪽(예: "개념 2/5 · 장면 7/18") */
  counter?: ReactNode;
  /** 머리 오른쪽 작은 글(예: "꺼진 장면 3") */
  counterNote?: ReactNode;
  onNext: () => void;
  onPrev: () => void;
  onFirst?: () => void;
  onLast?: () => void;
  /** '다음' 단추 글자(예: "공개 2/4", "다음 장면") */
  nextLabel: string;
  nextHint?: string;
  /** '다음' 단추 모양: finish 면 수업 마치기(초록) */
  nextTone?: "finish";
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
    // 4:3 같은 화면에서도 아래 도구띠가 화면 바닥에 붙도록 위쪽에만 빈 자리를 둬요(가운데 정렬이면 단추가 바닥에서 떠요)
    const k = Math.min(W / BOARD_W, H / BOARD_H);
    return { k, x: Math.max(0, (W - BOARD_W * k) / 2), y: Math.max(0, H - BOARD_H * k) };
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
          {/* ── 머리 72: 브랜드·단원 + 번호 칩 탭 ── */}
          <header className="bd-head">
            <div className="bd-head-row">
              <span className="bd-brand" aria-hidden="true">
                <img className="bd-flag" src="/favicon-t.svg?v=2" alt="" width={40} height={40} />
              </span>
              <span className="bd-head-lesson">{props.lessonLabel}</span>
              <span className="bd-head-title">{props.title}</span>
              {props.phases && props.phases.length ? (
                <ol className="bd-phases" aria-label="수업 구간">
                  {props.phases.map((ph, i) => (
                    <li key={ph.label} className={"is-" + ph.state} aria-current={ph.state === "cur" ? "step" : undefined}>
                      <span className="bd-ph-n num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="bd-ph-t">{ph.label}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {props.counterNote ? <span className="bd-head-off">{props.counterNote}</span> : null}
              <span className="site-tag bd-tag">교사용</span>
            </div>
          </header>

          {/* ── 본문 ── */}
          <div className="bd-frame" style={{ top: HEAD_H + "px", left: SIDE_W + "px", width: BODY_W + "px", height: BODY_H + "px" }}>
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
            <div className="bd-strip">
              <span className="bd-keyhint" aria-hidden="true">
                <kbd>←</kbd>
                <kbd>→</kbd>
                <span>장면 이동</span>
                {props.onFirst ? (
                  <>
                    <span className="bd-keyhint-sep">·</span>
                    <kbd>Home</kbd>
                    <kbd>End</kbd>
                    <span>처음·끝</span>
                  </>
                ) : null}
              </span>
              <span className="bd-head-count num">{props.counter}</span>
              {rail ? (
                <ol className="bd-rail" aria-label="장면 진행">
                  {rail.items.map((it, i) => (
                    <li key={it.s} className={it.s === rail.cur ? "is-cur" : it.s < rail.cur ? "is-past" : ""}>
                      <button type="button" onClick={() => rail.onJump(it.s)} aria-label={i + 1 + "번 장면: " + it.label} aria-current={it.s === rail.cur ? "step" : undefined} />
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
            <div className="bd-bar-row">
            <BoardToolbar
              ink={ink}
              onInk={(v) => setInk(v)}
              tool={tool}
              color={color}
              onPen={(t, c) => {
                setTool(t);
                if (t === "pen") setColor(c);
              }}
              canUndo={canUndo(page)}
              canClear={!!page.strokes.length}
              onUndo={undoInk}
              onClear={clearInk}
              pop={pop}
              onPop={setPop}
              timerBadge={timerBadge}
              curtain={curtain}
              onCurtain={() => setCurtain((v) => !v)}
              zoomed={zoomed}
              zoomOn={zoom.on}
              onZoom={() => setZoom(zoomed ? { armed: false, on: false, x: 50, y: 50 } : { armed: true, on: false, x: 50, y: 50 })}
              fs={prefs.fs}
              onFs={(d) => patch({ fs: stepFs(prefs.fs, d) })}
              canFull={canFullscreen()}
              fullOn={fsOn}
              onFull={toggleFullscreen}
              chalk={prefs.theme === "chalk"}
              onChalk={toggleChalk}
              exitHref={props.exitHref}
              keyFirst={!!props.onFirst}
              keyLast={!!props.onLast}
            />
            <div className="bd-bar-nav">
              <button type="button" className="btn bd-prev" onClick={props.onPrev} disabled={!props.canPrev}>
                <TIcon name="prev" size="lg" />
                <span>이전</span>
              </button>
              <button
                type="button"
                className={"btn btn-primary bd-next" + (props.nextTone === "finish" ? " is-finish" : "")}
                onClick={props.onNext}
                aria-label={(props.nextTone === "finish" ? "마지막 장면: " : "") + props.nextLabel + (props.nextHint ? " · " + props.nextHint : "")}
              >
                <span className="bd-next-txt">
                  <span>{props.nextLabel}</span>
                  {props.nextHint ? <small>{props.nextHint}</small> : null}
                </span>
                <TIcon name="next" size="lg" />
              </button>
            </div>
            </div>
          </footer>
        </div>
      </div>
    </UiSurfaceContext.Provider>
  );
}
