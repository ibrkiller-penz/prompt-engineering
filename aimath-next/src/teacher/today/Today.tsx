// 교사 첫 화면 '오늘 수업'(#/). 이어서 하기 · 수업 시간(45/50/70) · 시간 배분 막대 · '▶ 수업 시작' · 반별 진도 요약 · 처음 쓰는 경우 안내.
// 다른 차시는 #/?lid=u1-3&p=2 로 올려요(차시 찾기의 '오늘 수업으로').
import { useEffect } from "react";
import { DURATIONS, type LessonIndex, type TeacherData } from "../../shared/contracts.ts";
import { intParam, navigate } from "../../shared/router/index.ts";
import { teacherStore, useStored } from "../../shared/storage/index.ts";
import { INDEX, lessonMeta, unitOf, useLesson } from "../../content/index.ts";
import { Rich } from "../../shared/widgets/kit.tsx";
import { TIcon } from "../../shared/icons/teacher.tsx";
import { STUDENT_URL } from "../../site.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { useKlass, type ProgressMap } from "../shell/klass.tsx";
import { boardHref, cleanDuration, useLessonPlan, type Duration } from "../shell/plan.ts";
import { Loading } from "../shell/Fallbacks.tsx";
import { agoLabel, barSegments, minLabel } from "./timebar.ts";

// 이 탭에서 마지막으로 오늘 수업에 올린 차시(주소에 없을 때 다시 씀)
let memPick: { lid: string; p: number; klass: string | null } | null = null;

/** 반의 다음 레슨: 화면 순서대로 '끝'이 아닌 첫 레슨 */
export function nextLessonFor(progress: ProgressMap, klass: string | null): string | null {
  if (!klass) return null;
  const row = progress[klass] || {};
  for (const id of INDEX.order) if (row[id] !== "done") return id;
  return null;
}

function countMarks(row: Record<string, string> | undefined) {
  let done = 0;
  let part = 0;
  if (row) {
    for (const id of INDEX.order) {
      if (row[id] === "done") done++;
      else if (row[id] === "part") part++;
    }
  }
  return { done, part };
}

function UnitClass({ lid }: { lid: string }) {
  const u = unitOf(lid);
  return u ? <span className={"t-u" + u.id + " unit-dot"} aria-hidden="true" /> : null;
}

/* ─────────── 이어서 하기 ─────────── */

function ResumeCard({ last }: { last: NonNullable<TeacherData["last"]> }) {
  const l = lessonMeta(last.lid);
  if (!l) return null;
  return (
    <section className={"card t-resume t-u" + l.unit} aria-labelledby="t-resume-h">
      <div className="row between">
        <div className="grow stack tight">
          <p className="eyebrow" id="t-resume-h">
            이어서 하기 · {agoLabel(last.ts)}
          </p>
          <p className="h3">
            <UnitClass lid={l.id} /> {l.code} {l.title}
          </p>
          <p className="muted small">
            {last.p > 0 ? last.p + "차시 · " : ""}장면 {last.s + 1}번째 위치에서 멈췄어요.
          </p>
        </div>
        <a className="btn btn-lg t-resume-go" href={boardHref(last.lid, last.p || 1, last.s)}>
          <TIcon name="play" size="em" />
          <span>이어서 하기</span>
        </a>
      </div>
    </section>
  );
}

/* ─────────── 처음 쓰는 경우 ─────────── */

function Welcome() {
  return (
    <section className="card t-welcome" aria-labelledby="t-welcome-h">
      <h2 className="h2" id="t-welcome-h">
        반가워요! 세 단계면 수업을 시작할 수 있어요.
      </h2>
      <ol className="t-steps">
        <li>
          <b>반을 추가해요</b>
          <span className="muted"> 위의 '+ 반 추가'에 '2-3'처럼 적어요. 반별 진도를 따로 볼 수 있어요(건너뛰어도 돼요).</span>
        </li>
        <li>
          <b>차시를 골라요</b>
          <span className="muted"> 아래에 첫 차시가 올라와 있어요. 다른 차시는 '차시 찾기'에서 골라요.</span>
        </li>
        <li>
          <b>'수업 시작'을 눌러요</b>
          <span className="muted"> 전자칠판 화면이 열리고, '다음'만 누르면 수업이 흘러가요.</span>
        </li>
      </ol>
      <p className="tiny muted">이 사이트는 학생 기록을 모으지 않아요. 설정은 이 기기 안에만 남아요.</p>
    </section>
  );
}

/* ─────────── 시간 배분 막대 ─────────── */

