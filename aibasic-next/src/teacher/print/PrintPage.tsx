// 학습지 인쇄(#/print/:lid?set=board|exit|hw&key=1&p=1): A4 흑백 학습지와 정답지, 학생 주소 QR.
//  - set: 칠판 문제(board) · 수업 끝 확인(exit) · 숙제(hw) 바구니
//  - key=1: 정답지(정답 + 풀이, 서술형은 모범 답안과 채점 기준)
//  - QR: 학생 사이트(aibasics) 레슨 주소. 숙제·확인 문제 id 만 담아요(이름·반은 넣지 않아요). 기기 안에서 만들어요(외부 API 없음).
import type { ReactNode } from "react";
import { TEACHER_ROUTES, type Question } from "../../shared/contracts.ts";
import { href, intParam, navigate } from "../../shared/router/index.ts";
import { lessonMeta, unitOf, useLesson } from "../../content/index.ts";
import { Rich, answerText, CHOICE_KEYS } from "../../shared/ui/index.ts";
import { STUDENT_URL } from "../../site.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { Loading, NotFound } from "../shell/Fallbacks.tsx";
import { shortId, studentLink } from "../logic/index.ts";
import { qrSvg } from "../qr/index.ts";
import { useLessonPrep, type Baskets } from "../prep/data.ts";
import "./print-sheet.css";

type SetName = keyof Baskets;
const SETS: { k: SetName; name: string; title: string }[] = [
  { k: "board", name: "칠판 문제", title: "수업 문제" },
  { k: "exit", name: "끝 확인", title: "수업 끝 확인" },
  { k: "hw", name: "숙제", title: "오늘 숙제" },
];

