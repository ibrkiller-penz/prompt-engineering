// 오답노트(#/note?tab=todo|reviewing|graduated): 아직 / 복습 중 / 졸업.
// 틀리거나 풀이를 본 문제가 들어와요. '다시 풀기'는 그 자리에서 풀고, '개념 다시 보기'는 문제가 나온 소제목 카드로 가요.
import { useState } from "react";
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { href } from "../../shared/router/index.ts";
import { INDEX } from "../../content/index.ts";
import { Icon } from "../../shared/icons/index.ts";
import { Rich } from "../../shared/ui/index.ts";
import { Loading, Screen, useDocTitle } from "../shell/Shell.tsx";
import { daysUntil, isUnitTestQ, lessonOfQ, noteList, reviewToday, useQ, type NoteState } from "../store/index.ts";
import { QRun } from "./QRun.tsx";
import { nextReviewText, shortPrompt } from "./student.logic.ts";
import { stripNum } from "./Lesson.tsx";
import { sectionOfQ, useQuestions } from "./useQuestions.ts";

const TABS: { id: NoteState; name: string; desc: string }[] = [
  { id: "todo", name: "아직", desc: "틀렸거나 풀이만 보고 아직 다시 맞히지 못한 문제예요." },
  { id: "reviewing", name: "복습 중", desc: "다시 맞혔어요. 1일·3일·7일 뒤 오늘의 복습에서 또 만나요." },
  { id: "graduated", name: "졸업", desc: "복습에서 세 번 연속 맞혀 졸업한 문제예요." },
];

export default function NotePage({ query }: { query: Record<string, string> }) {
  useDocTitle("오답노트");
  const q = useQ();
  const tab: NoteState = query.tab === "reviewing" || query.tab === "graduated" ? query.tab : "todo";
  const all = noteList(q, (id) => !!lessonOfQ(id) || isUnitTestQ(id));
  const [open, setOpen] = useState<string | null>(null);
  // 펼쳐 푸는 문제는 맞혀서 칸이 바뀌어도 그 자리에 둬요(풀던 화면이 사라지지 않게)
  const items = all.filter((x) => x.state === tab || x.id === open);
  const shown = items.slice(0, 40);
  const { map, loading } = useQuestions(shown.map((x) => x.id));
  const rv = reviewToday();
  const now = Date.now();
  const count = (s: NoteState) => all.filter((x) => x.state === s).length;

  return (
    <Screen title="오답노트" noBack tab="note">
      <div className="page stack">
        <a className={"card card-link row nowrap s-review-cta" + (rv.length ? " card-hero" : "")} href={href(STUDENT_ROUTES.review)}>
          <Icon name="review" />
          <span className="grow">
            <strong>오늘의 복습</strong>
            <span className="tiny muted s-block">{rv.length ? rv.length + "문제가 기다려요(하루 최대 5문제)" : "오늘 복습할 문제가 없어요"}</span>
          </span>
          <Icon name="next" />
        </a>

        <div className="s-seg" role="tablist" aria-label="오답노트 칸">
          {TABS.map((t) => (
            <a key={t.id} role="tab" aria-selected={tab === t.id} className={"s-seg-btn" + (tab === t.id ? " is-on" : "")} href={href(STUDENT_ROUTES.note, {}, { tab: t.id === "todo" ? undefined : t.id })}>
              {t.name} <span className="s-count">{count(t.id)}</span>
            </a>
          ))}
        </div>
        <p className="small muted s-note-tabdesc">{TABS.filter((t) => t.id === tab)[0].desc}</p>
        <p className="tiny muted s-note-tabs-all">아직 = 다시 맞혀야 해요 · 복습 중 = 날짜에 맞춰 다시 풀어요 · 졸업 = 복습에서 세 번 연속 맞히면 돼요</p>

        {!items.length ? (
          <div className="empty">
            <Icon name="note" size="xl" />
            <p>{tab === "todo" ? "'아직' 칸이 비어 있어요. 잘하고 있어요!" : tab === "reviewing" ? "복습 중인 문제가 없어요." : "아직 졸업한 문제가 없어요."}</p>
          </div>
        ) : loading && !Object.keys(map).length ? (
          <Loading />
        ) : (
          <ul className="s-note-list stack tight">
            {shown.map((it) => {
              const f = map[it.id];
              const lid = f && f.lid;
              const sec = lid ? sectionOfQ(lid, it.id) : -1;
              const isOpen = open === it.id;
              const lm = lid ? INDEX.lessons[lid] : null;
              const secTitle = lm && sec >= 0 && lm.sections[sec] ? "개념 " + (sec + 1) + " · " + stripNum(lm.sections[sec].heading) : "";
              return (
                <li key={it.id} className="card s-note">
                  <div className="row between nowrap">
                    <span className="eyebrow">{f ? f.where : it.id}</span>
                    <span className="tiny muted">다시 본 횟수 {it.wrong}</span>
                  </div>
                  {secTitle ? (
                    <p className="small s-note-sec">
                      <Rich text={secTitle} />
                    </p>
                  ) : null}
                  <p className="tiny muted s-note-due">{nextReviewText(it.state, it.due ? daysUntil(it.due, now) : -1)}</p>
                  {f ? (
                    isOpen ? (
                      <QRun q={f.q} showNew={false} />
                    ) : (
                      <p className="s-note-q">
                        <Rich text={shortPrompt(f.q.prompt, 80)} />
                      </p>
                    )
                  ) : f === null ? (
                    <p className="small muted">이 문제를 찾지 못했어요.</p>
                  ) : (
                    <p className="small muted" aria-busy="true">
                      불러오는 중이에요…
                    </p>
                  )}
                  <div className="row wrap">
                    {f ? (
                      <button type="button" className="btn btn-soft" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : it.id)}>
                        {isOpen ? "접기" : "다시 풀기"}
                      </button>
                    ) : null}
                    {lid ? (
                      <a className="btn btn-ghost" href={sec >= 0 ? href(STUDENT_ROUTES.card, { lid, step: "c" + (sec + 1), card: 1 }) : href(STUDENT_ROUTES.lesson, { lid })}>
                        <Icon name="book" />
                        <span>개념 다시 보기{sec >= 0 ? " (개념 " + (sec + 1) + ")" : ""}</span>
                      </a>
                    ) : f ? (
                      <a className="btn btn-ghost" href={href(STUDENT_ROUTES.unit, { n: f.unit })}>
                        {(INDEX.units.filter((u) => u.id === f.unit)[0] || { roman: "" }).roman} 단원 보기
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {items.length > shown.length ? <p className="small muted center">최근 {shown.length}문제만 보여요.</p> : null}
      </div>
    </Screen>
  );
}
