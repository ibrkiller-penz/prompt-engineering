// 준비 한 장(#/prep/:lid?p=1): 수업 전에 한 화면으로 훑어보는 교사 준비 자료.
//   목표 · 오늘의 핵심 질문 · 시간 배분 · 준비물 · 발문 3개 · 막히는 곳 · 오개념 · 체험 도구 3단계 · 정답 일괄 표
// 준비 자료(목표·발문·막히는 곳·오개념·준비물)는 data/teacher/prep/uN.json 에서, 시간 배분과 바구니는 수업 흐름 계산에서 가져와요.
import { useState } from "react";
import { DURATIONS, TEACHER_ROUTES, type Lesson, type Question, type WidgetId } from "../../shared/contracts.ts";
import { href, intParam } from "../../shared/router/index.ts";
import { lessonMeta, unitOf, useLesson } from "../../content/index.ts";
import { Rich, answerText, guideOf, TYPE_LABEL } from "../../shared/ui/index.ts";
import { WIDGET_TITLES, isWidgetId } from "../../shared/widgets/ids.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { NotFound } from "../shell/Fallbacks.tsx";
import { Skeleton } from "../flow/Skeleton.tsx";
import { setScenes } from "../today/cuts.ts";
import { useFlowState } from "../store/index.ts";
import { boardHref, planOf } from "../shell/plan.ts";
import { barSegments, minLabel } from "../today/timebar.ts";
import { periodQuestion, shortId } from "../logic/index.ts";
import { goalsForPeriod, usePrep, useLessonPrep, type Baskets, type GoalView } from "./data.ts";
import "./prep.css";

const BASKET_NAMES: Record<keyof Baskets, string> = { board: "칠판", exit: "끝 확인", hw: "숙제" };

function basketOf(b: Baskets, id: string): (keyof Baskets)[] {
  const out: (keyof Baskets)[] = [];
  (["board", "exit", "hw"] as (keyof Baskets)[]).forEach((k) => {
    if (b[k].indexOf(id) >= 0) out.push(k);
  });
  return out;
}

/** 이 차시 소제목에 나오는 체험 도구(중복 없이, 나온 순서) */
function widgetsIn(lesson: Lesson, sections: number[]): WidgetId[] {
  const out: WidgetId[] = [];
  sections.forEach((si) => {
    const s = lesson.sections[si];
    if (!s) return;
    for (const b of s.blocks) if (b.t === "widget" && isWidgetId(b.id) && out.indexOf(b.id) < 0) out.push(b.id);
  });
  return out;
}

function TimePlan({ scenes, minutes, total }: { scenes: Parameters<typeof barSegments>[0]; minutes: number; total: number }) {
  const segs = barSegments(scenes);
  const over = total > minutes + 0.25;
  return (
    <div className="t-timebar">
      <div className="t-tb-bar" role="img" aria-label={"시간 배분: " + segs.map((s) => s.label + " " + minLabel(s.min)).join(", ")}>
        {segs.map((s) => (
          <span key={s.key} className={"t-tb-seg is-" + s.key} style={{ width: s.pct + "%" }}>
            {s.pct >= 12 ? <span className="t-tb-txt">{s.label}</span> : null}
          </span>
        ))}
      </div>
      <ul className="t-tb-legend" aria-hidden="true">
        {segs.map((s) => (
          <li key={s.key}>
            <i className={"t-tb-sw is-" + s.key} />
            {s.label} <b className="num">{minLabel(s.min)}</b>
            <span className="muted">{" · 장면 " + s.count}</span>
          </li>
        ))}
      </ul>
      <p className={"small " + (over ? "t-over" : "muted")}>
        {over ? "시간이 " + minLabel(total - minutes) + " 넘쳐요(예상 " + minLabel(total) + " / 수업 " + minutes + "분). 오늘 수업이나 수업 흐름에서 줄일 수 있어요." : "예상 " + minLabel(total) + " / 수업 " + minutes + "분"}
      </p>
    </div>
  );
}

