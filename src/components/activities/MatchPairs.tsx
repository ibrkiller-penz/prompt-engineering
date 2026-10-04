import { useMemo, useState } from "react";
import { useStored } from "../../lib/storage";
import { Button, Reveal } from "../ui";

interface Props {
  storeKey: string;
  pairs: { term: string; def: string }[];
  example?: string;
}

/** 낱말 ↔ 뜻 잇기. 낱말을 누르고 뜻을 누르면 연결되고, 바로 맞음/다시 생각을 알려 준다. 끌어다 놓기 없이 버튼만 쓴다. */
export default function MatchPairs({ storeKey, pairs, example }: Props) {
  // 뜻 순서는 섞되 매번 바뀌지 않게 고정한다
  const defs = useMemo(() => {
    const out = pairs.map((p) => p.def);
    let seed = 7;
    for (let i = out.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const j = seed % (i + 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }, [pairs]);
  const [matched, setMatched] = useStored<Record<string, string>>(storeKey, {});
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string | null>(null);

  const answer = (term: string) => pairs.find((p) => p.term === term)!.def;
  const usedDefs = new Set(Object.values(matched));
  const allDone = Object.keys(matched).length === pairs.length;

  const pickDef = (def: string) => {
    if (!picked) return;
    if (answer(picked) === def) {
      setMatched({ ...matched, [picked]: def });
      setPicked(null);
      setWrong(null);
    } else {
      setWrong(def);
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-muted">① 왼쪽 낱말을 누르고 ② 알맞은 뜻을 누르세요.</p>
      <div className="grid grid-cols-2 gap-2 text-[0.9rem] sm:gap-4 sm:text-base">
        <ul className="space-y-2" aria-label="낱말">
          {pairs.map((p) => {
            const done = matched[p.term];
            return (
              <li key={p.term}>
                <button
                  type="button"
                  disabled={!!done}
                  aria-pressed={picked === p.term}
                  onClick={() => {
                    setPicked(p.term);
                    setWrong(null);
                  }}
                  className={`w-full rounded-card border-2 px-3 py-2 text-left font-bold transition ${
                    done
                      ? "border-ok bg-ok-soft text-ok"
                      : picked === p.term
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:border-accent"
                  }`}
                >
                  {p.term}
                  {done && <span className="block text-sm font-normal">✓ {done}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2" aria-label="뜻">
          {defs.map((d) => (
            <li key={d}>
              <button
                type="button"
                disabled={usedDefs.has(d) || !picked}
                onClick={() => pickDef(d)}
                className={`w-full rounded-card border-2 px-3 py-2 text-left leading-snug transition disabled:opacity-40 ${
                  wrong === d ? "border-bad bg-bad-soft" : "border-line bg-surface hover:border-accent"
                }`}
              >
                {d}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 min-h-[1.5em]" aria-live="polite">
        {wrong && <span className="text-bad">다시 생각해 볼까요? 이야기 속 낱말 상자를 떠올려 보세요.</span>}
        {allDone && <span className="font-semibold text-ok">모두 맞췄어요! 이 낱말들은 13차시 내내 다시 나와요.</span>}
      </p>
      {Object.keys(matched).length > 0 && (
        <Button variant="ghost" onClick={() => setMatched({})}>
          처음부터 다시
        </Button>
      )}
      {example && <Reveal>{example}</Reveal>}
    </div>
  );
}
