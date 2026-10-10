import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, stageClear, svgPoint, tick, useFrame, useStage } from "./kit";
import { BIG, Stars } from "./easykit";

// ==PURE==
export type Wt = { slot: number; w: number }; // slot: 왼쪽은 음수, 오른쪽은 양수(칸 수)

/** 돌리는 힘(토크) 합 = 무게×거리. 오른쪽은 +, 왼쪽은 −. 0이면 수평 */
export const netTorque = (ws: Wt[]) => ws.reduce((s, x) => s + x.w * x.slot, 0);
export const sideTorque = (ws: Wt[], side: 1 | -1) => ws.filter((x) => Math.sign(x.slot) === side).reduce((s, x) => s + x.w * Math.abs(x.slot), 0);
/** 기울기(도). 양수면 오른쪽이 내려가요. */
export const tiltOf = (net: number) => Math.max(-16, Math.min(16, net * 3));

/** 레벨(1~10)별 규칙: 눈금 칸 수, 쓸 수 있는 추, 왼쪽 고정 추 개수, 최소 힘, 추 한 개로는 못 풀게 할지 */
export function levelSpec(level: number) {
  const L = Math.max(1, Math.min(10, level));
  return {
    maxSlot: L <= 4 ? 3 : 4,
    weights: L <= 3 ? [1, 2, 3] : [1, 2, 3, 4],
    fixedCount: L <= 3 ? 1 : 2,
    minT: [2, 3, 4, 4, 5, 6, 6, 8, 8, 10][L - 1],
    needMulti: L >= 8,
  };
}

/** 오른쪽 눈금 1~maxSlot 에 추(없음 또는 weights 중 하나)를 칸마다 하나씩 올려 힘 합이 T가 되는 모든 방법 */
export function solutions(T: number, maxSlot = 3, weights: number[] = [1, 2, 3]): Wt[][] {
  const out: Wt[][] = [];
  const opts = [0, ...weights];
  const rec = (slot: number, acc: Wt[], sum: number) => {
    if (slot > maxSlot) {
      if (sum === T && acc.length > 0) out.push(acc);
      return;
    }
    for (const w of opts) {
      const ns = sum + w * slot;
      if (ns > T) break;
      rec(slot + 1, w ? [...acc, { slot, w }] : acc, ns);
    }
  };
  rec(1, [], 0);
  return out;
}

export function makeProblem(rnd: (n: number) => number, level = 1): { fixed: Wt[]; T: number } {
  const sp = levelSpec(level);
  for (let t = 0; t < 2000; t++) {
    const slots: number[] = [];
    while (slots.length < sp.fixedCount) {
      const s = -(1 + rnd(sp.maxSlot));
      if (!slots.includes(s)) slots.push(s);
    }
    const fixed = slots.map((slot) => ({ slot, w: sp.weights[rnd(sp.weights.length)] }));
    const T = -netTorque(fixed);
    if (T < sp.minT) continue;
    const sols = solutions(T, sp.maxSlot, sp.weights);
    if (sols.length === 0) continue;
    if (sp.needMulti && sols.some((x) => x.length === 1)) continue;
    return { fixed, T };
  }
  return { fixed: [{ slot: -2, w: 2 }], T: 4 };
}

export type Problem = { fixed: Wt[]; T: number; mystery?: { slot: number; q: number }; opts?: number[] };

/** 라운드 종류: 레벨 4~6은 두 번째, 7~10은 첫째·셋째가 ‘모르는 무게(❓)’ 라운드 */
export function roundKind(level: number, r: number): "balance" | "mystery" {
  if (level < 4) return "balance";
  if (level <= 6) return r === 1 ? "mystery" : "balance";
  return r === 1 ? "balance" : "mystery";
}

