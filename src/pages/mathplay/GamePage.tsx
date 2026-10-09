import { Suspense, lazy, useMemo, type ComponentType } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Shell from "./Shell";
import { GAMES, floorInfo, gameById } from "./games/registry";

const mods = import.meta.glob("./games/*.tsx") as Record<string, () => Promise<{ default: ComponentType }>>;

/** 게임 한 판 화면: 바로 놀 수 있게 게임이 먼저, 방법과 ‘알고 보니’는 아래에 */
export default function GamePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const g = id ? gameById(id) : undefined;
  const Game = useMemo(() => {
    const load = g && mods[`./games/${g.id}.tsx`];
    return load ? lazy(load) : null;
  }, [g]);
  if (!g) return <Navigate to="/mathplay" replace />;
  const f = floorInfo(g.floor);
  const same = GAMES.filter((x) => x.level === g.level);
  const i = same.findIndex((x) => x.id === g.id);
  const next = same[(i + 1) % same.length];
  const randomOne = () => {
    const others = same.filter((x) => x.id !== g.id);
    nav(`/mathplay/game/${others[Math.floor(Math.random() * others.length)].id}`);
  };

  return (
    <Shell title={g.title} lead={<p className="text-base sm:text-lg">{g.blurb}</p>}>
      <p className="mt-3 flex flex-wrap items-center gap-2">
        <Link to={`/mathplay?f=${g.floor}`} className="inline-flex min-h-[44px] items-center rounded-full bg-accent-soft px-3 text-sm font-semibold text-accent">
          {f.emoji} {f.label} {f.name}
        </Link>
        {g.level === "upper" && <span className="rounded-full bg-line/60 px-3 py-1 text-sm font-semibold text-muted">중·고등 도전 게임</span>}
      </p>

      <div className="mt-4">
        {Game ? (
          <Suspense fallback={<p className="p-8 text-center text-muted">게임을 불러오는 중…</p>}>
            <Game />
          </Suspense>
        ) : (
          <p className="rounded-card border border-line bg-surface p-8 text-center text-muted">이 게임은 준비 중이에요.</p>
        )}
      </div>

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

      <nav className="mt-6 grid gap-2 sm:grid-cols-3" aria-label="다른 게임">
        <button type="button" onClick={randomOne} className="min-h-[56px] rounded-card bg-accent px-4 text-lg font-extrabold text-accent-ink hover:brightness-110">
          🎲 아무 게임이나!
        </button>
        <Link to={`/mathplay/game/${next.id}`} className="flex min-h-[56px] items-center justify-center rounded-card border border-line bg-surface px-4 font-bold hover:bg-bg">
          다음: {next.title} →
        </Link>
        <Link to="/mathplay" className="flex min-h-[56px] items-center justify-center rounded-card border border-line bg-surface px-4 font-bold hover:bg-bg">
          게임 목록
        </Link>
      </nav>
    </Shell>
  );
}
