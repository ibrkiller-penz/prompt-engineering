import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, stageClear, tick, useStage } from "./kit";

// ==PURE-START==
/** 값 v를 len개 자리(왼쪽이 가장 큰 자리)의 이진 불로 */
export function toBits(v: number, len: number): boolean[] {
  return Array.from({ length: len }, (_, i) => ((v >> (len - 1 - i)) & 1) === 1);
}
export function fromBits(bits: boolean[]): number {
  return bits.reduce((a, b) => a * 2 + (b ? 1 : 0), 0);
}
export function weights(len: number): number[] {
  return Array.from({ length: len }, (_, i) => 2 ** (len - 1 - i));
}
export function sumText(bits: boolean[]): string {
  const w = weights(bits.length);
  const on = w.filter((_, i) => bits[i]);
  return on.length ? `${on.join(" + ")} = ${on.reduce((a, b) => a + b, 0)}` : "0";
}
export type BRound = { kind: "make"; len: number; target: number } | { kind: "read"; len: number; value: number; options: number[] } | { kind: "clock"; h: number; m: number; options: [number, number][] };
type Spec = ["make", number, number, number] | ["read", number] | ["clock"];
/** 레벨별 라운드 3개: [만들기, 불 개수, 가장 작은 목표, 가장 큰 목표] / [읽기, 불 개수] / [시계 읽기] */
export const LEVEL_SPECS: Spec[][] = [
  [["make", 3, 1, 7], ["make", 3, 1, 7], ["make", 3, 1, 7]],
  [["make", 3, 1, 7], ["make", 3, 3, 7], ["read", 3]],
  [["make", 4, 1, 15], ["make", 4, 1, 15], ["make", 4, 1, 15]],
  [["make", 4, 8, 15], ["read", 4], ["make", 4, 8, 15]],
  [["make", 5, 1, 31], ["make", 5, 1, 31], ["make", 5, 1, 31]],
  [["make", 5, 16, 31], ["read", 5], ["make", 5, 16, 31]],
  [["read", 5], ["make", 5, 17, 31], ["read", 5]],
  [["make", 6, 1, 63], ["read", 6], ["make", 6, 20, 63]],
  [["clock"], ["make", 6, 32, 63], ["read", 6]],
  [["clock"], ["read", 6], ["clock"]],
];
const ri = (rnd: () => number, lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
/** 불 하나만 바뀐 그럴듯한 오답 2개 + 정답 */
export function readOptions(v: number, len: number, rnd: () => number = Math.random): number[] {
  const wrong = new Set<number>();
  while (wrong.size < 2) {
    const w = v ^ (1 << Math.floor(rnd() * len));
    if (w > 0 && w !== v) wrong.add(w);
  }
  return shuffle([v, ...wrong], rnd);
}
export function clockOptions(h: number, m: number, rnd: () => number = Math.random): [number, number][] {
  const out: [number, number][] = [[h, m]];
  while (out.length < 3) {
    const c: [number, number] = rnd() < 0.5 ? [h ^ (1 << Math.floor(rnd() * 5)), m] : [h, m ^ (1 << Math.floor(rnd() * 6))];
    if (c[0] <= 23 && c[1] <= 59 && !out.some(([a, b]) => a === c[0] && b === c[1])) out.push(c);
  }
  return shuffle(out, rnd);
}
export function levelRounds(level: number, rnd: () => number = Math.random): BRound[] {
  const specs = LEVEL_SPECS[Math.min(10, Math.max(1, level)) - 1];
  let prev = -1;
  return specs.map((sp) => {
    if (sp[0] === "make") {
      let t = ri(rnd, sp[2], sp[3]);
      while (t === prev && sp[3] > sp[2]) t = ri(rnd, sp[2], sp[3]);
      prev = t;
      return { kind: "make", len: sp[1], target: t };
    }
    if (sp[0] === "read") {
      const v = ri(rnd, 2 ** (sp[1] - 1) / 2 + 1, 2 ** sp[1] - 1);
      return { kind: "read", len: sp[1], value: v, options: readOptions(v, sp[1], rnd) };
    }
    const h = ri(rnd, 1, 23);
    const m = ri(rnd, 1, 59);
    return { kind: "clock", h, m, options: clockOptions(h, m, rnd) };
  });
}
// ==PURE-END==

type Msg = { tone: "info" | "ok" | "bad"; text: string };

const pad = (n: number) => String(n).padStart(2, "0");
const BIG = "min-h-[48px]! text-base";
const ROUNDS = 3;

function Bulbs({ bits, onToggle, label, size = "lg", guide }: { bits: boolean[]; onToggle?: (i: number) => void; label: string; size?: "lg" | "md"; guide?: number | null }) {
  const w = weights(bits.length);
  const sweep = useRef<Set<number> | null>(null);
  const idxAt = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-bulb]");
    return el ? Number(el.getAttribute("data-bulb")) : null;
  };
  const maxW = size === "lg" ? 84 : 64;
  return (
    <div
      className="flex justify-center gap-1.5 sm:gap-3"
      role="group"
      aria-label={label}
      style={onToggle ? { touchAction: "none" } : undefined}
      onPointerDown={(e) => {
        if (!onToggle) return;
        const i = idxAt(e);
        sweep.current = new Set();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 무시 */
        }
        if (i !== null) {
          sweep.current.add(i);
          onToggle(i);
        }
      }}
      onPointerMove={(e) => {
        if (!onToggle || !sweep.current) return;
        const i = idxAt(e);
        if (i !== null && !sweep.current.has(i)) {
          sweep.current.add(i);
          onToggle(i);
        }
      }}
      onPointerUp={() => (sweep.current = null)}
      onPointerCancel={() => (sweep.current = null)}
    >
      {bits.map((on, i) => {
        const cls = "relative block w-full min-h-[48px] min-w-[44px] rounded-2xl bg-transparent";
        const art = (
          <svg key={on ? "on" : "off"} viewBox="0 0 60 84" className="gz-pop pointer-events-none block w-full" style={{ filter: on ? "drop-shadow(0 0 10px rgba(251,191,36,0.9))" : "drop-shadow(0 3px 0 rgba(67,56,202,0.25))" }} aria-hidden="true">
            <defs>
              <radialGradient id="bc-on" cx="0.45" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#fffbeb" />
                <stop offset="0.55" stopColor="#fde047" />
                <stop offset="1" stopColor="#f59e0b" />
              </radialGradient>
              <radialGradient id="bc-off" cx="0.4" cy="0.35" r="0.7">
                <stop offset="0" stopColor="#f5f3ff" />
                <stop offset="1" stopColor="#c7d2fe" />
              </radialGradient>
              <linearGradient id="bc-brass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#b45309" />
                <stop offset="0.45" stopColor="#fde68a" />
                <stop offset="1" stopColor="#b45309" />
              </linearGradient>
            </defs>
            {on && (
              <g stroke="#f59e0b" strokeWidth="3" strokeLinecap="round">
                <line x1="30" y1="1" x2="30" y2="5" />
                <line x1="6" y1="10" x2="9" y2="13" />
                <line x1="54" y1="10" x2="51" y2="13" />
                <line x1="1" y1="30" x2="5" y2="30" />
                <line x1="59" y1="30" x2="55" y2="30" />
              </g>
            )}
            <path d="M 30 7 C 15 7 8 18 8 29 C 8 39 15 44 19 52 L 41 52 C 45 44 52 39 52 29 C 52 18 45 7 30 7 Z" fill={on ? "url(#bc-on)" : "url(#bc-off)"} stroke={on ? "#d97706" : "#6366f1"} strokeWidth="3" strokeLinejoin="round" />
            <ellipse cx="21" cy="20" rx="5" ry="8" fill="#fff" opacity="0.7" transform="rotate(25 21 20)" />
            <path d="M 24 52 L 24 44 Q 27 38 30 44 Q 33 38 36 44 L 36 52" fill="none" stroke={on ? "#ea580c" : "#818cf8"} strokeWidth="2" />
            <rect x="18" y="52" width="24" height="16" rx="4" fill="url(#bc-brass)" stroke="#92400e" strokeWidth="2" />
            <line x1="19" y1="57" x2="41" y2="57" stroke="#92400e" strokeWidth="1.5" />
            <line x1="19" y1="62" x2="41" y2="62" stroke="#92400e" strokeWidth="1.5" />
            <path d="M 24 68 L 36 68 L 33 74 L 27 74 Z" fill="#78350f" />
            <text x="30" y="36" textAnchor="middle" fontSize={w[i] >= 10 ? 17 : 20} fill={on ? "#78350f" : "#4338ca"} stroke={on ? "#fffbeb" : "#fff"} strokeWidth="3" paintOrder="stroke" style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" }}>
              {w[i]}
            </text>
          </svg>
        );
        return (
          <div key={i} className="relative flex flex-1 flex-col items-center gap-1" style={{ maxWidth: maxW }}>
            {guide === i && <span className="pointer-events-none absolute left-0 right-0 top-0 aspect-square animate-ping rounded-full border-4 border-orange-500" />}
            {onToggle ? (
              <button
                type="button"
                data-bulb={i}
                aria-pressed={on}
                aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onToggle(i);
                  }
                }}
                className={cls}
              >
                {art}
              </button>
            ) : (
              <div role="img" aria-label={`${w[i]}의 불 ${on ? "켜짐" : "꺼짐"}`} className={cls}>
                {art}
              </div>
            )}
            <span className={`font-game rounded-full px-2.5 text-lg leading-7 tabular-nums ${on ? "bg-amber-300 text-amber-950" : "bg-indigo-100 text-indigo-700"}`}>{on ? 1 : 0}</span>
          </div>
        );
      })}
    </div>
  );
}

