import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Board, GButton, cheer, oops, stageClear, svgPoint, tick, useFrame, useStage } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { applyMove, jugStars, makePuzzles, solve, type Move } from "./jugs.logic";

type Msg = { t: string; tone: "info" | "ok" | "bad" };
type Fx = { kind: "fill" | "empty" | "pour"; i: number; j?: number; until: number };
const VW = 360;
const VH = 300;
const BASE = 252;
const DRAIN = { x: 262, y: 218, w: 88, h: 46 };
const RIM = ["#f472b6", "#fbbf24", "#a78bfa"];
const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const css = `
@media (prefers-reduced-motion: no-preference){
.jug-bob{animation:jug-bob .9s ease-in-out infinite}
.jug-glow{animation:jug-glow 1s ease-in-out infinite}
.jug-shake{animation:jug-shake .45s ease-in-out 1}
.jug-party{animation:jug-party .5s ease-in-out 4}
}
@keyframes jug-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
@keyframes jug-glow{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes jug-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
@keyframes jug-party{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
`;

function geom(caps: number[]) {
  const n = caps.length;
  const maxCap = Math.max(...caps);
  const w = n === 2 ? 72 : 58;
  const xs = n === 2 ? [88, 186] : [58, 138, 218];
  return caps.map((c, i) => ({ cx: xs[i], w, h: 64 + (128 * c) / maxCap, cap: c }));
}

/** 유리병 모양 길 */
function jugPath(w: number, h: number) {
  const nw = 17;
  const r = w / 2;
  return `M${-nw} ${-h} L${nw} ${-h} L${nw} ${-h + 10} Q${r} ${-h + 16} ${r} ${-h + 34} L${r} -16 Q${r} 0 ${r - 16} 0 L${-r + 16} 0 Q${-r} 0 ${-r} -16 L${-r} ${-h + 34} Q${-r} ${-h + 16} ${-nw} ${-h + 10} Z`;
}

function Jug({ id, g, shown, actual, t, color, target, glow, ghost, party }: { id: number; g: { w: number; h: number; cap: number }; shown: number; actual: number; t: number; color: string; target: number; glow: boolean; ghost?: boolean; party?: boolean }) {
  const inner = g.h - 20; // 가득일 때 물 높이
  const ph = (shown / g.cap) * inner;
  const amp = reduced() ? 0 : Math.min(5, 1.5 + Math.abs(shown - actual) * 3);
  const r = g.w / 2 - 2;
  const pts: string[] = [];
  for (let k = 0; k <= 12; k++) {
    const x = -r + (k / 12) * r * 2;
    pts.push(`${x.toFixed(1)},${(-ph + Math.sin(t * 3 + k * 0.9 + id) * amp).toFixed(1)}`);
  }
  const clip = `jug-clip-${id}${ghost ? "g" : ""}`;
  const step = g.cap <= 9 ? 1 : 2;
  const tl = (target / g.cap) * inner;
  return (
    <g className={party ? "jug-party" : ""}>
      <defs>
        <clipPath id={clip}>
          <path d={jugPath(g.w - 4, g.h - 2)} transform="translate(0 -1)" />
        </clipPath>
      </defs>
      <ellipse cx={0} cy={4} rx={g.w / 2 + 6} ry={7} fill="#000" opacity={0.15} />
      <path d={jugPath(g.w, g.h)} fill="#e0f7fa" fillOpacity={0.55} />
      <g clipPath={`url(#${clip})`}>
        {ph > 0.5 && <polygon points={`${-r},2 ${pts.join(" ")} ${r},2`} fill="url(#jug-water)" />}
        {ph > 0.5 && <polyline points={pts.join(" ")} fill="none" stroke="#e0f2fe" strokeWidth={2.5} strokeLinecap="round" />}
        {ph > 14 && [0, 1, 2].map((k) => <circle key={k} cx={-12 + k * 12} cy={-ph + 14 + ((k * 17) % 10)} r={2 + (k % 2)} fill="#fff" opacity={0.45} />)}
      </g>
      {Array.from({ length: g.cap }, (_, k) => k + 1).map((k) => {
        const y = -(k / g.cap) * inner;
        return (
          <g key={k}>
            <line x1={g.w / 2 - (k % step === 0 ? 14 : 8)} y1={y} x2={g.w / 2} y2={y} stroke="#0f766e" strokeWidth={1.5} />
            {k % step === 0 && <text x={g.w / 2 + 3} y={y + 3.5} fontSize={10} fill="#0f4c47" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>{k}</text>}
          </g>
        );
      })}
      {target <= g.cap && target > 0 && (
        <g>
          <line x1={-g.w / 2 + 2} y1={-tl} x2={g.w / 2 - 14} y2={-tl} stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="5 3" />
          <text x={-g.w / 2 - 2} y={-tl + 4} textAnchor="end" fontSize={13}>🎯</text>
        </g>
      )}
      <path d={jugPath(g.w, g.h)} fill="none" stroke="#0f766e" strokeWidth={3.5} strokeLinejoin="round" />
      <path d={`M${-g.w / 2 + 8} ${-g.h + 44} V-26`} stroke="#fff" strokeWidth={4} strokeLinecap="round" opacity={0.6} />
      <rect x={-21} y={-g.h - 7} width={42} height={11} rx={5} fill={color} stroke="#0f172a" strokeOpacity={0.35} strokeWidth={1.5} />
      <text x={0} y={-Math.min(ph, inner) / 2 + 8} textAnchor="middle" fontSize={22} fill="#0b3b46" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>
        {actual > 0 ? actual : ""}
      </text>
      <text x={0} y={22} textAnchor="middle" fontSize={14} fill="#0f4c47" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>{g.cap}L 통</text>
      {glow && <path className="jug-glow" d={jugPath(g.w + 10, g.h + 8)} transform="translate(0 4)" fill="none" stroke="#f59e0b" strokeWidth={5} strokeLinejoin="round" />}
    </g>
  );
}

