import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * 수업 모드 (전자칠판 발표 보기): 한 화면에 한 블록씩, 글자를 크게.
 * ← → / Space / PageUp·PageDown 으로 넘기고 Esc 로 닫는다.
 * Tailwind 크기가 rem 기준이라 열려 있는 동안 html 글자 크기를 키운다.
 */
export default function ClassMode({ slides, title, onClose }: { slides: ReactNode[]; title: string; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(24);
  const last = slides.length - 1;

  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.fontSize;
    html.style.fontSize = `${zoom}px`;
    return () => {
      html.style.fontSize = before;
    };
  }, [zoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        setI((x) => Math.min(last, x + 1));
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setI((x) => Math.max(0, x - 1));
      } else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [last, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="수업 모드">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-1 text-[0.7rem]">
        <span className="truncate font-bold">{title}</span>
        <span className="ml-auto text-muted" aria-live="polite">
          {i + 1} / {slides.length}
        </span>
        <button type="button" className="rounded-full border border-line px-2" onClick={() => setZoom((z) => Math.max(16, z - 2))} aria-label="글자 작게">
          가−
        </button>
        <button type="button" className="rounded-full border border-line px-2" onClick={() => setZoom((z) => Math.min(36, z + 2))} aria-label="글자 크게">
          가+
        </button>
        <button type="button" className="rounded-full bg-ink px-3 text-white" onClick={onClose}>
          닫기 (Esc)
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">{slides[i]}</div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line bg-surface px-4 py-1">
        <button
          type="button"
          onClick={() => setI((x) => Math.max(0, x - 1))}
          disabled={i === 0}
          className="rounded-card border border-line px-4 font-semibold disabled:opacity-30"
        >
          ← 이전
        </button>
        <div className="flex flex-1 justify-center gap-1 overflow-hidden" aria-hidden>
          {slides.map((_, k) => (
            <span key={k} className={`h-1.5 w-full max-w-6 rounded-full ${k <= i ? "bg-accent" : "bg-line"}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setI((x) => Math.min(last, x + 1))}
          disabled={i === last}
          className="rounded-card bg-accent px-4 font-semibold text-accent-ink disabled:opacity-30"
        >
          다음 →
        </button>
      </div>
    </div>,
    document.body,
  );
}
