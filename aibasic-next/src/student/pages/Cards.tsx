// 카드 넘기기(#/l/:lid/s/:step/:card). 단계와 카드 만들기는 deck.logic.ts.
//   story  문단 1개 = 1장(말풍선·등장인물 칩) + '오늘의 핵심 질문 · 내 생각 한 줄'
//   prereq 안내 + 항목마다 '알아요/헷갈려요'
//   cN     splitSection 으로 나눈 개념 카드(체험 도구 카드 포함) + 소제목 끝 확인 문제
//   wrap   정리 · 돌아보기 · 다음으로
// 위치는 카드가 바뀔 때마다 저장하고(이어서 공부하기), 소제목 끝을 지나가면 기록해요(확인 문제까지 풀면 '읽음').
import { useEffect, useMemo, useState } from "react";
import { STUDENT_ROUTES, type Lesson, type LessonStep, type WidgetEvent } from "../../shared/contracts.ts";
import { href, navigate } from "../../shared/router/index.ts";
import { INDEX, lessonMeta, useLesson } from "../../content/index.ts";
import { Icon } from "../../shared/icons/index.ts";
import { Avatar, Blocks, Rich, SpeakButton, TermView, characterOf } from "../../shared/ui/index.ts";
import { isWidgetId } from "../../shared/widgets/ids.ts";
import type { StorySeg } from "../../shared/logic/splitStory.ts";
import { CardDeck } from "../shell/CardDeck.tsx";
import { Loading, NotFoundBody, ProgressRail, Screen, useDocTitle } from "../shell/Shell.tsx";
import {
  THINK_MAX,
  isTried,
  passSectionEnd,
  sectionChecks,
  setLast,
  setPos,
  setPrereq,
  setSelf,
  setThink,
  setToolDone,
  statusOf,
  toggleProjStep,
  usePrereq,
  useProj,
  useQ,
  useSelf,
  useThink,
  type SelfLevel,
} from "../store/index.ts";
import { QRun } from "./QRun.tsx";
import { buildDeck, deckTitle, flatIndex, locate, nextPos, passedSectionOnArrive, passedSectionOnLeave, prevPos, storyCount, type DeckCard, type DeckPos } from "./deck.logic.ts";
import { stripNum } from "./Lesson.tsx";

