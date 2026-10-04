import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../../print/print.css";
import { availableLessons, getLesson, getStory, isLevel, levelMeta } from "../../content/load";
import { storyImg } from "../../components/blocks/StoryOpening";
import type { Lesson } from "../../content/types";
import { COURSE_NAME } from "../../site";
import { PrintBlock, collectAnswers } from "../../print/PrintBlocks";

// A4 인쇄용 화면 — /prompt/print?level=middle&l=1,2&p=lesson,ans&auto=1
// p: lesson(차시 전체: 읽기 자료 + 활동) · sheet(활동지만) · ans(예시 답)
export const PARTS = [
  ["lesson", "차시 전체 (읽기 자료 + 활동)"],
  ["sheet", "활동지만"],
  ["ans", "예시 답 (교사용)"],
] as const;
export type PartId = (typeof PARTS)[number][0];

export default function PrintPage() {
  const [sp] = useSearchParams();
  const level = sp.get("level") ?? "";
  const ok = isLevel(level);
  const all = ok ? availableLessons(level) : [];
  const lParam = sp.get("l") ?? "all";
  const nums = lParam === "all" ? all : lParam.split(",").map(Number).filter((n) => all.includes(n));
  const parts = (sp.get("p") ?? "lesson").split(",") as PartId[];
  const lessons = ok ? (nums.map((n) => getLesson(level, n)).filter(Boolean) as Lesson[]) : [];
  const main: PartId | null = parts.includes("lesson") ? "lesson" : parts.includes("sheet") ? "sheet" : null;
  const withAns = parts.includes("ans");
  const meta = ok ? levelMeta(level) : null;
  const scope = nums.length === all.length && nums.length > 1 ? "전체" : nums.map((n) => `${n}차시`).join("_");
  const kind = [main === "lesson" ? "활동지" : main === "sheet" ? "활동만" : "", withAns ? "예시답" : ""].filter(Boolean).join("+");

  useEffect(() => {
    document.body.classList.add("print-mode");
    return () => document.body.classList.remove("print-mode");
  }, []);

  useEffect(() => {
    if (!meta) return;
    document.title = `다시묻는AI교실_${meta.short}_${scope}_${kind}`;
    if (sp.get("auto") === "1") document.fonts.ready.then(() => setTimeout(() => window.print(), 600));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ok || !meta) {
    return (
      <div className="pr">
        <div className="sheet">
          <p>학교급을 찾을 수 없어요.</p>
          <Link to="/prompt">돌아가기</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pr" data-level={level}>
      <div className="bar">
        <Link className="sec" to={nums.length === 1 ? `/prompt/${level}/lesson/${nums[0]}` : "/prompt"}>
          ← 돌아가기
        </Link>
        <button className="pri" onClick={() => window.print()}>
          PDF로 저장 / 인쇄
        </button>
        <span>
          인쇄 창에서 대상(프린터)을 <b>「PDF로 저장」</b>으로 고르세요. 용지 A4 · 배경 그래픽 켜기
        </span>
      </div>
      <div className="sheet">
        {lessons.length === 0 && <p>고른 차시가 아직 준비되지 않았어요.</p>}

        {main &&
          lessons.map((ls) => (
            <section key={ls.lesson} className="doc">
              <div className="doc-title">
                <div>
                  <div className="kick">
                    {COURSE_NAME} · {meta.name} {meta.subtitle}
                  </div>
                  <h1>
                    {ls.lesson}차시 {ls.title}
                  </h1>
                  {ls.subtitle && <div className="sub">{ls.subtitle}</div>}
                </div>
                <div className="meta">
                  ___학년 ___반 ___번
                  <br />
                  이름 ______________
                </div>
              </div>
              {main === "lesson" && <PrintStory n={ls.lesson} level={level} />}
              <div className="goals">
                <b>이번 시간에 배울 것</b>
                <ol>
                  {ls.goals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ol>
              </div>
              {ls.blocks.map((b, i) => (
                <PrintBlock key={i} b={b} mode={main} />
              ))}
            </section>
          ))}

        {withAns && lessons.length > 0 && (
          <section className="doc">
            <div className="doc-title">
              <div>
                <div className="kick">
                  {COURSE_NAME} · {meta.name}
                </div>
                <h1>예시 답 (교사용)</h1>
                <div className="sub">교재·교사용 지도서의 예시 답안이에요. 학생의 답이 달라도 이유가 분명하면 인정해 주세요.</div>
              </div>
            </div>
            {lessons.map((ls) => {
              const ans = collectAnswers(ls);
              return (
                <div key={ls.lesson} className="ans">
                  <div className="ah">
                    {ls.lesson}차시 {ls.title}
                  </div>
                  {ans.length ? (
                    <ul>
                      {ans.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ins">이 차시는 정해진 예시 답이 없어요 (학생 경험을 쓰는 활동).</p>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

function PrintStory({ n, level }: { n: number; level: string }) {
  const s = getStory(n);
  const v = s && isLevel(level) ? s.levels[level] : undefined;
  if (!s || !v) return null;
  return (
    <div className="story">
      <div className="kick">{v.kicker}</div>
      <h2 className="st-title">{v.title}</h2>
      <img src={storyImg(s.image)} alt={s.imageAlt} />
      {v.paragraphs.map((t, i) => (
        <p key={i}>
          {t.split(/(\*\*[^*]+\*\*)/g).map((part, j) => (part.startsWith("**") ? <b key={j}>{part.slice(2, -2)}</b> : part))}
        </p>
      ))}
      <p className="st-close">{v.closing}</p>
      <p className="st-src">— {s.source}</p>
    </div>
  );
}
