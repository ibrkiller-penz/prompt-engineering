import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import data from "../../content/slides/slides.json";
import { HUB_NAME } from "../site";
import { CopyButton } from "../components/ui";

type Design = (typeof data.designs)[number];
type Col = Design["colors"][number];

const hexOf = (d: Design, re: RegExp, fallback: string) => d.colors.find((c: Col) => re.test(c.role))?.hex ?? fallback;

/** 카드의 작은 색 미리보기 */
function Swatch({ d }: { d: Design }) {
  return (
    <div className="h-16 overflow-hidden rounded-lg border border-black/10" style={{ background: d.bg }} aria-hidden>
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

/** 선택한 디자인으로 꾸민 가짜 슬라이드 4종 (원문의 Type A~D 레이아웃) */
function SlidePreview({ d }: { d: Design }) {
  const bg = d.bg;
  const text = hexOf(d, /본문|제목/, d.text);
  const sub = hexOf(d, /보조/, text);
  const acc = d.colors.filter((c: Col) => /강조|포인트|아이콘|체크/.test(c.role)).map((c: Col) => c.hex);
  const a1 = acc[0] ?? text;
  const a2 = acc[1] ?? a1;
  const pt = acc[acc.length - 1] ?? a1;
  // 칸 너비(cqw)에 비례해서 글자·여백이 줄어들게 해서, 작은 화면에서도 넘치지 않게 한다
  const frame = "relative aspect-video overflow-hidden rounded-lg border border-black/10 [container-type:inline-size]";
  const inner = "absolute inset-0 flex flex-col justify-center px-[7cqw] py-[6cqw]";
  const lab = "absolute left-[3cqw] top-[2.5cqw] z-10 rounded bg-black/55 px-[1.8cqw] py-[0.4cqw] text-[3.2cqw] font-bold leading-snug text-white";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="슬라이드 미리보기">
      {/* A 제목 */}
      <div className={frame} style={{ background: bg }}>
        <span className={lab}>A 제목</span>
        <div className={`${inner} items-center text-center`}>
          <b className="text-[7.5cqw] leading-tight" style={{ color: text }}>
            오늘의 수업 제목
          </b>
          <span className="mt-[3cqw] h-[0.9cqw] w-[26cqw] rounded-full" style={{ background: `linear-gradient(90deg,${a1},${a2})` }} />
          <span className="mt-[4cqw] text-[3.6cqw]" style={{ color: sub }}>
            부제목 · 발표자
          </span>
        </div>
      </div>
      {/* B 본문 */}
      <div className={frame} style={{ background: bg }}>
        <span className={lab}>B 본문</span>
        <div className={`${inner} items-start pt-[10cqw]`}>
          <b className="text-[5.2cqw] leading-tight" style={{ color: text }}>
            핵심 내용
          </b>
          <div className="mt-[3cqw] space-y-[2.2cqw]">
            {["첫째 포인트", "둘째 포인트", "셋째 포인트"].map((t) => (
              <p key={t} className="flex items-center gap-[2.4cqw] text-[3.8cqw] leading-none" style={{ color: text }}>
                <span className="h-[2.6cqw] w-[2.6cqw] shrink-0 rounded-sm" style={{ background: a1 }} />
                {t}
              </p>
            ))}
          </div>
        </div>
      </div>
      {/* C 데이터 */}
      <div className={frame} style={{ background: bg }}>
        <span className={lab}>C 데이터</span>
        <div className={`${inner} items-center pt-[10cqw]`}>
          <div className="flex gap-[5cqw]">
            {[["87%", pt], ["3.5배", a1]].map(([n, c]) => (
              <div key={n} className="rounded-md border px-[5cqw] py-[3cqw] text-center" style={{ borderColor: sub + "66" }}>
                <b className="block text-[9cqw] leading-none" style={{ color: c }}>
                  {n}
                </b>
                <span className="mt-[1.5cqw] block text-[3cqw]" style={{ color: sub }}>
                  지표
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* D 구조 */}
      <div className={frame} style={{ background: bg }}>
        <span className={lab}>D 구조</span>
        <div className={`${inner} items-center pt-[8cqw]`}>
          <div className="flex items-center gap-[2.5cqw]">
            {["입력", "처리", "결과"].map((t, i) => (
              <div key={t} className="flex items-center gap-[2.5cqw]">
                <span className="rounded-md border px-[3.6cqw] py-[2.4cqw] text-[3.8cqw] font-bold leading-none" style={{ color: text, borderColor: a1 }}>
                  {t}
                </span>
                {i < 2 && (
                  <span className="text-[4.4cqw] leading-none" style={{ color: a2 }}>
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 색 이름·코드 표 (원문의 색 정의처럼) */
function ColorTable({ d }: { d: Design }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="색 목록">
      {d.colors.map((c: Col, i: number) => (
        <li key={i} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-2">
          <span className="h-10 w-10 shrink-0 rounded-md border border-black/15" style={{ background: c.hex }} aria-hidden />
          <span className="min-w-0 text-sm leading-tight">
            <b className="block">{c.role}</b>
            <span className="block truncate text-muted">{c.name}</span>
            <code className="font-mono text-xs">{c.hex}</code>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** 대본 프롬프트의 변수 칸(대상·목적)을 채운다 */
function fill(t: string, audience: string, objective: string, infoObjective: string, step: string) {
  let r = t;
  if (audience.trim()) r = r.replace(/(Target Audience:\s*)[^\n]+/g, `$1${audience.trim()}`);
  if (step === "script" && objective.trim()) r = r.replace(/(Presentation Objective:\s*)[^\n]+/g, `$1${objective.trim()}`);
  if (step === "infoScript" && infoObjective.trim()) r = r.replace(/(Infographic Objective:\s*)[^\n]+/g, `$1${infoObjective.trim()}`);
  return r;
}

/** 칩 고르기 + 직접 입력 */
function Choice({
  label,
  options,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  options: { label: string; hint: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={value === o.label}
            title={o.hint}
            onClick={() => onChange(o.label)}
            className={`min-h-[40px] rounded-full border px-3 text-sm ${
              value === o.label ? "border-accent bg-accent text-accent-ink font-bold" : "border-line bg-surface hover:border-accent"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={`${label} 직접 입력`}
        className="mt-2 min-h-[44px] w-full rounded-card border border-line bg-surface px-3 outline-none focus:border-accent"
      />
    </div>
  );
}

const TABS = data.steps.filter((s) => s.id !== "design");

/** 노트북LM 슬라이드 프롬프트 — 디자인을 고르면 단계별 프롬프트가 채워진다 */
export default function SlidesPage() {
  const [sp, setSp] = useSearchParams();
  const first = sp.get("d");
  const [designId, setDesignId] = useState(data.designs.some((x) => x.id === first) ? (first as string) : data.designs[0].id);
  const [step, setStep] = useState(TABS.some((x) => x.id === sp.get("s")) ? (sp.get("s") as string) : TABS[0].id);
  const [count, setCount] = useState<"20" | "60">("20");
  const design = data.designs.find((x) => x.id === designId) ?? data.designs[0];
  const [audience, setAudience] = useState(design.audience);
  const [objective, setObjective] = useState(data.objectives[0].label);
  const [infoObjective, setInfoObjective] = useState(data.infoObjectives[0].label);
  const stepInfo = TABS.find((x) => x.id === step) ?? TABS[0];
  const designStep = data.steps.find((x) => x.id === "design")!;

  useEffect(() => {
    document.title = `노트북LM 슬라이드 프롬프트 · ${HUB_NAME}`;
  }, []);

  const pickDesign = (d: Design) => {
    setDesignId(d.id);
    setSp({ d: d.id, s: step }, { replace: true });
  };
  const pickStep = (id: string) => {
    setStep(id);
    setSp({ d: designId, s: id }, { replace: true });
  };

  const body =
    step === "script"
      ? count === "60" && design.script60
        ? design.script60
        : design.script20
      : step === "infoScript"
        ? design.infoScript
        : step === "slides"
          ? design.slides
          : design.infographic;
  const text = fill(body, audience, objective, infoObjective, step);
  const isScript = step === "script" || step === "infoScript";
  const idx = TABS.findIndex((x) => x.id === step);

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

        {/* 선택한 디자인: 색 목록 + 슬라이드 미리보기 + 단계 1 프롬프트 */}
        <section className="mt-5 rounded-card border-2 border-accent bg-surface p-5 sm:p-6" aria-label={`${design.name} 디자인`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-accent">선택한 디자인</p>
              <h3 className="text-2xl font-extrabold">{design.name}</h3>
              <p className="text-muted">{design.mood}</p>
            </div>
            <CopyButton text={design.design} label="📋 디자인 프롬프트 복사" />
          </div>

          <h4 className="mt-5 font-bold">사용하는 색</h4>
          <div className="mt-2">
            <ColorTable d={design} />
          </div>

          <h4 className="mt-5 font-bold">이렇게 꾸며져요 (예시)</h4>
          <div className="mt-2">
            <SlidePreview d={design} />
          </div>
          <p className="mt-1 text-xs text-muted">디자인 프롬프트의 색과 Type A~D 규칙을 적용한 모습의 예시예요. 실제 결과는 노트북LM이 만들어요.</p>

          <details className="mt-5">
            <summary className="min-h-[44px] cursor-pointer font-bold">{designStep.title} — 프롬프트 글</summary>
            <p className="mt-1 text-sm text-muted">{designStep.help}</p>
            <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-card bg-bg p-4 font-mono text-[0.85rem] leading-relaxed">
              {design.design}
            </pre>
          </details>
        </section>

        <h2 className="mt-8 text-xl font-bold">② 단계별 프롬프트 복사</h2>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 py-1.5" role="tablist" aria-label="단계">
          {TABS.map((s, i) => (
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

          {isScript && (
            <div className="mt-4 space-y-4 rounded-card bg-bg p-4">
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
              <Choice label="대상 (Target Audience)" options={data.audiences} value={audience} onChange={setAudience} placeholder="직접 입력 — 예) 특수교육 대상 학생" />
              {step === "script" && (
                <Choice
                  label="목적 (Presentation Objective)"
                  options={data.objectives}
                  value={objective}
                  onChange={setObjective}
                  placeholder="직접 입력 — 예) 학급 임원 연수 자료"
                />
              )}
              {step === "infoScript" && (
                <Choice
                  label="목적 (Infographic Objective)"
                  options={data.infoObjectives}
                  value={infoObjective}
                  onChange={setInfoObjective}
                  placeholder="직접 입력 — 예) 우리 학교 급식 안전 수칙 알리기"
                />
              )}
              <p className="text-xs text-muted">고르면 아래 프롬프트의 해당 칸이 바로 바뀌어요.</p>
            </div>
          )}

          <pre className="mt-4 max-h-[460px] overflow-auto whitespace-pre-wrap break-words rounded-card bg-bg p-4 font-mono text-[0.85rem] leading-relaxed">
            {text}
          </pre>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted">{text.length.toLocaleString()}자</span>
            <div className="flex gap-2">
              {idx > 0 && (
                <button type="button" onClick={() => pickStep(TABS[idx - 1].id)} className="min-h-[44px] rounded-card border border-line bg-surface px-4 font-semibold">
                  ← 이전 단계
                </button>
              )}
              {idx < TABS.length - 1 && (
                <button type="button" onClick={() => pickStep(TABS[idx + 1].id)} className="min-h-[44px] rounded-card bg-accent px-4 font-semibold text-accent-ink">
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
