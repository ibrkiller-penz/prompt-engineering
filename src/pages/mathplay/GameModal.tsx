import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { StageContext, getSound, setSound } from "./games/kit";
import { GAMES, floorInfo, gameById } from "./games/registry";
import Thumb from "./Thumb";
import { MAX_LEVEL, recordLevel, recordPlay, recordWin, starsOf, useSave } from "./progress";
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
  const [toast, setToast] = useState(0);
  // 레벨: 라운드를 다 깨면 축하 화면 뒤 다음 레벨로 게임을 새로 연다(1~10)
  const [stage, setStage] = useState(1);
  const [clear, setClear] = useState<{ n: number; left: number } | null>(null);
  const [allClear, setAllClear] = useState(false);
  const save = useSave();
  const cleared = save.levels?.[id] ?? 0;
  const [pickLevel, setPickLevel] = useState(1);
  const Game = useMemo(() => {
    const load = puzzleMods[id] ?? mods[`./games/${id}.tsx`];
    return load ? lazy(load) : null;
  }, [id]);

  // 다른 게임으로 바뀌면 시작 화면부터
  useEffect(() => {
    setStarted(false);
    setHelp(false);
    setStage(1);
    setClear(null);
    setAllClear(false);
  }, [id]);
  // 시작 화면에서 고를 레벨: 깬 다음 레벨(최대 10)
  useEffect(() => {
    setPickLevel(Math.min(MAX_LEVEL, (save.levels?.[id] ?? 0) + 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 단계 클리어 신호 → 3·2·1 뒤 다음 단계
  useEffect(() => {
    if (!started) return;
    const h = () => {
      recordLevel(id, stage);
      if (stage >= MAX_LEVEL) setAllClear(true);
      else setClear((c) => c ?? { n: stage, left: 3 });
    };
    window.addEventListener("gz:stage", h);
    return () => window.removeEventListener("gz:stage", h);
  }, [started, stage, id]);
  useEffect(() => {
    if (!clear) return;
    if (clear.left <= 0) {
      setStage(clear.n + 1);
      setClear(null);
      return;
    }
    const t = window.setTimeout(() => setClear({ ...clear, left: clear.left - 1 }), 1000);
    return () => window.clearTimeout(t);
  }, [clear]);

  // 게임이 성공(cheer)하면 별을 기록하고 ‘+⭐’를 띄운다
  useEffect(() => {
    if (!started) return;
    let t = 0;
    const h = () => {
      recordWin(id);
      setToast((n) => n + 1);
      window.clearTimeout(t);
      t = window.setTimeout(() => setToast(0), 1600);
    };
    window.addEventListener("gz:win", h);
    return () => {
      window.removeEventListener("gz:win", h);
      window.clearTimeout(t);
    };
  }, [started, id]);

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
      <div className="gamezone relative flex h-full w-full flex-col overflow-hidden bg-bg text-ink shadow-2xl sm:rounded-[28px]" style={zoneStyle}>
        {/* 위 막대: 게임 이름 · 도움말 · 다른 게임 · 소리 · ✕ */}
        <header className="flex items-center gap-2 px-3 py-2 text-white sm:px-4" style={{ background: `linear-gradient(90deg, ${f.grad[0]}, ${f.grad[1]})` }}>
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border-2 border-white/70">
            <Thumb id={g.id} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-game line-clamp-2 text-lg leading-tight sm:text-2xl">{g.title}</h2>
            <p className="truncate text-xs font-semibold opacity-90">
              <span className="mr-1 tracking-tight" aria-label={`별 ${starsOf(save.wins[g.id])}개`}>
                {"★".repeat(starsOf(save.wins[g.id]))}
                <span className="opacity-50">{"☆".repeat(3 - starsOf(save.wins[g.id]))}</span>
              </span>
              {started && <span className="mr-1 rounded-full bg-white/25 px-1.5">레벨 {stage}</span>}
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

        {clear && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/45 p-6" role="status" aria-live="assertive">
            <div className="gz-pop w-full max-w-sm rounded-[32px] bg-white p-6 text-center shadow-[0_10px_0_0_rgba(0,0,0,0.15)]">
              <p className="text-6xl">🏆</p>
              <p className="font-game mt-2 text-4xl text-accent">레벨 {clear.n} 클리어!</p>
              <p className="mt-1 text-lg text-muted">대단해요! 곧 레벨 {clear.n + 1}이 시작돼요</p>
              <div className="mx-auto mt-3 flex max-w-[260px] gap-1">{Array.from({ length: MAX_LEVEL }, (_, i) => <span key={i} className={`h-3 flex-1 rounded-full ${i < clear.n ? "bg-accent" : "bg-line"}`} />)}</div>
              <p className="font-game mt-3 text-6xl text-[#f59e0b]">{clear.left}</p>
              <button
                type="button"
                onClick={() => setClear({ ...clear, left: 0 })}
                className="font-game mt-4 min-h-[56px] w-full rounded-full bg-accent px-6 text-2xl text-white shadow-[0_5px_0_0_rgba(0,0,0,0.2)] active:translate-y-[3px]"
              >
                바로 다음 레벨 ▶
              </button>
            </div>
          </div>
        )}

        {allClear && (
          <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/45 p-6" role="status" aria-live="assertive">
            <div className="gz-pop w-full max-w-sm rounded-[32px] bg-white p-6 text-center shadow-[0_10px_0_0_rgba(0,0,0,0.15)]">
              <p className="text-6xl">👑</p>
              <p className="font-game mt-2 text-4xl text-accent">모든 레벨 클리어!</p>
              <p className="mt-1 text-lg text-muted">레벨 {MAX_LEVEL}까지 다 깼어요. 정말 최고예요!</p>
              <button type="button" onClick={randomOne} className="font-game mt-5 min-h-[56px] w-full rounded-full bg-accent px-6 text-2xl text-white shadow-[0_5px_0_0_rgba(0,0,0,0.2)] active:translate-y-[3px]">
                🎲 다른 게임 하기
              </button>
              <button
                type="button"
                onClick={() => {
                  setAllClear(false);
                  setStage(1);
                }}
                className="font-game mt-3 min-h-[48px] w-full rounded-full border-2 border-line px-6 text-xl text-ink"
              >
                레벨 1부터 다시
              </button>
            </div>
          </div>
        )}

        {toast > 0 && (
          <div className="pointer-events-none fixed left-1/2 top-20 z-[85] -translate-x-1/2" aria-live="polite">
            <span key={toast} className="gz-pop font-game inline-block rounded-full bg-white px-5 py-2 text-2xl text-[#f59e0b] shadow-[0_6px_0_0_rgba(0,0,0,0.15)] ring-4 ring-[#ffd166]">
              +⭐ 잘했어요!
            </span>
          </div>
        )}

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
            <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-6 py-8 text-center md:max-w-5xl md:flex-row md:gap-14 md:px-10 md:py-10 md:text-left">
              <div className="flex w-full flex-col items-center md:w-1/2 md:items-start">
              <div className="gz-pop w-48 overflow-hidden rounded-[36px] border-4 border-white shadow-[0_10px_0_0_rgba(0,0,0,0.08),0_20px_40px_rgba(0,0,0,0.15)] sm:w-56">
                <Thumb id={g.id} size="lg" bob />
              </div>
              <h3 className="font-game mt-6 text-4xl text-ink">{g.title}</h3>
              <p className="mt-2 text-lg text-muted">{g.blurb}</p>
              <p className="mt-4 w-full max-w-md rounded-2xl border-2 border-line bg-surface px-4 py-3 text-left text-[0.98rem] shadow-[0_3px_0_0_rgba(0,0,0,0.04)]">
                <span className="font-game text-accent">어떻게 해요? </span>
                {g.how}
              </p>
              </div>
              <div className="flex w-full flex-col items-center md:w-1/2">
              <div className="mt-5 w-full">
                <p className="font-game text-lg text-ink">
                  레벨 고르기 <span className="text-sm text-muted">(깬 레벨 {cleared}/{MAX_LEVEL})</span>
                </p>
                <div className="mt-2 grid w-full grid-cols-5 gap-2 md:max-w-sm md:gap-3">
                  {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lv) => {
                    const open = lv <= cleared + 1;
                    const done = lv <= cleared;
                    return (
                      <button
                        key={lv}
                        type="button"
                        disabled={!open}
                        onClick={() => setPickLevel(lv)}
                        aria-pressed={pickLevel === lv}
                        aria-label={`레벨 ${lv}${done ? " 깼음" : open ? "" : " 잠김"}`}
                        className={`font-game flex aspect-square min-h-[44px] items-center justify-center rounded-2xl text-xl shadow-[0_3px_0_0_rgba(0,0,0,0.12)] transition active:translate-y-[2px] ${
                          pickLevel === lv ? "bg-accent text-white ring-4 ring-accent/30" : done ? "bg-[#fff1b8] text-[#b45309]" : open ? "bg-surface text-ink" : "bg-line/60 text-muted opacity-60"
                        }`}
                      >
                        {open ? (done && pickLevel !== lv ? "⭐" : lv) : "🔒"}
                      </button>
                    );
                  })}
                </div>
              </div>
              {g.credit && (
                <p className="mt-4 w-full max-w-md rounded-2xl border-2 border-line bg-surface px-3 py-2 text-left text-sm shadow-[0_3px_0_0_rgba(0,0,0,0.04)]">
                  <span className="font-game text-accent">🌍 세계의 놀이에서 영감</span>
                  <span className="mt-0.5 block text-muted">
                    {g.credit.country}의 {g.credit.site}에도 ‘{g.credit.what}’이(가) 있어요. 이 게임은 그 아이디어를 바탕으로 새로 만들었어요.{" "}
                    <a href={g.credit.href} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-4">
                      원조 사이트 ↗
                    </a>
                  </span>
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  recordPlay(g.id);
                  setStage(pickLevel);
                  setStarted(true);
                }}
                className="font-game mt-6 min-h-[64px] w-full max-w-xs rounded-full bg-accent px-8 text-3xl text-white shadow-[0_6px_0_0_rgba(0,0,0,0.25)] transition hover:brightness-110 active:translate-y-[4px] active:shadow-[0_2px_0_0_rgba(0,0,0,0.25)]"
              >
                ▶ 레벨 {pickLevel} 시작!
              </button>
              <button type="button" onClick={randomOne} className="font-game mt-4 min-h-[44px] px-4 text-lg text-muted underline underline-offset-4 hover:text-ink">
                🎲 다른 게임 할래요
              </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl px-3 py-3 sm:px-5 sm:py-5 md:max-w-6xl md:px-8">
              {Game ? (
                <Suspense fallback={<p className="font-game p-10 text-center text-2xl text-muted">불러오는 중… 🎮</p>}>
                  <StageContext.Provider value={stage}>
                    <Game key={stage} />
                  </StageContext.Provider>
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
