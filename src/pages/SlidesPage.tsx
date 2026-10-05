import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import data from "../../content/slides/slides.json";
import { HUB_NAME } from "../site";
import { CopyButton } from "../components/ui";
import { VARIANTS, applyVariant, type Applied } from "./slideStyles";

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
/** 처음에 보이는 대표 디자인 (밝은 것·어두운 것·기관용이 섞이게) */
const FEATURED = ["busan-office", "classroom-bright", "paper-notes", "night-navy", "chalkboard-v2", "terracotta"];

/** 노트북LM 화면의 세 칸. active를 주면 붙여 넣을 칸을 강조한다 */
function PanelMap({ active }: { active?: 1 | 2 | 3 }) {
  const items = [
    { n: 1, name: "소스", sub: "자료를 올리는 곳" },
    { n: 2, name: "채팅", sub: "질문·대본을 붙여 넣는 곳" },
    { n: 3, name: "스튜디오", sub: "슬라이드를 만드는 곳" },
  ] as const;
  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="img"
      aria-label={`노트북LM 화면의 세 칸: 1번 소스, 2번 채팅, 3번 스튜디오.${active ? ` ${active}번에 붙여 넣어요.` : ""}`}
    >
      {items.map((it) => {
        const on = it.n === active;
        return (
          <div
            key={it.n}
            className={`rounded-card border-2 p-3 text-center ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-muted"}`}
          >
            <b className="block text-base leading-tight sm:text-lg">
              {it.n}번 {it.name}
            </b>
            <span className="mt-0.5 block text-xs leading-snug">{it.sub}</span>
            {on && <span className="mt-1 block text-xs font-bold">👇 여기예요</span>}
          </div>
        );
      })}
    </div>
  );
}

/** 탭마다 "어디에 붙여 넣고 그다음 무엇을 누르는지" (공식 도움말 기준) */
const PLACE: Record<string, { panel: 1 | 2 | 3; where: string; steps: string[] }> = {
  script: {
    panel: 2,
    where: "가운데 2번 채팅창에 붙여 넣어요",
    steps: [
      "1번 소스 칸에 수업 자료(파일·링크)를 먼저 올려 두세요.",
      "아래에서 대상·목적을 고르고 [📋 전체 복사]를 눌러요.",
      "2번 채팅창의 입력칸에 붙여 넣고 보내요. 슬라이드마다 제목·화면 텍스트·상세 대본이 나와요.",
      "마음에 드는 답변 아래 [메모에 저장]을 누르고, 메모를 열어 [소스로 변환]을 눌러요. 그러면 대본이 소스 목록에 들어와서 다음 단계가 이 대본을 읽어요.",
    ],
  },
  infoScript: {
    panel: 2,
    where: "가운데 2번 채팅창에 붙여 넣어요",
    steps: [
      "1번 소스 칸에 수업 자료(파일·링크)를 먼저 올려 두세요.",
      "아래에서 대상·목적을 고르고 [📋 전체 복사]를 눌러요.",
      "2번 채팅창의 입력칸에 붙여 넣고 보내요. 인포그래픽에 들어갈 짧은 글이 구역별로 나와요.",
      "답변 아래 [메모에 저장] → 메모를 열어 [소스로 변환]을 눌러요.",
    ],
  },
  slides: {
    panel: 3,
    where: "오른쪽 3번 스튜디오 · 슬라이드 맞춤설정의 '설명' 칸에 붙여 넣어요",
    steps: [
      "1번 소스 칸에서 변환한 '대본'만 체크하고 나머지 소스는 체크를 풀어 주세요. (추천: 대본대로 만들어져요)",
      "3번 스튜디오에서 '슬라이드 자료'의 연필(맞춤설정) 아이콘을 눌러요.",
      "형식은 발표용이면 '발표자 슬라이드', 읽는 자료면 '자세한 자료'. 언어는 '한국어'. 장수는 프롬프트가 정하니 길이는 '기본값'이면 돼요.",
      "'만들려는 슬라이드 자료에 대한 설명' 칸에 [📋 전체 복사]한 프롬프트를 붙여 넣어요.",
      "[지금 생성]을 눌러요. 몇 분 걸리고, 그동안 다른 작업을 해도 돼요.",
    ],
  },
  infographic: {
    panel: 3,
    where: "오른쪽 3번 스튜디오 · 인포그래픽 맞춤설정의 입력 칸에 붙여 넣어요",
    steps: [
      "1번 소스 칸에서 변환한 '인포그래픽 대본'만 체크하고 나머지는 체크를 풀어 주세요.",
      "3번 스튜디오에서 '인포그래픽'의 연필(맞춤설정) 아이콘을 눌러요.",
      "방향(가로·세로·정사각형), 세부 정보 수준, 언어('한국어')를 골라요.",
      "프롬프트 입력 칸에 [📋 전체 복사]한 글을 붙여 넣고 생성을 눌러요.",
    ],
  },
};

