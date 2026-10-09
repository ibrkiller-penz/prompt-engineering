import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, stageClear, svgPoint, tick, useStage } from "./kit";
import { BIG } from "./easykit";

// ==PURE==
export type T = { h: number; m: number }; // h: 1~12, m: 0~59
export type Kind = "set" | "pick";
export type Phrase = "digital" | "before" | "later";
export type Task = { kind: Kind; phrase: Phrase; target: T; clock: T; delta: number; text: string };
export type Card = { label: string; t: T };

export const same = (a: T, b: T) => a.h === b.h && a.m === b.m;
export const pad = (m: number) => String(m).padStart(2, "0");
export const digital = (t: T) => `${t.h}:${pad(t.m)}`;
export const korean = (t: T) => (t.m === 0 ? `${t.h}시` : `${t.h}시 ${t.m}분`);

/** 시각에 분을 더하기(12시간 시계) */
export function addMinutes(t: T, d: number): T {
  const total = (((t.h % 12) * 60 + t.m + d) % 720 + 720) % 720;
  return { h: Math.floor(total / 60) || 12, m: total % 60 };
}
/** 짧은바늘·긴바늘 각도(12시 방향이 0°, 시계방향) */
export function handAngles(t: T) {
  return { hour: (t.h % 12) * 30 + t.m * 0.5, minute: t.m * 6 };
}
/** 긴바늘 각도 → 분(step 분 단위로 맞춰 줘요) */
export function angleToMinute(deg: number, step: number): number {
  const m = Math.round(deg / 6 / step) * step;
  return ((m % 60) + 60) % 60;
}
/** 짧은바늘 각도 → 시(분에 따라 시침이 움직인 만큼 빼고 계산) */
export function hourFromAngle(deg: number, m: number): number {
  const h12 = Math.round((deg - m * 0.5) / 30);
  return ((h12 % 12) + 12) % 12 || 12;
}
/** 긴바늘이 12를 지나면 시도 함께 바뀌어요 */
export function wrapHour(h: number, prevM: number, newM: number): number {
  if (prevM >= 45 && newM <= 15) return (h % 12) + 1;
  if (prevM <= 15 && newM >= 45) return ((h + 10) % 12) + 1;
  return h;
}

/** 레벨(1~10)별 규칙 */
export function levelSpec(level: number) {
  const L = Math.max(1, Math.min(10, level));
  const minutes = L <= 2 ? [0] : L === 3 ? [0, 30] : L === 4 ? [0, 15, 30, 45] : L <= 6 ? Array.from({ length: 12 }, (_, i) => i * 5) : Array.from({ length: 60 }, (_, i) => i);
  return {
    minutes,
    hours: L === 1 ? [12, 3, 6, 9] : Array.from({ length: 12 }, (_, i) => i + 1),
    step: L <= 6 ? 5 : 1,
    deltas: L === 9 ? [15, 30, 45, 60] : [20, 25, 40, 50, 70, 80, 90],
    showMinutes: L <= 4,
  };
}
/** 라운드 순서(3개): 홀수 레벨은 맞추기-고르기-맞추기, 짝수 레벨은 고르기-맞추기-고르기 */
export const kindsOf = (level: number): Kind[] => (level % 2 === 1 ? ["set", "pick", "set"] : ["pick", "set", "pick"]);
/** 말하는 방법: 7·8레벨은 '몇 시 몇 분 전', 9·10레벨은 'N분 뒤' */
export function phraseOf(level: number, round: number): Phrase {
  if (level >= 9) return round === 2 ? "before" : "later";
  if (level >= 7) return round === 1 ? "before" : "digital";
  return "digital";
}
export function deltaText(d: number): string {
  const h = Math.floor(d / 60);
  const m = d % 60;
  return h && m ? `${h}시간 ${m}분` : h ? `${h}시간` : `${m}분`;
}

const pick1 = <A,>(rnd: (n: number) => number, a: A[]): A => a[rnd(a.length)];

