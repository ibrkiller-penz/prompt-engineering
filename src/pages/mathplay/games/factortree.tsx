import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Board, GButton, Stat, cheer, rand, tick } from "./kit";
import { allPrime, divisorPairs, isComposite, isPrime, leaves, split, type TNode } from "./factortree.logic";

const UNIT = 66;
const GAP = 84;
const NW = 56;
const NH = 46;
const CHIP_W = 88;
const CHIP_H = 56;
const MIN_W = 300;
const EASY = [12, 16, 18, 20, 24, 28, 30, 32, 36, 40, 42, 48];
const HARD = [60, 72, 90, 100, 120, 144, 150, 180, 210];
const BIG = "min-h-[48px]!";

const CSS = `
@keyframes ft-drop{from{transform:translate(var(--dx),var(--dy)) scale(.45);opacity:0}to{transform:none;opacity:1}}
@keyframes ft-pop{0%{transform:scale(.75)}55%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes ft-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ft-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.ft-a{animation:none!important}}
`;

const shuffle = <T,>(a: T[]) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const makeTargets = (hard: boolean) => shuffle(hard ? HARD : EASY).slice(0, 5).sort((a, b) => a - b);
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
    pos.set(id, { x: (left + ww / 2) * UNIT, y: d * GAP + NH / 2 + 8 });
    maxD = Math.max(maxD, d);
    if (n.kids) {
      go(n.kids[0], left, d + 1);
      go(n.kids[1], left + w(n.kids[0]), d + 1);
    }
  };
  go(0, 0, 0);
  return { pos, width: w(0) * UNIT, height: maxD * GAP + NH + 16 };
}

