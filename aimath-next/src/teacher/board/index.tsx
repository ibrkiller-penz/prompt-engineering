// 칠판 무대 화면(교사 전용): #/board/:lid?p=&s= · #/board/:lid/q/:qid · #/board/:lid/tool/:wid · #/board/:lid/end
// shell/pages.tsx 약속대로 default 하나가 m.name 으로 나눠 그려요. 이 폴더의 스타일은 여기서만 불러요.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TEACHER_ROUTES, type Lesson, type Scene } from "../../shared/contracts.ts";
import { fillPath, href, intParam, navigate } from "../../shared/router/index.ts";
import { Rich, guideOf } from "../../shared/ui/index.ts";
import WidgetHost from "../../shared/widgets/WidgetHost.tsx";
import { WIDGET_TITLES, isWidgetId } from "../../shared/widgets/ids.ts";
import { lessonMeta } from "../../content/index.ts";
import { useTeacherPrefs } from "../shell/prefs.ts";
import { Loading } from "../shell/Fallbacks.tsx";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { expandId, summaryForPeriod } from "../logic/index.ts";
import { planOf } from "../shell/plan.ts";
import { saveLast } from "../store/index.ts";
import { TEACHER_MARK } from "../mark.ts";
import { firstOn, lastOn, qStages, QSTAGE_LABEL, revealMax, segmentInfo, snapOn, stepNext, stepPrev, type Pos } from "./board.logic.ts";
import { Stage, type RailItem } from "./Stage.tsx";
import { ConceptScene, ExampleScene, KIND_LABEL, LinesScene, PrereqScene, QuestionScene, SceneBody, findQ, type Layout } from "./scenes.tsx";
import { BoardQuestion } from "./Question.tsx";
import { EndScene, useFinish } from "./End.tsx";
import { useBoardData } from "./data.ts";
import "./board.css";

/** 교사 전용 표식(학생 빌드에 들어가면 누출 검사가 잡아요) */
export const BOARD_MARK = TEACHER_MARK;

const DEFAULT_LAYOUT: Layout = { pages: 1, display: 0, pfr: [0], level: 0 };

function lessonLabel(lid: string, lesson?: Lesson) {
  const m = lessonMeta(lid);
  return (m ? m.code + " " : "") + (lesson ? lesson.title : m ? m.title : lid);
}

/** 수업 끝 화면에 크게 쓰는 차시 이름(예: "Ⅰ-1 인공지능이란? · 1차시") */
function periodLabel(lid: string, lesson: Lesson | undefined, p: number, n: number) {
  return lessonLabel(lid, lesson) + (n > 1 && p >= 1 ? " · " + p + "차시" : "");
}

/** 다음 단추: 문제 단계 이름 */
function qNextLabel(st: string): string {
  return st === "show" ? "보기 보이기" : QSTAGE_LABEL[st as keyof typeof QSTAGE_LABEL] + " 열기";
}

function Missing({ what }: { what: string }) {
  return (
    <section className="page bd-missing">
      <div className="card empty">
        <h1 className="h2">{what}을(를) 찾지 못했어요</h1>
        <p className="muted">주소가 바뀌었거나 잘못 들어온 것 같아요.</p>
        <p>
          <a className="btn btn-primary" href="#/">
            오늘 수업으로 가요
          </a>
        </p>
      </div>
    </section>
  );
}

/* ─────────── 장면 넘기기 ─────────── */

function sceneTitle(sc: Scene): string {
  const t = sc.title ? String(sc.title) : "";
  return t ? KIND_LABEL[sc.kind] + " · " + t : KIND_LABEL[sc.kind];
}

