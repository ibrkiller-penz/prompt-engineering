import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { StairRunner } from "../Quiz";
import { unitBySlug, unitContent } from "../load";
import { progressOf, saveLast, useQResults } from "../store";

export default function TestPage() {
  const { unit: slug } = useParams();
  const unit = unitBySlug(slug);
  const uc = unit ? unitContent(unit.id) : undefined;
  const results = useQResults();

  useEffect(() => {
    window.scrollTo(0, 0);
    if (unit) saveLast(`/aimath/${unit.slug}/test`, `${unit.roman}단원 마무리 문제`);
  }, [unit]);

  if (!unit || !uc) return <Navigate to={unit ? `/aimath/${unit.slug}` : "/aimath"} replace />;
  const p = progressOf(uc.test.map((q) => q.id), results);

  return (
    <article>
      <nav aria-label="현재 위치" className="text-sm text-muted">
        <Link to="/aimath" className="hover:underline">인공지능 수학</Link> › <Link to={`/aimath/${unit.slug}`} className="hover:underline">{unit.roman}. {unit.title}</Link>
      </nav>
      <h1 className="mt-2 text-3xl font-extrabold">🏁 {unit.roman}단원 마무리 문제</h1>
      <p className="mt-2 text-muted">
        이 단원의 레슨을 모두 아우르는 종합 문제 {uc.test.length}개예요. 한 문제씩 풀면 다음 문제가 열려요.{p.total ? ` 맞힌 문제 ${p.done}/${p.total}` : ""}
      </p>
      <div className="mt-6">
        <StairRunner questions={uc.test} results={results} />
      </div>
      <p className="mt-8">
        <Link to={`/aimath/${unit.slug}`} className="inline-flex min-h-[44px] items-center rounded-card border border-line bg-surface px-4 font-semibold hover:border-accent">← 단원으로 돌아가기</Link>
      </p>
    </article>
  );
}
