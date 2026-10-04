import { useState } from "react";
import { Link } from "react-router-dom";
import type { Block, StoryScene, Table, Word } from "../../content/types";
import { useStored } from "../../lib/storage";
import { Bubble, Button, Card, CopyButton, Label, Rich, TextArea } from "../ui";
import { Activity } from "../activities/Activity";

const ICONS: Record<string, string> = {
  shirt: "👕",
  map: "🗺️",
  scissors: "✂️",
  cake: "🎂",
};

function BlockTitle({ tag, title }: { tag: string; title?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Label>{tag}</Label>
      {title && <h2 className="text-xl font-bold">{title}</h2>}
    </div>
  );
}

function TableView({ table }: { table: Table }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-[0.95rem]">
        {table.headers.some(Boolean) && (
          <thead>
            <tr>
              {table.headers.map((h, i) => (
                <th key={i} className="border-b-2 border-accent bg-accent-soft/60 px-3 py-2 text-left font-bold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-line px-3 py-2 ${j === 0 ? "font-semibold" : ""}`}>
                  <Rich text={c} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WordCard({ w }: { w: Word }) {
  return (
    <div className="rounded-card border border-accent/30 bg-accent-soft/50 p-3">
      <p className="font-bold text-accent">낱말 · {w.term}</p>
      <p className="mt-1">{w.def}</p>
      {w.example && <p className="mt-1 text-sm text-muted">예) {w.example}</p>}
    </div>
  );
}

function Story({ title, intro, scenes, storeKey }: { title: string; intro?: string; scenes: StoryScene[]; storeKey: string }) {
  const [i, setI] = useState(0);
  const [memo, setMemo] = useStored(storeKey, "");
  const scene = scenes[i];
  return (
    <Card>
      <BlockTitle tag="이야기" title={title} />
      {intro && <p className="mb-4 text-muted">{intro}</p>}
      {scenes.length > 1 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => setI(i - 1)} disabled={i === 0}>
            ← 이전
          </Button>
          <span className="text-sm font-semibold text-muted" aria-live="polite">
            장면 {i + 1} / {scenes.length}
          </span>
          <Button onClick={() => setI(i + 1)} disabled={i === scenes.length - 1}>
            다음 →
          </Button>
        </div>
      )}
      <div className="rounded-card bg-bg p-4">
        {scene.title && <p className="mb-3 font-bold">{scene.title}</p>}
        <div className="space-y-3">
          {scene.lines.map((l, k) => (
            <Bubble key={k} speaker={l.speaker} text={l.text} />
          ))}
        </div>
      </div>
      {scene.words && scene.words.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {scene.words.map((w) => (
            <WordCard key={w.term} w={w} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <TextArea label="✎ 생각 메모" value={memo} onChange={setMemo} placeholder="떠오른 생각을 적어 보세요" />
      </div>
    </Card>
  );
}

function SelfCheck({ items, storeKey }: { items: string[]; storeKey: string }) {
  const [checked, setChecked] = useStored<boolean[]>(storeKey, []);
  return (
    <Card>
      <BlockTitle tag="정리" title="스스로 점검해요" />
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-6 w-6 shrink-0 accent-[var(--accent)]"
                checked={!!checked[i]}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  setChecked(next);
                }}
              />
              <span>{it}</span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TodaySentence({ text, level }: { text: string; level: string }) {
  return (
    <section className="rounded-card bg-accent p-6 text-accent-ink sm:p-8">
      <p className="text-sm font-semibold opacity-90">오늘의 한 문장 — AI에게 이렇게 말해 보세요</p>
      <p className="mt-3 text-xl font-extrabold leading-snug sm:text-2xl">“{text}”</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <CopyButton text={text} label="문장 복사" />
        <Link
          to={`/prompt/${level}/lab?try=${encodeURIComponent(text)}`}
          className="btn inline-flex items-center rounded-card bg-white/15 px-4 font-semibold text-accent-ink hover:bg-white/25"
        >
          실험실에서 써 보기 →
        </Link>
      </div>
    </section>
  );
}

function Note({ prompt, storeKey }: { prompt: string; storeKey: string }) {
  const [v, setV] = useStored(storeKey, "");
  return (
    <Card>
      <BlockTitle tag="메모" title="나의 생각 노트" />
      <p className="mb-2 text-muted">{prompt}</p>
      <TextArea value={v} onChange={setV} rows={4} />
      <p className="mt-1 text-xs text-muted">이 기기에만 저장돼요.</p>
    </Card>
  );
}

export function BlockView({ block, storeKey, level }: { block: Block; storeKey: string; level: string }) {
  switch (block.type) {
    case "think":
      return (
        <Card>
          <BlockTitle tag="생각 열기" />
          <ul className="list-disc space-y-1 pl-5">
            {block.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
          <ThinkMemo storeKey={storeKey} />
        </Card>
      );
    case "story":
      return <Story title={block.title} intro={block.intro} scenes={block.scenes} storeKey={storeKey} />;
    case "explain":
      return (
        <Card>
          <BlockTitle tag="알아보기" title={block.title} />
          <div className="space-y-3">
            {block.body?.map((p, i) => (
              <p key={i}>
                <Rich text={p} />
              </p>
            ))}
          </div>
          {block.steps && (
            <ol className="mt-3 space-y-2">
              {block.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
          {block.table && <TableView table={block.table} />}
          {block.dialogue && (
            <div className="mt-4 space-y-3 rounded-card bg-bg p-4">
              {block.dialogue.map((l, i) => (
                <Bubble key={i} speaker={l.speaker} text={l.text} />
              ))}
            </div>
          )}
          {block.after && (
            <div className="mt-3 space-y-3">
              {block.after.map((p, i) => (
                <p key={i}>
                  <Rich text={p} />
                </p>
              ))}
            </div>
          )}
        </Card>
      );
    case "words":
      return (
        <Card>
          <BlockTitle tag="오늘의 낱말" />
          <div className="grid gap-2 sm:grid-cols-2">
            {block.words.map((w) => (
              <WordCard key={w.term} w={w} />
            ))}
          </div>
        </Card>
      );
    case "analogy":
      return (
        <Card className="border-dashed">
          <div className="flex gap-4">
            <div aria-hidden className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-card bg-accent-soft text-3xl sm:flex">
              {ICONS[block.icon ?? ""] ?? "💡"}
            </div>
            <div>
              <BlockTitle tag="생활 속 비유" title={block.title} />
              <div className="space-y-3">
                {block.body.map((p, i) => (
                  <p key={i}>
                    <Rich text={p} />
                  </p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      );
    case "remember":
      return (
        <section className="rounded-card border-l-8 border-accent bg-accent-soft p-5">
          <p className="font-bold text-accent">꼭 기억해요</p>
          <ul className="mt-2 space-y-1.5">
            {block.items.map((it) => (
              <li key={it} className="font-semibold">
                • {it}
              </li>
            ))}
          </ul>
        </section>
      );
    case "promise":
      return (
        <Card>
          <BlockTitle tag="약속" title={block.title} />
          <ol className="space-y-3">
            {block.items.map((it, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink">
                  {i + 1}
                </span>
                <div>
                  <p className="font-bold">{it.title}</p>
                  <p className="text-muted">{it.body}</p>
                </div>
              </li>
            ))}
          </ol>
          {block.note && <p className="mt-4 text-sm text-muted">{block.note}</p>}
        </Card>
      );
    case "activity":
      return <Activity block={block} storeKey={storeKey} />;
    case "selfcheck":
      return <SelfCheck items={block.items} storeKey={storeKey} />;
    case "todaySentence":
      return <TodaySentence text={block.text} level={level} />;
    case "note":
      return <Note prompt={block.prompt} storeKey={storeKey} />;
    default:
      return null;
  }
}

function ThinkMemo({ storeKey }: { storeKey: string }) {
  const [v, setV] = useStored(storeKey, "");
  return (
    <div className="mt-3">
      <TextArea value={v} onChange={setV} placeholder="짧게 메모해 보세요 (이 기기에만 저장)" />
    </div>
  );
}