export function makeTask(rnd: (n: number) => number, level: number, round: number): Task {
  const sp = levelSpec(level);
  const kind = kindsOf(level)[round];
  let phrase = phraseOf(level, round);
  let target: T;
  let clock: T;
  let delta = 0;
  let text = "";
  if (phrase === "before") {
    // 'H시 N분 전' = H시가 되기 N분 전. N은 5의 배수(5~25)
    const n = 5 * (1 + rnd(5));
    const hNext = pick1(rnd, sp.hours);
    target = addMinutes({ h: hNext, m: 0 }, -n);
    text = `${hNext}시 ${n}분 전`;
    clock = target;
  } else if (phrase === "later") {
    const start: T = { h: pick1(rnd, sp.hours), m: level === 9 ? 5 * rnd(12) : rnd(60) };
    delta = pick1(rnd, sp.deltas);
    target = addMinutes(start, delta);
    text = `${digital(start)}에서 ${deltaText(delta)} 뒤`;
    clock = start;
  } else {
    target = { h: pick1(rnd, sp.hours), m: pick1(rnd, sp.minutes) };
    text = digital(target);
    clock = target;
  }
  if (kind === "set" && phrase !== "later") {
    // 처음 바늘 자리: 정답과 다르게
    clock = { h: ((target.h + 3) % 12) + 1, m: (target.m + (level >= 3 ? 20 : 0)) % 60 };
    if (same(clock, target)) clock = { h: (target.h % 12) + 1, m: target.m };
  }
  return { kind, phrase, target, clock, delta, text };
}

