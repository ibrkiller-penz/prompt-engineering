import { useState } from "react";
import type { KeyboardEvent as RKeyboardEvent } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";

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
// ==END==

const frText = (f: Fr) => `${f.k}/${f.n}`;
const PN = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
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
    <svg viewBox="-106 -106 212 212" style={{ width: "100%", maxWidth: size }} className="mx-auto block select-none" role="group" aria-label={label}>
      <circle r="103" fill="#b45309" />
      <circle r="99" fill="#fcd34d" />
      {slices.map((s, i) => (
        <g key={i}>
          <path
            d={s.d}
            fill={sel[i] ? "#f59e0b" : "#fef3c7"}
            stroke="#92400e"
            strokeWidth="2"
            strokeLinejoin="round"
            style={{ cursor: onToggle ? "pointer" : "default" }}
            role={onToggle ? "button" : undefined}
            tabIndex={onToggle ? 0 : undefined}
            aria-label={onToggle ? `${i + 1}번째 조각, ${sel[i] ? "골랐어요" : "고르지 않았어요"}` : undefined}
            aria-pressed={onToggle ? sel[i] : undefined}
            onClick={onToggle ? () => onToggle(i) : undefined}
            onKeyDown={onToggle ? (e) => key(e, i) : undefined}
          />
          {sel[i] && <circle cx={s.px} cy={s.py} r="8" fill="#dc2626" stroke="#7f1d1d" pointerEvents="none" />}
        </g>
      ))}
    </svg>
  );
}

