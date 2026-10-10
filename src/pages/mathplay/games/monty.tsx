import { useEffect, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, stageClear, tick, useStage } from "./kit";

// <pure>
/** 한 판: n 개의 문, 선택한 문 pick. 진행자는 고른 문과 (자동차 문 또는 임의의 염소 문) 하나만 남기고 모두 연다. 남은 다른 문 번호를 돌려준다. */
function keepDoor(n: number, car: number, pick: number, rnd: () => number): number {
  if (car !== pick) return car;
  const others: number[] = [];
  for (let i = 0; i < n; i++) if (i !== pick) others.push(i);
  return others[Math.floor(rnd() * others.length)];
}
/** 전략대로 한 판을 해서 이기면 true */
function playOnce(n: number, swap: boolean, rnd: () => number): boolean {
  const car = Math.floor(rnd() * n);
  const pick = Math.floor(rnd() * n);
  const keep = keepDoor(n, car, pick, rnd);
  const final = swap ? keep : pick;
  return final === car;
}
function simulate(n: number, swap: boolean, trials: number, rnd: () => number): number {
  let w = 0;
  for (let i = 0; i < trials; i++) if (playOnce(n, swap, rnd)) w++;
  return w;
}
// </pure>

type Rec = { w: number; t: number };
const pct100 = (r: Rec) => Math.round((100 * r.w) / Math.max(1, r.t));

// <pure>
type Kind = "play" | "sim" | "swap" | "stay";
const LEVEL_DOORS = [3, 3, 3, 4, 4, 5, 5, 6, 10, 100];
const LEVEL_ROUNDS: Kind[][] = [
  ["play", "play", "sim"],
  ["play", "sim", "swap"],
  ["play", "stay", "sim"],
  ["play", "sim", "swap"],
  ["play", "stay", "swap"],
  ["play", "sim", "swap"],
  ["play", "swap", "stay"],
  ["play", "sim", "swap"],
  ["play", "swap", "stay"],
  ["play", "sim", "swap"],
];
function makePlan(level: number) {
  const L = Math.min(10, Math.max(1, level));
  return { n: LEVEL_DOORS[L - 1], rounds: LEVEL_ROUNDS[L - 1] };
}
/** 문이 n개, 진행자가 염소 문을 n−2개 열 때 100번 중 이기는 횟수(이론) */
const swapPer100 = (n: number) => Math.round((100 * (n - 1)) / n);
const stayPer100 = (n: number) => Math.round(100 / n);
function quizChoices(kind: "swap" | "stay", n: number): { answer: number; choices: number[] } {
  const a = swapPer100(n);
  const b = stayPer100(n);
  const answer = kind === "swap" ? a : b;
  return { answer, choices: [a, b, 50].sort((x, y) => x - y) };
}
/** 실험 결과로 어느 쪽이 더 많이 이겼는지 */
const simWinner = (sw: Rec, st: Rec): "swap" | "stay" | "tie" => (sw.w > st.w ? "swap" : sw.w < st.w ? "stay" : "tie");
// </pure>

type Round = { car: number; pick: number | null; keep: number | null; final: number | null };
const newRound = (n: number): Round => ({ car: rand(n), pick: null, keep: null, final: null });
const BIG = "!min-h-[48px] !text-base";
const COLS: Record<number, string> = { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };

const DOOR_COLORS: [string, string, string][] = [
  ["#f9a8d4", "#ec4899", "#9d174d"],
  ["#7dd3fc", "#0ea5e9", "#075985"],
  ["#86efac", "#22c55e", "#166534"],
  ["#fdba74", "#f97316", "#9a3412"],
  ["#c4b5fd", "#8b5cf6", "#5b21b6"],
];

