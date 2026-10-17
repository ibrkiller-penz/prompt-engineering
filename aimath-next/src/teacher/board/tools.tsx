// 교실 도구(칠판 무대 위에 뜨는 것): 타이머 1·3·5분 · 가림막 · 번호 뽑기. 모두 메모리에만 두고 저장하지 않아요.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { TIcon } from "../../shared/icons/teacher.tsx";
import { drawNumber, mmss } from "./board.logic.ts";

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