function Runner(props: { lid: string; lesson: Lesson; scenes: Scene[]; p: number; n: number; exit: string[]; hw: string[]; sQuery: number }) {
  const { lid, lesson, scenes, p, exit, hw } = props;
  const [prefs] = useTeacherPrefs();
  const [pos, setPos] = useState<Pos>(() => ({ s: snapOn(scenes, props.sQuery >= 0 ? props.sQuery : firstOn(scenes)), r: 0, page: 0 }));
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  const s = snapOn(scenes, pos.s);
  const scene = scenes[s];
  const posRef = useRef(pos);
  posRef.current = { ...pos, s };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // 주소(s)와 이어서 하기 위치를 맞춰요(뒤로 가기 기록은 남기지 않아요)
  useEffect(() => {
    navigate(fillPath(TEACHER_ROUTES.board, { lid }), { p, s }, { replace: true });
    saveLast(lid, p, s);
  }, [lid, p, s]);

  // 주소가 밖에서 바뀌면(이어서 하기 링크 등) 따라가요
  useEffect(() => {
    if (props.sQuery >= 0 && props.sQuery !== posRef.current.s) {
      setLayout(DEFAULT_LAYOUT);
      setPos({ s: snapOn(scenes, props.sQuery), r: 0, page: 0 });
    }
  }, [props.sQuery, scenes]);

  const max = useCallback((i: number) => (scenes[i] ? revealMax(scenes[i], lesson) : 0), [scenes, lesson]);

  const go = useCallback((next: Pos) => {
    if (next.s !== posRef.current.s) setLayout(DEFAULT_LAYOUT);
    setPos(next);
  }, []);

  const env = () => {
    const l = layoutRef.current;
    return { scenes, max, pages: l.pages, pageForReveal: (r: number) => l.pfr[Math.min(r, l.pfr.length - 1)] || 0 };
  };
  const onNext = () => {
    const cur = { ...posRef.current, page: layoutRef.current.display };
    const res = stepNext(cur, env());
    if (!res.done) go(res.pos);
  };
  const onPrev = () => {
    const cur = { ...posRef.current, page: layoutRef.current.display };
    go(stepPrev(cur, env()));
  };
  const jump = (i: number) => go({ s: i, r: 0, page: 0 });

  const onLayout = useCallback((l: Layout) => setLayout(l), []);
  const lastPeriod = props.p === 0 || props.p >= props.n;
  const finish = useFinish(lid, lastPeriod);

  if (!scene) return <Missing what="장면" />;

  const m = max(s);
  const rails: RailItem[] = [];
  scenes.forEach((sc, i) => {
    if (sc.on) rails.push({ s: i, label: sceneTitle(sc) });
  });
  const seg = segmentInfo(scenes, s);
  let nextOn = -1;
  for (let i = s + 1; i < scenes.length; i++)
    if (scenes[i].on) {
      nextOn = i;
      break;
    }

  let nextLabel = "다음 장면";
  let nextHint: string | undefined;
  const qid = scene.kind === "problem" ? ((scene.blocks.filter((b) => b.t === "q")[0] as { t: "q"; id: string } | undefined) || { id: "" }).id : "";
  const q = qid ? findQ(lesson, qid) : undefined;
  if (pos.r < m) {
    if (q) {
      nextLabel = qNextLabel(qStages(q)[pos.r + 1]);
      nextHint = pos.r + 1 + " / " + m;
    } else {
      nextLabel = "다음 공개";
      nextHint = pos.r + 1 + " / " + m;
    }
  } else if (layout.display < layout.pages - 1) {
    nextLabel = "이어서";
    nextHint = layout.display + 2 + " / " + layout.pages + "쪽";
  } else if (nextOn >= 0) {
    nextHint = KIND_LABEL[scenes[nextOn].kind];
  } else {
    nextLabel = "마지막 장면";
  }

  const kind = scene.kind;
  // 수업 끝 장면에서는 아래 주 단추가 '수업 마치기(진도 표시)'예요
  const isEnd = kind === "qr" && pos.r >= m && layout.display >= layout.pages - 1;
  if (isEnd) {
    nextLabel = finish.label;
    nextHint = finish.hint;
  }
  const pageable = kind !== "problem" && kind !== "widget" && kind !== "qr";
  const wid = kind === "widget" ? ((scene.blocks.filter((b) => b.t === "widget")[0] as { id: string } | undefined) || { id: "" }).id : "";

  return (
    <Stage
      inkKey={lid + ":" + p + ":" + scene.id}
      lessonLabel={lessonLabel(lid, lesson)}
      title={
        <>
          {kind === "widget" && isWidgetId(wid) ? (
            (guideOf(wid) || { title: "" }).title || WIDGET_TITLES[wid]
          ) : scene.title ? (
            <Rich text={String(scene.title)} />
          ) : (
            KIND_LABEL[kind]
          )}
          {scene.part ? <span className="chip bd-part">이어서 {scene.part.i}/{scene.part.n}</span> : null}
        </>
      }
      counter={seg.label + " " + seg.n + "/" + seg.m + " · 장면 " + seg.a + "/" + seg.b}
      counterNote={seg.off ? "꺼진 장면 " + seg.off : undefined}
      rail={{ items: rails, cur: s, onJump: jump }}
      onNext={isEnd ? finish.run : onNext}
      onPrev={onPrev}
      onFirst={() => jump(firstOn(scenes))}
      onLast={() => jump(lastOn(scenes))}
      nextLabel={nextLabel}
      nextHint={nextHint}
      nextTone={isEnd ? "finish" : undefined}
      canPrev={pos.r > 0 || layout.display > 0 || s > firstOn(scenes)}
      exitHref="#/"
      noSwipe={kind === "widget"}
    >
      <SceneBody key={scene.id + ":" + prefs.fs} scene={scene} r={pos.r} page={pos.page} pageable={pageable} onLayout={onLayout}>
        {(level) => {
          switch (kind) {
            case "question":
              return <QuestionScene scene={scene} />;
            case "story":
            case "aiStory":
            case "summary":
              return <LinesScene scene={scene} r={pos.r} />;
            case "prereq":
              return <PrereqScene scene={scene} r={pos.r} />;
            case "concept":
              return <ConceptScene scene={scene} r={pos.r} level={level} lid={lid} onAll={() => setPos({ s, r: m, page: pos.page })} />;
            case "example":
              return <ExampleScene scene={scene} r={pos.r} />;
            case "widget":
              return isWidgetId(wid) ? (
                <div className="bd-tool-scene">
                  <WidgetHost id={wid} surface="board" guide={guideOf(wid)} />
                </div>
              ) : (
                <p className="muted">이 체험 도구는 아직 준비 중이에요.</p>
              );
            case "problem":
              return q ? (
                <BoardQuestion lid={lid} q={q} r={pos.r} onStage={(r) => setPos({ s, r, page: 0 })} label={"문제 " + (scenes.filter((x, i) => x.on && x.kind === "problem" && i <= s).length || 1)} />
              ) : (
                <p className="muted">문제를 찾지 못했어요.</p>
              );
            case "qr":
              return <EndScene lesson={lesson} exit={exit} hw={hw} periodLabel={periodLabel(lid, lesson, props.p, props.n)} />;
          }
        }}
      </SceneBody>
    </Stage>
  );
}

