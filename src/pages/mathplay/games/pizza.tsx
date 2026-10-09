import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as RKeyboardEvent } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, tick } from "./kit";
import { BIG } from "./easykit";

// ==PURE==
export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;
export type Fr = { k: number; n: number }; // n조각 중 k조각
export const eqFr = (x: Fr, y: Fr) => x.k * y.n === y.k * x.n;
/** 크면 1, 같으면 0, 작으면 -1 */
export const cmpFr = (x: Fr, y: Fr) => Math.sign(x.k * y.n - y.k * x.n);
export const reduceFr = (x: Fr): Fr => {
  const g = gcd(x.k, x.n) || 1;
  return { k: x.k / g, n: x.n / g };
};

/** 같은 양 만들기 목표: 기약분수 a/b (b는 2~6). 서로 다른 두 피자로 만들 수 있게 b의 배수가 두 개 이상 12 이하 */
export function makeTarget(rnd: (n: number) => number): Fr {
  for (;;) {
    const b = 2 + rnd(5);
    const a = 1 + rnd(b - 1);
    if (gcd(a, b) === 1) return { k: a, n: b };
  }
}

/** 비교 문제: 서로 다른 조각 수의 두 분수(25%는 같은 양) */
export function makeCompare(rnd: (n: number) => number): [Fr, Fr] {
  for (;;) {
    let x: Fr;
    let y: Fr;
    if (rnd(4) === 0) {
      const base = makeTarget(rnd);
      const m1 = 1 + rnd(Math.floor(12 / base.n));
      const m2 = 1 + rnd(Math.floor(12 / base.n));
      x = { k: base.k * m1, n: base.n * m1 };
      y = { k: base.k * m2, n: base.n * m2 };
    } else {
      const n1 = 2 + rnd(11);
      const n2 = 2 + rnd(11);
      x = { k: 1 + rnd(n1 - 1), n: n1 };
      y = { k: 1 + rnd(n2 - 1), n: n2 };
    }
    if (x.n !== y.n) return [x, y];
  }
}
/** 쉬운 목표: 1/2, 1/4, 3/4, 1/3, 2/3 */
export function makeEasyTarget(rnd: (n: number) => number): Fr {
  const list: Fr[] = [{ k: 1, n: 2 }, { k: 1, n: 4 }, { k: 3, n: 4 }, { k: 1, n: 3 }, { k: 2, n: 3 }, { k: 1, n: 2 }];
  return list[rnd(list.length)];
}

/** 쉬운 비교: 조각 수가 2·4·8 또는 2·3·6 처럼 서로 맞추기 쉬운 것끼리 */
export function makeCompareEasy(rnd: (n: number) => number): [Fr, Fr] {
  const sets = [[2, 4, 8], [2, 3, 6], [3, 6], [2, 4]];
  for (;;) {
    const set = sets[rnd(sets.length)];
    const n1 = set[rnd(set.length)];
    const n2 = set[rnd(set.length)];
    if (n1 === n2) continue;
    let x: Fr = { k: 1 + rnd(n1 - 1), n: n1 };
    let y: Fr = { k: 1 + rnd(n2 - 1), n: n2 };
    if (rnd(4) === 0) {
      const base = reduceFr(x);
      const m = n2 / base.n;
      if (Number.isInteger(m)) y = { k: base.k * m, n: base.n * m };
    }
    if (x.n !== y.n) return [x, y];
    x = y;
  }
}
// ==END==

const frText = (f: Fr) => `${f.k}/${f.n}`;
const PN = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const PN_EASY = [2, 3, 4, 6, 8, 12];
const ROUNDS = 5;

