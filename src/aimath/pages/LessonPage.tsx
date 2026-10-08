import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Blocks } from "../Blocks";
import RichMath from "../RichMath";
import { StairRunner } from "../Quiz";
import { getLesson, unitBySlug } from "../load";
import { progressOf, saveLast, useQResults } from "../store";

const NAV = [
  ["story", "이야기"],
  ["prereq", "먼저 알고 가요"],
  ["concept", "개념"],
  ["terms", "용어"],
  ["ai", "AI 이야기"],
  ["practice", "문제"],
  ["project", "프로젝트"],
  ["summary", "요약"],
] as const;

function H({ id, icon, children }: { id: string; icon: string; children: string }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-32 text-2xl font-extrabold">
      <span aria-hidden>{icon}</span> {children}
    </h2>
  );
}

export default function LessonPage() {
  const { unit: slug, lesson: lid } = useParams();
  const unit = unitBySlug(slug);
  const lesson = lid ? getLesson(lid) : undefined;
  const results = useQResults();

  useEffect(() => {
    window.scrollTo(0, 0);
    if (unit && lesson) saveLast(`/aimath/${unit.slug}/${lesson.id}`, lesson.title);
  }, [unit, lesson]);

  if (!unit || !lesson || lesson.unit !== unit.id) return <Navigate to={unit ? `/aimath/${unit.slug}` : "/aimath"} replace />;

  const idx = unit.lessons.findIndex((l) => l.id === lesson.id);
  const prev = unit.lessons[idx - 1];
  const next = unit.lessons[idx + 1];
  const p = progressOf(lesson.practice.map((q) => q.id), results);

  return (
    <article>
      <nav aria-label="현재 위치" className="text-sm text-muted">
        <Link to="/aimath" className="hover:underline">인공지능 수학</Link> › <Link to={`/aimath/${unit.slug}`} className="hover:underline">{unit.roman}. {unit.title}</Link>
      </nav>
      <header className="mt-2">
        <p className="text-sm font-bold text-accent">{unit.roman}-{lesson.order} · 약 {lesson.minutes}분</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">{lesson.title}</h1>
        <p className="mt-1 text-lg text-muted">{lesson.subtitle}</p>
      </header>

      <div className="sticky top-[93px] z-10 -mx-4 mt-4 overflow-x-auto border-y border-line bg-surface/95 px-4 backdrop-blur">
        <ul className="flex gap-1 text-sm font-semibold">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }} className="flex min-h-[44px] items-center whitespace-nowrap px-3 text-muted hover:text-accent">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <H id="story" icon="📖">오늘의 이야기</H>
      <div className="mt-3 rounded-card border border-line bg-surface p-5 sm:p-6">
        {lesson.story.map((t, i) => (
          <p key={i} className={`${i ? "mt-3" : ""} leading-[1.9]`}><RichMath text={t} /></p>
        ))}
      </div>
      <aside className="mt-4 rounded-card bg-accent-soft p-4" role="note">
        <p className="text-sm font-extrabold text-accent">오늘의 핵심 질문</p>
        <p className="mt-1 text-lg font-bold leading-relaxed"><RichMath text={lesson.question} /></p>
      </aside>

      {lesson.prereq && (
        <>
          <H id="prereq" icon="🧰">{lesson.prereq.title}</H>
          {lesson.prereq.intro && <p className="mt-2 text-muted"><RichMath text={lesson.prereq.intro} /></p>}
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {lesson.prereq.items.map((it) => (
              <li key={it.term} className="rounded-card border border-line bg-surface p-3.5">
                <p className="font-extrabold text-accent">{it.term}</p>
                <p className="mt-1 text-[0.95rem] leading-relaxed"><RichMath text={it.text} /></p>
              </li>
            ))}
          </ul>
        </>
      )}

      <H id="concept" icon="🧩">개념 정리</H>
      {lesson.sections.map((s, i) => (
        <section key={i} className="mt-6">
          <h3 className="border-l-4 border-accent pl-3 text-xl font-extrabold leading-snug"><RichMath text={s.heading} /></h3>
          <Blocks blocks={s.blocks} />
        </section>
      ))}

      <H id="terms" icon="🗂️">용어 카드</H>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {lesson.terms.map((t) => (
          <li key={t.term} className="rounded-card border border-line bg-surface p-3.5">
            <p className="font-extrabold text-accent">{t.term}</p>
            <p className="mt-1 text-[0.95rem] leading-relaxed"><RichMath text={t.def} /></p>
          </li>
        ))}
      </ul>

      <H id="ai" icon="🤖">AI 이야기</H>
      <section className="mt-3 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-xl font-extrabold">{lesson.aiStory.title}</h3>
        {lesson.aiStory.paragraphs.map((t, i) => (
          <p key={i} className="mt-3 leading-[1.9]"><RichMath text={t} /></p>
        ))}
      </section>

      <H id="practice" icon="🪜">계단 문제</H>
      <p className="mt-2 text-muted">
        쉬운 문제부터 한 계단씩 올라가요. 힌트는 2번까지, 막히면 풀이를 보고 다음 계단으로 가도 돼요. 총 {lesson.practice.length}문제{p.total ? ` · 맞힌 문제 ${p.done}/${p.total}` : ""}
      </p>
      <div className="mt-4">
        <StairRunner questions={lesson.practice} results={results} />
      </div>

      <H id="project" icon="🛠️">AI 프로젝트</H>
      <section className="mt-3 rounded-card border border-line bg-surface p-5 sm:p-6">
        <h3 className="text-xl font-extrabold">{lesson.project.title}</h3>
        <p className="mt-2 leading-relaxed"><b>목표 · </b><RichMath text={lesson.project.goal} /></p>
        {lesson.project.materials && lesson.project.materials.length > 0 && (
          <p className="mt-2 text-muted"><b>준비물 · </b>{lesson.project.materials.join(", ")}</p>
        )}
        <ol className="mt-4 space-y-2">
          {lesson.project.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
              <span className="leading-relaxed"><RichMath text={s} /></span>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-card bg-bg p-3.5">
          <p className="text-sm font-extrabold text-accent">생각해 보기</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-accent">
            {lesson.project.think.map((t, i) => <li key={i}><RichMath text={t} /></li>)}
          </ul>
        </div>
      </section>

      <H id="summary" icon="📝">오늘의 요약</H>
      <ul className="mt-3 space-y-2 rounded-card bg-accent-soft p-4">
        {lesson.summary.map((t, i) => (
          <li key={i} className="flex gap-2.5 leading-relaxed"><span className="font-extrabold text-accent" aria-hidden>✓</span><span><RichMath text={t} /></span></li>
        ))}
      </ul>

      <nav className="mt-10 grid gap-3 sm:grid-cols-2" aria-label="레슨 이동">
        {prev ? (
          <Link to={`/aimath/${unit.slug}/${prev.id}`} className="rounded-card border border-line bg-surface p-4 hover:border-accent">
            <span className="text-sm text-muted">← 이전 레슨</span><span className="mt-0.5 block font-bold">{prev.title}</span>
          </Link>
        ) : <span />}
        {next ? (
          <Link to={`/aimath/${unit.slug}/${next.id}`} className="rounded-card border border-accent bg-accent-soft p-4 text-right hover:brightness-95">
            <span className="text-sm text-muted">다음 레슨 →</span><span className="mt-0.5 block font-bold">{next.title}</span>
          </Link>
        ) : (
          <Link to={`/aimath/${unit.slug}/test`} className="rounded-card border border-accent bg-accent-soft p-4 text-right hover:brightness-95">
            <span className="text-sm text-muted">단원 끝 →</span><span className="mt-0.5 block font-bold">대단원 마무리 문제 풀기</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
