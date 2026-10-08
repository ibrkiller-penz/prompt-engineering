import { Link } from "react-router-dom";
import { getLesson, UNITS, allLessons } from "../load";
import { loadLast, progressOf, useQResults } from "../store";

const CAST = [
  { name: "서하", role: "부장 · 질문 대마왕", text: "늘 “왜?”부터 묻는다. 서하의 질문에서 오늘의 이야기가 시작돼요.", cls: "bg-rose-100 text-rose-800" },
  { name: "도윤", role: "코딩 담당", text: "말수는 적지만 결정적인 한마디를 던지는 친구예요.", cls: "bg-sky-100 text-sky-800" },
  { name: "하은", role: "미술·디자인", text: "글과 그림의 ‘느낌’에 예민해서, 데이터 속 감정을 잘 알아봐요.", cls: "bg-fuchsia-100 text-fuchsia-800" },
  { name: "지후", role: "농구부 겸임", text: "기록과 숫자를 사랑하는 데이터 덕후예요.", cls: "bg-amber-100 text-amber-800" },
  { name: "유 선생님", role: "수학 · 지도 교사", text: "정답을 바로 알려 주지 않고 되묻는 비유의 달인이에요.", cls: "bg-emerald-100 text-emerald-800" },
  { name: "비트", role: "AI 도우미", text: "장난기 많고 친절하지만 가끔 틀려요. 그래서 우리가 배워야 해요!", cls: "bg-violet-100 text-violet-800" },
];

export default function Home() {
  const results = useQResults();
  const last = loadLast();
  const all = allLessons();
  const allIds = all.flatMap((l) => l.practice.map((q) => q.id));
  const total = progressOf(allIds, results);

  return (
    <>
      <section className="rounded-card bg-accent-soft p-6 sm:p-8">
        <p className="text-sm font-bold tracking-widest text-accent">고등 진로선택 · 단원별 학습</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">인공지능 수학</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed">
          새봄고 AI랩 친구들과 함께 <b>이야기로 시작해서 · 개념을 만나고 · 직접 만져 보고 · 문제로 확인하는</b> 인공지능 수학이에요. 어렵게 느껴지는 단원도 한 계단씩 올라가면 돼요.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link to="/aimath/u1" className="inline-flex min-h-[48px] items-center rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">처음부터 시작하기 →</Link>
          {last && (
            <Link to={last.path} className="inline-flex min-h-[48px] items-center rounded-card border border-accent bg-surface px-5 font-semibold text-accent hover:bg-accent-soft">
              이어서 하기 · {last.title}
            </Link>
          )}
          {total.total > 0 && (
            <span className="text-sm text-muted">지금까지 맞힌 문제 <b className="text-ink">{total.done}</b> / {total.total}</span>
          )}
        </div>
      </section>

      <h2 className="mt-10 text-2xl font-extrabold">다섯 개의 대단원</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {UNITS.map((u) => {
          const ls = u.lessons.map((m) => getLesson(m.id)).filter((x) => !!x);
          const ids = ls.flatMap((l) => l!.practice.map((q) => q.id));
          const p = progressOf(ids, results);
          const ready = ls.length;
          return (
            <li key={u.id}>
              <Link
                to={`/aimath/${u.slug}`}
                className="group flex h-full flex-col rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderTop: `5px solid ${u.color}` }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ background: u.soft }} aria-hidden>{u.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold" style={{ color: u.color }}>{u.roman}단원</p>
                    <h3 className="text-xl font-extrabold leading-tight">{u.title}</h3>
                  </div>
                </div>
                <p className="mt-2 text-muted">{u.short}</p>
                <ol className="mt-3 space-y-1 text-[0.95rem]">
                  {u.lessons.map((m, i) => (
                    <li key={m.id} className="flex gap-2"><span className="font-bold" style={{ color: u.color }}>{i + 1}</span><span>{m.title}</span></li>
                  ))}
                </ol>
                <div className="mt-auto pt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: u.color }} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {ready < u.lessons.length ? `레슨 ${ready}/${u.lessons.length}개 공개` : `레슨 ${u.lessons.length}개`}
                    {p.total ? ` · 맞힌 문제 ${p.done}/${p.total}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="mt-10 text-2xl font-extrabold">레슨은 이렇게 흘러가요</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["📖", "이야기", "AI랩 친구들의 사건으로 시작해요"],
          ["🧩", "개념", "그림 같은 설명과 손으로 따라 푸는 예제"],
          ["🧪", "체험", "계산기·시뮬레이터로 직접 만져 봐요"],
          ["🪜", "계단 문제", "한 계단씩, 힌트 2개와 풀이"],
          ["🛠️", "AI 프로젝트", "종이·스프레드시트로 해 보는 활동"],
          ["📝", "요약·오답노트", "틀린 문제는 모아서 다시"],
        ].map(([i, t, d]) => (
          <li key={t} className="rounded-card border border-line bg-surface p-3 text-center">
            <p className="text-2xl" aria-hidden>{i}</p>
            <p className="mt-1 font-extrabold">{t}</p>
            <p className="mt-1 text-sm text-muted">{d}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-10 text-2xl font-extrabold">AI랩 친구들을 소개해요</h2>
      <p className="mt-2 text-muted">모든 이야기에 이 친구들이 나와요. 이야기 속 사건이 오늘 배울 수학으로 이어져요.</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CAST.map((c) => (
          <li key={c.name} className="rounded-card border border-line bg-surface p-4">
            <p><span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${c.cls}`}>{c.name}</span> <span className="ml-1 text-sm text-muted">{c.role}</span></p>
            <p className="mt-2 text-[0.95rem] leading-relaxed">{c.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <Link to="/aimath/glossary" className="rounded-card border border-line bg-surface p-4 hover:border-accent"><p className="font-extrabold">📚 용어 사전</p><p className="mt-1 text-sm text-muted">모든 레슨의 용어를 한곳에서 찾아봐요.</p></Link>
        <Link to="/aimath/notebook" className="rounded-card border border-line bg-surface p-4 hover:border-accent"><p className="font-extrabold">📒 오답노트</p><p className="mt-1 text-sm text-muted">틀린 문제를 모아서 다시 풀어요.</p></Link>
      </div>
    </>
  );
}
