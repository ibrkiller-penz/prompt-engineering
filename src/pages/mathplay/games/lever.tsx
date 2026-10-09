import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, svgPoint, tick, useFrame } from "./kit";
import { BIG, Stars } from "./easykit";

// ==PURE==
export type Wt = { slot: number; w: number }; // slot: -3~-1(왼쪽), 1~3(오른쪽)
export const WEIGHTS = [1, 2, 3];
export const MAXSLOT = 3;

/** 돌리는 힘(토크) 합 = 무게×거리. 오른쪽은 +, 왼쪽은 −. 0이면 수평 */
export const netTorque = (ws: Wt[]) => ws.reduce((s, x) => s + x.w * x.slot, 0);
export const sideTorque = (ws: Wt[], side: 1 | -1) => ws.filter((x) => Math.sign(x.slot) === side).reduce((s, x) => s + x.w * Math.abs(x.slot), 0);
/** 기울기(도). 양수면 오른쪽이 내려가요. */
export const tiltOf = (net: number) => Math.max(-16, Math.min(16, net * 3));

/** 오른쪽 눈금 1~3에 추(없음 또는 1·2·3kg)를 올려서 돌리는 힘 합이 T가 되는 모든 방법 */
export function solutions(T: number): Wt[][] {
  const out: Wt[][] = [];
  const opts = [0, ...WEIGHTS];
  const rec = (slot: number, acc: Wt[], sum: number) => {
    if (slot > MAXSLOT) {
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

/** 쉬운 문제: 왼쪽에 추 1개. 어려운 문제: 추 2개 */
export function makeProblem(rnd: (n: number) => number, hard = false): { fixed: Wt[]; T: number } {
  for (let t = 0; t < 500; t++) {
    const count = hard ? 2 : 1;
    const slots: number[] = [];
    while (slots.length < count) {
      const s = -(1 + rnd(MAXSLOT));
      if (!slots.includes(s)) slots.push(s);
    }
    const fixed = slots.map((slot) => ({ slot, w: WEIGHTS[rnd(WEIGHTS.length)] }));
    const T = -netTorque(fixed);
    if (T >= (hard ? 4 : 2) && solutions(T).length >= (hard ? 3 : 2)) return { fixed, T };
  }
  return { fixed: [{ slot: -2, w: 2 }], T: 4 };
}
// ==END==

const CX = 220;
const CY = 140;
const GAP = 64;
const ROUNDS = 5;
const SLOTS = [-3, -2, -1, 1, 2, 3];
const SHELF_X: Record<number, number> = { 1: 110, 2: 220, 3: 330 };
const SHELF_Y = 322; // 선반 위 추의 바닥
const blockH = (w: number) => 22 + w * 8;
const rad = (d: number) => (d * Math.PI) / 180;

type Mode = "problem" | "free";
type Drag = { w: number; x: number; y: number; moved: number; sx: number; sy: number; from: "shelf" | "beam" };

export default function LeverGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const timer = useRef(0);
  const [mode, setMode] = useState<Mode>("problem");
  const [hard, setHard] = useState(false);
  const [prob, setProb] = useState(() => makeProblem(rand, false));
  const [mine, setMine] = useState<Wt[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState(false);
  const [round, setRound] = useState(1);
  const [solved, setSolved] = useState(0);
  const [done, setDone] = useState(false); // 이 문제를 풀었는지
  const [peeked, setPeeked] = useState(false);
  const [touched, setTouched] = useState(false);
  const [ang, setAng] = useState(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const fixed = mode === "problem" ? prob.fixed : [];
  const all = [...fixed, ...mine];
  const net = netTorque(all);
  const left = sideTorque(all, -1);
  const right = sideTorque(all, 1);
  const balanced = net === 0 && all.some((x) => x.slot < 0) && all.some((x) => x.slot > 0);
  const finished = mode === "problem" && done && round === ROUNDS;

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

  const place = (list: Wt[]) => {
    setMine(list);
    tick();
    if (mode === "problem" && !done && netTorque([...prob.fixed, ...list]) === 0 && list.length > 0) {
      setDone(true);
      cheer();
      if (!peeked) setSolved((v) => v + 1);
      if (round < ROUNDS) {
        timer.current = window.setTimeout(() => newProblem(hard, true), 2200);
      }
    } else if (mode === "free" && netTorque(list) === 0 && list.some((x) => x.slot < 0) && list.some((x) => x.slot > 0)) cheer();
  };

  const newProblem = (h = hard, advance = false) => {
    window.clearTimeout(timer.current);
    setProb(makeProblem(rand, h));
    setMine([]);
    setDone(false);
    setPeeked(false);
    if (advance) setRound((r) => r + 1);
  };
  const restart = (h = hard) => {
    window.clearTimeout(timer.current);
    setProb(makeProblem(rand, h));
    setMine([]);
    setDone(false);
    setPeeked(false);
    setRound(1);
    setSolved(0);
  };
  const showAnswer = () => {
    const sols = solutions(prob.T);
    const small = sols.filter((x) => x.length <= 3);
    const pool = small.length ? small : sols;
    const pickOne = pool[rand(pool.length)];
    setPeeked(true);
    setMine(pickOne);
    if (!done) {
      setDone(true);
      if (round < ROUNDS) timer.current = window.setTimeout(() => newProblem(hard, true), 3000);
    }
  };
  const changeMode = (m: Mode) => {
    window.clearTimeout(timer.current);
    setMode(m);
    setMine([]);
    setDone(false);
    setPeeked(false);
  };

  // ── 포인터: 선반의 추나 막대 위의 추를 끌어서 칸에 놓기 ──
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (done) return;
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
    for (const w of [1, 2, 3]) {
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
  if (balanced && (mode === "free" || done)) {
    say = { tone: "ok", text: `와, 수평이에요! 잘했어요! ⭐ 왼쪽 힘 ${left} = 오른쪽 힘 ${right}.${peeked ? " (답을 보고 맞춰서 점수는 그대로예요.)" : round < ROUNDS ? " 곧 다음 문제로 가요." : ""}` };
  } else if (mode === "problem" && mine.length === 0) {
    say = { tone: "info", text: "아래 선반의 추를 끌어서 오른쪽 + 칸에 놓아요. 막대가 수평이 되면 성공!" };
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

  const block = (cx: number, bottom: number, w: number, color: string, stroke: string, key?: string, lift = false) => (
    <g key={key} transform={lift ? `rotate(0)` : undefined}>
      <rect x={cx - 21} y={bottom - blockH(w)} width="42" height={blockH(w)} rx="5" fill={color} stroke={stroke} strokeWidth="1.5" />
      <text x={cx} y={bottom - blockH(w) / 2 + 5} fontSize="15" fontWeight="800" textAnchor="middle" fill="#fff" pointerEvents="none">
        {w}kg
      </text>
    </g>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode === "problem" && <Stat label="문제" value={`${round}/${ROUNDS}`} />}
        {mode === "problem" && <Stat label="별" value={solved} tone="ok" />}
        {mode === "free" && <Stat label="모드" value="마음대로 놀기" />}
      </div>

      <Board>
        <p className="mb-2 text-center text-base font-semibold">
          {mode === "problem" ? "아래 추를 끌어다 오른쪽 칸에 놓아 수평을 만들어요!" : "추를 끌어다 칸에 놓아서 막대를 수평으로 만들어 봐요!"}
        </p>
        <svg
          ref={svgRef}
          viewBox="0 0 440 345"
          className="mx-auto block w-full max-w-[640px] touch-none select-none rounded-card bg-bg"
          style={{ touchAction: "none" }}
          role="group"
          aria-label={`막대 저울. 지금 ${net === 0 ? "수평" : net > 0 ? "오른쪽이 무거워요" : "왼쪽이 무거워요"}. 선반의 추를 끌어서 칸에 놓아요.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        >
          <polygon points={`${CX},${CY} ${CX - 26},${CY + 62} ${CX + 26},${CY + 62}`} fill="#9ca3af" stroke="#6b7280" />
          <rect x={CX - 70} y={CY + 62} width="140" height="10" rx="3" fill="#6b7280" />

          <g transform={`rotate(${ang} ${CX} ${CY})`}>
            <rect x={CX - 215} y={CY - 6} width="430" height="12" rx="4" fill={balanced ? "#86efac" : "#d6b27a"} stroke={balanced ? "#15803d" : "#92400e"} />
            {Array.from({ length: 7 }, (_, i) => i - 3).map((s) => (
              <g key={s}>
                <line x1={CX + s * GAP} y1={CY - 6} x2={CX + s * GAP} y2={CY + 6} stroke="#92400e" strokeWidth={s === 0 ? 2.5 : 1.2} />
                <text x={CX + s * GAP} y={CY + 26} fontSize="16" fontWeight="700" textAnchor="middle" fill="#6b4a1f">
                  {Math.abs(s)}
                </text>
              </g>
            ))}
            {SLOTS.map((s) => {
              const x = CX + s * GAP;
              const w = all.find((q) => q.slot === s);
              const isMine = mine.some((q) => q.slot === s);
              const open = slotOpen(s);
              const hov = hoverSlot === s;
              return (
                <g key={s}>
                  {w && (
                    <g>
                      <rect x={x - 21} y={CY - 6 - blockH(w.w)} width="42" height={blockH(w.w)} rx="5" fill={isMine ? "#f59e0b" : "#3b82f6"} stroke={isMine ? "#b45309" : "#1d4ed8"} strokeWidth="1.5" style={{ cursor: isMine ? "grab" : "default" }} />
                      <text x={x} y={CY - 6 - blockH(w.w) / 2 + 5} fontSize="15" fontWeight="800" textAnchor="middle" fill="#fff" pointerEvents="none">
                        {w.w}kg
                      </text>
                    </g>
                  )}
                  {!w && open && (
                    <g aria-hidden="true">
                      <circle cx={x} cy={CY - 30} r={hov ? 24 : 18} fill={hov ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.12)"} stroke={hov ? "#16a34a" : "#6366f1"} strokeWidth="2" strokeDasharray={hov ? "0" : "4 3"} />
                      <text x={x} y={CY - 22} fontSize="24" fontWeight="700" textAnchor="middle" fill={hov ? "#15803d" : "#6366f1"}>+</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
          <circle cx={CX} cy={CY} r="5" fill="#1f2937" />
          <text x={CX - 205} y={CY + 84} fontSize="14" fill="#6b7280">왼쪽</text>
          <text x={CX + 165} y={CY + 84} fontSize="14" fill="#6b7280">오른쪽</text>

          {/* 선반 */}
          <rect x="20" y={SHELF_Y + 4} width="400" height="14" rx="4" fill="#a8a29e" />
          <text x="220" y={SHELF_Y - 62} fontSize="13" textAnchor="middle" fill="#78716c" aria-hidden="true">추 선반 (끌어서 올려요)</text>
          {[1, 2, 3].map((w) => (
            <g key={w} opacity={drag && drag.from === "shelf" && drag.w === w ? 0.45 : 1} style={{ cursor: "grab" }}>
              {block(SHELF_X[w], SHELF_Y + 4, w, "#f59e0b", "#b45309")}
              {pick === w && !drag && <rect x={SHELF_X[w] - 26} y={SHELF_Y + 4 - blockH(w) - 5} width="52" height={blockH(w) + 10} rx="8" fill="none" stroke="#6366f1" strokeWidth="2.5" />}
            </g>
          ))}
          {!touched && !done && (
            <text fontSize="26" aria-hidden="true">
              👆
              <animate attributeName="x" values={`${SHELF_X[2]};${CX + 2 * GAP};${CX + 2 * GAP};${SHELF_X[2]}`} dur="2.8s" repeatCount="indefinite" />
              <animate attributeName="y" values={`${SHELF_Y};${CY + 10};${CY + 10};${SHELF_Y}`} dur="2.8s" repeatCount="indefinite" />
            </text>
          )}

          {/* 끌고 있는 추: 손가락 위로 띄워서 가려지지 않게 */}
          {drag && (
            <g pointerEvents="none">
              {block(drag.x, drag.y - 34 + blockH(drag.w) / 2, drag.w, "#f59e0b", "#b45309")}
            </g>
          )}
        </svg>

        {hint && (
          <div className="mt-2 space-y-2 text-center text-base">
            <p className="font-semibold">돌리는 힘 = 무게 × 가운데에서 떨어진 칸 수</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="rounded-card bg-bg px-3 py-2">왼쪽 힘 <strong className="tabular-nums">{left}</strong><span className="block tabular-nums text-muted">{exprOf(all, -1)}</span></p>
              <p className="rounded-card bg-bg px-3 py-2">오른쪽 힘 <strong className="tabular-nums">{right}</strong><span className="block tabular-nums text-muted">{exprOf(all, 1)}</span></p>
            </div>
            <p className="text-muted">두 힘이 같으면 수평이 돼요!</p>
          </div>
        )}
        {mode === "problem" && done && !peeked && <p className="mt-1 text-center"><Stars n={1} max={1} /></p>}
      </Board>

      <Say tone={say.tone}>{say.text}</Say>
      {finished && <Say tone="ok">5문제 끝! 별 {solved}개를 모았어요. {solved >= 4 ? "수평 박사예요!" : "잘했어요! 또 해 봐요."}</Say>}

      <div className="flex flex-wrap gap-2">
        {mode === "problem" && finished && (
          <GButton variant="primary" onClick={() => restart()} className={BIG}>
            다시 하기
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
          힌트 {hint ? "숨기기" : "보기"}
        </GButton>
        {mode === "problem" && !done && (
          <GButton onClick={showAnswer} className={BIG}>
            답 하나 보기
          </GButton>
        )}
        <GButton onClick={() => setMine([])} className={BIG}>
          추 모두 빼기
        </GButton>
        {mode === "problem" && (
          <GButton pressed={hard} className={BIG} onClick={() => { const h = !hard; setHard(h); restart(h); }}>
            더 어려운 도전
          </GButton>
        )}
        <GButton pressed={mode === "free"} className={BIG} onClick={() => changeMode(mode === "free" ? "problem" : "free")}>
          마음대로 놀기
        </GButton>
      </div>
    </div>
  );
}
