import { useState } from "react";
import { Link } from "react-router-dom";
import { QuestionCard } from "../Quiz";
import { findQuestion, unitOfLesson, UNITS } from "../load";
import { clearResult, resetAll, useQResults } from "../store";

export default function Notebook() {
  const results = useQResults();
  const [round, setRound] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);

  const wrong = Object.entries(results)
    .filter(([, r]) => !r.ok)
    .map(([id, r]) => ({ id, r, f: findQuestion(id) }))
    .filter((x) => x.f)
    .sort((a, b) => b.r.ts - a.r.ts);
  const fixed = Object.values(results).filter((r) => r.ok && r.tries > 1).length;

  return (
    <>
      <h1 className="text-3xl font-extrabold">📒 오답노트</h1>
      <p className="mt-2 text-muted">
        가장 최근에 틀린 문제만 모여요. 다시 풀어서 맞히면 목록에서 사라져요. 기록은 이 기기의 브라우저에만 저장돼요.
      </p>
      <p className="mt-2 text-sm">틀린 문제 <b className="text-bad">{wrong.length}</b>개{fixed > 0 && <> · 다시 풀어 맞힌 문제 <b className="text-ok">{fixed}</b>개</>}</p>

      {wrong.length === 0 ? (
        <div className="mt-6 rounded-card border border-line bg-surface p-8 text-center">
          <p className="text-4xl" aria-hidden>🎉</p>
          <p className="mt-2 text-lg font-bold">틀린 문제가 없어요!</p>
          <p className="mt-1 text-muted">문제를 풀다가 틀리면 여기에 모아 줄게요.</p>
          <Link to="/aimath" className="mt-4 inline-flex min-h-[44px] items-center rounded-card bg-accent px-5 font-bold text-accent-ink">문제 풀러 가기</Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-6">
          {wrong.map(({ id, f }) => {
            const u = UNITS.find((x) => x.id === f!.unit) ?? unitOfLesson(f!.lessonId);
            return (
              <li key={id}>
                <p className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  {u && <span className="rounded-full px-2 py-0.5 font-bold" style={{ background: u.soft, color: u.color }}>{u.roman}단원</span>}
                  <span className="text-muted">{f!.where}</span>
                  {u && !f!.lessonId.startsWith("test") && (
                    <Link to={`/aimath/${u.slug}/${f!.lessonId}`} className="font-semibold text-accent underline underline-offset-2">레슨 다시 보기</Link>
                  )}
                  <button type="button" onClick={() => clearResult(id)} className="ml-auto min-h-[44px] px-2 text-muted underline underline-offset-2">목록에서 빼기</button>
                </p>
                <QuestionCard key={id + ":" + (round[id] ?? 0)} q={f!.q} onDone={() => setRound((r) => ({ ...r, [id]: (r[id] ?? 0) + 1 }))} />
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-12 border-t border-line pt-6">
        <h2 className="text-lg font-extrabold">기록 지우기</h2>
        <p className="mt-1 text-sm text-muted">푼 기록과 ‘이어서 하기’ 위치를 모두 지워요. 되돌릴 수 없어요.</p>
        {!confirm ? (
          <button type="button" onClick={() => setConfirm(true)} className="mt-2 min-h-[44px] rounded-card border border-line bg-surface px-4 font-semibold hover:border-bad">모든 기록 지우기</button>
        ) : (
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { resetAll(); setConfirm(false); }} className="min-h-[44px] rounded-card bg-bad px-4 font-bold text-white">정말 지우기</button>
            <button type="button" onClick={() => setConfirm(false)} className="min-h-[44px] rounded-card border border-line bg-surface px-4 font-semibold">취소</button>
          </div>
        )}
      </section>
    </>
  );
}
