import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CopyButton } from "../components/ui";
import { HUB_NAME } from "../site";
import { CASES, COMMON_CAUTIONS } from "./notebookCaseData";

const fill = (t: string, who: string, topic: string) =>
  t.split("{대상}").join(who.trim() || "학생").split("{주제}").join(topic.trim() || "이 단원");

/** 제미나이 노트북 활용 사례 — 슬라이드 말고 스튜디오·채팅에서 할 수 있는 것들 */
export default function NotebookCases() {
  const [sp, setSp] = useSearchParams();
  const first = sp.get("c");
  const [id, setId] = useState(CASES.some((c) => c.id === first) ? (first as string) : CASES[0].id);
  const [who, setWho] = useState("중학교 2학년");
  const [topic, setTopic] = useState("이 단원");
  const c = CASES.find((x) => x.id === id) ?? CASES[0];

  useEffect(() => {
    document.title = `활용 사례 · 제미나이 노트북 · ${HUB_NAME}`;
  }, []);

  const pick = (nid: string) => {
    setId(nid);
    setSp({ c: nid }, { replace: true });
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <Link to="/notebook" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
          ← 제미나이 노트북
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">활용 사례</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          슬라이드 말고도 이런 걸 할 수 있어요. 고른 사례의 프롬프트를 복사해서 노트북에 붙여 넣으세요.
        </p>

        <section className="mt-6 rounded-card border border-line bg-surface p-4 sm:p-5" aria-label="대상과 주제">
          <p className="font-bold">① 대상과 주제를 적으면 아래 프롬프트가 그 말로 바뀌어요</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              대상
              <input
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="예) 중학교 2학년"
                className="mt-1 min-h-[44px] w-full rounded-card border border-line bg-bg px-3 text-base font-normal outline-none focus:border-accent"
              />
            </label>
            <label className="block text-sm font-semibold">
              주제 (단원·내용)
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예) 전자기 유도"
                className="mt-1 min-h-[44px] w-full rounded-card border border-line bg-bg px-3 text-base font-normal outline-none focus:border-accent"
              />
            </label>
          </div>
        </section>

        <h2 className="mt-8 text-xl font-bold">② 사례 고르기</h2>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 py-1.5" role="tablist" aria-label="활용 사례">
          {CASES.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={id === x.id}
              onClick={() => pick(x.id)}
              className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${
                id === x.id ? "bg-accent text-accent-ink" : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {x.icon} {x.label}
            </button>
          ))}
        </div>

        <section className="mt-3 rounded-card border-2 border-accent bg-surface p-5 sm:p-6" role="tabpanel" aria-label={c.label}>
          <h3 className="text-2xl font-extrabold">
            {c.icon} {c.label}
          </h3>
          <p className="mt-1 text-lg text-muted">{c.what}</p>

          <div className="mt-5 grid gap-5 md:grid-cols-2 md:gap-8">
            <div className="min-w-0">
              <h4 className="font-bold">교실에서 이렇게 써요</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {c.classroom.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h4 className="font-bold">이렇게 만들어요</h4>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5">
                {c.steps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          </div>

          <h4 className="mt-6 font-bold">고를 수 있는 설정</h4>
          <dl className="mt-2 divide-y divide-line rounded-card border border-line">
            {c.settings.map((s) => (
              <div key={s.name} className="grid gap-1 p-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="font-semibold">{s.name}</dt>
                <dd className="min-w-0 text-muted">{s.options}</dd>
              </div>
            ))}
          </dl>

          <h4 className="mt-6 font-bold">③ 복사해서 붙여 넣는 글</h4>
          <ul className="mt-2 space-y-3">
            {c.prompts.map((p) => {
              const text = fill(p.text, who, topic);
              return (
                <li key={p.title} className="rounded-card border border-line bg-bg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b>{p.title}</b>
                      <p className="text-sm text-muted">
                        📍 {p.where}
                        {p.tip ? ` · ${p.tip}` : ""}
                      </p>
                    </div>
                    <CopyButton text={text} label="📋 복사" />
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface p-3 leading-relaxed">{text}</p>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-card bg-bg p-4 text-sm">
            <b>알아 두기</b>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
              {[...c.cautions, ...COMMON_CAUTIONS].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
          <p className="mt-3 text-xs text-muted">
            참고:{" "}
            {c.links.map((l) => (
              <a key={l.url} className="underline" href={l.url} target="_blank" rel="noopener">
                {l.label}
              </a>
            ))}
            . 설정 이름은 노트북LM 업데이트에 따라 조금 달라질 수 있어요.
          </p>
        </section>
      </main>
    </div>
  );
}