/** 귀여운 자동차 그림 */
function CarPic() {
  return (
    <svg viewBox="0 0 100 64" className="w-[78%] max-w-[110px]" aria-hidden>
      <ellipse cx="50" cy="60" rx="40" ry="4" fill="#92400e" opacity="0.25" />
      <path d="M14 44 Q14 30 28 28 L36 16 Q40 11 48 11 L62 11 Q70 11 74 18 L80 28 Q92 30 92 42 L92 48 L14 48 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="3" strokeLinejoin="round" />
      <path d="M38 27 L43 17 Q45 15 48 15 L54 15 L54 27 Z" fill="#bae6fd" stroke="#991b1b" strokeWidth="2" />
      <path d="M58 27 L58 15 L63 15 Q67 15 69 18 L74 27 Z" fill="#bae6fd" stroke="#991b1b" strokeWidth="2" />
      <circle cx="86" cy="38" r="3.5" fill="#fef08a" stroke="#991b1b" strokeWidth="1.5" />
      <path d="M78 42 Q82 45 86 42" stroke="#991b1b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="49" r="9" fill="#312e81" stroke="#1e1b4b" strokeWidth="2" />
      <circle cx="32" cy="49" r="3.5" fill="#e0e7ff" />
      <circle cx="74" cy="49" r="9" fill="#312e81" stroke="#1e1b4b" strokeWidth="2" />
      <circle cx="74" cy="49" r="3.5" fill="#e0e7ff" />
      <path d="M44 6 l2 4 4 1 -4 1 -2 4 -2 -4 -4 -1 4 -1 Z" fill="#fde047" />
    </svg>
  );
}

/** 귀여운 염소 그림 */
function GoatPic() {
  return (
    <svg viewBox="0 0 100 80" className="w-[70%] max-w-[100px]" aria-hidden>
      <path d="M34 22 Q26 6 16 10" stroke="#a16207" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M66 22 Q74 6 84 10" stroke="#a16207" strokeWidth="6" fill="none" strokeLinecap="round" />
      <ellipse cx="20" cy="34" rx="12" ry="6" fill="#f5f5f4" stroke="#57534e" strokeWidth="2.5" transform="rotate(-20 20 34)" />
      <ellipse cx="80" cy="34" rx="12" ry="6" fill="#f5f5f4" stroke="#57534e" strokeWidth="2.5" transform="rotate(20 80 34)" />
      <path d="M30 30 Q30 18 50 18 Q70 18 70 30 L66 58 Q50 70 34 58 Z" fill="#fafaf9" stroke="#57534e" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="41" cy="36" r="4" fill="#292524" />
      <circle cx="59" cy="36" r="4" fill="#292524" />
      <circle cx="42.3" cy="34.6" r="1.3" fill="#fff" />
      <circle cx="60.3" cy="34.6" r="1.3" fill="#fff" />
      <ellipse cx="36" cy="46" rx="4" ry="2.5" fill="#fda4af" />
      <ellipse cx="64" cy="46" rx="4" ry="2.5" fill="#fda4af" />
      <ellipse cx="50" cy="52" rx="8" ry="5" fill="#fecdd3" stroke="#57534e" strokeWidth="2" />
      <path d="M46 56 Q50 59 54 56" stroke="#57534e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M46 64 Q50 76 54 64" fill="#e7e5e4" stroke="#57534e" strokeWidth="2" />
    </svg>
  );
}

