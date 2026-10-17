// 교사 첫 화면 '오늘 수업'(#/).
//   첫 화면 위쪽(1080 안): 오늘 할 레슨 고르기(이어서 할 레슨과 다르면 한 카드 안에서) · 수업 시간 · 차시 · '▶ 수업 시작'(장면 a/b, 칠판과 같은 번호)
//   그 아래: 시간 배분 막대 · "시간이 n분 넘쳐요 · 줄이기" · 꺼진 장면 펼침 목록(바로 켜기) · 준비 바로 가기 · 이 반 진도에 기록하기 · 반별 진도 요약
// 다른 차시는 #/?lid=u1-3&p=2 로 올려요(차시 찾기의 '오늘 수업으로'). 시간이 넘쳐도 장면을 자동으로 끄지 않아요.
import { useEffect, useState } from "react";
import { DURATIONS, type LessonIndex, type TeacherData } from "../../shared/contracts.ts";
import { intParam, navigate } from "../../shared/router/index.ts";
import { teacherStore, useStored } from "../../shared/storage/index.ts";
import { INDEX, lessonMeta, unitOf, useLesson } from "../../content/index.ts";
import { Rich } from "../../shared/widgets/kit.tsx";
import { TIcon } from "../../shared/icons/teacher.tsx";
import { STUDENT_URL } from "../../site.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { useKlass, type ProgressMap, type ProgressMark } from "../shell/klass.tsx";
import { boardHref, planOf, useLessonPlan, type LessonPlanView } from "../shell/plan.ts";
import { periodQuestion } from "../logic/index.ts";
import { useDuration, useFlowMap, useFlowState, usePickMap } from "../store/index.ts";
import { Skeleton } from "../flow/Skeleton.tsx";
import { agoLabel, barSegments, marksLabel, minLabel } from "./timebar.ts";
import { markOf, startLabel, statusLine } from "../progress/progress.logic.ts";
import { storyAdd, storyAddText } from "../prep/prep.logic.ts";
import { cutInfo, offScenes, sceneName, setScenes } from "./cuts.ts";

// 이 탭에서 마지막으로 오늘 수업에 올린 차시(주소에 없을 때 다시 씀)
let memPick: { lid: string; p: number; klass: string | null } | null = null;

/** 반의 다음 레슨: 화면 순서대로 '끝'이 아닌 첫 레슨 */
export function nextLessonFor(progress: ProgressMap, klass: string | null): string | null {
  if (!klass) return null;
  const row = progress[klass] || {};
  for (const id of INDEX.order) if (row[id] !== "done") return id;
  return null;
}

export function countMarks(row: Record<string, string> | undefined): { done: number; part: number } {
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

const MARK_NAME: Record<ProgressMark | "none", string> = { none: "아직", part: "진행 중", done: "끝" };

/* ─────────── 처음 쓰는 경우 ─────────── */

function Welcome() {
  return (
    <section className="card t-welcome" aria-labelledby="t-welcome-h">
      <h2 className="h3" id="t-welcome-h">
        반가워요! 세 단계면 수업을 시작할 수 있어요.
      </h2>
      <ol className="t-steps">
        <li>
          <b>반을 추가해요</b>
          <span className="muted"> 위의 '+ 반 추가'에 '2-3'처럼 적어요. 반별 진도를 따로 볼 수 있어요(건너뛰어도 돼요).</span>
        </li>
        <li>
          <b>차시를 골라요</b>
          <span className="muted"> 위에 첫 차시가 올라와 있어요. 다른 차시는 '차시 찾기'에서 골라요.</span>
        </li>
        <li>
          <b>'수업 시작'을 눌러요</b>
          <span className="muted"> 전자칠판 화면이 열리고, '다음'만 누르면 수업이 흘러가요.</span>
        </li>
      </ol>
      <p className="small muted">이 사이트는 학생 기록을 모으지 않아요. 설정은 이 기기 안에만 남아요.</p>
    </section>
  );
}

/* ─────────── 시간 배분 막대 ─────────── */

function TimeBar({ scenes }: { scenes: Parameters<typeof barSegments>[0] }) {
  const segs = barSegments(scenes);
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
    </div>
  );
}

