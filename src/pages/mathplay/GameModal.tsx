import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { getSound, setSound } from "./games/kit";
import { GAMES, floorInfo, gameById } from "./games/registry";
import Thumb from "./Thumb";
import { useGameFont } from "./theme";

const mods = import.meta.glob("./games/*.tsx") as Record<string, () => Promise<{ default: ComponentType }>>;
const puzzleMods: Record<string, () => Promise<{ default: ComponentType }>> = {
  calendar: () => import("./CalendarPuzzle"),
  tetromino: () => import("./TetrominoPuzzle"),
  colorsquare: () => import("./ColorSquare"),
};

/** 게임 창: 화면을 거의 꽉 채운 창. 시작 화면 → ▶ 시작 → 게임. 오른쪽 위 ✕ 로 끈다. */
export default function GameModal({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  useGameFont();
  const g = gameById(id);
  const [sound, setSoundState] = useState(getSound());
  const [started, setStarted] = useState(false);
  const [help, setHelp] = useState(false);
  const Game = useMemo(() => {
    const load = puzzleMods[id] ?? mods[`./games/${id}.tsx`];
    return load ? lazy(load) : null;
  }, [id]);

  // 다른 게임으로 바뀌면 시작 화면부터
  useEffect(() => {
    setStarted(false);
    setHelp(false);
  }, [id]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", h);
    };
  }, [onClose]);

  if (!g) return null;
  const f = floorInfo(g.floor);
  const same = GAMES.filter((x) => x.level === g.level);
  const randomOne = () => {
    const others = same.filter((x) => x.id !== g.id);
    onOpen(others[Math.floor(Math.random() * others.length)].id);
  };
  const zoneStyle = { "--zone": f.zone } as CSSProperties;
  const iconBtn = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/90 text-2xl shadow-[0_3px_0_0_rgba(0,0,0,0.15)] transition hover:scale-105 active:translate-y-[2px] active:shadow-none";

  return (
    <div className="fixed inset-0 z-50 bg-black/55 sm:p-3" role="dialog" aria-modal="true" aria-label={g.title}>
      <div className="gamezone flex h-full w-full flex-col overflow-hidden bg-bg text-ink shadow-2xl sm:rounded-[28px]" style={zoneStyle}>
        {/* 위 막대: 게임 이름 · 도움말 · 다른 게임 · 소리 · ✕ */}
        <header className="flex items-center gap-2 px-3 py-2 text-white sm:px-4" style={{ background: `linear-gradient(90deg, ${f.grad[0]}, ${f.grad[1]})` }}>
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-2 border-white/70">
            <Thumb id={g.id} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-game truncate text-xl leading-tight sm:text-2xl">{g.title}</h2>
            <p className="truncate text-xs font-semibold opacity-90">
              {f.emoji} {f.label} {f.name}
              {g.level === "upper" ? " · 중·고 도전" : ""}
            </p>
          </div>
          <button type="button" onClick={() => setHelp((o) => !o)} aria-pressed={help} aria-label="하는 방법 보기" className={iconBtn}>
            ❓
          </button>
          <button type="button" onClick={randomOne} aria-label="다른 게임 아무거나" className={`${iconBtn} hidden sm:flex`}>
            🎲
          </button>
          <button
            type="button"
            onClick={() => {
              setSound(!sound);
              setSoundState(!sound);
            }}
            aria-pressed={sound}
            aria-label={sound ? "소리 끄기" : "소리 켜기"}
            className={iconBtn}
          >
            {sound ? "🔊" : "🔇"}
          </button>
          <button type="button" onClick={onClose} autoFocus aria-label="게임 끄기" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ff4d6d] text-2xl font-black text-white shadow-[0_3px_0_0_rgba(0,0,0,0.25)] ring-4 ring-white/70 transition hover:scale-105 active:translate-y-[2px] active:shadow-none">
            ✕
          </button>
        </header>

        {help && (
          <div className="gz-pop border-b-2 border-line bg-surface px-4 py-3 text-[0.98rem]">
            <p className="font-game text-lg text-accent">❓ 어떻게 해요?</p>
            <p className="mt-1">{g.how}</p>
            <p className="font-game mt-3 text-lg text-accent">💡 알고 보니…</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              {g.think.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setHelp(false)} className="font-game mt-3 min-h-[44px] rounded-2xl bg-accent px-5 text-white shadow-[0_4px_0_0_rgba(0,0,0,0.2)]">
              알겠어요!
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ background: `radial-gradient(circle at 15% 0%, color-mix(in srgb, ${f.grad[0]} 18%, transparent), transparent 45%), radial-gradient(circle at 100% 100%, color-mix(in srgb, ${f.grad[1]} 14%, transparent), transparent 50%)` }}>
          {!started ? (
            // 시작 화면
            <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center px-6 py-8 text-center">
              <div className="gz-pop w-48 overflow-hidden rounded-[36px] border-4 border-white shadow-[0_10px_0_0_rgba(0,0,0,0.08),0_20px_40px_rgba(0,0,0,0.15)] sm:w-56">
                <Thumb id={g.id} size="lg" bob />
              </div>
              <h3 className="font-game mt-6 text-4xl text-ink">{g.title}</h3>
              <p className="mt-2 text-lg text-muted">{g.blurb}</p>
              <p className="mt-4 rounded-2xl border-2 border-line bg-surface px-4 py-3 text-left text-[0.98rem] shadow-[0_3px_0_0_rgba(0,0,0,0.04)]">
                <span className="font-game text-accent">어떻게 해요? </span>
                {g.how}
              </p>
              <button
                type="button"
                onClick={() => setStarted(true)}
                className="font-game mt-6 min-h-[64px] w-full max-w-xs rounded-full bg-accent px-8 text-3xl text-white shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition hover:brightness-110 active:translate-y-[4px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
              >
                ▶ 시작!
              </button>
              <button type="button" onClick={randomOne} className="font-game mt-4 min-h-[44px] px-4 text-lg text-muted underline underline-offset-4 hover:text-ink">
                🎲 다른 게임 할래요
              </button>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl px-3 py-3 sm:px-5 sm:py-5">
              {Game ? (
                <Suspense fallback={<p className="font-game p-10 text-center text-2xl text-muted">불러오는 중… 🎮</p>}>
                  <Game />
                </Suspense>
              ) : (
                <p className="rounded-3xl border-2 border-line bg-surface p-10 text-center text-muted">이 게임은 준비 중이에요.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
