// 계단 문제(#/l/:lid/q · #/l/:lid/q/more). 1장 = 1문제, 힌트 1 → 힌트 2 → 풀이를 차례로 열어요.
//   기본: data/plan.json 의 corePath(기본 길)
//   more: 기본 길 밖의 나머지 문제. 문제가 많아서(레슨당 36~50개) 먼저 '계단별' 고르기 화면을 보여 주고, ?g=번호 로 그 계단 문제만 풀어요
//   ?set=hw  선생님이 고른 복습(QR 로 받은 숙제) · ?set=ex  수업 끝 확인
//   ?n=3     몇 번째 문제(1부터)
import { useEffect, useRef } from "react";
import { STUDENT_ROUTES, type Question } from "../../shared/contracts.ts";
import { href, navigate } from "../../shared/router/index.ts";
import { lessonMeta, useLesson } from "../../content/index.ts";
import { Icon } from "../../shared/icons/index.ts";
import { Rich } from "../../shared/ui/index.ts";
import { CardDeck } from "../shell/CardDeck.tsx";
import { Loading, NotFoundBody, Screen, useDocTitle } from "../shell/Shell.tsx";
import { corePath, countOf, isOk, isTried, setLast, statusOf, useAssigned, useQ } from "../store/index.ts";
import { QRun } from "./QRun.tsx";
import { cardIndex, gainLine, resultLine, shortPrompt, solvedToday } from "./student.logic.ts";

type QSet = "core" | "more" | "hw" | "ex";

const SET_NAME: Record<QSet, string> = { core: "계단 문제", more: "더 풀기", hw: "선생님이 고른 복습", ex: "수업 끝 확인" };

/** 문제를 group 이름(계단 확인 1계단 … 마무리 퀴즈)으로 묶어요(나온 순서) */
function groupsOf(qs: readonly Question[]): { name: string; ids: string[] }[] {
  const out: { name: string; ids: string[] }[] = [];
  for (const q of qs) {
    const name = (q.group || "문제").split(" · ")[0];
    let g = out.filter((x) => x.name === name)[0];
    if (!g) out.push((g = { name, ids: [] }));
    g.ids.push(q.id);
  }
  return out;
}

