import { useStored } from "../../lib/storage";
import { Button, Reveal } from "../ui";

interface Props {
  storeKey: string;
  rows?: string[];
  count?: number;
  cols?: string[];
  results?: string[];
  example?: string;
}

type Row = { fact: string; where: string; result: string };

/** 검증 표: 확인할 사실 / 확인한 곳 / 결과 */
export default function VerifyTable({
  storeKey,
  rows = [],
  count = 3,
  cols = ["확인할 사실", "어디서 확인할까요?", "결과"],
  results = ["맞음", "틀림", "확인 못 함"],
  example,
}: Props) {
  const initial: Row[] = Array.from({ length: Math.max(count, rows.length) }, (_, i) => ({
    fact: rows[i] ?? "",
    where: "",
    result: "",
  }));
  const [data, setData] = useStored<Row[]>(storeKey, initial);
  const set = (i: number, patch: Partial<Row>) =>
    setData((prev) => prev.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <div className="space-y-3">
        {data.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-card border border-line p-3 sm:grid-cols-[1fr_1fr_auto]">
            {rows[i] ? (
              <p className="font-semibold">
                <span className="block text-xs font-bold text-muted">{cols[0]}</span>
                {r.fact}
              </p>
            ) : (
              <label>
                <span className="block text-xs font-bold text-muted">{cols[0]}</span>
                <input
                  value={r.fact}
                  onChange={(e) => set(i, { fact: e.target.value })}
                  className="min-h-[44px] w-full rounded-card border border-line px-3 outline-none focus:border-accent"
                />
              </label>
            )}
            <label>
              <span className="block text-xs font-bold text-muted">{cols[1]}</span>
              <input
                value={r.where}
                onChange={(e) => set(i, { where: e.target.value })}
                className="min-h-[44px] w-full rounded-card border border-line px-3 outline-none focus:border-accent"
              />
            </label>
            <div>
              <span className="block text-xs font-bold text-muted">{cols[2]}</span>
              <div className="flex flex-wrap gap-1">
                {results.map((res) => (
                  <button
                    key={res}
                    type="button"
                    aria-pressed={r.result === res}
                    onClick={() => set(i, { result: r.result === res ? "" : res })}
                    className={`rounded-full border-2 px-2.5 text-sm font-semibold ${
                      r.result === res ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <Button variant="ghost" onClick={() => setData((prev) => [...prev, { fact: "", where: "", result: "" }])}>
          + 줄 더하기
        </Button>
      </div>
      {example && <Reveal>{example}</Reveal>}
    </div>
  );
}
