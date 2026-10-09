import { useState } from "react";
import type { KeyboardEvent as RKeyboardEvent } from "react";
import { Board, GButton, Say, Stat, rand, useFrame } from "./kit";

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
const CY = 165;
const GAP = 64;
const SLOTS = [-3, -2, -1, 1, 2, 3];

type Mode = "problem" | "free";

export default function LeverGame() {
  const [mode, setMode] = useState<Mode>("problem");
  const [prob, setProb] = useState(() => makeProblem(rand, false));
  const [mine, setMine] = useState<Wt[]>([]);
  const [pick, setPick] = useState(2);
  const [hint, setHint] = useState(false);
  const [hard, setHard] = useState(false);
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

  const newProblem = (h = hard) => {
    setProb(makeProblem(rand, h));
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
    say = { tone: "ok", text: `와, 수평이에요! 잘했어요! 별 하나 ⭐ 왼쪽 힘 ${left} = 오른쪽 힘 ${right}.${peeked ? " (해답을 보고 맞춰서 점수는 그대로예요.)" : ""}` };
  } else if (mode === "problem" && mine.length === 0) {
    say = { tone: "info", text: "파란 추가 왼쪽에 있어요. 오른쪽 + 칸을 눌러 추를 놓고, 막대를 수평으로 만들어요!" };
  } else if (net > 0) {
    say = { tone: "bad", text: "오른쪽이 더 무거워요. 괜찮아요! 추를 빼거나 가운데 쪽으로 옮겨 봐요." };
  } else if (net < 0) {
    say = { tone: "bad", text: mode === "problem" ? "왼쪽이 더 무거워요. 괜찮아요! 오른쪽에 추를 더하거나 더 멀리 놓아 봐요." : "왼쪽이 더 무거워요. 오른쪽에도 추를 놓아 봐요." };
  } else {
    say = { tone: "info", text: mode === "free" ? "+ 칸을 눌러 양쪽에 추를 놓아 보세요. 수평이 되면 성공이에요!" : "추를 놓아 보세요." };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <GButton pressed={mode === "problem"} onClick={() => changeMode("problem")}>문제 풀기</GButton>
        <GButton pressed={mode === "free"} onClick={() => changeMode("free")}>마음대로 놀기</GButton>
        {mode === "problem" && <Stat label="푼 문제" value={solved} tone="ok" />}
        <Stat label="놓은 횟수" value={tries} />
      </div>

      <Board>
        <p className="mb-2 text-center text-base font-semibold">
          {mode === "problem" ? "오른쪽에 추를 놓아 막대를 수평으로 만들어요!" : "추를 놓아서 막대를 수평으로 만들어 봐요!"}
        </p>
        <svg viewBox="0 0 440 250" className="mx-auto block w-full max-w-[640px] select-none rounded-card bg-bg" role="group" aria-label={`막대 저울. 지금 ${net === 0 ? "수평" : net > 0 ? "오른쪽이 무거워요" : "왼쪽이 무거워요"}`}>
          <polygon points={`${CX},${CY} ${CX - 26},${CY + 62} ${CX + 26},${CY + 62}`} fill="#9ca3af" stroke="#6b7280" />
          <rect x={CX - 70} y={CY + 62} width="140" height="10" rx="3" fill="#6b7280" />

          <g transform={`rotate(${ang} ${CX} ${CY})`}>
            <rect x={CX - 215} y={CY - 6} width="430" height="12" rx="4" fill="#d6b27a" stroke="#92400e" />
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
              const mineHere = mine.find((q) => q.slot === s);
              const open = slotOpen(s);
              const label = `${s < 0 ? "왼쪽" : "오른쪽"} ${Math.abs(s)}칸, ${w ? `${w.w}킬로그램 추가 있어요${mineHere ? ". 누르면 빼요" : ""}` : open ? `비어 있어요. 누르면 ${pick}킬로그램 추를 놓아요` : "비어 있어요"}`;
              const h = w ? 22 + w.w * 8 : 0;
              return (
                <g key={s}>
                  {w && (
                    <g>
                      <rect x={x - 20} y={CY - 6 - h} width="40" height={h} rx="5" fill={mineHere ? "#f59e0b" : "#3b82f6"} stroke={mineHere ? "#b45309" : "#1d4ed8"} strokeWidth="1.5" />
                      <text x={x} y={CY - 6 - h / 2 + 5} fontSize="15" fontWeight="800" textAnchor="middle" fill="#fff">
                        {w.w}kg
                      </text>
                    </g>
                  )}
                  {!w && open && (
                    <g aria-hidden="true">
                      <circle cx={x} cy={CY - 26} r="15" fill="rgba(99,102,241,0.12)" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3 2" />
                      <text x={x} y={CY - 19} fontSize="22" fontWeight="700" textAnchor="middle" fill="#6366f1">+</text>
                    </g>
                  )}
                  {open && (!w || mineHere) && (
                    <rect
                      x={x - GAP / 2}
                      y={CY - 110}
                      width={GAP}
                      height="140"
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
          <text x={CX - 205} y={CY + 56} fontSize="14" fill="#6b7280">왼쪽</text>
          <text x={CX + 165} y={CY + 56} fontSize="14" fill="#6b7280">오른쪽</text>
        </svg>
        <p className="mt-1 text-center text-base text-muted">숫자는 가운데에서 떨어진 칸 수예요. 파란 추는 처음부터 있는 추, 주황 추는 내가 놓은 추예요.</p>

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
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold">놓을 추</span>
        {WEIGHTS.map((w) => (
          <GButton key={w} pressed={pick === w} onClick={() => setPick(w)} className="min-w-[64px]">
            {w}kg
          </GButton>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {mode === "problem" && (
          <GButton variant="primary" onClick={() => newProblem()}>
            새 문제
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => setHint((h) => !h)}>
          힌트 {hint ? "숨기기" : "보기"}
        </GButton>
        {mode === "problem" && (
          <GButton onClick={showAnswer} disabled={balanced && !peeked}>
            답 하나 보기
          </GButton>
        )}
        <GButton onClick={reset}>{mode === "problem" ? "다시 놓기" : "다시 하기"}</GButton>
        {mode === "problem" && (
          <GButton
            pressed={hard}
            onClick={() => {
              const h = !hard;
              setHard(h);
              newProblem(h);
            }}
          >
            더 어려운 도전
          </GButton>
        )}
      </div>

      <Say tone={say.tone}>{say.text}</Say>
    </div>
  );
}
