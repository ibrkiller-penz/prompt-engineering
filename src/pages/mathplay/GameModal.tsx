import { Suspense, lazy, useEffect, useMemo, type ComponentType } from "react";
import { GAMES, floorInfo, gameById } from "./games/registry";

const mods = import.meta.glob("./games/*.tsx") as Record<string, () => Promise<{ default: ComponentType }>>;
const puzzleMods: Record<string, () => Promise<{ default: ComponentType }>> = {
  calendar: () => import("./CalendarPuzzle"),
  tetromino: () => import("./TetrominoPuzzle"),
  colorsquare: () => import("./ColorSquare"),
};

/** 게임 팝업: 게임을 누르면 이 창 안에서 바로 논다. 드래그도 이 창 안에서 한다. */
export default function GameModal({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const g = gameById(id);
  const Game = useMemo(() => {
    const load = puzzleMods[id] ?? mods[`./games/${id}.tsx`];
    return load ? lazy(load) : null;
  }, [id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", h);
    };
  }, [onClose]);

  if (!g) return null;
  const f = floorInfo(g.floor);
  const same = GAMES.filter((x) => x.level === g.level);
  const next = same[(same.findIndex((x) => x.id === g.id) + 1) % same.length];
  const randomOne = () => {
    const others = same.filter((x) => x.id !== g.id);
    onOpen(others[Math.floor(Math.random() * others.length)].id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={g.title} onClick={onClose}>
      <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-bg shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-card" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-extrabold leading-tight sm:text-xl">{g.title}</h2>
            <p className="truncate text-xs text-muted">
              {f.emoji} {f.label} {f.name}
              {g.level === "upper" ? " · 중·고등 도전" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} autoFocus className="min-h-[48px] shrink-0 rounded-card border border-line bg-surface px-4 text-lg font-bold hover:bg-bg" aria-label="게임 닫기">
            ✕ 닫기
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-4">
          <p className="mb-3 text-[0.95rem] text-muted">{g.blurb}</p>
          {Game ? (
            <Suspense fallback={<p className="p-8 text-center text-muted">게임을 불러오는 중…</p>}>
              <Game />
            </Suspense>
          ) : (
            <p className="rounded-card border border-line bg-surface p-8 text-center text-muted">이 게임은 준비 중이에요.</p>
          )}

          <details className="mt-5 rounded-card border border-line bg-surface p-3">
            <summary className="min-h-[44px] cursor-pointer py-2 font-bold">❓ 어떻게 하는 거예요?</summary>
            <p className="pb-2 text-[0.95rem] text-muted">{g.how}</p>
          </details>
          <details className="mt-3 rounded-card border border-line bg-surface p-3">
            <summary className="min-h-[44px] cursor-pointer py-2 font-bold">💡 알고 보니…</summary>
            <ul className="list-disc space-y-1.5 pb-2 pl-5 text-[0.95rem] text-muted">
              {g.think.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </details>
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-line bg-surface p-2 sm:p-3">
          <button type="button" onClick={randomOne} className="min-h-[52px] rounded-card bg-accent px-2 text-base font-extrabold sm:text-lg text-accent-ink hover:brightness-110">
            🎲 아무 게임이나!
          </button>
          <button type="button" onClick={() => onOpen(next.id)} className="min-h-[52px] rounded-card border border-line bg-surface px-2 text-sm font-bold hover:bg-bg sm:text-base">
            다음: {next.title} →
          </button>
        </footer>
      </div>
    </div>
  );
}