function Pizza({ n, sel, onToggle, label, size = 200 }: { n: number; sel: boolean[]; onToggle?: (i: number) => void; label: string; size?: number }) {
  const R = 96;
  const slices = Array.from({ length: n }, (_, i) => {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const a1 = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / n;
    const mid = (a0 + a1) / 2;
    const d = `M 0 0 L ${R * Math.cos(a0)} ${R * Math.sin(a0)} A ${R} ${R} 0 0 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
    return { d, px: 0.62 * R * Math.cos(mid), py: 0.62 * R * Math.sin(mid) };
  });
  const key = (e: RKeyboardEvent, i: number) => {
    if (onToggle && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onToggle(i);
    }
  };
  return (
    <svg viewBox="-106 -106 212 212" style={{ width: "100%", maxWidth: size, touchAction: "manipulation" }} className="mx-auto block select-none" role="group" aria-label={label}>
      <circle r="103" fill="#b45309" />
      <circle r="99" fill="#fcd34d" />
      {slices.map((sl, i) => (
        <g key={i}>
          <path
            d={sl.d}
            fill={sel[i] ? "#f59e0b" : "#fef3c7"}
            stroke="#92400e"
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ cursor: onToggle ? "pointer" : "default" }}
            role={onToggle ? "button" : undefined}
            tabIndex={onToggle ? 0 : undefined}
            aria-label={onToggle ? `${i + 1}번째 조각, ${sel[i] ? "칠했어요. 누르면 지워요" : "누르면 칠해요"}` : undefined}
            aria-pressed={onToggle ? sel[i] : undefined}
            onClick={onToggle ? () => onToggle(i) : undefined}
            onKeyDown={onToggle ? (e) => key(e, i) : undefined}
          />
          {sel[i] && <circle cx={sl.px} cy={sl.py} r="8" fill="#dc2626" stroke="#7f1d1d" pointerEvents="none" />}
        </g>
      ))}
    </svg>
  );
}

/** 조각 수를 큰 −/+ 단추로 바꾸기 */
function Stepper({ n, setN, disabled, list }: { n: number; setN: (n: number) => void; disabled?: boolean; list: number[] }) {
  const i = Math.max(0, list.indexOf(n));
  const btn = "inline-flex h-12 w-14 items-center justify-center rounded-card border border-line bg-surface text-2xl font-extrabold transition hover:bg-bg active:scale-95 disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-3" role="group" aria-label="피자를 나눌 조각 수">
      <button type="button" className={btn} disabled={disabled || i <= 0} aria-label="조각 수 줄이기" onClick={() => { setN(list[i - 1]); tick(); }}>
        −
      </button>
      <span className="min-w-[4.5rem] text-center text-lg font-bold tabular-nums">{n}조각</span>
      <button type="button" className={btn} disabled={disabled || i >= list.length - 1} aria-label="조각 수 늘리기" onClick={() => { setN(list[i + 1]); tick(); }}>
        +
      </button>
    </div>
  );
}

const countOf = (sel: boolean[]) => sel.filter(Boolean).length;
const blank = (n: number) => Array.from({ length: n }, () => false);
const toggleAt = (sel: boolean[], i: number) => sel.map((x, j) => (j === i ? !x : x));

/* ── 마음대로 ── */
function FreeMode() {
  const [n, setN] = useState(8);
  const [sel, setSel] = useState<boolean[]>(blank(8));
  const k = countOf(sel);
  const r = reduceFr({ k, n });
  return (
    <div className="space-y-3">
      <Board>
        <p className="mb-2 text-center text-lg font-bold">조각을 눌러 칠해 봐요. 다시 누르면 지워져요!</p>
        <Pizza n={n} sel={sel} onToggle={(i) => { setSel((s) => toggleAt(s, i)); tick(); }} label={`피자 ${n}조각 중 ${k}조각을 칠했어요`} size={260} />
        <div className="mt-3">
          <Stepper n={n} setN={(v) => { setN(v); setSel(blank(v)); }} list={PN} />
        </div>
        <p className="mt-2 text-center text-2xl font-extrabold tabular-nums">
          {k}/{n}
          {k > 0 && r.n !== n && <span className="ml-2 text-lg text-muted">= {frText(r)}</span>}
        </p>
        <p className="text-center text-base text-muted tabular-nums">{n}조각 중 {k}조각을 칠했어요</p>
      </Board>
      <GButton onClick={() => setSel(blank(n))} className={BIG}>다시 하기 (모두 지우기)</GButton>
      <Say>조각 수를 바꿔도 같은 양을 만들 수 있을까요? 1/2을 여러 가지로 만들어 봐요!</Say>
    </div>
  );
}

/* ── 같은 양 만들기: 두 피자가 목표와 같아지면 바로 성공! ── */
function MakeMode({ hard }: { hard: boolean }) {
  const timer = useRef(0);
  const gen = () => (hard ? makeTarget(rand) : makeEasyTarget(rand));
  const [target, setTarget] = useState(gen);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [nA, setNA] = useState(target.n);
  const [nB, setNB] = useState(target.n * 2);
  const [sA, setSA] = useState<boolean[]>(blank(target.n));
  const [sB, setSB] = useState<boolean[]>(blank(target.n * 2));
  const [hint, setHint] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [solved, setSolved] = useState(false);

  const fA = { k: countOf(sA), n: nA };
  const fB = { k: countOf(sB), n: nB };
  const okA = fA.k > 0 && eqFr(fA, target);
  const okB = fB.k > 0 && eqFr(fB, target);
  const success = okA && okB && nA !== nB;
  const last = round === ROUNDS;
  const list = hard ? PN : PN_EASY;

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!success || solved) return;
    setSolved(true);
    setScore((v) => v + (hinted ? 1 : 2));
    cheer();
    if (round < ROUNDS) timer.current = window.setTimeout(() => nextRound(), 2600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const reset = (t: Fr) => {
    setTarget(t);
    setNA(t.n);
    setNB(t.n * 2);
    setSA(blank(t.n));
    setSB(blank(t.n * 2));
    setHint(false);
    setHinted(false);
    setSolved(false);
  };
  const nextRound = () => {
    setRound((r) => r + 1);
    reset(gen());
  };
  const restart = () => {
    window.clearTimeout(timer.current);
    setRound(1);
    setScore(0);
    reset(gen());
  };
  const mults = [1, 2, 3, 4, 5, 6].filter((m) => target.n * m <= 12);

  const status = (f: Fr, ok: boolean) =>
    ok ? "✓ 맞아요!" : f.k === 0 ? "" : f.n % target.n !== 0 ? `${f.n}조각으로는 ${frText(target)}를 딱 맞게 못 만들어요. 조각 수를 바꿔 봐요.` : `${frText(f)}예요. ${frText(target)}가 되도록 칠해 봐요.`;

  let say: { tone: "info" | "ok" | "bad"; text: string };
  if (success) say = { tone: "ok", text: `잘했어요! ⭐ ${[...new Set([frText(fA), frText(target), frText(fB)])].join(" = ")} — 조각 수가 달라도 양은 같아요!${last ? "" : " 곧 다음 문제로 가요."}` };
  else if (okA && okB) say = { tone: "bad", text: "두 피자의 조각 수가 같아요. 괜찮아요! 한쪽 조각 수를 −/+ 로 바꿔서 다시 칠해 봐요." };
  else say = { tone: "info", text: `두 피자에 ${frText(target)} 만큼씩 칠해요. 조각을 누르면 칠해지고, 다시 누르면 지워져요!` };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${round}/${ROUNDS}`} />
        <Stat label="점수" value={score} tone="ok" />
      </div>
      <p className="text-center text-xl font-extrabold">
        <span className="text-accent tabular-nums">{frText(target)}</span> 만큼 두 피자에 칠해 봐요 <span className="text-base font-semibold text-muted">(조각 수는 서로 다르게!)</span>
      </p>
      <Board>
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { id: "왼쪽", n: nA, setN: (v: number) => { setNA(v); setSA(blank(v)); }, sel: sA, setSel: setSA, f: fA, ok: okA },
            { id: "오른쪽", n: nB, setN: (v: number) => { setNB(v); setSB(blank(v)); }, sel: sB, setSel: setSB, f: fB, ok: okB },
          ].map((p) => (
            <div key={p.id} className={`rounded-card p-2 ${p.ok ? "bg-ok-soft" : ""}`}>
              <Pizza n={p.n} sel={p.sel} onToggle={solved ? undefined : (i) => { p.setSel((v) => toggleAt(v, i)); tick(); }} label={`${p.id} 피자 ${p.n}조각 중 ${p.f.k}조각`} size={200} />
              <p className="mt-1 text-center text-2xl font-extrabold tabular-nums">
                {p.f.k}/{p.f.n}
                {p.f.k > 0 && reduceFr(p.f).n !== p.f.n && <span className="ml-2 text-base text-muted">(= {frText(reduceFr(p.f))})</span>}
              </p>
              <p className={`min-h-[1.5rem] text-center text-base font-semibold ${p.ok ? "text-ok" : "text-muted"}`}>{status(p.f, p.ok)}</p>
              <div className="mt-1">
                <Stepper n={p.n} setN={p.setN} disabled={solved} list={list} />
              </div>
            </div>
          ))}
        </div>
      </Board>
      <Say tone={say.tone}>{say.text}</Say>
      {hint && (
        <Say>
          같은 양은 이렇게 여러 가지로 쓸 수 있어요: {mults.map((m) => `${target.k * m}/${target.n * m}`).join(" = ")}. 조각을 2배로 잘게 나누면 칠할 조각도 2배가 돼요!
        </Say>
      )}
      {solved && last && <Say tone={score >= 8 ? "ok" : "info"}>5문제 끝! {score}점 / 10점이에요. {score >= 8 ? "대단해요!" : "잘했어요!"}</Say>}
      <div className="flex flex-wrap gap-2">
        {solved && last && (
          <GButton variant="primary" onClick={restart} className={BIG}>
            다시 하기
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => { setHint((h) => !h); setHinted(true); }} className={BIG}>
          힌트 {hint ? "숨기기" : "보기"}
        </GButton>
        {!(solved && last) && (
          <GButton onClick={restart} className={BIG}>
            다시 하기
          </GButton>
        )}
      </div>
    </div>
  );
}

