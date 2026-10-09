import { Suspense, lazy, useMemo, useState, type ComponentType } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import Shell from "./Shell";
import { FLOOR2, FLOOR3, FLOOR4 } from "./floorData";
import { GAMES, gameById } from "./games/registry";
import { VideoDialog, YT } from "./FloorPage";

const mods = import.meta.glob("./games/*.tsx") as Record<string, () => Promise<{ default: ComponentType }>>;
const FLOOR_LABEL = { "2f": "2F 수학놀이관", "3f": "3F 진로탐색관", "4f": "4F 교과체험관" } as const;
const ALL = [...FLOOR2.items, ...FLOOR3.items, ...FLOOR4.items];

/** 게임 한 판 화면: 방법, 게임 판, 생각해 볼 질문, 본뜬 체험 */
export default function GamePage() {
  const { id } = useParams();
  const g = id ? gameById(id) : undefined;
  const [open, setOpen] = useState<{ name: string; id: string } | null>(null);
  const Game = useMemo(() => {
    const load = g && mods[`./games/${g.id}.tsx`];
    return load ? lazy(load) : null;
  }, [g]);
  if (!g) return <Navigate to="/mathplay" replace />;
  const i = GAMES.findIndex((x) => x.id === g.id);
  const prev = GAMES[(i + GAMES.length - 1) % GAMES.length];
  const next = GAMES[(i + 1) % GAMES.length];
  const exps = ALL.filter((x) => g.exps.some((k) => x.n.includes(k)));

  return (
    <Shell title={g.title} lead={<p>{g.blurb}</p>}>
      <p className="mt-3">
        <Link to={`/mathplay/busan/${g.floor}`} className="inline-flex min-h-[44px] items-center rounded-full bg-accent-soft px-3 text-sm font-semibold text-accent">
          {FLOOR_LABEL[g.floor]} 체험
        </Link>
      </p>
      <p className="mt-3 rounded-card bg-bg p-3 text-[0.95rem]">
        <strong>하는 방법</strong> · {g.how}
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

      <section className="mt-8 rounded-card bg-accent-soft/60 p-4">
        <h2 className="font-extrabold">🤔 생각해 봐요</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[0.95rem]">
          {g.think.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="font-extrabold">이 게임이 본뜬 체험</h2>
        <ul className="mt-2 space-y-2">
          {exps.map((x) => (
            <li key={x.n} className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3">
              <span className="min-w-0 flex-1 font-semibold">{x.n}</span>
              {x.v && (
                <>
                  <button type="button" onClick={() => setOpen({ name: x.n, id: x.v })} className="min-h-[44px] rounded-card bg-accent-soft px-4 font-semibold text-accent hover:brightness-95">
                    ▶ 실제 체험 영상
                  </button>
                  <a href={YT(x.v)} target="_blank" rel="noopener" className="text-sm font-semibold text-muted underline underline-offset-4">
                    유튜브 ↗
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">체험 이름과 수학 내용을 바탕으로 새로 만든 게임이에요. 실제 체험과 방법이 다를 수 있어요.</p>
      </section>

      <nav className="mt-8 flex flex-wrap justify-between gap-2" aria-label="다른 게임">
        <Link to={`/mathplay/game/${prev.id}`} className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold hover:bg-bg">
          ← {prev.title}
        </Link>
        <Link to="/mathplay" className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold hover:bg-bg">
          게임 목록
        </Link>
        <Link to={`/mathplay/game/${next.id}`} className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold hover:bg-bg">
          {next.title} →
        </Link>
      </nav>
      {open && <VideoDialog name={open.name} id={open.id} onClose={() => setOpen(null)} />}
    </Shell>
  );
}
