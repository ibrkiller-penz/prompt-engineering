import { useStored } from "../../lib/storage";
import { Button } from "../ui";

interface Props {
  storeKey: string;
  items: { text: string; restate: boolean; why: string }[];
  meanings?: { phrase: string; question: string; options: string[]; after: string };
}

type State = { picks: Record<number, boolean>; meanings: string[]; showMeanings: boolean };

/** 되말하기인지 아닌지 골라내기 + 모호한 말에 숨은 여러 해석 고르기 */
export default function RestateCheck({ storeKey, items, meanings }: Props) {
  const [s, setS] = useStored<State>(storeKey, { picks: {}, meanings: [], showMeanings: false });

  return (
    <div>
      <ul className="space-y-3">
        {items.map((it, i) => {
          const pick = s.picks[i];
          const answered = pick !== undefined;
          const right = pick === it.restate;
          return (
            <li key={i} className="rounded-card border border-line p-3">
              <p className="font-semibold">“{it.text}”</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  { v: true, label: "되말하기예요" },
                  { v: false, label: "무엇을 이해했는지 안 보여요" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    aria-pressed={pick === o.v}
                    onClick={() => setS((p) => ({ ...p, picks: { ...p.picks, [i]: o.v } }))}
                    className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${
                      pick === o.v ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-accent"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {answered && (
                <p className={`mt-2 text-sm ${right ? "text-ok" : "text-bad"}`} aria-live="polite">
                  {right ? "✓ " : "다시 생각해 볼까요? "}
                  {it.why}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {meanings && (
        <div className="mt-6 rounded-card bg-bg p-4">
          <p className="font-semibold">{meanings.question}</p>
          <div className="mt-2 space-y-1">
            {meanings.options.map((o) => (
              <label key={o} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 accent-[var(--accent)]"
                  checked={s.meanings.includes(o)}
                  onChange={(e) =>
                    setS({
                      ...s,
                      meanings: e.target.checked ? [...s.meanings, o] : s.meanings.filter((x) => x !== o),
                    })
                  }
                />
                {o}
              </label>
            ))}
          </div>
          <Button variant="soft" className="mt-2" onClick={() => setS({ ...s, showMeanings: true })} disabled={!s.meanings.length}>
            확인하기
          </Button>
          {s.showMeanings && <p className="mt-3 text-ok">{meanings.after}</p>}
        </div>
      )}
    </div>
  );
}