function Balloon({ n, ok, sad }: { n: number; ok: boolean; sad: boolean }) {
  const c = ok ? ["#bbf7d0", "#22c55e", "#15803d"] : ["#fecdd3", "#f43f5e", "#9f1239"];
  return (
    <div className="flex flex-col items-center" aria-live="polite" data-target={n}>
      <style>{`
        @keyframes bc-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-7deg)}75%{transform:rotate(7deg)}}
        @keyframes bc-yay{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-14px) scale(1.12)}}
        .bc-shake{animation:bc-shake .35s ease-in-out 2;transform-origin:50% 100%}
        .bc-yay{animation:bc-yay .6s ease-in-out infinite}
        @media (prefers-reduced-motion: reduce){.bc-shake,.bc-yay{animation:none}}
      `}</style>
      <div className="gz-float">
        <div key={`${n}-${ok}-${sad}`} className={ok ? "bc-yay" : sad ? "bc-shake" : "gz-pop"}>
          <svg viewBox="0 0 100 150" width="104" height="156" role="img" aria-label={`풍선 숫자 ${n}`} style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif", overflow: "visible" }}>
            <defs>
              <radialGradient id={`bc-bal-${ok ? "ok" : "no"}`} cx="0.35" cy="0.3" r="0.75">
                <stop offset="0" stopColor={c[0]} />
                <stop offset="0.5" stopColor={c[1]} />
                <stop offset="1" stopColor={c[2]} />
              </radialGradient>
            </defs>
            <path d="M 50 104 C 46 114 56 120 50 130 C 44 140 54 144 50 150" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="54" cy="57" rx="40" ry="47" fill="rgba(0,0,0,0.12)" />
            <path d="M 50 104 C 18 92 8 70 8 50 C 8 24 27 6 50 6 C 73 6 92 24 92 50 C 92 70 82 92 50 104 Z" fill={`url(#bc-bal-${ok ? "ok" : "no"})`} stroke={c[2]} strokeWidth="3" />
            <path d="M 44 104 L 56 104 L 52 98 L 48 98 Z" fill={c[2]} />
            <ellipse cx="32" cy="30" rx="8" ry="14" fill="#fff" opacity="0.6" transform="rotate(25 32 30)" />
            <text x="50" y="66" textAnchor="middle" fontSize={n >= 10 ? 44 : 52} fill="#fff" stroke={c[2]} strokeWidth="5" paintOrder="stroke">
              {n}
            </text>
          </svg>
        </div>
      </div>
      <p className="font-game text-lg text-muted">이 수를 만들어요!</p>
    </div>
  );
}