function QrBox({ url }: { url: string }) {
  let svg: { viewBox: string; d: string } | null = null;
  try {
    svg = qrSvg(url, { ecc: "M", border: 2 });
  } catch {
    svg = null;
  }
  const shown = url.replace(/^https?:\/\//, "");
  return (
    <div className="pr-qr">
      {svg ? (
        <svg className="pr-qr-img" viewBox={svg.viewBox} shapeRendering="crispEdges" role="img" aria-label="학생 사이트로 가는 QR 코드">
          <rect width="100%" height="100%" fill="#fff" />
          <path d={svg.d} fill="#000" />
        </svg>
      ) : null}
      <div className="pr-qr-txt">
        <strong>휴대폰으로 이어서 공부해요</strong>
        <span>카메라로 찍으면 이 레슨과 선생님이 고른 문제가 열려요. 기록은 각자 휴대폰에만 남아요.</span>
        <span className="pr-url">{shown}</span>
      </div>
    </div>
  );
}

function AnswerArea({ q }: { q: Question }) {
  if (q.type === "choice")
    return (
      <ol className="pr-choices">
        {q.choices.map((c, i) => (
          <li key={i}>
            <span className="pr-key">{CHOICE_KEYS[i] || i + 1}</span> <Rich text={c} />
          </li>
        ))}
      </ol>
    );
  if (q.type === "ox") return <p className="pr-line">( O · X ) 중 하나에 동그라미</p>;
  if (q.type === "number")
    return (
      <p className="pr-line">
        답: <span className="pr-blank" /> {q.unit || ""}
      </p>
    );
  return (
    <div className="pr-open" aria-label="답 쓰는 칸">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function KeyArea({ q }: { q: Question }) {
  if (q.type === "open")
    return (
      <div className="pr-keybox">
        <p>
          <b>모범 답안</b> <Rich text={q.model} />
        </p>
        {q.rubric && q.rubric.length ? (
          <>
            <b>채점 기준</b>
            <ul>
              {q.rubric.map((r, i) => (
                <li key={i}>
                  <Rich text={r} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  return (
    <div className="pr-keybox">
      <p>
        <b>정답</b> <Rich text={answerText(q)} />
      </p>
      <p className="pr-sol">
        <b>풀이</b> <Rich text={q.solution} />
      </p>
    </div>
  );
}

export default function PrintPage(m: TeacherPageProps) {
  const lid = m.params.lid;
  const meta = lessonMeta(lid);
  const unit = unitOf(lid);
  const { data: lesson, error } = useLesson(meta ? lid : null);
  const period = intParam(m.query.p, 1, 1, 9);
  const st = useLessonPrep(lesson, period);
  const set: SetName = m.query.set === "exit" || m.query.set === "hw" ? m.query.set : "board";
  const key = m.query.key === "1";

  if (!meta) return <NotFound />;
  if (error)
    return (
      <section className="page">
        <p role="alert">레슨을 불러오지 못했어요. 새로고침해 주세요.</p>
      </section>
    );
  if (!lesson || !st.view) return <Loading />;

  const p = st.view.p;
  const info = SETS.filter((s) => s.k === set)[0];
  const ids = st.baskets[set];
  const qs = ids.map((id) => lesson.practice.filter((q) => q.id === id)[0]).filter((q): q is Question => !!q);
  const link = studentLink(STUDENT_URL, lid, { hw: st.baskets.hw, ex: st.baskets.exit });
  const go = (patch: Record<string, string | number | undefined>) => navigate(TEACHER_ROUTES.print.replace(":lid", lid), { p, set, key: key ? 1 : undefined, ...patch }, { replace: true });

  let body: ReactNode;
  if (!qs.length) body = <p className="pr-empty">이 바구니에 담긴 문제가 없어요. '문제 고르기'에서 담아 주세요.</p>;
  else
    body = (
      <ol className="pr-qs">
        {qs.map((q, i) => (
          <li key={q.id} className="pr-q">
            <div className="pr-q-head">
              <span className="pr-q-n">{i + 1}</span>
              <span className="pr-q-id">
                {shortId(lid, q.id)} · {"★".repeat(q.level)}
              </span>
            </div>
            <div className="pr-q-prompt">
              <Rich text={q.prompt} />
            </div>
            {key ? <KeyArea q={q} /> : <AnswerArea q={q} />}
          </li>
        ))}
      </ol>
    );

  return (
    <section className="pr-root" aria-labelledby="pr-h">
      <div className="pr-tools no-print">
        <div className="row wrap" role="group" aria-label="학습지 종류">
          {SETS.map((s) => (
            <button key={s.k} type="button" className={"btn " + (s.k === set ? "btn-primary" : "btn-ghost")} aria-pressed={s.k === set} onClick={() => go({ set: s.k })}>
              {s.name} {st.baskets[s.k].length}
            </button>
          ))}
          <button type="button" className={"btn " + (key ? "btn-primary" : "btn-ghost")} aria-pressed={key} onClick={() => go({ key: key ? undefined : 1 })}>
            {key ? "정답지 보는 중" : "정답지로 보기"}
          </button>
          <button type="button" className="btn btn-soft" onClick={() => window.print()}>
            인쇄하기
          </button>
          <a className="btn btn-ghost" href={href(TEACHER_ROUTES.prep, { lid }, { p })}>
            준비 한 장으로
          </a>
        </div>
        <p className="small muted">A4 세로, 흑백으로 맞춰 두었어요. 인쇄 창에서 '배경 그래픽'은 꺼도 돼요.</p>
      </div>

      <article className={"pr-paper" + (key ? " is-key" : "")}>
        <header className="pr-head">
          <div className="pr-title">
            <p className="pr-eyebrow">
              인공지능 기초 · {unit ? unit.roman + ". " + unit.short : ""}
              {st.view.periods.length > 1 ? " · " + p + "차시" : ""}
            </p>
            <h1 id="pr-h">
              {meta.code} {meta.title} — {info.title}
              {key ? " 정답지" : ""}
            </h1>
          </div>
          {!key ? (
            <div className="pr-who" aria-label="쓰는 칸">
              <span>날짜</span>
              <i />
              <span>반·번호</span>
              <i />
            </div>
          ) : null}
        </header>
        {!key ? (
          <p className="pr-question">
            <b>오늘의 핵심 질문</b> <Rich text={lesson.question} />
          </p>
        ) : null}
        {body}
        <footer className="pr-foot">
          <QrBox url={link} />
        </footer>
      </article>
    </section>
  );
}
