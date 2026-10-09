import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";
import { allPrime, divisorPairs, isComposite, isPrime, leaves, powerForm, primeFactors, split, type TNode } from "./factortree.logic";

const UNIT = 58;
const GAP = 66;
const R_W = 44;
const R_H = 34;
const PRESETS = [36, 60, 144, 180, 210];

const newTarget = (not?: number) => {
  let n = 0;
  do n = 12 + rand(189);
  while (!isComposite(n) || n === not);
  return n;
};
const fresh = (n: number): TNode[] => [{ id: 0, v: n, kids: null }];

type Rec = { steps: string[]; leaves: number[] };

function layout(nodes: TNode[]) {
  const w = (id: number): number => {
    const n = nodes[id];
    return n.kids ? w(n.kids[0]) + w(n.kids[1]) : 1;
  };
  const pos = new Map<number, { x: number; y: number }>();
  let maxD = 0;
  const go = (id: number, left: number, d: number) => {
    const n = nodes[id];
    const ww = w(id);
    pos.set(id, { x: (left + ww / 2) * UNIT, y: d * GAP + R_H / 2 + 6 });
    maxD = Math.max(maxD, d);
    if (n.kids) {
      go(n.kids[0], left, d + 1);
      go(n.kids[1], left + w(n.kids[0]), d + 1);
    }
  };
  go(0, 0, 0);
  return { pos, width: w(0) * UNIT, height: (maxD + 1) * GAP - (GAP - R_H) + 12 };
}

