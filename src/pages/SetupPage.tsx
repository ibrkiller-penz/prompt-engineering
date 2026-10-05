import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import setup from "../../content/setup/setup.json";
import { HUB_NAME } from "../site";
import { CopyButton } from "../components/ui";

/** AI 맞춤 설정 — ChatGPT·Claude에 넣어 두는 지침 (복사해서 붙여 넣기) */
export default function SetupPage() {
  const [sp, setSp] = useSearchParams();
  const first = sp.get("tool");
  const [tab, setTab] = useState(setup.tools.some((t) => t.id === first) ? (first as string) : "chatgpt");
  const tool = setup.tools.find((t) => t.id === tab) ?? setup.tools[0];

  useEffect(() => {
    document.title = `${setup.title} · ${HUB_NAME}`;
  }, []);

  const choose = (id: string) => {
    setTab(id);
    setSp({ tool: id }, { replace: true });
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
          <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8" />
          {HUB_NAME}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{setup.title}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">{setup.lead}</p>

        <ul className="mt-5 grid gap-2 sm:grid-cols-3">
          {setup.why.map((w, i) => (
            <li key={i} className="rounded-card border border-line bg-surface p-4 text-[0.95rem]">
              <span className="mb-1 block text-xl" aria-hidden>
                {["⚖️", "✂️", "🙋"][i]}
              </span>
              {w}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex gap-2" role="tablist" aria-label="AI 도구">
          {setup.tools.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => choose(t.id)}
              className={`min-h-[44px] rounded-full px-5 font-bold ${
                tab === t.id ? "bg-accent text-accent-ink" : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        <section className="mt-4 rounded-card border border-line bg-surface p-5 sm:p-6" role="tabpanel">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{tool.name} 맞춤 설정</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">{tool.prompt.length.toLocaleString()}자</span>
              <CopyButton text={tool.prompt} label="📋 전체 복사" />
            </div>
          </div>
          <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-card bg-bg p-4 font-sans text-[0.95rem] leading-relaxed">
            {tool.prompt}
          </pre>

          <h3 className="mt-6 text-lg font-bold">이렇게 넣어요</h3>
          <ol className="mt-2 space-y-2">
            {tool.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>

          {"warn" in tool && tool.warn && (
            <p className="mt-6 rounded-card border-2 border-bad bg-bad-soft p-3 font-semibold text-bad" role="note">
              ⚠ {tool.warn}
            </p>
          )}

          {tool.verified && (
            <p className="mt-4 text-sm text-muted">
              ✓ {tool.verified}{" "}
              {tool.sources?.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noopener" className="font-semibold text-accent underline underline-offset-2">
                  {s.label} ↗
                </a>
              ))}
            </p>
          )}

          {tool.note && (
            <p className="mt-5 rounded-card bg-warn-soft p-3 text-sm text-warn">
              <b>알아 둘 점</b> · {tool.note}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
