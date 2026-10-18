// 학생 홈(#/): '이어서 공부하기' 큰 카드 · 오늘 할 일 3줄 · 단원 진행 막대와 배지
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { href } from "../../shared/router/index.ts";
import { INDEX } from "../../content/index.ts";
import { Icon, UnitIcon } from "../../shared/icons/index.ts";
import { ProgressBar } from "../../shared/ui/index.ts";
import { PageHead, Screen, useDocTitle } from "../shell/Shell.tsx";
import {
  UNIT_BADGE_LABEL,
  isTried,
  noteList,
  overall,
  reviewToday,
  statusOf,
  unitStatusOf,
  useAssigned,
  useLast,
  useQ,
  useRead,
  useRvDay,
  lessonOfQ,
} from "../store/index.ts";
import { lessonOfPath, nextLessonAfter } from "./student.logic.ts";

function isComplete(lid: string): boolean {
  const st = statusOf(lid);
  return !st || st.complete;
}

export default function Home() {
  useDocTitle("");
  const q = useQ();
  const read = useRead();
  const last = useLast();
  const assigned = useAssigned();
  useRvDay();
  const sum = overall(INDEX.lessons, INDEX.order, q, read);
  // '이어서 공부하기'와 '다음 레슨'은 같은 기록(마지막으로 본 곳)에서 계산해요
  const lastLid = last && last.path ? lessonOfPath(last.path) : null;
  let cont: { to: string; title: string; sub: string };
  let contLid: string | null = null;
  if (last && last.path && !(lastLid && isComplete(lastLid) && nextLessonAfter(INDEX.order, lastLid, isComplete))) {
    cont = { to: "#" + last.path, title: last.title, sub: "보던 곳에서 이어서 해요." };
    contLid = lastLid;
  } else {
    // 기록이 없거나, 마지막으로 본 레슨을 이미 마쳤으면 그다음 레슨으로
    contLid = nextLessonAfter(INDEX.order, lastLid, isComplete);
    const cm = contLid ? INDEX.lessons[contLid] : null;
    if (cm) cont = { to: href(STUDENT_ROUTES.lesson, { lid: cm.id }), title: cm.code + " " + cm.title, sub: lastLid ? INDEX.lessons[lastLid].code + " 레슨을 마쳤어요. 다음 레슨으로 가요." : "첫 레슨부터 카드 한 장씩 시작해요." };
    else cont = { to: href(STUDENT_ROUTES.me), title: "모든 레슨을 마쳤어요!", sub: "오답노트와 오늘의 복습으로 실력을 다져요." };
  }
  const nextLid = contLid ? nextLessonAfter(INDEX.order, contLid, isComplete) : nextLessonAfter(INDEX.order, null, isComplete);
  const nextMeta = nextLid ? INDEX.lessons[nextLid] : null;

  // 오늘 할 일 3줄
  const rv = reviewToday();
  let hwRow: { to: string; text: string; icon: "flag" | "note" } | null = null;
  let newest = 0;
  for (const lid of Object.keys(assigned)) {
    const a = assigned[lid];
    if (!INDEX.lessons[lid] || a.ts <= newest) continue;
    const left = a.hw.filter((id) => !isTried(q[id])).length;
    if (left > 0) {
      newest = a.ts;
      hwRow = { to: href(STUDENT_ROUTES.quiz, { lid }, { set: "hw" }), text: "선생님이 고른 복습 " + left + "문제 (" + INDEX.lessons[lid].code + ")", icon: "flag" };
    }
  }
  if (!hwRow) {
    const todo = noteList(q, (id) => !!lessonOfQ(id)).filter((x) => x.state === "todo").length;
    hwRow = { to: href(STUDENT_ROUTES.note), text: todo ? "다시 볼 문제 " + todo + "개" : "다시 볼 문제가 없어요", icon: "note" };
  }
  // 오늘 5문제만 풀기: 복습이 있으면 복습으로, 없으면 이어서 하는 곳으로
  const quick = rv.length
    ? { to: href(STUDENT_ROUTES.review), text: "오늘 " + Math.min(5, rv.length) + "문제만 풀기", icon: "review" as const, done: false }
    : { to: cont.to, text: "오늘 5문제만 풀기 — 이어서 해요", icon: "next" as const, done: false };
  const rows = [
    quick,
    { to: href(STUDENT_ROUTES.review), text: rv.length ? "오늘의 복습 " + rv.length + "문제" : "오늘의 복습은 다 했어요", icon: "review" as const, done: !rv.length },
    { ...hwRow, done: false },
    nextMeta
      ? { to: href(STUDENT_ROUTES.lesson, { lid: nextMeta.id }), text: "다음 레슨: " + nextMeta.code + " " + nextMeta.title, icon: "book" as const, done: false }
      : contLid && !isComplete(contLid)
        ? { to: cont.to, text: "이 레슨만 마치면 모든 레슨 완료예요", icon: "book" as const, done: false }
        : { to: href(STUDENT_ROUTES.me), text: "모든 레슨 완료! 내 기록을 확인해요", icon: "badge" as const, done: true },
  ];

  return (
    <Screen title="인공지능 수학" noBack tab="home">
      <div className="page s-home">
        <PageHead eyebrow="오늘의 공부" title="인공지능 수학" sub="카드를 한 장씩 넘기며 차근차근 배워요." />

        <a className="card card-link s-continue" href={cont.to}>
          <span className="s-continue-tag">이어서 하기</span>
          <strong className="s-continue-title">{cont.title}</strong>
          <span className="s-continue-sub">{cont.sub}</span>
          <span className="s-continue-prog">
            <ProgressBar value={sum.complete} max={sum.lessons || 1} label={"전체 레슨 " + sum.lessons + "개 중 " + sum.complete + "개 완료"} />
            <span className="s-continue-txt">
              레슨 {sum.complete}/{sum.lessons} 완료
            </span>
          </span>
          <span className="btn btn-primary btn-block s-continue-go">
            <span>이어서 하기</span>
            <Icon name="next" />
          </span>
        </a>

        <section className="s-sec" aria-labelledby="h-today">
          <h2 id="h-today" className="s-sec-title">
            오늘 할 일
          </h2>
          <ol className="list s-today">
            {rows.map((r, i) => (
              <li key={i}>
                <a className="list-row s-today-row" href={r.to}>
                  <span className={"num-chip" + (r.done ? " is-done" : "")} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="grow">{r.text}</span>
                  {r.done ? <span className="verdict ok small">끝</span> : <Icon name="next" />}
                </a>
              </li>
            ))}
          </ol>
        </section>

        <section className="s-sec" aria-labelledby="h-units">
          <h2 id="h-units" className="s-sec-title">
            단원
          </h2>
          <p className="s-sec-sub">
            레슨 {sum.lessons}개 중 {sum.complete}개 완료 · 맞힌 문제 {sum.ok}개
          </p>
          <ul className="s-ucards">
            {INDEX.units.map((u) => {
              const st = unitStatusOf(u.id, q, read);
              return (
                <li key={u.id} data-unit={u.slug}>
                  <a className="card card-link s-ucard" href={href(STUDENT_ROUTES.unit, { n: u.id })}>
                    <UnitIcon unit={u.id} badge />
                    <span className="grow s-ucard-body">
                      <span className="s-ucard-top">
                        <span className="num-chip">{u.roman}</span>
                        {st && st.badge ? (
                          <span className={"chip " + (st.badge === "star" ? "is-accent" : "is-ok")}>
                            <Icon name="badge" />
                            <span>{UNIT_BADGE_LABEL[st.badge]}</span>
                          </span>
                        ) : null}
                      </span>
                      <strong className="s-ucard-name">{u.title}</strong>
                      <ProgressBar value={st ? st.percent : 0} max={100} label={u.roman + " 단원 진행 " + (st ? st.percent : 0) + "%"} />
                      <span className="s-ucard-sub">
                        레슨 {st ? st.done : 0}/{u.lessonIds.length} 완료
                      </span>
                    </span>
                    <Icon name="next" />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="small center s-foot">
          <a href={href(STUDENT_ROUTES.answerCard)}>수업 중 응답 카드 열기</a>
        </p>
      </div>
    </Screen>
  );
}
