import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, tick } from "./kit";

// <pure>
function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
/** p+q=n 인 소수 쌍 (p≤q) 모두 */
function goldbachPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let p = 2; p <= n / 2; p++) if (isPrime(p) && isPrime(n - p)) out.push([p, n - p]);
  return out;
}
// </pure>

const evensTo = (a: number, b: number) => {
  const r: number[] = [];
  for (let n = a; n <= b; n += 2) r.push(n);
  return r;
};
const EASY = evensTo(4, 30);
const ALL_EVENS = evensTo(4, 200);
const COUNTS = ALL_EVENS.map((n) => goldbachPairs(n).length);
const MIN_C = Math.min(...COUNTS);
const MAX_C = Math.max(...COUNTS);
const MIN_N = ALL_EVENS[COUNTS.indexOf(MIN_C)];
const MAX_N = ALL_EVENS[COUNTS.indexOf(MAX_C)];
const primesBelow = (n: number) => Array.from({ length: n }, (_, i) => i).filter(isPrime);
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);
const five = (src: number[]) => shuffle(src).slice(0, 5);
const PAIR_SET = () => five(EASY);
const ALL_SET = () => five(EASY.filter((n) => goldbachPairs(n).length >= 2));
const BIG = "!min-h-[48px] !text-base";
const stars = (n: number) => (n > 0 ? "⭐".repeat(n) : "0");

const CANDY: [string, string, string][] = [
  ["#fda4af", "#f43f5e", "#9f1239"],
  ["#fdba74", "#f97316", "#9a3412"],
  ["#fde68a", "#eab308", "#854d0e"],
  ["#86efac", "#22c55e", "#166534"],
  ["#7dd3fc", "#0ea5e9", "#075985"],
  ["#c4b5fd", "#8b5cf6", "#5b21b6"],
  ["#f9a8d4", "#ec4899", "#9d174d"],
];
const candy = (p: number, bad = false) => {
  const [l, b, d] = bad ? ["#fecaca", "#ef4444", "#991b1b"] : CANDY[PRIMES_200.indexOf(p) % CANDY.length];
  return { background: `radial-gradient(circle at 35% 30%, ${l}, ${b})`, borderColor: d, color: "#fff", textShadow: `0 2px 0 ${d}`, boxShadow: `0 4px 0 ${d}` };
};
const PRIMES_200 = Array.from({ length: 200 }, (_, i) => i).filter(isPrime);
const BALLOONS: [string, string, string][] = [
  ["#fda4af", "#e11d48", "#9f1239"],
  ["#93c5fd", "#2563eb", "#1e3a8a"],
  ["#fde68a", "#f59e0b", "#92400e"],
  ["#86efac", "#16a34a", "#14532d"],
  ["#d8b4fe", "#9333ea", "#581c87"],
];
const SPARK: [number, number, string][] = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * Math.PI * 2;
  return [Math.round(Math.cos(a) * 80) - 8, Math.round(Math.sin(a) * 62) - 14, ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"][k % 6]];
});

type Tab = "pair" | "all" | "explore";
type M = { t: "info" | "ok" | "bad"; s: string };