/** 고르기 보기: 정답 하나와 틀린 보기(시·분 바꿔 읽기, 한 시간·몇 분 차이 등)를 섞어서 n장 */
export function makeCards(rnd: (n: number) => number, level: number, task: Task, n = 4): Card[] {
  const sp = levelSpec(level);
  const step = sp.step === 5 && level <= 2 ? 0 : Math.max(1, sp.step);
  const fmt = (t: T): string => {
    if (task.phrase === "before") {
      const left = (60 - t.m) % 60;
      return left ? `${addMinutes(t, left).h}시 ${left}분 전` : `${t.h}시`;
    }
    return digital(t);
  };
  const cand: T[] = [];
  const push = (t: T) => {
    const mm = ((t.m % 60) + 60) % 60;
    cand.push({ h: ((((t.h - 1) % 12) + 12) % 12) + 1, m: mm });
  };
  const tg = task.target;
  push({ h: tg.h + 1, m: tg.m });
  push({ h: tg.h - 1, m: tg.m });
  if (step) {
    push({ h: tg.h, m: tg.m + step * (level <= 6 ? 3 : 1) });
    push({ h: tg.h, m: tg.m - step * (level <= 6 ? 3 : 1) });
    push({ h: tg.h + 1, m: tg.m + step * 2 });
  }
  if (tg.m % 5 === 0 && tg.m > 0) push({ h: tg.m / 5, m: tg.h * 5 });
  if (task.phrase === "later") {
    push({ h: task.clock.h, m: task.clock.m + task.delta });
    push(addMinutes(tg, 60));
    push(addMinutes(tg, -10));
  }
  const out: Card[] = [{ label: fmt(tg), t: tg }];
  const seen = new Set([fmt(tg)]);
  const ok = (t: T) => !same(t, tg) && !seen.has(fmt(t));
  for (const t of [...cand].sort(() => rnd(3) - 1)) {
    if (out.length >= n) break;
    if (!ok(t)) continue;
    seen.add(fmt(t));
    out.push({ label: fmt(t), t });
  }
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const t: T = { h: pick1(rnd, sp.hours), m: pick1(rnd, sp.minutes) };
    if (!ok(t)) continue;
    seen.add(fmt(t));
    out.push({ label: fmt(t), t });
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
// ==END==

const ROUNDS = 3;
const GF = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
const CSS = `
@keyframes mt-hop { 0%,100% { transform: translateY(0) scale(1); } 35% { transform: translateY(-12px) scale(1.05); } 70% { transform: translateY(0) scale(.98); } }
@keyframes mt-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } }
@keyframes mt-ring { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(6deg); } }
.mt-hop { animation: mt-hop .8s ease-out; transform-box: fill-box; transform-origin: center bottom; }
.mt-shake { animation: mt-shake .45s ease-in-out; }
.mt-bell { animation: mt-ring .5s ease-in-out 3; transform-box: fill-box; transform-origin: center bottom; }
@media (prefers-reduced-motion: reduce) { .mt-hop, .mt-shake, .mt-bell { animation: none; } }
`;
const CX = 150;
const CY = 168;
const HOUR_LEN = 54;
const MIN_LEN = 86;
const pt = (len: number, deg: number): [number, number] => [CX + len * Math.sin((deg * Math.PI) / 180), CY - len * Math.cos((deg * Math.PI) / 180)];

function ClockFace({ t, showMinutes, grab, react, touched, interactive }: { t: T; showMinutes: boolean; grab: "none" | "hour" | "minute"; react: "" | "ok" | "bad"; touched: boolean; interactive: boolean }) {
  const a = handAngles(t);
  const hp = pt(HOUR_LEN, a.hour);
  const mp = pt(MIN_LEN, a.minute);
  return (
    <g className={react === "ok" ? "mt-hop" : react === "bad" ? "mt-shake" : ""}>
      <defs>
        <radialGradient id="mt-face" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fffdf5" />
          <stop offset="1" stopColor="#ffe9c7" />
        </radialGradient>
        <linearGradient id="mt-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a7a" />
          <stop offset="1" stopColor="#e11d48" />
        </linearGradient>
      </defs>
      {/* 알람시계 모양: 종, 다리 */}
      <g className={react === "ok" ? "mt-bell" : ""}>
        <circle cx="68" cy="58" r="26" fill="#fbbf24" stroke="#b45309" strokeWidth="4" />
        <circle cx="232" cy="58" r="26" fill="#fbbf24" stroke="#b45309" strokeWidth="4" />
        <circle cx="68" cy="58" r="8" fill="#fde68a" />
        <circle cx="232" cy="58" r="8" fill="#fde68a" />
      </g>
      <circle cx="104" cy="296" r="11" fill="#9f1239" />
      <circle cx="196" cy="296" r="11" fill="#9f1239" />
      <rect x="147" y="40" width="6" height="10" rx="3" fill="#9f1239" />
      <ellipse cx={CX} cy={CY + 8} rx="128" ry="124" fill="rgba(0,0,0,0.14)" />
      <circle cx={CX} cy={CY} r="124" fill="url(#mt-rim)" stroke="#9f1239" strokeWidth="5" />
      <circle cx={CX} cy={CY} r="106" fill="url(#mt-face)" stroke="#fda4af" strokeWidth="3" />
      {/* 눈금 */}
      {Array.from({ length: 60 }, (_, i) => {
        const big = i % 5 === 0;
        const [x1, y1] = pt(big ? 92 : 98, i * 6);
        const [x2, y2] = pt(103, i * 6);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={big ? "#9f1239" : "#d6a5a5"} strokeWidth={big ? 3 : 1.4} strokeLinecap="round" />;
      })}
      {/* 숫자 1~12 */}
      {Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const [x, y] = pt(72, n * 30);
        return (
          <text key={n} x={x} y={y + 9} fontSize="27" textAnchor="middle" fill="#7c1d3a" style={GF}>
            {n}
          </text>
        );
      })}
      {showMinutes &&
        Array.from({ length: 12 }, (_, i) => {
          const n = i + 1;
          const [x, y] = pt(115, n * 30);
          return (
            <text key={n} x={x} y={y + 4} fontSize="11" textAnchor="middle" fill="#fff" style={GF}>
              {n * 5}
            </text>
          );
        })}
      {/* 얼굴 */}
      <circle cx="122" cy="130" r="6" fill="#3b1d2a" />
      <circle cx="178" cy="130" r="6" fill="#3b1d2a" />
      <circle cx="120" cy="128" r="2" fill="#fff" />
      <circle cx="176" cy="128" r="2" fill="#fff" />
      <circle cx="108" cy="146" r="7" fill="#fb7185" opacity="0.55" />
      <circle cx="192" cy="146" r="7" fill="#fb7185" opacity="0.55" />
      <path d={react === "bad" ? "M 138 208 Q 150 200 162 208" : "M 136 202 Q 150 216 164 202"} fill="none" stroke="#3b1d2a" strokeWidth="3.5" strokeLinecap="round" />
      {/* 시곗바늘: 짧은바늘(시)=주황빨강, 긴바늘(분)=파랑 */}
      <g>
        <line x1={CX + 2} y1={CY + 3} x2={hp[0] + 2} y2={hp[1] + 3} stroke="rgba(0,0,0,0.2)" strokeWidth="13" strokeLinecap="round" />
        <line x1={CX} y1={CY} x2={hp[0]} y2={hp[1]} stroke="#9a2d14" strokeWidth="13" strokeLinecap="round" />
        <line x1={CX} y1={CY} x2={hp[0]} y2={hp[1]} stroke="#ff6b3d" strokeWidth="8" strokeLinecap="round" />
        <line x1={CX + 2} y1={CY + 3} x2={mp[0] + 2} y2={mp[1] + 3} stroke="rgba(0,0,0,0.2)" strokeWidth="9" strokeLinecap="round" />
        <line x1={CX} y1={CY} x2={mp[0]} y2={mp[1]} stroke="#1e3a8a" strokeWidth="9" strokeLinecap="round" />
        <line x1={CX} y1={CY} x2={mp[0]} y2={mp[1]} stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" />
      </g>
      {interactive && (
        <g aria-hidden="true">
          <circle cx={hp[0]} cy={hp[1]} r="14" fill="#fff" fillOpacity="0.8" stroke="#9a2d14" strokeWidth="3" />
          <text x={hp[0]} y={hp[1] + 5} fontSize="14" textAnchor="middle" fill="#9a2d14" style={GF}>시</text>
          <circle cx={mp[0]} cy={mp[1]} r="14" fill="#fff" fillOpacity="0.8" stroke="#1e3a8a" strokeWidth="3" />
          <text x={mp[0]} y={mp[1] + 5} fontSize="14" textAnchor="middle" fill="#1e3a8a" style={GF}>분</text>
          {grab !== "none" && <circle cx={(grab === "hour" ? hp : mp)[0]} cy={(grab === "hour" ? hp : mp)[1]} r="20" fill="none" stroke="#facc15" strokeWidth="4" />}
          {!touched && (
            <circle cx={mp[0]} cy={mp[1]} r="14" fill="none" stroke="#e11d48" strokeWidth="3">
              <animate attributeName="r" values="14;30;14" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0;1" dur="1.6s" repeatCount="indefinite" />
            </circle>
          )}
        </g>
      )}
      <circle cx={CX} cy={CY} r="10" fill="#fde047" stroke="#92400e" strokeWidth="3" />
    </g>
  );
}

