import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, rand, svgPoint, tick, useFrame } from "./kit";
import { BOWL_H, bowlOutline, bowlPath, buildTable, isSimultaneous, makeRace, posAt, type BowlId, type RaceId } from "./brachisto.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
type Phase = "ready" | "run" | "done";

const IDS: RaceId[] = ["line", "cyc", "arc", "dip"];
const COLORS: Record<RaceId, string> = { line: "#6b7280", cyc: "#e11d48", arc: "#2563eb", dip: "#16a34a" };
const NAMES: Record<RaceId, string> = { line: "곧은 길", cyc: "처음에 확 내려가는 길", arc: "둥근 길", dip: "푹 꺼졌다 올라오는 길" };
const THETAS = [2.2, 2.6, Math.PI, 3.4];
const BOWL_KO: Record<BowlId, string> = { cyc: "특별한 곡선 그릇", arc: "둥근 그릇", line: "곧은 경사 그릇" };
const ROUNDS = 5;
const SPEED = 0.55;
const AUTO_MS = 3200;
const BIG = "!min-h-[48px] !text-base";
const stars = (n: number) => (n ? "⭐".repeat(n) : "0");
const H_MIN = 0.12, H_MAX = 0.95;

export default function BrachistoGame() {
  const [view, setView] = useState<"race" | "bowl">("race");
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "어느 구슬이 가장 빨리 도착할까요? 구슬을 톡 눌러요!" });
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
  const [hA, setHA] = useState(0.9);
  const [hB, setHB] = useState(0.4);
  const [bpred, setBpred] = useState<"same" | "diff" | null>(null);
  const [bphase, setBphase] = useState<Phase>("ready");
  const [bclock, setBclock] = useState(0);
  const tA = useMemo(() => buildTable(bowlPath(bowl, hA * BOWL_H), 3000), [bowl, hA]);
  const tB = useMemo(() => buildTable(bowlPath(bowl, hB * BOWL_H), 3000), [bowl, hB]);
  const outline = useMemo(() => bowlOutline(bowl), [bowl]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<"A" | "B" | null>(null);

  const running = (view === "race" && phase === "run") || (view === "bowl" && bphase === "run");
  useFrame((_, dt) => {
    if (view === "race" && phase === "run") {
      const c = clock + dt * SPEED;
      if (c >= Tmax) {
        setClock(Tmax);
        finishRace();
      } else setClock(c);
    }
    if (view === "bowl" && bphase === "run") {
      const c = bclock + dt * SPEED;
      const end = Math.max(tA.T, tB.T);
      if (c >= end) {
        setBclock(end);
        finishBowl();
      } else setBclock(c);
    }
  }, running);

  // 끝나면 잠깐 보여 주고 저절로 다음 판
  useEffect(() => {
    if (view === "race" && phase === "done" && round < ROUNDS) {
      const id = setTimeout(nextRace, AUTO_MS);
      return () => clearTimeout(id);
    }
    if (view === "bowl" && bphase === "done" && bround < ROUNDS) {
      const id = setTimeout(newBowl, AUTO_MS + 800);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bphase, round, bround, view]);

  function finishRace() {
    setPhase("done");
    const win = order[0];
    if (pred === win) {
      cheer();
      setStar((s) => s + 1);
      setMsg({ t: "ok", s: `와, 맞혔어요! ⭐ 가장 빨리 도착한 길은 ‘${NAMES[win]}’(${tabs[win].T.toFixed(2)}초)예요!` });
    } else {
      oops();
      setMsg({ t: "bad", s: `아쉽지만 괜찮아요! 이긴 길은 ‘${NAMES[win]}’(${tabs[win].T.toFixed(2)}초)였어요. 다음 판에는 꼭 맞혀 봐요!` });
    }
  }
  function finishBowl() {
    setBphase("done");
    const same = isSimultaneous(bowl, hA * BOWL_H, hB * BOWL_H);
    const ok = (bpred === "same") === same;
    const detail = `공 A ${tA.T.toFixed(2)}초, 공 B ${tB.T.toFixed(2)}초`;
    if (ok) {
      cheer();
      setBstar((s) => s + 1);
      setMsg({ t: "ok", s: `잘 맞혔어요! ⭐ ${detail}. ${same ? "특별한 곡선 그릇에서는 어디서 놓아도 바닥에 같이 닿아요. 신기하죠?" : "이 그릇에서는 높이에 따라 도착 시간이 달라요."}` });
    } else {
      oops();
      setMsg({ t: "bad", s: `괜찮아요, 하나 배웠어요! ${detail}. ${same ? "이 그릇에서는 같이 닿았어요." : "이 그릇에서는 시간이 달랐어요."}` });
    }
  }

  const pickRace = (id: RaceId) => {
    if (phase !== "ready") return;
    tick();
    setPred(id);
    setClock(0);
    setPhase("run");
    setMsg({ t: "info", s: "출발! 구슬이 굴러가요. 내 구슬이 이길까요?" });
  };
  function nextRace() {
    setTi((i) => (i + 1 + rand(THETAS.length - 1)) % THETAS.length);
    setRound((r) => r + 1);
    setPred(null); setPhase("ready"); setClock(0); setHint(false);
    setMsg({ t: "info", s: "새 경주판이에요! 이길 것 같은 구슬을 톡 눌러요." });
  }
  const resetRace = () => {
    setRound(1); setStar(0); setPred(null); setPhase("ready"); setClock(0); setHint(false);
    setMsg({ t: "info", s: "처음부터 다시 해요. 이길 것 같은 구슬을 톡 눌러요!" });
  };
  const pickBowl = (p: "same" | "diff") => {
    if (bphase !== "ready" || Math.abs(hA - hB) < 0.2) return;
    tick();
    setBpred(p);
    setBclock(0);
    setBphase("run");
    setMsg({ t: "info", s: "두 공을 놓았어요! 바닥에 누가 먼저 닿을까요?" });
  };
  function newBowl() {
    const kinds: BowlId[] = ["cyc", "arc", "line"];
    const a = 0.7 + rand(26) / 100;
    const b = 0.15 + rand(30) / 100;
    setBowl(kinds[rand(3)]); setHA(a); setHB(b);
    setBround((r) => r + 1);
    setBpred(null); setBphase("ready"); setBclock(0);
    setMsg({ t: "info", s: "새 문제예요! 공을 끌어 높이를 바꾸고, 같이 닿을지 골라요." });
  }
  const resetBowl = () => {
    setBround(1); setBstar(0); setBpred(null); setBphase("ready"); setBclock(0); setBowl("cyc"); setHA(0.9); setHB(0.4);
    setMsg({ t: "info", s: "처음부터 다시 해요. 공을 끌어 높이를 바꿔 보세요!" });
  };
  const goView = (v: "race" | "bowl") => {
    setView(v);
    if (v === "race") setMsg({ t: "info", s: "이길 것 같은 구슬을 톡 눌러요!" });
    else setMsg({ t: "info", s: "공을 위아래로 끌어 높이를 정하고, 같이 닿을지 골라요." });
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
      <svg viewBox={`0 0 400 ${H}`} className="w-full select-none rounded-card bg-bg" style={{ touchAction: "manipulation" }} role="group" aria-label="출발점에서 도착점까지 가는 네 가지 길과 구슬 네 개">
        {IDS.map((id, k) => {
          const d = samples[k].map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.d).toFixed(1)}`).join("");
          const sel = pred === id;
          return <path key={id} d={d} fill="none" stroke={COLORS[id]} strokeWidth={sel ? 6 : 3.5} strokeLinecap="round" opacity={pred && !sel ? 0.4 : 1} />;
        })}
        <circle cx={X(0)} cy={Y(0)} r={7} fill="var(--ink)" />
        <text x={X(0) + 12} y={Y(0) - 8} fontSize={16} fontWeight={800} fill="var(--ink)">출발</text>
        <circle cx={X(race.xb)} cy={Y(race.yb)} r={7} fill="var(--ink)" />
        <text x={X(race.xb)} y={Y(race.yb) + 24} fontSize={16} fontWeight={800} fill="var(--ink)" textAnchor="end" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke">도착</text>
        {/* 고르는 구슬: 길 위에 서 있는 구슬을 톡 누르면 바로 출발 */}
        {phase === "ready" &&
          IDS.map((id) => {
            const p = race.paths[id](0.5);
            const cx = X(p.x), cy = Y(p.d);
            return (
              <g key={id} role="button" tabIndex={0} aria-label={`${NAMES[id]} 구슬이 이길 거라고 고르기`} style={{ cursor: "pointer" }}
                onClick={() => pickRace(id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pickRace(id))}>
                <circle cx={cx} cy={cy} r={34} fill="transparent" />
                <circle cx={cx} cy={cy} r={20} fill={COLORS[id]} opacity={0.25} className="animate-pulse" />
                <circle cx={cx} cy={cy} r={13} fill={COLORS[id]} stroke="var(--surface)" strokeWidth={3} />
              </g>
            );
          })}
        {phase !== "ready" && IDS.map((id) => {
          const p = posAt(tabs[id], clock);
          return <circle key={id} cx={X(p.x)} cy={Y(p.d)} r={id === pred ? 11 : 9} fill={COLORS[id]} stroke={id === pred ? "var(--ink)" : "var(--surface)"} strokeWidth={id === pred ? 3 : 2.5} />;
        })}
        {phase === "done" && <text x={X(race.xb) - 4} y={Y(race.yb) - 14} fontSize={22} textAnchor="middle">🏆</text>}
      </svg>
    );
  })();

  // ───── 그릇 그림: 공을 끌어서 높이를 정한다 ─────
  const BS = 105, BX = 200, BBASE = 165;
  const bx = (x: number) => BX + x * BS;
  const by = (h: number) => BBASE - h * BS;
  const wallX = (h: number) => bowlPath(bowl, h * BOWL_H)(0).x;
  const onBowlDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (bphase !== "ready" || !svgRef.current) return;
    const [px, py] = svgPoint(svgRef.current, e.clientX, e.clientY);
    const dA = Math.hypot(px - bx(wallX(hA)), py - (by(hA) - 10));
    const dB = Math.hypot(px - bx(-wallX(hB)), py - (by(hB) - 10));
    const best = dA <= dB ? "A" : "B";
    if (Math.min(dA, dB) > 46) return;
    drag.current = best;
    e.currentTarget.setPointerCapture(e.pointerId);
    onBowlMove(e);
  };
  const onBowlMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current || !svgRef.current) return;
    const [, py] = svgPoint(svgRef.current, e.clientX, e.clientY);
    const h = clamp((BBASE - py - 10) / BS, H_MIN, H_MAX);
    (drag.current === "A" ? setHA : setHB)(h);
  };
  const bowlSvg = (() => {
    const od = outline.map(([x, h], i) => `${i ? "L" : "M"}${bx(x).toFixed(1)} ${by(h).toFixed(1)}`).join("");
    const ball = (tb: ReturnType<typeof buildTable>, h0: number, color: string, label: string, sign: number, canDrag: boolean) => {
      const started = bphase !== "ready";
      const p = started ? posAt(tb, bclock) : tb.path(0);
      const h = h0 * BOWL_H - p.d;
      const arrived = started && bclock >= tb.T;
      const x = bx(sign * p.x) + (arrived ? sign * -12 : 0);
      return (
        <g>
          {canDrag && <circle cx={x} cy={by(h) - 10} r={22} fill={color} opacity={0.2} className="animate-pulse" />}
          <circle cx={x} cy={by(h) - 10} r={12} fill={color} stroke="var(--surface)" strokeWidth={2.5} />
          <text x={x} y={by(h) - 5.5} fontSize={13} fontWeight={800} fill="#fff" textAnchor="middle">{label}</text>
        </g>
      );
    };
    return (
      <svg ref={svgRef} viewBox="0 0 400 200" className="w-full select-none rounded-card bg-bg" style={{ touchAction: "none", cursor: bphase === "ready" ? "grab" : "default" }}
        onPointerDown={onBowlDown} onPointerMove={onBowlMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
        role="img" aria-label={`${BOWL_KO[bowl]}. 공 A 는 ${Math.round(hA * 100)}센티미터, 공 B 는 ${Math.round(hB * 100)}센티미터 높이예요. 공을 끌어서 높이를 바꿔요`}>
        <path d={od} fill="none" stroke="var(--ink)" strokeWidth={3.5} strokeLinejoin="round" />
        <text x={bx(0)} y={by(0) + 30} fontSize={14} fill="var(--muted)" textAnchor="middle">바닥</text>
        {ball(tA, hA, "#e11d48", "A", 1, bphase === "ready")}
        {ball(tB, hB, "#2563eb", "B", -1, bphase === "ready")}
        {bphase === "ready" && <text x={200} y={22} fontSize={15} fontWeight={700} fill="var(--muted)" textAnchor="middle">👆 공을 위아래로 끌어 보세요</text>}
      </svg>
    );
  })();

  const raceEnd = phase === "done" && round >= ROUNDS;
  const bowlEnd = bphase === "done" && bround >= ROUNDS;
  const tooClose = Math.abs(hA - hB) < 0.2;

  return (
    <Board>
      {view === "race" ? (
        <>
          <h3 className="text-lg font-extrabold">🛝 미끄럼틀 달리기 경주</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Stat label="판" value={`${round}/${ROUNDS}`} />
            <Stat label="별" value={stars(star)} tone={star ? "ok" : "plain"} />
          </div>
          <p className="mt-2 text-base font-bold">{phase === "ready" ? "👆 가장 빨리 도착할 것 같은 구슬을 톡 눌러요!" : phase === "run" ? "🏁 달려요! 내 구슬(굵은 테두리)을 응원해요" : "🏁 도착!"}</p>
          <div className="mt-1">{raceSvg}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden>
            {IDS.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[id] }} />{NAMES[id]}</span>
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
          {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">💡 구슬은 내려갈수록 점점 빨라져요. 처음에 가파르게 내려가는 길이 유리해요. 하지만 너무 멀리 돌아가면 손해예요!</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {phase === "done" && !raceEnd && <GButton variant="soft" className={BIG} onClick={nextRace}>바로 다음 판 ▶</GButton>}
            {raceEnd && <GButton variant="primary" className={BIG} onClick={resetRace}>🔄 한 번 더 하기</GButton>}
            {phase === "ready" && <GButton className={BIG} pressed={hint} onClick={() => setHint((v) => !v)}>💡 힌트</GButton>}
            {!raceEnd && <GButton className={BIG} onClick={resetRace} disabled={phase === "run"}>다시 하기</GButton>}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <GButton className={BIG} onClick={() => goView("bowl")} disabled={phase === "run"}>🔥 더 어려운 도전 해 보기 ▶</GButton>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-lg font-extrabold">🔥 더 어려운 도전: 높이가 달라도 같이 닿을까?</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Stat label="문제" value={`${bround}/${ROUNDS}`} />
            <Stat label="별" value={stars(bstar)} tone={bstar ? "ok" : "plain"} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="그릇 고르기">
            {(["cyc", "arc", "line"] as BowlId[]).map((k) => (
              <GButton key={k} className={BIG} variant={bowl === k ? "primary" : "ghost"} pressed={bowl === k} disabled={bphase !== "ready"} onClick={() => { tick(); setBowl(k); }}>{BOWL_KO[k]}</GButton>
            ))}
          </div>
          <div className="mt-2">{bowlSvg}</div>
          <p className="mt-2 text-base font-bold">
            {bphase === "ready" ? (tooClose ? "두 공의 높이를 서로 다르게 끌어 주세요." : "두 공을 같은 때에 놓으면 바닥에 같이 닿을까요? 골라 보세요!") : bphase === "run" ? "⏳ 굴러가는 중…" : "🏁 도착!"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="내 예측">
            <GButton className={BIG} variant="primary" disabled={bphase !== "ready" || tooClose} pressed={bpred === "same"} onClick={() => pickBowl("same")}>🤝 같이 닿아요</GButton>
            <GButton className={BIG} variant="primary" disabled={bphase !== "ready" || tooClose} pressed={bpred === "diff"} onClick={() => pickBowl("diff")}>↔️ 따로 닿아요</GButton>
          </div>
          <div className="mt-3"><Say tone={msg.t}>{bowlEnd ? `${msg.s} 5문제를 모두 했어요! 별 ${bstar}개를 모았어요. 대단해요!` : msg.s}</Say></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {bphase === "done" && !bowlEnd && <GButton variant="soft" className={BIG} onClick={newBowl}>바로 다음 문제 ▶</GButton>}
            {bowlEnd && <GButton variant="primary" className={BIG} onClick={resetBowl}>🔄 한 번 더 하기</GButton>}
            {!bowlEnd && <GButton className={BIG} onClick={resetBowl} disabled={bphase === "run"}>다시 하기</GButton>}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <GButton className={BIG} onClick={() => goView("race")} disabled={bphase === "run"}>◀ 쉬운 경주로 돌아가기</GButton>
          </div>
        </>
      )}
    </Board>
  );
}
