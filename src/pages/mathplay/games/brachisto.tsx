import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, stageClear, svgPoint, tick, useFrame, useStage } from "./kit";
import { BOWL_H, answerOf, bowlOutline, bowlPath, buildTable, isSimultaneous, makeRace, makeRound, posAt, type Ask, type BowlId, type RaceId, type RoundSpec } from "./brachisto.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
type Phase = "ready" | "run" | "done";

const IDS: RaceId[] = ["line", "cyc", "arc", "dip"];
const COLORS: Record<RaceId, string> = { line: "#f59e0b", cyc: "#ef4444", arc: "#3b82f6", dip: "#22c55e" };
const LIGHT: Record<RaceId, string> = { line: "#fde68a", cyc: "#fecaca", arc: "#bfdbfe", dip: "#bbf7d0" };
const DARK: Record<RaceId, string> = { line: "#b45309", cyc: "#b91c1c", arc: "#1d4ed8", dip: "#15803d" };
const PAL: Record<RaceId, string> = { line: "주황이", cyc: "빨강이", arc: "파랑이", dip: "초록이" };
const JUA = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
const NAMES: Record<RaceId, string> = { line: "곧은 길", cyc: "처음에 확 내려가는 길", arc: "둥근 길", dip: "푹 꺼졌다 올라오는 길" };
const BOWL_KO: Record<BowlId, string> = { cyc: "특별한 곡선 그릇", arc: "둥근 그릇", line: "곧은 경사 그릇" };
const ASK_KO: Record<Ask, string> = { first: "가장 빨리 도착할", second: "두 번째로 도착할", last: "꼴찌로(가장 늦게) 도착할" };
const ASK_DONE: Record<Ask, string> = { first: "1등", second: "2등", last: "꼴찌" };
const ROUNDS = 3; // 한 레벨 = 라운드 3개
const SPEED = 0.55;
const AUTO_MS = 3200;
const BIG = "!min-h-[48px] !text-base";
const H_MIN = 0.12, H_MAX = 0.95;

const askMsg = (s: RoundSpec): string =>
  s.kind === "race" ? `${ASK_KO[s.ask]} 것 같은 공 친구를 톡 눌러요!` : "공 친구를 위아래로 끌어 높이를 정하고, 바닥에 같이 닿을지 골라요!";

