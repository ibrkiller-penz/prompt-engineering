import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, rand, svgPoint, tick, useFrame } from "./kit";
import { BOWL_H, bowlOutline, bowlPath, buildTable, isSimultaneous, makeRace, posAt, type BowlId, type RaceId } from "./brachisto.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
type Phase = "ready" | "run" | "done";

const IDS: RaceId[] = ["line", "cyc", "arc", "dip"];
const COLORS: Record<RaceId, string> = { line: "#f59e0b", cyc: "#ef4444", arc: "#3b82f6", dip: "#22c55e" };
const LIGHT: Record<RaceId, string> = { line: "#fde68a", cyc: "#fecaca", arc: "#bfdbfe", dip: "#bbf7d0" };
const DARK: Record<RaceId, string> = { line: "#b45309", cyc: "#b91c1c", arc: "#1d4ed8", dip: "#15803d" };
const PAL: Record<RaceId, string> = { line: "주황이", cyc: "빨강이", arc: "파랑이", dip: "초록이" };
const JUA = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
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

  // ───── 경주 그림: 놀이터 미끄럼틀 ─────
  const raceSvg = (() => {
    const samples = IDS.map((id) => Array.from({ length: 101 }, (_, i) => race.paths[id](i / 100)));
    const maxD = Math.max(...samples.flat().map((p) => p.d));
    const maxX = Math.max(...samples.flat().map((p) => p.x));
    const s = Math.min(320 / maxX, 210 / maxD);
    const ox = 44, oy = 56;
    const X = (x: number) => ox + x * s;
    const Y = (d: number) => oy + d * s;
    const H = Math.round(oy + maxD * s + 44);
    const bxp = X(race.xb), byp = Y(race.yb);
    const rank = Object.fromEntries(order.map((id, i) => [id, i])) as Record<RaceId, number>;
    const win = order[0];
    return (
      <svg viewBox={`0 0 400 ${H}`} className="w-full select-none rounded-card" style={{ touchAction: "manipulation" }} role="group" aria-label="놀이터 미끄럼틀. 출발점에서 도착점까지 가는 네 가지 길과 공 친구 네 명">
        <SceneDefs />
        <rect x={0} y={0} width={400} height={H} rx={18} fill="url(#br-sky)" />
        <circle cx={360} cy={34} r={20} fill="#fde047" stroke="#f59e0b" strokeWidth={3} />
        <g className="gz-float" style={{ transformBox: "fill-box" }}><Cloud x={150} y={30} /></g>
        <g className="gz-float" style={{ transformBox: "fill-box", animationDelay: "1.5s" }}><Cloud x={260} y={52} s={0.8} /></g>
        <path d={`M0 ${H - 26} Q100 ${H - 40} 200 ${H - 28} T400 ${H - 30} V${H} H0 Z`} fill="url(#br-grass)" stroke="#16a34a" strokeWidth={2.5} />
        {/* 사다리 탑 */}
        <g>
          <rect x={ox - 26} y={oy + 4} width={8} height={H - oy - 30} rx={3} fill="#f97316" stroke="#c2410c" strokeWidth={2} />
          <rect x={ox - 4} y={oy + 4} width={8} height={H - oy - 30} rx={3} fill="#f97316" stroke="#c2410c" strokeWidth={2} />
          {Array.from({ length: Math.floor((H - oy - 40) / 20) }, (_, i) => (
            <rect key={i} x={ox - 20} y={oy + 18 + i * 20} width={18} height={5} rx={2.5} fill="#fdba74" stroke="#c2410c" strokeWidth={1.5} />
          ))}
          <rect x={ox - 32} y={oy - 6} width={44} height={12} rx={6} fill="#a855f7" stroke="#6b21a8" strokeWidth={2.5} />
        </g>
        {/* 결승 깃발 */}
        <g>
          <rect x={bxp - 90} y={byp + 9} width={104} height={10} rx={5} fill="#c4b5fd" stroke="#6d28d9" strokeWidth={2} />
          <line x1={bxp + 10} x2={bxp + 10} y1={byp + 10} y2={byp - 52} stroke="#6d28d9" strokeWidth={4} strokeLinecap="round" />
          <g>
            {Array.from({ length: 8 }, (_, i) => (
              <rect key={i} x={bxp + 10 - 32 + (i % 4) * 8} y={byp - 52 + Math.floor(i / 4) * 9} width={8} height={9} fill={(i + Math.floor(i / 4)) % 2 ? "#ffffff" : "#1f1630"} />
            ))}
            <rect x={bxp - 22} y={byp - 52} width={32} height={18} fill="none" stroke="#1f1630" strokeWidth={1.5} />
          </g>
        </g>
        {/* 레일 */}
        {IDS.map((id, k) => {
          const d = samples[k].map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.d).toFixed(1)}`).join("");
          const dim = pred && pred !== id ? 0.55 : 1;
          return (
            <g key={id} opacity={dim}>
              <path d={d} fill="none" stroke={DARK[id]} strokeWidth={pred === id ? 13 : 11} strokeLinecap="round" />
              <path d={d} fill="none" stroke={COLORS[id]} strokeWidth={pred === id ? 9 : 7} strokeLinecap="round" />
              <path d={d} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.6} transform="translate(0 -2)" />
            </g>
          );
        })}
        <text x={ox - 10} y={oy - 14} fontSize={17} fill="#6b21a8" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={JUA}>출발!</text>
        <text x={bxp - 30} y={byp + 38} fontSize={17} fill="#6b21a8" textAnchor="middle" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={JUA}>도착</text>
        {/* 고르는 공 친구: 길 위에 서 있는 친구를 톡 누르면 바로 출발 */}
        {phase === "ready" &&
          IDS.map((id) => {
            const p = race.paths[id](0.5);
            const cx = X(p.x), cy = Y(p.d);
            return (
              <g key={id} role="button" tabIndex={0} aria-label={`${PAL[id]}(${NAMES[id]})가 이길 거라고 고르기`} style={{ cursor: "pointer" }}
                onClick={() => pickRace(id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pickRace(id))}>
                <circle cx={cx} cy={cy} r={34} fill="transparent" />
                <circle cx={cx} cy={cy} r={23} fill={COLORS[id]} opacity={0.3} className="animate-pulse" />
                <Face x={cx} y={cy} r={15} id={id} mood="happy" tag={PAL[id]} />
              </g>
            );
          })}
        {phase !== "ready" &&
          [...IDS].sort((a, b) => (a === pred ? 1 : 0) - (b === pred ? 1 : 0)).map((id) => {
            const arrived = clock >= tabs[id].T;
            const p = posAt(tabs[id], clock);
            const x = arrived ? bxp - rank[id] * 24 : X(p.x);
            const y = arrived ? byp - 4 : Y(p.d);
            const done = phase === "done";
            const mood = done ? (id === win ? "happy" : id === pred ? "sad" : "happy") : "wow";
            const cls = done && id === win ? "br-bounce" : done && id === pred && pred !== win ? "br-shake" : "";
            return <Face key={id} x={x} y={y} r={id === pred ? 13 : 11} id={id} mood={mood} crown={done && id === win} tag={id === pred ? "내 공!" : undefined} cls={cls} />;
          })}
        {phase === "done" && (
          <g className="br-sparkle">
            <Sparkle x={bxp - 30} y={byp - 40} />
            <Sparkle x={bxp + 26} y={byp - 64} s={0.7} />
            <Sparkle x={bxp - 64} y={byp - 22} s={0.6} />
          </g>
        )}
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
    const fillD = `${od} L${bx(outline[outline.length - 1][0]).toFixed(1)} 200 L${bx(outline[0][0]).toFixed(1)} 200 Z`;
    const ball = (tb: ReturnType<typeof buildTable>, h0: number, who: "A" | "B", sign: number, canDrag: boolean) => {
      const started = bphase !== "ready";
      const p = started ? posAt(tb, bclock) : tb.path(0);
      const h = h0 * BOWL_H - p.d;
      const arrived = started && bclock >= tb.T;
      const x = bx(sign * p.x) + (arrived ? sign * -14 : 0);
      const y = by(h) - 12;
      const id: RaceId = who === "A" ? "cyc" : "arc";
      const done = bphase === "done";
      const okNow = done && msg.t === "ok";
      return (
        <g>
          {canDrag && <circle cx={x} cy={y} r={24} fill={COLORS[id]} opacity={0.25} className="animate-pulse" />}
          <Face x={x} y={y} r={13} id={id} mood={started && !done ? "wow" : done && !okNow ? "sad" : "happy"} tag={who} cls={done ? (okNow ? "br-bounce" : "br-shake") : ""} />
        </g>
      );
    };
    return (
      <svg ref={svgRef} viewBox="0 0 400 200" className="w-full select-none rounded-card" style={{ touchAction: "none", cursor: bphase === "ready" ? "grab" : "default" }}
        onPointerDown={onBowlDown} onPointerMove={onBowlMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
        role="img" aria-label={`${BOWL_KO[bowl]}. 공 A 는 ${Math.round(hA * 100)}센티미터, 공 B 는 ${Math.round(hB * 100)}센티미터 높이예요. 공을 끌어서 높이를 바꿔요`}>
        <SceneDefs />
        <rect x={0} y={0} width={400} height={200} rx={18} fill="url(#br-sky)" />
        <g className="gz-float" style={{ transformBox: "fill-box" }}><Cloud x={330} y={30} s={0.8} /></g>
        <path d={fillD} fill="url(#br-wood)" />
        <path d={od} fill="none" stroke="#92400e" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        <path d={od} fill="none" stroke="#fde68a" strokeWidth={2} strokeLinejoin="round" opacity={0.8} transform="translate(0 -3)" />
        <g transform={`translate(${bx(0)} ${by(0) + 22})`}>
          <polygon points="0,-9 2.6,-3 9,-3 4,1.5 6,8 0,4 -6,8 -4,1.5 -9,-3 -2.6,-3" fill="#fde047" stroke="#b45309" strokeWidth={1.5} />
        </g>
        <text x={bx(0)} y={by(0) + 33 + 10} fontSize={14} fill="#78350f" textAnchor="middle" style={JUA}>바닥</text>
        {ball(tA, hA, "A", 1, bphase === "ready")}
        {ball(tB, hB, "B", -1, bphase === "ready")}
        {bphase === "ready" && <text x={200} y={24} fontSize={16} fill="#6b21a8" textAnchor="middle" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={JUA}>👆 공 친구를 위아래로 끌어 보세요</text>}
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
          <h3 className="font-game text-2xl">🛝 미끄럼틀 달리기 경주</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Stat label="판" value={`${round}/${ROUNDS}`} />
            <Stat label="별" value={stars(star)} tone={star ? "ok" : "plain"} />
          </div>
          <p className="mt-2 text-base font-bold">{phase === "ready" ? "👆 가장 빨리 도착할 것 같은 공 친구를 톡 눌러요!" : phase === "run" ? "🏁 달려요! ‘내 공!’ 친구를 응원해요" : "🏁 도착!"}</p>
          <div className="mt-1">{raceSvg}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden>
            {IDS.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded-full border-2" style={{ background: COLORS[id], borderColor: DARK[id] }} /><b className="font-game">{PAL[id]}</b> {NAMES[id]}</span>
            ))}
          </div>
          {phase === "done" && (
            <ol className="mt-3 space-y-1 rounded-card bg-bg p-3 text-base" aria-label="도착 순서">
              {order.map((id, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="font-game w-16 text-lg">{i + 1}등{i === 0 ? " 👑" : ""}</span>
                  <span className="inline-block h-4 w-4 rounded-full border-2" style={{ background: COLORS[id], borderColor: DARK[id] }} aria-hidden />
                  <span className="flex-1"><b className="font-game">{PAL[id]}</b> · {NAMES[id]}</span>
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
          <h3 className="font-game text-2xl">🔥 더 어려운 도전: 높이가 달라도 같이 닿을까?</h3>
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

// ───── 그림 부품 ─────
function SceneDefs() {
  return (
    <defs>
      <linearGradient id="br-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bae6fd" />
        <stop offset="0.7" stopColor="#e0f2fe" />
        <stop offset="1" stopColor="#fef9c3" />
      </linearGradient>
      <linearGradient id="br-grass" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#86efac" />
        <stop offset="1" stopColor="#4ade80" />
      </linearGradient>
      <linearGradient id="br-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fef3c7" />
        <stop offset="1" stopColor="#fbbf24" />
      </linearGradient>
      {IDS.map((id) => (
        <radialGradient key={id} id={`br-ball-${id}`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={LIGHT[id]} />
          <stop offset="0.55" stopColor={COLORS[id]} />
          <stop offset="1" stopColor={DARK[id]} />
        </radialGradient>
      ))}
      <style>{`
        .br-bounce { animation: br-bounce .5s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: center bottom; }
        @keyframes br-bounce { from { transform: translateY(0) scale(1); } to { transform: translateY(-7px) scale(1.1); } }
        .br-shake { animation: br-shake .45s ease-in-out 3; transform-box: fill-box; transform-origin: center; }
        @keyframes br-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-4px) rotate(-8deg); } 75% { transform: translateX(4px) rotate(8deg); } }
        .br-sparkle { animation: br-tw 1.1s ease-in-out infinite; }
        @keyframes br-tw { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .br-bounce, .br-shake, .br-sparkle { animation: none; } }
      `}</style>
    </defs>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff" stroke="#bae6fd" strokeWidth={2}>
      <ellipse cx={0} cy={6} rx={30} ry={11} />
      <circle cx={-10} cy={0} r={12} />
      <circle cx={8} cy={-4} r={15} />
    </g>
  );
}

function Sparkle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3 Z" fill="#fde047" stroke="#f59e0b" strokeWidth={1.5} />;
}

/** 얼굴 있는 공 친구 */
function Face({ x, y, r, id, mood, crown, tag, cls = "" }: { x: number; y: number; r: number; id: RaceId; mood: "happy" | "wow" | "sad"; crown?: boolean; tag?: string; cls?: string }) {
  const ink = "#1f1630";
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <g className={cls}>
        <ellipse cx={0} cy={r * 0.98} rx={r * 0.8} ry={r * 0.22} fill="#000" opacity={0.15} />
        <circle r={r} fill={`url(#br-ball-${id})`} stroke={DARK[id]} strokeWidth={2.5} />
        <ellipse cx={-r * 0.38} cy={-r * 0.5} rx={r * 0.28} ry={r * 0.16} fill="#fff" opacity={0.6} transform={`rotate(-30 ${-r * 0.38} ${-r * 0.5})`} />
        <ellipse cx={-r * 0.33} cy={-r * 0.08} rx={r * 0.12} ry={r * 0.17} fill={ink} />
        <ellipse cx={r * 0.33} cy={-r * 0.08} rx={r * 0.12} ry={r * 0.17} fill={ink} />
        <circle cx={-r * 0.29} cy={-r * 0.15} r={r * 0.05} fill="#fff" />
        <circle cx={r * 0.37} cy={-r * 0.15} r={r * 0.05} fill="#fff" />
        <ellipse cx={-r * 0.6} cy={r * 0.22} rx={r * 0.15} ry={r * 0.09} fill="#fb7185" opacity={0.7} />
        <ellipse cx={r * 0.6} cy={r * 0.22} rx={r * 0.15} ry={r * 0.09} fill="#fb7185" opacity={0.7} />
        {mood === "happy" && <path d={`M${-r * 0.28} ${r * 0.2} Q0 ${r * 0.55} ${r * 0.28} ${r * 0.2}`} fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />}
        {mood === "wow" && <ellipse cx={0} cy={r * 0.33} rx={r * 0.13} ry={r * 0.17} fill={ink} />}
        {mood === "sad" && <path d={`M${-r * 0.25} ${r * 0.42} Q0 ${r * 0.18} ${r * 0.25} ${r * 0.42}`} fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" />}
        {crown && (
          <path d={`M${-r * 0.7} ${-r * 0.8} L${-r * 0.75} ${-r * 1.55} L${-r * 0.35} ${-r * 1.15} L0 ${-r * 1.7} L${r * 0.35} ${-r * 1.15} L${r * 0.75} ${-r * 1.55} L${r * 0.7} ${-r * 0.8} Z`} fill="#fbbf24" stroke="#b45309" strokeWidth={2} strokeLinejoin="round" />
        )}
      </g>
      {tag && (
        <g transform={`translate(0 ${-r - (crown ? r * 0.9 : 0) - 14})`}>
          <rect x={-tag.length * 7 - 6} y={-11} width={tag.length * 14 + 12} height={20} rx={10} fill="#ffffff" stroke={DARK[id]} strokeWidth={2} />
          <text y={4} fontSize={13} fill={DARK[id]} textAnchor="middle" style={JUA}>{tag}</text>
        </g>
      )}
    </g>
  );
}
