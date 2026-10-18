// 반별 진도(#/progress): 반 × 레슨 표. 칸을 누르면 아직 → 일부 → 끝 → 아직 으로 바뀌어요.
// 반 이름(예: 2-3)과 레슨별 표시만 aibn:t1:progress 에 저장해요. 학생 이름은 저장하지 않아요.
import { INDEX, lessonMeta } from "../../content/index.ts";
import type { TeacherPageProps } from "../shell/pages.tsx";
import { useKlass } from "../shell/klass.tsx";
import { todayHref } from "../shell/plan.ts";
import { TEACHER_MARK } from "../mark.ts";
import { cycleMark, type Mark } from "../store/index.ts";
import { marksLabel } from "../today/timebar.ts";
import { klassNowText } from "./progress.logic.ts";
import "./progress.css";

export const PROGRESS_MARK = TEACHER_MARK;

const SYM: Record<"done" | "part" | "none", string> = { done: "✓", part: "◐", none: "·" };
const MARK_LABEL: Record<"done" | "part" | "none", string> = { done: "끝", part: "진행 중", none: "아직" };

export default function ProgressPage(_m: TeacherPageProps) {
  const { classes, progress, klass, setKlass, markLesson } = useKlass();
  const total = INDEX.order.length;

  if (!classes.length) {
    return (
      <div className="page t-prog">
        <p className="eyebrow">교사용 · 반별 진도</p>
        <h1 className="h1">반별 진도</h1>
        <section className="card empty stack">
          <p>아직 반이 없어요. 위의 '+ 반 추가'에 '2-3'처럼 반 이름을 적어 주세요.</p>
          <p className="small muted">반 이름과 레슨별 진도 표시만 이 기기에 저장해요. 학생 이름은 적지 않아요.</p>
        </section>
      </div>
    );
  }

  const counts = (c: string) => {
    let done = 0;
    let part = 0;
    const row = progress[c] || {};
    for (const id of INDEX.order) {
      if (row[id] === "done") done++;
      else if (row[id] === "part") part++;
    }
    return { done, part };
  };

  return (
    <div className="page t-prog">
      <header className="t-prog-head">
        <p className="eyebrow">교사용 · 반별 진도</p>
        <h1 className="h1">반별 진도</h1>
        <p className="muted">칸을 누를 때마다 아직 → 진행 중 → 끝으로 바뀌어요. 수업 끝 화면의 '수업 마치기'도 여기에 표시해요.</p>
      </header>

      <ul className="t-prog-sum">
        {classes.map((c) => {
          const { done, part } = counts(c);
          const pct = Math.round((done / total) * 100);
          return (
            <li key={c} className={"card t-prog-card" + (c === klass ? " is-now" : "")}>
              <button type="button" className="chip" aria-pressed={c === klass} onClick={() => setKlass(c)}>
                {c}
              </button>
              <div className="meter" role="img" aria-label={c + "반 진도: " + marksLabel(done, part) + " (전체 " + total + "레슨)"}>
                <i style={{ width: pct + "%" }} />
              </div>
              <p className="t-prog-now">{klassNowText(progress, c, INDEX.order, (id) => (lessonMeta(id) ? (lessonMeta(id) as { code: string }).code : id))}</p>
              <p className="small muted">
                {marksLabel(done, part)} · 전체 {total}레슨
              </p>
            </li>
          );
        })}
      </ul>

      <div className="t-prog-wrap" role="region" aria-label="반 × 레슨 진도 표" tabIndex={0}>
        <table className="tbl t-prog-tbl">
          <thead>
            <tr>
              <th scope="col">레슨</th>
              {classes.map((c) => (
                <th key={c} scope="col" className={c === klass ? "is-now" : ""}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          {INDEX.units.map((u) => (
            <tbody key={u.id} className={"t-u" + u.id}>
              <tr className="t-prog-unit">
                <th scope="rowgroup" colSpan={classes.length + 1}>
                  <span className="unit-dot" aria-hidden="true" /> {u.roman}. {u.title}
                </th>
              </tr>
              {u.lessonIds.map((lid) => {
                const lm = lessonMeta(lid);
                if (!lm) return null;
                return (
                  <tr key={lid}>
                    <th scope="row" className="t-prog-lesson">
                      <a href={todayHref(lid)} title="오늘 수업에 올리기">
                        <span className="num">{lm.code}</span> {lm.title}
                      </a>
                    </th>
                    {classes.map((c) => {
                      const v = ((progress[c] || {})[lid] || null) as Mark;
                      const key = v || "none";
                      return (
                        <td key={c} className={"t-prog-cell is-" + key}>
                          <button
                            type="button"
                            className="t-prog-btn"
                            onClick={() => markLesson(c, lid, cycleMark(v))}
                            aria-label={c + " " + lm.code + " " + lm.title + ": " + MARK_LABEL[key] + ". 누르면 바뀌어요"}
                          >
                            <span className="t-prog-sym" aria-hidden="true">
                              {SYM[key]}
                            </span>
                            <span className="t-prog-txt">{MARK_LABEL[key]}</span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="small muted">반 이름 지우기는 '화면 설정'의 반 관리에서 할 수 있어요.</p>
    </div>
  );
}
