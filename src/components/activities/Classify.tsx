import { useStored } from "../../lib/storage";
import { Button, Reveal } from "../ui";

export interface ClassifyProps {
  storeKey: string;
  categories: { id: string; label: string }[];
  items: { text: string; answer?: string | string[]; note?: string }[];
  withReason?: boolean;
  multi?: boolean;
  /** 정답 하나를 고집하지 않는 활동: 맞음/틀림 대신 "예시 답"으로만 보여 준다 */
  lenient?: boolean;
  tip?: string;
  example?: string;
}

type State = { picks: Record<number, string[] | string>; reasons: Record<number, string>; checked: boolean };

const asList = (a?: string | string[]) => (a == null ? [] : Array.isArray(a) ? a : [a]);

/** 항목을 칸으로 나누기 (덧붙임 분류·오해/의견 차이·이유 이름표 등). 끌어다 놓기 대신 칸 이름 버튼을 누른다. */
export default function Classify({ storeKey, categories, items, withReason, multi, lenient, tip, example }: ClassifyProps) {
  const [s, setS] = useStored<State>(storeKey, { picks: {}, reasons: {}, checked: false });
  const hasAnswers = items.some((it) => asList(it.answer).length > 0);
  const all = items.every((_, i) => asList(s.picks[i]).length > 0);
  const label = (id: string) => categories.find((c) => c.id === id)?.label ?? id;

  const toggle = (i: number, id: string) =>
    setS((p) => {
      const cur = asList(p.picks[i]);
      const next = multi ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id];
      return { ...p, picks: { ...p.picks, [i]: next }, checked: false };
    });

  return (
    <div>
      {tip && <p className="mb-3 text-sm text-muted">💡 {tip}</p>}
      <ul className="space-y-3">
        {items.map((it, i) => {
          const pick = asList(s.picks[i]);
          const ans = asList(it.answer);
          const right = ans.length > 0 && pick.length === ans.length && pick.every((p) => ans.includes(p));
          const showResult = s.checked && ans.length > 0;
          return (
            <li
              key={i}
              className={`rounded-card border-2 p-3 ${
                showResult && !lenient ? (right ? "border-ok" : "border-warn") : "border-line"
              }`}
            >
              <p className="font-semibold">{it.text}</p>
              <div
                className="mt-2 flex flex-wrap gap-2"
                role={multi ? "group" : "radiogroup"}
                aria-label={`${it.text} 고르기`}
              >
                {categories.map((c) => {
                  const on = pick.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role={multi ? "checkbox" : "radio"}
                      aria-checked={on}
                      onClick={() => toggle(i, c.id)}
                      className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${
                        on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:border-accent"
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {withReason && (
                <input
                  value={s.reasons[i] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setS((p) => ({ ...p, reasons: { ...p.reasons, [i]: v } }));
                  }}
                  placeholder="이유"
                  aria-label={`${it.text} 이유`}
                  className="mt-2 min-h-[44px] w-full rounded-card border border-line px-3 outline-none focus:border-accent"
                />
              )}
              {showResult && (
                <p className={`mt-2 text-sm ${lenient ? "text-muted" : right ? "text-ok" : "text-warn"}`}>
                  {lenient
                    ? `예시 답: ${ans.map(label).join(" · ")}`
                    : right
                      ? "✓ 예시 답과 같아요."
                      : `예시 답: ${ans.map(label).join(" · ")}`}
                  {it.note && ` — ${it.note}`}
                </p>
              )}
              {s.checked && ans.length === 0 && it.note && <p className="mt-2 text-sm text-muted">{it.note}</p>}
            </li>
          );
        })}
      </ul>
      {(hasAnswers || items.some((it) => it.note)) && (
        <div className="mt-3">
          <Button onClick={() => setS((p) => ({ ...p, checked: true }))} disabled={!all}>
            예시 답과 비교하기
          </Button>
        </div>
      )}
      {s.checked && (
        <p className="mt-2 text-sm text-muted">
          {lenient
            ? "이 활동은 정답이 하나가 아니에요. 왜 그렇게 골랐는지 이유를 이야기해 보세요."
            : "예시 답과 달라도 괜찮아요. 왜 그렇게 나눴는지 짝과 이야기해 보세요."}
        </p>
      )}
      {example && <Reveal label="교재 예시 답 보기">{example}</Reveal>}
    </div>
  );
}
