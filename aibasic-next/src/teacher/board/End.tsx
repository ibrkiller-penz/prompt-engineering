// 수업 끝 장면: 학생 주소 QR(크게, 기기 안에서 바로 만듦·외부 API 없음) + 짧은 주소·차시 이름 + 오늘 숙제.
// QR 주소에는 문제 id 만 들어가요(반·이름 없음): https://aibasics.web.app/#/l/:lid?hw=…&ex=…
// 화면 글자로는 'aibasics.web.app'과 차시 이름만 크게 보여 주고, 긴 쿼리는 QR 에만 넣어요.
// '수업 마치기(진도 표시)'는 아래 고정 막대의 주 단추가 맡아요(useFinish). 이때 오늘 기록 카드도 기기에 한 장 남겨요.
// 오른쪽 위 '오늘 기록 카드' 단추는 반별 수업 기록 카드를 떠 있는 카드로 열어요(QR·숙제 줄 배치는 그대로).
import { useMemo, useState } from "react";
import type { Lesson } from "../../shared/contracts.ts";
import { Rich } from "../../shared/ui/index.ts";
import { navigate } from "../../shared/router/index.ts";
import { STUDENT_URL } from "../../site.ts";
import { qrSvg } from "../qr/index.ts";
import { shouldSaveLog, studentLink, type PeriodSummary } from "../logic/index.ts";
import { useKlass } from "../shell/klass.tsx";
import { LessonLogModal, useLogSnapshot, type LogSource } from "./LessonLogCard.tsx";
import { clip, finishPlan, firstSentence, hwNumbers, hwPreview, practiceNo } from "./board.logic.ts";

export { clip, hwPreview };

export interface EndProps {
  lesson: Lesson;
  /** 끝 확인 문제 id */
  exit: string[];
  /** 숙제 문제 id(꺼진 칠판 문제 포함) */
  hw: string[];
  /** 차시 이름(예: "Ⅰ-1 인공지능이란? · 1차시") */
  periodLabel?: string;
  /** 정리 줄도 함께(따로 띄운 끝 화면): summaryForPeriod 결과(이 차시 정리만, 마지막 차시 전체면 제목이 '이 레슨 전체 정리') */
  summary?: PeriodSummary | null;
  /** 오늘 기록 카드를 만들 재료(없으면 '오늘 기록 카드' 단추를 숨겨요) */
  log?: LogSource | null;
}

/** 수업 마치기: 고른 반이 있으면 진도('끝'/'진행 중')를 적고 오늘 수업으로 가요 */
export function useFinish(lessonId: string, lastPeriod: boolean, log?: LogSource | null): { label: string; hint: string; run: () => void } {
  const { klass, progress, markLesson } = useKlass();
  const snap = useLogSnapshot(log || null);
  const cur = klass ? ((progress[klass] || {})[lessonId] as "done" | "part" | undefined) : undefined;
  const plan = finishPlan(klass, cur, lastPeriod);
  return {
    label: "수업 마치기",
    hint: shouldSaveLog(klass) ? plan.hint : plan.hint + ". 반을 고르면 기록이 남아요",
    run: () => {
      if (klass && plan.mark) markLesson(klass, lessonId, plan.mark);
      // 반을 고르지 않았으면 기록 카드는 저장하지 않아요(안내만)
      if (shouldSaveLog(klass)) snap.save();
      navigate("/");
    },
  };
}

/** 화면에 보일 학생 주소(쿼리 없이 사이트 이름만) */
export function siteShort(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
}

