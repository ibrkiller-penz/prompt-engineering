import { Link, Navigate, useParams } from "react-router-dom";
import { availableLessons, isLevel, labScenarios, levelMeta } from "../../content/load";
import { load } from "../../lib/storage";

const GROUPS = [
  { label: "확인하는 법", desc: "결과물을 받기 전과 받은 뒤", from: 1, to: 7 },
  { label: "판단하고 기록하는 법", desc: "생각이 다를 때", from: 8, to: 10 },
  { label: "이어 가고 마무리하는 법", desc: "기록과 완결", from: 11, to: 13 },
];

export default function LevelHome() {
  const { level } = useParams();
  if (!isLevel(level)) return <Navigate to="/prompt" replace />;
  const meta = levelMeta(level);
  const ready = new Set(availableLessons(level));
  const progress = load<{ visited: number[]; last?: number }>(`progress:${level}`, { visited: [] });
  const labs = labScenarios(level);
  const first = ready.size > 0 ? Math.min(...ready) : undefined;

  return (
    <div>
      <p className="font-semibold text-accent">{meta.name}</p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-4xl">{meta.subtitle}</h1>
      <p className="mt-2 text-muted">
        함께할 친구들: {meta.characters} · 차시당 {meta.minutes}분
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        {progress.last && ready.has(progress.last) ? (
          <Link
            to={`/prompt/${level}/lesson/${progress.last}`}
            className="btn inline-flex items-center rounded-card bg-accent px-4 font-semibold text-accent-ink"
          >
            이어서 하기 — {progress.last}차시
          </Link>
        ) : first ? (
          <Link
            to={`/prompt/${level}/lesson/${first}`}
            className="btn inline-flex items-center rounded-card bg-accent px-4 font-semibold text-accent-ink"
          >
            {first}차시부터 시작하기
          </Link>
        ) : null}
        {labs.length > 0 && (
          <Link
            to={`/prompt/${level}/lab`}
            className="btn inline-flex items-center rounded-card border border-line bg-surface px-4 font-semibold"
          >
            프롬프트 실험실
          </Link>
        )}
      </div>

      {ready.size === 0 && (
        <p className="mt-6 rounded-card bg-warn-soft p-4 text-warn">
          {meta.name} 차시는 지금 준비하고 있어요. 먼저 열린 학교급의 차시를 둘러보세요.
        </p>
      )}

      <div className="mt-8 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.label}>
            <h2 className="text-lg font-bold">
              {g.from}~{g.to}차시 · {g.label} <span className="text-sm font-normal text-muted">({g.desc})</span>
            </h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {meta.lessons
                .filter((l) => l.n >= g.from && l.n <= g.to)
                .map((l) => {
                  const open = ready.has(l.n);
                  const done = progress.visited.includes(l.n);
                  const inner = (
                    <>
                      <span className="flex items-center justify-between text-sm font-bold text-accent">
                        {l.n}차시
                        {done && <span className="rounded-full bg-ok-soft px-2 text-xs text-ok">봤어요</span>}
                        {!open && <span className="rounded-full bg-line/70 px-2 text-xs text-muted">준비 중</span>}
                      </span>
                      <span className="mt-1 block font-semibold leading-snug">{l.title}</span>
                    </>
                  );
                  return (
                    <li key={l.n}>
                      {open ? (
                        <Link
                          to={`/prompt/${level}/lesson/${l.n}`}
                          className="block h-full rounded-card border border-line bg-surface p-4 transition hover:border-accent hover:shadow-md"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <div className="h-full rounded-card border border-dashed border-line p-4 opacity-60">{inner}</div>
                      )}
                    </li>
                  );
                })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
