import { useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, tick, useFrame } from "./kit";
import { BIG, Stars } from "./easykit";

// ==PURE==
export type Rec = { target: number; t: number };
/** 멈춘 시간 − 목표 시간 (양수면 늦게 멈춤) */
export const errOf = (r: Rec) => r.t - r.target;
export const meanAbs = (rs: Rec[]) => (rs.length ? rs.reduce((s, r) => s + Math.abs(errOf(r)), 0) / rs.length : 0);
export const meanSigned = (rs: Rec[]) => (rs.length ? rs.reduce((s, r) => s + errOf(r), 0) / rs.length : 0);
export const closest = (rs: Rec[]): Rec | null => rs.reduce<Rec | null>((b, r) => (!b || Math.abs(errOf(r)) < Math.abs(errOf(b)) ? r : b), null);
// ==END==

type Phase = "idle" | "run" | "done";
const ROUNDS = 5;
const f2 = (x: number) => x.toFixed(2);
const starsOf = (a: number) => (a <= 0.3 ? 3 : a <= 0.5 ? 2 : a <= 1 ? 1 : 0);

export default function TimeGuessGame() {
  const [hard, setHard] = useState(false);
  const [target, setTarget] = useState(5);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recs, setRecs] = useState<Rec[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const t0 = useRef(0);
  const skipClick = useRef(false);
  const always = !hard;

  useFrame(() => setElapsed((performance.now() - t0.current) / 1000), phase === "run");

  const setP = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const full = recs.length >= ROUNDS;
  const start = () => {
    if (full) return;
    t0.current = performance.now();
    setElapsed(0);
    setP("run");
    tick();
  };
  const stop = () => {
    const t = (performance.now() - t0.current) / 1000;
    setElapsed(t);
    setRecs((r) => [...r, { target, t }]);
    setP("done");
    const a = Math.abs(t - target);
    if (starsOf(a) >= 2) cheer();
    else if (starsOf(a) === 0) oops();
    else tick();
  };

  // 누르는 순간 바로 반응(pointerdown). 키보드(엔터·스페이스)는 click 으로 받아요.
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    skipClick.current = true;
    window.setTimeout(() => (skipClick.current = false), 400);
    if (phaseRef.current === "run") stop();
    else start();
  };
  const onClick = () => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (phaseRef.current === "run") stop();
    else start();
  };

  const reset = (h = hard, t = target) => {
    setRecs([]);
    setP("idle");
    setElapsed(0);
    setHard(h);
    setTarget(t);
  };

  const last = recs[recs.length - 1];
  const best = closest(recs);
  const avg = meanAbs(recs);
  const bias = meanSigned(recs);
  const visible = phase === "run" && (always || elapsed < 1);
  const lastErr = last ? errOf(last) : 0;
  const lastStars = last ? starsOf(Math.abs(lastErr)) : 0;

  // 목표를 향해 차오르는 둥근 띠(숫자가 보일 때만)
  const RING = 2 * Math.PI * 46;
  const prog = phase === "run" && visible ? Math.min(1, elapsed / target) : phase === "done" && always && last ? Math.min(1, last.t / last.target) : 0;
  const ringColor = phase === "done" ? (lastStars >= 2 ? "#16a34a" : "#f59e0b") : "#6366f1";

  let say: { tone: "info" | "ok" | "bad"; text: string };
  if (full) {
    say = { tone: "ok", text: `5번 다 했어요! 평균 ${f2(avg)}초 차이예요. ${avg <= 0.5 ? "대단해요! 시간 감각이 최고예요!" : "잘했어요! 또 하면 더 가까워질 거예요."}` };
  } else if (phase === "idle") {
    say = { tone: "info", text: `커다란 동그라미를 누르면 시작해요. 마음속으로 ${target}초를 세다가 ${target}초가 됐다고 느끼면 다시 눌러요!` };
  } else if (phase === "run") {
    say = { tone: "info", text: visible && always ? "시간이 흐르고 있어요. 목표 시간에 다시 눌러요!" : "속으로 세는 중이에요… 때가 되면 동그라미를 눌러요!" };
  } else if (last) {
    const a = Math.abs(lastErr);
    const how = a < 0.005 ? "딱 맞았어요!" : `${f2(a)}초 ${lastErr < 0 ? "일찍" : "늦게"} 멈췄어요.`;
    say = { tone: lastStars >= 2 ? "ok" : "bad", text: `목표 ${last.target}초, 내 기록 ${f2(last.t)}초 → ${how} ${a <= 0.3 ? "정말 정확해요! 대단해요!" : a <= 0.5 ? "아주 가까워요! 잘했어요!" : "괜찮아요! 다시 눌러 한 번 더 해 봐요."}` };
  } else {
    say = { tone: "info", text: "준비됐어요." };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="횟수" value={`${recs.length}/${ROUNDS}`} />
        <Stat label="평균 차이" value={recs.length ? `${f2(avg)}초` : "-"} tone={recs.length && avg <= 0.5 ? "ok" : "plain"} />
        <Stat label="제일 가까운 기록" value={best ? `${f2(Math.abs(errOf(best)))}초` : "-"} tone={best ? "ok" : "plain"} />
      </div>

      <Board className="text-center">
        <p className="text-lg font-bold">
          목표 <span className="text-2xl font-extrabold text-accent">{target}초</span>
        </p>
        <div className="relative mx-auto my-3 w-[min(78vw,300px)]" style={{ aspectRatio: "1" }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(120,120,120,0.2)" strokeWidth="4" />
            <circle cx="50" cy="50" r="46" fill="none" stroke={ringColor} strokeWidth="4" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - prog)} />
          </svg>
          <button
            type="button"
            onPointerDown={onPointerDown}
            onClick={onClick}
            disabled={full}
            aria-label={phase === "run" ? "멈춰" : "시작"}
            className={`absolute inset-[9%] flex touch-manipulation select-none flex-col items-center justify-center rounded-full text-white shadow-lg transition active:scale-[0.97] disabled:opacity-50 ${phase === "run" ? "bg-bad" : phase === "done" && lastStars >= 2 ? "bg-ok" : "bg-accent"}`}
          >
            {phase === "run" ? (
              visible ? (
                <>
                  <span className="text-5xl font-extrabold tabular-nums">{elapsed.toFixed(1)}</span>
                  <span className="mt-1 text-xl font-bold">눌러서 멈춰요!</span>
                </>
              ) : (
                <>
                  <span className="text-3xl font-extrabold">속으로 세는 중…</span>
                  <span className="mt-1 text-xl font-bold">눌러서 멈춰요!</span>
                </>
              )
            ) : phase === "done" && last ? (
              <>
                <span className="text-5xl font-extrabold tabular-nums">{f2(last.t)}초</span>
                <span className="mt-1 text-2xl" aria-hidden="true">{"⭐".repeat(lastStars) || "💪"}</span>
                {!full && <span className="mt-1 text-base font-bold">다시 눌러요</span>}
              </>
            ) : (
              <>
                <span className="text-4xl font-extrabold">시작!</span>
                <span className="mt-1 text-base font-bold animate-pulse">👆 여기를 눌러요</span>
              </>
            )}
          </button>
        </div>
        {last && phase === "done" && <Stars n={lastStars} />}
      </Board>

      <Say tone={say.tone}>{say.text}</Say>

      {recs.length > 0 && (
        <Board>
          <h3 className="mb-2 text-base font-bold">내 기록</h3>
          <ul className="space-y-1 text-base">
            {recs.map((r, i) => {
              const e = errOf(r);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-bg px-3 py-1.5">
                  <span className="text-muted">{i + 1}번째 · 목표 {r.target}초</span>
                  <span className="tabular-nums">
                    {f2(r.t)}초 <strong className={Math.abs(e) <= 0.5 ? "text-ok" : "text-bad"}>({e >= 0 ? "+" : "−"}{f2(Math.abs(e))})</strong>
                  </span>
                </li>
              );
            })}
          </ul>
          {recs.length >= 3 && (
            <p className="mt-2 text-base">
              평균적으로 {Math.abs(bias) < 0.05 ? "거의 정확하게" : `${f2(Math.abs(bias))}초 ${bias < 0 ? "빨리(빠른 편)" : "늦게(느린 편)"}`} 멈추고 있어요.
            </p>
          )}
        </Board>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {full && (
          <GButton variant="primary" onClick={() => reset()} className={BIG}>
            다시 하기
          </GButton>
        )}
        {!full && recs.length > 0 && phase !== "run" && (
          <GButton onClick={() => reset()} className={BIG}>
            다시 하기
          </GButton>
        )}
        <GButton pressed={hard} disabled={phase === "run"} className={BIG} onClick={() => reset(!hard, !hard ? 7 : 5)} title="숫자를 숨기고 7초·10초에 도전해요">
          더 어려운 도전 (숫자 숨기기)
        </GButton>
        {hard && [7, 10].map((t) => (
          <GButton key={t} pressed={target === t} disabled={phase === "run"} className={BIG} onClick={() => reset(true, t)}>
            {t}초
          </GButton>
        ))}
      </div>
      <p className="text-base text-muted">손가락이 움직이는 시간 때문에 0.1~0.2초쯤 늦게 눌릴 수 있어요. 그래서 완벽하게 맞추기는 어려워요. (+는 늦게, −는 일찍 멈췄다는 뜻이에요.)</p>
    </div>
  );
}