export default function MontyGame() {
  const level = useStage();
  const [plan] = useState(() => makePlan(level));
  const n = plan.n;
  const [ri, setRi] = useState(0);
  const kind = plan.rounds[ri];
  const [done, setDone] = useState(false);
  const [round, setRound] = useState<Round>(() => newRound(n));
  const [stats, setStats] = useState<{ swap: Rec; stay: Rec }>({ swap: { w: 0, t: 0 }, stay: { w: 0, t: 0 } });
  const [sim, setSim] = useState<{ swap: Rec | null; stay: Rec | null }>({ swap: null, stay: null });
  const [wrong, setWrong] = useState<string[]>([]);
  const [stars, setStars] = useState(0);
  const [fx, setFx] = useState<{ k: number; t: "ok" | "bad" | "" }>({ k: 0, t: "" });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: `문 ${n}개 뒤 하나에 자동차가 숨어 있어요. 마음에 드는 문을 눌러 보세요!` });

  const phase = round.pick === null ? "pick" : round.final === null ? "switch" : "result";
  const addStat = (key: "swap" | "stay", w: number, t: number) => setStats((s) => ({ ...s, [key]: { w: s[key].w + w, t: s[key].t + t } }));
  const good = (text: string, star = true) => {
    cheer();
    setFx((f) => ({ k: f.k + 1, t: "ok" }));
    if (star) setStars((s) => s + 1);
    setMsg({ t: "ok", s: text });
    setDone(true);
  };
  const bad = (text: string) => {
    oops();
    setFx((f) => ({ k: f.k + 1, t: "bad" }));
    setMsg({ t: "bad", s: text });
  };

  // 라운드를 깨면 다음 라운드로, 마지막이면 레벨 클리어
  useEffect(() => {
    if (!done) return;
    if (ri >= plan.rounds.length - 1) {
      const id = setTimeout(stageClear, 1200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      const nr = ri + 1;
      const nk = plan.rounds[nr];
      setRi(nr);
      setDone(false);
      setWrong([]);
      setRound(newRound(n));
      setSim({ swap: null, stay: null });
      setMsg({
        t: "info",
        s: nk === "play" ? "새 판이에요. 문 하나를 골라 보세요." : nk === "sim" ? "컴퓨터에게 ‘항상 바꾸기’와 ‘항상 그대로’를 100번씩 시켜 봐요!" : "이번엔 생각해서 맞히는 문제예요. 아래 기록을 봐도 돼요!",
      });
    }, kind === "play" ? 2600 : 1600);
    return () => clearTimeout(id);
  }, [done, ri, plan, n, kind]);

  const pick = (i: number) => {
    if (kind !== "play" || done) return;
    if (phase === "pick") {
      tick();
      const keep = keepDoor(n, round.car, i, Math.random);
      setRound({ ...round, pick: i, keep });
      setMsg({ t: "info", s: `${i + 1}번 문을 골랐어요. 진행자가 염소 문을 ${n - 2 === 1 ? "하나" : `${n - 2}개`} 열어 줬어요. 내 문을 다시 누르면 그대로, 남은 ${(keep ?? 0) + 1}번 문을 누르면 바꾸기예요!` });
    } else if (phase === "switch") {
      if (i === round.pick) decide(false);
      else if (i === round.keep) decide(true);
    }
  };
  const decide = (swap: boolean) => {
    if (round.pick === null || round.keep === null) return;
    const final = swap ? round.keep : round.pick;
    const win = final === round.car;
    setRound({ ...round, final });
    addStat(swap ? "swap" : "stay", win ? 1 : 0, 1);
    if (win) good(`⭐ ${swap ? "바꿔서" : "그대로 둬서"} 자동차를 찾았어요! 잘했어요!`);
    else {
      oops();
      setFx((f) => ({ k: f.k + 1, t: "bad" }));
      setMsg({ t: "bad", s: `아쉬워요, 자동차는 ${round.car + 1}번 문에 있었어요. 그래도 한 판 해 봤으니 다음 라운드로 가요!` });
      setDone(true);
    }
  };
  const runSim = (swap: boolean) => {
    const w = simulate(n, swap, 100, Math.random);
    const r = { w, t: 100 };
    tick();
    addStat(swap ? "swap" : "stay", w, 100);
    setSim((s) => ({ ...s, [swap ? "swap" : "stay"]: r }));
    setMsg({ t: "info", s: `${swap ? "항상 바꾸기" : "항상 그대로"} 100번: ${w}번 이겼어요!` });
  };
  const answerSim = (a: "swap" | "stay" | "tie") => {
    if (!sim.swap || !sim.stay || done || wrong.includes(a)) return;
    if (a === simWinner(sim.swap, sim.stay)) good(a === "swap" ? `맞아요! ⭐ 바꿀 때 ${sim.swap.w}번, 그대로일 때 ${sim.stay.w}번. 바꾸는 쪽이 훨씬 많이 이겨요!` : "맞아요! ⭐ 결과를 잘 읽었어요.", wrong.length === 0);
    else {
      setWrong((w) => [...w, a]);
      bad("아쉬워요. 두 수를 다시 비교해 봐요!");
    }
  };
  const quiz = kind === "swap" || kind === "stay" ? quizChoices(kind, n) : null;
  const answerQuiz = (v: number) => {
    if (!quiz || done || wrong.includes(String(v))) return;
    if (v === quiz.answer)
      good(
        kind === "swap"
          ? `맞아요! ⭐ 처음에 고른 문이 꽝일 때가 100번 중 약 ${quiz.answer}번이에요. 그때 바꾸면 자동차를 얻어요.`
          : `맞아요! ⭐ 처음 고른 문이 자동차일 때만 이겨요. 문이 ${n}개라 100번 중 약 ${quiz.answer}번이에요.`,
        wrong.length === 0,
      );
    else {
      setWrong((w) => [...w, String(v)]);
      bad(kind === "swap" ? `아쉬워요. 힌트: 처음 고른 문이 자동차일 가능성은 ${n}개 중 1개뿐이에요.` : `아쉬워요. 힌트: 그대로 있으면 처음 고른 문이 자동차여야 해요. ${n}개 중 1개예요.`);
    }
  };

  const doorState = (i: number) => ({ open: phase === "result" || (round.keep !== null && i !== round.pick && i !== round.keep), isCar: i === round.car });

  const renderDoor = (i: number) => {
    const { open, isCar } = doorState(i);
    const picked = round.pick === i;
    const keepIt = round.keep === i && phase === "switch";
    const small = n > 10;
    const mid = n > 5;
    const clickable = phase === "pick" || (phase === "switch" && (picked || keepIt));
    const label = `${i + 1}번 문${picked ? " (내가 고른 문, 누르면 그대로)" : keepIt ? " (누르면 바꾸기)" : ""}${open ? (isCar ? " 자동차" : " 염소") : ""}`;
    const [lt, base, dk] = DOOR_COLORS[i % DOOR_COLORS.length];
    if (small) {
      return (
        <button
          key={i}
          type="button"
          disabled={!clickable}
          onClick={() => pick(i)}
          aria-label={label}
          className={`font-game flex h-10 w-full items-center justify-center whitespace-nowrap rounded-t-lg border-2 text-[13px] leading-none tracking-tighter transition disabled:cursor-default ${picked ? "ring-4 ring-white" : ""} ${keepIt ? "ring-4 ring-amber-300" : ""}`}
          style={open ? { background: isCar ? "#fef08a" : "#e0f2fe", borderColor: isCar ? "#ca8a04" : "#7dd3fc", color: "#1e1b4b" } : { background: `linear-gradient(180deg, ${lt}, ${base})`, borderColor: dk, color: "#fff", textShadow: `0 1px 0 ${dk}` }}
        >
          {open ? (isCar ? "🚗" : "🐐") : i + 1}
        </button>
      );
    }
    return (
      <div key={i} className={`relative ${mid ? "h-28" : n > 3 ? "h-40" : "h-44"}`}>
        <div
          className="absolute inset-0 flex flex-col items-center justify-end overflow-hidden rounded-t-[36px] border-4 pb-2"
          style={open ? { background: isCar ? "radial-gradient(circle at 50% 40%, #fff7c2, #fbbf24)" : "radial-gradient(circle at 50% 40%, #ecfeff, #a5f3fc)", borderColor: isCar ? "#d97706" : "#0891b2" } : { background: "#1e1b4b", borderColor: "#1e1b4b" }}
        >
          {open && (
            <>
              {isCar ? <CarPic /> : <GoatPic />}
              {!mid && <span className="font-game text-lg" style={{ color: isCar ? "#92400e" : "#155e75" }}>{isCar ? "자동차 당첨!" : "염소 (꽝)"}</span>}
              {isCar && phase === "result" && (
                <span className="gz-pop pointer-events-none absolute left-2 top-2 text-2xl" aria-hidden>✨</span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          disabled={!clickable}
          onClick={() => pick(i)}
          aria-label={label}
          className={`absolute inset-0 flex flex-col items-center justify-center rounded-t-[36px] border-4 disabled:cursor-default ${picked ? "ring-4 ring-white" : ""} ${keepIt ? "ring-4 ring-amber-300" : ""}`}
          style={{ background: `linear-gradient(180deg, ${lt} 0%, ${base} 100%)`, borderColor: dk, boxShadow: `inset 0 -8px 0 ${dk}33, 0 6px 0 ${dk}`, transformOrigin: "left center", transform: open ? "perspective(600px) rotateY(-105deg)" : "none", transition: "transform 0.7s ease", backfaceVisibility: "hidden", pointerEvents: open ? "none" : undefined }}
        >
          {!mid && <span className="pointer-events-none absolute inset-x-3 top-4 h-12 rounded-t-[22px] border-2 border-white/50" aria-hidden />}
          {!mid && <span className="pointer-events-none absolute inset-x-3 bottom-4 h-12 rounded-md border-2 border-white/50" aria-hidden />}
          <span className={`font-game relative flex items-center justify-center rounded-full border-4 bg-white ${mid ? "h-10 w-10 text-xl" : "h-14 w-14 text-3xl"}`} style={{ borderColor: dk, color: dk }}>
            {i + 1}
          </span>
          <span className="absolute right-2.5 top-1/2 h-4 w-4 rounded-full border-2 border-amber-700" style={{ background: "radial-gradient(circle at 35% 35%, #fff7ad, #f59e0b)" }} aria-hidden />
        </button>
        {picked && <span className="font-game pointer-events-none absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-accent px-2.5 text-base text-accent-ink shadow">{mid ? "내 문" : "내 문 (그대로)"}</span>}
        {keepIt && <span className="font-game pointer-events-none absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-amber-300 px-2.5 text-base text-amber-950 shadow">바꾸기</span>}
      </div>
    );
  };

  const title = kind === "play" ? (phase === "pick" ? "👆 마음에 드는 문을 눌러요" : phase === "switch" ? "👆 내 문을 다시 누르면 ‘그대로’, 다른 닫힌 문을 누르면 ‘바꾸기’!" : "결과예요!") : kind === "sim" ? "🤖 컴퓨터 실험: 어느 쪽이 더 많이 이길까요?" : "🤔 생각해서 맞혀요";

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="font-game mb-2 text-xl">{title}</p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label={`레벨 ${level} · 라운드`} value={`${ri + 1} / ${plan.rounds.length}`} />
          <Stat label="문" value={`${n}개`} />
          <Stat label="별" value={stars > 0 ? "⭐".repeat(stars) : "0"} tone={stars > 0 ? "ok" : "plain"} />
        </div>
        {kind === "play" && (
          <div key={fx.k} className={fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}>
            <div className="relative overflow-hidden rounded-card border-4 border-[#4c1d95] px-3 pb-6 pt-12 sm:px-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #7c3aed 0%, #3b0764 70%)" }}>
              <div className="pointer-events-none absolute inset-x-0 top-0 h-9" style={{ background: "radial-gradient(circle at 50% 0%, #ef4444 62%, #991b1b 63%, transparent 66%) 0 0 / 44px 36px repeat-x" }} aria-hidden />
              <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-3 sm:w-5" style={{ background: "linear-gradient(90deg, #991b1b, #ef4444)" }} aria-hidden />
              <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-3 sm:w-5" style={{ background: "linear-gradient(270deg, #991b1b, #ef4444)" }} aria-hidden />
              <div className="pointer-events-none absolute -top-6 left-[12%] h-56 w-28 -rotate-12 opacity-40" style={{ background: "linear-gradient(180deg, #fef9c3, transparent)", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }} aria-hidden />
              <div className="pointer-events-none absolute -top-6 right-[12%] h-56 w-28 rotate-12 opacity-40" style={{ background: "linear-gradient(180deg, #fef9c3, transparent)", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }} aria-hidden />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6" style={{ background: "repeating-linear-gradient(90deg, #b45309 0 28px, #92400e 28px 30px)" }} aria-hidden />
              <div role="group" aria-label="문들" className={`relative grid ${n <= 5 ? `${COLS[n]} gap-3 sm:gap-5` : n <= 10 ? "grid-cols-5 gap-x-2 gap-y-6" : "grid-cols-10 gap-1"}`}>
                {Array.from({ length: n }, (_, i) => renderDoor(i))}
              </div>
            </div>
          </div>
        )}
        {kind === "sim" && (
          <div key={fx.k} className={`rounded-card border-4 border-[#4c1d95] p-3 ${fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}`} style={{ background: "linear-gradient(180deg, #ede9fe, #fdf4ff)" }}>
            <p className="font-game text-lg">문이 {n}개예요. 두 단추를 모두 눌러 컴퓨터에게 100번씩 시켜 봐요.</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["swap", "stay"] as const).map((k) => (
                <div key={k} className="rounded-2xl bg-white p-2 text-center shadow-[0_3px_0_rgba(76,29,149,0.15)]">
                  <GButton className={`${BIG} w-full`} variant={k === "swap" ? "primary" : "soft"} disabled={sim[k] !== null} onClick={() => runSim(k === "swap")}>
                    {k === "swap" ? "🔁 항상 바꾸기 100번" : "✋ 항상 그대로 100번"}
                  </GButton>
                  <p className="font-game mt-2 text-3xl" style={{ color: k === "swap" ? "#16a34a" : "#e11d48" }}>{sim[k] ? `${sim[k]!.w}번 이김` : "?"}</p>
                </div>
              ))}
            </div>
            {sim.swap && sim.stay && (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="답 고르기">
                {([
                  ["swap", "바꾸기가 더 많이 이겼어요"],
                  ["stay", "그대로가 더 많이 이겼어요"],
                  ["tie", "똑같아요"],
                ] as const).map(([k, t]) => (
                  <GButton key={k} className={BIG} disabled={wrong.includes(k) || done} onClick={() => answerSim(k)}>
                    {t}
                  </GButton>
                ))}
              </div>
            )}
          </div>
        )}
        {quiz && (
          <div key={fx.k} className={`rounded-card border-4 border-[#4c1d95] p-3 ${fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}`} style={{ background: "linear-gradient(180deg, #ede9fe, #fdf4ff)" }}>
            <p className="font-game text-xl">
              문이 {n}개예요. 하나를 고르면 진행자가 염소 문을 {n - 2 === 1 ? "하나" : `${n - 2}개`} 열어 줘요. {kind === "swap" ? "항상 바꾸면" : "항상 그대로 있으면"} 100번 중 약 몇 번 이길까요?
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="답 고르기">
              {quiz.choices.map((v) => (
                <GButton key={v} className={`${BIG} !text-xl`} variant={done && v === quiz.answer ? "primary" : "ghost"} disabled={wrong.includes(String(v)) || (done && v !== quiz.answer)} onClick={() => answerQuiz(v)}>
                  {v}번
                </GButton>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
      </Board>

      <Board>
        <h3 className="font-game text-lg">📒 이번 레벨 기록 (문 {n}개)</h3>
        <div className="mt-2 space-y-2">
          {[
            { k: "바꿨을 때", r: stats.swap, c: "bg-ok" },
            { k: "그대로 있었을 때", r: stats.stay, c: "bg-bad" },
          ].map((x) => (
            <div key={x.k}>
              <p className="font-bold">
                {x.k}: {x.r.t === 0 ? "아직 안 했어요" : `${x.r.t}번 중 ${x.r.w}번 이겼어요 (100번 중 약 ${pct100(x.r)}번)`}
              </p>
              <div className="h-4 rounded-full bg-bg" aria-hidden>
                <div className={`h-4 rounded-full ${x.c} opacity-70 transition-all`} style={{ width: `${x.r.t ? (100 * x.r.w) / x.r.t : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Board>
    </div>
  );
}
