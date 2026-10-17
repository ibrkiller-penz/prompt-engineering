// 카드 한 장씩 넘기는 틀(레슨 카드·계단 문제·복습·마무리 도전 공용).
//  - 아래 ActionBar: [이전] 위치 줄 [다음]
//  - 좌우로 쓸어 넘기기. 체험 도구·표·수식처럼 손으로 끄는 곳(data-noswipe, 입력칸 등)에서는 넘기지 않아요.
//  - 키보드 ←/→ 로도 넘겨요(입력칸에 있을 때는 빼고).
//  - 카드가 바뀌면 맨 위로 올리고 카드 제목에 초점을 옮겨요(화면 읽기 도구가 새 카드를 읽게).
import { useEffect, useRef, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Icon } from "../../shared/icons/index.ts";
import { ActionBar, SiteBand, TopBar } from "./Shell.tsx";
import { swipeDir } from "./swipe.logic.ts";

export interface CardDeckProps {
  /** 카드가 바뀌었는지 알아보는 값(주소 등) */
  cardKey: string;
  title: ReactNode;
  eyebrow?: ReactNode;
  backTo?: string;
  topRight?: ReactNode;
  /** ActionBar 위 진행 레일 */
  rail?: ReactNode;
  /** 위치 줄(예: "개념 2 · 3/5장") */
  pos: ReactNode;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  nextLabel?: string;
  prevLabel?: string;
  /** 다음 단추를 강조하지 않음(확인 문제를 아직 안 풀었을 때 등) */
  nextSoft?: boolean;
  children: ReactNode;
}

const NOSWIPE = "[data-noswipe], input, textarea, select, .math-block, .katex-display, .scroll-x, .ui-widget, .s-noswipe, table";

function blocked(t: EventTarget | null): boolean {
  const el = t as Element | null;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest(NOSWIPE);
}

export function CardDeck(props: CardDeckProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number; t: number; ok: boolean } | null>(null);
  const handlers = useRef({ prev: props.onPrev, next: props.onNext });
  handlers.current = { prev: props.onPrev, next: props.onNext };

  // 카드가 바뀌면 맨 위로, 초점은 카드 첫 제목으로
  const first = useRef(true);
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {
      /* 무시 */
    }
    if (first.current) {
      first.current = false;
      return;
    }
    const el = box.current;
    if (!el) return;
    const h = el.querySelector<HTMLElement>("h1, h2, h3");
    if (h) {
      if (!h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      try {
        h.focus({ preventScroll: true });
      } catch {
        h.focus();
      }
    }
  }, [props.cardKey]);

  // 키보드 ←/→
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector(".ui-sheet")) return;
      if (e.key === "ArrowRight" && handlers.current.next) {
        e.preventDefault();
        handlers.current.next();
      } else if (e.key === "ArrowLeft" && handlers.current.prev) {
        e.preventDefault();
        handlers.current.prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onDown = (e: RPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, t: Date.now(), ok: !blocked(e.target) };
  };
  const onUp = (e: RPointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || !s.ok) return;
    try {
      const sel = window.getSelection && window.getSelection();
      if (sel && String(sel).length > 0) return; // 글자를 고르는 중
    } catch {
      /* 무시 */
    }
    const d = swipeDir(e.clientX - s.x, e.clientY - s.y, Date.now() - s.t);
    if (d === "next" && handlers.current.next) handlers.current.next();
    else if (d === "prev" && handlers.current.prev) handlers.current.prev();
  };

  return (
    <div className="s-deck-wrap">
      <SiteBand />
      <TopBar title={props.title} eyebrow={props.eyebrow} backTo={props.backTo} right={props.topRight} hardBack={!!props.backTo} />
      <main id="main" className="s-main has-actionbar">
        <div ref={box} className="s-deck" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (start.current = null)}>
          <div key={props.cardKey} className="s-card-in">
            {props.children}
          </div>
        </div>
      </main>
      <ActionBar rail={props.rail}>
        <button type="button" className="btn s-prev" aria-label={props.prevLabel || "이전"} disabled={!props.onPrev} onClick={() => props.onPrev && props.onPrev()}>
          <Icon name="prev" />
          <span>{props.prevLabel || "이전"}</span>
        </button>
        <div className="grow s-pos" aria-live="polite">
          {props.pos}
        </div>
        <button
          type="button"
          className={"btn s-next " + (props.nextSoft ? "btn-soft" : "btn-primary")}
          disabled={!props.onNext}
          onClick={() => props.onNext && props.onNext()}
        >
          <span>{props.nextLabel || "다음"}</span>
          <Icon name="next" />
        </button>
      </ActionBar>
    </div>
  );
}
