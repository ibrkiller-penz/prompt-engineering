import { Link, Navigate, useParams } from "react-router-dom";
import RichMath from "../RichMath";
import { lessonsOf, unitBySlug, unitContent } from "../load";
import { progressOf, useQResults } from "../store";

function Story({ title, paragraphs, kicker }: { title: string; paragraphs: string[]; kicker: string }) {
  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-6">
      <p className="text-sm font-extrabold tracking-wide text-accent">{kicker}</p>
      <h2 className="mt-1 text-2xl font-extrabold leading-snug">{title}</h2>
      {paragraphs.map((p, i) => (
        <p key={i} className="mt-3 leading-[1.9]"><RichMath text={p} /></p>
      ))}
    </section>
  );
}

export default function UnitPage() {
  const { unit: slug } = useParams();
  const unit = unitBySlug(slug);
  const results = useQResults();
  if (!unit) return <Navigate to="/aimath" replace />;
  const uc = unitContent(unit.id);
  const lessons = lessonsOf(unit);
  const testIds = uc?.test.map((q) => q.id) ?? [];
  const tp = progressOf(testIds, results);

  return (
    <>
      <header className="rounded-card p-6 sm:p-8" style={{ background: unit.soft }}>
        <p className="text-sm font-bold" style={{ color: unit.color }}>{unit.roman}단원</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl"><span aria-hidden>{unit.icon}</span> {unit.title}</h1>
        <p className="mt-2 max-w-2xl text-lg">{unit.short}</p>
      </header>

      {uc && <Story kicker="이야기로 열기" title={uc.opening.title} paragraphs={uc.opening.paragraphs} />}
      {uc?.stories && uc.stories.length > 0 && (
        <section className="mt-8" aria-label="단원 시작 전에 읽는 이야기">
          <h2 className="text-2xl font-extrabold">📚 시작하기 전에 읽는 이야기</h2>
          <p className="mt-1 text-muted">본격적으로 공부하기 전에, 이 단원이 어디서 왔고 어디에 쓰이는지 이야기로 먼저 만나 봐요. 건너뛰어도 되지만 읽고 가면 공부가 훨씬 쉬워져요.</p>
          <div className="mt-4 space-y-3">
            {uc.stories.map((s, i) => (
              <details key={i} open={i === 0} className="group rounded-card border border-line bg-surface p-4 sm:p-5">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-ink">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    {s.kicker && <span className="block text-xs font-bold text-accent">{s.kicker}</span>}
                    <span className="block text-lg font-extrabold leading-snug">{s.title}</span>
                  </span>
                  <span className="text-muted transition group-open:rotate-180" aria-hidden>▾</span>
                </summary>
                {s.paragraphs.map((p, k) => (
                  <p key={k} className="mt-3 leading-[1.9]"><RichMath text={p} /></p>
                ))}
              </details>
            ))}
          </div>
        </section>
      )}
      {uc && <Story kicker="왜 배울까?" title={uc.why.title} paragraphs={uc.why.paragraphs} />}

      <h2 className="mt-10 text-2xl font-extrabold">이 단원의 레슨</h2>
      <ol className="mt-4 space-y-3">
        {lessons.map(({ meta, data }, i) => {
          const p = progressOf(data?.practice.map((q) => q.id) ?? [], results);
          return (
            <li key={meta.id}>
              <Link to={`/aimath/${unit.slug}/${meta.id}`} className="flex gap-4 rounded-card border border-line bg-surface p-4 transition hover:border-accent hover:shadow-md">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-white" style={{ background: unit.color }}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-extrabold leading-snug">{meta.title}</span>
                  <span className="mt-0.5 block text-muted">{data?.subtitle ?? meta.short}</span>
                  <span className="mt-2 block text-xs text-muted">
                    {data ? `약 ${data.minutes}분 · 문제 ${data.practice.length}개 · 체험 도구 ${data.sections.flatMap((s) => s.blocks).filter((b) => b.t === "widget").length}개` : "준비 중"}
                    {p.total ? ` · 맞힌 문제 ${p.done}/${p.total}` : ""}
                  </span>
                  {p.total > 0 && (
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      <span className="block h-full rounded-full" style={{ width: `${p.pct}%`, background: unit.color }} />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {uc && uc.test.length > 0 && (
        <Link to={`/aimath/${unit.slug}/test`} className="mt-6 flex items-center gap-4 rounded-card border-2 p-4 hover:shadow-md" style={{ borderColor: unit.color }}>
          <span className="text-3xl" aria-hidden>🏁</span>
          <span className="flex-1">
            <span className="block text-lg font-extrabold">대단원 마무리 문제</span>
            <span className="block text-muted">레슨을 다 본 뒤 종합 문제 {uc.test.length}개로 확인해요.{tp.total ? ` (맞힌 문제 ${tp.done}/${tp.total})` : ""}</span>
          </span>
          <span className="font-bold" style={{ color: unit.color }}>풀러 가기 →</span>
        </Link>
      )}

      {uc && <Story kicker="수학! 미래를 꿈꾸다" title={uc.future.title} paragraphs={uc.future.paragraphs} />}

      <nav className="mt-10 flex justify-between gap-3 text-sm font-semibold" aria-label="단원 이동">
        <Link to="/aimath" className="min-h-[44px] rounded-card border border-line bg-surface px-4 py-2.5 hover:border-accent">← 전체 단원</Link>
      </nav>
    </>
  );
}
