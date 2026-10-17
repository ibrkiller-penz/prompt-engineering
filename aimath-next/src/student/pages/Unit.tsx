// 단원(#/u/:n): units.json 배열 순서로 번호를 붙인 레슨 카드(Ⅰ-3) + 단원 마무리 도전(별 1~3, 학력진단 A·B회는 빼요).
// 마무리 도전 풀기는 #/u/:n?test=1 (카드 한 장 = 한 문제, test 값이 몇 번째 문제인지)
import { useEffect } from "react";
import { STUDENT_ROUTES, type Question } from "../../shared/contracts.ts";
import { href, navigate } from "../../shared/router/index.ts";
import { INDEX, unitMeta, useUnit } from "../../content/index.ts";
import { Icon, UnitIcon } from "../../shared/icons/index.ts";
import { ProgressBar, Rich } from "../../shared/ui/index.ts";
import { CardDeck } from "../shell/CardDeck.tsx";
import { Loading, NotFoundBody, Screen, useDocTitle } from "../shell/Shell.tsx";
import { MASTERY_LABEL, countOf, isOk, isTried, lessonPercent, masteryOf, setLast, statusOf, unitStatusOf, useQ, useRead } from "../store/index.ts";
import { QRun } from "./QRun.tsx";
import { cardIndex, challengeStars, shortPrompt, starText } from "./student.logic.ts";

const MASTERY_CHIP = ["", "is-warn", "is-ok", "is-accent"];

export default function UnitPage({ n, query }: { n: string; query: Record<string, string> }) {
  const num = Number(n);
  const u = unitMeta(num);
  const q = useQ();
  const read = useRead();
  useDocTitle(u ? u.roman + ". " + u.title : "단원");
  if (!u) {
    return (
      <Screen title="단원" tab="unit">
        <NotFoundBody />
      </Screen>
    );
  }
  if (query.test) return <UnitTest n={num} at={query.test} />;

  const st = unitStatusOf(num, q, read);
  const t = countOf(u.testIds, q);
  const stars = challengeStars(t);
  const unitHref = href(STUDENT_ROUTES.unit, { n: num });

  return (
    <Screen title={u.roman + ". " + u.title} eyebrow={"단원 " + u.roman} tab="unit" unitHref={unitHref} backTo="/">
      <div className="page stack-lg">
        <nav className="s-unit-tabs" aria-label="단원 고르기">
          {INDEX.units.map((x) => (
            <a key={x.id} className={"chip s-unit-chip" + (x.id === num ? " is-accent" : "")} href={href(STUDENT_ROUTES.unit, { n: x.id })} aria-current={x.id === num ? "page" : undefined}>
              {x.roman}
            </a>
          ))}
        </nav>

        <header className="row nowrap s-unit-head">
          <UnitIcon unit={num} badge size="lg" />
          <div className="grow">
            <p className="h3">{u.short}</p>
            {st ? <ProgressBar value={st.percent} max={100} label={"단원 진행 " + st.percent + "%"} /> : null}
            <p className="tiny muted">
              레슨 {st ? st.done : 0}/{u.lessonIds.length} 완료
            </p>
          </div>
        </header>

        <ol className="s-lessons" aria-label="레슨">
          {u.lessonIds.map((lid) => {
            const m = INDEX.lessons[lid];
            const ls = statusOf(lid, q, read);
            const ms = masteryOf(lid, q, read);
            const p = ls ? lessonPercent(ls) : 0;
            return (
              <li key={lid}>
                <a className="card card-link s-lesson-card" href={href(STUDENT_ROUTES.lesson, { lid })}>
                  <div className="row between nowrap">
                    <span className="eyebrow">{m.code}</span>
                    <span className={"chip " + MASTERY_CHIP[ms]}>
                      {ms >= 2 ? "✓ " : ""}
                      {MASTERY_LABEL[ms]}
                    </span>
                  </div>
                  <strong className="h3 s-lesson-title">{m.title}</strong>
                  <span className="small muted">{m.short}</span>
                  <ProgressBar value={p} max={100} label={m.code + " 진행 " + p + "%"} />
                  <span className="tiny muted">
                    개념 {ls ? ls.sectionsRead : 0}/{m.sections.length} · 기본 문제 {ls ? ls.basic.tried : 0}/{m.basicIds.length} · 약 {m.minutes}분
                  </span>
                </a>
              </li>
            );
          })}
        </ol>

        {u.testIds.length ? (
          <section className="card s-challenge" aria-labelledby="h-chal">
            <div className="row between nowrap">
              <h2 id="h-chal" className="h3">
                단원 마무리 도전
              </h2>
              <span className="s-stars" role="img" aria-label={"별 3개 중 " + stars + "개"}>
                {starText(stars)}
              </span>
            </div>
            <p className="small muted">
              {u.testIds.length}문제 · 풀어 봄 {t.tried} · 맞힘 {t.ok}. 모두 풀고 60% 이상이면 별 하나, 80% 이상이면 둘, 모두 맞히면 셋이에요.
            </p>
            <a className="btn btn-primary btn-block" href={href(STUDENT_ROUTES.unit, { n: num }, { test: firstUntried(u.testIds, q) })}>
              {t.tried ? "이어서 도전하기" : "도전 시작하기"}
            </a>
          </section>
        ) : null}
      </div>
    </Screen>
  );
}