function PairBars({ n, pairs }: { n: number; pairs: [number, number][] }) {
  return (
    <div className="space-y-1.5">
      {pairs.map(([p, q]) => (
        <div key={p} className="flex h-9 overflow-hidden rounded-md text-base font-bold text-white" role="img" aria-label={`${p} 더하기 ${q} 는 ${n}`}>
          <div className="flex items-center pl-2" style={{ width: `${(100 * p) / n}%`, minWidth: "2.2rem", background: "#0284c7" }}>
            {p}
          </div>
          <div className="flex flex-1 items-center justify-end pr-2" style={{ background: "#d97706" }}>
            {q}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function GoldbachGame() {
  const [tab, setTab] = useState<Tab>("pair");
  const [hard, setHard] = useState(false);
  const [more, setMore] = useState(false);
  const [n, setN] = useState(12);
  const [msg, setMsg] = useState<M>({ t: "info", s: "두 소수를 눌러서 합이 목표 수가 되게 해 보세요!" });

  // 풍선 놀이(소수 두 개 더하기)
  const [set1, setSet1] = useState(PAIR_SET);
  const [r1, setR1] = useState(0);
  const [slots, setSlots] = useState<(number | null)[]>([null, null]);
  const [wrong1, setWrong1] = useState(0);
  const [phase1, setPhase1] = useState<"play" | "ok" | "bad">("play");
  const [star1, setStar1] = useState(0);
  const [drag, setDrag] = useState<{ p: number; x: number; y: number } | null>(null);
  const dragInfo = useRef<{ p: number; sx: number; sy: number; moved: boolean } | null>(null);

  // 모두 찾기
  const [set2, setSet2] = useState(ALL_SET);
  const [r2, setR2] = useState(0);
  const [found, setFound] = useState<number[]>([]);
  const [solved2, setSolved2] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [star2, setStar2] = useState(0);

  const q1 = set1[Math.min(r1, 4)];
  const q2 = set2[Math.min(r2, 4)];
  const bal = BALLOONS[r1 % BALLOONS.length];
  const pairs1 = useMemo(() => goldbachPairs(q1), [q1]);
  const pairs2 = useMemo(() => goldbachPairs(q2), [q2]);
  const pairsN = useMemo(() => goldbachPairs(n), [n]);

  const goMode = (t: Tab) => {
    setTab(t);
    if (t === "pair") setMsg({ t: "info", s: "풍선의 수를 소수 두 개의 합으로 만들어 줘요!" });
    if (t === "all") setMsg({ t: "info", s: "소수를 하나씩 눌러 보세요. 짝이 되는 수도 소수이면 찾은 거예요!" });
    if (t === "explore") setMsg({ t: "info", s: "짝수를 눌러 보면 두 소수의 합으로 나타내는 방법을 모두 보여 줘요." });
  };

  // --- 풍선 놀이 ---
  const place = (p: number, idx?: number) => {
    if (phase1 !== "play" || r1 >= 5) return;
    const cur = [...slots];
    let at = idx !== undefined && cur[idx] === null ? idx : cur.indexOf(null);
    if (at < 0) return;
    cur[at] = p;
    setSlots(cur);
    tick();
    if (cur[0] !== null && cur[1] !== null) {
      const sum = cur[0] + cur[1];
      if (sum === q1) {
        setPhase1("ok");
        cheer();
        if (wrong1 === 0) {
          setStar1((s) => s + 1);
          setMsg({ t: "ok", s: `팡! ⭐ ${cur[0]} + ${cur[1]} = ${q1}. 둘 다 소수예요. 잘했어요!` });
        } else setMsg({ t: "ok", s: `팡! ${cur[0]} + ${cur[1]} = ${q1}. 끝까지 해냈어요!` });
      } else {
        setPhase1("bad");
        oops();
        setWrong1((w) => w + 1);
        setMsg({ t: "bad", s: `${cur[0]} + ${cur[1]} = ${sum} 이에요. 목표는 ${q1} 이에요. 괜찮아요, 다시 해 봐요!` });
      }
    }
  };
  useEffect(() => {
    if (phase1 === "bad") {
      const id = setTimeout(() => {
        setSlots([null, null]);
        setPhase1("play");
      }, 1100);
      return () => clearTimeout(id);
    }
    if (phase1 === "ok") {
      const id = setTimeout(() => {
        const nr = r1 + 1;
        setR1(nr);
        setSlots([null, null]);
        setWrong1(0);
        setPhase1("play");
        setMsg(nr >= 5 ? { t: "ok", s: "5개를 모두 터뜨렸어요! 정말 잘했어요!" } : { t: "info", s: "새 풍선이 떴어요!" });
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [phase1, r1]);
  const restart1 = () => {
    setSet1(PAIR_SET());
    setR1(0);
    setStar1(0);
    setSlots([null, null]);
    setWrong1(0);
    setPhase1("play");
    setMsg({ t: "info", s: "처음부터 다시 해요!" });
  };
  const chipDown = (e: React.PointerEvent<HTMLButtonElement>, p: number) => {
    if (phase1 !== "play") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragInfo.current = { p, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const chipMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragInfo.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
    if (d.moved) setDrag({ p: d.p, x: e.clientX, y: e.clientY });
  };
  const chipUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragInfo.current;
    dragInfo.current = null;
    setDrag(null);
    if (!d) return;
    if (!d.moved) {
      place(d.p);
      return;
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-slot]");
    const idx = el ? Number(el.getAttribute("data-slot")) : undefined;
    if (idx !== undefined) place(d.p, idx);
  };

  // --- 모두 찾기 ---
  const tryP = (p: number) => {
    if (solved2 || r2 >= 5) return;
    const q = q2 - p;
    if (found.includes(Math.min(p, q))) {
      setMsg({ t: "info", s: `${Math.min(p, q)} + ${Math.max(p, q)} 는 이미 찾았어요.` });
      return;
    }
    tick();
    if (isPrime(q)) {
      const nf = [...found, Math.min(p, q)];
      setFound(nf);
      if (nf.length === pairs2.length) {
        setSolved2(true);
        cheer();
        setStar2((s) => s + 1);
        setMsg({ t: "ok", s: `⭐ 모두 찾았어요! ${q2} 은 ${pairs2.length}가지로 만들 수 있어요. 최고예요!` });
      } else setMsg({ t: "ok", s: `${Math.min(p, q)} + ${Math.max(p, q)} = ${q2} 찾았어요! (${nf.length} / ${pairs2.length}) 또 있을까요?` });
    } else {
      oops();
      setMsg({ t: "bad", s: `${q2} − ${p} = ${q} 은 소수가 아니에요. 괜찮아요, 다른 소수를 눌러 봐요!` });
    }
  };
  const giveUp = () => {
    setFound(pairs2.map(([p]) => p));
    setSolved2(true);
    setGaveUp(true);
    setMsg({ t: "info", s: `정답을 보여 줬어요. ${q2} 은 모두 ${pairs2.length}가지예요. 다음엔 꼭 찾아봐요!` });
  };
  const next2 = () => {
    setR2((r) => r + 1);
    setFound([]);
    setSolved2(false);
    setGaveUp(false);
    setMsg(r2 + 1 >= 5 ? { t: "ok", s: `5문제 끝! 별 ${star2}개예요. 정말 잘했어요!` } : { t: "info", s: "다음 문제예요!" });
  };
  const restart2 = () => {
    setSet2(ALL_SET());
    setR2(0);
    setStar2(0);
    setFound([]);
    setSolved2(false);
    setGaveUp(false);
    setMsg({ t: "info", s: "처음부터 다시 해요!" });
  };

  const gridNums = hard ? ALL_EVENS : EASY;
  const foundPairs = pairs2.filter(([p]) => found.includes(p));
  const gaveNote = gaveUp ? " (정답 보기)" : "";
  const chip = "min-h-[48px] min-w-[48px] rounded-card border px-2 text-lg font-bold tabular-nums";

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="font-bold">풍선의 수를 <span className="text-accent">소수</span> 두 개의 합으로 만들어요!</p>
        <p className="mt-1 text-base text-muted">소수는 1과 자기 자신으로만 나누어떨어지는 수예요. (2, 3, 5, 7, 11, 13… / 1은 소수가 아니에요)</p>
      </Board>

      {tab === "pair" && (
        <Board>
          <div className="mb-2 flex flex-wrap gap-2">
            <Stat label="풍선" value={`${Math.min(r1 + 1, 5)} / 5`} />
            <Stat label="별" value={stars(star1)} tone={star1 > 0 ? "ok" : "plain"} />
          </div>
          {r1 < 5 ? (
            <>
              <p className="font-game mb-2 text-center text-xl">👆 사탕(소수)을 눌러요 · 끌어서 □ 칸에 넣어도 돼요</p>
              <div className="relative mx-auto h-56 max-w-md overflow-hidden rounded-card border-4 border-sky-300" style={{ background: "linear-gradient(180deg, #bae6fd 0%, #e0f2fe 55%, #fbcfe8 100%)" }}>
                <div className="gz-float pointer-events-none absolute left-4 top-6 h-8 w-20 rounded-full bg-white/90" aria-hidden />
                <div className="gz-float pointer-events-none absolute left-9 top-3 h-9 w-10 rounded-full bg-white/90" aria-hidden />
                <div className="gz-float pointer-events-none absolute right-5 top-14 h-7 w-16 rounded-full bg-white/80" style={{ animationDelay: "1.2s" }} aria-hidden />
                <div className="pointer-events-none absolute -left-6 -right-6 bottom-[-40px] h-20 rounded-[50%] border-t-4 border-green-600" style={{ background: "linear-gradient(180deg, #86efac, #22c55e)" }} aria-hidden />
                <div className="absolute left-1/2 top-2 -translate-x-1/2">
                  <div key={`${r1}-${wrong1}`} className={phase1 === "bad" ? "am-shake" : "gz-float"}>
                    <div style={{ transition: "transform 0.35s ease, opacity 0.35s ease", transform: phase1 === "ok" ? "scale(1.5)" : "none", opacity: phase1 === "ok" ? 0 : 1 }}>
                      <svg viewBox="0 0 120 176" width="124" role="img" aria-label={`목표 풍선 ${q1}`}>
                        <defs>
                          <radialGradient id="gb-bal" cx="0.35" cy="0.3" r="0.85">
                            <stop offset="0" stopColor={bal[0]} />
                            <stop offset="1" stopColor={bal[1]} />
                          </radialGradient>
                        </defs>
                        <path d="M60 128 q -12 14 0 24 t 0 24" stroke="#6b6280" strokeWidth="2.5" fill="none" />
                        <ellipse cx="60" cy="64" rx="50" ry="58" fill="url(#gb-bal)" stroke={bal[2]} strokeWidth="4" />
                        <path d="M53 120 L67 120 L60 131 Z" fill={bal[1]} stroke={bal[2]} strokeWidth="3" strokeLinejoin="round" />
                        <ellipse cx="38" cy="38" rx="9" ry="16" fill="#fff" opacity="0.55" transform="rotate(-25 38 38)" />
                        <text x="60" y="80" textAnchor="middle" fontSize="46" fill="#fff" stroke={bal[2]} strokeWidth="6" paintOrder="stroke" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>
                          {q1}
                        </text>
                      </svg>
                    </div>
                  </div>
                </div>
                {phase1 === "ok" && (
                  <div className="pointer-events-none absolute left-1/2 top-[70px]" aria-hidden>
                    {SPARK.map(([dx, dy, c], k) => (
                      <span key={k} className="gz-pop absolute text-2xl" style={{ left: dx, top: dy, color: c, animationDelay: `${k * 25}ms` }}>
                        ✦
                      </span>
                    ))}
                    <span className="font-game gz-pop absolute -left-8 -top-4 whitespace-nowrap text-4xl text-white" style={{ WebkitTextStroke: `2px ${bal[2]}` }}>팡!</span>
                  </div>
                )}
              </div>
              <div className="my-3 flex items-center justify-center gap-2 text-3xl tabular-nums">
                {[0, 1].map((i) => (
                  <span key={i} className="contents">
                    {i === 1 && <span className="font-game text-accent">+</span>}
                    <button
                      type="button"
                      data-slot={i}
                      onClick={() => {
                        if (phase1 === "play" && slots[i] !== null) {
                          tick();
                          setSlots((s) => s.map((v, k) => (k === i ? null : v)));
                        }
                      }}
                      aria-label={slots[i] === null ? `${i + 1}번째 빈칸` : `${i + 1}번째 칸: ${slots[i]} (누르면 빼요)`}
                      className={`font-game flex h-16 w-20 items-center justify-center rounded-2xl border-4 ${slots[i] === null ? "border-dashed border-accent/40 bg-white text-accent/40" : phase1 === "bad" ? "am-shake" : "gz-pop"}`}
                      style={slots[i] === null ? undefined : candy(slots[i]!, phase1 === "bad")}
                    >
                      {slots[i] ?? "?"}
                    </button>
                  </span>
                ))}
                <span className="font-game text-accent">= {q1}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5" role="group" aria-label="소수 칩">
                {primesBelow(q1 - 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onPointerDown={(e) => chipDown(e, p)}
                    onPointerMove={chipMove}
                    onPointerUp={chipUp}
                    onPointerCancel={() => { dragInfo.current = null; setDrag(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); place(p); } }}
                    aria-label={`소수 ${p}`}
                    className="font-game relative min-h-[54px] min-w-[54px] select-none rounded-full border-[3px] px-3 text-2xl tabular-nums transition active:translate-y-1"
                    style={{ ...candy(p), touchAction: "none" }}
                  >
                    <span className="pointer-events-none absolute left-2.5 top-1.5 h-2.5 w-4 rotate-[-25deg] rounded-full bg-white/70" aria-hidden />
                    <span className="relative">{p}</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <GButton className={BIG} variant="soft" onClick={() => setMsg({ t: "info", s: `힌트: 소수 ${pairs1[0][0]} 를 하나로 써 보세요. 나머지 수도 소수예요!` })}>💡 힌트</GButton>
                <GButton className={BIG} onClick={() => { setSlots([null, null]); }}>비우기</GButton>
              </div>
            </>
          ) : (
            <div className="text-center">
              <p className="text-lg font-bold">풍선을 모두 터뜨렸어요! 별 {star1}개 {"⭐".repeat(star1)}</p>
              <GButton className={`${BIG} mt-2`} variant="primary" onClick={restart1}>다시 하기</GButton>
            </div>
          )}
          <div className="mt-3 [&_p]:!text-base">
            <Say tone={msg.t}>{msg.s}</Say>
          </div>
        </Board>
      )}
      {drag && (
        <div className="font-game pointer-events-none fixed z-[90] flex h-16 w-16 items-center justify-center rounded-full border-[3px] text-2xl" style={{ ...candy(drag.p), left: drag.x - 32, top: drag.y - 32, transform: "scale(1.1)" }}>
          {drag.p}
        </div>
      )}

      {tab === "all" && (
        <Board>
          <div className="mb-2 flex flex-wrap gap-2">
            <Stat label="문제" value={`${Math.min(r2 + 1, 5)} / 5`} />
            <Stat label="별" value={stars(star2)} tone={star2 > 0 ? "ok" : "plain"} />
            {r2 < 5 && <Stat label="찾은 것" value={`${found.length} / ${pairs2.length}`} tone={solved2 ? "ok" : "plain"} />}
          </div>
          {r2 < 5 ? (
            <>
              <p className="font-semibold">👇 {q2} 을 소수 두 개의 합으로 만드는 방법을 모두 찾아요. 소수를 하나 누르면 짝이 되는 수가 소수인지 알려 줘요.</p>
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="소수 목록">
                {primesBelow(q2 - 1).map((p) => (
                  <button key={p} type="button" onClick={() => tryP(p)} disabled={solved2} className={`${chip} ${found.includes(Math.min(p, q2 - p)) && isPrime(q2 - p) ? "border-ok bg-ok-soft text-ok" : "border-line bg-surface hover:bg-bg"} disabled:opacity-70`}>
                    {p}
                  </button>
                ))}
              </div>
              {foundPairs.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 font-bold">찾은 방법{gaveNote}</p>
                  <PairBars n={q2} pairs={foundPairs} />
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {!solved2 && <GButton className={BIG} onClick={giveUp}>정답 보기</GButton>}
                {solved2 && <GButton className={BIG} variant="primary" onClick={next2}>{r2 === 4 ? "결과 보기" : "다음 문제 ▶"}</GButton>}
              </div>
            </>
          ) : (
            <div>
              <p className="text-lg font-bold">모두 풀었어요! 별 {star2}개 {"⭐".repeat(star2)}</p>
              <GButton className={`${BIG} mt-2`} variant="primary" onClick={restart2}>다시 하기</GButton>
            </div>
          )}
          <div className="mt-3 [&_p]:!text-base">
            <Say tone={msg.t}>{msg.s}</Say>
          </div>
        </Board>
      )}

      {tab === "explore" && (
        <>
          <Board>
            <p className="mb-2 font-semibold">👇 짝수를 눌러 보세요{hard ? " (4부터 200까지)" : " (4부터 30까지)"}</p>
            <div role="group" aria-label="짝수 숫자판" className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))" }}>
              {gridNums.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={e === n}
                  aria-label={`${e}, 쌍 ${goldbachPairs(e).length}개`}
                  onClick={() => {
                    setN(e);
                    setMsg({ t: "info", s: `${e} = ${goldbachPairs(e).map(([p, q]) => `${p}+${q}`).join(", ")}` });
                  }}
                  className={`flex min-h-[48px] flex-col items-center justify-center rounded-card border text-base font-bold tabular-nums ${e === n ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:bg-bg"}`}
                >
                  {e}
                  {hard && <span className="text-xs font-semibold opacity-70">{goldbachPairs(e).length}가지</span>}
                </button>
              ))}
            </div>
            <div className="mt-3 [&_p]:!text-base">
              <Say tone={msg.t}>{msg.s}</Say>
            </div>
          </Board>
          <Board>
            <h3 className="mb-2 font-bold">
              {n} = 소수 + 소수 ({pairsN.length}가지)
            </h3>
            <PairBars n={n} pairs={pairsN} />
            <p className="mt-2 text-base text-muted">파랑 + 주황을 이으면 {n} 이 돼요.</p>
            <p className="mt-2 rounded-card bg-bg p-2 text-base">
              혹시 두 소수의 합으로 안 되는 짝수가 있을까요? 수학자들은 “4보다 큰 짝수는 모두 된다”고 생각해요. 컴퓨터로 아주 큰 수까지 확인했지만, 왜 항상 되는지는 아직 아무도 증명하지 못했어요.
            </p>
          </Board>
          <Board>
            <GButton className={BIG} pressed={hard} onClick={() => { if (hard && n > 30) setN(12); setHard((h) => !h); }}>🔥 더 어려운 도전 {hard ? "닫기" : "열기"}</GButton>
            {hard && (
              <div className="mt-3">
                <h3 className="font-bold">짝수마다 만드는 방법이 몇 가지일까요?</h3>
                <p className="mb-2 text-base text-muted">막대를 누르면 그 짝수로 가요. 4부터 200까지, 가장 많은 짝수는 {MAX_N} ({MAX_C}가지)예요.</p>
                <svg viewBox="0 0 600 156" width="100%" role="group" aria-label="4부터 200까지 짝수의 소수 쌍 개수 막대 그래프" className="block w-full rounded-card bg-bg">
                  {ALL_EVENS.map((e, i) => {
                    const bw = 570 / ALL_EVENS.length;
                    const h = (COUNTS[i] / MAX_C) * 120;
                    return (
                      <g key={e} onClick={() => setN(e)} style={{ cursor: "pointer" }}>
                        <rect x={20 + i * bw} y={4} width={bw} height={120} fill="transparent" />
                        <rect x={20 + i * bw + 0.5} y={124 - h} width={Math.max(1, bw - 1)} height={h} fill={e === n ? "#ef4444" : "#38bdf8"} />
                      </g>
                    );
                  })}
                  <line x1={20} y1={124} x2={590} y2={124} stroke="#94a3b8" />
                  {[4, 50, 100, 150, 200].map((v) => (
                    <text key={v} x={20 + ((v - 4) / 2) * (570 / ALL_EVENS.length) + 3} y={146} textAnchor="middle" fontSize={16} fill="#64748b">
                      {v}
                    </text>
                  ))}
                </svg>
                <div className="mt-2 flex flex-wrap gap-2">
                  <GButton variant="soft" className={BIG} onClick={() => setN(MIN_N)}>가장 적은 짝수 ({MIN_N}, {MIN_C}가지)</GButton>
                  <GButton variant="soft" className={BIG} onClick={() => setN(MAX_N)}>가장 많은 짝수 ({MAX_N}, {MAX_C}가지)</GButton>
                </div>
              </div>
            )}
          </Board>
        </>
      )}
      <Board>
        <GButton className={BIG} pressed={more} onClick={() => setMore((m) => !m)}>🔥 더 어려운 도전 {more ? "닫기" : "열기"}</GButton>
        {more && (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="다른 놀이">
            <GButton className={BIG} pressed={tab === "pair"} onClick={() => goMode("pair")}>🎈 풍선 터뜨리기</GButton>
            <GButton className={BIG} pressed={tab === "all"} onClick={() => goMode("all")}>모두 찾기</GButton>
            <GButton className={BIG} pressed={tab === "explore"} onClick={() => goMode("explore")}>짝수 탐험 (4~200)</GButton>
          </div>
        )}
      </Board>
    </div>
  );
}
