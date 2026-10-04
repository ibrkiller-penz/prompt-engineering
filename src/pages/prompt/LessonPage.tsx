import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { availableLessons, getLesson, isLevel, levelMeta } from "../../content/load";
import { load, save } from "../../lib/storage";
import { BlockView } from "../../components/blocks/Blocks";
import PdfDialog, { hasPdf, lessonPdf, pdfUrl } from "../../print/PdfDialog";

export default function LessonPage() {
  const { level, n } = useParams();
  const num = Number(n);
  const lesson = isLevel(level) ? getLesson(level, num) : undefined;
  const [pdf, setPdf] = useState(false);

  useEffect(() => {
    if (!lesson || !isLevel(level)) return;
    const key = `progress:${level}`;
    const p = load<{ visited: number[]; last?: number }>(key, { visited: [] });
    save(key, { visited: Array.from(new Set([...p.visited, num])), last: num });
  }, [lesson, level, num]);

  if (!isLevel(level)) return <Navigate to="/prompt" replace />;
  const meta = levelMeta(level);

  if (!lesson) {
    const title = meta.lessons.find((l) => l.n === num)?.title;
    return (
      <div className="py-12 text-center">
        <p className="font-semibold text-accent">
          {meta.name} {num}차시
        </p>
        <h1 className="mt-2 text-2xl font-extrabold">{title ?? "없는 차시예요"}</h1>
        <p className="mt-3 text-muted">이 차시는 지금 준비하고 있어요.</p>
        <Link to={`/prompt/${level}`} className="mt-6 inline-block font-semibold text-accent underline">
          13차시 지도로 돌아가기
        </Link>
      </div>
    );
  }

  const ready = availableLessons(level);
  const idx = ready.indexOf(num);
  const prev = ready[idx - 1];
  const next = ready[idx + 1];

  return (
    <article>
      <header className="mb-6">
        <nav aria-label="위치" className="text-sm text-muted">
          <Link to={`/prompt/${level}`} className="underline underline-offset-2">
            {meta.name} 13차시
          </Link>{" "}
          › {num}차시
        </nav>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-5xl font-black leading-none text-accent sm:text-6xl">{String(num).padStart(2, "0")}</span>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{lesson.title}</h1>
            {lesson.subtitle && <p className="text-muted">{lesson.subtitle}</p>}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={13} aria-valuenow={num} aria-label="13차시 중 진행">
          <div className="h-full bg-accent" style={{ width: `${(num / 13) * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          13차시 중 {num}차시 · {lesson.minutes}분 · {lesson.source}
        </p>
        <div className="no-print mt-3 flex flex-wrap gap-2">
          {hasPdf(lessonPdf(level, num)) && (
            <a
              href={pdfUrl(lessonPdf(level, num))}
              download={`다시묻는AI교실_${meta.short}_${num}차시_활동지.pdf`}
              className="btn inline-flex items-center gap-1 rounded-card bg-accent px-4 text-sm font-semibold text-accent-ink"
            >
              📄 {num}차시 활동지 PDF
            </a>
          )}
          <button
            type="button"
            onClick={() => setPdf(true)}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-card border border-line bg-surface px-4 text-sm font-semibold"
          >
            🖨 골라서 인쇄 · PDF로 저장
          </button>
        </div>
        {pdf && <PdfDialog level={level} lesson={num} onClose={() => setPdf(false)} />}
      </header>

      <section className="mb-5 rounded-card border border-line bg-surface p-5">
        <p className="font-bold">이번 시간에 배울 것</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {lesson.goals.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ol>
      </section>

      <div className="space-y-5">
        {lesson.blocks.map((b, i) => (
          <BlockView key={`${num}-${i}`} block={b} storeKey={`${level}:${num}:${i}`} level={level} />
        ))}
      </div>

      <nav aria-label="차시 이동" className="no-print mt-10 grid grid-cols-2 gap-3">
        {prev ? (
          <Link to={`/prompt/${level}/lesson/${prev}`} className="rounded-card border border-line bg-surface p-4 hover:border-accent">
            <span className="text-sm text-muted">← 이전 차시</span>
            <span className="block font-semibold">
              {prev}차시 · {meta.lessons.find((l) => l.n === prev)?.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to={`/prompt/${level}/lesson/${next}`}
            className="rounded-card border border-line bg-surface p-4 text-right hover:border-accent"
          >
            <span className="text-sm text-muted">다음 차시 →</span>
            <span className="block font-semibold">
              {next}차시 · {meta.lessons.find((l) => l.n === next)?.title}
            </span>
          </Link>
        ) : (
          <Link to={`/prompt/${level}/lab`} className="rounded-card bg-accent p-4 text-right text-accent-ink">
            <span className="text-sm opacity-90">배운 것을 써 보기 →</span>
            <span className="block font-semibold">프롬프트 실험실</span>
          </Link>
        )}
      </nav>
    </article>
  );
}
