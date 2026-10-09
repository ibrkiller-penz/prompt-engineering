import { useState } from "react";
import type { KeyboardEvent as RKeyboardEvent } from "react";
import { Board, GButton, Say, Stat, rand, useFrame } from "./kit";

// ==PURE==
export type Wt = { slot: number; w: number }; // slot: -5~-1(왼쪽), 1~5(오른쪽)
export const WEIGHTS = [1, 2, 3, 5];

/** 토크 합(무게×거리). 오른쪽은 +, 왼쪽은 −. 0이면 수평 */
export const netTorque = (ws: Wt[]) => ws.reduce((s, x) => s + x.w * x.slot, 0);
export const sideTorque = (ws: Wt[], side: 1 | -1) => ws.filter((x) => Math.sign(x.slot) === side).reduce((s, x) => s + x.w * Math.abs(x.slot), 0);
/** 기울기(도). 양수면 오른쪽이 내려가요. */
export const tiltOf = (net: number) => Math.max(-16, Math.min(16, net * 2.4));

/** 오른쪽 눈금 1~5에 추(없음 또는 1·2·3·5kg)를 올려서 토크 합이 T가 되는 모든 방법 */
export function solutions(T: number): Wt[][] {
  const out: Wt[][] = [];
  const opts = [0, ...WEIGHTS];
  const rec = (slot: number, acc: Wt[], sum: number) => {
    if (slot > 5) {
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

export function makeProblem(rnd: (n: number) => number): { fixed: Wt[]; T: number } {
  for (let t = 0; t < 500; t++) {
    const count = 1 + rnd(2);
    const slots: number[] = [];
    while (slots.length < count) {
      const s = -(1 + rnd(5));
      if (!slots.includes(s)) slots.push(s);
    }
    const fixed = slots.map((slot) => ({ slot, w: WEIGHTS[rnd(WEIGHTS.length)] }));
    const T = -netTorque(fixed);
    if (T >= 6 && T <= 30 && solutions(T).length >= 3) return { fixed, T };
  }
  return { fixed: [{ slot: -3, w: 2 }], T: 6 };
}
// ==END==

const CX = 220;
const CY = 165;
const GAP = 38;
const SLOTS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

type Mode = "problem" | "free";

export default function LeverGame() {
  const [mode, setMode] = useState<Mode>("problem");
  const [prob, setProb] = useState(() => makeProblem(rand));
  const [mine, setMine] = useState<Wt[]>([]);
  const [pick, setPick] = useState(2);
  const [hint, setHint] = useState(true);
  const [solved, setSolved] = useState(0);
  const [tries, setTries] = useState(0);
  const [done, setDone] = useState(false); // 이번 문제에서 이미 점수를 받았는지
  const [peeked, setPeeked] = useState(false);
  const [ang, setAng] = useState(0);

  const fixed = mode === "problem" ? prob.fixed : [];
  const all = [...fixed, ...mine];
  const net = netTorque(all);
  const tgt = tiltOf(net);
  const left = sideTorque(all, -1);
  const right = sideTorque(all, 1);
  const balanced = net === 0 && all.some((x) => x.slot < 0) && all.some((x) => x.slot > 0);

  useFrame((_, dt) => {
    setAng((a) => {
      const d = tgt - a;
      return Math.abs(d) < 0.03 ? tgt : a + d * Math.min(1, dt * 5);
    });
  }, Math.abs(ang - tgt) > 0.03);

  const slotOpen = (s: number) => (mode === "free" ? true : s > 0);

  const toggle = (s: number) => {
    if (!slotOpen(s)) return;
    const has = mine.find((x) => x.slot === s);
    const next = has ? mine.filter((x) => x.slot !== s) : [...mine, { slot: s, w: pick }];
    setMine(next);
    if (!has) setTries((t) => t + 1);
    if (mode === "problem" && !done && !peeked && netTorque([...prob.fixed, ...next]) === 0 && next.length > 0) {
      setDone(true);
      setSolved((v) => v + 1);
    }
  };
  const onKey = (e: RKeyboardEvent, s: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(s);
    }
  };

  const newProblem = () => {
    setProb(makeProblem(rand));
    setMine([]);
    setTries(0);
    setDone(false);
    setPeeked(false);
  };
  const reset = () => {
    setMine([]);
    setTries(0);
    setDone(false);
    setPeeked(false);
  };
  const showAnswer = () => {
    const sols = solutions(prob.T);
    const small = sols.filter((s) => s.length <= 3);
    const pool = small.length ? small : sols;
    setMine(pool[rand(pool.length)]);
    setPeeked(true);
  };
  const changeMode = (m: Mode) => {
    setMode(m);
    reset();
  };

  const exprOf = (ws: Wt[], side: 1 | -1) => {
    const part = ws.filter((x) => Math.sign(x.slot) === side).sort((a, b) => Math.abs(a.slot) - Math.abs(b.slot));
    return part.length ? part.map((x) => `${x.w}×${Math.abs(x.slot)}`).join(" + ") : "0";
  };

  // 말풍선
  let say: { tone: "info" | "ok" | "bad"; text: string };
  if (balanced) {
    say = { tone: "ok", text: `수평이에요! 왼쪽 ${left} = 오른쪽 ${right} 으로 (무게×거리)의 합이 같아요.${peeked ? " (해답을 보고 맞춘 거라 점수는 오르지 않아요.)" : ""}` };
  } else if (mode === "problem" && mine.length === 0) {
    say = { tone: "info", text: `왼쪽에 놓인 추를 보고, 오른쪽 눈금 칸(1~5)에 추를 놓아 수평을 맞춰 봐요.` };
  } else if (net > 0) {
    say = { tone: "bad", text: "오른쪽이 더 무거워요. 추를 빼거나 중심에 가깝게 옮겨 봐요." };
  } else if (net < 0) {
    say = { tone: "bad", text: mode === "problem" ? "왼쪽이 더 무거워요. 오른쪽에 추를 더하거나 더 멀리 놓아 봐요." : "왼쪽이 더 무거워요. 오른쪽에 추를 더 놓아 봐요." };
  } else {
    say = { tone: "info", text: mode === "free" ? "추를 눌러 양쪽에 놓아 보세요. 막대가 수평이 되면 성공이에요." : "추를 놓아 보세요." };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <GButton pressed={mode === "problem"} onClick={() => changeMode("problem")}>문제 풀기</GButton>
        <GButton pressed={mode === "free"} onClick={() => changeMode("free")}>자유 놀이</GButton>
        {mode === "problem" && <Stat label="푼 문제" value={solved} tone="ok" />}
        <Stat label="놓은 횟수" value={tries} />
      </div>

      <Board>
        <svg viewBox="0 0 440 250" className="mx-auto block w-full max-w-[640px] select-none rounded-card bg-bg" role="group" aria-label={`막대 저울. 지금 ${net === 0 ? "수평" : net > 0 ? "오른쪽이 무거워요" : "왼쪽이 무거워요"}`}>
          {/* 받침 */}
          <polygon points={`${CX},${CY} ${CX - 26},${CY + 62} ${CX + 26},${CY + 62}`} fill="#9ca3af" stroke="#6b7280" />
          <rect x={CX - 70} y={CY + 62} width="140" height="10" rx="3" fill="#6b7280" />

          <g transform={`rotate(${ang} ${CX} ${CY})`}>
            {/* 막대 */}
            <rect x={CX - 205} y={CY - 6} width="410" height="12" rx="4" fill="#d6b27a" stroke="#92400e" />
            {Array.from({ length: 11 }, (_, i) => i - 5).map((s) => (
              <g key={s}>
                <line x1={CX + s * GAP} y1={CY - 6} x2={CX + s * GAP} y2={CY + 6} stroke="#92400e" strokeWidth={s === 0 ? 2.5 : 1.2} />
                <text x={CX + s * GAP} y={CY + 22} fontSize="12" fontWeight="700" textAnchor="middle" fill="#6b4a1f">
                  {Math.abs(s)}
                </text>
              </g>
            ))}
            <text x={CX - 200} y={CY + 36} fontSize="10" fill="#6b7280">왼쪽</text>
            <text x={CX + 168} y={CY + 36} fontSize="10" fill="#6b7280">오른쪽</text>

            {/* 눌러서 놓는 칸 */}
            {SLOTS.map((s) => {
              const x = CX + s * GAP;
              const w = all.find((q) => q.slot === s);
              const mineHere = mine.find((q) => q.slot === s);
              const open = slotOpen(s);
              const label = `${s < 0 ? "왼쪽" : "오른쪽"} ${Math.abs(s)}칸, ${w ? `${w.w}킬로그램 추가 있어요${mineHere ? ". 누르면 빼요" : ""}` : open ? `비어 있어요. 누르면 ${pick}킬로그램 추를 놓아요` : "비어 있어요"}`;
              const h = w ? 14 + w.w * 6 : 0;
              return (
                <g key={s}>
                  {w && (
                    <g>
                      <line x1={x} y1={CY - 6} x2={x} y2={CY - 6 - 4} stroke="#374151" />
                      <rect x={x - 15} y={CY - 6 - h} width="30" height={h} rx="4" fill={mineHere ? "#f59e0b" : "#3b82f6"} stroke={mineHere ? "#b45309" : "#1d4ed8"} strokeWidth="1.5" />
                      <text x={x} y={CY - 6 - h / 2 + 4} fontSize="12" fontWeight="800" textAnchor="middle" fill="#fff">
                        {w.w}kg
                      </text>
                    </g>
                  )}
                  {!w && open && (
                    <g aria-hidden="true">
                      <circle cx={x} cy={CY - 22} r="10" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2" />
                      <text x={x} y={CY - 17.5} fontSize="14" fontWeight="700" textAnchor="middle" fill="#6366f1">+</text>
                    </g>
                  )}
                  {(open && (!w || mineHere)) && (
                    <rect
                      x={x - GAP / 2}
                      y={CY - 110}
                      width={GAP}
                      height="130"
                      fill="transparent"
                      style={{ cursor: "pointer" }}
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      onClick={() => toggle(s)}
                      onKeyDown={(e) => onKey(e, s)}
                    />
                  )}
                </g>
              );
            })}
          </g>
          <circle cx={CX} cy={CY} r="5" fill="#1f2937" />
        </svg>

        {hint && (
          <div className="mt-2 grid gap-1 text-center text-sm sm:grid-cols-2">
            <p className="rounded-card bg-bg px-3 py-2">
              왼쪽 토크 <strong className="tabular-nums">{left}</strong>
              <span className="block text-xs text-muted tabular-nums">{exprOf(all, -1)}</span>
            </p>
            <p className="rounded-card bg-bg px-3 py-2">
              오른쪽 토크 <strong className="tabular-nums">{right}</strong>
              <span className="block text-xs text-muted tabular-nums">{exprOf(all, 1)}</span>
            </p>
          </div>
        )}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">놓을 추</span>
        {WEIGHTS.map((w) => (
          <GButton key={w} pressed={pick === w} onClick={() => setPick(w)} className="min-w-[56px]">
            {w}kg
          </GButton>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === "problem" && (
          <GButton variant="primary" onClick={newProblem}>
            새 문제
          </GButton>
        )}
        {mode === "problem" && (
          <GButton onClick={showAnswer} disabled={balanced && !peeked}>
            해답 하나 보기
          </GButton>
        )}
        <GButton onClick={reset}>{mode === "problem" ? "내 추 치우기" : "다시 하기 (모두 치우기)"}</GButton>
        <GButton pressed={hint} onClick={() => setHint((h) => !h)}>
          토크 힌트 {hint ? "끄기" : "켜기"}
        </GButton>
      </div>

      <Say tone={say.tone}>{say.text}</Say>
      <p className="text-xs text-muted">파란 추는 처음부터 놓여 있어요. 주황색 추는 내가 놓은 거예요. 눈금 칸을 누르면 놓고, 놓은 주황 추를 다시 누르면 빼요. (토크 = 무게 × 중심에서의 거리, 막대는 중심에서 5칸까지 있어요.)</p>
    </div>
  );
}