export default function CardsPage({ lid, step, card }: { lid: string; step: string; card: string }) {
  const meta = lessonMeta(lid);
  const { data, error } = useLesson(meta ? lid : null);
  const steps = useMemo(() => (data ? buildDeck(data, sectionChecks(lid) as string[][]) : null), [data, lid]);
  const pos = steps ? locate(steps, step, card) : null;
  const qm = useQ();
  useDocTitle(meta ? meta.code + " " + meta.title : "레슨");

  // 없는 단계·카드 번호면 맞는 주소로 바꿔요
  useEffect(() => {
    if (!steps) return;
    if (!pos) navigate("/l/" + lid + "/s/" + steps[0].id + "/1", undefined, { replace: true });
    else if (String(pos.c + 1) !== card) navigate("/l/" + lid + "/s/" + steps[pos.s].id + "/" + (pos.c + 1), undefined, { replace: true });
  }, [steps, pos && pos.s, pos && pos.c, lid, card]); // eslint-disable-line react-hooks/exhaustive-deps

  // 위치 저장 · 이어서 공부하기 · 확인 카드에 닿으면 소제목 끝을 지나감
  useEffect(() => {
    if (!steps || !pos || !meta) return;
    const st = steps[pos.s];
    const c = st.cards[pos.c];
    setPos(lid, st.id as LessonStep, pos.c + 1);
    setLast("/l/" + lid + "/s/" + st.id + "/" + (pos.c + 1), meta.code + " " + meta.title + " · " + st.label);
    const sec = passedSectionOnArrive(c);
    if (sec !== null) passSectionEnd(lid, sec);
  }, [steps, pos && pos.s, pos && pos.c, lid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) {
    return (
      <Screen title="레슨" noTabs>
        <NotFoundBody />
      </Screen>
    );
  }
  const overview = "/l/" + lid;
  if (!data || !steps || !pos) {
    return (
      <Screen title="레슨" code={meta.code} noTabs backTo={overview}>
        <div className="page">
          <Loading error={error} />
        </div>
      </Screen>
    );
  }

  const go = (p: DeckPos) => navigate("/l/" + lid + "/s/" + steps[p.s].id + "/" + (p.c + 1), undefined, { replace: true });
  const prev = prevPos(steps, pos);
  const next = nextPos(steps, pos);
  const st = steps[pos.s];
  const c = st.cards[pos.c];
  const onNext = () => {
    const sec = passedSectionOnLeave(steps, pos);
    if (sec !== null) passSectionEnd(lid, sec);
    if (next) go(next);
    else navigate("/l/" + lid + "/q");
  };
  const fi = flatIndex(steps, pos);
  const sc = storyCount(steps, pos);
  const headTitle = deckTitle(st, data.sections.map((x) => x.heading));
  const rail = <ProgressRail steps={steps.map((s) => ({ id: s.id, label: s.label, cards: s.cards.length }))} at={pos.s} card={pos.c} />;

  return (
    <CardDeck
      cardKey={st.id + "/" + pos.c}
      title={<span title={headTitle}>{st.label}</span>}
      code={meta.code}
      backTo={overview}
      rail={rail}
      pos={
        <span>
          <strong>{st.kind === "prereq" ? "먼저 알기" : st.label}</strong> {pos.c + 1}/{st.cards.length}
          <span className="sr-only">
            , 전체 {fi.total}장 중 {fi.i + 1}번째
          </span>
        </span>
      }
      onPrev={prev ? () => go(prev) : null}
      onNext={onNext}
      nextLabel={next ? "다음" : "문제 풀기"}
      nextSoft={c.k === "check" && c.qids.some((id) => !isTried(qm[id]))}
      skip={
        st.kind === "story" && pos.c < st.cards.length - 1
          ? { label: "여기까지 읽음 · 건너뛰기", onClick: () => go({ s: pos.s, c: st.cards.length - 1 }) }
          : null
      }
    >
      <CardBody lesson={data} lid={lid} card={c} story={sc} />
    </CardDeck>
  );
}

function CardBody({ lesson, lid, card, story }: { lesson: Lesson; lid: string; card: DeckCard; story: { n: number; total: number } | null }) {
  switch (card.k) {
    case "story":
      // 위 칩(n/total)은 아래 진행 막대와 같은 값(이 단계의 카드 수)을 써요
      return <StoryCard segs={card.segs} raw={lesson.story[card.idx] || ""} n={story ? story.n : card.idx + 1} total={story ? story.total : lesson.story.length} />;
    case "think":
      return <ThinkCard lid={lid} question={lesson.question} n={story ? story.n : 0} total={story ? story.total : 0} />;
    case "prereq-intro":
      return (
        <article className="stack">
          <p className="eyebrow">먼저 알고 가요</p>
          <h2 className="h2">{card.title}</h2>
          {card.intro ? (
            <p>
              <Rich text={card.intro} />
            </p>
          ) : null}
          <p className="small muted">항목 {card.count}개를 한 장씩 넘기며 '알아요' 또는 '헷갈려요'를 골라요. 고른 것은 이 기기에만 남아요.</p>
          <ul className="s-prereq-list">
            {(lesson.prereq ? lesson.prereq.items : []).map((it, i) => (
              <li key={i}>
                <Rich text={it.term} />
              </li>
            ))}
          </ul>
        </article>
      );
    case "prereq":
      return <PrereqCard lid={lid} term={card.term} text={card.text} i={card.i} total={lesson.prereq ? lesson.prereq.items.length : 0} />;
    case "blocks":
      return <ConceptCard lesson={lesson} lid={lid} card={card} />;
    case "check":
      return <CheckCard lesson={lesson} qids={card.qids} sec={card.sec} />;
    case "summary":
      return (
        <article className="stack">
          <p className="eyebrow">정리</p>
          <h2 className="h2">오늘 배운 것</h2>
          <ol className="s-summary">
            {lesson.summary.map((s, i) => (
              <li key={i}>
                <Rich text={s} />
              </li>
            ))}
          </ol>
          <SpeakButton text={lesson.summary.join(" ")} />
        </article>
      );
    case "reflect":
      return <ReflectCard lesson={lesson} lid={lid} />;
    case "next":
      return <NextCard lesson={lesson} lid={lid} />;
    default:
      return null;
  }
}

/* ─────────── 이야기 ─────────── */

function StoryCard({ segs, raw, n, total }: { segs: StorySeg[]; raw: string; n: number; total: number }) {
  // 등장인물 이름은 말풍선 위에 한 번만 보여요(위쪽 인물 칩은 두지 않아요)
  return (
    <article className="stack s-story">
      <p className="eyebrow">
        이야기 {n}/{total}
      </p>
      <h2 className="sr-only">이야기 {n}번째 장면</h2>
      <div className="stack s-story-body">
        {segs.map((s, i) =>
          s.k === "narr" ? (
            s.text ? (
              <p key={i} className="s-narr">
                <Rich text={s.text} />
              </p>
            ) : null
          ) : (
            <div key={i} className="ui-bubble-row s-say">
              {s.who ? <Avatar who={s.who} /> : <span className="ui-avatar s-avatar-none" aria-hidden="true" />}
              <div className="ui-bubble-col">
                <span className="speaker ui-speaker">{s.who ? characterOf(s.who).name : "누군가"}</span>
                <div className="bubble ui-bubble">
                  <Rich text={s.text} />
                </div>
              </div>
            </div>
          ),
        )}
      </div>
      <SpeakButton text={raw} label="이야기 읽어 주기" />
    </article>
  );
}

function ThinkCard({ lid, question, n, total }: { lid: string; question: string; n: number; total: number }) {
  const think = useThink();
  const saved = (think[lid] && think[lid].story) || "";
  const [text, setText] = useState(saved);
  const [msg, setMsg] = useState("");
  useEffect(() => setText(saved), [saved]);
  const save = () => {
    setThink(lid, "story", text);
    setMsg(text.trim() ? "저장했어요. 레슨 끝에서 다시 볼 수 있어요." : "");
  };
  return (
    <article className="stack">
      <p className="eyebrow">{total ? "이야기 " + n + "/" + total : "이야기"}</p>
      <div className="why-card s-why">
        <span className="why-label">오늘의 핵심 질문</span>
        <h2 className="s-core-q">
          <Rich text={question} />
        </h2>
      </div>
      <div className="field">
        <label htmlFor="s-think">내 생각 한 줄</label>
        <input
          id="s-think"
          className="input"
          type="text"
          maxLength={Math.min(200, THINK_MAX)}
          placeholder="정답이 아니어도 괜찮아요. 떠오르는 대로 적어요."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
        />
      </div>
      <div className="row">
        <button type="button" className="btn btn-soft" onClick={save}>
          적어 두기
        </button>
        <span className="small muted" role="status">
          {msg}
        </span>
      </div>
      <p className="tiny muted">적은 글은 이 기기에만 남아요. 이름이나 연락처는 적지 말아요.</p>
    </article>
  );
}

/* ─────────── 먼저 알고 가요 ─────────── */

function PrereqCard({ lid, term, text, i, total }: { lid: string; term: string; text: string; i: number; total: number }) {
  const pre = usePrereq();
  const v = pre[lid] ? pre[lid][term] : undefined;
  return (
    <article className="stack">
      <p className="eyebrow">
        먼저 알고 가요 {i + 1}/{total}
      </p>
      <h2 className="h2">
        <Rich text={term} />
      </h2>
      <div className="prose">
        <p>
          <Rich text={text} />
        </p>
      </div>
      <SpeakButton text={term + ". " + text} />
      <div className="row s-know" role="group" aria-label="이 내용을 알고 있나요?">
        <button type="button" className="btn grow" aria-pressed={v === "know"} onClick={() => setPrereq(lid, term, "know")}>
          {v === "know" ? "✓ " : ""}알아요
        </button>
        <button type="button" className="btn grow" aria-pressed={v === "unsure"} onClick={() => setPrereq(lid, term, "unsure")}>
          {v === "unsure" ? "✓ " : ""}헷갈려요
        </button>
      </div>
      {v === "unsure" ? <p className="callout tip small">괜찮아요. 개념 카드에서 다시 만나요. 위 예를 한 번 더 천천히 따라 해 봐요.</p> : null}
      {v === "know" ? <p className="small muted">좋아요! 다음 장으로 넘어가요.</p> : null}
    </article>
  );
}

/* ─────────── 개념 ─────────── */

function ConceptCard({ lesson, lid, card }: { lesson: Lesson; lid: string; card: Extract<DeckCard, { k: "blocks" }> }) {
  const sec = lesson.sections[card.sec];
  if (!sec) return null;
  const blocks = card.idx.map((i) => sec.blocks[i]);
  const onWidgetEvent = (id: string, e: WidgetEvent) => {
    if (e.type === "mission" && e.ok && isWidgetId(id)) setToolDone(id);
  };
  const body = <Blocks blocks={blocks} idx={card.idx} basePath={"sections." + card.sec + ".blocks"} where={lid} surface="phone" onWidgetEvent={onWidgetEvent} />;
  return (
    <article className={"stack s-concept is-" + card.kind}>
      {card.first ? (
        <>
          <p className="eyebrow">개념 {card.sec + 1}</p>
          <h2 className="h2">
            <Rich text={stripNum(sec.heading)} />
          </h2>
        </>
      ) : (
        <div className="eyebrow s-cont">
          <h2 className="sr-only">개념 {card.sec + 1} 이어서</h2>
          개념 {card.sec + 1} · <Rich text={stripNum(sec.heading)} />
        </div>
      )}
      {card.kind === "widget" ? (
        <div data-noswipe="" className="s-widget-card">
          <p className="chip is-accent">체험 카드 · 손으로 움직여 봐요</p>
          {body}
        </div>
      ) : (
        body
      )}
      {card.last ? <p className="tiny muted s-sec-end">이 소제목의 마지막 카드예요.</p> : null}
    </article>
  );
}

function CheckCard({ lesson, qids, sec }: { lesson: Lesson; qids: string[]; sec: number }) {
  const q = useQ();
  const list = qids.map((id) => lesson.practice.filter((x) => x.id === id)[0]).filter(Boolean);
  const tried = qids.filter((id) => isTried(q[id])).length;
  return (
    <article className="stack">
      <p className="eyebrow">개념 {sec + 1} · 끝 확인</p>
      <h2 className="h2">확인 문제</h2>
      <p className="small muted">
        {tried >= qids.length ? "✓ 확인 문제를 풀어 봤어요. 이 소제목은 '읽음'이에요." : "풀어 보면 이 소제목이 '읽음'이 돼요. 틀려도 괜찮아요."}
      </p>
      {list.map((qq, i) => (
        <QRun key={qq.id} q={qq} label={list.length > 1 ? "확인 " + (i + 1) : "끝 확인"} />
      ))}
    </article>
  );
}

/* ─────────── 정리 ─────────── */

const SELF: { v: SelfLevel; t: string }[] = [
  { v: 1, t: "아직 어려워요" },
  { v: 2, t: "조금 알겠어요" },
  { v: 3, t: "친구에게 설명할 수 있어요" },
];

function ReflectCard({ lesson, lid }: { lesson: Lesson; lid: string }) {
  const self = useSelf();
  const think = useThink();
  const cur = self[lid] ? self[lid].level : 0;
  const mine = think[lid] && think[lid].story;
  return (
    <article className="stack">
      <p className="eyebrow">돌아보기</p>
      <h2 className="h2">핵심 질문에 답할 수 있나요?</h2>
      <div className="why-card s-why">
        <span className="why-label">오늘의 핵심 질문</span>
        <p className="s-core-q">
          <Rich text={lesson.question} />
        </p>
      </div>
      {mine ? (
        <p className="small">
          처음에 적은 내 생각: <q>{mine}</q>
        </p>
      ) : null}
      <fieldset className="s-self">
        <legend className="h3">지금 얼마나 알겠어요?</legend>
        {SELF.map((o) => (
          <button key={o.v} type="button" className="opt" aria-pressed={cur === o.v} onClick={() => setSelf(lid, o.v)}>
            <span className="key" aria-hidden="true">
              {o.v}
            </span>
            <span className="txt">{o.t}</span>
            {cur === o.v ? <span className="mark">✓</span> : null}
          </button>
        ))}
      </fieldset>
      {cur === 1 ? <p className="small">괜찮아요. 오답노트와 '개념 다시 보기'로 한 번 더 만나면 훨씬 쉬워져요.</p> : null}
      {lesson.terms && lesson.terms.length ? (
        <details className="s-terms">
          <summary className="btn btn-ghost">오늘의 용어 {lesson.terms.length}개 보기</summary>
          <div className="stack tight">
            {lesson.terms.map((t, i) => (
              <TermView key={i} term={t.term} def={t.def} surface="phone" />
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

function NextCard({ lesson, lid }: { lesson: Lesson; lid: string }) {
  const q = useQ();
  const proj = useProj();
  const meta = INDEX.lessons[lid];
  const st = statusOf(lid, q);
  const pj = proj[lid];
  const projSteps = lesson.project ? lesson.project.steps.length : 0;
  return (
    <article className="stack">
      <p className="eyebrow">다음으로</p>
      <h2 className="h2">이제 문제로 다져요</h2>
      <a className="btn btn-primary btn-block" href={href(STUDENT_ROUTES.quiz, { lid })}>
        <Icon name="question" />
        <span>계단 문제 풀기</span>
      </a>
      {st && !st.complete ? (
        <p className="small muted">
          완료까지: 읽음 {st.sectionsRead}/{st.sectionsTotal} · 기본 문제 풀어 봄 {st.basic.tried}/{st.basic.total} · 맞힘 {st.basic.done}개(완료에 {st.need}개 필요)
        </p>
      ) : st && st.complete ? (
        <p className="verdict ok">이 레슨을 완료했어요!</p>
      ) : null}

      {lesson.aiStory && lesson.aiStory.paragraphs && lesson.aiStory.paragraphs.length ? (
        <details className="card s-more">
          <summary className="h3">AI 이야기 · {lesson.aiStory.title}</summary>
          <div className="prose stack tight">
            {lesson.aiStory.paragraphs.map((p, i) => (
              <p key={i}>
                <Rich text={p} />
              </p>
            ))}
          </div>
        </details>
      ) : null}

      {lesson.project && lesson.project.steps && lesson.project.steps.length ? (
        <details className="card s-more">
          <summary className="h3">프로젝트 · {lesson.project.title}</summary>
          <div className="stack tight">
            <p>
              <Rich text={lesson.project.goal} />
            </p>
            {lesson.project.materials && lesson.project.materials.length ? (
              <p className="small muted">준비물: {lesson.project.materials.join(", ")}</p>
            ) : null}
            <ol className="s-proj">
              {lesson.project.steps.map((s, i) => {
                const on = !!pj && pj.steps.indexOf(i) >= 0;
                return (
                  <li key={i}>
                    <label className="switch">
                      <input type="checkbox" checked={on} onChange={() => toggleProjStep(lid, i, projSteps)} />
                      <span>
                        <Rich text={s} />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>
            {pj && pj.done ? <p className="verdict ok">프로젝트 단계를 모두 해냈어요!</p> : null}
          </div>
        </details>
      ) : null}

      <nav className="row between">
        <a className="btn btn-ghost" href={href(STUDENT_ROUTES.lesson, { lid })}>
          레슨 처음 화면
        </a>
        {meta.next ? (
          <a className="btn" href={href(STUDENT_ROUTES.lesson, { lid: meta.next })}>
            <span>다음 레슨 {INDEX.lessons[meta.next].code}</span>
            <Icon name="next" />
          </a>
        ) : null}
      </nav>
    </article>
  );
}
