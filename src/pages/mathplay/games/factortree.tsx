import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Board, GButton, Stat, cheer, stageClear, tick, useStage } from "./kit";
import { allPrime, divisorPairs, isComposite, isPrime, leaves, levelTargets, split, type TNode } from "./factortree.logic";

const UNIT = 72;
const GAP = 92;
const NW = 60;
const NH = 60;
const CHIP_W = 88;
const CHIP_H = 56;
const MIN_W = 320;
const TRUNK = 54;
const GROUND = 44;
const BIG = "min-h-[48px]!";
const FONT = { fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" };

const CSS = `
@keyframes ft-drop{from{transform:translate(var(--dx),var(--dy)) scale(.4);opacity:0}to{transform:none;opacity:1}}
@keyframes ft-pop{0%{transform:scale(.6)}55%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes ft-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes ft-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ft-grow{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}
@keyframes ft-spin{to{transform:rotate(360deg)}}
@keyframes ft-fly{0%{transform:translate(160px,-90px) scale(.7);opacity:0}60%{transform:translate(-6px,4px) scale(1.05);opacity:1}100%{transform:none;opacity:1}}
@keyframes ft-flap{0%,100%{transform:rotate(0)}50%{transform:rotate(-28deg)}}
@keyframes ft-float{0%,100%{transform:translateX(0)}50%{transform:translateX(12px)}}
.ft-grow{animation:ft-grow .5s ease-out both}
.ft-spin{animation:ft-spin 18s linear infinite;transform-box:fill-box;transform-origin:center}
.ft-fly{animation:ft-fly .9s cubic-bezier(.2,1.2,.4,1) both}
.ft-flap{animation:ft-flap .35s ease-in-out infinite;transform-box:fill-box;transform-origin:20% 30%}
.ft-cloud{animation:ft-float 6s ease-in-out infinite}
.ft-sel{animation:ft-bob 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ft-a,.ft-grow,.ft-spin,.ft-fly,.ft-flap,.ft-cloud,.ft-sel{animation:none!important}}
`;
const BALLOONS = [
  ["#7dd3fc", "#0284c7", "#075985"],
  ["#f9a8d4", "#db2777", "#9d174d"],
  ["#c4b5fd", "#7c3aed", "#5b21b6"],
  ["#fdba74", "#ea580c", "#9a3412"],
  ["#5eead4", "#0d9488", "#115e59"],
];
const FRUITS = [
  ["#fca5a5", "#dc2626", "#991b1b"],
  ["#bef264", "#65a30d", "#3f6212"],
  ["#fdba74", "#f97316", "#c2410c"],
  ["#d8b4fe", "#9333ea", "#6b21a8"],
];
const fruitIdx = (p: number) => (p === 2 ? 0 : p === 3 ? 1 : p === 5 ? 2 : p === 7 ? 3 : p % 4);
const APPLE = "M0,-17 C 14,-31 36,-13 27,9 C 21,27 7,31 0,27 C -7,31 -21,27 -27,9 C -36,-13 -14,-31 0,-17 Z";

const fresh = (n: number): TNode[] => [{ id: 0, v: n, kids: null }];
type Rec = { steps: string[]; leaves: number[] };
type Msg = { t: "info" | "ok" | "bad"; s: ReactNode };

function Tip({ tone = "info", children }: { tone?: Msg["t"]; children: ReactNode }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok border-ok/30" : tone === "bad" ? "bg-bad-soft text-bad border-bad/30" : "bg-accent-soft text-ink border-accent/20";
  return (
    <p className={`font-game rounded-2xl border-2 px-4 py-3 text-lg leading-relaxed shadow-[0_3px_0_0_rgba(0,0,0,0.06)] ${c}`} role="status" aria-live="polite">
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
    pos.set(id, { x: (left + ww / 2) * UNIT, y: -d * GAP });
    maxD = Math.max(maxD, d);
    if (n.kids) {
      go(n.kids[0], left, d + 1);
      go(n.kids[1], left + w(n.kids[0]), d + 1);
    }
  };
  go(0, 0, 0);
  return { pos, width: w(0) * UNIT, depth: maxD };
}

export default function FactorTreeGame() {
  const stage = useStage();
  const [targets] = useState(() => levelTargets(stage));
  const [round, setRound] = useState(0);
  const target = targets[Math.min(round, 2)];
  const [tree, setTree] = useState<TNode[]>(() => fresh(targets[0]));
  const [order, setOrder] = useState<number[]>([]);
  const [sel, setSel] = useState<number | null>(0);
  const [hist, setHist] = useState<Rec[]>([]);
  const [solved, setSolved] = useState(false);
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState<Msg | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(360);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const lay = layout(tree);
  const W = Math.max(lay.width, MIN_W);
  // 넓은 화면에서는 하늘·땅을 옆으로 넓혀 장면을 꽉 채운다(1.25배 크기 유지)
  const VW = Math.max(W, cw / 1.25);
  const EXT = (VW - W) / 2;
  const shift = (W - lay.width) / 2;
  const selNode = sel !== null ? tree[sel] : null;
  const pairs = !solved && selNode && !selNode.kids ? divisorPairs(selNode.v) : [];

  // 칩 상자: 고른 풍선 바로 위(가지가 자랄 자리)
  const cols = Math.min(3, pairs.length);
  const panelW = cols * (CHIP_W + 8) + 8;
  const panelH = Math.ceil(pairs.length / 3) * (CHIP_H + 8) + 8;
  const sp = sel !== null ? lay.pos.get(sel) : undefined;
  const panelX = sp ? Math.min(Math.max(sp.x + shift - panelW / 2, 4), W - panelW - 4) : 0;
  const panelYraw = sp ? sp.y - NH / 2 - 26 - panelH : 0;
  let minY = -lay.depth * GAP - NH / 2 - 20;
  if (pairs.length) minY = Math.min(minY, panelYraw - 8);
  const sceneMin = 230; // 장면이 너무 납작하지 않게
  let offY = 18 - minY;
  const groundTop0 = offY + NH / 2 + TRUNK;
  if (groundTop0 + GROUND < sceneMin) offY += sceneMin - (groundTop0 + GROUND);
  const groundTop = offY + NH / 2 + TRUNK;
  const H = groundTop + GROUND;
  const X = (x: number) => x + shift;
  const Y = (y: number) => y + offY;
  const panelY = Y(panelYraw);

  const begin = (n: number) => {
    setTree(fresh(n));
    setOrder([]);
    setSel(0);
    setHist([]);
    setSolved(false);
    setMsg(null);
  };
  const goNext = () => {
    if (round >= 2) return;
    setRound(round + 1);
    begin(targets[round + 1]);
  };
  // 성공하면 잠깐 뒤 자동으로 다음 라운드, 3라운드를 다 깨면 다음 레벨
  useEffect(() => {
    if (!solved) return;
    const last = round >= 2;
    const id = setTimeout(last ? stageClear : goNext, last ? 1200 : 3200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved, round]);

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

  return (
    <Board>
      <style>{CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label={`레벨 ${stage}`} value={`라운드 ${round + 1}/3`} />
        <Stat label="별" value={"⭐".repeat(stars) || "0"} tone={stars ? "ok" : "plain"} />
      </div>

      <p className="font-game mt-3 text-lg text-ink">
        {solved ? "열매만 남았어요! 🎉" : <>풍선을 쪼개서 모두 <b className="text-ok">🍎 열매</b>로 만들어요.</>}
      </p>

      <div ref={wrapRef} className="mt-2 overflow-hidden rounded-3xl border-4 border-white shadow-[0_6px_0_0_rgba(0,0,0,0.06),0_10px_24px_rgba(14,165,233,0.15)]">
        <svg
          viewBox={`${-EXT} 0 ${VW} ${H}`}
          width="100%"
          style={{ display: "block", touchAction: "manipulation" }}
          role="group"
          aria-label={`${target} 쪼개기 나무`}
        >
          <defs>
            <linearGradient id="ft-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="0.7" stopColor="#e0f2fe" />
              <stop offset="1" stopColor="#f0fdf4" />
            </linearGradient>
            <linearGradient id="ft-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#86efac" />
              <stop offset="1" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="ft-bark" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8b5a2b" />
              <stop offset="0.45" stopColor="#b97a3d" />
              <stop offset="1" stopColor="#7a4a1f" />
            </linearGradient>
            <radialGradient id="ft-leaf" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#86efac" />
              <stop offset="1" stopColor="#16a34a" />
            </radialGradient>
            <radialGradient id="ft-knot" cx="0.35" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#e7b77d" />
              <stop offset="1" stopColor="#9a6233" />
            </radialGradient>
            {BALLOONS.map(([a, b], i) => (
              <radialGradient key={i} id={`ft-b${i}`} cx="0.35" cy="0.3" r="0.85">
                <stop offset="0" stopColor={a} />
                <stop offset="1" stopColor={b} />
              </radialGradient>
            ))}
            {FRUITS.map(([a, b], i) => (
              <radialGradient key={i} id={`ft-f${i}`} cx="0.35" cy="0.3" r="0.85">
                <stop offset="0" stopColor={a} />
                <stop offset="1" stopColor={b} />
              </radialGradient>
            ))}
          </defs>
          {/* 하늘 장면 */}
          <rect x={-EXT} width={VW} height={H} fill="url(#ft-sky)" />
          <g transform={`translate(${W + EXT - 38},34)`}>
            <g className="ft-spin">
              {Array.from({ length: 10 }, (_, i) => (
                <rect key={i} x={-2.5} y={-34} width={5} height={11} rx={2.5} fill="#fbbf24" transform={`rotate(${i * 36})`} />
              ))}
            </g>
            <circle r={19} fill="#fde047" stroke="#f59e0b" strokeWidth={3} />
            <circle cx={-6} cy={-3} r={2.2} fill="#92400e" />
            <circle cx={6} cy={-3} r={2.2} fill="#92400e" />
            <path d="M-6 5 Q0 10 6 5" stroke="#92400e" strokeWidth={2} fill="none" strokeLinecap="round" />
          </g>
          {[[40 - EXT, 36, 1], [W * 0.55, 60, 0.8]].map(([x, y, sc], i) => (
            <g key={i} className="ft-cloud" style={{ animationDelay: `${i * 1.7}s` }}>
              <g transform={`translate(${x},${y}) scale(${sc})`} opacity={0.95}>
                <ellipse cx={0} cy={6} rx={30} ry={11} fill="#fff" />
                <circle cx={-12} cy={0} r={12} fill="#fff" />
                <circle cx={6} cy={-5} r={15} fill="#fff" />
              </g>
            </g>
          ))}
          {/* 땅 */}
          <path d={`M${-EXT - 4} ${groundTop + 8} Q ${W * 0.25} ${groundTop - 8} ${W / 2} ${groundTop + 2} T ${W + EXT + 4} ${groundTop} V ${H + 4} H ${-EXT - 4} Z`} fill="url(#ft-grass)" stroke="#16a34a" strokeWidth={2.5} />
          {[0.12, 0.3, 0.72, 0.88].map((f, i) => (
            <g key={i} transform={`translate(${-EXT + VW * f},${groundTop + 20})`}>
              <path d="M-6 6 L-3 -6 L0 4 L3 -8 L6 6 Z" fill="#15803d" />
              {i % 2 === 0 && (
                <g transform="translate(10,-2)">
                  {[0, 72, 144, 216, 288].map((r) => (
                    <circle key={r} cx={0} cy={-4} r={3.2} fill={i === 0 ? "#f9a8d4" : "#fde047"} transform={`rotate(${r})`} />
                  ))}
                  <circle r={2.4} fill="#f59e0b" />
                </g>
              )}
            </g>
          ))}
          {/* 줄기 */}
          {(() => {
            const rx = X(lay.pos.get(0)!.x);
            const top = Y(0) + (tree[0].kids ? 0 : NH / 2 + 4);
            return (
              <path
                d={`M ${rx - 11} ${top} C ${rx - 12} ${groundTop - 20}, ${rx - 14} ${groundTop - 4}, ${rx - 26} ${groundTop + 8} L ${rx + 26} ${groundTop + 8} C ${rx + 14} ${groundTop - 4}, ${rx + 12} ${groundTop - 20}, ${rx + 11} ${top} Z`}
                fill="url(#ft-bark)"
                stroke="#6b3f17"
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            );
          })()}
          {/* 가지 */}
          {tree.map((n) =>
            n.kids
              ? n.kids.map((k) => {
                  const p = lay.pos.get(n.id)!;
                  const c = lay.pos.get(k)!;
                  const d = Math.round(-p.y / GAP);
                  const w = Math.max(6, 15 - d * 3);
                  const x1 = X(p.x);
                  const y1 = Y(p.y);
                  const x2 = X(c.x);
                  const y2 = Y(c.y) + NH / 2 + 2;
                  const path = `M ${x1} ${y1} C ${x1} ${y1 - GAP * 0.45}, ${x2} ${y2 + GAP * 0.35}, ${x2} ${y2}`;
                  return (
                    <g key={`${n.id}-${k}`}>
                      <path d={path} pathLength={1} className="ft-grow" stroke="#6b3f17" strokeWidth={w + 5} fill="none" strokeLinecap="round" />
                      <path d={path} pathLength={1} className="ft-grow" stroke="#b97a3d" strokeWidth={w} fill="none" strokeLinecap="round" />
                    </g>
                  );
                })
              : null,
          )}
          {/* 잎 덩어리 */}
          {tree.map((n) => {
            const p = lay.pos.get(n.id)!;
            const big = !!n.kids;
            const r = big ? 22 : 15;
            const pts = big ? [[-24, -6], [22, -8], [0, -22], [-12, 12], [14, 12]] : [[-22, -14], [22, -12]];
            return (
              <g key={`leaf${n.id}`} transform={`translate(${X(p.x)},${Y(p.y)})`} className="ft-a" style={{ animation: "ft-in .5s ease-out" }}>
                {pts.map(([dx, dy], i) => (
                  <circle key={i} cx={dx} cy={dy} r={r} fill="url(#ft-leaf)" stroke="#15803d" strokeWidth={2} opacity={big ? 1 : 0.95} />
                ))}
              </g>
            );
          })}
          {/* 풍선·열매·매듭 */}
          {tree.map((n) => {
            const p = lay.pos.get(n.id)!;
            const par = bornFrom(n.id);
            const pp = par ? lay.pos.get(par.id)! : p;
            const prime = !n.kids && isPrime(n.v);
            const comp = !n.kids && !prime;
            const st: CSSProperties & Record<string, string> = {
              "--dx": `${pp.x - p.x}px`,
              "--dy": `${pp.y - p.y}px`,
              animation: par ? (prime ? "ft-drop .45s ease-out, ft-pop .45s .45s" : "ft-drop .45s ease-out") : "none",
              transformBox: "fill-box",
              transformOrigin: "center",
            };
            const bi = n.v % BALLOONS.length;
            const fi = fruitIdx(n.v);
            const big = n.v >= 100;
            return (
              <g key={n.id} transform={`translate(${X(p.x)},${Y(p.y)})`}>
                <g
                  className="ft-a"
                  style={{ ...st, outline: "none" }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${n.v} ${prime ? "열매, 더 못 쪼개요" : n.kids ? "쪼갠 풍선" : "쪼갤 수 있는 풍선"}`}
                  onClick={() => tapNode(n.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      tapNode(n.id);
                    }
                  }}
                >
                  <rect x={-NW / 2 - 4} y={-NH / 2 - 4} width={NW + 8} height={NH + 8} rx={NH / 2} fill="transparent" />
                  {comp && (
                    <g className={sel === n.id ? "ft-sel" : undefined} style={{ cursor: "pointer" }}>
                      {sel === n.id && <circle r={39} fill="#fef08a" opacity={0.55} stroke="#facc15" strokeWidth={3} strokeDasharray="6 5" />}
                      <path d={`M0 ${NH / 2 - 2} q -5 8 0 14`} stroke="#64748b" strokeWidth={1.6} fill="none" />
                      <ellipse cx={0} cy={-3} rx={29} ry={31} fill={`url(#ft-b${bi})`} stroke={BALLOONS[bi][2]} strokeWidth={3} />
                      <path d={`M-5 ${NH / 2 - 2} L5 ${NH / 2 - 2} L0 ${NH / 2 - 9} Z`} fill={BALLOONS[bi][1]} stroke={BALLOONS[bi][2]} strokeWidth={1.5} strokeLinejoin="round" />
                      <ellipse cx={-11} cy={-17} rx={7} ry={10} fill="#fff" opacity={0.7} transform="rotate(25 -11 -17)" />
                      <circle cx={-15} cy={-4} r={2.6} fill="#fff" opacity={0.6} />
                      <text textAnchor="middle" dominantBaseline="central" y={-2} fontSize={big ? 25 : 30} fill="#fff" stroke={BALLOONS[bi][2]} strokeWidth={4} paintOrder="stroke" style={{ ...FONT, pointerEvents: "none" }}>
                        {n.v}
                      </text>
                    </g>
                  )}
                  {prime && (
                    <g style={{ cursor: "pointer" }}>
                      <path d="M1 -17 Q 3 -26 6 -31" stroke="#6b3f17" strokeWidth={3.5} fill="none" strokeLinecap="round" />
                      <ellipse cx={14} cy={-27} rx={9} ry={4.5} fill="#22c55e" stroke="#15803d" strokeWidth={1.5} transform="rotate(-25 14 -27)" />
                      <path d={APPLE} fill={`url(#ft-f${fi})`} stroke={FRUITS[fi][2]} strokeWidth={3} />
                      <ellipse cx={-12} cy={-6} rx={5} ry={8} fill="#fff" opacity={0.55} transform="rotate(20 -12 -6)" />
                      <text textAnchor="middle" dominantBaseline="central" y={6} fontSize={big ? 24 : 28} fill="#fff" stroke={FRUITS[fi][2]} strokeWidth={4} paintOrder="stroke" style={{ ...FONT, pointerEvents: "none" }}>
                        {n.v}
                      </text>
                    </g>
                  )}
                  {!!n.kids && (
                    <g style={{ cursor: "pointer" }}>
                      <circle r={22} fill="url(#ft-knot)" stroke="#6b3f17" strokeWidth={3} />
                      <circle r={15} fill="none" stroke="#6b3f17" strokeWidth={1.2} opacity={0.35} />
                      <text textAnchor="middle" dominantBaseline="central" y={1} fontSize={n.v >= 100 ? 17 : 21} fill="#fff7ed" stroke="#6b3f17" strokeWidth={3} paintOrder="stroke" style={{ ...FONT, pointerEvents: "none" }}>
                        {n.v}
                      </text>
                    </g>
                  )}
                </g>
              </g>
            );
          })}
          {/* 다 되면 새가 날아와요 */}
          {solved && (
            <g transform={`translate(${W + Math.min(EXT, 40) - 46},${Math.max(76, Y(-lay.depth * GAP) - 10)})`}>
              <g className="ft-fly">
                <ellipse cx={0} cy={0} rx={18} ry={15} fill="#60a5fa" stroke="#1d4ed8" strokeWidth={2.5} />
                <ellipse cx={4} cy={5} rx={10} ry={8} fill="#dbeafe" />
                <g className="ft-flap">
                  <ellipse cx={-6} cy={-2} rx={11} ry={7} fill="#3b82f6" stroke="#1d4ed8" strokeWidth={2} transform="rotate(-20 -6 -2)" />
                </g>
                <circle cx={7} cy={-5} r={3.4} fill="#1e293b" />
                <circle cx={8} cy={-6} r={1.1} fill="#fff" />
                <path d="M16 -2 L25 1 L16 5 Z" fill="#f59e0b" stroke="#b45309" strokeWidth={1.2} strokeLinejoin="round" />
                <text x={-4} y={-24} fontSize={16} fill="#7c3aed" style={FONT}>♪</text>
              </g>
            </g>
          )}
          {/* 곱셈 칩 상자 */}
          {pairs.length > 0 && sp && (
            <g className="ft-a" style={{ animation: "ft-in .25s ease-out" }}>
              <path d={`M ${X(sp.x) - 9} ${panelY + panelH - 1} L ${X(sp.x)} ${panelY + panelH + 12} L ${X(sp.x) + 9} ${panelY + panelH - 1} Z`} fill="#fff" stroke="#7c3aed" strokeWidth={3} strokeLinejoin="round" />
              <rect x={panelX} y={panelY + 5} width={panelW} height={panelH} rx={18} fill="#000" opacity={0.12} />
              <rect x={panelX} y={panelY} width={panelW} height={panelH} rx={18} fill="#fff" stroke="#7c3aed" strokeWidth={3} />
              <rect x={X(sp.x) - 8} y={panelY + panelH - 3} width={16} height={5} fill="#fff" />
              {pairs.map(([a, b], i) => {
                const cx = panelX + 8 + (i % 3) * (CHIP_W + 8);
                const cy = panelY + 8 + Math.floor(i / 3) * (CHIP_H + 8);
                return (
                  <g key={a} role="button" tabIndex={0} aria-label={`${a} 곱하기 ${b} 로 쪼개기`} style={{ cursor: "pointer", outline: "none" }} onClick={() => doSplit(a, b)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doSplit(a, b); } }}>
                    <rect x={cx} y={cy + 4} width={CHIP_W} height={CHIP_H - 2} rx={15} fill="#6d28d9" />
                    <rect x={cx} y={cy} width={CHIP_W} height={CHIP_H - 4} rx={15} fill="url(#ft-b2)" stroke="#5b21b6" strokeWidth={2} />
                    <rect x={cx + 10} y={cy + 6} width={CHIP_W - 30} height={6} rx={3} fill="#fff" opacity={0.45} />
                    <text x={cx + CHIP_W / 2} y={cy + CHIP_H / 2 - 1} textAnchor="middle" dominantBaseline="central" fontSize={27} fill="#fff" stroke="#4c1d95" strokeWidth={3.5} paintOrder="stroke" style={{ ...FONT, pointerEvents: "none" }}>
                      {a}×{b}
                    </text>
                  </g>
                );
              })}
              {first && (
                <text x={panelX + panelW + 2} y={panelY + panelH + 18} textAnchor="end" fontSize={30} className="ft-sel">
                  👆
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 space-y-3">
        <Tip tone={msg?.t ?? "info"}>{msg?.s ?? (first ? "👆 곱셈 칩을 톡 눌러서 쪼개요!" : sel === null ? "풍선을 눌러요." : `${selNode?.v} 을(를) 어떻게 쪼갤까요? 칩을 톡!`)}</Tip>
        {solved && round < 2 && (
          <div className="flex flex-wrap gap-2">
            <GButton variant="primary" className={BIG} onClick={goNext}>다음 수 ▶</GButton>
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
