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
const pct = (r: Rec) => (r.t === 0 ? "-" : `${((100 * r.w) / r.t).toFixed(1)}%`);

type Round = { car: number; pick: number | null; keep: number | null; final: number | null };
const newRound = (n: number): Round => ({ car: rand(n), pick: null, keep: null, final: null });

export default function MontyGame() {
  const [n, setN] = useState(3);
  const [round, setRound] = useState<Round>(() => newRound(3));
  const [stats, setStats] = useState<{ 3: Stats; 100: Stats }>({ 3: empty(), 100: empty() });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "문 하나를 골라 보세요. 뒤에 자동차가 숨어 있어요." });

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
      s: n === 3 ? `${i + 1}번 문을 골랐어요. 진행자가 염소가 있는 문 하나를 열어 줬어요. 바꿀까요, 그대로 갈까요?` : `${i + 1}번 문을 골랐어요. 진행자가 염소 문 98개를 열어 줬어요. 남은 문은 ${i + 1}번과 ${(keep ?? 0) + 1}번이에요. 바꿀까요?`,
    });
  };
  const decide = (swap: boolean) => {
    if (round.pick === null || round.keep === null) return;
    const final = swap ? round.keep : round.pick;
    const win = final === round.car;
    setRound({ ...round, final });
    addStat(swap ? "swap" : "stay", win ? 1 : 0, 1);
    setMsg(
      win
        ? { t: "ok", s: `${swap ? "바꿔서" : "그대로 두고"} 자동차를 찾았어요! 🎉` }
        : { t: "bad", s: `${swap ? "바꿨는데" : "그대로 뒀는데"} 염소였어요. 자동차는 ${round.car + 1}번 문에 있었어요.` },
    );
  };
  const again = () => {
    setRound(newRound(n));
    setMsg({ t: "info", s: "새 판이에요. 문 하나를 골라 보세요." });
  };
  const changeN = (m: number) => {
    setN(m);
    setRound(newRound(m));
    setMsg({ t: "info", s: m === 3 ? "문 3개 게임이에요." : "문 100개 게임이에요! 하나를 고르면 진행자가 염소 문 98개를 열어 줘요." });
  };
  const auto = (swap: boolean) => {
    const w = simulate(n, swap, 1000, Math.random);
    addStat(swap ? "swap" : "stay", w, 1000);
    setMsg({ t: "info", s: `${swap ? "항상 바꾸기" : "항상 그대로"} 1000번: ${w}번 이겼어요 (${(w / 10).toFixed(1)}%).` });
  };
  const resetStats = () => {
    setStats((s) => ({ ...s, [n]: empty() }));
    setRound(newRound(n));
    setMsg({ t: "info", s: "기록을 지우고 처음부터 해요." });
  };

  const doorState = (i: number) => {
    const open = phase === "result" || (round.keep !== null && i !== round.pick && i !== round.keep);
    const isCar = i === round.car;
    return { open, isCar };
  };
  const th = n === 3 ? 2 / 3 : 99 / 100;
  const stayTh = n === 3 ? 1 / 3 : 1 / 100;

  const renderDoor = (i: number) => {
    const { open, isCar } = doorState(i);
    const picked = round.pick === i;
    const kept = round.keep === i && phase !== "pick";
    const small = n > 3;
    const base = small ? "h-10 text-xs" : "h-36 text-lg";
    const color = open ? (isCar ? "bg-ok-soft text-ok border-ok" : "bg-bad-soft text-bad border-bad/40") : "bg-accent-soft text-accent border-line hover:brightness-95";
    return (
      <button
        key={i}
        type="button"
        disabled={phase !== "pick"}
        onClick={() => pick(i)}
        aria-label={`${i + 1}번 문${picked ? " (내가 고른 문)" : ""}${open ? (isCar ? " 자동차" : " 염소") : ""}`}
        className={`relative flex w-full flex-col items-center justify-center rounded-t-2xl border-2 font-extrabold transition disabled:cursor-default ${base} ${color} ${picked ? "ring-4 ring-accent" : ""} ${kept && phase === "switch" ? "ring-2 ring-line" : ""}`}
      >
        {open ? (
          <>
            <span>{isCar ? "자동차" : "염소"}</span>
            {!small && <span className="text-sm font-semibold opacity-80">{isCar ? "🚗 당첨!" : "꽝"}</span>}
          </>
        ) : (
          <span>{i + 1}</span>
        )}
        {picked && !small && <span className="absolute -top-3 rounded-full bg-accent px-2 text-xs text-accent-ink">내 선택</span>}
        {!open && !small && <span className="absolute right-3 top-1/2 h-3 w-3 rounded-full bg-accent/60" aria-hidden />}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <Board>
        <div className="mb-3 flex flex-wrap gap-2">
          <GButton pressed={n === 3} onClick={() => changeN(3)}>문 3개</GButton>
          <GButton pressed={n === 100} onClick={() => changeN(100)}>문 100개</GButton>
        </div>
        <div role="group" aria-label="문들" className={n === 3 ? "grid grid-cols-3 gap-3 pt-3" : "grid grid-cols-10 gap-1 pt-3"}>
          {Array.from({ length: n }, (_, i) => renderDoor(i))}
        </div>
        <div className="mt-3">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {phase === "switch" && (
            <>
              <GButton variant="primary" onClick={() => decide(true)}>
                {round.keep !== null ? `${round.keep + 1}번 문으로 바꾸기` : "바꾸기"}
              </GButton>
              <GButton onClick={() => decide(false)}>그대로 {round.pick !== null ? `${round.pick + 1}번` : ""}</GButton>
            </>
          )}
          {phase === "result" && (
            <GButton variant="primary" onClick={again}>
              다음 판
            </GButton>
          )}
          {phase === "pick" && <span className="inline-flex min-h-[44px] items-center text-sm text-muted">문을 눌러 고르세요</span>}
          <GButton onClick={again} disabled={phase === "pick"}>
            다시 하기
          </GButton>
        </div>
      </Board>

      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="한 판 수" value={st.swap.t + st.stay.t} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center text-sm">
            <thead>
              <tr className="text-muted">
                <th className="p-2 text-left font-semibold">방법</th>
                <th className="p-2 font-semibold">이긴 횟수 / 한 횟수</th>
                <th className="p-2 font-semibold">이긴 비율</th>
                <th className="p-2 font-semibold">이론 확률</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="p-2 text-left font-bold">바꿨을 때</td>
                <td className="p-2 tabular-nums">
                  {st.swap.w} / {st.swap.t}
                </td>
                <td className="p-2 font-extrabold tabular-nums text-ok">{pct(st.swap)}</td>
                <td className="p-2 tabular-nums">{n === 3 ? "2/3 ≈ 66.7%" : "99/100 = 99%"}</td>
              </tr>
              <tr className="border-t border-line">
                <td className="p-2 text-left font-bold">안 바꿨을 때</td>
                <td className="p-2 tabular-nums">
                  {st.stay.w} / {st.stay.t}
                </td>
                <td className="p-2 font-extrabold tabular-nums text-bad">{pct(st.stay)}</td>
                <td className="p-2 tabular-nums">{n === 3 ? "1/3 ≈ 33.3%" : "1/100 = 1%"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-2 space-y-1" aria-hidden>
          {[
            { k: "바꿈", r: st.swap, th, c: "bg-ok" },
            { k: "그대로", r: st.stay, th: stayTh, c: "bg-bad" },
          ].map((x) => (
            <div key={x.k} className="relative h-4 rounded-full bg-bg">
              <div className={`h-4 rounded-full ${x.c} opacity-70 transition-all`} style={{ width: `${x.r.t ? (100 * x.r.w) / x.r.t : 0}%` }} />
              <div className="absolute top-0 h-4 w-0.5 bg-ink" style={{ left: `${x.th * 100}%` }} />
            </div>
          ))}
          <p className="text-xs text-muted">검은 선은 이론 확률이에요.</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="soft" onClick={() => auto(true)}>항상 바꾸기 1000번</GButton>
          <GButton variant="soft" onClick={() => auto(false)}>항상 그대로 1000번</GButton>
          <GButton onClick={resetStats}>기록 지우기</GButton>
        </div>
        <p className="mt-3 text-sm text-muted">
          {n === 3
            ? "처음에 자동차 문을 고를 확률은 1/3 이에요. 그래서 그대로 있으면 1/3, 틀렸을 때(2/3) 바꾸면 자동차를 얻어요. 진행자는 항상 염소 문만 열어 주기 때문이에요."
            : "처음에 맞게 고를 확률은 1/100 뿐이에요. 틀렸을 확률 99/100 일 때, 진행자가 염소 문을 열고 남은 한 문이 바로 자동차예요. 그래서 바꾸면 99/100 로 이겨요."}
        </p>
      </Board>
    </div>
  );
}
