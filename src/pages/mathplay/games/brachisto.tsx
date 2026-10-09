import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat, rand, useFrame } from "./kit";
import { BOWL_H, bowlOutline, bowlPath, buildTable, isSimultaneous, makeRace, posAt, type BowlId, type RaceId } from "./brachisto.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
type Phase = "ready" | "run" | "done";

const IDS: RaceId[] = ["line", "cyc", "arc", "dip"];
const COLORS: Record<RaceId, string> = { line: "#6b7280", cyc: "#e11d48", arc: "#2563eb", dip: "#16a34a" };
const NAMES: Record<RaceId, string> = { line: "곧은 길", cyc: "처음에 확 내려가는 길", arc: "둥근 길", dip: "푹 꺼졌다 올라오는 길" };
const THETAS = [2.2, 2.6, Math.PI, 3.4];
const BOWL_KO: Record<BowlId, string> = { cyc: "특별한 곡선 그릇", arc: "둥근 그릇", line: "곧은 경사 그릇" };
const HLIST = [1, 0.7, 0.4, 0.2];
const ROUNDS = 5;
const BIG = "!min-h-[48px] !text-base";
const stars = (n: number) => (n ? "⭐".repeat(n) : "0");

export default function BrachistoGame() {
  const [view, setView] = useState<"race" | "bowl">("race");
  const [speed, setSpeed] = useState(0.5);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "어느 길이 가장 빨리 도착할까요? 마음에 드는 길을 눌러 골라요." });
  const [hint, setHint] = useState(false);

  // 경주
  const [round, setRound] = useState(1);
  const [star, setStar] = useState(0);
  const [ti, setTi] = useState(2);
  const [pred, setPred] = useState<RaceId | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [clock, setClock] = useState(0);
  const race = useMemo(() => makeRace(THETAS[ti]), [ti]);
  const tabs = useMemo(() => Object.fromEntries(IDS.map((id) => [id, buildTable(race.paths[id], 3000)])) as Record<RaceId, ReturnType<typeof buildTable>>, [race]);
  const Tmax = Math.max(...IDS.map((id) => tabs[id].T));
  const order = [...IDS].sort((a, b) => tabs[a].T - tabs[b].T);

  // 그릇 (더 어려운 도전)
  const [bround, setBround] = useState(1);
  const [bstar, setBstar] = useState(0);
  const [bowl, setBowl] = useState<BowlId>("cyc");
  const [hA, setHA] = useState(1);
  const [hB, setHB] = useState(0.4);
  const [bpred, setBpred] = useState<"same" | "diff" | null>(null);
  const [bphase, setBphase] = useState<Phase>("ready");
  const [bclock, setBclock] = useState(0);
  const tA = useMemo(() => buildTable(bowlPath(bowl, hA * BOWL_H), 3000), [bowl, hA]);
  const tB = useMemo(() => buildTable(bowlPath(bowl, hB * BOWL_H), 3000), [bowl, hB]);
  const outline = useMemo(() => bowlOutline(bowl), [bowl]);

  const running = (view === "race" && phase === "run") || (view === "bowl" && bphase === "run");
  useFrame((_, dt) => {
    if (view === "race" && phase === "run") {
      const c = clock + dt * speed;
      if (c >= Tmax) {
        setClock(Tmax);
        finishRace();
      } else setClock(c);
    }
    if (view === "bowl" && bphase === "run") {
      const c = bclock + dt * speed;
      const end = Math.max(tA.T, tB.T);
      if (c >= end) {
        setBclock(end);
        finishBowl();
      } else setBclock(c);
    }
  }, running);

  function finishRace() {
    setPhase("done");
    const win = order[0];
    if (pred === win) {
      setStar((s) => s + 1);
      setMsg({ t: "ok", s: `와, 맞혔어요! ⭐ 가장 빨리 도착한 길은 ‘${NAMES[win]}’(${tabs[win].T.toFixed(2)}초)예요!` });
    } else {
      setMsg({ t: "bad", s: `아쉽지만 괜찮아요! 이긴 길은 ‘${NAMES[win]}’(${tabs[win].T.toFixed(2)}초)였어요. 다음 판에는 꼭 맞혀 봐요!` });
    }
  }
  function finishBowl() {
    setBphase("done");
    const same = isSimultaneous(bowl, hA * BOWL_H, hB * BOWL_H);
    const ok = (bpred === "same") === same;
    const detail = `공 A ${tA.T.toFixed(2)}초, 공 B ${tB.T.toFixed(2)}초`;
    if (ok) {
      setBstar((s) => s + 1);
      setMsg({ t: "ok", s: `잘 맞혔어요! ⭐ ${detail}. ${same ? "특별한 곡선 그릇에서는 어디서 놓아도 바닥에 같이 닿아요. 신기하죠?" : "이 그릇에서는 높이에 따라 도착 시간이 달라요."}` });
    } else {
      setMsg({ t: "bad", s: `괜찮아요, 이렇게 하나 배웠어요! ${detail}. ${same ? "이 그릇에서는 같이 닿았어요." : "이 그릇에서는 시간이 달랐어요."}` });
    }
  }

  const startRace = () => {
    if (!pred) return;
    setClock(0);
    setPhase("run");
    setMsg({ t: "info", s: "출발! 구슬이 굴러가요. 누가 먼저 도착할까요?" });
  };
  const nextRace = () => {
    setTi((i) => (i + 1 + rand(THETAS.length - 1)) % THETAS.length);
    setRound((r) => r + 1);
    setPred(null); setPhase("ready"); setClock(0); setHint(false);
    setMsg({ t: "info", s: "새 경주판이에요! 어느 길이 이길까요? 눌러서 골라요." });
  };
  const resetRace = () => {
    setRound(1); setStar(0); setPred(null); setPhase("ready"); setClock(0); setHint(false);
    setMsg({ t: "info", s: "처음부터 다시 해요. 어느 길이 이길까요?" });
  };
  const startBowl = () => {
    if (!bpred || hA === hB) return;
    setBclock(0);
    setBphase("run");
    setMsg({ t: "info", s: "두 공을 놓았어요! 바닥에 누가 먼저 닿을까요?" });
  };
  const newBowl = () => {
    const kinds: BowlId[] = ["cyc", "arc", "line"];
    const a = HLIST[rand(4)];
    let b = HLIST[rand(4)];
    while (b === a) b = HLIST[rand(4)];
    setBowl(kinds[rand(3)]); setHA(a); setHB(b);
    setBround((r) => r + 1);
    setBpred(null); setBphase("ready"); setBclock(0);
    setMsg({ t: "info", s: "새 문제예요! 두 공이 바닥에 같이 닿을까요?" });
  };
  const resetBowl = () => {
    setBround(1); setBstar(0); setBpred(null); setBphase("ready"); setBclock(0); setBowl("cyc"); setHA(1); setHB(0.4);
    setMsg({ t: "info", s: "처음부터 다시 해요. 두 공이 바닥에 같이 닿을까요?" });
  };
  const goView = (v: "race" | "bowl") => {
    setView(v);
    if (v === "race") setMsg({ t: "info", s: "어느 길이 가장 빨리 도착할까요? 눌러서 골라요." });
    else setMsg({ t: "info", s: "높이가 다른 곳에서 공 두 개를 놓아요. 바닥에 같이 닿을까요?" });
  };

  // ───── 경주 그림 ─────
  const raceSvg = (() => {
    const samples = IDS.map((id) => Array.from({ length: 101 }, (_, i) => race.paths[id](i / 100)));
    const maxD = Math.max(...samples.flat().map((p) => p.d));
    const maxX = Math.max(...samples.flat().map((p) => p.x));
    const s = Math.min(330 / maxX, 220 / maxD);
    const ox = 34, oy = 36;
    const X = (x: number) => ox + x * s;
    const Y = (d: number) => oy + d * s;
    const H = Math.round(oy + maxD * s + 26);
    return (
      <svg viewBox={`0 0 400 ${H}`} className="w-full select-none rounded-card bg-bg" role="group" aria-label="출발점 A 에서 도착점 B 까지 가는 네 가지 길">
        {IDS.map((id, k) => {
          const d = samples[k].map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.d).toFixed(1)}`).join("");
          const sel = pred === id;
          return (
            <g key={id}>
              <path d={d} fill="none" stroke={COLORS[id]} strokeWidth={sel ? 6 : 3.5} strokeLinecap="round" opacity={pred && !sel ? 0.4 : 1} />
              <path d={d} fill="none" stroke="transparent" strokeWidth={24} style={{ cursor: phase === "ready" ? "pointer" : "default", touchAction: "manipulation" }}
                onClick={() => phase === "ready" && setPred(id)} role="button" aria-label={`${NAMES[id]}이(가) 이길 거라고 고르기`} tabIndex={phase === "ready" ? 0 : -1}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && phase === "ready" && (e.preventDefault(), setPred(id))} />
            </g>
          );
        })}
        <circle cx={X(0)} cy={Y(0)} r={7} fill="var(--ink)" />
        <text x={X(0) + 12} y={Y(0) - 8} fontSize={16} fontWeight={800} fill="var(--ink)">출발</text>
        <circle cx={X(race.xb)} cy={Y(race.yb)} r={7} fill="var(--ink)" />
        <text x={X(race.xb)} y={Y(race.yb) + 24} fontSize={16} fontWeight={800} fill="var(--ink)" textAnchor="end" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">도착</text>
        {phase !== "ready" && IDS.map((id) => {
          const p = posAt(tabs[id], clock);
          return <circle key={id} cx={X(p.x)} cy={Y(p.d)} r={9} fill={COLORS[id]} stroke="var(--surface)" strokeWidth={2.5} />;
        })}
      </svg>
    );
  })();

  // ───── 그릇 그림 ─────
  const BS = 105, BX = 200, BBASE = 150;
  const bx = (x: number) => BX + x * BS;
  const by = (h: number) => BBASE - h * BS;
  const bowlSvg = (() => {
    const od = outline.map(([x, h], i) => `${i ? "L" : "M"}${bx(x).toFixed(1)} ${by(h).toFixed(1)}`).join("");
    const ball = (tb: ReturnType<typeof buildTable>, h0: number, color: string, label: string, dx: number) => {
      const started = bphase !== "ready";
      const p = started ? posAt(tb, bclock) : tb.path(0);
      const h = h0 * BOWL_H - p.d;
      const arrived = started && bclock >= tb.T;
      const x = bx(p.x) + (arrived ? dx : 0);
      return (
        <g>
          <circle cx={x} cy={by(h) - 10} r={10} fill={color} stroke="var(--surface)" strokeWidth={2.5} />
          <text x={x} y={by(h) - 5.5} fontSize={12} fontWeight={800} fill="#fff" textAnchor="middle">{label}</text>
        </g>
      );
    };
    return (
      <svg viewBox="0 0 400 190" className="w-full select-none rounded-card bg-bg" role="img" aria-label={`${BOWL_KO[bowl]}. 공 A 는 ${Math.round(hA * 100)}센티미터, 공 B 는 ${Math.round(hB * 100)}센티미터 높이에서 놓아요`}>
        <path d={od} fill="none" stroke="var(--ink)" strokeWidth={3.5} strokeLinejoin="round" />
        <text x={bx(0)} y={by(0) + 30} fontSize={14} fill="var(--muted)" textAnchor="middle">바닥</text>
        {ball(tA, hA, "#e11d48", "A", -12)}
        {ball(tB, hB, "#2563eb", "B", 12)}
      </svg>
    );
  })();

  const raceEnd = phase === "done" && round >= ROUNDS;
  const bowlEnd = bphase === "done" && bround >= ROUNDS;
  const Speed = (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="구르는 속도">
      <span className="text-base font-semibold">속도</span>
      <GButton className={BIG} pressed={speed < 0.5} variant={speed < 0.5 ? "primary" : "ghost"} onClick={() => setSpeed(0.3)}>🐢 느리게</GButton>
      <GButton className={BIG} pressed={speed >= 0.5} variant={speed >= 0.5 ? "primary" : "ghost"} onClick={() => setSpeed(0.6)}>🐇 보통</GButton>
    </div>
  );

  return (
    <Board>
      {view === "race" ? (
        <>
          <h3 className="text-lg font-extrabold">🛝 미끄럼틀 달리기 경주</h3>
          <p className="mt-1 text-base">구슬 4개가 같은 곳에서 출발해서 서로 다른 길로 내려가요. 어느 길이 가장 빨리 도착할까요?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Stat label="판" value={`${round}/${ROUNDS}`} />
            <Stat label="별" value={stars(star)} tone={star ? "ok" : "plain"} />
          </div>
          <p className="mt-3 text-base font-bold">{phase === "ready" ? "👆 이길 것 같은 길을 눌러 골라요!" : phase === "run" ? "🏁 달리는 중…" : "🏁 도착!"}</p>
          <div className="mt-1">{raceSvg}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="이길 길 고르기">
            {IDS.map((id) => (
              <GButton key={id} className={BIG} variant={pred === id ? "primary" : "ghost"} pressed={pred === id} disabled={phase !== "ready"} onClick={() => setPred(id)}>
                <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: COLORS[id] }} aria-hidden />
                {NAMES[id]}
              </GButton>
            ))}
          </div>
          {phase === "done" && (
            <ol className="mt-3 space-y-1 rounded-card bg-bg p-3 text-base" aria-label="도착 순서">
              {order.map((id, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="w-14 font-extrabold">{i + 1}등{i === 0 ? " 🏆" : ""}</span>
                  <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ background: COLORS[id] }} aria-hidden />
                  <span className="flex-1">{NAMES[id]}</span>
                  <span className="tabular-nums">{tabs[id].T.toFixed(2)}초</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3"><Say tone={msg.t}>{raceEnd ? `${msg.s} 5판을 모두 했어요! 별 ${star}개를 모았어요. 정말 잘했어요!` : msg.s}</Say></div>
          {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">💡 구슬은 내려갈수록 점점 빨라져요. 처음에 가파르게 내려가서 빨리 달리기 시작하는 길이 유리해요. 하지만 너무 멀리 돌아가면 손해예요!</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <GButton variant="primary" className={BIG} onClick={startRace} disabled={!pred || phase !== "ready"}>🚀 출발!</GButton>
            {phase === "done" && !raceEnd && <GButton variant="soft" className={BIG} onClick={nextRace}>다음 판 ▶</GButton>}
            <GButton className={BIG} pressed={hint} onClick={() => setHint((v) => !v)}>💡 힌트</GButton>
            <GButton className={BIG} onClick={resetRace} disabled={phase === "run"}>다시 하기</GButton>
          </div>
          <div className="mt-3">{Speed}</div>
          <p className="mt-3 text-sm text-muted">구슬은 가만히 놓으면 저절로 굴러 내려가요. 화면은 실제보다 천천히 보여 줘요.</p>
          <div className="mt-4 border-t border-line pt-3">
            <GButton className={BIG} onClick={() => goView("bowl")} disabled={phase === "run"}>🔥 더 어려운 도전 해 보기 ▶</GButton>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-lg font-extrabold">🔥 더 어려운 도전: 높이가 달라도 같이 닿을까?</h3>
          <p className="mt-1 text-base">그릇의 서로 다른 높이에서 공 두 개를 동시에 가만히 놓아요. 바닥에 같이 닿을까요, 따로 닿을까요?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Stat label="문제" value={`${bround}/${ROUNDS}`} />
            <Stat label="별" value={stars(bstar)} tone={bstar ? "ok" : "plain"} />
          </div>
          <p className="mt-3 text-base font-bold">{bphase === "ready" ? "👆 그릇과 높이를 고르고, 예측을 눌러요!" : bphase === "run" ? "⏳ 굴러가는 중…" : "🏁 도착!"}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2" role="group" aria-label="그릇 고르기">
            <span className="text-base font-semibold">그릇</span>
            {(["cyc", "arc", "line"] as BowlId[]).map((k) => (
              <GButton key={k} className={BIG} variant={bowl === k ? "primary" : "ghost"} pressed={bowl === k} disabled={bphase !== "ready"} onClick={() => setBowl(k)}>{BOWL_KO[k]}</GButton>
            ))}
          </div>
          <div className="mt-2">{bowlSvg}</div>
          {([["A", hA, setHA, "#e11d48"], ["B", hB, setHB, "#2563eb"]] as const).map(([name, val, set, color]) => (
            <div key={name} className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`공 ${name} 높이`}>
              <span className="w-24 text-base font-semibold" style={{ color }}>공 {name} 높이</span>
              {HLIST.map((h) => (
                <GButton key={h} className={`${BIG} !min-w-[56px] !px-2`} variant={val === h ? "primary" : "ghost"} pressed={val === h} disabled={bphase !== "ready"} onClick={() => set(h)}>{Math.round(h * 100)}cm</GButton>
              ))}
            </div>
          ))}
          {hA === hB && <p className="mt-2 text-base font-semibold text-bad">두 공의 높이를 다르게 골라 주세요.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="내 예측">
            <span className="text-base font-semibold">내 예측</span>
            <GButton className={BIG} variant={bpred === "same" ? "primary" : "ghost"} pressed={bpred === "same"} disabled={bphase !== "ready"} onClick={() => setBpred("same")}>같이 닿아요</GButton>
            <GButton className={BIG} variant={bpred === "diff" ? "primary" : "ghost"} pressed={bpred === "diff"} disabled={bphase !== "ready"} onClick={() => setBpred("diff")}>따로 닿아요</GButton>
          </div>
          <div className="mt-3"><Say tone={msg.t}>{bowlEnd ? `${msg.s} 5문제를 모두 했어요! 별 ${bstar}개를 모았어요. 대단해요!` : msg.s}</Say></div>
          {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">💡 높은 곳에서 놓으면 더 멀리 가야 하지만 더 빨라지기도 해요. 어느 쪽이 더 클지 생각해 봐요!</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <GButton variant="primary" className={BIG} onClick={startBowl} disabled={!bpred || bphase !== "ready" || hA === hB}>🚀 공 놓기!</GButton>
            {bphase === "done" && !bowlEnd && <GButton variant="soft" className={BIG} onClick={newBowl}>다음 문제 ▶</GButton>}
            <GButton className={BIG} pressed={hint} onClick={() => setHint((v) => !v)}>💡 힌트</GButton>
            <GButton className={BIG} onClick={resetBowl} disabled={bphase === "run"}>다시 하기</GButton>
          </div>
          <div className="mt-3">{Speed}</div>
          <div className="mt-4 border-t border-line pt-3">
            <GButton className={BIG} onClick={() => goView("race")} disabled={bphase === "run"}>◀ 쉬운 경주로 돌아가기</GButton>
          </div>
        </>
      )}
    </Board>
  );
}