function AnswerTable({ lesson, baskets, only }: { lesson: Lesson; baskets: Baskets; only: boolean }) {
  const all = baskets.board.concat(baskets.exit, baskets.hw);
  const qs: Question[] = only ? lesson.practice.filter((q) => all.indexOf(q.id) >= 0) : lesson.practice;
  if (!qs.length) return <p className="muted">이 차시 바구니에 담긴 문제가 없어요.</p>;
  return (
    <div className="pp-ans-scroll">
      <table className="tbl pp-ans">
        <caption className="ui-sr">정답 일괄 표</caption>
        <thead>
          <tr>
            <th scope="col">번호</th>
            <th scope="col">바구니</th>
            <th scope="col">유형</th>
            <th scope="col">문제</th>
            <th scope="col">정답</th>
          </tr>
        </thead>
        <tbody>
          {qs.map((q) => {
            const bs = basketOf(baskets, q.id);
            return (
              <tr key={q.id} className={bs.length ? "is-picked" : undefined}>
                <th scope="row" className="num">
                  {shortId(lesson.id, q.id)}
                </th>
                <td className="pp-ans-b">
                  {bs.length ? (
                    bs.map((b) => (
                      <span key={b} className={"chip pp-b-" + b}>
                        {BASKET_NAMES[b]}
                      </span>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="pp-ans-t">
                  {TYPE_LABEL[q.type]}
                  <span className="pp-lv" aria-label={"난이도 " + q.level}>
                    {" "}
                    {"★".repeat(q.level)}
                  </span>
                </td>
                <td className="pp-ans-q">
                  <div className="pp-clamp">
                    <Rich text={q.prompt} />
                  </div>
                </td>
                <td className="pp-ans-a">{q.type === "open" ? <span className="muted">서술형 · 모범 답안은 인쇄 정답지에</span> : <Rich text={answerText(q)} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GoalList({ goals }: { goals: GoalView[] }) {
  if (!goals.length) return <p className="muted">이 레슨의 목표 자료가 아직 없어요.</p>;
  return (
    <ul className="pp-list pp-goals">
      {goals.map((g, i) => (
        <li key={i} className={g.now ? "is-now" : "is-other"}>
          {!g.now && g.periods.length ? <span className="chip pp-goal-p">{g.periods.join("·") + "차시"}</span> : null}
          <Rich text={g.text} />
        </li>
      ))}
    </ul>
  );
}

/** 1차시 이야기 장면: 기본은 요약 한 장만 켜져 있어요. 여기서 바로 켜고 끌 수 있어요 */
function StoryNote({ lid, view }: { lid: string; view: NonNullable<ReturnType<typeof useLessonPrep>["view"]> }) {
  const [, updateFlow] = useFlowState(lid, view.p);
  const story = view.scenes.filter((s) => s.kind === "story");
  if (!story.length) return null;
  const on = story.filter((s) => s.on);
  const off = story.filter((s) => !s.on);
  const rest = story.filter((s) => s.id.indexOf("story-brief") !== 0);
  return (
    <p className="small pp-story no-print">
      {off.length ? (
        <>
          <span>이야기 장면은 {on.length ? on.length + "장만" : "모두 꺼져"} {on.length ? "켜져 있어요" : "있어요"}</span>
          {" · "}
          <button type="button" className="btn btn-soft pp-story-btn" onClick={() => updateFlow((cur) => setScenes(cur, view, off, true))}>
            켜기
          </button>
        </>
      ) : (
        <>
          <span>이야기 장면이 모두 켜져 있어요</span>
          {rest.length ? (
            <>
              {" · "}
              <button type="button" className="btn btn-ghost pp-story-btn" onClick={() => updateFlow((cur) => setScenes(cur, view, rest, false))}>
                요약 한 장만 남기기
              </button>
            </>
          ) : null}
        </>
      )}
    </p>
  );
}

function List({ items, empty }: { items: string[] | undefined; empty: string }) {
  if (!items || !items.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="pp-list">
      {items.map((t, i) => (
        <li key={i}>
          <Rich text={t} />
        </li>
      ))}
    </ul>
  );
}

export default function PrepPage(m: TeacherPageProps) {
  const lid = m.params.lid;
  const meta = lessonMeta(lid);
  const unit = unitOf(lid);
  const { data: lesson, error } = useLesson(meta ? lid : null);
  const period = intParam(m.query.p, 1, 1, 9);
  const st = useLessonPrep(lesson, period);
  const prep = usePrep(meta ? meta.unit : undefined, lid);
  const [only, setOnly] = useState(true);

  if (!meta) return <NotFound />;
  if (error)
    return (
      <section className="page">
        <p role="alert">레슨을 불러오지 못했어요. 새로고침해 주세요.</p>
      </section>
    );
  if (!lesson || !st.view)
    return (
      <section className="page pp">
        <header className="pp-head">
          <p className="eyebrow">준비 한 장</p>
          <h1 className="h1">
            {meta.code} {meta.title}
          </h1>
        </header>
        <Skeleton label="준비 자료를 불러오는 중이에요…" rows={6} />
      </section>
    );

  const view = st.view;
  const p = view.p;
  const per = view.flow.period;
  const widgets = widgetsIn(lesson, per.sections);
  const firstOn = view.on.length ? view.on[0].s : 0;
  let qLines: string[] = [lesson.question];
  try {
    const ql = periodQuestion(lesson, planOf(lid), per);
    if (ql.length) qLines = ql;
  } catch (e) {
    /* 원래 질문 그대로 */
  }
  const goalTexts = prep && prep.goals && prep.goals.length ? prep.goals : prep && prep.goal ? [prep.goal] : [];
  const goals = goalsForPeriod(goalTexts, prep && prep.goals && prep.goals.length ? prep.goalSecs : undefined, view.periods, p);
  const asks = prep && prep.questions && prep.questions.length ? prep.questions : prep && prep.asks ? prep.asks.map((q) => ({ q, a: "" })) : [];

  return (
    <section className={"page pp t-u" + meta.unit} aria-labelledby="pp-h">
      <header className="pp-head">
        <p className="eyebrow">
          준비 한 장 · {unit ? unit.roman + ". " + unit.short : ""}
        </p>
        <h1 className="h1" id="pp-h">
          {meta.code} {meta.title}
        </h1>
        {meta.subtitle ? <p className="muted pp-sub">{meta.subtitle}</p> : null}
        <div className="pp-pickers no-print">
          {view.periods.length > 1 ? (
            <div className="pp-picker" role="group" aria-label="차시">
              <span className="pp-picker-k">차시</span>
              {view.periods.map((x) => (
                <a key={x.p} className="btn t-dur" aria-pressed={x.p === p} aria-current={x.p === p ? "page" : undefined} href={href(TEACHER_ROUTES.prep, { lid }, { p: x.p })}>
                  {x.p}차시
                </a>
              ))}
            </div>
          ) : null}
          <div className="pp-picker" role="group" aria-label="수업 시간">
            <span className="pp-picker-k">수업 시간</span>
            {DURATIONS.map((d) => (
              <button key={d} type="button" className="btn t-dur" aria-pressed={d === st.duration} onClick={() => st.setDuration(d)}>
                {d}분
              </button>
            ))}
          </div>
        </div>
        <div className="pp-links no-print">
          <a className="btn btn-primary" href={boardHref(lid, p, firstOn)}>
            ▶ 칠판 수업 시작
          </a>
          <a className="btn btn-soft" href={href(TEACHER_ROUTES.flow, { lid }, { p })}>
            수업 흐름
          </a>
          <a className="btn btn-soft" href={href(TEACHER_ROUTES.pick, { lid }, { p })}>
            문제 고르기
          </a>
          <a className="btn btn-soft" href={href(TEACHER_ROUTES.print, { lid }, { p, set: "board" })}>
            학습지 인쇄
          </a>
        </div>
      </header>

      <div className="pp-grid">
        <section className="card pp-card pp-goal" aria-labelledby="pp-goal-h">
          <h2 className="h3" id="pp-goal-h">
            학습 목표{view.periods.length > 1 ? " · " + p + "차시" : ""}
          </h2>
          {prep === undefined ? <p className="muted ui-loading">준비 자료를 불러오는 중이에요…</p> : <GoalList goals={goals} />}
          <div className="pp-q">
            <span className="pp-q-tag">{view.periods.length > 1 ? p + "차시 핵심 질문" : "오늘의 핵심 질문"}</span>
            {qLines.map((t, i) => (
              <p key={i}>
                <Rich text={t} />
              </p>
            ))}
          </div>
        </section>

        <section className="card pp-card pp-time" aria-labelledby="pp-time-h">
          <h2 className="h3" id="pp-time-h">
            시간 배분 {view.periods.length > 1 ? "· " + p + "/" + view.periods.length + "차시" : ""}
          </h2>
          <TimePlan scenes={view.scenes} minutes={st.duration} total={view.total} />
          {per.first ? <StoryNote lid={lid} view={view} /> : null}
          <p className="small muted">
            다루는 소제목:{" "}
            {per.sections.map((si, k) => (
              <span key={si}>
                {k ? " · " : ""}
                <Rich text={(lesson.sections[si] && lesson.sections[si].heading) || ""} />
              </span>
            ))}
          </p>
        </section>

        <section className="card pp-card" aria-labelledby="pp-mat-h">
          <h2 className="h3" id="pp-mat-h">
            준비물
          </h2>
          <List items={prep ? prep.materials : undefined} empty="따로 준비할 것은 없어요. 전자칠판만 켜 두면 돼요." />
        </section>

        <section className="card pp-card pp-asks" aria-labelledby="pp-ask-h">
          <h2 className="h3" id="pp-ask-h">
            발문 3개
          </h2>
          {asks.length ? (
            <ol className="pp-asklist">
              {asks.map((x, i) => (
                <li key={i}>
                  <p className="pp-ask-q">
                    <Rich text={x.q} />
                  </p>
                  {x.a ? (
                    <p className="small muted pp-ask-a">
                      <span className="pp-ask-tag">예상 반응</span> <Rich text={x.a} />
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">발문 자료가 아직 없어요.</p>
          )}
        </section>

        <section className="card pp-card" aria-labelledby="pp-stuck-h">
          <h2 className="h3" id="pp-stuck-h">
            학생이 막히는 곳
          </h2>
          <List items={prep ? prep.stuck : undefined} empty="자료가 아직 없어요." />
        </section>

        <section className="card pp-card" aria-labelledby="pp-mis-h">
          <h2 className="h3" id="pp-mis-h">
            자주 보이는 오개념
          </h2>
          <List items={prep ? prep.misconceptions : undefined} empty="자료가 아직 없어요." />
        </section>

        <section className="card pp-card pp-tools" aria-labelledby="pp-tool-h">
          <h2 className="h3" id="pp-tool-h">
            체험 도구 3단계
          </h2>
          {widgets.length ? (
            widgets.map((w) => {
              const g = guideOf(w);
              return (
                <div key={w} className="pp-tool">
                  <div className="row between">
                    <h3 className="pp-tool-name">{g && g.title ? g.title : WIDGET_TITLES[w]}</h3>
                    <a className="btn btn-ghost no-print" href={href(TEACHER_ROUTES.boardTool, { lid, wid: w })}>
                      칠판에 크게 열기
                    </a>
                  </div>
                  {g ? (
                    <>
                      <p className="small">
                        <span className="pp-step-tag">예상</span> <Rich text={g.predict} />
                      </p>
                      <ol className="pp-steps">
                        {g.steps.map((s, i) => (
                          <li key={i}>
                            <Rich text={s} />
                          </li>
                        ))}
                      </ol>
                      <p className="small">
                        <span className="pp-step-tag">물어보기</span> <Rich text={g.ask} />
                      </p>
                      <p className="small muted">
                        <span className="pp-step-tag">정리</span> <Rich text={g.reveal} />
                      </p>
                    </>
                  ) : (
                    <p className="muted">안내 자료가 아직 없어요.</p>
                  )}
                </div>
              );
            })
          ) : (
            <p className="muted">이 차시에는 체험 도구가 없어요.</p>
          )}
        </section>
      </div>

      <section className="card pp-card pp-answers" aria-labelledby="pp-ans-h">
        <div className="row between">
          <h2 className="h3" id="pp-ans-h">
            정답 일괄 보기
          </h2>
          <div className="row no-print" role="group" aria-label="보일 문제">
            <button type="button" className={"btn " + (only ? "btn-primary" : "btn-ghost")} aria-pressed={only} onClick={() => setOnly(true)}>
              이 차시 바구니만
            </button>
            <button type="button" className={"btn " + (!only ? "btn-primary" : "btn-ghost")} aria-pressed={!only} onClick={() => setOnly(false)}>
              레슨 전체({lesson.practice.length})
            </button>
          </div>
        </div>
        <p className="small muted">
          칠판 {st.baskets.board.length} · 끝 확인 {st.baskets.exit.length} · 숙제 {st.baskets.hw.length}
          {st.edited ? " (직접 고친 바구니)" : " (자동으로 고른 바구니)"}
        </p>
        <AnswerTable lesson={lesson} baskets={st.baskets} only={only} />
      </section>
    </section>
  );
}
