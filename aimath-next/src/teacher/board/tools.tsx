// 교실 도구(칠판 무대 위에 뜨는 것): 타이머 1·3·5분 · 가림막 · 번호 뽑기. 모두 메모리에만 두고 저장하지 않아요.
// 아래 도구띠(BoardToolbar)도 여기 있어요: 자주 쓰는 판서·타이머·가림막·확대는 앞에 크게,
// A±·번호 뽑기·전체 화면·칠판색은 '더 보기' 묶음, '나가기'는 왼쪽 끝에 떨어뜨려 두고 누르면 한 번 더 물어봐요.
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { TIcon } from "../../shared/icons/teacher.tsx";
import type { AnyIconName } from "../../shared/icons/names.ts";
import { FS_LABELS } from "../shell/prefs.ts";
import { drawNumber, mmss } from "./board.logic.ts";
import type { InkColor, InkTool } from "./ink.logic.ts";

/* ─────────── 타이머 ─────────── */

interface TimerState {
  total: number; // 초
  left: number; // 초
  running: boolean;
  endAt: number; // ms(달리는 중일 때)
}

// 장면을 옮겨도 계속 가게 모듈 메모리에 둬요
let memTimer: TimerState | null = null;

export function Timer({ onClose }: { onClose: () => void }) {
  const [st, setSt] = useState<TimerState | null>(memTimer);
  const [, tick] = useState(0);

  useEffect(() => {
    memTimer = st;
  }, [st]);

  useEffect(() => {
    if (!st || !st.running) return;
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [st]);

  const left = st ? (st.running ? Math.max(0, (st.endAt - Date.now()) / 1000) : st.left) : 0;
  const over = !!st && left <= 0;

  useEffect(() => {
    if (st && st.running && left <= 0) setSt({ ...st, running: false, left: 0 });
  }, [st, left]);

  const start = (min: number) => setSt({ total: min * 60, left: min * 60, running: true, endAt: Date.now() + min * 60000 });
  const pause = () => st && setSt({ ...st, running: false, left });
  const resume = () => st && left > 0 && setSt({ ...st, running: true, endAt: Date.now() + left * 1000 });
  const add = (sec: number) => {
    if (!st) return;
    const nl = Math.max(0, left + sec);
    setSt({ ...st, total: Math.max(st.total, nl), left: nl, endAt: Date.now() + nl * 1000, running: st.running && nl > 0 });
  };
  const pct = st && st.total ? Math.max(0, Math.min(100, (left / st.total) * 100)) : 0;

  return (
    <div className={"bd-pop bd-timer" + (over ? " is-over" : "")} role="dialog" aria-label="타이머">
      <div className="bd-pop-head">
        <TIcon name="timer" />
        <span className="bd-pop-title">타이머</span>
        <button type="button" className="bd-x" onClick={onClose} aria-label="타이머 닫기">
          ✕
        </button>
      </div>
      <p className="bd-timer-num num" aria-live="off">
        {st ? mmss(left) : "0:00"}
      </p>
      <div className="meter bd-timer-meter" aria-hidden="true">
        <i style={{ width: pct + "%" }} />
      </div>
      {over ? (
        <p className="bd-timer-over" role="alert">
          시간이 다 됐어요!
        </p>
      ) : null}
      <div className="bd-pop-row">
        {[1, 3, 5].map((m) => (
          <button key={m} type="button" className="btn btn-lg" onClick={() => start(m)}>
            {m}분
          </button>
        ))}
      </div>
      {st ? (
        <div className="bd-pop-row">
          {st.running ? (
            <button type="button" className="btn btn-lg" onClick={pause}>
              잠깐 멈춤
            </button>
          ) : (
            <button type="button" className="btn btn-lg" onClick={resume} disabled={left <= 0}>
              계속
            </button>
          )}
          <button type="button" className="btn btn-lg" onClick={() => add(30)}>
            +30초
          </button>
          <button type="button" className="btn btn-lg btn-ghost" onClick={() => setSt(null)}>
            끄기
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 도구띠에 작게 보이는 남은 시간(타이머 창을 닫아도) */
export function useTimerBadge(): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  const st = memTimer;
  if (!st) return null;
  const left = st.running ? Math.max(0, (st.endAt - Date.now()) / 1000) : st.left;
  return mmss(left);
}

/* ─────────── 가림막 ─────────── */

const CURTAIN_STEP = 112;

/** 본문을 위에서부터 가려요. 손잡이를 끌거나 ▲▼로 조금씩 열어요 */
export function Curtain({ h, onClose }: { h: number; onClose: () => void }) {
  const [top, setTop] = useState(0); // 가림막 윗변(본문 기준 px). 0 이면 다 가림
  const drag = useRef<{ id: number; y0: number; t0: number; k: number } | null>(null);

  const clamp = (v: number) => Math.max(0, Math.min(h - 40, v));
  const down = (e: RPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.parentElement ? e.currentTarget.parentElement.getBoundingClientRect() : null;
    const k = r && r.height ? h / r.height : 1;
    drag.current = { id: e.pointerId, y0: e.clientY, t0: top, k };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    e.stopPropagation();
  };
  const move = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setTop(clamp(d.t0 + (e.clientY - d.y0) * d.k));
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <div className="bd-curtain-wrap" aria-label="가림막">
      <div className="bd-curtain" style={{ top: top + "px" }}>
        <div className="bd-curtain-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="bd-curtain-grip" aria-hidden="true" />
          <span>끌어 내려서 조금씩 보여 줘요</span>
        </div>
        <div className="bd-curtain-btns">
          <button type="button" className="btn btn-lg" onClick={() => setTop((t) => clamp(t - CURTAIN_STEP))} aria-label="가림막 올리기(더 가리기)">
            ▲
          </button>
          <button type="button" className="btn btn-lg" onClick={() => setTop((t) => clamp(t + CURTAIN_STEP))} aria-label="가림막 내리기(더 보이기)">
            ▼
          </button>
          <button type="button" className="btn btn-lg btn-ghost" onClick={onClose}>
            가림막 걷기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── 번호 뽑기(숫자만) ─────────── */

let memPicker = { max: 30, used: [] as number[], last: null as number | null, noRepeat: true };

export function Picker({ onClose }: { onClose: () => void }) {
  const [st, setSt] = useState(memPicker);
  useEffect(() => {
    memPicker = st;
  }, [st]);
  const draw = () => {
    const n = drawNumber(st.max, st.noRepeat ? st.used : [], Math.random());
    if (n == null) {
      setSt({ ...st, last: null });
      return;
    }
    setSt({ ...st, last: n, used: st.noRepeat ? st.used.concat([n]) : st.used });
  };
  const setMax = (m: number) => setSt({ ...st, max: Math.max(2, Math.min(60, m)), used: [], last: null });
  const empty = st.noRepeat && st.used.length >= st.max;

  return (
    <div className="bd-pop bd-picker" role="dialog" aria-label="번호 뽑기">
      <div className="bd-pop-head">
        <TIcon name="dice" />
        <span className="bd-pop-title">번호 뽑기</span>
        <button type="button" className="bd-x" onClick={onClose} aria-label="번호 뽑기 닫기">
          ✕
        </button>
      </div>
      <p className="bd-picker-num num" aria-live="polite">
        {st.last == null ? "?" : st.last}
      </p>
      <div className="bd-pop-row">
        <span className="bd-pop-label">1번부터</span>
        <div className="stepper">
          <button type="button" onClick={() => setMax(st.max - 1)} aria-label="끝 번호 줄이기">
            −
          </button>
          <span className="val num">{st.max}</span>
          <button type="button" onClick={() => setMax(st.max + 1)} aria-label="끝 번호 늘리기">
            +
          </button>
        </div>
        <span className="bd-pop-label">번까지</span>
      </div>
      <label className="switch bd-pop-row">
        <input type="checkbox" checked={st.noRepeat} onChange={(e) => setSt({ ...st, noRepeat: e.target.checked, used: [] })} />
        <span>뽑은 번호는 다시 안 나오게</span>
      </label>
      <div className="bd-pop-row">
        <button type="button" className="btn btn-primary btn-lg" onClick={draw} disabled={empty}>
          {empty ? "다 뽑았어요" : "뽑기"}
        </button>
        <button type="button" className="btn btn-lg btn-ghost" onClick={() => setSt({ ...st, used: [], last: null })}>
          처음부터
        </button>
      </div>
      {st.noRepeat && st.used.length ? <p className="bd-picker-used num">뽑은 번호: {st.used.join(", ")}</p> : null}
      <p className="tiny muted">번호만 보여 줘요. 학생 이름은 넣지 않아요.</p>
    </div>
  );
}

/* ─────────── 전체 화면 ─────────── */

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => void };

export function isFullscreen(): boolean {
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

export function toggleFullscreen(): void {
  try {
    const d = document as FsDoc;
    if (isFullscreen()) {
      if (d.exitFullscreen) void d.exitFullscreen();
      else if (d.webkitExitFullscreen) d.webkitExitFullscreen();
      return;
    }
    const el = document.documentElement as FsEl;
    if (el.requestFullscreen) void el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {
    /* 지원하지 않으면 그대로 */
  }
}

export function canFullscreen(): boolean {
  try {
    const el = document.documentElement as FsEl;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  } catch {
    return false;
  }
}

/* ─────────── 아래 도구띠 ─────────── */

/** 도구띠 단추 하나(아이콘 + 24px 이름표, 터치 칸 72px 이상) */
export function BarTool(props: { icon?: AnyIconName; big?: string; label: string; on?: boolean; onClick: () => void; badge?: string | null; disabled?: boolean; dot?: boolean; className?: string; ariaLabel?: string; expanded?: boolean }) {
  return (
    <button
      type="button"
      className={"bd-tool" + (props.on ? " is-on" : "") + (props.className ? " " + props.className : "")}
      aria-pressed={props.on === undefined || props.expanded !== undefined ? undefined : props.on}
      aria-expanded={props.expanded}
      aria-label={props.ariaLabel}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.icon ? (
        <TIcon name={props.icon} size="lg" />
      ) : props.big === "more" ? (
        <span className="bd-tool-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <span className="bd-tool-big" aria-hidden="true">
          {props.big}
        </span>
      )}
      <span className={"bd-tool-txt" + (props.badge ? " num" : "")}>{props.badge || props.label}</span>
      {props.dot ? <i className="bd-tool-dot" aria-hidden="true" /> : null}
    </button>
  );
}

export const BAR_PENS: { tool: InkTool; color: InkColor; label: string; cls: string }[] = [
  { tool: "pen", color: "ink", label: "검정 펜", cls: "c-ink" },
  { tool: "pen", color: "red", label: "빨강 펜", cls: "c-red" },
  { tool: "pen", color: "blue", label: "파랑 펜", cls: "c-blue" },
  { tool: "hl", color: "hl", label: "형광펜", cls: "c-hl" },
  { tool: "eraser", color: "ink", label: "지우개", cls: "c-eraser" },
];

export interface BoardToolbarProps {
  /** 판서 켜짐 */
  ink: boolean;
  onInk: (on: boolean) => void;
  tool: InkTool;
  color: InkColor;
  onPen: (tool: InkTool, color: InkColor) => void;
  canUndo: boolean;
  canClear: boolean;
  onUndo: () => void;
  onClear: () => void;
  /** 떠 있는 창(타이머·번호 뽑기) */
  pop: null | "timer" | "picker";
  onPop: (p: null | "timer" | "picker") => void;
  timerBadge: string | null;
  curtain: boolean;
  onCurtain: () => void;
  /** 확대(고를 곳 기다림 포함) */
  zoomed: boolean;
  zoomOn: boolean;
  onZoom: () => void;
  /** 글자 크기 0..3 */
  fs: number;
  onFs: (delta: -1 | 1) => void;
  canFull: boolean;
  fullOn: boolean;
  onFull: () => void;
  chalk: boolean;
  onChalk: () => void;
  /** 나가기(준비 화면) 주소 */
  exitHref: string;
  /** 키보드 Home·End 로 첫·마지막 장면에 갈 수 있는지(키보드 안내에 써요) */
  keyFirst?: boolean;
  keyLast?: boolean;
}

/** 열려 있는 동안 바깥을 누르거나 Esc 를 누르면 닫혀요 */
function useDismiss(open: boolean, ref: { current: HTMLElement | null }, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => {
      const el = ref.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      closeRef.current();
    };
    // document 잡기 단계에서 막아야 칠판 무대(window)의 ←·→·Space 넘김보다 먼저 받아요
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, ref]);
}

/** '수업을 나갈까요?' 확인(무대 위 960px 를 덮어요) */
function ExitAsk({ href, onCancel }: { href: string; onCancel: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (stayRef.current) stayRef.current.focus();
    // 확인 창이 떠 있는 동안 넘김 키(←·→·Space·PageUp/Down·Home·End)는 막고 Esc 는 '계속 수업하기'
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "Escape" || k === "Esc") {
        e.stopPropagation();
        onCancel();
      } else if (k === "ArrowRight" || k === "ArrowLeft" || k === "PageDown" || k === "PageUp" || k === "Home" || k === "End") {
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);
  return (
    <div className="bd-exit-ask bd-noswipe" role="alertdialog" aria-modal="true" aria-labelledby="bd-exit-title" aria-describedby="bd-exit-desc">
      <div className="bd-exit-card">
        <p id="bd-exit-title" className="bd-exit-title">
          수업을 나갈까요?
        </p>
        <p id="bd-exit-desc" className="bd-exit-desc">
          준비 화면으로 돌아가요. 칠판에 쓴 판서는 사라져요.
        </p>
        <div className="bd-exit-btns">
          <button ref={stayRef} type="button" className="btn btn-primary bd-exit-stay" onClick={onCancel}>
            계속 수업하기
          </button>
          <a className="btn bd-exit-go" href={href}>
            나가기
          </a>
        </div>
      </div>
    </div>
  );
}

/** 키보드 안내 줄: Stage 의 키 처리(넘김·Esc)와 같은 키만 써요 */
export function keyHelp(first: boolean, last: boolean): { keys: string; what: string }[] {
  const rows = [
    { keys: "→ · Space · PageDown", what: "다음(공개·장면)" },
    { keys: "← · PageUp", what: "이전" },
  ];
  if (first) rows.push({ keys: "Home", what: "첫 장면으로" });
  if (last) rows.push({ keys: "End", what: "마지막 장면으로" });
  rows.push({ keys: "Esc", what: "열린 창 닫기 · 판서 끄기 · 확대 풀기" });
  return rows;
}

/** '키보드로 하기' 한 장 */
function KeySheet({ first, last, onBack }: { first: boolean; last: boolean; onBack: () => void }) {
  return (
    <div className="bd-keys" role="group" aria-label="키보드로 하기">
      <p className="bd-keys-title">키보드로 하기</p>
      <dl className="bd-keys-list">
        {keyHelp(first, last).map((r) => (
          <div key={r.keys} className="bd-keys-row">
            <dt className="num">{r.keys}</dt>
            <dd>{r.what}</dd>
          </div>
        ))}
      </dl>
      <p className="bd-keys-note">단추에 초점이 있을 때 Space 는 그 단추를 눌러요. 글을 쓰는 중이거나 Ctrl이나 Alt를 같이 누르면 넘어가지 않아요.</p>
      <button type="button" className="btn bd-more-btn bd-keys-back" onClick={onBack}>
        돌아가기
      </button>
    </div>
  );
}

/** '더 보기' 묶음: A±·번호 뽑기·전체 화면·칠판색·키보드로 하기 */
function MoreMenu(props: BoardToolbarProps & { onClose: () => void }) {
  const [keys, setKeys] = useState(false);
  const pick = (fn: () => void) => () => {
    fn();
    props.onClose();
  };
  if (keys) {
    return (
      <div className="bd-more-pop bd-noswipe" role="group" aria-label="더 보기 도구">
        <KeySheet first={!!props.keyFirst} last={!!props.keyLast} onBack={() => setKeys(false)} />
      </div>
    );
  }
  return (
    <div className="bd-more-pop bd-noswipe" role="group" aria-label="더 보기 도구">
      <div className="bd-more-fs">
        <span className="bd-more-label">글자 크기</span>
        <button type="button" className="btn bd-more-btn" onClick={() => props.onFs(-1)} disabled={props.fs <= 0} aria-label="글자 작게">
          A−
        </button>
        <span className="bd-more-val" aria-live="polite">
          {(FS_LABELS as Record<number, string>)[props.fs] || ""}
        </span>
        <button type="button" className="btn bd-more-btn" onClick={() => props.onFs(1)} disabled={props.fs >= 3} aria-label="글자 크게">
          A+
        </button>
      </div>
      <div className="bd-more-grid">
        <button type="button" className={"btn bd-more-btn" + (props.pop === "picker" ? " is-on" : "")} aria-pressed={props.pop === "picker"} onClick={pick(() => props.onPop(props.pop === "picker" ? null : "picker"))}>
          <TIcon name="dice" size="lg" />
          <span>번호 뽑기</span>
        </button>
        {props.canFull ? (
          <button type="button" className={"btn bd-more-btn" + (props.fullOn ? " is-on" : "")} aria-pressed={props.fullOn} onClick={pick(props.onFull)}>
            <TIcon name="full" size="lg" />
            <span>{props.fullOn ? "전체 화면 끄기" : "전체 화면"}</span>
          </button>
        ) : null}
        <button type="button" className={"btn bd-more-btn" + (props.chalk ? " is-on" : "")} aria-pressed={props.chalk} onClick={pick(props.onChalk)}>
          <TIcon name="theme" size="lg" />
          <span>{props.chalk ? "칠판색 끄기" : "칠판색"}</span>
        </button>
        <button type="button" className="btn bd-more-btn" aria-expanded={false} onClick={() => setKeys(true)}>
          <span className="bd-more-kbd" aria-hidden="true">
            ⌨
          </span>
          <span>키보드로 하기</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 칠판 아래 도구띠의 왼쪽(도구 칸). Stage 의 `.bd-bar-tools` 자리에 그대로 넣어요.
 *   [나가기] ┃ [판서][타이머][가림막][확대][더 보기]
 *   판서가 켜지면: [나가기] ┃ [판서 끄기][펜 3색·형광펜·지우개·되돌리기·모두 지우기]
 */
export function BoardToolbar(props: BoardToolbarProps) {
  const [more, setMore] = useState(false);
  const [ask, setAsk] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useDismiss(more, moreRef, () => setMore(false));

  // 판서를 켜면 '더 보기'는 닫아요
  useEffect(() => {
    if (props.ink) setMore(false);
  }, [props.ink]);

  const moreDot = props.pop === "picker" || props.chalk || props.fullOn;
  const cancelAsk = useCallback(() => setAsk(false), []);

  return (
    <div className="bd-bar-tools" role="toolbar" aria-label="칠판 도구">
      <BarTool icon="home" label="나가기" className="bd-tool-exit" onClick={() => setAsk(true)} ariaLabel="수업 나가기" />
      <span className="bd-bar-sep" aria-hidden="true" />
      <BarTool icon="pen" label={props.ink ? "판서 끄기" : "판서"} on={props.ink} onClick={() => props.onInk(!props.ink)} />
      {props.ink ? (
        <div className="bd-pens" role="group" aria-label="펜 고르기">
          {BAR_PENS.map((p) => {
            const on = props.tool === p.tool && (p.tool !== "pen" || props.color === p.color);
            return (
              <button key={p.label} type="button" className={"bd-pen " + p.cls + (on ? " is-on" : "")} aria-pressed={on} aria-label={p.label} title={p.label} onClick={() => props.onPen(p.tool, p.color)}>
                {p.tool === "eraser" ? <TIcon name="eraser" size="lg" /> : p.tool === "hl" ? <TIcon name="marker" size="lg" /> : <i aria-hidden="true" />}
              </button>
            );
          })}
          <button type="button" className="bd-pen" onClick={props.onUndo} disabled={!props.canUndo} aria-label="되돌리기" title="되돌리기">
            <TIcon name="undo" size="lg" />
          </button>
          <button type="button" className="bd-pen" onClick={props.onClear} disabled={!props.canClear} aria-label="모두 지우기" title="모두 지우기">
            <TIcon name="trash" size="lg" />
          </button>
        </div>
      ) : (
        <>
          <BarTool icon="timer" label="타이머" badge={props.timerBadge} on={props.pop === "timer"} onClick={() => props.onPop(props.pop === "timer" ? null : "timer")} />
          <BarTool icon="curtain" label="가림막" on={props.curtain} onClick={props.onCurtain} />
          <BarTool icon="zoom" label={props.zoomOn ? "확대 끄기" : "확대"} on={props.zoomed} onClick={props.onZoom} />
          <div className="bd-more" ref={moreRef}>
            <BarTool big="more" label="더 보기" className="bd-tool-more" on={more} expanded={more} dot={moreDot && !more} onClick={() => setMore((v) => !v)} />
            {more ? <MoreMenu {...props} onClose={() => setMore(false)} /> : null}
          </div>
        </>
      )}
      {ask ? <ExitAsk href={props.exitHref} onCancel={cancelAsk} /> : null}
    </div>
  );
}