function BoardRun({ lid, query }: { lid: string; query: Record<string, string> }) {
  const p0 = intParam(query.p, 1, 0, 20);
  const d = useBoardData(lid, p0);
  if (!lessonMeta(lid)) return <Missing what="레슨" />;
  // 다른 레슨으로 주소만 바뀐 순간에는 앞 레슨 자료가 한 번 더 올 수 있어요. 그 장면 목록으로 위치를 정하면
  // 엉뚱한 장면(예: 정리)에서 시작하므로, 이 레슨 자료가 올 때까지 기다려요.
  if (d.loading || (!d.lesson && !d.error) || (d.lesson && d.lesson.id !== lid)) return <Loading label="칠판 수업을 준비하고 있어요…" />;
  if (!d.lesson || !d.view) return <Missing what="레슨" />;
  const sQ = intParam(query.s, -1, 0, 999);
  return (
    <Runner
      key={lid + ":" + d.view.p + ":" + d.minutes}
      lid={lid}
      lesson={d.lesson}
      scenes={d.view.scenes}
      p={d.view.p}
      n={d.view.periods.length}
      exit={d.exit}
      hw={d.hw}
      sQuery={sQ}
    />
  );
}

/* ─────────── 한 문제 크게 ─────────── */

function backHref(lid: string, query: Record<string, string>): string {
  const p = intParam(query.p, 0, 0, 20);
  const s = intParam(query.s, -1, 0, 999);
  if (s >= 0) return href(TEACHER_ROUTES.board, { lid }, { p: p || 1, s });
  if (query.from === "pick") return href(TEACHER_ROUTES.pick, { lid }, { p: p || undefined });
  return href(TEACHER_ROUTES.prep, { lid });
}