function Counter({ n, setN, disabled }: { n: number; setN: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap justify-center gap-1" role="group" aria-label="피자를 나눌 조각 수">
      {PN.map((v) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          aria-pressed={n === v}
          onClick={() => setN(v)}
          className={`inline-flex h-11 min-w-[40px] items-center justify-center rounded-card px-2 text-sm font-bold tabular-nums transition disabled:opacity-40 ${n === v ? "bg-accent text-accent-ink" : "border border-line bg-surface hover:bg-bg"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

const countOf = (sel: boolean[]) => sel.filter(Boolean).length;
const blank = (n: number) => Array.from({ length: n }, () => false);

/* ── 마음대로 ── */
function FreeMode() {
  const [n, setN] = useState(8);
  const [sel, setSel] = useState<boolean[]>(blank(8));
  const k = countOf(sel);
  const r = reduceFr({ k, n });
  return (
    <div className="space-y-3">
      <Board>
        <p className="mb-1 text-center text-sm font-semibold">몇 조각으로 나눌까요?</p>
        <Counter n={n} setN={(v) => { setN(v); setSel(blank(v)); }} />
        <div className="mt-3">
          <Pizza n={n} sel={sel} onToggle={(i) => setSel((s) => s.map((x, j) => (j === i ? !x : x)))} label={`피자 ${n}조각 중 ${k}조각을 골랐어요`} size={240} />
        </div>
        <p className="mt-2 text-center text-2xl font-extrabold tabular-nums">
          {k}/{n}
          {k > 0 && r.n !== n && <span className="ml-2 text-lg text-muted">= {frText(r)}</span>}
        </p>
        <p className="text-center text-sm text-muted tabular-nums">{n}조각 중 {k}조각 · 피자의 약 {Math.round((k / n) * 100)}%</p>
      </Board>
      <div className="flex flex-wrap gap-2">
        <GButton onClick={() => setSel(blank(n))}>다시 하기 (모두 비우기)</GButton>
        <GButton onClick={() => setSel(sel.map((_, i) => i < Math.floor(n / 2)))}>절반 채우기</GButton>
      </div>
      <Say>조각을 눌러 먹을 양을 골라 봐요. 조각 수를 바꿔도 같은 양을 만들 수 있는지 살펴봐요.</Say>
    </div>
  );
}

/* ── 같은 양 만들기 ── */
function MakeMode() {
  const [target, setTarget] = useState(() => makeTarget(rand));
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [nA, setNA] = useState(2);
  const [nB, setNB] = useState(4);
  const [sA, setSA] = useState<boolean[]>(blank(2));
  const [sB, setSB] = useState<boolean[]>(blank(4));
  const [res, setRes] = useState<null | { ok: boolean; text: string }>(null);
  const [hint, setHint] = useState(false);
  const [solved, setSolved] = useState(false);

  const fA = { k: countOf(sA), n: nA };
  const fB = { k: countOf(sB), n: nB };
  const last = round === ROUNDS;

  const reset = (t: Fr) => {
    setTarget(t);
    setNA(2);
    setNB(4);
    setSA(blank(2));
    setSB(blank(4));
    setRes(null);
    setHint(false);
    setSolved(false);
    setTries(0);
  };
  const check = () => {
    setTries((t) => t + 1);
    const lines: string[] = [];
    if (nA === nB) {
      setRes({ ok: false, text: "두 피자의 조각 수가 같아요. 서로 다른 조각 수로 만들어야 해요." });
      return;
    }
    for (const [name, f] of [["왼쪽", fA], ["오른쪽", fB]] as const) {
      if (!eqFr(f, target)) {
        if (f.n % target.n !== 0) lines.push(`${name} 피자는 ${f.n}조각이라서 ${frText(target)}를 정확히 만들 수 없어요. 조각 수가 ${target.n}의 배수여야 해요.`);
        else lines.push(`${name} 피자는 지금 ${frText(f)}예요. ${frText(target)}와 다르니 조각 수를 다시 세어 봐요.`);
      }
    }
    if (lines.length) {
      setRes({ ok: false, text: lines.join(" ") });
      return;
    }
    const pts = tries === 0 ? 2 : 1;
    setScore((s) => s + pts);
    setSolved(true);
    setRes({ ok: true, text: `성공! ${frText(fA)} = ${frText(target)} = ${frText(fB)}. 조각 수가 달라도 양은 같아요. (+${pts}점)` });
  };

  const mults = [1, 2, 3, 4, 5, 6].filter((m) => target.n * m <= 12);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${round}/${ROUNDS}`} />
        <Stat label="점수" value={score} tone="ok" />
      </div>
      <p className="text-center text-lg font-extrabold">
        <span className="text-accent tabular-nums">{frText(target)}</span> 만큼 두 피자에 만들어 봐요 <span className="text-sm font-semibold text-muted">(조각 수는 서로 다르게!)</span>
      </p>
      <Board>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { id: "왼쪽", n: nA, setN: (v: number) => { setNA(v); setSA(blank(v)); setRes(null); }, sel: sA, setSel: setSA, f: fA },
            { id: "오른쪽", n: nB, setN: (v: number) => { setNB(v); setSB(blank(v)); setRes(null); }, sel: sB, setSel: setSB, f: fB },
          ].map((p) => (
            <div key={p.id}>
              <p className="mb-1 text-center text-sm font-semibold">{p.id} 피자 · 조각 수</p>
              <Counter n={p.n} setN={p.setN} disabled={solved} />
              <div className="mt-2">
                <Pizza n={p.n} sel={p.sel} onToggle={solved ? undefined : (i) => { p.setSel((s) => s.map((x, j) => (j === i ? !x : x))); setRes(null); }} label={`${p.id} 피자 ${p.n}조각 중 ${p.f.k}조각`} size={190} />
              </div>
              <p className="text-center text-xl font-extrabold tabular-nums">
                {p.f.k}/{p.f.n}
                {p.f.k > 0 && reduceFr(p.f).n !== p.f.n && <span className="ml-2 text-base text-muted">= {frText(reduceFr(p.f))}</span>}
              </p>
            </div>
          ))}
        </div>
      </Board>
      <div className="flex flex-wrap gap-2">
        {!solved && (
          <GButton variant="primary" onClick={check}>
            확인
          </GButton>
        )}
        {solved && !last && (
          <GButton variant="primary" onClick={() => { setRound((r) => r + 1); reset(makeTarget(rand)); }}>
            다음 문제
          </GButton>
        )}
        <GButton pressed={hint} onClick={() => setHint((h) => !h)}>
          힌트 {hint ? "끄기" : "보기"}
        </GButton>
        <GButton onClick={() => { setRound(1); setScore(0); reset(makeTarget(rand)); }}>다시 하기</GButton>
      </div>
      {hint && (
        <Say>
          분모와 분자에 같은 수를 곱해도 양은 같아요(통분). {mults.map((m) => `${target.k * m}/${target.n * m}`).join(" = ")}. 거꾸로 같은 수로 나누면 약분이에요.
        </Say>
      )}
      {res ? <Say tone={res.ok ? "ok" : "bad"}>{res.text}</Say> : !hint && <Say>피자마다 조각 수를 고르고, 조각을 눌러 {frText(target)} 만큼 칠해요. 다 되면 ‘확인’!</Say>}
      {solved && last && <Say tone={score >= 8 ? "ok" : "info"}>5문제 끝! 모두 {score}점 / 10점이에요.</Say>}
    </div>
  );
}

