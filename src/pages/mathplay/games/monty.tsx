import { useEffect, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, tick } from "./kit";

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
type Stats = { swap: Rec; stay: Rec };
const empty = (): Stats => ({ swap: { w: 0, t: 0 }, stay: { w: 0, t: 0 } });
const outOf10 = (r: Rec) => (r.t === 0 ? "-" : `약 ${Math.round((10 * r.w) / r.t)}번`);

type Round = { car: number; pick: number | null; keep: number | null; final: number | null };
const newRound = (n: number): Round => ({ car: rand(n), pick: null, keep: null, final: null });
const BIG = "!min-h-[48px] !text-base";

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
  const [n, setN] = useState(3);
  const [hard, setHard] = useState(false);
  const [round, setRound] = useState<Round>(() => newRound(3));
  const [stats, setStats] = useState<{ 3: Stats; 100: Stats }>({ 3: empty(), 100: empty() });
  const [played, setPlayed] = useState(0);
  const [stars, setStars] = useState(0);
  const [fx, setFx] = useState<{ k: number; t: "ok" | "bad" | "" }>({ k: 0, t: "" });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "문 뒤에 자동차가 하나 숨어 있어요. 마음에 드는 문을 눌러 보세요!" });

  const st = stats[n as 3 | 100];
  const phase = round.pick === null ? "pick" : round.final === null ? "switch" : "result";

  const addStat = (key: "swap" | "stay", w: number, t: number) =>
    setStats((s) => {
      const cur = s[n as 3 | 100];
      return { ...s, [n]: { ...cur, [key]: { w: cur[key].w + w, t: cur[key].t + t } } };
    });

  const pick = (i: number) => {
    if (phase === "pick") {
      tick();
      const keep = keepDoor(n, round.car, i, Math.random);
      setRound({ ...round, pick: i, keep });
      setMsg({
        t: "info",
        s: n === 3 ? `${i + 1}번 문을 골랐어요. 진행자가 염소 문을 하나 열어 줬어요. 내 문을 다시 누르면 그대로, 다른 닫힌 문을 누르면 바꾸기예요!` : `${i + 1}번 문을 골랐어요. 진행자가 염소 문 98개를 열어 줬어요. 내 문(${i + 1}번)을 다시 누르면 그대로, 남은 ${(keep ?? 0) + 1}번 문을 누르면 바꾸기예요!`,
      });
    } else if (phase === "switch") {
      if (i === round.pick) decide(false);
      else if (i === round.keep) decide(true);
    }
  };
  const decide = (swap: boolean) => {
    if (round.pick === null || round.keep === null) return;
    const final = swap ? round.keep : round.pick;
    const win = final === round.car;
    const np = played + 1;
    setRound({ ...round, final });
    setPlayed(np);
    if (win) {
      setStars((s) => s + 1);
      cheer();
      setFx((f) => ({ k: f.k + 1, t: "ok" }));
    } else {
      oops();
      setFx((f) => ({ k: f.k + 1, t: "bad" }));
    }
    addStat(swap ? "swap" : "stay", win ? 1 : 0, 1);
    const tail = np >= 5 ? " 5판이 끝났어요! 아래에서 컴퓨터가 100번 해 주는 것도 봐요." : "";
    setMsg(win ? { t: "ok", s: `⭐ ${swap ? "바꿔서" : "그대로 둬서"} 자동차를 찾았어요! 잘했어요!${tail}` } : { t: "bad", s: `아쉬워요. 자동차는 ${round.car + 1}번 문에 있었어요. 괜찮아요, 다음 판에서 또 해 봐요!${tail}` });
  };
  const again = () => {
    if (played >= 5) {
      setPlayed(0);
      setStars(0);
    }
    setRound(newRound(n));
    setMsg({ t: "info", s: "새 판이에요. 문 하나를 골라 보세요." });
  };
  const changeN = (m: number) => {
    setN(m);
    setRound(newRound(m));
    setMsg({ t: "info", s: m === 3 ? "문 3개로 돌아왔어요." : "문이 100개예요! 하나를 고르면 진행자가 염소 문 98개를 열어 줘요." });
  };
  const auto = (swap: boolean, times: number) => {
    const w = simulate(n, swap, times, Math.random);
    addStat(swap ? "swap" : "stay", w, times);
    setMsg({ t: "info", s: `${swap ? "항상 바꾸기" : "항상 그대로"} ${times}번을 해 보니 ${w}번 이겼어요. (10번 중 약 ${Math.round((10 * w) / times)}번)` });
  };
  const resetStats = () => {
    setStats((s) => ({ ...s, [n]: empty() }));
    setMsg({ t: "info", s: "기록을 지웠어요." });
  };
  const toggleHard = () => {
    if (hard) {
      setHard(false);
      if (n !== 3) changeN(3);
    } else setHard(true);
  };

  useEffect(() => {
    if (phase !== "result" || played >= 5) return;
    const id = setTimeout(() => again(), 3000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, played, round.car]);

  const doorState = (i: number) => ({ open: phase === "result" || (round.keep !== null && i !== round.pick && i !== round.keep), isCar: i === round.car });

  const renderDoor = (i: number) => {
    const { open, isCar } = doorState(i);
    const picked = round.pick === i;
    const keepIt = round.keep === i && phase === "switch";
    const small = n > 3;
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
          className={`font-game flex h-10 w-full items-center justify-center rounded-t-lg border-2 text-sm transition disabled:cursor-default ${picked ? "ring-4 ring-white" : ""} ${keepIt ? "ring-4 ring-amber-300" : ""}`}
          style={open ? { background: isCar ? "#fef08a" : "#e0f2fe", borderColor: isCar ? "#ca8a04" : "#7dd3fc", color: "#1e1b4b" } : { background: `linear-gradient(180deg, ${lt}, ${base})`, borderColor: dk, color: "#fff", textShadow: `0 1px 0 ${dk}` }}
        >
          {open ? (isCar ? "🚗" : "🐐") : i + 1}
        </button>
      );
    }
    return (
      <div key={i} className="relative h-44">
        <div
          className="absolute inset-0 flex flex-col items-center justify-end overflow-hidden rounded-t-[36px] border-4 pb-2"
          style={open ? { background: isCar ? "radial-gradient(circle at 50% 40%, #fff7c2, #fbbf24)" : "radial-gradient(circle at 50% 40%, #ecfeff, #a5f3fc)", borderColor: isCar ? "#d97706" : "#0891b2" } : { background: "#1e1b4b", borderColor: "#1e1b4b" }}
        >
          {open && (
            <>
              {isCar ? <CarPic /> : <GoatPic />}
              <span className="font-game text-lg" style={{ color: isCar ? "#92400e" : "#155e75" }}>{isCar ? "자동차 당첨!" : "염소 (꽝)"}</span>
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
          <span className="pointer-events-none absolute inset-x-3 top-4 h-12 rounded-t-[22px] border-2 border-white/50" aria-hidden />
          <span className="pointer-events-none absolute inset-x-3 bottom-4 h-12 rounded-md border-2 border-white/50" aria-hidden />
          <span className="font-game relative flex h-14 w-14 items-center justify-center rounded-full border-4 bg-white text-3xl" style={{ borderColor: dk, color: dk }}>
            {i + 1}
          </span>
          <span className="absolute right-2.5 top-1/2 h-4 w-4 rounded-full border-2 border-amber-700" style={{ background: "radial-gradient(circle at 35% 35%, #fff7ad, #f59e0b)" }} aria-hidden />
        </button>
        {picked && <span className="font-game pointer-events-none absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-accent px-2.5 text-base text-accent-ink shadow">내 문 (그대로)</span>}
        {keepIt && <span className="font-game pointer-events-none absolute -top-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-white bg-amber-300 px-2.5 text-base text-amber-950 shadow">바꾸기</span>}
      </div>
    );
  };

  const th = n === 3 ? "2/3 (약 6.7번/10번)" : "99/100";
  const stayTh = n === 3 ? "1/3 (약 3.3번/10번)" : "1/100";

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="font-game mb-2 text-xl">{phase === "pick" ? "👆 마음에 드는 문을 눌러요" : phase === "switch" ? "👆 내 문을 다시 누르면 ‘그대로’, 다른 닫힌 문을 누르면 ‘바꾸기’!" : "결과예요!"}</p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="내 판" value={`${played} / 5`} />
          <Stat label="별" value={stars > 0 ? "⭐".repeat(stars) : "0"} tone={stars > 0 ? "ok" : "plain"} />
        </div>
        <div key={fx.k} className={fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}>
          <div className="relative overflow-hidden rounded-card border-4 border-[#4c1d95] px-3 pb-6 pt-12 sm:px-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #7c3aed 0%, #3b0764 70%)" }}>
            {/* 무대 조명·커튼 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-9" style={{ background: "radial-gradient(circle at 50% 0%, #ef4444 62%, #991b1b 63%, transparent 66%) 0 0 / 44px 36px repeat-x" }} aria-hidden />
            <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-3 sm:w-5" style={{ background: "linear-gradient(90deg, #991b1b, #ef4444)" }} aria-hidden />
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-3 sm:w-5" style={{ background: "linear-gradient(270deg, #991b1b, #ef4444)" }} aria-hidden />
            <div className="pointer-events-none absolute -top-6 left-[12%] h-56 w-28 -rotate-12 opacity-40" style={{ background: "linear-gradient(180deg, #fef9c3, transparent)" , clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }} aria-hidden />
            <div className="pointer-events-none absolute -top-6 right-[12%] h-56 w-28 rotate-12 opacity-40" style={{ background: "linear-gradient(180deg, #fef9c3, transparent)", clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)" }} aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6" style={{ background: "repeating-linear-gradient(90deg, #b45309 0 28px, #92400e 28px 30px)" }} aria-hidden />
            <div role="group" aria-label="문들" className={n === 3 ? "relative grid grid-cols-3 gap-3 sm:gap-5" : "relative grid grid-cols-10 gap-1"}>
              {Array.from({ length: n }, (_, i) => renderDoor(i))}
            </div>
          </div>
        </div>
        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {phase === "result" && (
            <GButton variant="primary" className={BIG} onClick={again}>
              {played >= 5 ? "다시 5판 하기" : "바로 다음 판 ▶"}
            </GButton>
          )}
        </div>
      </Board>

      <Board>
        <h3 className="font-bold">컴퓨터가 대신 해 줘요</h3>
        <p className="mb-2 text-base text-muted">‘항상 바꾸기’와 ‘항상 그대로’를 100번씩 해 보고, 어느 쪽이 더 많이 이기는지 비교해 봐요.</p>
        <div className="flex flex-wrap gap-2">
          <GButton variant="soft" className={BIG} onClick={() => auto(true, 100)}>항상 바꾸기 100번</GButton>
          <GButton variant="soft" className={BIG} onClick={() => auto(false, 100)}>항상 그대로 100번</GButton>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { k: "바꿨을 때", r: st.swap, c: "bg-ok" },
            { k: "그대로 있었을 때", r: st.stay, c: "bg-bad" },
          ].map((x) => (
            <div key={x.k}>
              <p className="font-bold">
                {x.k}: {x.r.t === 0 ? "아직 안 했어요" : `${x.r.t}번 중 ${x.r.w}번 이겼어요 (10번 중 ${outOf10(x.r)})`}
              </p>
              <div className="h-4 rounded-full bg-bg" aria-hidden>
                <div className={`h-4 rounded-full ${x.c} opacity-70 transition-all`} style={{ width: `${x.r.t ? (100 * x.r.w) / x.r.t : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        {st.swap.t >= 50 && st.stay.t >= 50 && (
          <p className="mt-2 rounded-card bg-accent-soft/70 p-2 font-semibold">
            {st.swap.w / st.swap.t > st.stay.w / st.stay.t ? "바꿀 때 더 많이 이겼어요! 왜 그럴까요?" : "이번에는 비슷하거나 그대로가 더 많았어요. 100번을 더 해 보면 어떻게 될까요?"}
          </p>
        )}
        <div className="mt-3">
          <GButton className={BIG} onClick={resetStats}>기록 지우기</GButton>
        </div>
      </Board>

      <Board>
        <GButton className={BIG} pressed={hard} onClick={toggleHard}>🔥 더 어려운 도전 {hard ? "닫기" : "열기"}</GButton>
        {hard && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <GButton className={BIG} pressed={n === 3} onClick={() => changeN(3)}>문 3개</GButton>
              <GButton className={BIG} pressed={n === 100} onClick={() => changeN(100)}>문 100개</GButton>
            </div>
            <div className="flex flex-wrap gap-2">
              <GButton variant="soft" className={BIG} onClick={() => auto(true, 1000)}>항상 바꾸기 1000번</GButton>
              <GButton variant="soft" className={BIG} onClick={() => auto(false, 1000)}>항상 그대로 1000번</GButton>
            </div>
            <p className="text-base">
              수학으로 계산하면 바꿀 때 이길 확률은 {th}, 그대로 있을 때는 {stayTh} 예요.{" "}
              {n === 3 ? "처음에 자동차 문을 고를 확률이 1/3 뿐이라서, 틀렸을 때(2/3) 바꾸면 자동차를 얻어요." : "처음에 맞게 고를 확률은 1/100 뿐이에요. 틀렸을 때 진행자가 염소 문을 열면 남은 한 문이 자동차예요."}
            </p>
          </div>
        )}
      </Board>
    </div>
  );
}
