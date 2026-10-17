// 수업 흐름(#/flow/:lid?p=): 장면을 켜고 끄고(문제는 칠판/숙제), 분을 −/+ 로 맞춰요.
// 칠판 문제 차례는 ↑↓ 로 바꿔요(문제 바구니 차례와 같아요). '필수만'·'처음 제안으로'.
// 바꾼 값은 aimn:t1:flow(장면)와 aimn:t1:pick(칠판 문제 차례)에 저장하고, 오늘 수업·칠판이 같은 값을 써요.
import { useState } from "react";
import type { Scene } from "../../shared/contracts.ts";
import { DURATIONS, TEACHER_ROUTES } from "../../shared/contracts.ts";
import { href, intParam } from "../../shared/router/index.ts";
import { Rich } from "../../shared/ui/index.ts";
import { TIcon } from "../../shared/icons/teacher.tsx";
import { lessonMeta, useLesson } from "../../content/index.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { NotFound } from "../shell/Fallbacks.tsx";
import { Skeleton, reloadPage } from "./Skeleton.tsx";
import { cutInfo, setScenes } from "../today/cuts.ts";
import { boardHref, todayHref, useLessonPlan } from "../shell/plan.ts";
import { barSegments, minLabel } from "../today/timebar.ts";
import { TEACHER_MARK } from "../mark.ts";
import { sceneRoot } from "../logic/index.ts";
import { storyAdd, storyAddText, timeVerdict } from "../prep/prep.logic.ts";
import { clonePick, dupTags, moveItem, onlyRequired, setSceneMin, toggleScene, useDuration, useFlowMap, useFlowState, usePickMap, usePickState } from "../store/index.ts";
import "./flow.css";

export const FLOW_MARK = TEACHER_MARK;

const KIND: Record<Scene["kind"], string> = {
  question: "핵심 질문",
  story: "이야기",
  prereq: "먼저 알고 가요",
  concept: "개념",
  example: "예제",
  widget: "체험",
  problem: "칠판 문제",
  aiStory: "AI 이야기",
  summary: "정리",
  qr: "수업 끝(QR)",
};