function firstUntried(ids: string[], q: ReturnType<typeof useQ>): number {
  for (let i = 0; i < ids.length; i++) if (!isTried(q[ids[i]])) return i + 1;
  return 1;
}

function UnitTest({ n, at }: { n: number; at: string }) {
  const u = unitMeta(n);
  const { data, error } = useUnit(n);
  const q = useQ();
  const ids = u ? u.testIds : [];
  const total = ids.length + 1; // 마지막 장은 결과
  const i = cardIndex(at, total);
  const to = (k: number) => navigate(STUDENT_ROUTES.unit.replace(":n", String(n)), { test: k + 1 }, { replace: true });
  const back = href(STUDENT_ROUTES.unit, { n });
  const testing = i < ids.length;
  useEffect(() => {
    if (u && testing) setLast("/u/" + n + "?test=" + (i + 1), u.roman + " 단원 마무리 도전");
  }, [n, i, testing, u]);
  if (!u) return null;
  const qs: Question[] = data ? (ids.map((id) => data.test.filter((x) => x.id === id)[0]).filter(Boolean) as Question[]) : [];
  const cur = i < ids.length ? qs[i] : null;
  const t = countOf(ids, q);
  const stars = challengeStars(t);
  return (
    <CardDeck
      cardKey={"t" + i}
      title="단원 마무리 도전"
      eyebrow={u.roman + ". " + u.short}
      backTo={back.slice(1)}
      pos={i < ids.length ? i + 1 + " / " + ids.length + "문제" : "결과"}
      onPrev={i > 0 ? () => to(i - 1) : null}
      onNext={i < total - 1 ? () => to(i + 1) : () => navigate("/u/" + n)}
      nextLabel={i < total - 1 ? "다음" : "단원으로"}
    >
      {!data ? (
        <Loading error={error} />
      ) : cur ? (
        <div className="stack">
          <h2 className="sr-only">
            {i + 1}번째 문제
          </h2>
          <QRun q={cur} label={"도전 " + (i + 1)} />
        </div>
      ) : (
        <div className="stack s-result">
          <h2 className="h2">도전 결과</h2>
          <p className="s-stars s-stars-big" role="img" aria-label={"별 3개 중 " + stars + "개"}>
            {starText(stars)}
          </p>
          <p>
            {ids.length}문제 중 {t.tried}문제를 풀어 보고 {t.ok}문제를 맞혔어요.
          </p>
          {t.tried < ids.length ? <p className="small muted">아직 안 푼 문제가 있어요. 모두 풀어야 별을 받아요.</p> : null}
          <ul className="list card">
            {ids.map((id, k) => (
              <li key={id}>
                <a className="list-row" href={href(STUDENT_ROUTES.unit, { n }, { test: k + 1 })}>
                  <span className="grow">
                    {k + 1}번 {qs[k] ? <Rich text={shortPrompt(qs[k].prompt)} /> : null}
                  </span>
                  {isOk(q[id]) ? <span className="verdict ok">맞힘</span> : isTried(q[id]) ? <span className="verdict bad">다시</span> : <span className="chip">아직</span>}
                </a>
              </li>
            ))}
          </ul>
          <a className="btn" href={href(STUDENT_ROUTES.note)}>
            <Icon name="note" />
            <span>오답노트 보기</span>
          </a>
        </div>
      )}
    </CardDeck>
  );
}