/** ❓ 문제: 왼쪽 칸 s 에 ❓(정수 1~5kg), 레벨 7부터는 아는 추도 하나 더. 오른쪽에 추를 놓아 수평이 되는 방법이 꼭 있고, 수평이면 ❓의 무게가 정수로 정해져요. */
export function makeMysteryProblem(rnd: (n: number) => number, level: number): Problem {
  const sp = levelSpec(level);
  for (let t = 0; t < 3000; t++) {
    const s = 1 + rnd(sp.maxSlot);
    const q = 1 + rnd(5);
    let fixed: Wt[] = [];
    let T = q * s;
    if (level >= 7) {
      let s2 = 1 + rnd(sp.maxSlot);
      while (s2 === s) s2 = 1 + rnd(sp.maxSlot);
      const w = sp.weights[rnd(sp.weights.length)];
      fixed = [{ slot: -s2, w }];
      T += w * s2;
    }
    if (T < 4 || solutions(T, sp.maxSlot, sp.weights).length === 0) continue;
    const opts = new Set<number>([q]);
    while (opts.size < 3) opts.add(1 + rnd(6));
    return { fixed, T, mystery: { slot: -s, q }, opts: [...opts].sort((a, b) => a - b) };
  }
  return { fixed: [], T: 6, mystery: { slot: -2, q: 3 }, opts: [2, 3, 4] };
}
// ==END==

const CX = 220;
const CY = 140;
const ROUNDS = 3;
const SHELF_Y = 322; // 선반 위 추의 바닥
const blockH = (w: number) => 22 + w * 8;
const GF = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
const CSS = `
@keyframes lv-hop { 0%,100% { transform: translateY(0); } 35% { transform: translateY(-14px); } 65% { transform: translateY(0); } 82% { transform: translateY(-5px); } }
@keyframes lv-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-3px); } }
.lv-hop { animation: lv-hop .8s ease-out; transform-box: fill-box; transform-origin: center bottom; }
.lv-shake { animation: lv-shake .4s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .lv-hop, .lv-shake { animation: none; } }
`;
const LOOK: Record<number, { body: string; line: string }> = {
  1: { body: "#f9a8d4", line: "#be185d" }, // 토끼
  2: { body: "#fde047", line: "#a16207" }, // 병아리
  3: { body: "#fdba74", line: "#c2410c" }, // 곰
  4: { body: "#c4b5fd", line: "#6d28d9" }, // 하마
};
/** 무게가 몸에 적힌 동물 친구(바닥 가운데 cx, 바닥 높이 bottom) */
function Critter({ cx, bottom, w: wReal, team, mood, mystery }: { cx: number; bottom: number; w: number; team?: boolean; mood: "happy" | "calm"; mystery?: boolean }) {
  const w = mystery ? 3 : wReal; // ❓는 몸집으로 무게를 짐작하지 못하게 늘 같은 크기
  const h = blockH(w);
  const rx = 13 + w * 2.5;
  const cy = bottom - h / 2;
  const c = mystery ? { body: "#f5d0fe", line: "#a21caf" } : team ? { body: "#93c5fd", line: "#1d4ed8" } : LOOK[w];
  const ex = rx * 0.38;
  const ey = cy - h * 0.16;
  return (
    <g pointerEvents="none">
      <ellipse cx={cx} cy={bottom + 1} rx={rx * 0.9} ry="3" fill="rgba(0,0,0,0.18)" />
      {w === 1 && (
        <g fill={c.body} stroke={c.line} strokeWidth="2.5">
          <ellipse cx={cx - 7} cy={cy - h / 2 - 7} rx="4.5" ry="10" />
          <ellipse cx={cx + 7} cy={cy - h / 2 - 7} rx="4.5" ry="10" />
        </g>
      )}
      {w >= 3 && (
        <g fill={c.body} stroke={c.line} strokeWidth="2.5">
          <circle cx={cx - rx * 0.62} cy={cy - h / 2 + 4} r="7" />
          <circle cx={cx + rx * 0.62} cy={cy - h / 2 + 4} r="7" />
        </g>
      )}
      {w === 2 && <path d={`M ${cx - 4} ${cy - h / 2 + 2} Q ${cx} ${cy - h / 2 - 10} ${cx + 4} ${cy - h / 2 + 2}`} fill={c.body} stroke={c.line} strokeWidth="2.5" />}
      <ellipse cx={cx} cy={cy} rx={rx} ry={h / 2} fill={c.body} stroke={c.line} strokeWidth="3" />
      <ellipse cx={cx - rx * 0.35} cy={cy - h * 0.25} rx={rx * 0.32} ry={h * 0.13} fill="#fff" opacity="0.45" />
      <circle cx={cx - ex} cy={ey} r="2.8" fill="#1e1b4b" />
      <circle cx={cx + ex} cy={ey} r="2.8" fill="#1e1b4b" />
      <circle cx={cx - ex - 4} cy={ey + 6} r="2.6" fill="#fb7185" opacity="0.7" />
      <circle cx={cx + ex + 4} cy={ey + 6} r="2.6" fill="#fb7185" opacity="0.7" />
      {w === 2 ? (
        <path d={`M ${cx - 4} ${ey + 4} L ${cx + 4} ${ey + 4} L ${cx} ${ey + 9} Z`} fill="#fb923c" stroke="#c2410c" strokeWidth="1" />
      ) : mood === "happy" ? (
        <path d={`M ${cx - 5} ${ey + 4} Q ${cx} ${ey + 11} ${cx + 5} ${ey + 4}`} fill="#be123c" stroke="#1e1b4b" strokeWidth="1.5" />
      ) : (
        <path d={`M ${cx - 3.5} ${ey + 6} Q ${cx} ${ey + 8.5} ${cx + 3.5} ${ey + 6}`} fill="none" stroke="#1e1b4b" strokeWidth="1.8" strokeLinecap="round" />
      )}
      <rect x={cx - 16} y={cy + h / 2 - 17} width="32" height="14" rx="7" fill="#fff" stroke={c.line} strokeWidth="1.5" />
      <text x={cx} y={cy + h / 2 - 6} fontSize="12" textAnchor="middle" fill="#1e1b4b" style={GF}>
        {mystery ? "❓" : `${w}kg`}
      </text>
    </g>
  );
}
const rad = (d: number) => (d * Math.PI) / 180;