export default function FactorTreeGame() {
  const [first] = useState(() => newTarget());
  const [target, setTarget] = useState(first);
  const [nodes, setNodes] = useState<TNode[]>(() => fresh(first));
  const [order, setOrder] = useState<number[]>([]); // 쪼갠 노드 id 순서
  const [sel, setSel] = useState<number | null>(0);
  const [hist, setHist] = useState<Rec[]>([]);
  const [solved, setSolved] = useState(false);
  const [quiz, setQuiz] = useState<null | boolean>(null);
  const [score, setScore] = useState({ solved: 0, quiz: 0 });
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "" });

  const tree = nodes;
  const lay = useMemo(() => layout(tree), [tree]);
  const lv = leaves(tree);

  const startTarget = (n: number) => {
    setTarget(n);
    setNodes(fresh(n));
    setOrder([]);
    setSel(0);
    setHist([]);
    setSolved(false);
    setQuiz(null);
    setMsg({ t: "info", s: `${n} 을(를) 소수가 될 때까지 쪼개 봐요. 색칠된 카드를 눌러 선택하세요.` });
  };
  const again = () => {
    setNodes(fresh(target));
    setOrder([]);
    setSel(0);
    setSolved(false);
    setQuiz(null);
    setMsg({ t: "info", s: "이번엔 처음과 다른 순서로 쪼개 봐요. 결과가 같을까요?" });
  };
  const undo = () => {
    if (!order.length || solved) return;
    const last = order[order.length - 1];
    setNodes(tree.slice(0, -2).map((x) => (x.id === last ? { ...x, kids: null } : x)));
    setOrder(order.slice(0, -1));
    setSel(last);
    setMsg({ t: "info", s: "한 번 되돌렸어요." });
  };
  const tapNode = (id: number) => {
    const n = tree[id];
    if (solved) return;
    if (n.kids) setMsg({ t: "info", s: `${n.v} 은(는) 이미 쪼갰어요. 아래쪽 카드를 눌러 봐요.` });
    else if (isPrime(n.v)) setMsg({ t: "ok", s: `${n.v} 은(는) 소수예요. 1과 자기 자신으로만 나누어져서 더 쪼갤 수 없어요.` });
    else {
      setSel(id);
      setMsg({ t: "info", s: `${n.v} 을(를) 어떻게 쪼갤까요? 아래에서 곱셈식을 골라요.` });
    }
  };
  const doSplit = (a: number, b: number) => {
    if (sel === null) return;
    const next = split(tree, sel, a, b);
    if (!next) return;
    const ord = [...order, sel];
    setNodes(next);
    setOrder(ord);
    const comp = next.filter((x) => !x.kids && isComposite(x.v));
    if (allPrime(next)) {
      const l = leaves(next);
      const rec: Rec = { steps: ord.map((id) => `${next[id].v}=${next[next[id].kids![0]].v}×${next[next[id].kids![1]].v}`), leaves: [...l].sort((x, y) => x - y) };
      const h = [...hist, rec];
      setHist(h);
      setSolved(true);
      setSel(null);
      setScore((s) => ({ ...s, solved: s.solved + 1 }));
      const same = h.length >= 2 && h.every((r) => r.leaves.join() === rec.leaves.join());
      setMsg({
        t: "ok",
        s: `성공! 모든 잎이 소수예요. ${target} = ${rec.leaves.join("×")} = ${powerForm(rec.leaves)}` + (h.length >= 2 ? (same ? ` — 쪼갠 순서가 달라도 결과가 같아요, 대단해요!` : "") : ""),
      });
    } else {
      setSel(comp.length ? comp[0].id : null);
      setMsg({ t: "info", s: `${a} × ${b} 로 쪼갰어요. ${[a, b].filter(isPrime).map((p) => `${p}`).join(", ")}${[a, b].some(isPrime) ? " 은(는) 소수라 초록색으로 굳었어요." : ""}` });
    }
  };
  const startCustom = () => {
    const n = parseInt(custom, 10);
    if (!Number.isInteger(n) || n < 12 || n > 200) setMsg({ t: "bad", s: "12부터 200까지의 수를 적어 주세요." });
    else if (!isComposite(n)) setMsg({ t: "bad", s: `${n} 은(는) 소수라서 쪼갤 수 없어요. 합성수를 골라 봐요.` });
    else startTarget(n);
  };

  const pairs = sel !== null && tree[sel] && !tree[sel].kids ? divisorPairs(tree[sel].v) : [];
  const finalLeaves = [...lv].sort((a, b) => a - b);
  const sameAll = hist.length >= 2 && hist.every((r) => r.leaves.join() === hist[0].leaves.join());

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="목표 수" value={target} />
        <Stat label="푼 판" value={score.solved} tone={score.solved ? "ok" : "plain"} />
        <Stat label="잎 세기 정답" value={score.quiz} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GButton variant="primary" onClick={() => startTarget(newTarget(target))}>새 문제</GButton>
        {PRESETS.map((n) => (
          <GButton key={n} variant="soft" pressed={n === target} onClick={() => startTarget(n)} className="px-3">{n}</GButton>
        ))}
      </div>
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          startCustom();
        }}
      >
        <label className="flex items-center gap-2 text-sm font-semibold">
          직접 고르기
          <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" placeholder="12~200" aria-label="쪼갤 수 직접 입력" className="min-h-[44px] w-24 rounded-card border border-line bg-surface px-3 text-base" />
        </label>
        <GButton onClick={startCustom}>이 수로 시작</GButton>
      </form>

      <div className="mt-3 overflow-hidden rounded-card bg-bg p-2">
        <svg
          viewBox={`0 0 ${lay.width} ${lay.height}`}
          width="100%"
          style={{ maxWidth: Math.max(lay.width * 1.25, 220), margin: "0 auto", display: "block", touchAction: "manipulation" }}
          role="group"
          aria-label={`${target} 의 소인수분해 나무`}
        >
          {tree.map((n) =>
            n.kids
              ? n.kids.map((k) => {
                  const p = lay.pos.get(n.id)!;
                  const c = lay.pos.get(k)!;
                  return <line key={`${n.id}-${k}`} x1={p.x} y1={p.y + R_H / 2} x2={c.x} y2={c.y - R_H / 2} stroke="var(--muted)" strokeWidth={1.6} />;
                })
              : null,
          )}
          {tree.map((n) => {
            const p = lay.pos.get(n.id)!;
            const prime = !n.kids && isPrime(n.v);
            const comp = !n.kids && !prime;
            const active = sel === n.id;
            const fill = prime ? "var(--ok-soft, #dcfce7)" : comp ? "var(--accent-soft)" : "var(--surface)";
            const stroke = prime ? "var(--ok, #15803d)" : comp ? "var(--accent)" : "var(--line)";
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${n.v}${prime ? " 소수" : n.kids ? " 쪼갠 수" : " 쪼갤 수 있음"}`}
                style={{ cursor: "pointer", outline: "none" }}
                onClick={() => tapNode(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tapNode(n.id);
                  }
                }}
              >
                {active && <rect x={-R_W / 2 - 5} y={-R_H / 2 - 5} width={R_W + 10} height={R_H + 10} rx={R_H / 2 + 5} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" />}
                <rect x={-R_W / 2} y={-R_H / 2} width={R_W} height={R_H} rx={R_H / 2} fill={fill} stroke={stroke} strokeWidth={prime || comp ? 2.2 : 1.2} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={n.v >= 100 ? 15 : 17} fontWeight={800} fill={prime ? "var(--ok, #15803d)" : "var(--ink)"}>
                  {n.v}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 space-y-2">
        <Say tone={msg.t}>{msg.s || `${target} 을(를) 소수가 될 때까지 쪼개 봐요. 색칠된 카드를 눌러 선택하세요.`}</Say>
        {!solved && sel !== null && pairs.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold">{tree[sel].v} 쪼개기 — 곱셈식을 골라요</p>
            <div className="flex flex-wrap gap-2">
              {pairs.map(([a, b]) => (
                <GButton key={a} variant="soft" onClick={() => doSplit(a, b)}>
                  {a} × {b}
                </GButton>
              ))}
            </div>
          </div>
        )}
        {!solved && sel === null && <p className="text-sm text-muted">쪼갤 수 있는(파란) 카드를 눌러 선택해요.</p>}
      </div>

      {solved && (
        <div className="mt-3 space-y-3">
          <div className="rounded-card bg-ok-soft px-3 py-2 text-ok">
            <p className="text-lg font-extrabold">
              {target} = {finalLeaves.join(" × ")} = {powerForm(primeFactors(target))}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">초록색 소수 잎은 모두 몇 개일까요? (같은 수도 따로 세요)</p>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6, 7, 8].map((c) => (
                <GButton
                  key={c}
                  disabled={quiz !== null}
                  className="min-w-[44px] px-3"
                  onClick={() => {
                    if (c === lv.length) {
                      setQuiz(true);
                      setScore((s) => ({ ...s, quiz: s.quiz + 1 }));
                      setMsg({ t: "ok", s: `맞아요! 소인수가 ${lv.length}개예요.` });
                    } else {
                      setQuiz(false);
                      setMsg({ t: "bad", s: `아쉬워요. 초록 카드를 하나씩 세면 ${lv.length}개예요.` });
                    }
                  }}
                >
                  {c}
                </GButton>
              ))}
            </div>
          </div>
          <GButton variant="primary" onClick={again}>다시 쪼개기 (다른 순서로)</GButton>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <GButton onClick={undo} disabled={!order.length || solved}>한 칸 되돌리기</GButton>
        <GButton onClick={again}>다시 하기</GButton>
      </div>

      {hist.length > 0 && (
        <div className="mt-4 rounded-card border border-line p-3">
          <p className="font-bold">쪼갠 기록 ({target})</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
            {hist.map((r, i) => (
              <li key={i}>
                {r.steps.join(", ")} → <b>{r.leaves.join("×")}</b>
              </li>
            ))}
          </ol>
          {hist.length >= 2 && (
            <p className={`mt-2 text-sm font-semibold ${sameAll ? "text-ok" : "text-bad"}`}>
              {sameAll ? "순서를 바꿔도 마지막 소수 목록이 모두 같아요. 대단해요!" : "결과가 달라 보여요. 곱을 다시 확인해 봐요."}
            </p>
          )}
        </div>
      )}
      <p className="mt-3 text-sm text-muted">도전: 180, 210 같은 큰 수도 쪼개 보고, 여러 번 다르게 쪼개 소인수 목록을 비교해 봐요.</p>
    </Board>
  );
}