export default function JugsGame() {
  const stage = useStage();
  const [puzzles] = useState(() => makePuzzles(stage));
  const [round, setRound] = useState(1);
  const pz = puzzles[round - 1];
  const gs = geom(pz.caps);
  const [s, setS] = useState<number[]>(() => pz.caps.map(() => 0));
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: `🎯 어느 한 통에 물을 ${pz.target}L 만들어요! 통을 누르면 가득 차요. 통을 끌어 다른 통에 붓거나 배수구에 비워요.`, tone: "info" });
  const [shown, setShown] = useState<number[]>(() => pz.caps.map(() => 0));
  const [drag, setDrag] = useState<{ i: number; x: number; y: number; moved: boolean } | null>(null);
  const [hint, setHint] = useState<Move | null>(null);
  const [fx, setFx] = useState<Fx | null>(null);
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(0);
  const [t, setT] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;

  useFrame((_x, dt) => {
    setT((v) => v + dt);
    setShown((cur) => cur.map((v, i) => (reduced() ? s[i] : Math.abs(v - s[i]) < 0.02 ? s[i] : v + (s[i] - v) * Math.min(1, dt * 7))));
  }, true);

  useEffect(() => {
    if (!won) return;
    const id = window.setTimeout(() => {
      if (round >= 3) stageClear();
      else next(round + 1);
    }, round >= 3 ? 1200 : 2200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  function next(r: number) {
    const p = puzzles[r - 1];
    setRound(r);
    setS(p.caps.map(() => 0));
    setShown(p.caps.map(() => 0));
    setMoves(0);
    setWon(false);
    setStars(0);
    setHint(null);
    setFx(null);
    setMsg({ t: `라운드 ${r}: 이번엔 ${p.caps.join("L, ")}L 통으로 ${p.target}L 를 만들어요!`, tone: "info" });
  }
  const reset = () => {
    setS(pz.caps.map(() => 0));
    setMoves(0);
    setHint(null);
    setMsg({ t: "처음부터 다시 해요!", tone: "info" });
  };

  const act = (m: Move) => {
    if (won) return;
    const r = applyMove(pz.caps, s, m);
    setTouched(true);
    setHint(null);
    if (!r) {
      oops();
      setShake((k) => k + 1);
      setMsg({
        t: m.kind === "fill" ? `${pz.caps[m.i]}L 통은 벌써 가득 찼어요.` : m.kind === "empty" ? "이 통은 벌써 비었어요." : m.j !== undefined && s[m.j] === pz.caps[m.j] ? "받는 통이 가득 찼어요." : "부을 물이 없어요.",
        tone: "bad",
      });
      return;
    }
    tick();
    const nm = moves + 1;
    setS(r);
    setMoves(nm);
    setFx({ ...m, until: t + 0.7 });
    if (r.includes(pz.target)) {
      const st = jugStars(nm, pz.min);
      setWon(true);
      setStars(st);
      cheer();
      setMsg({
        t: round >= 3 ? `해냈어요! ${pz.target}L 를 만들었어요. 별 ${st}개! 레벨을 모두 깼어요!` : `해냈어요! ${nm}번 만에 ${pz.target}L! (가장 적게는 ${pz.min}번) 별 ${st}개! 곧 다음 퍼즐이에요.`,
        tone: "ok",
      });
    } else {
      const what = m.kind === "fill" ? `${pz.caps[m.i]}L 통을 가득 채웠어요.` : m.kind === "empty" ? `${pz.caps[m.i]}L 통을 비웠어요.` : `${pz.caps[m.i]}L 통의 물을 ${pz.caps[m.j!]}L 통에 부었어요.`;
      setMsg({ t: `${what}`, tone: "info" });
    }
  };

  const showHint = () => {
    const path = solve(pz.caps, s, pz.target);
    if (!path || !path.length) return;
    const m = path[0];
    setHint(m);
    tick();
    setMsg({
      t: m.kind === "fill" ? `💡 ${pz.caps[m.i]}L 통을 눌러 가득 채워 봐요.` : m.kind === "empty" ? `💡 ${pz.caps[m.i]}L 통을 배수구로 끌어 비워 봐요.` : `💡 ${pz.caps[m.i]}L 통을 ${pz.caps[m.j!]}L 통으로 끌어 부어 봐요.`,
      tone: "info",
    });
  };

  const hitJug = (x: number, y: number) => gs.findIndex((g) => x >= g.cx - g.w / 2 - 6 && x <= g.cx + g.w / 2 + 6 && y >= BASE - g.h - 10 && y <= BASE + 6);
  const inDrain = (x: number, y: number) => x >= DRAIN.x - 10 && y >= 150;

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (won) return;
    const [x, y] = svgPoint(e.currentTarget, e.clientX, e.clientY);
    const i = hitJug(x, y);
    if (i < 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ i, x, y, moved: false });
    dragRef.current = { i, x, y, moved: false };
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const [x, y] = svgPoint(e.currentTarget, e.clientX, e.clientY);
    const moved = d.moved || Math.hypot(x - d.x, y - d.y) > 10;
    const nd = { ...d, moved, x: moved ? x : d.x, y: moved ? y : d.y };
    dragRef.current = nd;
    setDrag(nd);
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    const [x, y] = svgPoint(e.currentTarget, e.clientX, e.clientY);
    if (!d.moved) return act({ kind: "fill", i: d.i });
    const over = inDrain(x, y) ? -2 : gs.findIndex((g, k) => k !== d.i && x >= g.cx - g.w / 2 - 14 && x <= g.cx + g.w / 2 + 14 && y >= BASE - g.h - 50 && y <= BASE + 6);
    if (over === -2) act({ kind: "empty", i: d.i });
    else if (over >= 0) act({ kind: "pour", i: d.i, j: over });
    else setMsg({ t: "다른 통이나 배수구 위에서 놓아 보세요.", tone: "info" });
  };

  const overIdx = drag?.moved ? (inDrain(drag.x, drag.y) ? -2 : gs.findIndex((g, k) => k !== drag.i && drag.x >= g.cx - g.w / 2 - 14 && drag.x <= g.cx + g.w / 2 + 14 && drag.y >= BASE - g.h - 50 && drag.y <= BASE + 6)) : -1;
  const fxOn = fx && t < fx.until ? fx : null;
  const water = (i: number) => BASE - 6 - (shown[i] / gs[i].cap) * (gs[i].h - 20);

  return (
    <div className="space-y-3">
      <style>{css}</style>
      <Board className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-game rounded-full bg-accent px-4 py-1 text-lg text-white shadow-[0_3px_0_0_rgba(0,0,0,0.2)]">레벨 {stage} · 라운드 {round}/3</span>
          <span className="flex gap-1" aria-label={`퍼즐 3개 중 ${round - 1 + (won ? 1 : 0)}개 성공`}>
            {[1, 2, 3].map((k) => (
              <span key={k} className={`text-2xl ${k < round || (k === round && won) ? "" : "opacity-25 grayscale"}`}>🫗</span>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill label="🎯 목표" value={`${pz.target}L`} tone="ok" />
          <Pill label="이동" value={moves} />
          <Pill label="가장 적게" value={pz.min} />
        </div>
        {won && <p className="gz-pop text-center text-4xl"><Stars n={stars} /></p>}
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <div className={`mx-auto w-full max-w-[560px] ${won ? "" : shake ? "jug-shake" : ""}`} key={won ? "w" : `s${shake}`}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VW} ${VH}`}
            className="block w-full select-none rounded-[20px] border-[3px] border-[#0f766e] shadow-[0_4px_0_0_#0f766e]"
            style={{ touchAction: "none" }}
            role="application"
            aria-label={`물통 ${pz.caps.map((c) => c + "리터").join(", ")}. 통을 누르면 가득 차고, 끌어서 다른 통에 붓거나 배수구에 비워요. 목표는 한 통에 ${pz.target}리터`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => { dragRef.current = null; setDrag(null); }}
          >
            <defs>
              <linearGradient id="jug-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8fbf3" /><stop offset="1" stopColor="#b6efe4" /></linearGradient>
              <linearGradient id="jug-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0b968" /><stop offset="1" stopColor="#c98534" /></linearGradient>
              <linearGradient id="jug-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7dd3fc" /><stop offset="1" stopColor="#0ea5e9" /></linearGradient>
              <linearGradient id="jug-pipe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d1d5db" /><stop offset="1" stopColor="#6b7280" /></linearGradient>
            </defs>
            <rect width={VW} height={VH} fill="url(#jug-wall)" />
            {[30, 120, 210, 300].map((x) => <circle key={x} cx={x} cy={150 + (x % 60)} r={26} fill="#fff" opacity={0.18} />)}
            <rect x={0} y={BASE} width={VW} height={VH - BASE} fill="url(#jug-wood)" />
            <rect x={0} y={BASE} width={VW} height={5} fill="#fde7b5" />
            {[40, 110, 200, 300].map((x) => <line key={x} x1={x} y1={BASE + 8} x2={x} y2={VH} stroke="#a8691f" strokeOpacity={0.3} />)}
            {/* 수도관 */}
            <rect x={8} y={8} width={230} height={16} rx={8} fill="url(#jug-pipe)" stroke="#4b5563" strokeWidth={2} />
            <circle cx={22} cy={16} r={9} fill="#f87171" stroke="#991b1b" strokeWidth={2} />
            <text x={22} y={20} textAnchor="middle" fontSize={11}>💧</text>
            {gs.map((g, i) => (
              <g key={i}>
                <rect x={g.cx - 9} y={22} width={18} height={14} rx={4} fill="url(#jug-pipe)" stroke="#4b5563" strokeWidth={2} />
              </g>
            ))}
            {/* 배수구 */}
            <g>
              <rect x={DRAIN.x} y={DRAIN.y} width={DRAIN.w} height={DRAIN.h} rx={14} fill="#94a3b8" stroke="#334155" strokeWidth={3} />
              <ellipse cx={DRAIN.x + DRAIN.w / 2} cy={DRAIN.y + 16} rx={30} ry={9} fill="#1e293b" />
              {[-16, -8, 0, 8, 16].map((dx) => <line key={dx} x1={DRAIN.x + DRAIN.w / 2 + dx} y1={DRAIN.y + 9} x2={DRAIN.x + DRAIN.w / 2 + dx} y2={DRAIN.y + 23} stroke="#64748b" strokeWidth={2} />)}
              <text x={DRAIN.x + DRAIN.w / 2} y={DRAIN.y + 40} textAnchor="middle" fontSize={13} fill="#0f172a" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>🕳️ 배수구</text>
              {(overIdx === -2 || (hint?.kind === "empty")) && <rect className="jug-glow" x={DRAIN.x - 4} y={DRAIN.y - 4} width={DRAIN.w + 8} height={DRAIN.h + 8} rx={16} fill="none" stroke="#f59e0b" strokeWidth={5} />}
            </g>
            {gs.map((g, i) => {
              const dragging = drag?.moved && drag.i === i;
              const glow = overIdx === i || (hint && (hint.i === i || hint.j === i)) || false;
              const party = won && s[i] === pz.target;
              return (
                <g key={i} transform={`translate(${g.cx} ${BASE})`} opacity={dragging ? 0.3 : 1} style={{ cursor: won ? "default" : "pointer" }}>
                  <Jug id={i} g={g} shown={shown[i]} actual={s[i]} t={t} color={RIM[i]} target={pz.target} glow={!!glow} party={party} />
                </g>
              );
            })}
            {/* 물줄기 */}
            {fxOn?.kind === "fill" && <path d={`M${gs[fxOn.i].cx} 36 L${gs[fxOn.i].cx} ${water(fxOn.i)}`} stroke="#38bdf8" strokeWidth={7} strokeLinecap="round" strokeDasharray="8 5" opacity={0.9}><animate attributeName="stroke-dashoffset" values="0;-26" dur="0.35s" repeatCount="indefinite" /></path>}
            {fxOn?.kind === "empty" && <path d={`M${gs[fxOn.i].cx + gs[fxOn.i].w / 2} ${BASE - gs[fxOn.i].h + 30} Q${(gs[fxOn.i].cx + DRAIN.x) / 2 + 40} ${BASE - gs[fxOn.i].h} ${DRAIN.x + 44} ${DRAIN.y + 14}`} stroke="#38bdf8" strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="7 5" opacity={0.9}><animate attributeName="stroke-dashoffset" values="0;-24" dur="0.35s" repeatCount="indefinite" /></path>}
            {fxOn?.kind === "pour" && (() => {
              const a = gs[fxOn.i], b = gs[fxOn.j!];
              const sx = a.cx + (b.cx > a.cx ? a.w / 2 : -a.w / 2), sy = BASE - a.h + 8;
              return <path d={`M${sx} ${sy} Q${(sx + b.cx) / 2} ${sy - 10} ${b.cx} ${water(fxOn.j!)}`} stroke="#38bdf8" strokeWidth={6} fill="none" strokeLinecap="round" strokeDasharray="7 5" opacity={0.9}><animate attributeName="stroke-dashoffset" values="0;-24" dur="0.35s" repeatCount="indefinite" /></path>;
            })()}
            {/* 끌고 있는 통 */}
            {drag?.moved && (
              <g transform={`translate(${drag.x} ${drag.y + gs[drag.i].h / 2 - 8}) rotate(${overIdx !== -1 ? (overIdx === -2 || gs[overIdx].cx > gs[drag.i].cx ? 28 : -28) : 0})`} pointerEvents="none" opacity={0.95}>
                <Jug id={drag.i} g={gs[drag.i]} shown={shown[drag.i]} actual={s[drag.i]} t={t} color={RIM[drag.i]} target={pz.target} glow={false} ghost />
              </g>
            )}
            {!touched && !won && (
              <g pointerEvents="none">
                <text x={gs[0].cx} y={BASE - gs[0].h - 28} textAnchor="middle" fontSize={34}>
                  👆
                  <animate attributeName="y" values={`${BASE - gs[0].h - 22};${BASE - gs[0].h - 38};${BASE - gs[0].h - 22}`} dur="0.9s" repeatCount="indefinite" />
                </text>
              </g>
            )}
          </svg>
        </div>
        <p className="text-center text-sm text-muted">통을 <b>누르면</b> 가득 · 통을 <b>끌어서</b> 다른 통 위에 놓으면 붓기 · <b>배수구</b>에 놓으면 비우기</p>
        <div className="flex gap-2">
          <GButton variant="primary" className="min-h-[56px]! flex-1 text-xl" onClick={showHint} disabled={won}>💡 힌트</GButton>
          <GButton className={`${BIG} min-h-[56px]!`} onClick={reset} disabled={won}>다시 하기</GButton>
        </div>
        <details className="rounded-card border border-line bg-surface p-3">
          <summary className="flex min-h-[48px] cursor-pointer items-center text-base font-bold">⌨ 단추로 하기</summary>
          <div className="mt-2 space-y-2">
            {pz.caps.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="font-game w-16 text-lg">{c}L 통</span>
                <GButton className={BIG} onClick={() => act({ kind: "fill", i })} disabled={won}>채우기</GButton>
                <GButton className={BIG} onClick={() => act({ kind: "empty", i })} disabled={won}>비우기</GButton>
                {pz.caps.map((c2, j) => j !== i && <GButton key={j} className={BIG} onClick={() => act({ kind: "pour", i, j })} disabled={won}>{c2}L 통에 붓기</GButton>)}
              </div>
            ))}
          </div>
        </details>
      </Board>
    </div>
  );
}