type Mode = "problem" | "free";
type Drag = { w: number; x: number; y: number; moved: number; sx: number; sy: number; from: "shelf" | "beam" };

export default function LeverGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const timer = useRef(0);
  const level = useStage();
  const sp = levelSpec(level);
  const GAP = sp.maxSlot === 3 ? 64 : 46;
  const SLOTS = [...Array.from({ length: sp.maxSlot }, (_, i) => -(sp.maxSlot - i)), ...Array.from({ length: sp.maxSlot }, (_, i) => i + 1)];
  const SHELF_X: Record<number, number> = Object.fromEntries(sp.weights.map((w, i) => [w, 220 + (i - (sp.weights.length - 1) / 2) * (sp.weights.length > 3 ? 98 : 110)]));
  const [mode, setMode] = useState<Mode>("problem");
  const genProblem = (r: number): Problem => (roundKind(level, r) === "mystery" ? makeMysteryProblem(rand, level) : makeProblem(rand, level));
  const [prob, setProb] = useState<Problem>(() => genProblem(0));
  const [asking, setAsking] = useState(false); // 수평을 만들었고 ❓의 무게를 고르는 중
  const [wrongOpts, setWrongOpts] = useState<number[]>([]);
  const [mine, setMine] = useState<Wt[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState(false);
  const [round, setRound] = useState(0); // 깬 라운드 수
  const [solved, setSolved] = useState(0);
  const [done, setDone] = useState(false); // 이 문제를 풀었는지
  const [peeked, setPeeked] = useState(false);
  const [touched, setTouched] = useState(false);
  const [ang, setAng] = useState(0);
  const [hopKey, setHopKey] = useState(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const myst = mode === "problem" ? prob.mystery : undefined;
  const mystWt: Wt[] = myst ? [{ slot: myst.slot, w: myst.q }] : [];
  const fixed = mode === "problem" ? [...prob.fixed, ...mystWt] : [];
  const all = [...fixed, ...mine];
  const mystHidden = !!myst && !done;
  const net = netTorque(all);
  const left = sideTorque(all, -1);
  const right = sideTorque(all, 1);
  const balanced = net === 0 && all.some((x) => x.slot < 0) && all.some((x) => x.slot > 0);

  const slotOpen = (s: number) => (mode === "free" ? true : s > 0);
  const slotPos = (s: number, a = ang): [number, number] => {
    const dx = s * GAP;
    const dy = -30;
    const r = rad(a);
    return [CX + dx * Math.cos(r) - dy * Math.sin(r), CY + dx * Math.sin(r) + dy * Math.cos(r)];
  };
  /** 끌고 있는 추(가운데 좌표 cx,cy)가 놓일 칸: 비어 있고 가까운 칸 */
  const slotAt = (cx: number, cy: number, exclude?: Wt[]) => {
    const taken = (exclude ?? all).map((x) => x.slot);
    let best: number | null = null;
    let bd = 46;
    for (const s of SLOTS) {
      if (!slotOpen(s) || taken.includes(s)) continue;
      const [px, py] = slotPos(s);
      const d = Math.hypot(px - cx, py - cy);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  };
  // 끄는 중에는 놓일 칸에 미리 얹어 보여 줘요(기울기도 미리 보기)
  const hoverSlot = drag ? slotAt(drag.x, drag.y - 34) : null;
  const previewNet = drag && hoverSlot !== null ? net + drag.w * hoverSlot : net;
  const tgt = tiltOf(previewNet);

  useFrame((_, dt) => {
    setAng((a) => {
      const d = tgt - a;
      return Math.abs(d) < 0.03 ? tgt : a + d * Math.min(1, dt * 6);
    });
  }, Math.abs(ang - tgt) > 0.03);

  const finishRound = () => {
    setDone(true);
    cheer();
    setHopKey((k) => k + 1);
    setSolved((v) => v + 1);
    const n = round + 1;
    setRound(n);
    if (n >= ROUNDS) timer.current = window.setTimeout(stageClear, 1200);
    else timer.current = window.setTimeout(() => newProblem(n), 2200);
  };
  const place = (list: Wt[]) => {
    setMine(list);
    tick();
    const bal = netTorque([...prob.fixed, ...mystWt, ...list]) === 0 && list.length > 0;
    if (mode === "problem" && !done && !asking && bal) {
      if (myst) {
        setAsking(true);
        setHopKey((k) => k + 1);
      } else finishRound();
    } else if (mode === "free" && netTorque(list) === 0 && list.some((x) => x.slot < 0) && list.some((x) => x.slot > 0)) {
      cheer();
      setHopKey((k) => k + 1);
    }
  };
  const answer = (v: number) => {
    if (!myst || done || wrongOpts.includes(v)) return;
    if (v === myst.q) finishRound();
    else {
      oops();
      setWrongOpts((w) => [...w, v]);
    }
  };

  const newProblem = (r = round) => {
    window.clearTimeout(timer.current);
    setProb(genProblem(r));
    setMine([]);
    setDone(false);
    setPeeked(false);
    setAsking(false);
    setWrongOpts([]);
  };
  const showAnswer = () => {
    const sols = solutions(prob.T, sp.maxSlot, sp.weights);
    const small = sols.filter((x) => x.length <= 3);
    const pool = small.length ? small : sols;
    const pickOne = pool[rand(pool.length)];
    setPeeked(true);
    setMine(pickOne);
    if (!done) {
      setDone(true);
      // 답을 본 문제는 라운드로 세지 않고 새 문제로 바꿔요
      timer.current = window.setTimeout(() => newProblem(round), 3000);
    }
  };
  const changeMode = (m: Mode) => {
    window.clearTimeout(timer.current);
    setMode(m);
    setMine([]);
    setDone(false);
    setPeeked(false);
    setAsking(false);
    setWrongOpts([]);
  };

  // ── 포인터: 선반의 추나 막대 위의 추를 끌어서 칸에 놓기 ──
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (done || asking) return;
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setTouched(true);
    // 막대 위 내 추
    for (const m of mine) {
      const [px, py] = slotPos(m.slot);
      if (Math.abs(x - px) < 34 && y > py - blockH(m.w) - 8 && y < py + 24) {
        svg.setPointerCapture(e.pointerId);
        setMine((v) => v.filter((q) => q.slot !== m.slot));
        setDrag({ w: m.w, x, y, moved: 0, sx: x, sy: y, from: "beam" });
        tick();
        return;
      }
    }
    // 선반의 추
    for (const w of sp.weights) {
      if (Math.abs(x - SHELF_X[w]) < 44 && y > SHELF_Y - blockH(w) - 14 && y < SHELF_Y + 14) {
        svg.setPointerCapture(e.pointerId);
        setDrag({ w, x, y, moved: 0, sx: x, sy: y, from: "shelf" });
        setPick(w);
        return;
      }
    }
    // 고른 추가 있을 때 빈 칸을 톡 누르면 놓기
    if (pick !== null) {
      const s = slotAt(x, y);
      if (s !== null) place([...mine, { slot: s, w: pick }]);
    }
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setDrag({ ...drag, x, y, moved: Math.max(drag.moved, Math.hypot(x - drag.sx, y - drag.sy)) });
  };
  const up = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.from === "shelf" && d.moved < 8) return; // 톡 눌렀을 뿐: 이 추를 골라 둠
    const s = slotAt(d.x, d.y - 34);
    if (s !== null) place([...mine, { slot: s, w: d.w }]);
    else if (d.from === "shelf") oops();
  };

  // 말풍선
  let say: { tone: "info" | "ok" | "bad"; text: string };
  if (asking && !done) {
    say = { tone: wrongOpts.length ? "bad" : "ok", text: wrongOpts.length ? "아직이에요, 괜찮아요! 수평이면 왼쪽 힘과 오른쪽 힘이 같아요. 오른쪽 힘을 먼저 구해 봐요." : "와, 수평이에요! 그럼 ❓는 몇 kg일까요? 아래에서 골라요!" };
  } else if (balanced && (mode === "free" || done)) {
    say = { tone: "ok", text: `와, 수평이에요! 잘했어요! ⭐ 왼쪽 힘 ${left} = 오른쪽 힘 ${right}.${peeked ? " (답을 본 문제는 라운드로 세지 않아요. 새 문제가 나와요.)" : round < ROUNDS ? " 곧 다음 라운드로 가요." : " 레벨 클리어!"}` };
  } else if (mode === "problem" && mine.length === 0) {
    say = { tone: "info", text: myst ? "❓ 동물의 무게는 비밀이에요! 오른쪽에 추를 놓아 수평을 만들면 알 수 있어요." : "아래 선반의 추를 끌어서 오른쪽 + 칸에 놓아요. 막대가 수평이 되면 성공!" };
  } else if (net > 0) {
    say = { tone: "bad", text: "오른쪽이 더 무거워요. 괜찮아요! 놓은 추를 끌어서 옮기거나 막대 밖으로 빼 봐요." };
  } else if (net < 0) {
    say = { tone: "bad", text: mode === "problem" ? "왼쪽이 더 무거워요. 괜찮아요! 오른쪽에 추를 더하거나 더 멀리 놓아 봐요." : "왼쪽이 더 무거워요. 오른쪽에도 추를 놓아 봐요." };
  } else {
    say = { tone: "info", text: mode === "free" ? "선반의 추를 끌어서 양쪽 칸에 놓아 보세요!" : "추를 놓아 보세요." };
  }

  const exprOf = (ws: Wt[], side: 1 | -1) => {
    const part = ws.filter((x) => Math.sign(x.slot) === side).sort((a, b) => Math.abs(a.slot) - Math.abs(b.slot));
    return part.length ? part.map((x) => `${x.w}×${Math.abs(x.slot)}`).join(" + ") : "0";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode === "problem" && <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`} />}
        {mode === "problem" && <Stat label="별" value={solved} tone="ok" />}
        {mode === "free" && <Stat label="모드" value="마음대로 놀기" />}
      </div>

      <Board>
        <style>{CSS}</style>
        <p className="font-game mb-2 text-center text-xl">
          {mode === "problem" ? (myst ? "수평을 만들고 ❓ 동물의 무게를 알아맞혀요!" : "아래 추를 끌어다 오른쪽 칸에 놓아 수평을 만들어요!") : "추를 끌어다 칸에 놓아서 막대를 수평으로 만들어 봐요!"}
        </p>
        <svg
          ref={svgRef}
          viewBox="0 0 440 345"
          className="mx-auto block w-full max-w-[640px] touch-none select-none overflow-hidden rounded-card"
          style={{ touchAction: "none" }}
          role="group"
          aria-label={`막대 저울. 지금 ${net === 0 ? "수평" : net > 0 ? "오른쪽이 무거워요" : "왼쪽이 무거워요"}. 선반의 추를 끌어서 칸에 놓아요.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        >
          <defs>
            <linearGradient id="lv-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" />
              <stop offset="1" stopColor="#e0f2fe" />
            </linearGradient>
            <linearGradient id="lv-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#86efac" />
              <stop offset="1" stopColor="#22c55e" />
            </linearGradient>
            <linearGradient id="lv-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fcd34d" />
              <stop offset="1" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="lv-stand" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fb7185" />
              <stop offset="1" stopColor="#e11d48" />
            </linearGradient>
          </defs>
          {/* 놀이터: 하늘·해·구름·잔디 */}
          <rect x="0" y="0" width="440" height="345" fill="url(#lv-sky)" />
          <circle cx="398" cy="38" r="22" fill="#fde047" stroke="#f59e0b" strokeWidth="3" />
          <g fill="#fff" opacity="0.9">
            <ellipse cx="70" cy="40" rx="30" ry="12" />
            <ellipse cx="92" cy="32" rx="18" ry="12" />
            <ellipse cx="290" cy="28" rx="24" ry="9" />
            <ellipse cx="308" cy="22" rx="14" ry="9" />
          </g>
          <path d="M 0 205 Q 110 188 220 200 T 440 196 L 440 345 L 0 345 Z" fill="url(#lv-grass)" />
          {[40, 95, 150, 300, 350, 410].map((x, i) => (
            <path key={x} d={`M ${x} ${232 + (i % 3) * 8} l 3 -9 l 3 9`} fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" />
          ))}

          {/* 받침 */}
          <path d={`M ${CX} ${CY - 4} L ${CX - 30} ${CY + 62} Q ${CX} ${CY + 70} ${CX + 30} ${CY + 62} Z`} fill="url(#lv-stand)" stroke="#9f1239" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx={CX} cy={CY + 66} rx="60" ry="8" fill="rgba(0,0,0,0.15)" />

          <g transform={`rotate(${ang} ${CX} ${CY})`}>
            {/* 시소 판 */}
            <rect x={CX - 215} y={CY - 7} width="430" height="14" rx="7" fill="url(#lv-wood)" stroke="#92400e" strokeWidth="3" />
            {Array.from({ length: 2 * sp.maxSlot + 1 }, (_, i) => i - sp.maxSlot).map((s) => (
              <g key={s}>
                <line x1={CX + s * GAP} y1={CY - 5} x2={CX + s * GAP} y2={CY + 5} stroke="#92400e" strokeWidth={s === 0 ? 3 : 2} strokeLinecap="round" />
                <circle cx={CX + s * GAP} cy={CY + 22} r="11" fill="#fff" stroke="#d97706" strokeWidth="2" />
                <text x={CX + s * GAP} y={CY + 28} fontSize="16" textAnchor="middle" fill="#92400e" style={GF}>
                  {Math.abs(s)}
                </text>
              </g>
            ))}
            <g key={`crew${hopKey}`} className={balanced ? "lv-hop" : ""}>
              {SLOTS.map((s) => {
                const w = all.find((q) => q.slot === s);
                if (!w) return null;
                return <Critter key={s} cx={CX + s * GAP} bottom={CY - 7} w={w.w} mystery={mystHidden && !!myst && s === myst.slot} team={!mine.some((q) => q.slot === s)} mood={balanced ? "happy" : "calm"} />;
              })}
            </g>
            {SLOTS.map((s) => {
              const x = CX + s * GAP;
              const w = all.find((q) => q.slot === s);
              const open = slotOpen(s);
              const hov = hoverSlot === s;
              if (w || !open) return null;
              return (
                <g key={s} aria-hidden="true">
                  <circle cx={x} cy={CY - 30} r={hov ? 24 : 18} fill={hov ? "rgba(34,197,94,0.45)" : "rgba(255,255,255,0.75)"} stroke={hov ? "#15803d" : "#e8552f"} strokeWidth="2.5" strokeDasharray={hov ? "0" : "5 3"} />
                  <text x={x} y={CY - 21} fontSize="26" textAnchor="middle" fill={hov ? "#15803d" : "#e8552f"} style={GF}>+</text>
                </g>
              );
            })}
            {balanced && (
              <g aria-hidden="true">
                {[-200, 200].map((d) => (
                  <text key={d} x={CX + d} y={CY - 44} fontSize="20" textAnchor="middle">✨</text>
                ))}
              </g>
            )}
          </g>
          <circle cx={CX} cy={CY} r="6" fill="#fde047" stroke="#92400e" strokeWidth="2.5" />
          <text x={CX - 205} y={CY + 100} fontSize="15" fill="#14532d" style={GF}>왼쪽</text>
          <text x={CX + 160} y={CY + 100} fontSize="15" fill="#14532d" style={GF}>오른쪽</text>

          {/* 대기석 벤치 */}
          <rect x="34" y={SHELF_Y + 10} width="10" height="16" rx="3" fill="#92400e" />
          <rect x="396" y={SHELF_Y + 10} width="10" height="16" rx="3" fill="#92400e" />
          <rect x="20" y={SHELF_Y + 3} width="400" height="12" rx="6" fill="url(#lv-wood)" stroke="#92400e" strokeWidth="2.5" />
          <g aria-hidden="true">
            <rect x="140" y={SHELF_Y - 76} width="160" height="24" rx="12" fill="#fff" stroke="#16a34a" strokeWidth="2" />
            <text x="220" y={SHELF_Y - 59} fontSize="14" textAnchor="middle" fill="#166534" style={GF}>대기석 · 끌어서 태워요</text>
          </g>
          {sp.weights.map((w) => (
            <g key={w} opacity={drag && drag.from === "shelf" && drag.w === w ? 0.4 : 1} style={{ cursor: "grab" }}>
              <Critter cx={SHELF_X[w]} bottom={SHELF_Y + 3} w={w} mood="calm" />
              {pick === w && !drag && <rect x={SHELF_X[w] - 30} y={SHELF_Y + 3 - blockH(w) - 16} width="60" height={blockH(w) + 22} rx="12" fill="none" stroke="#e8552f" strokeWidth="3" />}
            </g>
          ))}
          {!touched && !done && (
            <text fontSize="26" aria-hidden="true">
              👆
              <animate attributeName="x" values={`${SHELF_X[2]};${CX + 2 * GAP};${CX + 2 * GAP};${SHELF_X[2]}`} dur="2.8s" repeatCount="indefinite" />
              <animate attributeName="y" values={`${SHELF_Y};${CY + 10};${CY + 10};${SHELF_Y}`} dur="2.8s" repeatCount="indefinite" />
            </text>
          )}

          {/* 끌고 있는 동물: 손가락 위로 띄워서 가려지지 않게 */}
          {drag && <Critter cx={drag.x} bottom={drag.y - 34 + blockH(drag.w) / 2} w={drag.w} mood="happy" />}
        </svg>

        {hint && (
          <div className="mt-2 space-y-2 text-center text-base">
            <p className="font-semibold">돌리는 힘 = 무게 × 가운데에서 떨어진 칸 수</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="rounded-card bg-bg px-3 py-2">왼쪽 힘 <strong className="tabular-nums">{mystHidden ? "?" : left}</strong><span className="block tabular-nums text-muted">{mystHidden && myst ? exprOf(all, -1).replace(`${myst.q}×${-myst.slot}`, `❓×${-myst.slot}`) : exprOf(all, -1)}</span></p>
              <p className="rounded-card bg-bg px-3 py-2">오른쪽 힘 <strong className="tabular-nums">{right}</strong><span className="block tabular-nums text-muted">{exprOf(all, 1)}</span></p>
            </div>
            <p className="text-muted">두 힘이 같으면 수평이 돼요!</p>
          </div>
        )}
        {mode === "problem" && done && !peeked && <p className="mt-1 text-center"><Stars n={1} max={1} /></p>}
      </Board>

      <Say tone={say.tone}>{say.text}</Say>
      {asking && !done && prob.opts && (
        <div className="grid grid-cols-3 gap-3" role="group" aria-label="❓의 무게 고르기">
          {prob.opts.map((v) => (
            <GButton key={v} variant="soft" disabled={wrongOpts.includes(v)} onClick={() => answer(v)} className="min-h-[64px]! text-2xl">
              {v}kg
            </GButton>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
          힌트 {hint ? "숨기기" : "보기"}
        </GButton>
        {mode === "problem" && !done && !asking && (
          <GButton onClick={showAnswer} className={BIG}>
            답 하나 보기
          </GButton>
        )}
        <GButton onClick={() => setMine([])} className={BIG}>
          추 모두 빼기
        </GButton>
        <GButton pressed={mode === "free"} className={BIG} onClick={() => changeMode(mode === "free" ? "problem" : "free")}>
          마음대로 놀기
        </GButton>
      </div>
    </div>
  );
}
