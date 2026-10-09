import { useMemo, useState } from "react";
import { Board, GButton, Say, Slider, Stat, rand, useFrame } from "./kit";
import { BOWL_H, BOWL_NAMES, RACE_NAMES, bowlOutline, bowlPath, buildTable, isSimultaneous, makeRace, posAt, type BowlId, type RaceId } from "./brachisto.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
type Tab = "race" | "bowl";
type Phase = "ready" | "run" | "done";

const IDS: RaceId[] = ["line", "cyc", "arc", "dip"];
const COLORS: Record<RaceId, string> = { line: "#6b7280", cyc: "#e11d48", arc: "#2563eb", dip: "#16a34a" };
const THETAS = [2.2, 2.6, Math.PI, 3.4];

export default function BrachistoGame() {
  const [tab, setTab] = useState<Tab>("race");
  const [score, setScore] = useState(0);
  const [hit, setHit] = useState(0);
  const [tries, setTries] = useState(0);
  const [speed, setSpeed] = useState(0.5);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "먼저 어느 길이 이길지 예측해 보세요. 길이나 아래 단추를 누르면 돼요." });

  // 경주
  const [ti, setTi] = useState(2);
  const [pred, setPred] = useState<RaceId | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [clock, setClock] = useState(0);
  const race = useMemo(() => makeRace(THETAS[ti]), [ti]);
  const tabs = useMemo(() => Object.fromEntries(IDS.map((id) => [id, buildTable(race.paths[id], 3000)])) as Record<RaceId, ReturnType<typeof buildTable>>, [race]);
  const Tmax = Math.max(...IDS.map((id) => tabs[id].T));
  const order = [...IDS].sort((a, b) => tabs[a].T - tabs[b].T);

  // 그릇
  const [bowl, setBowl] = useState<BowlId>("cyc");
  const [hA, setHA] = useState(1);
  const [hB, setHB] = useState(0.4);
  const [bpred, setBpred] = useState<"same" | "diff" | null>(null);
  const [bphase, setBphase] = useState<Phase>("ready");
  const [bclock, setBclock] = useState(0);
  const tA = useMemo(() => buildTable(bowlPath(bowl, hA * BOWL_H), 3000), [bowl, hA]);
  const tB = useMemo(() => buildTable(bowlPath(bowl, hB * BOWL_H), 3000), [bowl, hB]);
  const outline = useMemo(() => bowlOutline(bowl), [bowl]);

  useFrame((_, dt) => {
    if (tab === "race" && phase === "run") {
      const c = clock + dt * speed;
      if (c >= Tmax) {
        setClock(Tmax);
        finishRace();
      } else setClock(c);
    }
    if (tab === "bowl" && bphase === "run") {
      const c = bclock + dt * speed;
      const end = Math.max(tA.T, tB.T);
      if (c >= end) {
        setBclock(end);
        finishBowl();
      } else setBclock(c);
    }
  }, (tab === "race" && phase === "run") || (tab === "bowl" && bphase === "run"));

  function finishRace() {
    setPhase("done");
    setTries((n) => n + 1);
    const win = order[0];
    if (pred === win) {
      setScore((s) => s + 10);
      setHit((h) => h + 1);
      setMsg({ t: "ok", s: `맞혔어요! 가장 빨리 도착한 길은 ‘${RACE_NAMES[win]}’(${tabs[win].T.toFixed(3)}초)예요. +10점 🎉` });
    } else {
      setMsg({ t: "bad", s: `아쉬워요. 이긴 길은 ‘${RACE_NAMES[win]}’(${tabs[win].T.toFixed(3)}초)예요. 내가 고른 ‘${pred ? RACE_NAMES[pred] : ""}’은(는) ${pred ? tabs[pred].T.toFixed(3) : ""}초 걸렸어요.` });
    }
  }
  function finishBowl() {
    setBphase("done");
    setTries((n) => n + 1);
    const same = isSimultaneous(bowl, hA * BOWL_H, hB * BOWL_H);
    const ok = (bpred === "same") === same;
    const dt = Math.abs(tA.T - tB.T) * 1000;
    const detail = `공 A ${tA.T.toFixed(3)}초, 공 B ${tB.T.toFixed(3)}초 (차이 ${dt.toFixed(1)} 밀리초)`;
    if (ok) {
      setScore((s) => s + 10);
      setHit((h) => h + 1);
      setMsg({ t: "ok", s: `맞혔어요! ${detail}. ${same ? "사이클로이드 그릇에서는 어디서 놓아도 바닥에 같은 시간에 도착해요. +10점 🎉" : "높이에 따라 도착 시간이 달라요. +10점 🎉"}` });
    } else {
      setMsg({ t: "bad", s: `아쉬워요. ${detail}. ${same ? "이 그릇에서는 같은 시간에 도착했어요." : "이 그릇에서는 도착 시간이 달라요."}` });
    }
  }

  const startRace = () => {
    if (!pred) return;
    setClock(0);
    setPhase("run");
    setMsg({ t: "info", s: "구슬이 굴러가요! 어느 길이 이길까요?" });
  };
  const newRace = () => {
    setTi((i) => (i + 1 + rand(THETAS.length - 1)) % THETAS.length);
    setPred(null);
    setPhase("ready");
    setClock(0);
    setMsg({ t: "info", s: "새 경주판이에요(도착점 B 의 위치가 바뀌었어요). 이길 길을 예측해 보세요." });
  };
  const resetAll = () => {
    setScore(0); setHit(0); setTries(0);
    if (tab === "race") {
      setPred(null); setPhase("ready"); setClock(0);
      setMsg({ t: "info", s: "처음부터 다시 해요. 이길 길을 예측해 보세요." });
    } else {
      setBpred(null); setBphase("ready"); setBclock(0);
      setMsg({ t: "info", s: "처음부터 다시 해요. 두 공이 같이 도착할지 예측해 보세요." });
    }
  };
  const startBowl = () => {
    if (!bpred) return;
    setBclock(0);
    setBphase("run");
    setMsg({ t: "info", s: "두 공을 놓았어요. 누가 먼저 바닥에 닿을까요?" });
  };
  const newBowl = () => {
    const kinds: BowlId[] = ["cyc", "arc", "line"];
    const k = kinds[rand(3)];
    const a = 0.7 + rand(4) * 0.1;
    const b = Math.round((0.15 + rand(3) * 0.1) * 100) / 100;
    setBowl(k); setHA(Math.round(a * 100) / 100); setHB(b);
    setBpred(null); setBphase("ready"); setBclock(0);
    setMsg({ t: "info", s: `${BOWL_NAMES[k]}이에요. 서로 다른 높이에서 놓은 두 공은 같이 도착할까요?` });
  };
  const changeTab = (t: Tab) => {
    setTab(t);
    setScore(0); setHit(0); setTries(0);
    if (t === "race") {
      setPhase("ready"); setClock(0); setPred(null);
      setMsg({ t: "info", s: "먼저 어느 길이 이길지 예측해 보세요. 길이나 아래 단추를 누르면 돼요." });
    } else {
      setBphase("ready"); setBclock(0); setBpred(null);
      setMsg({ t: "info", s: "그릇 모양과 공을 놓는 높이를 정하고, 두 공이 같이 도착할지 예측해 보세요." });
    }
  };

  // ───── 경주 그림 ─────
  const raceSvg = (() => {
    const samples = IDS.map((id) => Array.from({ length: 101 }, (_, i) => race.paths[id](i / 100)));
    const maxD = Math.max(...samples.flat().map((p) => p.d));
    const maxX = Math.max(...samples.flat().map((p) => p.x));
    const s = Math.min(330 / maxX, 220 / maxD);
    const ox = 34, oy = 30;
    const X = (x: number) => ox + x * s;
    const Y = (d: number) => oy + d * s;
    const H = Math.round(oy + maxD * s + 26);
    return (
      <svg viewBox={`0 0 400 ${H}`} className="w-full select-none rounded-card bg-bg" role="group" aria-label="점 A 에서 점 B 까지 가는 네 가지 길">
        <line x1={X(0)} x2={X(race.xb) + 6} y1={Y(0)} y2={Y(0)} stroke="var(--line)" strokeDasharray="4 4" />
        <line x1={X(race.xb)} x2={X(race.xb)} y1={Y(0)} y2={Y(race.yb)} stroke="var(--line)" strokeDasharray="4 4" />
        {IDS.map((id, k) => {
          const d = samples[k].map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)} ${Y(p.d).toFixed(1)}`).join("");
          const sel = pred === id;
          return (
            <g key={id}>
              <path d={d} fill="none" stroke={COLORS[id]} strokeWidth={sel ? 5 : 3} strokeLinecap="round" opacity={pred && !sel ? 0.45 : 1} />
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={22}
                style={{ cursor: phase === "ready" ? "pointer" : "default", touchAction: "manipulation" }}
                onClick={() => phase === "ready" && setPred(id)}
                role="button"
                aria-label={`${RACE_NAMES[id]}이(가) 이길 거라고 예측하기`}
                tabIndex={phase === "ready" ? 0 : -1}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && phase === "ready" && (e.preventDefault(), setPred(id))}
              />
            </g>
          );
        })}
        <circle cx={X(0)} cy={Y(0)} r={6} fill="var(--ink)" />
        <text x={X(0) + 10} y={Y(0) - 8} fontSize={14} fontWeight={800} fill="var(--ink)">A (출발)</text>
        <circle cx={X(race.xb)} cy={Y(race.yb)} r={6} fill="var(--ink)" />
        <text x={X(race.xb)} y={Y(race.yb) + 20} fontSize={14} fontWeight={800} fill="var(--ink)" textAnchor="end">B (도착)</text>
        {phase !== "ready" &&
          IDS.map((id) => {
            const p = posAt(tabs[id], clock);
            return <circle key={id} cx={X(p.x)} cy={Y(p.d)} r={8} fill={COLORS[id]} stroke="var(--surface)" strokeWidth={2.5} />;
          })}
        {phase === "ready" && IDS.map((id) => <circle key={id} cx={X(0)} cy={Y(0)} r={7} fill={COLORS[id]} opacity={0.0} />)}
      </svg>
    );
  })();

  // ───── 그릇 그림 ─────
  const BS = 105, BX = 200, BBASE = 150;
  const bx = (x: number) => BX + x * BS;
  const by = (h: number) => BBASE - h * BS;
  const bowlSvg = (() => {
    const od = outline.map(([x, h], i) => `${i ? "L" : "M"}${bx(x).toFixed(1)} ${by(h).toFixed(1)}`).join("");
    const ball = (tab_: ReturnType<typeof buildTable>, h0: number, color: string, label: string, dx: number) => {
      const started = bphase !== "ready";
      const p = started ? posAt(tab_, bclock) : tab_.path(0);
      const h = h0 * BOWL_H - p.d;
      const arrived = started && bclock >= tab_.T;
      return (
        <g>
          <circle cx={bx(p.x) + (arrived ? dx : 0)} cy={by(h) - 9} r={9} fill={color} stroke="var(--surface)" strokeWidth={2.5} />
          <text x={bx(p.x) + (arrived ? dx : 0)} y={by(h) - 6} fontSize={10} fontWeight={800} fill="#fff" textAnchor="middle">{label}</text>
        </g>
      );
    };
    const rel = (h: number) => <line x1={bx(-1.9)} x2={bx(1.9)} y1={by(h * BOWL_H)} y2={by(h * BOWL_H)} stroke="var(--line)" strokeDasharray="3 4" />;
    return (
      <svg viewBox="0 0 400 190" className="w-full select-none rounded-card bg-bg" role="img" aria-label={`${BOWL_NAMES[bowl]} 단면. 공 A 는 높이 ${Math.round(hA * 100)}센티미터, 공 B 는 ${Math.round(hB * 100)}센티미터에서 놓아요`}>
        {rel(hA)}{rel(hB)}
        <path d={od} fill="none" stroke="var(--ink)" strokeWidth={3.5} strokeLinejoin="round" />
        <line x1={bx(0)} x2={bx(0)} y1={by(0) + 4} y2={by(0) + 24} stroke="var(--muted)" />
        <text x={bx(0)} y={by(0) + 38} fontSize={12} fill="var(--muted)" textAnchor="middle">바닥</text>
        {ball(tA, hA, "#e11d48", "A", -11)}
        {ball(tB, hB, "#2563eb", "B", 11)}
      </svg>
    );
  })();

  const racing = phase === "run";
  const bracing = bphase === "run";

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="놀이 방법">
        <GButton variant={tab === "race" ? "primary" : "ghost"} pressed={tab === "race"} onClick={() => changeTab("race")}>구슬 경주</GButton>
        <GButton variant={tab === "bowl" ? "primary" : "ghost"} pressed={tab === "bowl"} onClick={() => changeTab("bowl")}>높이가 달라도 같이 도착?</GButton>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Stat label="점수" value={score} />
        <Stat label="맞힘/시도" value={`${hit}/${tries}`} />
        <Stat label="시계" value={`${(tab === "race" ? clock : bclock).toFixed(2)}초`} />
      </div>

      {tab === "race" ? (
        <>
          <p className="mt-3 text-[0.95rem]">A 에서 B 까지 구슬 네 개를 동시에 굴려요. 구슬은 가만히 놓아 출발하고, 중력만으로 내려와요.</p>
          <div className="mt-2">{raceSvg}</div>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="이길 길 예측하기">
            <span className="text-sm font-semibold">내 예측</span>
            {IDS.map((id) => (
              <GButton key={id} variant={pred === id ? "primary" : "ghost"} pressed={pred === id} disabled={phase !== "ready"} onClick={() => setPred(id)}>
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[id] }} aria-hidden />
                {RACE_NAMES[id]}
              </GButton>
            ))}
          </div>
          {phase === "done" && (
            <ol className="mt-3 space-y-1 rounded-card bg-bg p-3 text-sm" aria-label="도착 순서">
              {order.map((id, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="w-12 font-extrabold">{i + 1}등{i === 0 ? " 🏆" : ""}</span>
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[id] }} aria-hidden />
                  <span className="flex-1">{RACE_NAMES[id]}</span>
                  <span className="tabular-nums">{tabs[id].T.toFixed(3)}초</span>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>
          <div className="mt-3"><Slider label="구르는 속도" value={speed} min={0.2} max={1} step={0.1} onChange={setSpeed} show={(v) => `×${v.toFixed(1)}`} /></div>
          <div className="mt-2 flex flex-wrap gap-2">
            <GButton variant="primary" onClick={startRace} disabled={!pred || phase !== "ready"}>출발!</GButton>
            <GButton variant="soft" onClick={newRace} disabled={racing}>새 경주판</GButton>
            <GButton onClick={resetAll}>다시 하기</GButton>
          </div>
          <p className="mt-3 text-xs text-muted">이동 시간은 에너지 보존(속도 v = √(2gh))으로 길을 따라 수치 적분해서 계산했어요. 화면은 실제 시간보다 느리게 보여 줘요.</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-[0.95rem]">그릇의 서로 다른 높이에서 공 두 개를 동시에 가만히 놓아요. 바닥에 닿는 시간은 같을까요?</p>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="그릇 모양">
            {(["cyc", "arc", "line"] as BowlId[]).map((k) => (
              <GButton key={k} variant={bowl === k ? "primary" : "ghost"} pressed={bowl === k} disabled={bphase === "run"} onClick={() => { setBowl(k); setBphase("ready"); setBclock(0); }}>
                {BOWL_NAMES[k]}
              </GButton>
            ))}
          </div>
          <div className="mt-2">{bowlSvg}</div>
          <div className="mt-2 grid gap-x-6 md:grid-cols-2">
            <Slider label="공 A 높이" value={hA} min={0.1} max={1} step={0.05} onChange={(v) => { setHA(v); setBphase("ready"); setBclock(0); }} show={(v) => `${Math.round(v * 100)}cm`} />
            <Slider label="공 B 높이" value={hB} min={0.1} max={1} step={0.05} onChange={(v) => { setHB(v); setBphase("ready"); setBclock(0); }} show={(v) => `${Math.round(v * 100)}cm`} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="도착 시간 예측하기">
            <span className="text-sm font-semibold">내 예측</span>
            <GButton variant={bpred === "same" ? "primary" : "ghost"} pressed={bpred === "same"} disabled={bphase !== "ready"} onClick={() => setBpred("same")}>같이 도착해요</GButton>
            <GButton variant={bpred === "diff" ? "primary" : "ghost"} pressed={bpred === "diff"} disabled={bphase !== "ready"} onClick={() => setBpred("diff")}>시간이 달라요</GButton>
          </div>
          <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>
          <div className="mt-3"><Slider label="구르는 속도" value={speed} min={0.2} max={1} step={0.1} onChange={setSpeed} show={(v) => `×${v.toFixed(1)}`} /></div>
          <div className="mt-2 flex flex-wrap gap-2">
            <GButton variant="primary" onClick={startBowl} disabled={!bpred || bphase !== "ready" || Math.abs(hA - hB) < 0.05}>공 놓기!</GButton>
            <GButton variant="soft" onClick={newBowl} disabled={bracing}>새 문제</GButton>
            <GButton onClick={resetAll}>다시 하기</GButton>
          </div>
          {Math.abs(hA - hB) < 0.05 && <p className="mt-2 text-xs text-bad">두 공의 높이를 서로 다르게 해 주세요.</p>}
          <p className="mt-3 text-xs text-muted">같은 바닥 모양이라도 ‘사이클로이드 그릇’에서는 바닥까지 걸리는 시간이 π√(R/g) 로 놓는 높이와 상관이 없어요(등시곡선). 둥근 그릇은 아주 낮은 곳에서만 거의 같고, 곧은 경사는 높을수록 오래 걸려요.</p>
        </>
      )}
    </Board>
  );
}