/* ── 크기 비교: 더 많이 칠해진 피자를 직접 눌러요 ── */
function CompareMode({ hard }: { hard: boolean }) {
  const timer = useRef(0);
  const gen = () => (hard ? makeCompare(rand) : makeCompareEasy(rand));
  const [q, setQ] = useState(gen);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<null | -1 | 0 | 1>(null); // 1: 왼쪽이 커요, -1: 오른쪽이 커요, 0: 같아요
  const [x, y] = q;
  const truth = cmpFr(x, y) as -1 | 0 | 1;
  const last = round === ROUNDS;
  const pie = (f: Fr) => Array.from({ length: f.n }, (_, i) => i < f.k);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const choose = (v: -1 | 0 | 1) => {
    if (pick !== null) return;
    setPick(v);
    const ok = v === truth;
    if (ok) {
      setScore((s) => s + 1);
      cheer();
    } else oops();
    if (round < ROUNDS) timer.current = window.setTimeout(() => { setQ(gen()); setRound((r) => r + 1); setPick(null); }, ok ? 1800 : 3600);
  };
  const L = lcm(x.n, y.n);
  const xs = x.k * (L / x.n);
  const ys = y.k * (L / y.n);
  const explain = `조각 크기를 똑같이 ${L}조각으로 맞춰 봐요. ${frText(x)}는 ${xs}/${L}, ${frText(y)}는 ${ys}/${L}이에요. ${truth > 0 ? `${xs}가 ${ys}보다 커서 왼쪽이 더 커요.` : truth < 0 ? `${xs}가 ${ys}보다 작아서 오른쪽이 더 커요.` : "둘이 같아서 양이 같아요."}`;
  const again = () => {
    window.clearTimeout(timer.current);
    setQ(gen());
    setRound(1);
    setScore(0);
    setPick(null);
  };
  const ring = (side: 1 | -1) => (pick === null ? "border-line" : truth === side ? "border-ok bg-ok-soft" : pick === side ? "border-bad bg-bad-soft" : "border-line");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${round}/${ROUNDS}`} />
        <Stat label="점수" value={score} tone="ok" />
      </div>
      <p className="text-center text-xl font-extrabold">더 많이 칠해진 피자를 눌러요!</p>
      <div className="grid grid-cols-2 gap-3">
        {([{ f: x, side: 1 as const, name: "왼쪽" }, { f: y, side: -1 as const, name: "오른쪽" }]).map(({ f, side, name }) => (
          <button
            key={name}
            type="button"
            disabled={pick !== null}
            onClick={() => choose(side)}
            aria-label={`${name} 피자 ${f.n}조각 중 ${f.k}조각. 이 피자가 더 많아요`}
            className={`touch-manipulation rounded-card border-2 bg-surface p-2 transition active:scale-[0.98] ${ring(side)}`}
          >
            <Pizza n={f.n} sel={pie(f)} label={`${name} 피자 ${f.n}조각 중 ${f.k}조각`} size={190} />
            <span className="mt-1 block text-center text-2xl font-extrabold tabular-nums">{frText(f)}</span>
          </button>
        ))}
      </div>
      <GButton variant={pick === 0 ? "primary" : "soft"} disabled={pick !== null} onClick={() => choose(0)} className="min-h-[56px]! w-full text-lg">
        똑같아요 ( = )
      </GButton>
      {pick === null ? <Say>어느 쪽이 더 많이 칠해졌을까요? 눈으로 비교해 보고, 많은 쪽 피자를 눌러요. 같으면 ‘똑같아요’!</Say> : <Say tone={pick === truth ? "ok" : "bad"}>{pick === truth ? "정답이에요! 잘했어요! ⭐ " : "아쉬워요, 괜찮아요! "}{explain}</Say>}
      {pick !== null && last && <Say tone={score >= 4 ? "ok" : "info"}>5문제 끝! {score}문제 맞혔어요. {score >= 4 ? "대단해요!" : "잘했어요!"}</Say>}
      <GButton variant={pick !== null && last ? "primary" : "ghost"} onClick={again} className={BIG}>
        다시 하기
      </GButton>
    </div>
  );
}

type Mode = "free" | "make" | "compare";
export default function PizzaGame() {
  const [mode, setMode] = useState<Mode>("make");
  const [hard, setHard] = useState(false);
  return (
    <div className="space-y-4">
      {mode === "free" && <FreeMode key="free" />}
      {mode === "make" && <MakeMode key={`make${hard}`} hard={hard} />}
      {mode === "compare" && <CompareMode key={`cmp${hard}`} hard={hard} />}
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <GButton pressed={mode === "make"} onClick={() => setMode("make")} className={BIG}>같은 양 만들기</GButton>
        <GButton pressed={mode === "compare"} onClick={() => setMode("compare")} className={BIG}>크기 비교</GButton>
        <GButton pressed={mode === "free"} onClick={() => setMode("free")} className={BIG}>마음대로 나누기</GButton>
        {mode !== "free" && <GButton pressed={hard} onClick={() => setHard((h) => !h)} className={BIG}>더 어려운 도전</GButton>}
      </div>
    </div>
  );
}