export default function FactorTreeGame() {
  const [hard, setHard] = useState(false);
  const [targets, setTargets] = useState(() => makeTargets(false));
  const [round, setRound] = useState(0);
  const target = targets[Math.min(round, 4)];
  const [tree, setTree] = useState<TNode[]>(() => fresh(targets[0]));
  const [order, setOrder] = useState<number[]>([]);
  const [sel, setSel] = useState<number | null>(0);
  const [hist, setHist] = useState<Rec[]>([]);
  const [solved, setSolved] = useState(false);
  const [over, setOver] = useState(false);
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState<Msg | null>(null);

  const lay = layout(tree);
  const W = Math.max(lay.width, MIN_W);
  const shift = (W - lay.width) / 2;
  const selNode = sel !== null ? tree[sel] : null;
  const pairs = !solved && selNode && !selNode.kids ? divisorPairs(selNode.v) : [];

  // 칩 상자(풍선 바로 아래)
  const cols = Math.min(3, pairs.length);
  const panelW = cols * (CHIP_W + 8) + 8;
  const panelH = Math.ceil(pairs.length / 3) * (CHIP_H + 8) + 8;
  const sp = sel !== null ? lay.pos.get(sel) : undefined;
  const panelX = sp ? Math.min(Math.max(sp.x + shift - panelW / 2, 2), W - panelW - 2) : 0;
  const panelY = sp ? sp.y + NH / 2 + 10 : 0;
  const H = Math.max(lay.height, pairs.length ? panelY + panelH + 36 : 0);

  const begin = (n: number) => {
    setTree(fresh(n));
    setOrder([]);
    setSel(0);
    setHist([]);
    setSolved(false);
    setMsg(null);
  };
  const restartAll = (h: boolean) => {
    const t = makeTargets(h);
    setHard(h);
    setTargets(t);
    setRound(0);
    setStars(0);
    setOver(false);
    begin(t[0]);
  };
  const goNext = () => {
    if (round >= 4) {
      setOver(true);
      setSolved(false);
      cheer();
      return;
    }
    setRound(round + 1);
    begin(targets[round + 1]);
  };
  // 성공하면 잠깐 뒤 자동으로 다음 수
  useEffect(() => {
    if (!solved || over) return;
    const id = setTimeout(goNext, 3200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, over, round]);

  const again = () => {
    setTree(fresh(target));
    setOrder([]);
    setSel(0);
    setSolved(false);
    setMsg({ t: "info", s: "이번엔 다르게 쪼개 봐요. 결과가 같을까요?" });
  };
  const undo = () => {
    if (!order.length || solved) return;
    const last = order[order.length - 1];
    setTree(tree.slice(0, -2).map((x) => (x.id === last ? { ...x, kids: null } : x)));
    setOrder(order.slice(0, -1));
    setSel(last);
    setMsg(null);
    tick();
  };
  const tapNode = (id: number) => {
    if (solved) return;
    const n = tree[id];
    tick();
    if (n.kids) setMsg({ t: "info", s: `${n.v} 은(는) 이미 쪼갰어요.` });
    else if (isPrime(n.v)) setMsg({ t: "ok", s: `톡! ${n.v} 은(는) 1과 자기 자신으로만 나눠져요. 더 못 쪼개요.` });
    else {
      setSel(id);
      setMsg(null);
    }
  };
  const doSplit = (a: number, b: number) => {
    if (sel === null) return;
    const next = split(tree, sel, a, b);
    if (!next) return;
    tick();
    const ord = [...order, sel];
    setTree(next);
    setOrder(ord);
    if (allPrime(next)) {
      const l = [...leaves(next)].sort((x, y) => x - y);
      const h = [...hist, { steps: ord.map((id) => `${next[id].v}=${next[next[id].kids![0]].v}×${next[next[id].kids![1]].v}`), leaves: l }];
      setHist(h);
      setSolved(true);
      setSel(null);
      setStars((s) => s + 1);
      cheer();
      const same = h.length >= 2 && h.every((r) => r.leaves.join() === l.join());
      setMsg({ t: "ok", s: `⭐ 잘했어요! ${target} = ${l.join(" × ")}` + (same ? " 다르게 쪼개도 열매가 같아요!" : "") });
    } else {
      const comp = next.filter((x) => !x.kids && isComposite(x.v));
      setSel(comp[0].id);
      setMsg(null);
    }
  };

  const bornFrom = (id: number) => tree.find((x) => x.kids && x.kids.includes(id));
  const sameAll = hist.length >= 2 && hist.every((r) => r.leaves.join() === hist[0].leaves.join());
  const first = tree.length === 1 && round === 0 && !solved;

  if (over)
    return (
      <Board>
        <div className="space-y-4 py-6 text-center">
          <p className="text-4xl" aria-hidden>🌟🌟🌟🌟🌟</p>
          <p className="text-xl font-extrabold">다섯 수를 모두 쪼갰어요! 멋져요!</p>
          <p className="text-base text-muted">수를 어떻게 쪼개도 마지막 열매는 같았죠?</p>
          <div className="flex flex-wrap justify-center gap-2">
            <GButton variant="primary" className={BIG} onClick={() => restartAll(hard)}>또 하기</GButton>
            {!hard && <GButton className={BIG} onClick={() => restartAll(true)}>🔥 더 어려운 도전</GButton>}
          </div>
        </div>
      </Board>
    );

  return (
    <Board>
      <style>{CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="판" value={`${round + 1} / 5`} />
        <Stat label="별" value={"⭐".repeat(stars) || "0"} tone={stars ? "ok" : "plain"} />
        <GButton className={`${BIG} ml-auto`} pressed={hard} onClick={() => restartAll(!hard)}>🔥 더 어려운 도전</GButton>
      </div>

      <p className="mt-3 text-base font-semibold">
        {solved ? "초록 열매만 남았어요!" : <>파란 풍선을 쪼개서 모두 <b className="text-ok">초록 열매</b>로 만들어요.</>}
      </p>

      <div className="mt-2 overflow-hidden rounded-card bg-bg p-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ maxWidth: Math.max(W * 1.25, 280), margin: "0 auto", display: "block", touchAction: "manipulation" }}
          role="group"
          aria-label={`${target} 쪼개기 나무`}
        >
          {tree.map((n) =>
            n.kids
              ? n.kids.map((k) => {
                  const p = lay.pos.get(n.id)!;
                  const c = lay.pos.get(k)!;
                  return <line key={`${n.id}-${k}`} x1={p.x + shift} y1={p.y + NH / 2} x2={c.x + shift} y2={c.y - NH / 2} stroke="var(--muted)" strokeWidth={2} className="ft-a" style={{ animation: "ft-in .4s ease-out" }} />;
                })
              : null,
          )}
          {tree.map((n) => {
            const p = lay.pos.get(n.id)!;
            const par = bornFrom(n.id);
            const pp = par ? lay.pos.get(par.id)! : p;
            const prime = !n.kids && isPrime(n.v);
            const comp = !n.kids && !prime;
            const st: CSSProperties & Record<string, string> = {
              "--dx": `${pp.x - p.x}px`,
              "--dy": `${pp.y - p.y}px`,
              animation: par ? (prime ? "ft-drop .45s ease-out, ft-pop .4s .45s" : "ft-drop .45s ease-out") : "none",
              transformBox: "fill-box",
              transformOrigin: "center",
            };
            return (
              <g key={n.id} transform={`translate(${p.x + shift},${p.y})`}>
                <g
                  className="ft-a"
                  style={st}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.v} ${prime ? "초록 열매" : n.kids ? "쪼갠 풍선" : "쪼갤 수 있는 풍선"}`}
                  onClick={() => tapNode(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      tapNode(n.id);
                    }
                  }}
                >
                  <rect x={-NW / 2 - 4} y={-NH / 2 - 4} width={NW + 8} height={NH + 8} rx={NH / 2 + 4} fill="transparent" />
                  {sel === n.id && <rect x={-NW / 2 - 6} y={-NH / 2 - 6} width={NW + 12} height={NH + 12} rx={NH / 2 + 6} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="5 4" />}
                  <rect x={-NW / 2} y={-NH / 2} width={NW} height={NH} rx={NH / 2} fill={prime ? "var(--ok-soft, #dcfce7)" : comp ? "var(--accent-soft)" : "var(--surface)"} stroke={prime ? "var(--ok, #15803d)" : comp ? "var(--accent)" : "var(--line)"} strokeWidth={prime || comp ? 3 : 1.4} style={{ cursor: "pointer" }} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={n.v >= 100 ? 24 : 28} fontWeight={800} fill={prime ? "var(--ok, #15803d)" : "var(--ink)"} style={{ pointerEvents: "none" }}>
                    {n.v}
                  </text>
                </g>
              </g>
            );
          })}
          {pairs.length > 0 && (
            <g className="ft-a" style={{ animation: "ft-in .25s ease-out" }}>
              <rect x={panelX} y={panelY} width={panelW} height={panelH} rx={16} fill="var(--surface)" stroke="var(--accent)" strokeWidth={2.5} />
              {pairs.map(([a, b], i) => {
                const cx = panelX + 8 + (i % 3) * (CHIP_W + 8);
                const cy = panelY + 8 + Math.floor(i / 3) * (CHIP_H + 8);
                return (
                  <g key={a} role="button" tabIndex={0} aria-label={`${a} 곱하기 ${b} 로 쪼개기`} style={{ cursor: "pointer" }} onClick={() => doSplit(a, b)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doSplit(a, b); } }}>
                    <rect x={cx} y={cy} width={CHIP_W} height={CHIP_H} rx={14} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={2} />
                    <text x={cx + CHIP_W / 2} y={cy + CHIP_H / 2} textAnchor="middle" dominantBaseline="central" fontSize={26} fontWeight={800} fill="var(--accent)" style={{ pointerEvents: "none" }}>
                      {a}×{b}
                    </text>
                  </g>
                );
              })}
              {first && (
                <text x={panelX + panelW / 2} y={panelY + panelH + 30} textAnchor="middle" fontSize={30} className="ft-a" style={{ animation: "ft-bob 1s infinite" }}>
                  👆
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 space-y-3">
        <Tip tone={msg?.t ?? "info"}>{msg?.s ?? (first ? "👆 곱셈 칩을 톡 눌러서 쪼개요!" : sel === null ? "파란 풍선을 눌러요." : `${selNode?.v} 을(를) 어떻게 쪼갤까요? 칩을 톡!`)}</Tip>
        {solved && (
          <div className="flex flex-wrap gap-2">
            <GButton variant="primary" className={BIG} onClick={goNext}>{round >= 4 ? "끝내기 ▶" : "다음 수 ▶"}</GButton>
            <GButton className={BIG} onClick={again}>🔁 다르게 쪼개 보기</GButton>
          </div>
        )}
      </div>

      {!solved && (
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton className={BIG} onClick={undo} disabled={!order.length}>↩ 되돌리기</GButton>
          <GButton className={BIG} onClick={() => begin(target)}>다시 하기</GButton>
        </div>
      )}

      {hist.length >= 1 && (
        <div className="mt-4 rounded-card border border-line p-3 text-base">
          <p className="font-bold">내가 쪼갠 기록 ({target})</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {hist.map((r, i) => (
              <li key={i}>{r.steps.join(", ")} → <b>{r.leaves.join("×")}</b></li>
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