const GUIDE_STEPS: { t: string; d: string }[] = [
  { t: "노트북을 만들고 자료를 올려요", d: "노트북LM에서 새 노트북을 만들고, 왼쪽 1번 소스 칸의 [+ 추가]로 수업 자료(파일·링크)를 올려요." },
  { t: "이 페이지에서 디자인을 골라요", d: "아래 ① 디자인 고르기에서 마음에 드는 디자인을 눌러요. 디자인 지침은 노트북LM에 따로 넣지 않아요. 슬라이드 프롬프트(단계 3·4) 안에 이미 들어 있어요." },
  { t: "2번 채팅창에 '대본' 프롬프트를 붙여 넣어요", d: "② 단계의 '슬라이드 대본' 탭에서 대상·목적을 고르고 [📋 전체 복사] → 노트북LM 가운데 채팅창에 붙여 넣고 보내요." },
  { t: "대본을 '소스'로 바꿔요", d: "대본 답변 아래의 [메모에 저장]을 누르고, 메모를 열어 [소스로 변환]을 눌러요. 그다음 소스 칸에서 대본만 체크하고 나머지는 체크를 풀어요." },
  { t: "3번 스튜디오에 '슬라이드 프롬프트'를 붙여 넣어요", d: "스튜디오의 '슬라이드 자료' 연필 아이콘 → 형식·언어(한국어)·길이(기본값)를 고르고 → '만들려는 슬라이드 자료에 대한 설명' 칸에 '슬라이드 프롬프트' 탭의 글을 붙여 넣은 뒤 [지금 생성]. (그 탭 위쪽 '구성 방식' 메뉴에서 그래픽·도형·주요 내용·설명 위주 중 골라 복사할 수 있어요.)" },
  { t: "기다렸다가 고쳐요", d: "몇 분 걸려요. 완성되면 위쪽 수정 아이콘으로 슬라이드마다 고치고 [수정된 자료 생성]을 눌러요." },
  { t: "내려받아요", d: "점 세 개(⋮) 메뉴에서 PDF 또는 PowerPoint(.pptx)로 받아요. 인포그래픽도 같은 방법이고, 대본과 프롬프트만 '인포그래픽' 탭 것을 써요." },
];

