// 아래에서 올라오는 시트(힌트·용어 풀이·설정). 뒤를 어둡게 덮고, Esc·바깥 누르기·닫기 단추로 닫아요.
// 열리면 시트 안으로 초점을 옮기고, 닫히면 연 단추로 돌려줘요.
import { useEffect, useRef, type ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** 닫기 단추 글자(기본 '닫기') */
  closeLabel?: string;
  className?: string;
}

let seq = 0;

export function Sheet({ open, title, onClose, children, closeLabel, className }: SheetProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const idRef = useRef("ui-sheet-" + ++seq);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = box.current;
    if (el) el.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key === "Tab" && el) {
        // 초점이 시트 밖으로 나가지 않게
        const f = el.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (prev && typeof prev.focus === "function") {
        try {
          prev.focus();
        } catch {
          /* 무시 */
        }
      }
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div className="scrim ui-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={box} className={"sheet ui-sheet" + (className ? " " + className : "")} role="dialog" aria-modal="true" aria-labelledby={idRef.current} tabIndex={-1}>
        <div className="ui-sheet-head">
          <h2 id={idRef.current} className="ui-sheet-title">
            {title}
          </h2>
          <button type="button" className="btn btn-ghost ui-sheet-close" onClick={onClose}>
            {closeLabel || "닫기"}
          </button>
        </div>
        <div className="ui-sheet-body">{children}</div>
      </div>
    </>
  );
}