/** 맞추기: 디지털 시각을 보고 바늘을 끌어 맞춰요(놓는 순간 판정) */
function SetRound({ level, task, onResult }: { level: number; task: Task; onResult: () => void }) {
  const sp = levelSpec(level);
  const svgRef = useRef<SVGSVGElement>(null);
  const grab = useRef<"none" | "hour" | "minute">("none");
  const moved = useRef(false);
  const [t, setT] = useState<T>(task.clock);
  const tRef = useRef(t);
  tRef.current = t;
  const [g, setG] = useState<"none" | "hour" | "minute">("none");
  const [touched, setTouched] = useState(false);
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState(false);
  const [react, setReact] = useState<{ k: "" | "ok" | "bad"; n: number }>({ k: "", n: 0 });
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);

  const angleOf = (e: React.PointerEvent): { ang: number; r: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    const dx = x - CX;
    const dy = y - CY;
    return { ang: ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360, r: Math.hypot(dx, dy) };
  };
  const apply = (which: "hour" | "minute", ang: number) => {
    const cur = tRef.current;
    if (which === "minute") {
      const m = angleToMinute(ang, sp.step);
      if (m === cur.m) return;
      const next = { h: wrapHour(cur.h, cur.m, m), m };
      tRef.current = next;
      setT(next);
      moved.current = true;
      tick();
    } else {
      const h = hourFromAngle(ang, cur.m);
      if (h === cur.h) return;
      const next = { h, m: cur.m };
      tRef.current = next;
      setT(next);
      moved.current = true;
      tick();
    }
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    if (solved) return;
    const a = angleOf(e);
    if (!a) return;
    setTouched(true);
    const svg = svgRef.current!;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    const cur = tRef.current;
    const an = handAngles(cur);
    const hp = pt(HOUR_LEN, an.hour);
    const mp = pt(MIN_LEN, an.minute);
    const dm = Math.hypot(x - mp[0], y - mp[1]);
    const dh = Math.hypot(x - hp[0], y - hp[1]);
    const which: "hour" | "minute" = dh < 22 ? "hour" : dm < 30 ? "minute" : a.r < 66 ? "hour" : "minute";
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = which;
    setG(which);
    moved.current = false;
    apply(which, a.ang);
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (grab.current === "none") return;
    const a = angleOf(e);
    if (a) apply(grab.current, a.ang);
  };
  const up = () => {
    if (grab.current === "none") return;
    grab.current = "none";
    setG("none");
    if (!moved.current) return;
    judge(tRef.current);
  };
  const judge = (cur: T) => {
    if (same(cur, task.target)) {
      setSolved(true);
      cheer();
      setReact((r) => ({ k: "ok", n: r.n + 1 }));
      setMsg({ tone: "ok", text: `와, 맞았어요! ⭐ ${korean(task.target)}(${digital(task.target)})예요!` });
      onResult();
    } else {
      oops();
      setReact((r) => ({ k: "bad", n: r.n + 1 }));
      const minuteOff = cur.m !== task.target.m;
      setMsg({
        tone: "bad",
        text: minuteOff
          ? `지금은 ${korean(cur)}이에요. 괜찮아요! 긴바늘(분)을 다시 봐요. 긴바늘이 가리키는 숫자에 5를 곱하면 분이에요.`
          : `분은 맞았어요! 이제 짧은바늘(시)을 ${task.target.h}쪽으로 옮겨 봐요. 지금은 ${korean(cur)}이에요.`,
      });
    }
  };

  const prompt =
    task.phrase === "later" ? (
      <>
        시계는 지금 <b>{digital(task.clock)}</b>이에요. <span className="text-accent">{deltaText(task.delta)} 뒤</span>에는 몇 시 몇 분일까요?
      </>
    ) : task.phrase === "before" ? (
      <>
        <span className="text-accent">{task.text}</span>이 되게 바늘을 돌려요!
      </>
    ) : (
      <>
        디지털 시계가 <span className="text-accent">{task.text}</span>이에요. 시곗바늘을 맞춰요!
      </>
    );

  return (
    <div className="space-y-3">
      <Board>
        <p className="font-game mb-2 text-center text-2xl leading-snug">{prompt}</p>
        <div className="mx-auto mb-2 flex max-w-[320px] items-center justify-center gap-3 rounded-card border-4 border-[#fda4af] bg-[#1f2937] px-4 py-2 shadow-inner">
          <span className="font-game text-5xl tabular-nums text-[#86efac]" aria-label={`현재 바늘이 가리키는 시각 ${korean(t)}`}>
            {digital(t)}
          </span>
          <span className="text-base text-[#cbd5e1]">내 시계</span>
        </div>
        <svg
          ref={svgRef}
          viewBox="0 0 300 320"
          className="mx-auto block w-full max-w-[420px] touch-none select-none"
          style={{ touchAction: "none" }}
          role="img"
          aria-label={`시계. 지금 바늘은 ${korean(t)}를 가리켜요. 바늘을 끌어서 돌려요.`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => { grab.current = "none"; setG("none"); }}
        >
          <ClockFace t={t} showMinutes={sp.showMinutes || hint} grab={g} react={react.k} touched={touched} interactive={!solved} key={react.n} />
        </svg>
        <p className="text-center text-base text-muted">짧은바늘(주황)은 <b>시</b>, 긴바늘(파랑)은 <b>분</b>이에요. 바늘 끝을 끌어 돌려요!</p>
      </Board>
      {msg ? <Say tone={msg.tone}>{msg.text}</Say> : <Say>바늘을 끌다가 손을 떼면 바로 알려 줘요.</Say>}
      {hint && (
        <Say>
          {task.phrase === "before"
            ? "‘몇 시 몇 분 전’은 그 시가 되기 몇 분 전이에요. 4시 10분 전 = 3시 50분이에요."
            : task.phrase === "later"
              ? "먼저 분을 더해 봐요. 60분이 되면 1시간이 지나서 시가 하나 커져요."
              : "긴바늘이 12를 가리키면 ‘정각’, 6을 가리키면 30분이에요. 숫자 × 5 = 분!"}
        </Say>
      )}
      <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
        힌트 {hint ? "숨기기" : "보기"}
      </GButton>
    </div>
  );
}

