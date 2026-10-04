import { useStored } from "../../lib/storage";
import { Button, Reveal } from "../ui";

interface Props {
  storeKey: string;
  chunks: { text: string; verify?: boolean; where?: string }[];
  example?: string;
}

type State = { marked: number[]; where: Record<number, string>; checked: boolean };

/** 글에서 직접 확인해야 할 곳을 눌러 밑줄 긋고, 어디서 확인할지 적기 */
export default function MarkPassage({ storeKey, chunks, example }: Props) {
  const [s, setS] = useStored<State>(storeKey, { marked: [], where: {}, checked: false });
  const toggle = (i: number) =>
    setS((p) => ({
      ...p,
      marked: p.marked.includes(i) ? p.marked.filter((x) => x !== i) : [...p.marked, i].sort((a, b) => a - b),
      checked: false,
    }));
  const targets = chunks.map((c, i) => (c.verify ? i : -1)).filter((i) => i >= 0);
  const found = targets.filter((i) => s.marked.includes(i)).length;
  const extra = s.marked.filter((i) => !chunks[i]?.verify).length;

  return (
    <div>
      <p className="mb-2 text-sm text-muted">확인이 필요하다고 생각하는 부분을 눌러 밑줄을 그어요. 다시 누르면 지워져요.</p>
      <div className="rounded-card border border-line bg-bg p-4 leading-loose">
        {chunks.map((c, i) => {
          const on = s.marked.includes(i);
          const reveal = s.checked && c.verify && !on;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(i)}
              className={`inline min-h-0 rounded px-0.5 text-left align-baseline transition ${
                on
                  ? "bg-accent-soft underline decoration-accent decoration-[3px] underline-offset-4"
                  : reveal
                    ? "bg-warn-soft underline decoration-warn decoration-dashed underline-offset-4"
                    : "hover:bg-accent-soft/50"
              }`}
            >
              {c.text}
            </button>
          );
        })}
      </div>

      {s.marked.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="font-semibold">밑줄 그은 곳 — 어디서 확인할까요?</p>
          {s.marked.map((i) => (
            <div key={i} className="rounded-card border border-line p-3">
              <p className="text-sm">“{chunks[i].text.trim()}”</p>
              <input
                value={s.where[i] ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  setS((p) => ({ ...p, where: { ...p.where, [i]: v } }));
                }}
                placeholder="어디서 확인할까요?"
                aria-label="어디서 확인할까요?"
                className="mt-2 min-h-[44px] w-full rounded-card border border-line px-3 outline-none focus:border-accent"
              />
              {s.checked && chunks[i].where && <p className="mt-1 text-sm text-muted">예: {chunks[i].where}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <Button variant="soft" onClick={() => setS((p) => ({ ...p, checked: true }))} disabled={!s.marked.length}>
          예시와 비교하기
        </Button>
      </div>
      {s.checked && (
        <p className="mt-2 text-sm" aria-live="polite">
          확인이 필요한 곳 {targets.length}군데 중 <b>{found}군데</b>를 찾았어요.
          {found < targets.length && " 점선으로 표시된 곳도 살펴보세요."}
          {extra > 0 && " 다르게 고른 곳은 왜 확인이 필요하다고 생각했는지 이야기해 보세요."}
        </p>
      )}
      {example && <Reveal>{example}</Reveal>}
    </div>
  );
}
