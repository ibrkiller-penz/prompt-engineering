import { useEffect, useMemo, useState } from "react";
import { Board, GButton, cheer, oops, stageClear, tick, useStage } from "./kit";
import { BIG, Pill, Talk } from "./easykit";
import { applyMove, binaryRows, cpuMove, makeRounds, nimSum, total, winningMove, type Move, type NRound } from "./nim.logic";

const COLORS: [string, string, string][] = [
  ["#fda4af", "#f43f5e", "#9f1239"],
  ["#7dd3fc", "#0ea5e9", "#075985"],
  ["#fde68a", "#f59e0b", "#92400e"],
  ["#c4b5fd", "#8b5cf6", "#5b21b6"],
];
const GF = "Jua, Pretendard Variable, sans-serif";

function Robot({ mood, size = 56 }: { mood: "think" | "happy" | "sad" | "idle"; size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={mood === "think" ? "gz-bob" : mood === "sad" ? "am-shake" : ""}>
      <line x1="32" y1="6" x2="32" y2="14" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="6" r="4" fill={mood === "think" ? "#fde047" : "#f472b6"} stroke="#0f766e" strokeWidth="2" />
      <rect x="8" y="14" width="48" height="40" rx="14" fill="#5eead4" stroke="#0f766e" strokeWidth="3" />
      <rect x="3" y="28" width="6" height="12" rx="3" fill="#99f6e4" stroke="#0f766e" strokeWidth="2" />
      <rect x="55" y="28" width="6" height="12" rx="3" fill="#99f6e4" stroke="#0f766e" strokeWidth="2" />
      <rect x="14" y="22" width="36" height="20" rx="9" fill="#ecfeff" stroke="#0f766e" strokeWidth="2" />
      {mood === "happy" ? (
        <>
          <path d="M20 33 Q24 27 28 33" stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M36 33 Q40 27 44 33" stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="24" cy="32" r="4" fill="#0f766e" />
          <circle cx="40" cy="32" r="4" fill="#0f766e" />
          <circle cx="25.4" cy="30.6" r="1.4" fill="#fff" />
          <circle cx="41.4" cy="30.6" r="1.4" fill="#fff" />
        </>
      )}
      <path d={mood === "sad" ? "M25 49 Q32 44 39 49" : "M25 46 Q32 52 39 46"} stroke="#0f766e" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="17" cy="45" r="3" fill="#fda4af" opacity="0.8" />
      <circle cx="47" cy="45" r="3" fill="#fda4af" opacity="0.8" />
    </svg>
  );
}