/* ── 크기 비교 ── */
function CompareMode() {
  const [q, setQ] = useState(() => makeCompare(rand));
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<null | -1 | 0 | 1>(null);
  const [x, y] = q;
  const truth = cmpFr(x, y) as -1 | 0 | 1;
  const last = round === ROUNDS;
  const pie = (f: Fr) => Array.from({ length: f.n }, (_, i) => i < f.k);

  const choose = (v: -1 | 0 | 1) => {
    if (pick !== null) return;
    setPick(v);
    if (v === truth) setScore((s) => s + 1);
  };
  const L = lcm(x.n, y.n);
  const xs = x.k * (L / x.n);
  const ys = y.k * (L / y.n);
  const sym = truth > 0 ? ">" : truth < 0 ? "<" : "=";
  const explain = `분모를 ${L}로 맞춰요(통분). ${frText(x)} = ${xs}/${L}, ${frText(y)} = ${ys}/${L} 이니까 ${xs}/${L} ${sym} ${ys}/${L}, 곧 ${frText(x)} ${sym} ${frText(y)} 예요.`;

  const again = () => {
    setQ(makeCompare(rand));
    setRound(1);
    setScore(0);
    setPick(null);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${round}/${ROUNDS}`} />
        <Stat label="점수" value={score} tone="ok" />
      </div>
      <Board>
        <div className="grid grid-cols-2 gap-3">
          {[x, y].map((f, i) => (
            <div key={i}>
              <Pizza n={f.n} sel={pie(f)} label={`${i === 0 ? "왼쪽" : "오른쪽"} 피자 ${f.n}조각 중 ${f.k}조각`} size={190} />
              <p className="text-center text-2xl font-extrabold tabular-nums">{frText(f)}</p>
            </div>
          ))}
        </div>
      </Board>
      <p className="text-center text-sm font-semibold">왼쪽 {frText(x)} 은(는) 오른쪽 {frText(y)} 보다…</p>
      <div className="flex flex-wrap justify-center gap-2">
        <GButton variant="soft" disabled={pick !== null} onClick={() => choose(1)} className="min-w-[110px]">
          더 커요 ( &gt; )
        </GButton>
        <GButton variant="soft" disabled={pick !== null} onClick={() => choose(0)} className="min-w-[110px]">
          같아요 ( = )
        </GButton>
        <GButton variant="soft" disabled={pick !== null} onClick={() => choose(-1)} className="min-w-[110px]">
          더 작아요 ( &lt; )
        </GButton>
      </div>
      <div className="flex flex-wrap gap-2">
        {pick !== null && !last && (
          <GButton variant="primary" onClick={() => { setQ(makeCompare(rand)); setRound((r) => r + 1); setPick(null); }}>
            다음 문제
          </GButton>
        )}
        <GButton onClick={again}>다시 하기</GButton>
      </div>
      {pick === null ? <Say>두 피자의 양을 비교해 봐요. 조각 수가 달라서 눈으로만은 어려울 수 있어요.</Say> : <Say tone={pick === truth ? "ok" : "bad"}>{pick === truth ? "정답이에요! " : "아쉬워요. "}{explain}</Say>}
      {pick !== null && last && <Say tone={score >= 4 ? "ok" : "info"}>5문제 끝! {score}문제 맞혔어요.</Say>}
    </div>
  );
}

type Mode = "free" | "make" | "compare";
export default function PizzaGame() {
  const [mode, setMode] = useState<Mode>("make");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <GButton pressed={mode === "make"} onClick={() => setMode("make")}>같은 양 만들기</GButton>
        <GButton pressed={mode === "compare"} onClick={() => setMode("compare")}>크기 비교</GButton>
        <GButton pressed={mode === "free"} onClick={() => setMode("free")}>마음대로 나누기</GButton>
      </div>
      {mode === "free" && <FreeMode key="free" />}
      {mode === "make" && <MakeMode key="make" />}
      {mode === "compare" && <CompareMode key="compare" />}
    </div>
  );
}