/** 처음 쓰는 사람을 위한 순서 안내 */
function Guide() {
  return (
    <details open className="mt-6 rounded-card border border-line bg-surface p-5 sm:p-6">
      <summary className="min-h-[44px] cursor-pointer text-xl font-bold">📖 처음이세요? 이렇게 하세요 (7단계)</summary>
      <p className="mt-2 text-muted">
        노트북LM 화면은 세 칸이에요. 어느 칸에 무엇을 붙여 넣는지만 알면 쉬워요.
      </p>
      <div className="mt-3">
        <PanelMap />
      </div>
      <ol className="mt-5 space-y-3">
        {GUIDE_STEPS.map((s, i) => (
          <li key={s.t} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink" aria-hidden>
              {i + 1}
            </span>
            <div className="min-w-0">
              <b className="block">{s.t}</b>
              <p className="text-muted">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-card bg-bg p-4">
        <p className="font-bold">알아 두면 좋아요</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted">
          <li>한글이 어색하게 보이는 건 보통 글자가 많아서예요. 슬라이드 프롬프트 끝에 "각 슬라이드 본문은 3줄 이내, 짧은 키워드 중심으로 써 줘"를 덧붙이고, 형식은 '발표자 슬라이드'로 해 보세요.</li>
          <li>AI가 만들어서 사실과 다른 내용이나 어색한 그림이 있을 수 있어요. 수업에 쓰기 전에 꼭 읽어 보세요.</li>
          <li>노트북LM은 만 18세 이상만 쓸 수 있어요(공식 도움말). 학생에게는 선생님 계정으로 만든 결과물을 나눠 주세요.</li>
        </ul>
      </div>
      <p className="mt-4 text-xs text-muted">
        참고: 공식 도움말{" "}
        <a className="underline" href="https://support.google.com/notebooklm/answer/16757456?hl=ko" target="_blank" rel="noopener">
          슬라이드 자료 만들기
        </a>
        ,{" "}
        <a className="underline" href="https://support.google.com/notebooklm/answer/16262519?hl=ko" target="_blank" rel="noopener">
          메모를 소스로 변환
        </a>
        ,{" "}
        <a className="underline" href="https://support.google.com/notebooklm/answer/16206563?hl=ko" target="_blank" rel="noopener">
          화면 구성과 소스 선택
        </a>
        . 화면 이름은 노트북LM 업데이트에 따라 조금 달라질 수 있어요.
      </p>
    </details>
  );
}

/** 노트북LM 슬라이드 프롬프트 — 디자인을 고르면 단계별 프롬프트가 채워진다 */
export default function SlidesPage() {
  const [sp, setSp] = useSearchParams();
  const first = sp.get("d");
  const [designId, setDesignId] = useState(data.designs.some((x) => x.id === first) ? (first as string) : data.designs[0].id);
  const [step, setStep] = useState(TABS.some((x) => x.id === sp.get("s")) ? (sp.get("s") as string) : TABS[0].id);
  const [count, setCount] = useState<"20" | "60">("20");
  const design = data.designs.find((x) => x.id === designId) ?? data.designs[0];
  const [more, setMore] = useState(false);
  const [openDesign, setOpenDesign] = useState(true); // 선택한 디자인 카드: 처음엔 펼침, 접기 버튼으로 접는다
  const [variantId, setVariantId] = useState(VARIANTS.some((x) => x.id === sp.get("v")) ? (sp.get("v") as string) : VARIANTS[0].id);
  // 대표만 보이되, 선택한 디자인이 대표가 아니면 함께 보여 준다
  const shown = more ? data.designs : data.designs.filter((d) => FEATURED.includes(d.id) || d.id === design.id);
  const [audience, setAudience] = useState(design.audience);
  const [objective, setObjective] = useState(data.objectives[0].label);
  const [infoObjective, setInfoObjective] = useState(data.infoObjectives[0].label);
  const stepInfo = TABS.find((x) => x.id === step) ?? TABS[0];
  const designStep = data.steps.find((x) => x.id === "design")!;

  useEffect(() => {
    document.title = `노트북LM 슬라이드 프롬프트 · ${HUB_NAME}`;
  }, []);

  const urlOf = (o: { d?: string; s?: string; v?: string }) => {
    const r: Record<string, string> = { d: o.d ?? designId, s: o.s ?? step };
    const v = o.v ?? variantId;
    if (v !== VARIANTS[0].id) r.v = v;
    return r;
  };
  const pickDesign = (d: Design) => {
    setDesignId(d.id);
    setSp(urlOf({ d: d.id }), { replace: true });
  };
  const pickStep = (id: string) => {
    setStep(id);
    setSp(urlOf({ s: id }), { replace: true });
  };
  const pickVariant = (id: string) => {
    setVariantId(id);
    setSp(urlOf({ v: id }), { replace: true });
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
  const isFinal = step === "slides" || step === "infographic";
  const variant = VARIANTS.find((x) => x.id === variantId) ?? VARIANTS[0];
  const applied: Applied = isFinal
    ? applyVariant(fill(body, audience, objective, infoObjective, step), variant, step as "slides" | "infographic")
    : { text: fill(body, audience, objective, infoObjective, step), start: -1, end: -1 };
  const text = applied.text;
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
        <Guide />

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-bold">① 디자인 고르기</h2>
          <span className="text-sm text-muted">{data.designs.length}가지 중에서 골라요</span>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6" role="radiogroup" aria-label="디자인">
          {shown.map((d) => {
            const on = d.id === design.id;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickDesign(d)}
                  className={`block h-full w-full rounded-card border-2 bg-surface p-2 text-left transition ${
                    on ? "border-accent shadow-md" : "border-line hover:border-accent/60"
                  }`}
                >
                  <Swatch d={d} />
                  <span className="mt-1.5 block text-sm font-bold leading-tight">{d.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {data.designs.length > FEATURED.length && (
          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            className="mt-2 inline-flex min-h-[44px] items-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            {more ? "▲ 접기" : `▼ 더보기 (+${data.designs.length - FEATURED.length}개)`}
          </button>
        )}

        {/* 선택한 디자인: 색 목록 + 슬라이드 미리보기 + 단계 1 프롬프트 */}
        <section className="mt-5 rounded-card border-2 border-accent bg-surface p-5 sm:p-6" aria-label={`${design.name} 디자인`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-accent">선택한 디자인</p>
              <h3 className="text-2xl font-extrabold">{design.name}</h3>
              <p className="text-muted">{design.mood}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOpenDesign((o) => !o)}
                aria-expanded={openDesign}
                aria-controls="design-detail"
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-accent hover:bg-accent-soft"
              >
                {openDesign ? "▲ 접기" : "▼ 펼치기"}
              </button>
              <CopyButton text={design.design} label="📋 디자인 글 복사" />
            </div>
          </div>
          <p className="mt-2 text-sm text-muted">디자인 글은 노트북LM에 따로 넣지 않아요. 아래 슬라이드·인포그래픽 프롬프트 안에 이미 들어 있어요.</p>

          {openDesign && (
            <div id="design-detail">
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
                <summary className="min-h-[44px] cursor-pointer font-bold">{designStep.title} — 디자인 글</summary>
                <p className="mt-1 text-sm text-muted">{designStep.help}</p>
                <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-card bg-bg p-4 font-mono text-[0.85rem] leading-relaxed">
                  {design.design}
                </pre>
              </details>
            </div>
          )}
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

          {isFinal && (
            <div className="mt-4 rounded-card border-2 border-accent bg-bg p-4">
              <label htmlFor="variant" className="block font-bold">
                ✨ 구성 방식 고르기
              </label>
              <p className="text-sm text-muted">고르면 아래 프롬프트가 바뀌고, 위의 [📋 전체 복사]를 누르면 고른 방식으로 복사돼요.</p>
              <select
                id="variant"
                value={variant.id}
                onChange={(e) => pickVariant(e.target.value)}
                className="mt-2 min-h-[48px] w-full rounded-card border border-line bg-surface px-3 text-base font-semibold outline-none focus:border-accent sm:max-w-md"
              >
                {[...new Set(VARIANTS.map((o) => o.group))].map((g) => (
                  <optgroup key={g} label={g}>
                    {VARIANTS.filter((o) => o.group === g).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.icon} {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-3 font-semibold">{variant.hint}</p>
              <p className="mt-1 text-sm text-muted">
                이럴 때 좋아요: {variant.when}
                <br />
                노트북LM 맞춤설정의 형식은 <b className="text-ink">'{variant.format}'</b>을(를) 고르면 잘 어울려요.
              </p>
              {variant.ko.length > 0 && (
                <div className="mt-3 rounded-lg bg-yellow-100/70 p-3 text-sm text-black dark:bg-yellow-200/20 dark:text-ink">
                  <b>이 방식에서 프롬프트 끝에 더해지는 지침</b>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {variant.ko.map((k) => (
                      <li key={k}>{k}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">아래 글에서 노란 줄로 표시된 부분이에요.</p>
                </div>
              )}
            </div>
          )}

          {PLACE[step] && (
            <div className="mt-4 rounded-card border border-accent bg-accent-soft/40 p-4">
              <p className="font-bold">📍 {PLACE[step].where}</p>
              <div className="mt-2">
                <PanelMap active={PLACE[step].panel} />
              </div>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5">
                {PLACE[step].steps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            </div>
          )}

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
            {applied.start >= 0 ? (
              <>
                {text.slice(0, applied.start)}
                <mark className="block rounded bg-yellow-200 px-1 text-black">{text.slice(applied.start + 1, applied.end)}</mark>
                {text.slice(applied.end)}
              </>
            ) : (
              text
            )}
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
