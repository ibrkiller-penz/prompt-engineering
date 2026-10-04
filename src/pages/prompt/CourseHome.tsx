import { useState } from "react";
import { Link } from "react-router-dom";
import PdfDialog from "../../print/PdfDialog";
import { LEVELS, availableLessons } from "../../content/load";
import { COURSE_NAME } from "../../site";

const FLOW = ["부탁하기", "되말하기 확인", "점검·검증", "선택 기록", "마무리"];

export default function CourseHome() {
  const [pdf, setPdf] = useState(false);
  return (
    <div>
      <section className="py-4 sm:py-8">
        <p className="font-semibold text-accent">프롬프트 엔지니어링 · 초·중·고 13차시</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{COURSE_NAME}</h1>
        <p className="mt-4 max-w-2xl text-lg">
          AI의 첫 결과물은 <strong>끝이 아니라 출발점</strong>이에요. 멋진 주문을 외우는 법이 아니라, 원하는 것을
          분명히 말하고, AI가 어떻게 알아들었는지 확인하고, 결과를 판단하고, 기록을 남기는{" "}
          <strong>대화 습관</strong>을 연습해요.
        </p>
        <ol className="mt-6 flex flex-wrap items-center gap-2 text-sm font-semibold">
          {FLOW.map((f, i) => (
            <li key={f} className="flex items-center gap-2">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-accent">{f}</span>
              {i < FLOW.length - 1 && (
                <span aria-hidden className="text-muted">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => setPdf(true)}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-card border-2 border-accent bg-surface px-4 font-semibold text-accent hover:bg-accent-soft"
        >
          📄 활동지 PDF 받기
        </button>
      </section>
      {pdf && <PdfDialog onClose={() => setPdf(false)} />}

      <h2 className="mt-6 text-xl font-bold">학교급을 골라요</h2>
      <ul className="mt-3 grid gap-4 sm:grid-cols-3">
        {LEVELS.map((l) => {
          const ready = availableLessons(l.id).length;
          return (
            <li key={l.id}>
              <Link
                to={`/prompt/${l.id}`}
                className="block h-full rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
              >
                <span className="text-2xl font-extrabold">{l.name}</span>
                <p className="mt-1 text-muted">{l.subtitle}</p>
                <p className="mt-3 text-sm text-muted">
                  {l.characters} · 차시당 {l.minutes}분
                </p>
                <p className="mt-2 text-sm font-semibold text-accent">
                  {ready > 0 ? `${ready}개 차시 열림` : "준비 중"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