/* ─────────── 넘침 안내 · 꺼진 장면 ─────────── */

function FitPanel({ lid, view, minutes }: { lid: string; view: LessonPlanView; minutes: number }) {
  const [flowSt, updateFlow] = useFlowState(lid, view.p);
  const [openOffs, setOpenOffs] = useState(false);
  const cut = cutInfo(view, minutes, flowSt);
  const offs = offScenes(view);

  const doCut = () => {
    updateFlow((cur) => setScenes(cur, view, cut.scenes, false));
    setOpenOffs(true);
  };

  return (
    <div className="t-fit stack">
      {cut.over ? (
        <div className="callout warn t-over-box" role="status">
          <div className="grow">
            <p className="t-over-msg">
              <b>시간이 {minLabel(cut.over)} 넘쳐요.</b> 예상 {minLabel(view.total)} / 수업 {minutes}분
            </p>
            <p className="small">
              {cut.scenes.length
                ? "줄이면 덜 중요한 장면 " + cut.scenes.length + "개를 꺼요" + (cut.toHw ? "(칠판 문제 " + cut.toHw + "개는 숙제로 가요)" : "") + ". 꺼진 장면은 아래에서 바로 다시 켤 수 있어요."
                : "필수 장면만으로도 길어요. 수업 흐름에서 분을 줄이거나 차시를 나눠 보세요."}
            </p>
          </div>
          {cut.scenes.length ? (
            <button type="button" className="btn btn-primary t-cut" onClick={doCut}>
              줄이기
            </button>
          ) : null}
        </div>
      ) : (
        <p className="muted">
          예상 {minLabel(view.total)} / 수업 {minutes}분 · {view.total < minutes - 3 ? minLabel(minutes - view.total) + " 남아요. 꺼진 장면을 켜도 돼요." : "시간에 잘 맞아요."}
        </p>
      )}

      {offs.length ? (
        <details className="t-offs" open={openOffs} onToggle={(e) => setOpenOffs((e.currentTarget as HTMLDetailsElement).open)}>
          <summary className="t-offs-sum">
            <span>꺼진 장면 {offs.length}개</span>
            <span className="muted"> · 눌러서 펼치고 바로 켤 수 있어요</span>
          </summary>
          <ul className="t-offs-list">
            {offs.map((sc) => (
              <li key={sc.id} className="t-off-row">
                <span className="grow t-off-name">
                  <Rich text={sceneName(sc)} />
                  {sc.kind === "problem" ? <span className="chip is-warn t-off-hw">숙제로 가요</span> : null}
                </span>
                <button type="button" className="btn btn-soft t-off-on" onClick={() => updateFlow((cur) => setScenes(cur, view, [sc], true))}>
                  켜기
                </button>
              </li>
            ))}
          </ul>
          <div className="row wrap t-offs-acts">
            <button type="button" className="btn btn-ghost" onClick={() => updateFlow((cur) => setScenes(cur, view, offs, true))}>
              모두 켜기
            </button>
            {flowSt ? (
              <button type="button" className="btn btn-ghost" onClick={() => updateFlow(() => null)}>
                처음 상태로
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

/* ─────────── 이 반 진도에 기록하기 ─────────── */

function MarkRow({ lid }: { lid: string }) {
  const { klass, progress, markLesson } = useKlass();
  if (!klass) return null;
  const v = (progress[klass] || {})[lid] as ProgressMark | undefined;
  const meta = lessonMeta(lid);
  return (
    <div className="t-mark" role="group" aria-labelledby="t-mark-h">
      <p className="t-set-label" id="t-mark-h">
        이 반 진도에 기록하기 <span className="muted t-mark-who">· {klass}반 {meta ? meta.code : ""}</span>
      </p>
      <div className="row t-chips">
        {(["none", "part", "done"] as (ProgressMark | "none")[]).map((m) => (
          <button
            key={m}
            type="button"
            className="btn t-dur"
            aria-pressed={(v || "none") === m}
            onClick={() => markLesson(klass, lid, m === "none" ? null : (m as ProgressMark))}
          >
            {MARK_NAME[m]}
          </button>
        ))}
      </div>
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
              <button type="button" className="t-cls-name btn" aria-pressed={c === klass} onClick={() => setKlass(c)}>
                {c}
              </button>
              <div className="grow stack tight">
                <div className="meter" role="img" aria-label={c + "반 진도: " + marksLabel(done, part) + " (전체 " + total + "레슨)"}>
                  <i style={{ width: pct + "%" }} />
                </div>
                <p className="small muted">
                  {marksLabel(done, part)} · 전체 {total}레슨
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
                  다음 레슨 올리기
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

type Mode = "resume" | "today";

export default function Today({ query }: TeacherPageProps) {
  const [dur, setDur] = useDuration();
  const [last] = useStored(teacherStore, "last", null as TeacherData["last"]);
  const flowMap = useFlowMap();
  const pickMap = usePickMap();
  const { klass, classes, progress } = useKlass();
  const [choice, setChoice] = useState<Mode | null>(null);

  const qLid = query.lid && lessonMeta(query.lid) ? query.lid : null;
  const lastOk = last && last.lid && lessonMeta(last.lid) ? last : null;
  const memOk = memPick && memPick.klass === klass && lessonMeta(memPick.lid) ? memPick : null;

  // 오늘 레슨(주소 → 이 탭에서 올린 것 → 반의 다음 레슨 → 마지막 수업 → 첫 레슨)
  const todayLid = qLid || (memOk && memOk.lid) || nextLessonFor(progress, klass) || (lastOk && lastOk.lid) || INDEX.order[0];
  let todayP = 1;
  if (qLid) todayP = intParam(query.p, 1, 1, 9);
  else if (memOk && memOk.lid === todayLid) todayP = memOk.p;
  else if (lastOk && lastOk.lid === todayLid && lastOk.p > 0) todayP = lastOk.p;

  // 이어서 할 곳이 오늘 레슨·차시와 다르면 한 카드 안에서 골라요(주소로 고른 차시가 있으면 그쪽이 먼저)
  const resumeDiff = !!lastOk && !(lastOk.lid === todayLid && (lastOk.p || 1) === todayP);
  const mode: Mode = resumeDiff ? choice || (qLid ? "today" : "resume") : "today";
  const lid = mode === "resume" && lastOk ? lastOk.lid : todayLid;
  const p = mode === "resume" && lastOk ? lastOk.p || 1 : todayP;
  const meta = lessonMeta(lid) as LessonIndex;

  useEffect(() => {
    setChoice(null);
  }, [qLid, query.p]);
  useEffect(() => {
    if (qLid) memPick = { lid: qLid, p: todayP, klass };
  }, [qLid, todayP, klass]);

  const { data: lesson, error, loading } = useLesson(lid);
  const view = useLessonPlan(lesson, dur, p, flowMap, pickMap);
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
  const nOn = view ? view.on.length : 0;
  const firstUse = !lastOk && !classes.length;
  const unit = unitOf(lid);
  let qLines: string[] = [meta.question];
  if (lesson && view) {
    try {
      const ql = periodQuestion(lesson, planOf(lid), view.flow.period);
      if (ql.length) qLines = ql;
    } catch (e) {
      /* 원래 질문 그대로 */
    }
  }
  const todayMeta = lessonMeta(todayLid);
  const lastMeta = lastOk ? lessonMeta(lastOk.lid) : undefined;
  const nPeriods = view ? view.periods.length : 1;
  const mark = markOf(progress, klass, lid);
  const lastDone = !!lastOk && markOf(progress, klass, lastOk.lid) === "done";
  const sl = view && start ? startLabel(mark, start.n, nOn) : null;
  const fromStart = !!sl && sl.fromStart;
  const nextCode = (() => {
    const nx = klass ? nextLessonFor(progress, klass) : null;
    const nm = nx && nx !== lid ? lessonMeta(nx) : undefined;
    return nm ? nm.code : "";
  })();
  const status = klass ? statusLine(klass, meta.code, mark) + (mark === "done" && nextCode ? " 다음은 " + nextCode + "예요." : "") : "";
  const sAdd = view && view.periods[view.p - 1] && view.periods[view.p - 1].first ? storyAdd(view.scenes, view.total, dur) : null;

  return (
    <div className={"page t-today t-u" + meta.unit}>
      <header className="row between t-today-head">
        <div className="stack tight">
          <p className="eyebrow">교사용{klass ? " · " + klass + "반" : ""}</p>
          <h1 className="h2">오늘 수업</h1>
        </div>
        <a className="btn" href="#/find">
          <TIcon name="search" size="em" />
          <span>차시 찾기</span>
        </a>
      </header>

      {status ? (
        <p className={"t-status is-" + mark} role="status">
          {status}
        </p>
      ) : null}

      <section className="card card-hero t-lesson" aria-labelledby="t-lesson-h">
        {resumeDiff && lastOk && lastMeta && todayMeta ? (
          <div className="t-choice" role="radiogroup" aria-label="오늘 할 레슨 고르기">
            <button type="button" role="radio" aria-checked={mode === "resume"} className={"t-choice-opt" + (mode === "resume" ? " is-on" : "")} onClick={() => setChoice("resume")}>
              <span className="t-choice-mark" aria-hidden="true">
                {mode === "resume" ? "●" : "○"}
              </span>
              <span className="t-choice-txt">
                <b>
                  {lastMeta.code} {lastDone ? "다시 하기" : "마저 하기"}
                </b>
                <span className="t-choice-sub">
                  {lastMeta.short || lastMeta.title}
                  {lastOk.p > 0 ? " · " + lastOk.p + "차시" : ""} · {lastDone ? "끝난 레슨이에요 · " + agoLabel(lastOk.ts) + " 마지막" : agoLabel(lastOk.ts) + " 멈춘 곳부터"}
                </span>
              </span>
            </button>
            <button type="button" role="radio" aria-checked={mode === "today"} className={"t-choice-opt" + (mode === "today" ? " is-on" : "")} onClick={() => setChoice("today")}>
              <span className="t-choice-mark" aria-hidden="true">
                {mode === "today" ? "●" : "○"}
              </span>
              <span className="t-choice-txt">
                <b>
                  {todayMeta.code}
                  {todayLid === lastOk.lid ? " " + todayP + "차시" : ""} 시작하기
                </b>
                <span className="t-choice-sub">
                  {todayMeta.short || todayMeta.title} · {qLid ? "고른 차시" : klass ? klass + "반 다음 레슨" : "다음 레슨"}
                </span>
              </span>
            </button>
          </div>
        ) : null}

        <div className="t-lesson-top">
          <p className="eyebrow">
            {meta.code}
            {unit ? " · " + unit.title : ""}
            {nPeriods > 1 ? " · " + p + "/" + nPeriods + "차시" : ""}
          </p>
          <h2 className="h1 t-lesson-title" id="t-lesson-h">
            {meta.title}
          </h2>
          <div className="t-question">
            <span className="t-q-tag">핵심 질문</span>
            {qLines.map((t, i) => (
              <span key={i} className="t-q-line">
                <Rich text={t} />
              </span>
            ))}
          </div>
        </div>

        <div className="t-pickers">
          <div className="t-picker">
            <p className="t-set-label" id="t-dur-label">
              수업 시간
            </p>
            <div className="row t-chips" role="radiogroup" aria-labelledby="t-dur-label">
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
                차시 <span className="muted">({view.periods.length}차시로 나눴어요)</span>
              </p>
              <div className="row t-chips" role="radiogroup" aria-labelledby="t-per-label">
                {view.periods.map((pp) => (
                  <button key={pp.p} type="button" role="radio" aria-checked={view.p === pp.p} aria-pressed={view.p === pp.p} className="btn t-dur" onClick={() => pickLesson(lid, pp.p)}>
                    {pp.p}차시
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {loading ? <Skeleton label="장면을 만드는 중이에요…" rows={2} /> : null}
        {error ? (
          <p className="callout bad" role="alert">
            <b>레슨을 불러오지 못했어요.</b>
            새로고침해 보세요. 그래도 안 되면 다른 차시를 골라 주세요.
          </p>
        ) : null}

        {view && sAdd ? (
          <p className={"callout t-story-add" + (sAdd.over > 0 ? " warn" : "")} role="status">
            {storyAddText(sAdd, dur)}
          </p>
        ) : null}

        {view && start && sl ? (
          <div className="t-start-wrap">
            <a className="btn btn-primary t-start" href={boardHref(lid, view.p, fromStart ? view.on[0].s : start.s)}>
              <span aria-hidden="true">▶</span>
              <span>{sl.label}</span>
              <span className="t-start-n">· {sl.sub}</span>
            </a>
            <p className="small muted t-start-note">켜진 장면 {nOn}개 · 예상 {minLabel(view.total)}</p>
            {mark === "done" && resuming ? (
              <p className="t-start-acts">
                <a className="btn btn-soft t-resume-sub" href={boardHref(lid, view.p, start.s)}>
                  이어서 수업 · 장면 {start.n}/{nOn}부터
                </a>
              </p>
            ) : null}
            {mark !== "done" && resuming ? (
              <p className="small t-start-acts">
                <a href={boardHref(lid, view.p, view.on[0].s)}>처음(장면 1/{nOn})부터 하기</a>
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      {view ? (
        <section className="card t-plan stack" aria-labelledby="t-plan-h">
          <h2 className="h3" id="t-plan-h">
            시간 배분{view.periods.length > 1 ? " · " + view.p + "차시" : ""}
          </h2>
          <TimeBar scenes={view.scenes} />
          <FitPanel lid={lid} view={view} minutes={dur} />
          <h3 className="t-prep-h" id="t-prep-h">
            수업 전 준비
          </h3>
          <nav className="t-prep-links" aria-labelledby="t-prep-h">
            <a className="btn" href={"#/flow/" + lid + "?p=" + view.p}>
              <TIcon name="step" size="em" />
              <span>수업 흐름 고치기</span>
            </a>
            <a className="btn" href={"#/pick/" + lid + "?p=" + view.p}>
              <TIcon name="question" size="em" />
              <span>문제 고르기</span>
            </a>
            <a className="btn" href={"#/prep/" + lid + "?p=" + view.p}>
              <TIcon name="flag" size="em" />
              <span>준비 한 장 · 정답</span>
            </a>
            <a className="btn" href={"#/print/" + lid + "?p=" + view.p}>
              <TIcon name="print" size="em" />
              <span>학습지 인쇄</span>
            </a>
          </nav>
          <MarkRow lid={lid} />
        </section>
      ) : null}

      {firstUse ? <Welcome /> : null}

      <ClassSummary onPick={(id) => pickLesson(id)} />

      <section className="card t-student-url">
        <p className="small">
          학생은 <b>{STUDENT_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}</b>에서 혼자 공부해요. 수업 끝 화면의 QR로 오늘 숙제를 보낼 수 있어요.
        </p>
      </section>
    </div>
  );
}
