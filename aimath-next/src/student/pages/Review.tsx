// 오늘의 복습(#/review): 틀렸던 문제를 1·3·7일 간격으로 다시 만나요. 하루 최대 5문제.
// 복습에서 혼자 맞히면 다음 간격으로, 틀리거나 풀이를 보고 맞히면 내일 다시. 세 번 연속 맞히면 졸업이에요.
// 힌트·풀이는 접은 채로 시작하고(전에 본 힌트 수만 알려 줘요), '새로 더해진 것' 띠는 숨겨요.
import { useState } from "react";
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { href, navigate } from "../../shared/router/index.ts";
import { Icon } from "../../shared/icons/index.ts";
import { Rich } from "../../shared/ui/index.ts";
import { CardDeck } from "../shell/CardDeck.tsx";
import { Loading, Screen, useDocTitle } from "../shell/Shell.tsx";
import { REVIEW_MAX_PER_DAY, reviewToday, useQ } from "../store/index.ts";
import { QRun } from "./QRun.tsx";
import { cardIndex, shortPrompt } from "./student.logic.ts";
import { useQuestions } from "./useQuestions.ts";

export default function ReviewPage({ query }: { query: Record<string, string> }) {
  useDocTitle("오늘의 복습");
  // 처음 들어왔을 때의 목록을 그대로 써요(푸는 동안 목록이 줄어들지 않게)
  const [ids] = useState<string[]>(() => reviewToday());
  const [results, setResults] = useState<Record<string, boolean>>({});
  const { map, loading } = useQuestions(ids);
  useQ();
  if (!ids.length) {
    return (
      <Screen title="오늘의 복습" tab="note" backTo="/note">
        <div className="page empty">
          <Icon name="review" size="xl" />
          <p>오늘 복습할 문제가 없어요.</p>
          <p className="small">틀린 문제는 다음 날부터 하루 {REVIEW_MAX_PER_DAY}문제까지 여기에 나와요.</p>
          <div className="row wrap" style={{ justifyContent: "center" }}>
            <a className="btn" href={href(STUDENT_ROUTES.note)}>
              오답노트
            </a>
            <a className="btn btn-primary" href={href(STUDENT_ROUTES.home)}>
              홈으로
            </a>
          </div>
        </div>
      </Screen>
    );
  }
  const total = ids.length + 1;
  const i = cardIndex(query.n, total);
  const go = (k: number) => navigate("/review", { n: k + 1 }, { replace: true });
  const id = i < ids.length ? ids[i] : null;
  const f = id ? map[id] : null;
  const okN = Object.keys(results).filter((k) => results[k]).length;
  return (
    <CardDeck
      cardKey={"rv" + i}
      title="오늘의 복습"
      backTo="/note"
      pos={id ? i + 1 + " / " + ids.length + "문제" : "결과"}
      onPrev={i > 0 ? () => go(i - 1) : null}
      onNext={i < total - 1 ? () => go(i + 1) : () => navigate("/")}
      nextLabel={i < total - 1 ? "다음" : "홈으로"}
    >
      {id ? (
        loading && !f ? (
          <Loading />
        ) : f ? (
          <div className="stack">
            <h2 className="sr-only">복습 {i + 1}번째</h2>
            <p className="eyebrow">{f.where}</p>
            <QRun
              q={f.q}
              review
              showNew={false}
              label={"복습 " + (i + 1)}
              onDone={(ok) => setResults((r) => (id in r ? r : { ...r, [id]: ok }))}
              after={
                <button type="button" className="btn btn-primary" onClick={() => go(i + 1)}>
                  다음
                </button>
              }
            />
          </div>
        ) : (
          <p className="empty">이 문제를 찾지 못했어요. 다음으로 넘어가요.</p>
        )
      ) : (
        <div className="stack s-result">
          <h2 className="h2">오늘 복습 끝!</h2>
          <p>
            {ids.length}문제 중 {okN}문제를 처음 답에 혼자 맞혔어요. 맞힌 문제는 다음 간격(3일·7일 뒤)으로, 틀렸거나 풀이를 보고 맞힌 문제는 내일 다시 만나요.
          </p>
          <ul className="list card">
            {ids.map((x, k) => (
              <li key={x}>
                <a className="list-row" href={"#/review?n=" + (k + 1)}>
                  <span className="grow small">{map[x] ? <Rich text={shortPrompt((map[x] as { q: { prompt: string } }).q.prompt)} /> : x}</span>
                  {x in results ? results[x] ? <span className="verdict ok">맞힘</span> : <span className="verdict bad">내일 다시</span> : <span className="chip">안 풀었어요</span>}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </CardDeck>
  );
}
