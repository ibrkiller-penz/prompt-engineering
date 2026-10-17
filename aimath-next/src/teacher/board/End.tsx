// 수업 끝 장면: 학생 주소 QR(640px, 기기 안에서 바로 만듦·외부 API 없음) + 짧은 주소 + 오늘 숙제 + 수업 마치기.
// QR 주소에는 문제 id 만 들어가요(반·이름 없음): https://aimaths.web.app/#/l/:lid?hw=…&ex=…
import { useMemo } from "react";
import type { Lesson } from "../../shared/contracts.ts";
import { Rich } from "../../shared/ui/index.ts";
import { navigate } from "../../shared/router/index.ts";
import { STUDENT_URL } from "../../site.ts";
import { qrSvg } from "../qr/index.ts";
import { studentLink } from "../logic/index.ts";
import { useKlass } from "../shell/klass.tsx";

export interface EndProps {
  lesson: Lesson;
  /** 끝 확인 문제 id */
  exit: string[];
  /** 숙제 문제 id(꺼진 칠판 문제 포함) */
  hw: string[];
  /** 마지막 차시인가(진도 '끝'/'일부') */
  lastPeriod: boolean;
  /** 정리 줄도 함께(따로 띄운 끝 화면) */
  withSummary?: boolean;
}

/** 한 줄 미리보기(수식 표시는 남기고 길면 자름) */
export function clip(s: string, n: number): string {
  const t = (s || "").replace(/\n/g, " ");
  if (t.length <= n) return t;
  // $…$ 가운데서 자르지 않게
  let cut = t.slice(0, n);
  const dollars = (cut.match(/\$/g) || []).length;
  if (dollars % 2 === 1) cut = cut.slice(0, cut.lastIndexOf("$"));
  return cut.replace(/\s+\S*$/, "") + "…";
}

export function EndScene({ lesson, exit, hw, lastPeriod, withSummary }: EndProps) {
  const url = useMemo(() => studentLink(STUDENT_URL, lesson.id, { hw, ex: exit }), [lesson.id, hw, exit]);
  const qr = useMemo(() => {
    try {
      return qrSvg(url, { ecc: "M", border: 4 });
    } catch {
      return null;
    }
  }, [url]);
  const short = url.replace(/^https?:\/\//, "");
  const { klass, markLesson } = useKlass();
  const qOf = (id: string) => lesson.practice.filter((q) => q.id === id)[0];

  const finish = () => {
    if (klass) markLesson(klass, lesson.id, lastPeriod ? "done" : "part");
    navigate("/");
  };

  return (
    <div className="bd-end">
      <div className="bd-end-qr">
        {qr ? (
          <svg className="bd-qr" viewBox={qr.viewBox} width={640} height={640} role="img" aria-label={"학생 주소 QR: " + short} shapeRendering="crispEdges">
            <rect width="100%" height="100%" fill="#fff" />
            <path d={qr.d} fill="#000" />
          </svg>
        ) : (
          <p className="bd-qr-fail">QR 을 만들지 못했어요. 아래 주소를 칠판에 적어 주세요.</p>
        )}
        <p className="bd-end-url num">{short}</p>
      </div>
      <div className="bd-end-side">
        <h2 className="bd-h">휴대폰으로 찍어서 이어서 공부해요</h2>
        {withSummary && lesson.summary.length ? (
          <section className="bd-end-sec">
            <h3 className="bd-end-h">오늘 정리</h3>
            <ol className="bd-end-list">
              {lesson.summary.slice(0, 4).map((t, i) => (
                <li key={i}>
                  <Rich text={clip(t, 80)} />
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {exit.length ? (
          <section className="bd-end-sec">
            <h3 className="bd-end-h">
              수업 끝 확인 <span className="num">{exit.length}</span>문제
            </h3>
            <p className="small muted">QR 로 들어가면 이것부터 풀어요.</p>
          </section>
        ) : null}
        <section className="bd-end-sec">
          <h3 className="bd-end-h">
            오늘 숙제 <span className="num">{hw.length}</span>문제
          </h3>
          {hw.length ? (
            <ol className="bd-end-list">
              {hw.slice(0, 6).map((id) => {
                const q = qOf(id);
                return q ? (
                  <li key={id}>
                    <Rich text={clip(q.prompt, 46)} />
                  </li>
                ) : null;
              })}
              {hw.length > 6 ? <li className="muted">그 밖에 {hw.length - 6}문제</li> : null}
            </ol>
          ) : (
            <p className="muted">오늘은 숙제가 없어요.</p>
          )}
        </section>
        <p className="tiny muted">주소에는 문제 번호만 들어 있어요. 이름이나 반은 들어 있지 않아요.</p>
        <div className="bd-end-actions">
          <button type="button" className="btn btn-primary btn-lg bd-finish" onClick={finish}>
            수업 마치기{klass ? " (" + klass + " " + (lastPeriod ? "끝" : "일부") + " 표시)" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