export default function BinaryClockGame() {
  const level = useStage();
  const [plan] = useState(() => levelRounds(level));
  const [idx, setIdx] = useState(0);
  const round = plan[idx];
  const len = round.kind === "make" ? round.len : 5;
  const [bits, setBits] = useState<boolean[]>(() => Array(plan[0].kind === "make" ? plan[0].len : 5).fill(false));
  const [solved, setSolved] = useState(false);
  const [touched, setTouched] = useState(false);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: startText(plan[0]) });

  const st = useRef({ bits, solved, round, idx });
  st.current = { bits, solved, round, idx };
  const bitsRef = useRef(bits);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setB = (b: boolean[]) => {
    bitsRef.current = b;
    setBits(b);
  };
  const value = fromBits(bits);

  const win = (text: string) => {
    setSolved(true);
    cheer();
    window.clearTimeout(timer.current);
    const i = st.current.idx;
    if (i + 1 >= ROUNDS) {
      setMsg({ tone: "ok", text: `${text} 레벨 ${level} 끝!` });
      timer.current = window.setTimeout(() => stageClear(), 1200);
      return;
    }
    setMsg({ tone: "ok", text: `${text} 곧 다음 문제!` });
    timer.current = window.setTimeout(() => {
      const nr = plan[i + 1];
      setIdx(i + 1);
      setB(Array(nr.kind === "make" ? nr.len : 5).fill(false));
      setSolved(false);
      setMsg({ tone: "info", text: startText(nr) });
    }, 1700);
  };

  const toggle = (i: number) => {
    const S = st.current;
    if (S.solved || S.round.kind !== "make") return;
    const target = S.round.target;
    const prev = bitsRef.current;
    const nb = prev.map((b, j) => (j === i ? !b : b));
    setB(nb);
    setTouched(true);
    const v = fromBits(nb);
    const pv = fromBits(prev);
    if (v === target) win(`⭐ 정답! ${sumText(nb)}.`);
    else if (v > target) {
      if (pv <= target) oops();
      else tick();
      setMsg({ tone: "bad", text: `아깝다! 지금 ${v}이에요. 풍선의 ${target}보다 커요. 불을 하나 꺼 봐요.` });
    } else {
      tick();
      setMsg({ tone: "info", text: `지금 ${v}이에요. 풍선까지 ${target - v} 남았어요.` });
    }
  };

  const pickRead = (v: number) => {
    if (solved || round.kind !== "read") return;
    if (v === round.value) win(`⭐ 정답! ${sumText(toBits(round.value, round.len))}.`);
    else {
      oops();
      setMsg({ tone: "bad", text: `아깝다! ${v}이 아니에요. 켜진 불의 숫자를 하나씩 더해 봐요.` });
    }
  };
  const pickClock = (h: number, m: number) => {
    if (solved || round.kind !== "clock") return;
    if (h === round.h && m === round.m) win(`⭐ 정답! ${round.h}시 ${round.m}분이에요.`);
    else {
      oops();
      setMsg({ tone: "bad", text: "아깝다! 시와 분의 불을 따로따로 더해 봐요." });
    }
  };

  const showHint = () => {
    if (round.kind === "make") setMsg({ tone: "info", text: `힌트: ${round.target}은(는) ${sumText(toBits(round.target, round.len))} 이에요. 이 숫자의 불을 켜 봐요.` });
    else if (round.kind === "read") setMsg({ tone: "info", text: `힌트: 켜진 불은 ${weights(round.len).filter((_, i) => toBits(round.value, round.len)[i]).join(", ")}이에요. 모두 더해 봐요!` });
    else setMsg({ tone: "info", text: `힌트: 시의 켜진 불은 ${weights(5).filter((_, i) => toBits(round.h, 5)[i]).join(", ")}, 분의 켜진 불은 ${weights(6).filter((_, i) => toBits(round.m, 6)[i]).join(", ")}이에요.` });
  };

  const needFirst = !touched && idx === 0 && level === 1 && round.kind === "make" ? toBits(round.target, round.len).findIndex(Boolean) : null;
  const chip = "font-game min-h-[56px]! min-w-[5rem] text-2xl";

  return (
    <div className="space-y-3 text-base">
      <p className="font-game text-center text-xl text-accent">레벨 {level} · 라운드 {idx + 1}/{ROUNDS}</p>
      <Board>
        <p className="mb-3 rounded-card bg-accent-soft px-3 py-2 font-bold">
          {round.kind === "make" ? "풍선의 수가 되도록 불을 톡 눌러요! (쓱 문지르면 여러 개가 한꺼번에 바뀌어요)" : round.kind === "read" ? "켜진 불이 나타내는 수는 얼마일까요? 아래에서 골라요." : "이진법 시계예요! 몇 시 몇 분일까요? 아래에서 골라요."}
        </p>

        {round.kind === "make" && (
          <div className="space-y-3">
            <Balloon n={round.target} ok={solved} sad={!solved && value > round.target} />
            <Bulbs bits={bits.length === len ? bits : Array(len).fill(false)} onToggle={toggle} guide={needFirst} label={`불 ${len}개: ${weights(len).join(", ")}`} />
            <div className="text-center">
              <p className="text-muted">지금 내가 만든 수</p>
              <p className={`font-game text-5xl tabular-nums ${solved ? "text-ok" : "text-ink"}`}>{value}</p>
              <p className="tabular-nums text-muted">{sumText(bits)}</p>
            </div>
          </div>
        )}

        {round.kind === "read" && (
          <div className="space-y-4">
            <Bulbs bits={toBits(round.value, round.len)} label={`켜진 불이 나타내는 수를 맞혀요`} />
            <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="답 고르기">
              {round.options.map((v) => (
                <GButton key={v} variant={solved && v === round.value ? "primary" : "soft"} onClick={() => pickRead(v)} className={chip}>
                  {v}
                </GButton>
              ))}
            </div>
          </div>
        )}

        {round.kind === "clock" && (
          <div className="space-y-4">
            <div>
              <p className="font-game mb-1 text-center text-lg">시 (불 5개)</p>
              <Bulbs bits={toBits(round.h, 5)} label="시를 나타내는 불" size="md" />
            </div>
            <div>
              <p className="font-game mb-1 text-center text-lg">분 (불 6개)</p>
              <Bulbs bits={toBits(round.m, 6)} label="분을 나타내는 불" size="md" />
            </div>
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="시각 고르기">
              {round.options.map(([h, m]) => (
                <GButton key={`${h}-${m}`} variant={solved && h === round.h && m === round.m ? "primary" : "soft"} onClick={() => pickClock(h, m)} className="font-game min-h-[56px]! text-xl">
                  {h}시 {pad(m)}분
                </GButton>
              ))}
            </div>
          </div>
        )}
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${idx + 1}/${ROUNDS}`} />
        {round.kind === "make" && <Stat label="내 수" value={value} />}
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton variant="soft" onClick={showHint} disabled={solved} className={BIG}>💡 힌트 보기</GButton>
        {round.kind === "make" && (
          <GButton onClick={() => setB(Array(len).fill(false))} disabled={solved} className={BIG}>불 모두 끄기</GButton>
        )}
      </div>
    </div>
  );
}

function startText(r: BRound): string {
  if (r.kind === "make") return `불을 톡 눌러 켜요. 켜진 불의 숫자를 모두 더해서 풍선의 수(${r.target})를 만들어요!`;
  if (r.kind === "read") return "켜진 불의 숫자를 모두 더하면 얼마일까요?";
  return "위쪽 불은 시, 아래쪽 불은 분이에요. 몇 시 몇 분일까요?";
}
