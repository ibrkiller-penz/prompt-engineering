import { useState } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";

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

export default function MontyGame() {
  const [n, setN] = useState(3);
  const [hard, setHard] = useState(false);
  const [round, setRound] = useState<Round>(() => newRound(3));
  const [stats, setStats] = useState<{ 3: Stats; 100: Stats }>({ 3: empty(), 100: empty() });
  const [played, setPlayed] = useState(0);
  const [stars, setStars] = useState(0);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "문 뒤에 자동차가 하나 숨어 있어요. 마음에 드는 문을 눌러 보세요!" });

  const st = stats[n as 3 | 100];
  const phase = round.pick === null ? "pick" : round.final === null ? "switch" : "result";

  const addStat = (key: "swap" | "stay", w: number, t: number) =>
    setStats((s) => {
      const cur = s[n as 3 | 100];
      return { ...s, [n]: { ...cur, [key]: { w: cur[key].w + w, t: cur[key].t + t } } };
    });

  const pick = (i: number) => {
    if (phase !== "pick") return;
    const keep = keepDoor(n, round.car, i, Math.random);
    setRound({ ...round, pick: i, keep });
    setMsg({
      t: "info",
      s: n === 3 ? `${i + 1}번 문을 골랐어요. 진행자가 염소가 있는 문을 하나 열어 줬어요. 남은 문은 두 개예요. 문을 바꿀까요, 그대로 있을까요?` : `${i + 1}번 문을 골랐어요. 진행자가 염소 문 98개를 열어 줬어요. 남은 문은 ${i + 1}번과 ${(keep ?? 0) + 1}번이에요. 바꿀까요?`,
    });
  };
  const decide = (swap: boolean) => {
    if (round.pick === null || round.keep === null) return;
    const final = swap ? round.keep : round.pick;
    const win = final === round.car;
    const np = played + 1;
    setRound({ ...round, final });
    setPlayed(np);
    if (win) setStars((s) => s + 1);
    addStat(swap ? "swap" : "stay", win ? 1 : 0, 1);
    const tail = np >= 5 ? " 5판이 끝났어요! 이제 아래에서 ‘자동으로 100번’ 해 봐요." : "";
    setMsg(win ? { t: "ok", s: `⭐ 자동차를 찾았어요! 잘했어요!${tail}` } : { t: "bad", s: `아쉬워요. 자동차는 ${round.car + 1}번 문에 있었어요. 괜찮아요, 다시 해 봐요!${tail}` });
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

  const doorState = (i: number) => ({ open: phase === "result" || (round.keep !== null && i !== round.pick && i !== round.keep), isCar: i === round.car });

  const renderDoor = (i: number) => {
    const { open, isCar } = doorState(i);
    const picked = round.pick === i;
    const small = n > 3;
    const base = small ? "h-10 text-xs" : "h-36 text-xl";
    const color = open ? (isCar ? "bg-ok-soft text-ok border-ok" : "bg-bad-soft text-bad border-bad/40") : "bg-accent-soft text-accent border-line hover:brightness-95";
    return (
      <button
        key={i}
        type="button"
        disabled={phase !== "pick"}
        onClick={() => pick(i)}
        aria-label={`${i + 1}번 문${picked ? " (내가 고른 문)" : ""}${open ? (isCar ? " 자동차" : " 염소") : ""}`}
        className={`relative flex w-full flex-col items-center justify-center rounded-t-2xl border-2 font-extrabold transition disabled:cursor-default ${base} ${color} ${picked ? "ring-4 ring-accent" : ""}`}
      >
        {open ? (
          <>
            <span>{isCar ? "🚗 자동차" : "🐐 염소"}</span>
            {!small && <span className="text-base font-semibold opacity-80">{isCar ? "당첨!" : "꽝"}</span>}
          </>
        ) : (
          <span>{i + 1}</span>
        )}
        {picked && !small && <span className="absolute -top-3 rounded-full bg-accent px-2 text-sm text-accent-ink">내 선택</span>}
        {!open && !small && <span className="absolute right-3 top-1/2 h-3 w-3 rounded-full bg-accent/60" aria-hidden />}
      </button>
    );
  };

  const th = n === 3 ? "2/3 (약 6.7번/10번)" : "99/100";
  const stayTh = n === 3 ? "1/3 (약 3.3번/10번)" : "1/100";

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="mb-2 text-base font-bold">{phase === "pick" ? "👇 문 하나를 눌러 고르세요" : phase === "switch" ? "👇 바꿀지 정하세요" : "결과예요!"}</p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="내 판" value={`${played} / 5`} />
          <Stat label="별" value={stars > 0 ? "⭐".repeat(stars) : "0"} tone={stars > 0 ? "ok" : "plain"} />
        </div>
        <div role="group" aria-label="문들" className={n === 3 ? "grid grid-cols-3 gap-3 pt-3" : "grid grid-cols-10 gap-1 pt-3"}>
          {Array.from({ length: n }, (_, i) => renderDoor(i))}
        </div>
        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {phase === "switch" && (
            <>
              <GButton variant="primary" className={BIG} onClick={() => decide(true)}>
                {round.keep !== null ? `${round.keep + 1}번 문으로 바꾸기` : "바꾸기"}
              </GButton>
              <GButton className={BIG} onClick={() => decide(false)}>그대로 {round.pick !== null ? `${round.pick + 1}번` : ""}</GButton>
            </>
          )}
          {phase === "result" && (
            <GButton variant="primary" className={BIG} onClick={again}>
              {played >= 5 ? "다시 5판 하기" : "다음 판"}
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
