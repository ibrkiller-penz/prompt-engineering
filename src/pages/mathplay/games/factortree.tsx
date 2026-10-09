import { useState, type ReactNode } from "react";
import { Board, GButton, Stat, rand } from "./kit";
import { allPrime, divisorPairs, isComposite, isPrime, leaves, split, type TNode } from "./factortree.logic";

const UNIT = 62;
const GAP = 72;
const R_W = 50;
const R_H = 40;
const EASY = [12, 18, 20, 24, 28, 30, 36];
const HARD = [60, 72, 100, 144, 180, 210];
const BIG = "min-h-[48px]!";

const newTarget = (not?: number) => {
  let n = not;
  while (n === not) n = EASY[rand(EASY.length)];
  return n as number;
};
const fresh = (n: number): TNode[] => [{ id: 0, v: n, kids: null }];
type Rec = { steps: string[]; leaves: number[] };
type Msg = { t: "info" | "ok" | "bad"; s: ReactNode };

function Tip({ tone = "info", children }: { tone?: Msg["t"]; children: ReactNode }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-accent-soft/70 text-ink";
  return (
    <p className={`rounded-card px-3 py-2.5 text-base font-semibold leading-relaxed ${c}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

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
  const [tree, setTree] = useState<TNode[]>(() => fresh(first));
  const [order, setOrder] = useState<number[]>([]);
  const [sel, setSel] = useState<number | null>(0);
  const [hist, setHist] = useState<Rec[]>([]);
  const [solved, setSolved] = useState(false);
  const [quizOk, setQuizOk] = useState(false);
  const [stars, setStars] = useState(0);
  const [done, setDone] = useState(0);
  const [hard, setHard] = useState(false);
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState<Msg | null>(null);

  const lay = layout(tree);
  const lv = leaves(tree);

  const startTarget = (n: number) => {
    setTarget(n);
    setTree(fresh(n));
    setOrder([]);
    setSel(0);
    setHist([]);
    setSolved(false);
    setQuizOk(false);
    setMsg(null);
  };
  const again = () => {
    setTree(fresh(target));
    setOrder([]);
    setSel(0);
    setSolved(false);
    setQuizOk(false);
    setMsg({ t: "info", s: "이번엔 다른 순서로 쪼개 봐요. 결과가 같을까요?" });
  };
  const undo = () => {
    if (!order.length || solved) return;
    const last = order[order.length - 1];
    setTree(tree.slice(0, -2).map((x) => (x.id === last ? { ...x, kids: null } : x)));
    setOrder(order.slice(0, -1));
    setSel(last);
    setMsg({ t: "info", s: "한 번 되돌렸어요." });
  };
  const tapNode = (id: number) => {
    const n = tree[id];
    if (solved) return;
    if (n.kids) setMsg({ t: "info", s: `${n.v} 은(는) 이미 쪼갰어요. 아래 카드를 눌러 봐요.` });
    else if (isPrime(n.v)) setMsg({ t: "ok", s: `${n.v} 은(는) 1과 자기 자신으로만 나눠져요. 더 못 쪼개서 초록 열매가 됐어요!` });
    else {
      setSel(id);
      setMsg({ t: "info", s: `${n.v} 을(를) 어떻게 쪼갤까요? 아래에서 곱셈을 골라요.` });
    }
  };
  const doSplit = (a: number, b: number) => {
    if (sel === null) return;
    const next = split(tree, sel, a, b);
    if (!next) return;
    const ord = [...order, sel];
    setTree(next);
    setOrder(ord);
    const comp = next.filter((x) => !x.kids && isComposite(x.v));
    if (allPrime(next)) {
      const l = [...leaves(next)].sort((x, y) => x - y);
      const rec: Rec = { steps: ord.map((id) => `${next[id].v}=${next[next[id].kids![0]].v}×${next[next[id].kids![1]].v}`), leaves: l };
      const h = [...hist, rec];
      setHist(h);
      setSolved(true);
      setSel(null);
      setStars((s) => s + 1);
      setDone((d) => d + 1);
      const same = h.length >= 2 && h.every((r) => r.leaves.join() === l.join());
      setMsg({
        t: "ok",
        s: `⭐ 잘했어요! 열매가 모두 초록색이에요. ${target} = ${l.join("×")}` + (same ? " 다르게 쪼개도 결과가 같아요. 대단해요!" : ""),
      });
    } else {
      setSel(comp.length ? comp[0].id : null);
      const ps = [a, b].filter(isPrime);
      setMsg({ t: "info", s: `${a} × ${b} 로 쪼갰어요.` + (ps.length ? ` ${ps.join(", ")} 은(는) 더 못 쪼개서 초록 열매가 됐어요.` : " 파란 카드가 남았어요. 계속 쪼개 봐요.") });
    }
  };
  const startCustom = () => {
    const n = parseInt(custom, 10);
    if (!Number.isInteger(n) || n < 12 || n > 200) setMsg({ t: "bad", s: "12부터 200까지의 수를 적어 주세요." });
    else if (!isComposite(n)) setMsg({ t: "bad", s: `${n} 은(는) 더 쪼갤 수 없는 수예요. 다른 수를 골라 봐요.` });
    else startTarget(n);
  };

  const pairs = sel !== null && tree[sel] && !tree[sel].kids ? divisorPairs(tree[sel].v) : [];
  const sameAll = hist.length >= 2 && hist.every((r) => r.leaves.join() === hist[0].leaves.join());
  const defaultTip = solved ? "" : sel === null ? "파란 카드를 눌러 골라요." : `파란 ${tree[sel]?.v} 카드를 쪼개 봐요. 아래 곱셈 중 하나를 눌러요.`;

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="목표 수" value={target} />
        <Stat label="별" value={"⭐".repeat(Math.min(stars, 5)) || "0"} tone={stars ? "ok" : "plain"} />
        <Stat label="푼 문제" value={`${Math.min(done, 5)} / 5`} />
      </div>

      <p className="mt-3 text-base">
        수를 곱셈으로 쪼개요. <b>더 못 쪼개는 수</b>(1과 자기 자신으로만 나눠지는 수)는 <b className="text-ok">초록 열매</b>가 돼요. 열매만 남으면 성공!
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <GButton variant="primary" className={BIG} onClick={() => startTarget(newTarget(target))}>새 문제</GButton>
        <GButton className={BIG} pressed={hard} onClick={() => setHard((h) => !h)}>더 어려운 도전</GButton>
      </div>
      {hard && (
        <div className="mt-2 rounded-card bg-bg p-3">
          <div className="flex flex-wrap gap-2">
            {HARD.map((n) => (
              <GButton key={n} variant="soft" className={`${BIG} min-w-[56px]`} pressed={n === target} onClick={() => startTarget(n)}>{n}</GButton>
            ))}
          </div>
          <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); startCustom(); }}>
            <label className="flex items-center gap-2 text-base font-semibold">
              내가 고른 수
              <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" placeholder="12~200" aria-label="쪼갤 수 직접 입력" className="min-h-[48px] w-24 rounded-card border border-line bg-surface px-3 text-base" />
            </label>
            <GButton className={BIG} onClick={startCustom}>시작</GButton>
          </form>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-card bg-bg p-2">
        <svg
          viewBox={`0 0 ${lay.width} ${lay.height}`}
          width="100%"
          style={{ maxWidth: Math.max(lay.width * 1.3, 240), margin: "0 auto", display: "block", touchAction: "manipulation" }}
          role="group"
          aria-label={`${target} 쪼개기 나무`}
        >
          {tree.map((n) =>
            n.kids
              ? n.kids.map((k) => {
                  const p = lay.pos.get(n.id)!;
                  const c = lay.pos.get(k)!;
                  return <line key={`${n.id}-${k}`} x1={p.x} y1={p.y + R_H / 2} x2={c.x} y2={c.y - R_H / 2} stroke="var(--muted)" strokeWidth={1.8} />;
                })
              : null,
          )}
          {tree.map((n) => {
            const p = lay.pos.get(n.id)!;
            const prime = !n.kids && isPrime(n.v);
            const comp = !n.kids && !prime;
            const active = sel === n.id;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                tabIndex={0}
                role="button"
                aria-label={`${n.v} ${prime ? "초록 열매, 더 못 쪼개요" : n.kids ? "이미 쪼갠 카드" : "쪼갤 수 있는 카드"}`}
                style={{ cursor: "pointer", outline: "none" }}
                onClick={() => tapNode(n.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tapNode(n.id);
                  }
                }}
              >
                {active && <rect x={-R_W / 2 - 5} y={-R_H / 2 - 5} width={R_W + 10} height={R_H + 10} rx={R_H / 2 + 5} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeDasharray="4 3" />}
                <rect x={-R_W / 2} y={-R_H / 2} width={R_W} height={R_H} rx={R_H / 2} fill={prime ? "var(--ok-soft, #dcfce7)" : comp ? "var(--accent-soft)" : "var(--surface)"} stroke={prime ? "var(--ok, #15803d)" : comp ? "var(--accent)" : "var(--line)"} strokeWidth={prime || comp ? 2.4 : 1.2} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={n.v >= 100 ? 19 : 22} fontWeight={800} fill={prime ? "var(--ok, #15803d)" : "var(--ink)"}>
                  {n.v}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 space-y-3">
        <Tip tone={msg?.t ?? "info"}>{msg?.s ?? (defaultTip || "")}</Tip>
        {!solved && sel !== null && pairs.length > 0 && (
          <div>
            <p className="mb-1 text-base font-semibold">{tree[sel].v} 은(는) 이렇게 쪼갤 수 있어요</p>
            <div className="flex flex-wrap gap-2">
              {pairs.map(([a, b]) => (
                <GButton key={a} variant="soft" className={`${BIG} min-w-[96px] text-lg`} onClick={() => doSplit(a, b)}>
                  {a} × {b}
                </GButton>
              ))}
            </div>
          </div>
        )}
      </div>

      {solved && (
        <div className="mt-3 space-y-3">
          <p className="rounded-card bg-ok-soft px-3 py-2.5 text-xl font-extrabold text-ok">
            ⭐ {target} = {[...lv].sort((a, b) => a - b).join(" × ")}
          </p>
          <div>
            <p className="mb-1 text-base font-semibold">초록 열매는 모두 몇 개일까요? (같은 수도 따로 세요)</p>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4, 5, 6].map((c) => (
                <GButton
                  key={c}
                  disabled={quizOk}
                  className={`${BIG} min-w-[56px] text-lg`}
                  onClick={() => {
                    if (c === lv.length) {
                      setQuizOk(true);
                      setStars((s) => s + 1);
                      setMsg({ t: "ok", s: `⭐ 맞아요! 열매가 ${lv.length}개예요.` });
                    } else setMsg({ t: "bad", s: "괜찮아요! 초록 열매를 하나씩 손가락으로 세어 봐요." });
                  }}
                >
                  {c}
                </GButton>
              ))}
            </div>
          </div>
          <GButton variant="primary" className={BIG} onClick={again}>다른 순서로 다시 쪼개기</GButton>
          <GButton className={`${BIG} ml-2`} onClick={() => startTarget(newTarget(target))}>새 문제</GButton>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <GButton className={BIG} onClick={undo} disabled={!order.length || solved}>한 칸 되돌리기</GButton>
        <GButton className={BIG} onClick={again}>다시 하기</GButton>
      </div>

      {hist.length > 0 && (
        <div className="mt-4 rounded-card border border-line p-3 text-base">
          <p className="font-bold">내가 쪼갠 기록 ({target})</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {hist.map((r, i) => (
              <li key={i}>
                {r.steps.join(", ")} → <b>{r.leaves.join("×")}</b>
              </li>
            ))}
          </ol>
          {hist.length >= 2 && (
            <p className={`mt-2 font-semibold ${sameAll ? "text-ok" : "text-bad"}`}>
              {sameAll ? "순서를 바꿔도 마지막 열매는 모두 같아요. 신기하죠?" : "열매가 달라 보여요. 곱해서 다시 확인해 봐요."}
            </p>
          )}
        </div>
      )}
    </Board>
  );
}
