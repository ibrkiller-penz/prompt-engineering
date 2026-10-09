import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Blocks } from "../Blocks";
import RichMath from "../RichMath";
import { StairRunner } from "../Quiz";
import { getLesson, unitBySlug } from "../load";
import { isBasic, lessonStatus, markSectionRead, saveLast, useQResults, useSectionsRead } from "../store";

// 폰(400px)에서도 한 줄에 다 들어가도록 짧은 이름. '문제'는 늘 오른쪽 끝에 따로 고정.
const NAV = [
  ["story", "이야기"],
  ["prereq", "복습"],
  ["concept", "개념"],
  ["terms", "용어"],
  ["ai", "읽기"],
  ["project", "활동"],
  ["summary", "요약"],
] as const;

/** 개념 소제목 하나: 접었다 펴고, 펼쳐 본 것은 ✓ 로 기록한다(레슨 완료 조건). */
function ConceptSection({ lessonId, idx, heading, read, children }: {
  lessonId: string; idx: number; heading: string; read: boolean; children: React.ReactNode;
}) {
  // 첫 소제목만 펼친 채 시작(이미 읽은 것도 펼쳐 둔다). 나머지는 학생이 직접 펼치며, 그 행동을 '읽음'으로 기록한다.
  return (
    <details
      open={idx === 0 || read ? true : undefined}
      onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open && !read) markSectionRead(lessonId, idx); }}
      className="group mt-4 rounded-card border border-line bg-surface"
    >
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${read ? "bg-ok text-white" : "bg-accent-soft text-accent"}`} aria-hidden>{read ? "✓" : idx + 1}</span>
        <span className="min-w-0 flex-1 text-lg font-extrabold leading-snug"><RichMath text={heading.replace(/^\d+\.\s*/, "")} /></span>
        <span className="text-muted transition group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="px-4 pb-5 sm:px-5">{children}</div>
    </details>
  );
}

function H({ id, icon, children }: { id: string; icon: string; children: string }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-14 text-2xl font-extrabold">
      <span aria-hidden>{icon}</span> {children}
    </h2>
  );
}

export default function LessonPage() {
  const { unit: slug, lesson: lid } = useParams();
  const unit = unitBySlug(slug);
  const lesson = lid ? getLesson(lid) : undefined;
  const results = useQResults();
  const readMap = useSectionsRead();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setMoreOpen(false);
    if (unit && lesson) {
      saveLast(`/aimath/${unit.slug}/${lesson.id}`, lesson.title);
      if (lesson.sections.length) markSectionRead(lesson.id, 0); // 첫 소제목은 펼쳐진 채 보이므로 읽은 것으로 친다
    }
  }, [unit, lesson]);

  if (!unit || !lesson || lesson.unit !== unit.id) return <Navigate to={unit ? `/aimath/${unit.slug}` : "/aimath"} replace />;

  const idx = unit.lessons.findIndex((l) => l.id === lesson.id);
  const prev = unit.lessons[idx - 1];
  const next = unit.lessons[idx + 1];
  const st = lessonStatus(lesson, results, readMap);
  const basicQs = lesson.practice.filter(isBasic);
  const extraQs = lesson.practice.filter((q) => !isBasic(q));
  const readSet = new Set(readMap[lesson.id] ?? []);
  const goPractice = () => document.getElementById("practice")?.scrollIntoView({ behavior: "smooth" });

  return (
    <article>
      <nav aria-label="현재 위치" className="text-sm text-muted">
        <Link to="/aimath" className="hover:underline">인공지능 수학</Link> › <Link to={`/aimath/${unit.slug}`} className="hover:underline">{unit.roman}. {unit.title}</Link>
      </nav>
      <header className="mt-2">
        <p className="text-sm font-bold text-accent">{unit.roman}-{lesson.order} · 약 {lesson.minutes}분</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight sm:text-4xl">{lesson.title}</h1>
        <p className="mt-1 text-lg text-muted">{lesson.subtitle}</p>
        {st.complete ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-ok-soft px-3 py-1 text-sm font-bold text-ok">✓ 레슨 완료 · 기본 문제 {st.basic.done}/{st.basic.total} 맞힘</p>
        ) : (
          <p className="mt-3 text-sm text-muted">
            완료하려면: 개념 {st.sectionsRead}/{st.sectionsTotal} 읽기 · 기본 문제 {st.basic.total}개 풀어 보고 {st.need}개 이상 맞히기
            {st.basic.tried > 0 && <> (지금 {st.basic.done}개 맞힘)</>}
          </p>
        )}
      </header>

      {/* 섹션 탭: 사이트 헤더가 스크롤에 숨으면 그 자리에 올라붙는다(Layout 의 --hdr 변수) */}
      <div className="sticky z-10 -mx-4 mt-4 flex items-stretch border-y border-line bg-surface/95 backdrop-blur" style={{ top: "var(--hdr, 93px)" }}>
        <ul className="flex min-w-0 flex-1 overflow-x-auto px-2 text-sm font-semibold">
          {NAV.filter(([id]) => id !== "prereq" || lesson.prereq).map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }} className="flex min-h-[44px] items-center whitespace-nowrap px-2.5 text-muted hover:text-accent">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <button type="button" onClick={goPractice} className="flex shrink-0 items-center gap-1 border-l border-line bg-accent-soft px-3 text-sm font-extrabold text-accent">
          🪜 문제{st.basic.tried > 0 && !st.complete ? ` ${st.basic.done}/${st.basic.total}` : ""}
        </button>
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
      <p className="mt-2 text-sm text-muted">소제목 {lesson.sections.length}개예요. 하나씩 펼쳐 읽어요. 읽은 것은 ✓ 로 표시되고, 다 읽으면 레슨 완료 조건 하나가 채워져요.</p>
      {lesson.sections.map((s, i) => (
        <ConceptSection key={`${lesson.id}-${i}`} lessonId={lesson.id} idx={i} heading={s.heading} read={readSet.has(i)}>
          <Blocks blocks={s.blocks} />
        </ConceptSection>
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
        쉬운 문제부터 한 계단씩 올라가요. 힌트는 2번까지, 막히면 풀이를 보고 다음 계단으로 가도 돼요. 기본 {basicQs.length}문제를 풀면 이 레슨이 끝나요{st.basic.tried ? ` · 맞힌 문제 ${st.basic.done}/${st.basic.total}` : ""}.
      </p>
      <div className="mt-4">
        <StairRunner
          questions={basicQs}
          results={results}
          finish={
            <div className={`rounded-card border-2 p-4 text-center ${st.complete ? "border-ok bg-ok-soft" : "border-accent bg-accent-soft"}`}>
              {st.complete ? (
                <>
                  <p className="text-lg font-extrabold text-ok">🎉 레슨 완료!</p>
                  <p className="mt-1">기본 문제 <b>{st.basic.done}</b> / {st.basic.total} 맞혔어요.</p>
                  {next ? (
                    <Link to={`/aimath/${unit.slug}/${next.id}`} className="mt-3 inline-flex min-h-[44px] items-center rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">다음 레슨: {next.title} →</Link>
                  ) : (
                    <Link to={`/aimath/${unit.slug}/test`} className="mt-3 inline-flex min-h-[44px] items-center rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">대단원 마무리 문제 →</Link>
                  )}
                </>
              ) : (
                <>
                  <p className="text-lg font-extrabold">기본 문제를 다 풀었어요!</p>
                  <p className="mt-1">맞힌 문제 <b className="text-accent">{st.basic.done}</b> / {st.basic.total}{!st.passed && <> · 완료하려면 {st.need}개 이상 맞혀야 해요. 위쪽의 ✗ 줄을 눌러 다시 풀어 봐요.</>}{st.passed && !st.allRead && <> · 개념 정리 소제목을 모두 펼쳐 읽으면 완료예요 ({st.sectionsRead}/{st.sectionsTotal}).</>}</p>
                  {st.passed && !st.allRead && (
                    <button type="button" onClick={() => document.getElementById("concept")?.scrollIntoView({ behavior: "smooth" })} className="mt-3 min-h-[44px] rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">개념 정리로 올라가기 ↑</button>
                  )}
                </>
              )}
            </div>
          }
        />
      </div>
      {extraQs.length > 0 && (
        <details className="mt-6 rounded-card border border-line bg-surface" open={moreOpen} onToggle={(e) => setMoreOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center gap-3 px-4 [&::-webkit-details-marker]:hidden">
            <span className="text-xl" aria-hidden>🔥</span>
            <span className="flex-1"><span className="block font-extrabold">더 풀기 · 실력 UP과 도전 {extraQs.length}문제</span><span className="block text-sm text-muted">레슨 완료와는 상관없어요. 더 해 보고 싶을 때 펼쳐요.</span></span>
            <span className="text-muted">▾</span>
          </summary>
          <div className="px-4 pb-4">{moreOpen && <StairRunner questions={extraQs} results={results} />}</div>
        </details>
      )}

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