function TimeBar({ scenes, minutes, total }: { scenes: Parameters<typeof barSegments>[0]; minutes: number; total: number }) {
  const segs = barSegments(scenes);
  const over = total > minutes + 0.25;
  return (
    <div className="t-timebar">
      <div className="t-tb-bar" role="img" aria-label={"시간 배분: " + segs.map((s) => s.label + " " + minLabel(s.min)).join(", ")}>
        {segs.map((s) => (
          <span key={s.key} className={"t-tb-seg is-" + s.key} style={{ width: s.pct + "%" }}>
            {s.pct >= 9 ? (
              <span className="t-tb-txt">
                {s.label} {minLabel(s.min)}
              </span>
            ) : null}
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
        {over ? "예상 " + minLabel(total) + "로 " + minutes + "분을 넘어요. 수업 흐름에서 장면을 꺼 보세요." : "예상 " + minLabel(total) + " / 수업 " + minutes + "분"}
      </p>
    </div>
  );
}

/* ─────────── 반별 진도 요약 ─────────── */

function ClassSummary({ onPick }: { onPick: (lid: string) => void }) {
  const { classes, progress, klass, setKlass } = useKlass();
  const total = INDEX.order.length;
  if (!classes.length) {
    return (
      <section className="card stack" aria-labelledby="t-cls-h">
        <h2 className="h3" id="t-cls-h">
          반별 진도
        </h2>
        <p className="muted">반을 추가하면 반마다 어디까지 했는지 한눈에 볼 수 있어요. 위의 '+ 반 추가'를 눌러요.</p>
      </section>
    );
  }
  return (
    <section className="card stack" aria-labelledby="t-cls-h">
      <div className="row between">
        <h2 className="h3" id="t-cls-h">
          반별 진도
        </h2>
        <a className="btn btn-ghost" href="#/progress">
          자세히
        </a>
      </div>
      <ul className="list">
        {classes.map((c) => {
          const { done, part } = countMarks(progress[c]);
          const next = nextLessonFor(progress, c);
          const nl: LessonIndex | undefined = next ? lessonMeta(next) : undefined;
          const pct = Math.round((done / total) * 100);
          return (
            <li key={c} className={"t-cls-row" + (c === klass ? " is-now" : "")}>
              <button type="button" className="t-cls-name chip" aria-pressed={c === klass} onClick={() => setKlass(c)}>
                {c}
              </button>
              <div className="grow stack tight">
                <div className="meter" role="img" aria-label={c + " 진도 " + done + "/" + total + " 레슨 끝"}>
                  <i style={{ width: pct + "%" }} />
                </div>
                <p className="small muted">
                  끝 {done} · 일부 {part} / {total}레슨
                  {nl ? " · 다음 " + nl.code + " " + nl.title : " · 모두 끝냈어요"}
                </p>
              </div>
              {nl ? (
                <button
                  type="button"
                  className="btn btn-soft"
                  onClick={() => {
                    setKlass(c);
                    onPick(nl.id);
                  }}
                >
                  다음 차시 올리기
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─────────── 오늘 수업 ─────────── */

export default function Today({ query }: TeacherPageProps) {
  const [durRaw, setDur] = useStored(teacherStore, "duration", 45 as Duration);
  const dur = cleanDuration(durRaw);
  const [last] = useStored(teacherStore, "last", null as TeacherData["last"]);
  const [flowSt] = useStored(teacherStore, "flow", {} as TeacherData["flow"]);
  const [pickSt] = useStored(teacherStore, "pick", {} as TeacherData["pick"]);
  const { klass, classes, progress } = useKlass();

  const qLid = query.lid && lessonMeta(query.lid) ? query.lid : null;
  const lastOk = last && last.lid && lessonMeta(last.lid) ? last : null;
  const memOk = memPick && memPick.klass === klass && lessonMeta(memPick.lid) ? memPick : null;
  const lid = qLid || (memOk && memOk.lid) || nextLessonFor(progress, klass) || (lastOk && lastOk.lid) || INDEX.order[0];
  const meta = lessonMeta(lid) as LessonIndex;

  let p = 1;
  if (qLid) p = intParam(query.p, 1, 1, 9);
  else if (memOk && memOk.lid === lid) p = memOk.p;
  else if (lastOk && lastOk.lid === lid && lastOk.p > 0) p = lastOk.p;

  useEffect(() => {
    if (qLid) memPick = { lid: qLid, p, klass };
  }, [qLid, p, klass]);

  const { data: lesson, error, loading } = useLesson(lid);
  const view = useLessonPlan(lesson, dur, p, flowSt, pickSt);
  const pickLesson = (id: string, per?: number) => navigate("/", { lid: id, p: per || undefined });

  // 시작 장면: 같은 레슨·차시를 하다 멈췄으면 그 장면부터, 아니면 처음
  let start = view && view.on.length ? view.on[0] : null;
  let resuming = false;
  if (view && lastOk && lastOk.lid === lid && (lastOk.p || 1) === view.p && lastOk.s > 0) {
    for (const o of view.on)
      if (o.s >= lastOk.s) {
        start = o;
        resuming = o.n > 1;
        break;
      }
  }
  const firstUse = !lastOk && !classes.length;
  const unitN = meta.unit;
  const unit = unitOf(lid);

  return (
    <div className={"page stack-lg t-today t-u" + unitN}>
      <header className="row between t-today-head">
        <div className="stack tight">
          <p className="eyebrow">교사용 · 오늘 수업{klass ? " · " + klass + "반" : ""}</p>
          <h1 className="h1">오늘 수업</h1>
        </div>
        <a className="btn" href="#/find">
          <TIcon name="search" size="em" />
          <span>다른 차시 고르기</span>
        </a>
      </header>

      {firstUse ? <Welcome /> : null}
      {lastOk && !(lastOk.lid === lid && view && lastOk.p === view.p) ? <ResumeCard last={lastOk} /> : null}

      <section className="card card-hero t-lesson stack" aria-labelledby="t-lesson-h">
        <div className="stack tight">
          <p className="eyebrow">
            {meta.code}
            {unit ? " · " + unit.title : ""} · 원래 분량 약 {meta.minutes}분
          </p>
          <h2 className="h1" id="t-lesson-h">
            {meta.title}
          </h2>
          <p className="t-question">
            <span className="t-q-tag">핵심 질문</span> <Rich text={meta.question} />
          </p>
        </div>

        <div className="t-pickers">
          <div className="t-picker">
            <p className="t-set-label" id="t-dur-label">
              수업 시간
            </p>
            <div className="row" role="radiogroup" aria-labelledby="t-dur-label">
              {DURATIONS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={dur === d} aria-pressed={dur === d} className="btn t-dur" onClick={() => setDur(d)}>
                  {d}분
                </button>
              ))}
            </div>
          </div>
          {view && view.periods.length > 1 ? (
            <div className="t-picker">
              <p className="t-set-label" id="t-per-label">
                차시 ({view.periods.length}차시로 나눴어요)
              </p>
              <div className="row" role="radiogroup" aria-labelledby="t-per-label">
                {view.periods.map((pp) => (
                  <button key={pp.p} type="button" role="radio" aria-checked={view.p === pp.p} aria-pressed={view.p === pp.p} className="btn t-dur" onClick={() => pickLesson(lid, pp.p)}>
                    {pp.p}차시
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {loading ? <Loading label="장면을 만드는 중이에요…" /> : null}
        {error ? (
          <p className="callout bad" role="alert">
            <b>레슨을 불러오지 못했어요.</b>
            새로고침해 보세요. 그래도 안 되면 다른 차시를 골라 주세요.
          </p>
        ) : null}

        {view ? (
          <>
            <TimeBar scenes={view.scenes} minutes={dur} total={view.total} />
            {view.flow.dropped.length ? (
              <p className="small muted">시간에 맞추려고 장면 {view.flow.dropped.length}개를 꺼 두었어요. 꺼진 칠판 문제는 숙제로 돌아가요.</p>
            ) : null}
            <div className="t-start-wrap">
              {start ? (
                <a className="btn btn-primary t-start" href={boardHref(lid, view.p, start.s)}>
                  <span aria-hidden="true">▶</span>
                  <span>
                    {resuming ? "이어서 수업" : "수업 시작"} · 장면 {start.n}부터
                  </span>
                </a>
              ) : null}
              <p className="small muted">
                켜진 장면 {view.on.length}개
                {resuming ? (
                  <>
                    {" · "}
                    <a href={boardHref(lid, view.p, view.on[0].s)}>처음부터 하기</a>
                  </>
                ) : null}
              </p>
            </div>
            <nav className="t-prep-links" aria-label="수업 준비">
              <a className="btn" href={"#/flow/" + lid + "?p=" + view.p}>
                <TIcon name="step" size="em" />
                <span>수업 흐름 고치기</span>
              </a>
              <a className="btn" href={"#/pick/" + lid + "?p=" + view.p}>
                <TIcon name="question" size="em" />
                <span>문제 고르기</span>
              </a>
              <a className="btn" href={"#/prep/" + lid}>
                <TIcon name="flag" size="em" />
                <span>준비 한 장 · 정답</span>
              </a>
              <a className="btn" href={"#/print/" + lid}>
                <TIcon name="print" size="em" />
                <span>학습지 인쇄</span>
              </a>
            </nav>
          </>
        ) : null}
      </section>

      <ClassSummary onPick={(id) => pickLesson(id)} />

      <section className="card t-student-url">
        <p className="small">
          학생은 <b>{STUDENT_URL.replace(/^https?:\/\//, "")}</b> 에서 혼자 공부해요. 수업 끝 화면의 QR 로 오늘 숙제를 보낼 수 있어요.
        </p>
      </section>
    </div>
  );
}

