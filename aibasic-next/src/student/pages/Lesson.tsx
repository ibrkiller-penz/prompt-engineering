// 레슨 개요(#/l/:lid): 오늘의 핵심 질문 · 목표(소제목) · 4단계(이야기 · 개념 · 문제 · 정리) · 완료 조건.
// 교사 QR 이 들어오는 유일한 곳: #/l/:lid?hw=q06,q11&ex=q03,q05 (문제 id 만)
//   ex 가 있으면 '수업 끝 확인'부터(계단 문제 화면 ?set=ex 로 바로 가요), hw 가 있으면 '선생님이 고른 복습' 띠를 보여요.
import { useEffect, useMemo } from "react";
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { formatHash, href, navigate } from "../../shared/router/index.ts";
import { INDEX, lessonMeta, useLesson } from "../../content/index.ts";
import { Icon } from "../../shared/icons/index.ts";
import { ProgressBar, Rich } from "../../shared/ui/index.ts";
import { Loading, NotFoundBody, PageHead, Screen, useDocTitle } from "../shell/Shell.tsx";
import { MASTERY_LABEL, acceptAssignment, corePath, getPos, isTried, masteryOf, sectionChecks, statusOf, useAssigned, useQ, useRead, useSeen } from "../store/index.ts";
import { buildDeck, firstStepId } from "./deck.logic.ts";

