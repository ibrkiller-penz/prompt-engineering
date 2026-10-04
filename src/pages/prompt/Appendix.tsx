import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { getCards, getGlossary, getPledge, isLevel, levelMeta } from "../../content/load";
import type { Level } from "../../content/types";
import { useStored } from "../../lib/storage";
import { Button, Card, CopyButton } from "../../components/ui";

function useLevel(): Level | null {
  const { level } = useParams();
  return isLevel(level) ? level : null;
}

function NotReady({ level, what }: { level: Level; what: string }) {
  return (
    <Card>
      <p>
        {levelMeta(level).name} {what}은(는) 지금 준비하고 있어요.
      </p>
      <Link to={`/prompt/${level}`} className="mt-3 inline-block font-semibold text-accent underline">
        13차시로 돌아가기
      </Link>
    </Card>
  );
}

/** 부록 1 — 바로 쓰는 말/문장/요청문 카드 */
export function CardsPage() {
  const level = useLevel();
  if (!level) return <Navigate to="/prompt" replace />;
  const data = getCards(level);
  if (!data) return <NotReady level={level} what="카드" />;
  return (
    <div>
      <p className="font-semibold text-accent">{levelMeta(level).name} · 부록</p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{data.title}</h1>
      {data.intro && <p className="mt-2 max-w-2xl text-muted">{data.intro}</p>}
      <div className="mt-6 space-y-8">
        {data.groups.map((g) => (
          <section key={g.title}>
            {g.title !== data.title && data.groups.length > 1 && <h2 className="text-lg font-bold">{g.title}</h2>}
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {g.cards.map((c, i) => (
                <li key={i} className="flex flex-col rounded-card border border-line bg-surface p-4">
                  {(c.lesson || c.when) && (
                    <p className="text-sm font-semibold text-accent">
                      {c.lesson ? `${c.lesson}차시` : ""}
                      {c.lesson && c.when ? " · " : ""}
                      {c.when}
                    </p>
                  )}
                  <p className="mt-1 flex-1 text-lg font-semibold leading-snug">“{c.text}”</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton text={c.text} />
                    <Link
                      to={`/prompt/${level}/lab?try=${encodeURIComponent(c.text)}`}
                      className="btn inline-flex items-center rounded-card border border-line px-3 text-sm font-semibold"
                    >
                      실험실에서 써 보기
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** 부록 2 — 낱말/개념 사전 */
export function GlossaryPage() {
  const level = useLevel();
  const [q, setQ] = useState("");
  const data = level ? getGlossary(level) : undefined;
  const words = useMemo(
    () => (data?.words ?? []).filter((w) => !q.trim() || (w.term + w.def).includes(q.trim())),
    [data, q],
  );
  if (!level) return <Navigate to="/prompt" replace />;
  if (!data) return <NotReady level={level} what="사전" />;
  return (
    <div>
      <p className="font-semibold text-accent">{levelMeta(level).name} · 부록</p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{data.title}</h1>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="낱말 찾기"
        aria-label="낱말 찾기"
        className="mt-4 min-h-[44px] w-full max-w-sm rounded-card border border-line bg-surface px-3 outline-none focus:border-accent"
      />
      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {words.map((w) => (
          <div key={w.term} className="rounded-card border border-line bg-surface p-4">
            <dt className="text-lg font-bold text-accent">{w.term}</dt>
            <dd className="mt-1">{w.def}</dd>
            {w.example && <dd className="mt-1 text-sm text-muted">예) {w.example}</dd>}
            {w.lessons && w.lessons.length > 0 && (
              <dd className="mt-2 flex flex-wrap gap-1">
                {w.lessons.map((n) => (
                  <Link
                    key={n}
                    to={`/prompt/${level}/lesson/${n}`}
                    className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-semibold text-accent"
                  >
                    {n}차시
                  </Link>
                ))}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {words.length === 0 && <p className="mt-4 text-muted">찾는 낱말이 없어요.</p>}
    </div>
  );
}

/** 나의 AI 약속 / AI 사용 약속 / 나의 AI 협업 원칙 — 이름은 화면에만 (저장하지 않음) */
export function PledgePage() {
  const level = useLevel();
  const [checks, setChecks] = useStored<boolean[]>(`pledge:${level}`, []);
  const [name, setName] = useState("");
  if (!level) return <Navigate to="/prompt" replace />;
  const data = getPledge(level);
  if (!data) return <NotReady level={level} what="약속" />;
  const all = data.items.every((_, i) => checks[i]);
  return (
    <div>
      <p className="no-print font-semibold text-accent">{levelMeta(level).name}</p>
      <div className="mx-auto mt-2 max-w-2xl rounded-card border-4 border-double border-accent bg-surface p-6 sm:p-10">
        <h1 className="text-center text-2xl font-extrabold sm:text-3xl">{data.title}</h1>
        {data.intro && <p className="mt-3 text-center text-muted">{data.intro}</p>}
        <ol className="mt-6 space-y-3">
          {data.items.map((it, i) => (
            <li key={i}>
              <label className="flex cursor-pointer gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-6 w-6 shrink-0 accent-[var(--accent)]"
                  checked={!!checks[i]}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setChecks((p) => {
                      const n = [...p];
                      n[i] = on;
                      return n;
                    });
                  }}
                />
                <span>
                  <span className="font-bold">
                    {i + 1}. {it.title}
                  </span>
                  {it.body && <span className="block text-muted">{it.body}</span>}
                </span>
              </label>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-end justify-end gap-2">
          <label className="text-right">
            <span className="block text-sm text-muted">약속한 사람 (화면에만 보이고 저장되지 않아요)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] w-48 border-b-2 border-ink bg-transparent px-2 text-center text-lg font-semibold outline-none"
              aria-label="약속한 사람"
            />
          </label>
        </div>
        {all && <p className="mt-6 text-center font-semibold text-ok">약속을 모두 확인했어요!</p>}
      </div>
      <div className="no-print mt-4 flex justify-center">
        <Button variant="soft" onClick={() => window.print()}>
          🖨 인쇄하기
        </Button>
      </div>
      <p className="no-print mt-2 text-center text-xs text-muted">출처: {data.source}</p>
    </div>
  );
}
