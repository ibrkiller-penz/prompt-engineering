import { useStored } from "../../lib/storage";
import { Button, Reveal } from "../ui";

interface Props {
  storeKey: string;
  categories: { id: string; label: string }[];
  items: { text: string; answer: string; note?: string }[];
  example?: string;
  tip?: string;
}

type State = { picks: Record<number, string>; checked: boolean };

/** AI 답의 내용을 칸으로 나누기. 끌어다 놓기 대신 칸 이름 버튼을 눌러 고른다. */
export default function SortExtras({ storeKey, categories, items, example, tip }: Props) {
  const [s, setS] = useStored<State>(storeKey, { picks: {}, checked: false });
  const all = items.every((_, i) => s.picks[i]);

  return (
    <div>
      {tip && <p className="mb-3 text-sm text-muted">💡 {tip}</p>}
      <ul className="space-y-3">
        {items.map((it, i) => {
          const pick = s.picks[i];
          const right = s.checked && pick === it.answer;
          return (
            <li
              key={i}
              className={`rounded-card border-2 p-3 ${s.checked ? (right ? "border-ok" : "border-warn") : "border-line"}`}
            >
              <p className="font-semibold">{it.text}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={`${it.text} 분류`}>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={pick === c.id}
                    onClick={() => setS((p) => ({ picks: { ...p.picks, [i]: c.id }, checked: false }))}
                    className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${
                      pick === c.id ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-accent"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {s.checked && (
                <p className={`mt-2 text-sm ${right ? "text-ok" : "text-warn"}`}>
                  {right ? "✓ 예시 답과 같아요." : `예시 답: ${categories.find((c) => c.id === it.answer)?.label}`}
                  {it.note && ` ${it.note}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Button onClick={() => setS({ ...s, checked: true })} disabled={!all}>
          예시 답과 비교하기
        </Button>
      </div>
      {s.checked && (
        <p className="mt-2 text-sm text-muted">
          예시 답과 달라도 괜찮아요. 왜 그렇게 나눴는지 짝과 이야기해 보세요.
        </p>
      )}
      {example && <Reveal label="교재 예시 답 보기">{example}</Reveal>}
    </div>
  );
}