/** 고르기: 시계를 보고 맞는 시각 카드를 눌러요 */
function PickRound({ level, task, onResult }: { level: number; task: Task; onResult: () => void }) {
  const sp = levelSpec(level);
  const [cards] = useState(() => makeCards(rand, level, task, level >= 5 ? 4 : 3));
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);
  const [react, setReact] = useState<{ k: "" | "ok" | "bad"; n: number }>({ k: "", n: 0 });

  const choose = (c: Card) => {
    if (done || wrong.includes(c.label)) return;
    if (same(c.t, task.target)) {
      setDone(c.label);
      cheer();
      setReact((r) => ({ k: "ok", n: r.n + 1 }));
      setMsg({ tone: "ok", text: `맞아요! 잘했어요! ⭐ ${korean(task.target)}(${digital(task.target)})예요!` });
      onResult();
    } else {
      setWrong((w) => [...w, c.label]);
      oops();
      setReact((r) => ({ k: "bad", n: r.n + 1 }));
      setMsg({ tone: "bad", text: "아쉬워요, 괜찮아요! 짧은바늘(시)과 긴바늘(분)을 차례로 읽어 봐요. 다른 카드를 골라 봐요." });
    }
  };

  return (
    <div className="space-y-3">
      <Board>
        <p className="font-game mb-2 text-center text-2xl leading-snug">
          {task.phrase === "later" ? (
            <>
              시계는 지금 이 시각이에요. <span className="text-accent">{deltaText(task.delta)} 뒤</span>는 몇 시일까요?
            </>
          ) : task.phrase === "before" ? (
            <>이 시계는 ‘몇 시 몇 분 전’일까요?</>
          ) : (
            <>이 시계는 몇 시 몇 분일까요?</>
          )}
        </p>
        <svg viewBox="0 0 300 320" className="mx-auto block w-full max-w-[380px] select-none" role="img" aria-label={`시계. ${korean(task.clock)}를 가리켜요.`}>
          <ClockFace t={task.clock} showMinutes={sp.showMinutes || hint} grab="none" react={react.k} touched interactive={false} key={react.n} />
        </svg>
      </Board>
      <div className={`grid gap-3 ${cards.length > 3 ? "grid-cols-2" : "grid-cols-3"}`} role="group" aria-label="시각 카드">
        {cards.map((c) => {
          const isWrong = wrong.includes(c.label);
          const isRight = done === c.label;
          return (
            <button
              key={c.label}
              type="button"
              disabled={!!done || isWrong}
              onClick={() => choose(c)}
              className={`font-game touch-manipulation rounded-card border-4 px-2 py-4 text-3xl tabular-nums shadow-[0_5px_0_rgba(0,0,0,0.15)] transition active:translate-y-[3px] active:shadow-none ${isRight ? "mt-hop border-ok bg-ok-soft text-ok" : isWrong ? "mt-shake border-bad bg-bad-soft text-bad opacity-60" : "border-[#fda4af] bg-[#1f2937] text-[#86efac]"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <style>{CSS}</style>
      {msg ? <Say tone={msg.tone}>{msg.text}</Say> : <Say>시계를 읽어서 맞는 시각 카드를 눌러요!</Say>}
      {hint && <Say>{task.phrase === "later" ? "시계가 가리키는 시각에 분을 더해 봐요. 60분은 1시간이에요." : "짧은바늘이 가리키는 숫자가 시, 긴바늘 × 5가 분이에요."}</Say>}
      <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
        힌트 {hint ? "숨기기" : "보기"}
      </GButton>
    </div>
  );
}

export default function MatchTimeGame() {
  const level = useStage();
  const timer = useRef(0);
  const [cleared, setCleared] = useState(0);
  const [tasks] = useState<Task[]>(() => [0, 1, 2].map((r) => makeTask(rand, level, r)));
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const task = tasks[Math.min(cleared, ROUNDS - 1)];
  const onResult = () => {
    const n = cleared + 1;
    if (n >= ROUNDS) timer.current = window.setTimeout(stageClear, 1200);
    else timer.current = window.setTimeout(() => setCleared(n), 2200);
  };
  return (
    <div className="space-y-3">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(cleared + 1, ROUNDS)}/${ROUNDS}`} />
        <Stat label="이번 판" value={task.kind === "set" ? "바늘 돌리기" : "시각 고르기"} />
      </div>
      {task.kind === "set" ? <SetRound key={`s${cleared}`} level={level} task={task} onResult={onResult} /> : <PickRound key={`p${cleared}`} level={level} task={task} onResult={onResult} />}
    </div>
  );
}
