import { Suspense, useState } from "react";
import RichMath, { MathLine } from "./RichMath";
import type { Block } from "./types";
import { WIDGETS } from "./widgets";

const CALLOUT = {
  tip: { icon: "💡", label: "요령", box: "border-accent/40 bg-accent-soft", text: "text-accent" },
  warn: { icon: "⚠️", label: "흔한 실수", box: "border-warn/40 bg-warn-soft", text: "text-warn" },
  aha: { icon: "✨", label: "아하!", box: "border-ok/40 bg-ok-soft", text: "text-ok" },
  try: { icon: "✏️", label: "직접 해 보기", box: "border-line bg-bg", text: "text-ink" },
} as const;

/** 대화 말풍선의 이름 색(이름마다 고정) */
const WHO_COLORS: Record<string, string> = {
  서하: "bg-rose-100 text-rose-800",
  도윤: "bg-sky-100 text-sky-800",
  하은: "bg-fuchsia-100 text-fuchsia-800",
  지후: "bg-amber-100 text-amber-800",
  "유 선생님": "bg-emerald-100 text-emerald-800",
  비트: "bg-violet-100 text-violet-800",
};

function Example({ b }: { b: Extract<Block, { t: "example" }> }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-5 rounded-card border border-line bg-surface p-4" aria-label="예제">
      <p className="text-sm font-extrabold text-accent">{b.title}</p>
      <p className="mt-2 font-semibold leading-relaxed"><RichMath text={b.problem} /></p>
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-[44px] rounded-card bg-accent px-4 font-bold text-accent-ink hover:brightness-110">
          먼저 풀어 보고, 풀이 보기
        </button>
      ) : (
        <div className="mt-3 rounded-card bg-bg p-3">
          <ol className="space-y-1.5">
            {b.steps.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink">{i + 1}</span>
                <span className="leading-relaxed"><RichMath text={s} /></span>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-line pt-2 font-bold">답 · <span className="text-accent"><RichMath text={b.answer} /></span></p>
          <button type="button" onClick={() => setOpen(false)} className="mt-1 text-sm font-semibold text-muted underline underline-offset-2">풀이 접기</button>
        </div>
      )}
    </section>
  );
}

export function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "p":
      return <p className="mt-3 leading-[1.85]"><RichMath text={b.text} /></p>;
    case "math":
      return (
        <div className="mt-3 rounded-card bg-bg px-3 py-2">
          {(Array.isArray(b.tex) ? b.tex : [b.tex]).map((t, i) => <MathLine key={i} tex={t} />)}
        </div>
      );
    case "term":
      return (
        <div className="mt-3 rounded-card border-l-4 border-accent bg-accent-soft/70 px-4 py-3">
          <p className="text-xs font-extrabold tracking-wide text-accent">용어</p>
          <p className="mt-0.5 leading-relaxed"><b className="text-lg">{b.term}</b> <span className="text-muted">·</span> <RichMath text={b.def} /></p>
        </div>
      );
    case "callout": {
      const c = CALLOUT[b.kind];
      return (
        <aside className={`mt-4 rounded-card border p-3.5 ${c.box}`} role="note">
          <p className={`text-sm font-extrabold ${c.text}`}><span aria-hidden>{c.icon}</span> {b.title ?? c.label}</p>
          <p className="mt-1 leading-relaxed"><RichMath text={b.text} /></p>
        </aside>
      );
    }
    case "table":
      return (
        <div className="mt-4 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[20rem] border-collapse text-left text-[0.95rem]">
            {b.caption && <caption className="px-3 py-2 text-left text-sm font-bold text-muted"><RichMath text={b.caption} /></caption>}
            <thead>
              <tr className="bg-bg">{b.head.map((h, i) => <th key={i} scope="col" className="border-b border-line px-3 py-2 font-bold"><RichMath text={h} /></th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={`border-b border-line px-3 py-2 align-top ${j === 0 ? "font-semibold" : ""}`}><RichMath text={c} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag className={`mt-3 space-y-1.5 pl-6 leading-relaxed ${b.ordered ? "list-decimal" : "list-disc"} marker:text-accent`}>
          {b.items.map((x, i) => <li key={i}><RichMath text={x} /></li>)}
        </Tag>
      );
    }
    case "example":
      return <Example b={b} />;
    case "dialog":
      return (
        <div className="mt-4 space-y-2.5" role="group" aria-label="대화">
          {b.lines.map((l, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className={`mt-0.5 shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold ${WHO_COLORS[l.who] ?? "bg-line text-ink"}`}>{l.who}</span>
              <p className="rounded-2xl rounded-tl-sm bg-bg px-3.5 py-2 leading-relaxed"><RichMath text={l.text} /></p>
            </div>
          ))}
        </div>
      );
    case "widget": {
      const W = WIDGETS[b.id];
      return (
        <figure className="mt-5">
          <Suspense fallback={<div className="rounded-card border border-dashed border-line p-4 text-muted">체험 도구를 불러오는 중…</div>}>
            <W />
          </Suspense>
          {b.caption && <figcaption className="mt-2 text-sm text-muted"><RichMath text={b.caption} /></figcaption>}
        </figure>
      );
    }
  }
}

export function Blocks({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((b, i) => <BlockView key={i} b={b} />)}</>;
}