export default function LessonPage({ lid, query }: { lid: string; query: Record<string, string> }) {
  const meta = lessonMeta(lid);
  const { data, error } = useLesson(meta ? lid : null);
  const q = useQ();
  const read = useRead();
  const seen = useSeen();
  const assigned = useAssigned();
  useDocTitle(meta ? meta.code + " " + meta.title : "레슨");

  // QR 로 들어왔을 때: 받은 문제 id 를 저장하고, 끝 확인이 있으면 거기부터
  const qs = query.hw || query.ex ? "hw=" + (query.hw || "") + "&ex=" + (query.ex || "") : "";
  useEffect(() => {
    if (!meta || !qs) return;
    const a = acceptAssignment(lid, qs);
    if (a && a.ex.length) navigate("/l/" + lid + "/q", { set: "ex" }, { replace: true });
    else navigate("/l/" + lid, undefined, { replace: true }); // 주소에서 쿼리를 걷어요(새로고침해도 다시 받지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid, qs]);

  const steps = useMemo(() => (data ? buildDeck(data, sectionChecks(lid) as string[][]) : null), [data, lid]);

  if (!meta) {
    return (
      <Screen title="레슨" noTabs>
        <NotFoundBody />
      </Screen>
    );
  }
  const st = statusOf(lid, q, read);
  const ms = masteryOf(lid, q, read);
  const pos = getPos(lid);
  const startStep = steps ? firstStepId(steps) : "c1";
  const resume = pos ? href(STUDENT_ROUTES.card, { lid, step: pos.step, card: pos.card }) : href(STUDENT_ROUTES.card, { lid, step: startStep, card: 1 });
  const hasStory = !!(steps && steps.some((s) => s.id === "story"));
  const hasPrereq = !!(steps && steps.some((s) => s.id === "prereq"));
  const firstConcept = hasPrereq ? "prereq" : "c1";
  const seenL = seen[lid] || [];
  const readL = read[lid] || [];
  const core = corePath(lid);
  const coreTried = core.filter((id) => isTried(q[id])).length;
  const a = assigned[lid];
  const hwLeft = a ? a.hw.filter((id) => !isTried(q[id])).length : 0;
  const unitHref = href(STUDENT_ROUTES.unit, { n: meta.unit });
  const posLabel = pos && steps ? posText(steps, pos.step, pos.card) : "";

  const stages = [
    { key: "story", name: "이야기", icon: "story" as const, to: href(STUDENT_ROUTES.card, { lid, step: hasStory ? "story" : firstConcept, card: 1 }), note: !steps ? "불러오는 중이에요…" : hasStory ? "등장인물과 함께 오늘 물음을 만나요" : "이야기가 없는 레슨이에요", done: hasStory ? !!(pos && pos.step !== "story") || readL.length > 0 : true },
    { key: "concept", name: "개념", icon: "book" as const, to: href(STUDENT_ROUTES.card, { lid, step: firstConcept, card: 1 }), note: "읽음 " + readL.length + "/" + meta.sections.length + " (지나감 " + seenL.length + ")", done: !!(st && st.allRead) },
    { key: "quiz", name: "문제", icon: "question" as const, to: href(STUDENT_ROUTES.quiz, { lid }), note: "계단 문제 " + coreTried + "/" + core.length + " · 기본 문제 " + (st ? st.basic.tried : 0) + "/" + meta.basicIds.length, done: !!(st && st.allTried && st.passed) },
    { key: "wrap", name: "정리", icon: "flag" as const, to: href(STUDENT_ROUTES.card, { lid, step: "wrap", card: 1 }), note: "정리 · 돌아보기 · 다음으로", done: !!(st && st.complete) },
  ];

  return (
    <Screen
      title="레슨"
      code={meta.code}
      backTo={unitHref.slice(1)}
      unitHref={unitHref}
      action={
        <a className="btn btn-primary btn-block" href={resume}>
          <span>{pos ? "이어서 공부하기" : "카드로 공부 시작"}</span>
          <Icon name="next" />
        </a>
      }
    >
      <div className="page stack-lg">
        {a && (a.hw.length || a.ex.length) ? (
          <div className="callout info s-assign" role="status">
            <b>선생님이 고른 복습</b>
            <p>
              {a.hw.length ? "숙제 " + a.hw.length + "문제" + (hwLeft ? " 중 " + hwLeft + "문제가 남았어요." : "를 모두 풀어 봤어요.") : ""}
              {a.ex.length ? " 수업 끝 확인 " + a.ex.length + "문제도 있어요." : ""}
            </p>
            <div className="row wrap">
              {a.hw.length ? (
                <a className="btn btn-soft" href={href(STUDENT_ROUTES.quiz, { lid }, { set: "hw" })}>
                  숙제 풀기
                </a>
              ) : null}
              {a.ex.length ? (
                <a className="btn btn-ghost" href={href(STUDENT_ROUTES.quiz, { lid }, { set: "ex" })}>
                  끝 확인 다시 보기
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        <PageHead eyebrow={"레슨 " + meta.code} title={meta.title} sub={meta.subtitle} />
        <div className="row s-lesson-meta">
          <span className={"chip" + (ms >= 2 ? " is-ok" : ms === 1 ? " is-warn" : "")}>
            {ms >= 2 ? "✓ " : ""}
            {MASTERY_LABEL[ms]}
          </span>
          <span className="chip">약 {meta.minutes}분</span>
        </div>
        {posLabel ? <p className="s-lesson-last">마지막으로 본 곳: {posLabel}</p> : null}

        <section className="why-card s-core" aria-labelledby="h-q">
          <h2 id="h-q" className="why-label">
            오늘의 핵심 질문
          </h2>
          <p className="s-core-q">
            <Rich text={meta.question} />
          </p>
        </section>

        {data && data.goals && data.goals.length ? (
          <section className="s-sec" aria-labelledby="h-aim">
            <h2 id="h-aim" className="s-sec-title">
              학습 목표
            </h2>
            <ul className="ui-list s-aims">
              {data.goals.map((g, i) => (
                <li key={i}>
                  <Rich text={g} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="s-sec" aria-labelledby="h-goal">
          <h2 id="h-goal" className="s-sec-title">
            오늘 배울 것
          </h2>
          <ol className="s-goals">
            {meta.sections.map((s, i) => (
              <li key={i} className={readL.indexOf(i) >= 0 ? "is-done" : undefined}>
                <span className="num-chip s-goal-n" aria-hidden="true">
                  {i + 1}
                </span>
                <a href={href(STUDENT_ROUTES.card, { lid, step: "c" + (i + 1), card: 1 })}>
                  <Rich text={stripNum(s.heading)} />
                </a>
                {readL.indexOf(i) >= 0 ? <span className="verdict ok small"> 읽음</span> : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="s-sec" aria-labelledby="h-stage">
          <h2 id="h-stage" className="s-sec-title">
            4단계로 공부해요
          </h2>
          <ol className="s-stages">
            {stages.map((s, i) => (
              <li key={s.key}>
                <a className="card card-link row nowrap s-stage" href={s.to}>
                  <span className="num-chip s-stage-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="grow">
                    <strong className="s-stage-name">{s.name}</strong>
                    <span className="s-stage-note">{s.note}</span>
                  </span>
                  {s.done ? <span className="verdict ok small">끝</span> : <Icon name="next" />}
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="card" aria-labelledby="h-done">
          <h2 id="h-done" className="s-sec-title">
            완료 조건
          </h2>
          {st ? (
            <ul className="s-checks">
              <li className={st.allRead ? "is-ok" : undefined}>
                <span className={"verdict " + (st.allRead ? "ok" : "bad")}>{st.allRead ? "됐어요" : "아직"}</span> 개념 소제목을 모두 읽기 ({st.sectionsRead}/{st.sectionsTotal})
                <span className="tiny muted s-block">소제목 마지막 카드까지 넘기고, 끝 확인 문제를 풀어 보면 '읽음'이에요.</span>
              </li>
              <li className={st.allTried ? "is-ok" : undefined}>
                <span className={"verdict " + (st.allTried ? "ok" : "bad")}>{st.allTried ? "됐어요" : "아직"}</span> 기본 문제를 모두 풀어 보기 ({st.basic.tried}/{st.basic.total})
              </li>
              <li className={st.passed ? "is-ok" : undefined}>
                <span className={"verdict " + (st.passed ? "ok" : "bad")}>{st.passed ? "됐어요" : "아직"}</span> 기본 문제 60% 이상 맞히기 ({st.basic.done}/{st.need}문제 이상)
                <span className="tiny muted s-block">풀이를 본 뒤 맞힌 문제는 '풀어 봄'으로만 세요.</span>
              </li>
            </ul>
          ) : null}
          {st ? <ProgressBar value={st.complete ? 100 : Math.round(((st.sectionsRead / Math.max(1, st.sectionsTotal)) * 50 + (st.basic.tried / Math.max(1, st.basic.total)) * 50))} max={100} label="레슨 완료까지" /> : null}
        </section>

        {!data ? <Loading error={error} /> : null}

        <nav className="row between s-prevnext" aria-label="앞뒤 레슨">
          {meta.prev ? (
            <a className="btn btn-ghost" href={href(STUDENT_ROUTES.lesson, { lid: meta.prev })}>
              <Icon name="prev" />
              <span>{INDEX.lessons[meta.prev].code}</span>
            </a>
          ) : (
            <span />
          )}
          {meta.next ? (
            <a className="btn btn-ghost" href={href(STUDENT_ROUTES.lesson, { lid: meta.next })}>
              <span>{INDEX.lessons[meta.next].code}</span>
              <Icon name="next" />
            </a>
          ) : null}
        </nav>
        <p className="small center s-foot">
          <a href={formatHash("/l/" + lid + "/q/more")}>더 풀기(실력·도전 문제)</a>
        </p>
      </div>
    </Screen>
  );
}

/** "1. 인공지능이란…" → "인공지능이란…" */
export function stripNum(h: string): string {
  return String(h || "").replace(/^\s*\d+\.\s*/, "");
}

/** "개념 1 · 1/9쪽" (단계 이름 · 지금 쪽/그 단계 쪽 수) */
function posText(steps: { id: string; label: string; cards: unknown[] }[], id: string, card: number): string {
  for (const s of steps) if (s.id === id) return s.label + " · " + Math.min(Math.max(1, card), s.cards.length) + "/" + s.cards.length + "쪽";
  return "";
}
