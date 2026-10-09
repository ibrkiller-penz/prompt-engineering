import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Slider, Stat, cheer, clamp, oops, stageClear, useFrame, useStage } from "./kit";
import { EPS_LIST, NMAX, QB, SYNC_FROM, SYNC_TOL, THRESH, firstDivergence, makePredict, orbit, predictOk, predictScore, predictTol, synced, type Predict } from "./chaos.math";

type Mode = "free" | "predict" | "sync";
type Msg = { t: "info" | "ok" | "bad"; s: string };

const W = 400;
const X0 = 34, X1 = 392;
const AY0 = 10, AY1 = 170; // 궤도 그래프
const DY0 = 206, DY1 = 286; // 차이 그래프
const COL_A = "#2563eb";
const COL_B = "#ea580c";

const f4 = (v: number) => v.toFixed(4);
const ROUNDS = 3;

export default function ChaosGame() {
  const level = useStage();
  const [mode, setMode] = useState<Mode>("predict");
  const [rounds, setRounds] = useState(0); // 이번 레벨에서 깬 라운드(예측 성공) 수
  const [r, setR] = useState(3.9);
  const [x0, setX0] = useState(0.3);
  const [ei, setEi] = useState(2);
  const [n, setN] = useState(0);
  const [auto, setAuto] = useState(false);
  const [pq, setPq] = useState<Predict | null>(() => makePredict(Math.random));
  const [guess, setGuess] = useState(20);
  const [answered, setAnswered] = useState(false);
  const [lvl, setLvl] = useState(0);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [hit, setHit] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: `두 궤도의 차이가 처음으로 0.5 를 넘는 해를 예측해 봐요(±${predictTol(level)}해 안이면 성공). ‘다음 해’로 조금 보고 예측해도 돼요.` });
  const accRef = useRef(0);

  const eps = mode === "predict" && pq ? pq.eps : mode === "sync" ? QB.eps : EPS_LIST[ei];
  const rr = mode === "predict" && pq ? pq.r : r;
  const sx = mode === "predict" && pq ? pq.x0 : mode === "sync" ? QB.x0 : x0;

  const A = useMemo(() => orbit(rr, sx, NMAX), [rr, sx]);
  const B = useMemo(() => orbit(rr, sx + eps, NMAX), [rr, sx, eps]);
  const div = useMemo(() => firstDivergence(rr, sx, eps), [rr, sx, eps]);

  useFrame((_, dt) => {
    accRef.current += dt;
    if (accRef.current >= 0.12) {
      accRef.current = 0;
      setN((v) => {
        if (v >= NMAX) {
          setAuto(false);
          return v;
        }
        return v + 1;
      });
    }
  }, auto);

  const px = (i: number) => X0 + (i / NMAX) * (X1 - X0);
  const ay = (v: number) => AY1 - clamp(v, 0, 1) * (AY1 - AY0);
  const dy = (v: number) => DY1 - clamp(v, 0, 1) * (DY1 - DY0);
  const path = (arr: number[], f: (v: number) => number) => arr.slice(0, n + 1).map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${f(v).toFixed(1)}`).join("");
  const diffs = useMemo(() => A.map((v, i) => Math.abs(v - B[i])), [A, B]);

  const resetRun = () => {
    setN(0);
    setAuto(false);
  };
  const toFree = () => {
    setMode("free");
    resetRun();
    setMsg({ t: "info", s: "r 과 시작값을 바꿔 보세요. r 이 작으면 두 궤도가 비슷하게 따라가고, r=3.9 에서는 갈라져요." });
  };
  const newPredict = () => {
    const q = makePredict(Math.random);
    setPq(q);
    setGuess(20);
    setAnswered(false);
    setN(0);
    setAuto(false);
    setMsg({ t: "info", s: `r=${q.r}, 시작값 ${q.x0}, 차이 ε=${q.eps} 예요. 두 궤도의 차이가 처음으로 ${THRESH} 를 넘는 해를 예측해 봐요.` });
  };
  const startPredict = () => {
    setMode("predict");
    setScore(0); setTries(0); setHit(0);
    newPredict();
  };
  const startSync = () => {
    setMode("sync");
    setLvl(0);
    setScore(0); setTries(0); setHit(0);
    setR(3.9);
    setN(NMAX);
    setAuto(false);
    setMsg({ t: "info", s: `도전 1: r 을 ${QB.levels[0].toFixed(1)} 이상으로 하면서, 마지막 20해(${SYNC_FROM}~${NMAX}해)에도 두 궤도의 차이가 ${SYNC_TOL} 이하로 붙어 있게 해 봐요.` });
  };

  const checkPredict = () => {
    if (!pq || answered || pq.answer === null) return;
    const s = predictScore(guess, pq.answer);
    setAnswered(true);
    setN(Math.min(NMAX, pq.answer));
    setTries((t) => t + 1);
    setScore((x) => x + s);
    const ok = predictOk(guess, pq.answer, level);
    const tail = ok ? (rounds + 1 >= ROUNDS ? ` 레벨 ${level}의 라운드 3개를 모두 깼어요!` : " 곧 다음 라운드예요.") : " 곧 새 문제가 나와요.";
    if (ok) {
      cheer();
      setHit((h) => h + 1);
      setRounds((r) => r + 1);
      setMsg({ t: "ok", s: (s === 10 ? `정확해요! ${pq.answer}해에 처음으로 차이가 ${THRESH} 를 넘었어요. +10점 🎉` : `성공! 정답은 ${pq.answer}해, 내 예측은 ${guess}해예요(±${predictTol(level)} 안). +${s}점`) + tail });
    } else {
      oops();
      setMsg({ t: "bad", s: `정답은 ${pq.answer}해예요. 내 예측은 ${guess}해였어요(±${predictTol(level)}해 안이어야 해요).` + tail });
    }
  };

  // 예측을 확인하면: 3라운드를 다 깼으면 레벨 클리어, 아니면 잠깐 뒤 저절로 새 문제
  useEffect(() => {
    if (mode !== "predict" || !answered) return;
    const id = rounds >= ROUNDS ? setTimeout(stageClear, 1200) : setTimeout(newPredict, 3000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, rounds, mode]);

  const checkSync = () => {
    setTries((t) => t + 1);
    setN(NMAX);
    const need = QB.levels[lvl];
    if (rr < need) {
      setMsg({ t: "bad", s: `r 을 ${need.toFixed(1)} 이상으로 해야 해요. 지금은 r=${rr.toFixed(2)} 예요.` });
      return;
    }
    if (synced(rr)) {
      const last = lvl + 1 >= QB.levels.length;
      setScore((s) => s + 10);
      setHit((h) => h + 1);
      setMsg({ t: "ok", s: `성공! r=${rr.toFixed(2)} 에서는 두 궤도가 끝까지 붙어 다녀요. +10점 🎉` + (last ? " 모든 도전을 마쳤어요!" : " ‘다음 도전’을 눌러요.") });
    } else {
      const d = div;
      setMsg({ t: "bad", s: `r=${rr.toFixed(2)} 에서는 ${d !== null ? `${d}해에 처음으로 ${THRESH} 이상 갈라져요.` : `마지막 20해에 차이가 ${SYNC_TOL} 보다 커져요.`} 더 작은 r 로 해 봐요.` });
    }
  };

  const nextSync = () => {
    if (lvl + 1 < QB.levels.length) {
      setLvl(lvl + 1);
      setMsg({ t: "info", s: `도전 ${lvl + 2}: 이번에는 r 을 ${QB.levels[lvl + 1].toFixed(1)} 이상으로 해 봐요. 큰 r 일수록 어려워요.` });
    } else setMsg({ t: "info", s: "도전을 모두 마쳤어요. ‘다시 하기’로 처음부터 해 볼 수 있어요." });
  };

  const stepNext = () => setN((v) => Math.min(NMAX, v + 1));
  const locked = mode !== "free";
  const shown = Math.min(n, NMAX);
  const diffNow = diffs[shown];
  const reveal = mode !== "predict" || answered || (div !== null && n >= div);

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="놀이 방법">
        <GButton variant={mode === "free" ? "primary" : "ghost"} pressed={mode === "free"} onClick={toFree}>자유 탐험</GButton>
        <GButton variant={mode === "predict" ? "primary" : "ghost"} pressed={mode === "predict"} onClick={startPredict}>갈라지는 해 예측</GButton>
        <GButton variant={mode === "sync" ? "primary" : "ghost"} pressed={mode === "sync"} onClick={startSync}>갈라지지 않게 하기</GButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "predict" && <span className="font-game text-lg">레벨 {level} · 라운드 {Math.min(rounds + 1, ROUNDS)}/{ROUNDS}</span>}
        <Stat label="해" value={`${shown}`} />
        <Stat label="차이" value={f4(diffNow)} tone={diffNow > THRESH ? "bad" : "plain"} />
        {mode !== "free" && <Stat label="점수" value={score} />}
        {mode !== "free" && <Stat label="맞힘/시도" value={`${hit}/${tries}`} />}
      </div>

      <svg viewBox={`0 0 ${W} 310`} className="mt-3 w-full select-none rounded-card bg-bg" role="img" aria-label={`로지스틱 사상 r=${rr}. 파란 궤도와 주황 궤도, 그리고 둘의 차이를 보여 주는 그래프`}>
        <rect x={X0} y={AY0} width={X1 - X0} height={AY1 - AY0} fill="var(--surface)" stroke="var(--line)" />
        <text x={X0 + 4} y={AY0 + 12} fontSize={11} fill="var(--muted)">x (0~1)</text>
        {[0.5].map((v) => <line key={v} x1={X0} x2={X1} y1={ay(v)} y2={ay(v)} stroke="var(--line)" strokeDasharray="3 3" />)}
        <path d={path(A, ay)} fill="none" stroke={COL_A} strokeWidth={2} strokeLinejoin="round" />
        <path d={path(B, ay)} fill="none" stroke={COL_B} strokeWidth={2} strokeLinejoin="round" strokeDasharray={n < 30 ? "5 3" : undefined} />
        <circle cx={px(shown)} cy={ay(A[shown])} r={4} fill={COL_A} />
        <circle cx={px(shown)} cy={ay(B[shown])} r={4} fill={COL_B} />

        <rect x={X0} y={DY0} width={X1 - X0} height={DY1 - DY0} fill="var(--surface)" stroke="var(--line)" />
        <text x={X0 + 4} y={DY0 + 12} fontSize={11} fill="var(--muted)">두 궤도의 차이 |x − y|</text>
        {mode === "sync" ? (
          <>
            <rect x={px(SYNC_FROM)} y={dy(SYNC_TOL)} width={px(NMAX) - px(SYNC_FROM)} height={DY1 - dy(SYNC_TOL)} fill="var(--color-ok-soft)" stroke="var(--color-ok)" />
            <text x={px(SYNC_FROM)} y={dy(SYNC_TOL) - 3} fontSize={10} fill="var(--color-ok)">목표 구역 (≤ {SYNC_TOL})</text>
          </>
        ) : (
          <>
            <line x1={X0} x2={X1} y1={dy(THRESH)} y2={dy(THRESH)} stroke="var(--color-bad)" strokeDasharray="4 3" />
            <text x={X1 - 2} y={dy(THRESH) - 3} fontSize={10} fill="var(--color-bad)" textAnchor="end">{THRESH}</text>
          </>
        )}
        <path d={path(diffs, dy)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        {reveal && div !== null && mode !== "sync" && n >= div && (
          <g>
            <line x1={px(div)} x2={px(div)} y1={AY0} y2={DY1} stroke="var(--color-bad)" strokeWidth={1.5} />
            <text x={px(div)} y={DY1 + 14} fontSize={11} fontWeight={700} fill="var(--color-bad)" textAnchor="middle">{div}해</text>
          </g>
        )}
        {[0, 20, 40, 60, 80].map((t) => <text key={t} x={px(t)} y={302} fontSize={10} fill="var(--muted)" textAnchor="middle">{t}</text>)}
        <text x={X0 - 4} y={AY0 + 8} fontSize={10} fill="var(--muted)" textAnchor="end">1</text>
        <text x={X0 - 4} y={AY1} fontSize={10} fill="var(--muted)" textAnchor="end">0</text>
      </svg>
      <p className="mt-1 text-xs text-muted">
        <span style={{ color: COL_A }}>━</span> 궤도 A: 시작값 x₀ = {sx} · <span style={{ color: COL_B }}>━</span> 궤도 B: 시작값 x₀ + ε = {(sx + eps).toFixed(4).replace(/0+$/, "")} (ε = {eps}) · 가로축은 해(n)
      </p>

      <div className="mt-2 rounded-card bg-bg px-3 py-2 text-sm tabular-nums">
        {shown}해: A = {f4(A[shown])}, B = {f4(B[shown])}, 차이 = {f4(diffNow)}
        <span className="ml-2 text-muted">(x_(n+1) = {rr.toFixed(2)} · x_n · (1 − x_n))</span>
      </div>

      <div className="mt-3 grid gap-x-6 gap-y-1 md:grid-cols-2">
        {mode === "predict" ? (
          <div className="text-sm font-semibold md:col-span-2">이번 문제: r = {pq?.r}, x₀ = {pq?.x0}, ε = {pq?.eps} (바꿀 수 없어요)</div>
        ) : (
          <>
            <Slider label="r (키우는 정도)" value={rr} min={2.5} max={4} step={0.01} onChange={(v) => { setR(v); if (mode === "free") resetRun(); }} show={(v) => v.toFixed(2)} />
            {mode === "free" && <Slider label="시작값 x₀" value={x0} min={0.05} max={0.89} step={0.01} onChange={(v) => { setX0(v); resetRun(); }} show={(v) => v.toFixed(2)} />}
          </>
        )}
      </div>
      {mode === "free" && (
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="두 시작값의 차이 ε">
          <span className="text-sm font-semibold">차이 ε</span>
          {EPS_LIST.map((e, i) => (
            <GButton key={e} variant={i === ei ? "primary" : "ghost"} pressed={i === ei} onClick={() => { setEi(i); resetRun(); }}>{e}</GButton>
          ))}
        </div>
      )}
      {mode === "sync" && <p className="mt-2 text-xs text-muted">이 도전에서는 시작값 x₀ = {QB.x0}, ε = {QB.eps} 로 정해져 있고, r 만 바꿀 수 있어요.</p>}

      {mode === "predict" && pq && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold">
            내 예측
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={NMAX}
              value={guess}
              disabled={answered}
              onChange={(e) => setGuess(clamp(Math.round(+e.target.value || 1), 1, NMAX))}
              className="min-h-[44px] w-24 rounded-card border border-line bg-surface px-3 text-center text-lg font-bold tabular-nums"
              aria-label="처음으로 차이가 0.5를 넘는 해 예측"
            />
            해
          </label>
          <GButton onClick={() => setGuess((g) => clamp(g - 1, 1, NMAX))} disabled={answered}>−1</GButton>
          <GButton onClick={() => setGuess((g) => clamp(g + 1, 1, NMAX))} disabled={answered}>+1</GButton>
          <GButton variant="primary" onClick={checkPredict} disabled={answered}>예측 확인</GButton>
        </div>
      )}

      <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "free" && (
          <>
            <GButton variant="soft" onClick={() => { setR(3.2); setEi(1); resetRun(); }}>r=3.2 (비슷해요)</GButton>
            <GButton variant="soft" onClick={() => { setR(3.9); setEi(3); resetRun(); }}>r=3.9, ε=0.0001</GButton>
          </>
        )}
        {mode !== "sync" && (
          <>
            <GButton variant="primary" onClick={stepNext} disabled={n >= NMAX}>다음 해</GButton>
            <GButton pressed={auto} onClick={() => setAuto((v) => !v)} disabled={n >= NMAX && !auto}>{auto ? "⏸ 멈추기" : "▶ 자동"}</GButton>
            <GButton onClick={() => { setAuto(false); setN(NMAX); }}>끝까지</GButton>
          </>
        )}
        {mode === "sync" && (
          <>
            <GButton variant="primary" onClick={checkSync}>이 r 로 확인</GButton>
            <GButton variant="soft" onClick={nextSync} disabled={!(hit > lvl)}>다음 도전</GButton>
          </>
        )}
        {mode === "predict" && <GButton variant="soft" onClick={newPredict}>새 문제</GButton>}
        {mode === "free" ? <GButton onClick={resetRun}>처음으로</GButton> : <GButton onClick={mode === "predict" ? startPredict : startSync}>다시 하기</GButton>}
      </div>
      {locked ? null : (
        <p className="mt-3 text-xs text-muted">r 이 작으면 두 궤도가 곧 비슷해지고, r 이 커지면(특히 3.57 보다 크면) 작은 차이가 해마다 커져서 크게 갈라질 수 있어요.</p>
      )}
    </Board>
  );
}