export default function QuizPage({ lid, more, query }: { lid: string; more: boolean; query: Record<string, string> }) {
  const meta = lessonMeta(lid);
  const { data, error } = useLesson(meta ? lid : null);
  const qm = useQ();
  const assigned = useAssigned();
  const gNo = more && /^\d+$/.test(query.g || "") ? parseInt(query.g, 10) : 0;
  const set: QSet = more ? "more" : query.set === "hw" || query.set === "ex" ? query.set : "core";
  useDocTitle(meta ? meta.code + " " + SET_NAME[set] : "문제");

  let ids: string[] = [];
  if (meta) {
    if (set === "core") {
      ids = corePath(lid);
      if (!ids.length) ids = meta.basicIds.slice();
    } else if (set === "more") {
      const core = corePath(lid);
      ids = meta.qids.filter((id) => core.indexOf(id) < 0);
      if (data && gNo > 0) {
        const gs = groupsOf(data.practice);
        const g = gs[gNo - 1];
        ids = g ? ids.filter((id) => g.ids.indexOf(id) >= 0) : [];
      }
    } else {
      const a = assigned[lid];
      ids = a ? a[set].slice() : [];
    }
  }
  // 이 세트를 열 때 이미 맞힌 개수(결과에서 '지난번보다'를 말하는 기준 — 새 저장 없이 이 화면에서만 들고 있어요)
  const before = useRef<{ key: string; ok: number; tried: number } | null>(null);
  const setKey = lid + "|" + set;
  if (!before.current || before.current.key !== setKey) before.current = { key: setKey, ok: countOf(ids, qm).ok, tried: countOf(ids, qm).tried };
  const total = ids.length + 1; // 마지막 장은 결과
  const i = cardIndex(query.n, total);
  const basePath = "/l/" + lid + "/q" + (more ? "/more" : "");
  const extra: Record<string, string | number> = set === "hw" || set === "ex" ? { set } : gNo > 0 ? { g: gNo } : {};
  const go = (k: number) => navigate(basePath, { ...extra, n: k + 1 }, { replace: true });

  useEffect(() => {
    if (meta && i < ids.length) setLast(basePath + "?" + (set === "hw" || set === "ex" ? "set=" + set + "&" : gNo > 0 ? "g=" + gNo + "&" : "") + "n=" + (i + 1), meta.code + " " + meta.title + " · " + SET_NAME[set]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lid, set, i, ids.length]);

  if (!meta) {
    return (
      <Screen title="문제" noTabs>
        <NotFoundBody />
      </Screen>
    );
  }
  const overview = "/l/" + lid;
  if (!data) {
    return (
      <Screen title={SET_NAME[set]} code={meta.code} noTabs backTo={overview}>
        <div className="page">
          <Loading error={error} />
        </div>
      </Screen>
    );
  }
  const byId: Record<string, Question> = {};
  for (const x of data.practice) byId[x.id] = x;
  const list = ids.map((id) => byId[id]).filter(Boolean);
  const cur = i < list.length ? list[i] : null;
  const c = countOf(ids, qm);
  const st = statusOf(lid, qm);

  // 더 풀기: 계단별 고르기
  if (set === "more" && gNo === 0) {
    const core = corePath(lid);
    const gs = groupsOf(data.practice);
    return (
      <Screen title="더 풀기" code={meta.code} noTabs backTo={"/l/" + lid + "/q"}>
        <div className="page stack">
          <h2 className="h2">계단별로 골라 풀어요</h2>
          <p className="small muted">한 번에 한 계단씩 풀어요. 기본 길에서 푼 문제는 빼고 보여 줘요.</p>
          <ul className="list card">
            {gs.map((g, k) => {
              const rest = g.ids.filter((id) => core.indexOf(id) < 0);
              const ok = rest.filter((id) => isOk(qm[id])).length;
              return (
                <li key={g.name}>
                  {rest.length ? (
                    <a className="list-row" href={href(STUDENT_ROUTES.quizMore, { lid }, { g: k + 1 })}>
                      <span className="grow">{g.name}</span>
                      <span className="chip">
                        {ok}/{rest.length} 맞힘
                      </span>
                    </a>
                  ) : (
                    <span className="list-row muted">
                      <span className="grow">{g.name}</span>
                      <span className="chip">기본 길에서 다 풀어요</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Screen>
    );
  }

  if (!list.length) {
    return (
      <Screen title={SET_NAME[set]} code={meta.code} noTabs backTo={overview}>
        <div className="page empty">
          <p>{set === "hw" || set === "ex" ? "선생님이 고른 문제가 아직 없어요. 수업 끝에 선생님이 보여 주는 QR로 들어오면 여기에 생겨요." : "풀 문제가 없어요."}</p>
          <a className="btn btn-primary" href={href(STUDENT_ROUTES.quiz, { lid })}>
            계단 문제로 가기
          </a>
        </div>
      </Screen>
    );
  }

  const dots = (
    <div className="s-qdots" aria-hidden="true">
      {list.map((x, k) => (
        <i key={x.id} className={(k === i ? "now " : "") + (isOk(qm[x.id]) ? "ok" : isTried(qm[x.id]) ? "tried" : "")} />
      ))}
    </div>
  );

  return (
    <CardDeck
      cardKey={set + i}
      title={SET_NAME[set]}
      code={meta.code}
      backTo={overview}
      rail={dots}
      pos={cur ? i + 1 + " / " + list.length + "문제" : "결과"}
      onPrev={i > 0 ? () => go(i - 1) : null}
      onNext={i < total - 1 ? () => go(i + 1) : () => navigate(overview)}
      nextLabel={i < list.length - 1 ? "다음 문제" : i === list.length - 1 ? "결과 보기" : "레슨으로"}
      nextSoft={!!cur && !isTried(qm[cur.id])}
    >
      {cur ? (
        <div className="stack">
          <h2 className="sr-only">
            {SET_NAME[set]} {i + 1}번째
          </h2>
          {set === "ex" && i === 0 ? <p className="callout info small">오늘 수업 끝 확인이에요. 배운 것을 떠올리며 풀어 봐요.</p> : null}
          <QRun
            q={cur}
            label={i + 1 + " / " + list.length}
          />
        </div>
      ) : (
        <div className="stack s-result">
          <h2 className="h2">{SET_NAME[set]} 결과</h2>
          <p className="h3 s-result-line">
            <strong>{resultLine(list.length, c.ok)}</strong>
          </p>
          {before.current && before.current.tried > 0 && gainLine(before.current.ok, c.ok) ? <p className="verdict ok">{gainLine(before.current.ok, c.ok)}</p> : null}
          <p className="small">
            {list.length}문제 중 {c.tried}문제를 풀어 봤어요.
            {c.first ? " 처음에 바로 맞힌 문제는 " + c.first + "개예요." : ""} 오늘 푼 문제는 모두 {solvedToday(qm, Date.now())}개예요.
          </p>
          {st ? (
            <p className="small muted">
              레슨 완료까지: 기본 문제 풀어 봄 {st.basic.tried}/{st.basic.total} · 맞힘 {st.basic.done}개(완료에 {st.need}개 필요) · 읽음 {st.sectionsRead}/{st.sectionsTotal}
              {st.complete ? " — 완료했어요!" : ""}
            </p>
          ) : null}
          <ul className="list card">
            {list.map((x, k) => (
              <li key={x.id}>
                <a className="list-row" href={href(set === "more" ? STUDENT_ROUTES.quizMore : STUDENT_ROUTES.quiz, { lid }, { ...extra, n: k + 1 })}>
                  <span className="grow small">
                    {k + 1}. <Rich text={shortPrompt(x.prompt)} />
                  </span>
                  {isOk(qm[x.id]) ? <span className="verdict ok">맞힘</span> : isTried(qm[x.id]) ? <span className="chip">다시 볼 문제</span> : <span className="chip">아직</span>}
                </a>
              </li>
            ))}
          </ul>
          <div className="row wrap">
            {set !== "more" ? (
              <a className="btn" href={href(STUDENT_ROUTES.quizMore, { lid })}>
                더 풀기
              </a>
            ) : null}
            <a className="btn" href={href(STUDENT_ROUTES.note)}>
              <Icon name="note" />
              <span>오답노트</span>
            </a>
            <a className="btn btn-ghost" href={href(STUDENT_ROUTES.card, { lid, step: "wrap", card: 1 })}>
              정리 카드
            </a>
          </div>
        </div>
      )}
    </CardDeck>
  );
}
