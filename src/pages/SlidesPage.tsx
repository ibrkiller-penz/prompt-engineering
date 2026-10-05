import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import data from "../../content/slides/slides.json";
import { HUB_NAME } from "../site";
import { CopyButton } from "../components/ui";

type Design = (typeof data.designs)[number];

/** 디자인 카드의 색 미리보기 */
function Swatch({ d, large = false }: { d: Design; large?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-black/10 ${large ? "h-24" : "h-16"}`}
      style={{ background: d.bg }}
      aria-hidden
    >
      <div className="flex h-full flex-col justify-between p-2">
        <span className="text-[0.7rem] font-extrabold leading-none" style={{ color: d.text }}>
          Aa 제목
        </span>
        <div className="flex gap-1">
          {d.accents.map((c) => (
            <span key={c} className="h-3 flex-1 rounded-full" style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** 단계 프롬프트 글 (대상을 바꿀 수 있음) */
function promptOf(d: Design, step: string, count: "20" | "60", audience: string) {
  let t = "";
  if (step === "design") t = d.design;
  else if (step === "script") t = count === "60" && d.script60 ? d.script60 : d.script20;
  else if (step === "infoScript") t = d.infoScript;
  else if (step === "slides") t = d.slides;
  else t = d.infographic;
  // 대본 프롬프트의 '대상'만 바꿔 끼운다 (선생님 글의 변수 칸)
  if ((step === "script" || step === "infoScript") && audience.trim()) {
    t = t.replace(/(Target Audience:\s*)[^\n]+/g, `$1${audience.trim()}`);
  }
  return t;
}

/** 노트북LM 슬라이드 프롬프트 — 디자인을 고르면 단계별 프롬프트가 채워진다 */
export default function SlidesPage() {
  const [sp, setSp] = useSearchParams();
  const first = sp.get("d");
  const [designId, setDesignId] = useState(data.designs.some((x) => x.id === first) ? (first as string) : data.designs[0].id);
  const [step, setStep] = useState(data.steps.some((x) => x.id === sp.get("s")) ? (sp.get("s") as string) : "design");
  const [count, setCount] = useState<"20" | "60">("20");
  const design = data.designs.find((x) => x.id === designId) ?? data.designs[0];
  const [audience, setAudience] = useState(design.audience);
  const stepInfo = data.steps.find((x) => x.id === step) ?? data.steps[0];

  useEffect(() => {
    document.title = `노트북LM 슬라이드 프롬프트 · ${HUB_NAME}`;
  }, []);

  const pickDesign = (d: Design) => {
    setDesignId(d.id);
    setAudience(d.audience);
    setSp({ d: d.id, s: step }, { replace: true });
  };
  const pickStep = (id: string) => {
    setStep(id);
    setSp({ d: designId, s: id }, { replace: true });
  };

  const text = promptOf(design, step, count, audience);
  const showAudience = step === "script" || step === "infoScript";

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
          <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8" />
          {HUB_NAME}
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">노트북LM 슬라이드 프롬프트</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          디자인을 고르면 아래 프롬프트가 그 디자인으로 채워져요. 단계 순서대로 복사해서 노트북LM에 붙여 넣으세요.
        </p>

        <h2 className="mt-8 text-xl font-bold">① 디자인 고르기</h2>
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="디자인">
          {data.designs.map((d) => {
            const on = d.id === design.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickDesign(d)}
                  className={`block h-full w-full rounded-card border-2 bg-surface p-2.5 text-left transition ${
                    on ? "border-accent shadow-md" : "border-line hover:border-accent/60"
                  }`}
                >
                  <Swatch d={d} />
                  <span className="mt-2 block font-bold leading-tight">{d.name}</span>
                  <span className="block text-xs text-muted">{d.mood}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <h2 className="mt-8 text-xl font-bold">② 단계별 프롬프트 복사</h2>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="단계">
          {data.steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={step === s.id}
              onClick={() => pickStep(s.id)}
              className={`min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${
                step === s.id ? "bg-accent text-accent-ink" : "border border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        <section className="mt-3 rounded-card border border-line bg-surface p-5 sm:p-6" role="tabpanel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-accent">{design.name}</p>
              <h3 className="text-xl font-bold">{stepInfo.title}</h3>
              <p className="mt-1 text-muted">{stepInfo.help}</p>
            </div>
            <CopyButton text={text} label="📋 전체 복사" />
          </div>

          {(step === "script" || showAudience) && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-card bg-bg p-3">
              {step === "script" && (
                <fieldset>
                  <legend className="mb-1 text-sm font-bold">슬라이드 수</legend>
                  <div className="flex gap-1.5">
                    {(["20", "60"] as const).map((c) => (
                      <label
                        key={c}
                        className={`inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm ${
                          count === c ? "border-accent bg-accent-soft font-bold text-accent" : "border-line bg-surface"
                        }`}
                      >
                        <input type="radio" checked={count === c} onChange={() => setCount(c)} className="accent-[var(--accent)]" />
                        {c}장{c === "60" ? " (3파트)" : ""}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className="min-w-[200px] flex-1">
                <span className="mb-1 block text-sm font-bold">대상 (Target Audience)</span>
                <input
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="예) 고등학생, 대학생, 학부모"
                  className="min-h-[44px] w-full rounded-card border border-line bg-surface px-3 outline-none focus:border-accent"
                />
              </label>
              <p className="basis-full text-xs text-muted">대상을 바꾸면 아래 프롬프트의 ‘Target Audience’가 함께 바뀌어요.</p>
            </div>
          )}

          <pre className="mt-4 max-h-[460px] overflow-auto whitespace-pre-wrap break-words rounded-card bg-bg p-4 font-mono text-[0.85rem] leading-relaxed">
            {text}
          </pre>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted">{text.length.toLocaleString()}자</span>
            <div className="flex gap-2">
              {data.steps.findIndex((x) => x.id === step) > 0 && (
                <button
                  type="button"
                  onClick={() => pickStep(data.steps[data.steps.findIndex((x) => x.id === step) - 1].id)}
                  className="min-h-[44px] rounded-card border border-line bg-surface px-4 font-semibold"
                >
                  ← 이전 단계
                </button>
              )}
              {data.steps.findIndex((x) => x.id === step) < data.steps.length - 1 && (
                <button
                  type="button"
                  onClick={() => pickStep(data.steps[data.steps.findIndex((x) => x.id === step) + 1].id)}
                  className="min-h-[44px] rounded-card bg-accent px-4 font-semibold text-accent-ink"
                >
                  다음 단계 →
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