export default function NimGame() {
  const level = useStage();
  const rounds = useMemo<NRound[]>(() => makeRounds(level), [level]);
  const [ri, setRi] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const r = rounds[ri];
  const [piles, setPiles] = useState<number[]>(r.piles);
  const [turn, setTurn] = useState<"me" | "cpu">(r.first);
  const [phase, setPhase] = useState<"play" | "won" | "lost">("play");
  const [cpuPick, setCpuPick] = useState<Move | null>(null);
  const [hover, setHover] = useState<{ pile: number; c: number } | null>(null);
  const [hint, setHint] = useState(0);
  const [moved, setMoved] = useState(false);
  const [fx, setFx] = useState<{ n: number; t: "ok" | "bad" | "" }>({ n: 0, t: "" });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>(() => ({ t: "info", s: startText(rounds[0]) }));

  const init = r.piles;
  const wm = winningMove(piles);
  const hintMove = hint >= 2 && turn === "me" && phase === "play" ? wm : null;

  function startText(x: NRound) {
    return x.first === "me" ? "내가 먼저 해요! 마지막 돌을 가져가면 이겨요. 가져갈 돌을 눌러요." : "이번엔 로봇이 먼저 해요. 로봇이 가져간 다음, 내가 ‘로봇이 이길 수 없는 모양’을 만들어 봐요!";
  }
  const lesson = () => {
    if (level <= 6) return "✨ 알아보기: 두 더미를 똑같이 만들면 로봇이 가져가는 만큼 따라 가져가서 마지막 돌을 차지할 수 있어요. 더미가 많을 땐 ‘로봇이 이길 수 없는 모양’을 만드는 게 비결이에요.";
    const b = binaryRows(init);
    return `✨ 알아보기: 더미 크기를 이진수로 쓰고 세로로 더했을 때 모두 짝수(님합 0)가 되게 가져가면 늘 이겨요. 이 판의 처음 모양은 ${init.map((p, i) => `${p}=${b.rows[i]}`).join(", ")} 이고 세로 합은 ${b.col.join("·")} 이에요.`;
  };

  function endRound(who: "me" | "cpu") {
    if (who === "me") {
      cheer();
      setFx((f) => ({ n: f.n + 1, t: "ok" }));
      setPhase("won");
      setMsg({ t: "ok", s: `마지막 돌을 가져갔어요! 내가 이겼어요! ⭐ ${lesson()}` });
    } else {
      oops();
      setFx((f) => ({ n: f.n + 1, t: "bad" }));
      setPhase("lost");
      setMsg({ t: "bad", s: "로봇이 마지막 돌을 가져갔어요. 아쉬워요! 괜찮아요, 같은 판을 다시 해 봐요. 이번엔 힌트를 써 봐도 좋아요." });
    }
  }
  const take = (pile: number, c: number) => {
    if (phase !== "play" || turn !== "me" || c < 1 || c > piles[pile]) return;
    const next = applyMove(piles, { pile, take: c });
    setMoved(true);
    setHover(null);
    setHint(0);
    setPiles(next);
    tick();
    if (total(next) === 0) return endRound("me");
    setTurn("cpu");
    setMsg(nimSum(next) === 0 ? { t: "info", s: "좋아요! 이제 로봇은 이길 수 없는 모양이에요." } : { t: "info", s: "앗, 이 모양은 로봇이 이길 수도 있어요. 로봇이 실수하길 기다리거나, 다음엔 힌트를 써 봐요." });
  };

  // 로봇 차례: 잠깐 생각 → 가져갈 돌 표시 → 가져가기
  useEffect(() => {
    if (phase !== "play" || turn !== "cpu" || cpuPick) return;
    const id = setTimeout(() => setCpuPick(cpuMove(piles, r.err, Math.random)), 900);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, cpuPick, piles, ri, attempt]);
  useEffect(() => {
    if (!cpuPick) return;
    const id = setTimeout(() => {
      const next = applyMove(piles, cpuPick);
      setPiles(next);
      setCpuPick(null);
      tick();
      if (total(next) === 0) return endRound("cpu");
      setTurn("me");
      setMsg({ t: "info", s: `로봇이 ${cpuPick.pile + 1}번 줄에서 돌 ${cpuPick.take}개를 가져갔어요. 이제 내 차례!` });
    }, 800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuPick]);

  function resetRound(i: number, att: number) {
    const x = rounds[i];
    setRi(i);
    setAttempt(att);
    setPiles(x.piles);
    setTurn(x.first);
    setPhase("play");
    setCpuPick(null);
    setHover(null);
    setHint(0);
    setMoved(false);
    setFx((f) => ({ ...f, t: "" }));
    setMsg({ t: "info", s: att > 0 ? `같은 판을 다시 해 봐요. ${startText(x)}` : startText(x) });
  }
  // 끝난 뒤: 이기면 다음 라운드(마지막이면 레벨 클리어), 지면 같은 라운드 다시
  useEffect(() => {
    if (phase === "play") return;
    const last = ri >= rounds.length - 1;
    const id = setTimeout(
      () => {
        if (phase === "lost") resetRound(ri, attempt + 1);
        else if (last) stageClear();
        else resetRound(ri + 1, 0);
      },
      phase === "lost" ? 3200 : last ? 5200 : 4200,
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const askHint = () => {
    if (phase !== "play" || turn !== "me") return;
    const alive = piles.filter((p) => p > 0).length;
    if (alive === 1) {
      setHint(2);
      setMsg({ t: "info", s: "한 더미만 남았어요! 남은 돌을 모두 가져가면 이겨요. (맨 왼쪽 돌을 눌러요)" });
      return;
    }
    if (hint === 0) {
      setHint(1);
      if (!wm) setMsg({ t: "info", s: "🤖 지금은 로봇이 이기는 모양이에요. 작게 한 개씩 가져가며 로봇이 실수하길 기다려요." });
      else if (alive === 2) setMsg({ t: "info", s: "🤖 로봇은 이렇게 생각해요: 두 더미를 똑같이 만들어요! 같아지면 로봇이 가져가는 만큼 나도 따라 하면 이겨요. 더미를 둘로 같게 만들 수 있을까요?" });
      else if (level <= 6) setMsg({ t: "info", s: "🤖 로봇은 이렇게 생각해요: 내가 가져간 뒤에 ‘로봇이 이길 수 없는 모양’이 되어야 해요. 예를 들어 돌이 1·2·3개인 모양이나, 같은 두 더미만 남은 모양이에요. 어느 더미에서 가져가면 될까요?" });
      else setMsg({ t: "info", s: "🤖 로봇은 이렇게 생각해요: 더미 크기를 이진수로 쓰고, 세로로 더했을 때 모두 짝수가 되게 가져가요. 모든 더미를 살펴보며 한 더미만 줄여 봐요." });
    } else {
      setHint(2);
      if (!wm) return setMsg({ t: "info", s: "이길 수 있는 한 수가 없어요. 한 개만 가져가요!" });
      const b = binaryRows(piles);
      const extra = level >= 7 ? ` (이진수: ${piles.map((p, i) => `${p}=${b.rows[i]}`).join(", ")} → 세로 합 ${b.col.join("·")})` : "";
      setMsg({ t: "info", s: `${wm.pile + 1}번 줄에서 돌 ${wm.take}개를 가져가요! 노랗게 표시했어요.${extra}` });
    }
  };

  const BIGB = BIG;
  return (
    <div className="space-y-3 text-base">
      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Pill label={`레벨 ${level} · 라운드`} value={`${ri + 1} / ${rounds.length}`} />
          <Pill label="남은 돌" value={total(piles)} tone="ok" />
        </div>
        <div className="mb-2 flex items-center gap-3">
          <Robot mood={phase === "won" ? "sad" : phase === "lost" ? "happy" : turn === "cpu" ? "think" : "idle"} />
          <p className="font-game text-xl leading-snug">
            {phase === "play" ? (turn === "me" ? (moved ? "🐣 내 차례! 가져갈 돌을 눌러요" : "👆 내 차례! 가져갈 돌을 눌러요") : "🤖 로봇이 생각 중이에요…") : phase === "won" ? "🎉 내가 이겼어요!" : "😅 로봇이 이겼어요"}
          </p>
        </div>

        <div key={fx.n} className={fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}>
          <div className="relative overflow-hidden rounded-card border-4 border-teal-700 px-3 pb-4 pt-3" style={{ background: "linear-gradient(180deg, #fde68a 0%, #fcd34d 100%)" }}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-9" style={{ background: "linear-gradient(180deg, #a5f3fc, #38bdf8)", borderBottom: "4px dotted #e0f2fe" }} aria-hidden />
            <div className="pointer-events-none absolute right-3 top-0 text-2xl leading-9" aria-hidden>☀️</div>
            <div className="pointer-events-none absolute bottom-1 right-3 text-2xl" aria-hidden>🦀</div>
            <div className="relative space-y-1 pt-9">
              {init.map((cap, i) => {
                const [lt, base, dk] = COLORS[i % COLORS.length];
                const p = piles[i];
                return (
                  <div key={i}>
                    <p className="font-game text-base" style={{ color: "#78350f" }}>
                      {i + 1}번 줄 · 돌 {p}개
                    </p>
                    <div className="flex items-start gap-1" onPointerLeave={() => setHover(null)}>
                      {Array.from({ length: cap }, (_, j) => {
                        const present = j < p;
                        const c = p - j; // 오른쪽 끝에서부터 센 번호
                        const inHover = !!hover && hover.pile === i && present && c <= hover.c;
                        const inCpu = !!cpuPick && cpuPick.pile === i && present && c <= cpuPick.take;
                        const inHint = !!hintMove && hintMove.pile === i && present && c <= hintMove.take;
                        return (
                          <div key={j} className="relative aspect-square min-w-0 max-w-[52px] flex-1 rounded-full border-2 border-dashed border-amber-700/30" style={{ flexBasis: 0 }}>
                            <button
                              type="button"
                              disabled={!present || phase !== "play" || turn !== "me"}
                              aria-label={`${i + 1}번 줄에서 돌 ${c}개 가져가기`}
                              onClick={() => take(i, c)}
                              onPointerEnter={(e) => e.pointerType === "mouse" && present && setHover({ pile: i, c })}
                              className={`font-game absolute inset-0 flex items-center justify-center rounded-full border-[3px] text-base text-white ${inCpu ? "gz-bob" : ""}`}
                              style={{
                                background: `radial-gradient(circle at 35% 28%, ${lt}, ${base})`,
                                borderColor: dk,
                                textShadow: `0 1px 0 ${dk}`,
                                boxShadow: inHint ? "0 0 0 4px #fde047, 0 3px 0 " + dk : inCpu ? "0 0 0 4px #fb923c, 0 3px 0 " + dk : inHover ? "0 0 0 3px #fff, 0 3px 0 " + dk : "0 3px 0 " + dk,
                                transform: present ? (inHover || inHint || inCpu ? "scale(1.1)" : "scale(1)") : "scale(0.2)",
                                opacity: present ? 1 : 0,
                                transition: "transform .35s cubic-bezier(.3,1.4,.5,1), opacity .3s",
                                pointerEvents: present ? undefined : "none",
                                fontFamily: GF,
                              }}
                            >
                              <span className="pointer-events-none absolute left-[22%] top-[14%] h-[22%] w-[34%] rotate-[-25deg] rounded-full bg-white/60" aria-hidden />
                              <span className="relative">{c}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-2 text-base text-muted">돌에 적힌 수는 ‘오른쪽 끝에서부터 센 수’예요. 누른 돌과 그 오른쪽 돌을 모두 가져가요.</p>

        <div className="mt-3">
          <Talk tone={msg.t}>{msg.s}</Talk>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="soft" className={BIGB} onClick={askHint} disabled={phase !== "play" || turn !== "me"}>
            💡 힌트{hint === 1 ? " (한 번 더 누르면 정답)" : ""}
          </GButton>
          <GButton className={BIGB} onClick={() => resetRound(ri, attempt + 1)}>↺ 이 판 다시</GButton>
        </div>
      </Board>
    </div>
  );
}