function BoardQ({ lid, qid, query }: { lid: string; qid: string; query: Record<string, string> }) {
  const d = useBoardData(lid, intParam(query.p, 1, 0, 20));
  const [r, setR] = useState(0);
  const full = expandId(lid, qid);
  const q = findQ(d.lesson, full);
  if (d.loading) return <Loading label="문제를 불러오고 있어요…" />;
  if (!d.lesson || !q) return <Missing what="문제" />;
  const stages = qStages(q);
  const m = stages.length - 1;
  const exitHref = backHref(lid, query);
  return (
    <Stage
      inkKey={"q:" + full}
      lessonLabel={lessonLabel(lid, d.lesson)}
      title="문제 크게 보기"
      onNext={() => setR((v) => Math.min(m, v + 1))}
      onPrev={() => setR((v) => Math.max(0, v - 1))}
      onFirst={() => setR(0)}
      onLast={() => setR(m)}
      nextLabel={r < m ? qNextLabel(stages[r + 1]) : "다 열었어요"}
      nextHint={r < m ? r + 1 + " / " + m : undefined}
      canPrev={r > 0}
      exitHref={exitHref}
    >
      <div className="bd-scene kind-problem">
        <div className="bd-scene-inner">
          <BoardQuestion lid={lid} q={q} r={r} onStage={setR} />
        </div>
      </div>
    </Stage>
  );
}

/* ─────────── 체험 도구 크게 ─────────── */

function BoardTool({ lid, wid, query }: { lid: string; wid: string; query: Record<string, string> }) {
  const exitHref = backHref(lid, query);
  const ok = isWidgetId(wid);
  const guide = ok ? guideOf(wid) : undefined;
  const title = ok ? (guide && guide.title ? guide.title : WIDGET_TITLES[wid]) : "체험 도구";
  const back = () => {
    window.location.hash = exitHref;
  };
  return (
    <Stage inkKey={"tool:" + lid + ":" + wid} lessonLabel={lessonLabel(lid)} title={title} onNext={back} onPrev={back} nextLabel="돌아가기" canPrev={true} exitHref={exitHref} noSwipe={true}>
      <div className="bd-scene kind-widget">
        <div className="bd-scene-inner">{ok ? <div className="bd-tool-scene"><WidgetHost id={wid} surface="board" guide={guide} /></div> : <p className="muted">이 체험 도구는 아직 준비 중이에요.</p>}</div>
      </div>
    </Stage>
  );
}

/* ─────────── 수업 끝 ─────────── */

function BoardEnd({ lid, query }: { lid: string; query: Record<string, string> }) {
  const d = useBoardData(lid, intParam(query.p, 1, 0, 20));
  const lastS = useMemo(() => (d.view ? lastOn(d.view.scenes) : 0), [d.view]);
  const finish = useFinish(lid, !d.view || d.view.p === 0 || d.view.p >= d.view.periods.length);
  if (d.loading) return <Loading label="수업 끝 화면을 준비하고 있어요…" />;
  if (!d.lesson || !d.view) return <Missing what="레슨" />;
  const view = d.view;
  const toBoard = () => navigate(fillPath(TEACHER_ROUTES.board, { lid }), { p: view.p, s: Math.max(0, lastS - 1) });
  // 정리 줄: 이 차시 소제목 정리만. 칠판 정리 장면이 '이 레슨 전체 정리'(마지막 차시)면 끝 화면도 같은 제목·줄로 맞춰요
  const whole = view.scenes.some((sc) => sc.kind === "summary" && sc.on && /^이 레슨 전체 정리/.test(sc.title || ""));
  const summary = summaryForPeriod(d.lesson, planOf(lid), view.flow.period, { whole });
  return (
    <Stage
      inkKey={"end:" + lid}
      lessonLabel={lessonLabel(lid, d.lesson)}
      title="수업 끝"
      onNext={finish.run}
      onPrev={toBoard}
      nextLabel={finish.label}
      nextHint={finish.hint}
      nextTone="finish"
      canPrev={true}
      exitHref="#/"
    >
      <div className="bd-scene kind-qr">
        <div className="bd-scene-inner">
          <EndScene lesson={d.lesson} exit={d.exit} hw={d.hw} periodLabel={periodLabel(lid, d.lesson, view.p, view.periods.length)} summary={summary} />
        </div>
      </div>
    </Stage>
  );
}

/* ─────────── 입구 ─────────── */

export default function BoardPage(m: TeacherPageProps) {
  const lid = m.params.lid || "";
  switch (m.name) {
    case "boardQ":
      return <BoardQ key={lid + ":" + m.params.qid} lid={lid} qid={m.params.qid || ""} query={m.query} />;
    case "boardTool":
      return <BoardTool lid={lid} wid={m.params.wid || ""} query={m.query} />;
    case "boardEnd":
      return <BoardEnd lid={lid} query={m.query} />;
    default:
      return <BoardRun lid={lid} query={m.query} />;
  }
}