export default function BrachistoGame() {
  const level = useStage();
  const [spec, setSpec] = useState<RoundSpec>(() => makeRound(level, 0, Math.random));
  const [cleared, setCleared] = useState(0); // 깬 라운드 수 (0~3)
  const [msg, setMsg] = useState<Msg>(() => ({ t: "info", s: askMsg(spec) }));
  const [hint, setHint] = useState(false);
  const [lastOk, setLastOk] = useState(false);

  // 경주
  const rs = spec.kind === "race" ? spec : { theta: Math.PI, kf: 2.2, af: 1, ask: "first" as Ask };
  const [pred, setPred] = useState<RaceId | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [clock, setClock] = useState(0);
  const race = useMemo(() => makeRace(rs.theta, rs.kf, rs.af), [rs.theta, rs.kf, rs.af]);
  const tabs = useMemo(() => Object.fromEntries(IDS.map((id) => [id, buildTable(race.paths[id], 3000)])) as Record<RaceId, ReturnType<typeof buildTable>>, [race]);
  const Tmax = Math.max(...IDS.map((id) => tabs[id].T));
  const order = [...IDS].sort((a, b) => tabs[a].T - tabs[b].T);
  const answer = answerOf(order, rs.ask);

  // 그릇(같이 닿을까?)
  const [bowl, setBowl] = useState<BowlId>(spec.kind === "bowl" ? spec.bowl : "cyc");
  const [hA, setHA] = useState(spec.kind === "bowl" ? spec.hA : 0.9);
  const [hB, setHB] = useState(spec.kind === "bowl" ? spec.hB : 0.4);
  const [bpred, setBpred] = useState<"same" | "diff" | null>(null);
  const [bphase, setBphase] = useState<Phase>("ready");
  const [bclock, setBclock] = useState(0);
  const tA = useMemo(() => buildTable(bowlPath(bowl, hA * BOWL_H), 3000), [bowl, hA]);
  const tB = useMemo(() => buildTable(bowlPath(bowl, hB * BOWL_H), 3000), [bowl, hB]);
  const outline = useMemo(() => bowlOutline(bowl), [bowl]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<"A" | "B" | null>(null);

  const isRace = spec.kind === "race";
  const running = (isRace && phase === "run") || (!isRace && bphase === "run");
  useFrame((_, dt) => {
    if (isRace && phase === "run") {
      const c = clock + dt * SPEED;
      if (c >= Tmax) {
        setClock(Tmax);
        finishRace();
      } else setClock(c);
    }
    if (!isRace && bphase === "run") {
      const c = bclock + dt * SPEED;
      const end = Math.max(tA.T, tB.T);
      if (c >= end) {
        setBclock(end);
        finishBowl();
      } else setBclock(c);
    }
  }, running);

  // 라운드가 끝나면: 3개를 다 깼으면 레벨 클리어, 아니면 잠깐 보여 주고 저절로 다음(또는 다시) 라운드
  const roundDone = isRace ? phase === "done" : bphase === "done";
  useEffect(() => {
    if (!roundDone) return;
    if (lastOk && cleared >= ROUNDS) {
      const id = setTimeout(stageClear, 1200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => newRound(cleared), AUTO_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundDone, cleared, lastOk]);

  function newRound(idx: number) {
    const s = makeRound(level, idx, Math.random);
    setSpec(s);
    setPred(null); setPhase("ready"); setClock(0); setHint(false);
    setBpred(null); setBphase("ready"); setBclock(0);
    if (s.kind === "bowl") { setBowl(s.bowl); setHA(s.hA); setHB(s.hB); }
    setMsg({ t: "info", s: (lastOkRef.current ? "다음 라운드예요! " : "새 판으로 다시 도전! ") + askMsg(s) });
  }
  const lastOkRef = useRef(false);
  lastOkRef.current = lastOk;

  function win(text: string) {
    cheer();
    setLastOk(true);
    setCleared((c) => c + 1);
    setMsg({ t: "ok", s: text + (cleared + 1 >= ROUNDS ? ` 레벨 ${level}의 라운드 3개를 모두 깼어요!` : "") });
  }
  function lose(text: string) {
    oops();
    setLastOk(false);
    setMsg({ t: "bad", s: text });
  }
  function finishRace() {
    setPhase("done");
    const who = `‘${PAL[answer]}’(${NAMES[answer]}, ${tabs[answer].T.toFixed(2)}초)`;
    if (pred === answer) win(`와, 맞혔어요! ⭐ ${ASK_DONE[rs.ask]}은 ${who}예요!`);
    else lose(`아쉽지만 괜찮아요! ${ASK_DONE[rs.ask]}은 ${who}였어요. 새 판으로 다시 해 봐요!`);
  }
  function finishBowl() {
    setBphase("done");
    const same = isSimultaneous(bowl, hA * BOWL_H, hB * BOWL_H);
    const ok = (bpred === "same") === same;
    const detail = `공 A ${tA.T.toFixed(2)}초, 공 B ${tB.T.toFixed(2)}초`;
    if (ok) win(`잘 맞혔어요! ⭐ ${detail}. ${same ? "특별한 곡선 그릇에서는 어디서 놓아도 바닥에 같이 닿아요. 신기하죠?" : "이 그릇에서는 높이에 따라 도착 시간이 달라요."}`);
    else lose(`괜찮아요, 하나 배웠어요! ${detail}. ${same ? "이 그릇에서는 같이 닿았어요." : "이 그릇에서는 시간이 달랐어요."}`);
  }

  const pickRace = (id: RaceId) => {
    if (phase !== "ready") return;
    tick();
    setPred(id);
    setClock(0);
    setPhase("run");
    setMsg({ t: "info", s: "출발! 공 친구들이 미끄럼틀을 내려가요. 내 공을 응원해요!" });
  };
  const pickBowl = (p: "same" | "diff") => {
    if (bphase !== "ready" || Math.abs(hA - hB) < 0.2) return;
    tick();
    setBpred(p);
    setBclock(0);
    setBphase("run");
    setMsg({ t: "info", s: "두 공을 놓았어요! 바닥에 누가 먼저 닿을까요?" });
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
    // 고르는 공 친구 자리: 서로(이름표까지) 겹치지 않게 길 위에서 가장 떨어진 곳을 고른다
    const spots = {} as Record<RaceId, [number, number]>;
    const placed: [number, number][] = [];
    for (const id of ["cyc", "dip", "arc", "line"] as RaceId[]) {
      let best: [number, number] = [0, 0], bestD = -1;
      for (let u = 0.25; u <= 0.85; u += 0.05) {
        const q = race.paths[id](u);
        const c: [number, number] = [X(q.x), Y(q.d)];
        const d = placed.length ? Math.min(...placed.map(([px, py]) => Math.hypot((px - c[0]) * 0.8, (py - c[1]) * 1.3))) : 1e9;
        const score = Math.min(d, 90) - Math.abs(u - 0.5) * 20;
        if (score > bestD) { bestD = score; best = c; }
      }
      spots[id] = best;
      placed.push(best);
    }
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
            const [cx, cy] = spots[id];
            return (
              <g key={id} role="button" tabIndex={0} aria-label={`${PAL[id]}(${NAMES[id]})가 ${ASK_KO[rs.ask]} 거라고 고르기`} style={{ cursor: "pointer" }}
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
            const wrong = pred !== answer;
            const mood = done ? (id === pred && wrong ? "sad" : "happy") : "wow";
            const cls = done && id === answer ? "br-bounce" : done && id === pred && wrong ? "br-shake" : "";
            const tag = id === pred ? (done && !wrong ? "내 공! 정답" : "내 공!") : done && id === answer ? "정답!" : undefined;
            return <Face key={id} x={x} y={y} r={id === pred ? 13 : 11} id={id} mood={mood} crown={done && id === win} tag={tag} cls={cls} />;
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
    const fillD = `${od} L${bx(outline[outline.length - 1][0]).toFixed(1)} 214 L${bx(outline[0][0]).toFixed(1)} 214 Z`;
    const ball = (tb: ReturnType<typeof buildTable>, h0: number, who: "A" | "B", sign: number, canDrag: boolean) => {
      const started = bphase !== "ready";
      const p = started ? posAt(tb, bclock) : tb.path(0);
      const h = h0 * BOWL_H - p.d;
      const arrived = started && bclock >= tb.T;
      const x = bx(sign * p.x) + (arrived ? sign * -14 : 0);
      const y = by(h) - 12;
      const id: RaceId = who === "A" ? "cyc" : "arc";
      const done = bphase === "done";
      const okNow = done && lastOk;
      return (
        <g>
          {canDrag && <circle cx={x} cy={y} r={24} fill={COLORS[id]} opacity={0.25} className="animate-pulse" />}
          <Face x={x} y={y} r={13} id={id} mood={started && !done ? "wow" : done && !okNow ? "sad" : "happy"} tag={who} cls={done ? (okNow ? "br-bounce" : "br-shake") : ""} />
        </g>
      );
    };
    return (
      <svg ref={svgRef} viewBox="0 0 400 214" className="mx-auto w-full max-w-[640px] select-none rounded-card" style={{ touchAction: "none", cursor: bphase === "ready" ? "grab" : "default" }}
        onPointerDown={onBowlDown} onPointerMove={onBowlMove} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}
        role="img" aria-label={`${BOWL_KO[bowl]}. 공 A 는 ${Math.round(hA * 100)}센티미터, 공 B 는 ${Math.round(hB * 100)}센티미터 높이예요. 공을 끌어서 높이를 바꿔요`}>
        <SceneDefs />
        <rect x={0} y={0} width={400} height={214} rx={18} fill="url(#br-sky)" />
        <g className="gz-float" style={{ transformBox: "fill-box" }}><Cloud x={330} y={30} s={0.8} /></g>
        <path d={fillD} fill="url(#br-wood)" />
        <path d={od} fill="none" stroke="#92400e" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
        <path d={od} fill="none" stroke="#fde68a" strokeWidth={2} strokeLinejoin="round" opacity={0.8} transform="translate(0 -3)" />
        <g transform={`translate(${bx(0)} ${by(0) + 20})`}>
          <polygon points="0,-9 2.6,-3 9,-3 4,1.5 6,8 0,4 -6,8 -4,1.5 -9,-3 -2.6,-3" fill="#fde047" stroke="#b45309" strokeWidth={1.5} />
        </g>
        <text x={bx(0)} y={by(0) + 44} fontSize={14} fill="#78350f" textAnchor="middle" style={JUA}>바닥</text>
        {ball(tA, hA, "A", 1, bphase === "ready")}
        {ball(tB, hB, "B", -1, bphase === "ready")}
        {bphase === "ready" && <text x={200} y={24} fontSize={16} fill="#6b21a8" textAnchor="middle" stroke="#fff" strokeWidth={4} paintOrder="stroke" style={JUA}>👆 공 친구를 위아래로 끌어 보세요</text>}
      </svg>
    );
  })();

  const tooClose = Math.abs(hA - hB) < 0.2;
  const hintText = !isRace
    ? "💡 높은 곳에서 놓으면 더 멀리 가야 하지만 더 빨라지기도 해요. 그릇 모양에 따라 달라요!"
    : rs.ask === "first"
      ? "💡 공은 내려갈수록 빨라져요. 처음에 가파르게 내려가서 빨리 달리기 시작하는 길이 유리해요!"
      : rs.ask === "last"
        ? "💡 처음에 천천히 내려가는 길이나, 너무 멀리 돌아가는 길은 늦어요. 어느 쪽이 더 손해일까요?"
        : "💡 1등은 처음에 확 내려가는 길일 때가 많아요. 그다음은 누구일까요? 처음 기울기와 길이를 함께 봐요.";

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-game text-xl">레벨 {level} · 라운드 {Math.min(cleared + 1, ROUNDS)}/{ROUNDS}</span>
        <Stat label="깬 라운드" value={"⭐".repeat(cleared) || "0"} tone={cleared ? "ok" : "plain"} />
      </div>
      {isRace ? (
        <>
          <p className="mt-2 font-game text-xl">🛝 {ASK_KO[rs.ask]} 공 친구는 누구일까요?</p>
          <p className="mt-1 text-base font-bold">{phase === "ready" ? "👆 공 친구를 톡 누르면 바로 출발해요!" : phase === "run" ? "🏁 달려요! ‘내 공!’ 친구를 응원해요" : "🏁 도착!"}</p>
          <div className="mt-1">{raceSvg}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-hidden>
            {IDS.map((id) => (
              <span key={id} className="inline-flex items-center gap-1.5"><span className="inline-block h-4 w-4 rounded-full border-2" style={{ background: COLORS[id], borderColor: DARK[id] }} /><b className="font-game">{PAL[id]}</b> {NAMES[id]}</span>
            ))}
          </div>
          {phase === "done" && (
            <ol className="mt-3 space-y-1 rounded-card bg-bg p-3 text-base" aria-label="도착 순서">
              {order.map((id, i) => (
                <li key={id} className={`flex items-center gap-2 ${id === answer ? "font-bold" : ""}`}>
                  <span className="font-game w-16 text-lg">{i + 1}등{i === 0 ? " 👑" : ""}</span>
                  <span className="inline-block h-4 w-4 rounded-full border-2" style={{ background: COLORS[id], borderColor: DARK[id] }} aria-hidden />
                  <span className="flex-1"><b className="font-game">{PAL[id]}</b> · {NAMES[id]}</span>
                  <span className="tabular-nums">{tabs[id].T.toFixed(2)}초</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <>
          <p className="mt-2 font-game text-xl">🥣 {BOWL_KO[bowl]}: 높이가 달라도 바닥에 같이 닿을까요?</p>
          <div className="mt-2">{bowlSvg}</div>
          <p className="mt-2 text-base font-bold">
            {bphase === "ready" ? (tooClose ? "두 공의 높이를 서로 다르게 끌어 주세요." : "두 공을 같은 때에 놓으면 바닥에 같이 닿을까요? 골라 보세요!") : bphase === "run" ? "⏳ 굴러가는 중…" : "🏁 도착!"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="내 예측">
            <GButton className={BIG} variant="primary" disabled={bphase !== "ready" || tooClose} pressed={bpred === "same"} onClick={() => pickBowl("same")}>🤝 같이 닿아요</GButton>
            <GButton className={BIG} variant="primary" disabled={bphase !== "ready" || tooClose} pressed={bpred === "diff"} onClick={() => pickBowl("diff")}>↔️ 따로 닿아요</GButton>
          </div>
        </>
      )}
      <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>
      {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">{hintText}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {roundDone && !(lastOk && cleared >= ROUNDS) && <GButton variant="soft" className={BIG} onClick={() => newRound(cleared)}>바로 다음 ▶</GButton>}
        {!running && !roundDone && <GButton className={BIG} pressed={hint} onClick={() => setHint((v) => !v)}>💡 힌트</GButton>}
      </div>
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