function clip(s: string, n: number): string {
  const t = (s || "").replace(/\n/g, " ");
  if (t.length <= n) return t;
  let cut = t.slice(0, n);
  if ((cut.match(/\$/g) || []).length % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  return cut + "…";
}

/** 장면 한 줄 설명 */
function sceneDesc(sc: Scene, prompts: Record<string, string>): string {
  if (sc.kind === "problem") {
    const qb = sc.blocks.filter((b) => b.t === "q")[0] as { id: string } | undefined;
    return qb ? clip(prompts[qb.id] || "", 90) : "";
  }
  for (const b of sc.blocks) {
    if (b.t === "lines" && b.items.length) return clip(b.items[0], 90);
    if (b.t === "p") return clip(b.text, 90);
    if (b.t === "example") return clip(b.problem || b.title, 90);
    if (b.t === "widget") return clip(b.caption || "", 90);
  }
  return "";
}

export default function FlowPage(m: TeacherPageProps) {
  const lid = m.params.lid || "";
  const meta = lessonMeta(lid);
  const pq = intParam(m.query.p, 1, 1, 20);
  const { data: lesson, loading, error } = useLesson(meta ? lid : null);
  const [minutes, setMinutes] = useDuration();
  const flowMap = useFlowMap();
  const pickMap = usePickMap();
  const view = useLessonPlan(lesson, minutes, pq, flowMap, pickMap);
  const p = view ? view.p : pq;
  const [flowSt, updateFlow] = useFlowState(lid, p);
  const [pickSt, writePick] = usePickState(lid, p);
  const [showOff, setShowOff] = useState(false);

  if (!meta) return <NotFound />;
  if (loading || (!error && !lesson)) {
    return (
      <div className={"page t-flow t-u" + meta.unit}>
        <header className="t-flow-head">
          <p className="eyebrow">{meta.code} · 수업 흐름</p>
          <h1 className="h1">{meta.title}</h1>
        </header>
        <Skeleton label="수업 흐름을 만들고 있어요…" rows={8} side />
      </div>
    );
  }
  if (error || !lesson || !view) {
    return (
      <section className="page">
        <div className="callout bad" role="alert">
          <p>레슨을 불러오지 못했어요. 다시 불러와 보세요.</p>
          <p>
            <button type="button" className="btn btn-primary" onClick={reloadPage}>
              다시 불러오기
            </button>
          </p>
        </div>
      </section>
    );
  }

  const base: Record<string, boolean> = {};
  for (const s of view.flow.scenes) base[s.id] = s.on;
  const prompts: Record<string, string> = {};
  for (const q of lesson.practice) prompts[q.id] = q.prompt;
  const curPick = pickSt ? clonePick(pickSt) : { board: view.flow.pick.board.slice(), exit: view.flow.pick.exit.slice(), hw: view.flow.pick.hw.slice() };
  const boardOrder = curPick.board;

  // "이어서" 조각은 뿌리 id 하나로 함께 켜고 꺼요(applyFlow 도 뿌리로 묶어 읽어요)
  const toggle = (sc: Scene, on: boolean) => {
    const root = sceneRoot(sc.id);
    updateFlow((cur) => {
      let next = toggleScene(cur, root, on, { required: sc.required, defaultOn: base[root] !== undefined ? base[root] : base[sc.id] });
      // 예전에 조각 id 로 저장된 값이 남아 있으면 지워요
      for (const id in base) if (id !== root && sceneRoot(id) === root) next = toggleScene(next, id, on, { required: sc.required, defaultOn: on });
      return next;
    });
  };
  const setMin = (sc: Scene, v: number) => updateFlow((cur) => setSceneMin(cur, sc.id, v));
  const resetMin = (sc: Scene) => updateFlow((cur) => setSceneMin(cur, sc.id, null));
  const moveQ = (qid: string, d: -1 | 1) => {
    const i = boardOrder.indexOf(qid);
    if (i < 0) return;
    writePick({ ...curPick, board: moveItem(boardOrder, i, d) });
  };

  const segs = barSegments(view.scenes);
  const onList = view.on;
  const firstS = onList.length ? onList[0].s : 0;
  const nOf: Record<number, number> = {};
  for (const o of onList) nOf[o.s] = o.n;
  const per = view.periods[view.p - 1];
  const edited = !!flowSt;
  const cut = cutInfo(view, minutes, flowSt);

  const offIdx: number[] = [];
  view.scenes.forEach((sc, i) => {
    if (!sc.on) offIdx.push(i);
  });

  const tags = dupTags(view.scenes);
  const sAdd = per && per.first ? storyAdd(view.scenes, view.total, minutes) : null;
  const tv = timeVerdict(view.total, minutes, sAdd);
  const over = tv.state === "over";

  const renderRow = (sc: Scene, i: number) => {
        const isQ = sc.kind === "problem";
        const qid = isQ ? ((sc.blocks.filter((b) => b.t === "q")[0] as { id: string } | undefined) || { id: "" }).id : "";
        const qi = isQ ? boardOrder.indexOf(qid) : -1;
        const customMin = !!(flowSt && flowSt.min[sc.id] !== undefined);
        const wid = sc.kind === "widget" ? ((sc.blocks.filter((b) => b.t === "widget")[0] as { id: string } | undefined) || { id: "" }).id : "";
        return (
          <li key={sc.id} className={"t-scene-row kind-" + sc.kind + (sc.on ? "" : " is-off")}>
            <span className="t-scene-n num" aria-label={sc.on ? nOf[i] + "번 장면" : "꺼진 장면"}>
              {sc.on ? nOf[i] : "–"}
            </span>
            <div className="t-scene-main">
              <p className="t-scene-kind">
                <span className="chip">{KIND[sc.kind]}</span>
                {sc.required ? <span className="chip is-accent">필수</span> : null}
                {sc.part ? <span className="chip">이어서 {sc.part.i}/{sc.part.n}</span> : null}
                {isQ && !sc.on ? <span className="chip t-to-hw">숙제로 가요</span> : null}
                {sc.fsDown ? <span className="tiny muted">글자 한 단계 작게</span> : null}
              </p>
              <p className="t-scene-title">
                {sc.title ? <Rich text={String(sc.title)} /> : null}
                {tags[i] ? <span className="t-scene-seq num"> {tags[i]}</span> : null}
              </p>
              {sceneDesc(sc, prompts) ? (
                <p className="t-scene-desc muted">
                  <Rich text={sceneDesc(sc, prompts)} />
                </p>
              ) : null}
              {isQ || wid ? (
                <p className="t-scene-links">
                  {isQ ? (
                    <a href={href(TEACHER_ROUTES.boardQ, { lid, qid }, { p: view.p, s: i })}>칠판에 크게 띄우기</a>
                  ) : (
                    <a href={href(TEACHER_ROUTES.boardTool, { lid, wid }, { p: view.p, s: i })}>체험 도구 크게 열기</a>
                  )}
                </p>
              ) : null}
            </div>

            <div className="t-scene-ctl">
              {isQ ? (
                <div className="t-updown" role="group" aria-label="문제 차례">
                  <button type="button" className="btn btn-icon" onClick={() => moveQ(qid, -1)} disabled={qi <= 0} aria-label="앞으로">
                    ↑
                  </button>
                  <button type="button" className="btn btn-icon" onClick={() => moveQ(qid, 1)} disabled={qi < 0 || qi >= boardOrder.length - 1} aria-label="뒤로">
                    ↓
                  </button>
                </div>
              ) : null}

              <div className={"stepper t-min" + (customMin ? " is-custom" : "")} role="group" aria-label="예상 시간">
                <button type="button" onClick={() => setMin(sc, sc.estMin - 0.5)} disabled={!sc.on || sc.estMin <= 0.5} aria-label="0.5분 줄이기">
                  −
                </button>
                <span className="val num">{minLabel(sc.estMin)}</span>
                <button type="button" onClick={() => setMin(sc, sc.estMin + 0.5)} disabled={!sc.on || sc.estMin >= 60} aria-label="0.5분 늘리기">
                  +
                </button>
              </div>
              {customMin ? (
                <button type="button" className="btn btn-ghost t-auto" onClick={() => resetMin(sc)}>
                  자동
                </button>
              ) : null}

              {sc.required ? (
                <label className="switch t-onoff is-lock" title="필수 장면이라 끌 수 없어요">
                  <input type="checkbox" checked disabled readOnly />
                  <span>
                    <span aria-hidden="true">🔒 </span>켜짐
                    <span className="sr-only"> · 필수 장면이라 끌 수 없어요</span>
                  </span>
                </label>
              ) : isQ ? (
                <div className="t-seg" role="radiogroup" aria-label="칠판 또는 숙제">
                  <button type="button" role="radio" aria-checked={sc.on} aria-pressed={sc.on} className="btn" onClick={() => toggle(sc, true)}>
                    칠판
                  </button>
                  <button type="button" role="radio" aria-checked={!sc.on} aria-pressed={!sc.on} className="btn" onClick={() => toggle(sc, false)}>
                    숙제
                  </button>
                </div>
              ) : (
                <label className="switch t-onoff">
                  <input type="checkbox" checked={sc.on} onChange={(e) => toggle(sc, e.target.checked)} />
                  <span>{sc.on ? "켜짐" : "꺼짐"}</span>
                </label>
              )}
            </div>
          </li>
        );
  };

  return (
    <div className={"page t-flow t-u" + meta.unit}>
      <header className="t-flow-head">
        <p className="eyebrow">
          {meta.code} · 수업 흐름{view.periods.length > 1 ? " · " + view.p + "/" + view.periods.length + "차시" : ""}
        </p>
        <h1 className="h1">{lesson.title}</h1>
      </header>

      <div className="t-flow-grid">
        <aside className="t-flow-sum card" aria-labelledby="t-flow-sum-h">
          <h2 className="h3" id="t-flow-sum-h">
            합계
          </h2>
          <p className={"t-flow-total" + (over ? " is-over" : "")}>
            <b className="num">{minLabel(view.total)}</b> / {minutes}분
          </p>
          <div className="t-tb-bar" role="img" aria-label={"시간 배분: " + segs.map((s) => s.label + " " + minLabel(s.min)).join(", ")}>
            {segs.map((s) => (
              <span key={s.key} className={"t-tb-seg is-" + s.key} style={{ width: s.pct + "%" }}>
                {s.pct >= 18 ? <span className="t-tb-txt">{s.label}</span> : null}
              </span>
            ))}
          </div>
          <p className="t-set-label" id="t-flow-stage">
            단계별 시간
          </p>
          <ul className="t-tb-legend t-flow-legend" aria-labelledby="t-flow-stage">
            {segs.map((s) => (
              <li key={s.key}>
                <i className={"t-tb-sw is-" + s.key} aria-hidden="true" />
                {s.label} <b className="num">{minLabel(s.min)}</b>
              </li>
            ))}
          </ul>
          <p className={"small " + (over ? "t-over" : "muted")} role={over ? "alert" : undefined}>
            {tv.text}
            {over ? " 장면을 끄거나 분을 줄여 보세요." : tv.state === "under" ? " 체험이나 문제를 더 켜도 돼요." : ""}
            {sAdd ? " " + storyAddText(sAdd) : ""}
          </p>
          {over && cut.over > 0 && cut.scenes.length ? (
            <button type="button" className="btn btn-soft btn-block" onClick={() => updateFlow((cur) => setScenes(cur, view, cut.scenes, false))}>
              줄이기 · 장면 {cut.scenes.length}개 끄기
            </button>
          ) : null}

          <div className="stack tight">
            <p className="t-set-label" id="t-flow-dur">
              수업 시간
            </p>
            <div className="row t-chips" role="radiogroup" aria-labelledby="t-flow-dur">
              {DURATIONS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={minutes === d} aria-pressed={minutes === d} className="btn t-dur" onClick={() => setMinutes(d)}>
                  {d}분
                </button>
              ))}
            </div>
          </div>

          {view.periods.length > 1 ? (
            <div className="stack tight">
              <p className="t-set-label" id="t-flow-per">
                차시
              </p>
              <div className="row t-chips" role="radiogroup" aria-labelledby="t-flow-per">
                {view.periods.map((pp) => (
                  <a key={pp.p} role="radio" aria-checked={pp.p === view.p} aria-pressed={pp.p === view.p} className="btn t-dur" href={href(TEACHER_ROUTES.flow, { lid }, { p: pp.p })}>
                    {pp.p}차시
                  </a>
                ))}
              </div>
              {per ? <p className="small muted">이 차시 소제목: {per.sections.map((i) => i + 1).join(", ")}번</p> : null}
            </div>
          ) : null}

          <div className="row wrap t-flow-acts">
            <button type="button" className="btn" onClick={() => updateFlow(() => onlyRequired(view.scenes))}>
              필수만
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => updateFlow(() => null)} disabled={!edited}>
              처음 제안으로
            </button>
          </div>
          {view.flow.dropped.length && !edited ? (
            <p className="small muted">시간에 맞추려고 장면 {view.flow.dropped.length}개를 꺼 두었어요.</p>
          ) : null}

          <a className="btn btn-primary btn-lg btn-block" href={boardHref(lid, view.p, firstS)}>
            <TIcon name="play" size="em" />
            <span>칠판 수업 시작</span>
          </a>
          <div className="row wrap">
            <a className="btn btn-soft" href={href(TEACHER_ROUTES.pick, { lid }, { p: view.p })}>
              문제 고르기
            </a>
            <a className="btn btn-ghost" href={todayHref(lid, view.p)}>
              오늘 수업으로
            </a>
          </div>
        </aside>

        <section className="t-flow-list" aria-label="장면 목록">
          <ol className="t-scene-rows">{view.scenes.map((sc, i) => (sc.on ? renderRow(sc, i) : null))}</ol>
          {offIdx.length ? (
            <details className="t-offgroup" open={showOff} onToggle={(e) => setShowOff((e.currentTarget as HTMLDetailsElement).open)}>
              <summary className="t-offgroup-sum">{showOff ? "꺼진 장면 " + offIdx.length + "개 접기" : "꺼진 장면 " + offIdx.length + "개 펼치기"}</summary>
              <ol className="t-scene-rows">{offIdx.map((i) => renderRow(view.scenes[i], i))}</ol>
            </details>
          ) : null}
          <p className="small muted">이야기는 1차시 요약 한 장만, AI 이야기는 처음에 꺼져 있어요. 켜면 칠판에 함께 나와요. 바꾼 값은 이 기기에만 저장돼요.</p>
        </section>
      </div>
    </div>
  );
}