export function EndScene({ lesson, exit, hw, periodLabel, summary, log }: EndProps) {
  const { card } = useLogSnapshot(log || null);
  const { klass } = useKlass();
  const hasKlass = shouldSaveLog(klass);
  const [logOpen, setLogOpen] = useState(false);
  const url = useMemo(() => studentLink(STUDENT_URL, lesson.id, { hw, ex: exit }), [lesson.id, hw, exit]);
  const qr = useMemo(() => {
    try {
      return qrSvg(url, { ecc: "M", border: 4 });
    } catch {
      return null;
    }
  }, [url]);
  const site = siteShort(STUDENT_URL);
  const qOf = (id: string) => lesson.practice.filter((q) => q.id === id)[0];
  const [hwOpen, setHwOpen] = useState(false);
  const pids = lesson.practice.map((q) => q.id);
  const sum = summary ? summary.lines.slice(0, 4) : [];
  const sumMore = summary ? Math.max(0, summary.lines.length - sum.length) : 0;

  return (
    <div className={"bd-end" + (sum.length ? " has-sum" : "")}>
      <div className="bd-end-qr">
        {qr ? (
          <svg className="bd-qr" viewBox={qr.viewBox} width={660} height={660} role="img" aria-label={"학생 주소 QR: " + site + " " + (periodLabel || lesson.title)} shapeRendering="crispEdges">
            <rect width="100%" height="100%" fill="#fff" />
            <path d={qr.d} fill="#000" />
          </svg>
        ) : (
          <p className="bd-qr-fail">QR을 만들지 못했어요. 아래 주소를 칠판에 적어 주세요.</p>
        )}
        <p className="bd-end-site num">{site}</p>
        <p className="bd-end-period">{periodLabel || lesson.title}</p>
      </div>
      <div className="bd-end-side">
        <div className="bd-end-head">
          <h2 className="bd-end-title">휴대폰으로 QR을 찍고 이어서 공부해요</h2>
          {card ? (
            <button type="button" className="btn bd-end-log bd-noswipe" onClick={() => setLogOpen(true)}>
              오늘 기록 카드
            </button>
          ) : null}
        </div>
        {card && !hasKlass ? (
          <p className="ll-end-klass" role="status">
            반을 고르면 기록이 남아요
          </p>
        ) : null}
        {sum.length ? (
          <section className="bd-end-sec">
            <h3 className="bd-end-h">{summary ? summary.title : "오늘 정리"}</h3>
            <ol className="bd-end-list">
              {sum.map((t, i) => (
                <li key={i}>
                  <span className="bd-end-no num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="bd-end-txt">
                    <Rich text={firstSentence(t)} />
                  </span>
                </li>
              ))}
              {sumMore ? <li className="bd-end-more">+{sumMore}줄은 정리 장면에서 봐요</li> : null}
            </ol>
          </section>
        ) : null}
        {exit.length ? (
          <p className="bd-end-badge">
            <span className="bd-end-badge-tag">끝 확인</span>
            <span>
              <b className="num">{exit.length}</b>문제 · QR로 들어가면 이것부터 풀어요
            </span>
          </p>
        ) : null}
        <section className="bd-end-sec">
          <h3 className="bd-end-h">
            숙제 <span className="num">{hw.length}</span>문제
          </h3>
          {hw.length ? (
            <>
              <p className="bd-end-hwnos num">{hwNumbers(pids, hw)}</p>
              <button type="button" className="bd-end-morebtn bd-noswipe" aria-expanded={hwOpen} onClick={() => setHwOpen(!hwOpen)}>
                {hwOpen ? "지문 접어요" : "지문 앞부분 보기"}
              </button>
              {hwOpen ? (
                <ol className="bd-end-list is-hw">
                  {hw.map((id, i) => {
                    const q = qOf(id);
                    const no = practiceNo(pids, id);
                    return q ? (
                      <li key={id}>
                        <span className="bd-end-no is-hw num">{no ? no + "번" : i + 1 + "."}</span>
                        <span className="bd-end-txt">
                          <Rich text={clip(q.prompt, sum.length ? 26 : 32)} />
                        </span>
                      </li>
                    ) : null;
                  })}
                </ol>
              ) : null}
            </>
          ) : (
            <p className="bd-end-none">오늘은 숙제가 없어요.</p>
          )}
        </section>
        <p className="bd-end-note">주소에는 문제 번호만 들어 있어요. 이름이나 반은 들어 있지 않아요.</p>
      </div>
      {logOpen && card ? <LessonLogModal card={card} lessonTitle={lesson.title} pids={pids} onClose={() => setLogOpen(false)} note={hasKlass ? "수업 마치기를 누르면 이 기기에 남아요" : "반을 고르면 기록이 남아요"} /> : null}
    </div>
  );
}
