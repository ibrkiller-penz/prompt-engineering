import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import RichMath from "../RichMath";
import { allTerms, unitOfLesson, UNITS } from "../load";

export default function Glossary() {
  const [q, setQ] = useState("");
  const [unit, setUnit] = useState(0);
  const terms = useMemo(() => allTerms(), []);
  const shown = terms.filter(
    (t) => (!unit || t.unit === unit) && (!q.trim() || (t.term + " " + t.def).toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <>
      <h1 className="text-3xl font-extrabold">📚 용어 사전</h1>
      <p className="mt-2 text-muted">모든 레슨에 나온 용어 {terms.length}개를 가나다순으로 모았어요.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="gsearch">용어 검색</label>
        <input
          id="gsearch"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="용어나 설명 검색"
          className="min-h-[44px] min-w-0 flex-1 rounded-card border border-line bg-surface px-3"
        />
        <label className="sr-only" htmlFor="gunit">단원 고르기</label>
        <select id="gunit" value={unit} onChange={(e) => setUnit(Number(e.target.value))} className="min-h-[44px] rounded-card border border-line bg-surface px-3">
          <option value={0}>전체 단원</option>
          {UNITS.map((u) => <option key={u.id} value={u.id}>{u.roman}. {u.title}</option>)}
        </select>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">{shown.length}개</p>
      <dl className="mt-2 divide-y divide-line rounded-card border border-line bg-surface">
        {shown.map((t) => {
          const u = unitOfLesson(t.lesson);
          return (
            <div key={t.term} className="p-4">
              <dt className="flex flex-wrap items-baseline gap-2">
                <span className="text-lg font-extrabold">{t.term}</span>
                {u && (
                  <Link to={`/aimath/${u.slug}/${t.lesson}`} className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: u.soft, color: u.color }}>
                    {u.roman}-{t.lesson.split("-")[1]}
                  </Link>
                )}
              </dt>
              <dd className="mt-1 leading-relaxed"><RichMath text={t.def} /></dd>
            </div>
          );
        })}
        {shown.length === 0 && <p className="p-6 text-center text-muted">찾는 용어가 없어요. 다른 낱말로 검색해 보세요.</p>}
      </dl>
    </>
  );
}
