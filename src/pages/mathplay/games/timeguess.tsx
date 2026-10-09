import { useRef, useState } from "react";
import type { PointerEvent as RPointerEvent } from "react";
import { Board, GButton, Say, Stat, useFrame } from "./kit";

// ==PURE==
export type Rec = { target: number; t: number };
/** 멈춘 시간 − 목표 시간 (양수면 늦게 멈춤) */
export const errOf = (r: Rec) => r.t - r.target;
export const meanAbs = (rs: Rec[]) => (rs.length ? rs.reduce((s, r) => s + Math.abs(errOf(r)), 0) / rs.length : 0);
export const meanSigned = (rs: Rec[]) => (rs.length ? rs.reduce((s, r) => s + errOf(r), 0) / rs.length : 0);
export const closest = (rs: Rec[]): Rec | null => rs.reduce<Rec | null>((b, r) => (!b || Math.abs(errOf(r)) < Math.abs(errOf(b)) ? r : b), null);
// ==END==

const TARGETS = [5, 7, 10];
type Phase = "idle" | "run" | "done";

const f2 = (x: number) => x.toFixed(2);

export default function TimeGuessGame() {
  const [target, setTarget] = useState(10);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [always, setAlways] = useState(false);
  const [recs, setRecs] = useState<Rec[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const t0 = useRef(0);
  const skipClick = useRef(false);

  useFrame(() => setElapsed((performance.now() - t0.current) / 1000), phase === "run");

  const setP = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const start = () => {
    t0.current = performance.now();
    setElapsed(0);
    setP("run");
  };
  const stop = () => {
    const t = (performance.now() - t0.current) / 1000;
    setElapsed(t);
    setRecs((r) => [...r, { target, t }]);
    setP("done");
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (phaseRef.current === "run") {
      e.preventDefault();
      stop();
      skipClick.current = true;
      window.setTimeout(() => (skipClick.current = false), 400);
    }
  };
  const onClick = () => {
    if (skipClick.current) {
      skipClick.current = false;
      return;
    }
    if (phaseRef.current === "run") stop();
    else start();
  };

  const last = recs[recs.length - 1];
  const best = closest(recs);
  const avg = meanAbs(recs);
  const bias = meanSigned(recs);
  const visible = phase === "run" && (always || elapsed < 1);

  let say: { tone: "info" | "ok" | "bad"; text: string };
  if (phase === "idle" && !last) {
    say = { tone: "info", text: `‘시작’을 누르고 처음 1초 뒤부터는 속으로 세어요. ${target}초라고 느끼면 ‘멈춰’!` };
  } else if (phase === "run") {
    say = { tone: "info", text: visible ? "시작했어요! 숫자는 곧 사라져요." : "속으로 세는 중이에요… 때가 되었다고 느끼면 ‘멈춰’를 눌러요." };
  } else if (last) {
    const e = errOf(last);
    const a = Math.abs(e);
    const how = a < 0.005 ? "딱 맞았어요!" : `${f2(a)}초 ${e < 0 ? "일찍" : "늦게"} 멈췄어요.`;
    say = { tone: a <= 0.5 ? "ok" : "bad", text: `목표 ${last.target}초, 내 기록 ${f2(last.t)}초 → ${how}${a <= 0.3 ? " 정말 정확해요!" : a <= 0.5 ? " 아주 가까워요." : " 한 번 더 해 봐요."}` };
  } else {
    say = { tone: "info", text: "준비됐어요." };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">목표 시간</span>
        {TARGETS.map((t) => (
          <GButton key={t} pressed={target === t} disabled={phase === "run"} onClick={() => setTarget(t)} className="min-w-[56px]">
            {t}초
          </GButton>
        ))}
        <GButton pressed={always} onClick={() => setAlways((a) => !a)} title="켜면 숫자가 계속 보여요(쉬운 모드)">
          숫자 {always ? "계속 보임" : "숨기기"}
        </GButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="횟수" value={recs.length} />
        <Stat label="평균 오차" value={recs.length ? `${f2(avg)}초` : "-"} tone={recs.length && avg <= 0.5 ? "ok" : "plain"} />
        <Stat label="가장 가까운 기록" value={best ? `${f2(Math.abs(errOf(best)))}초` : "-"} tone={best ? "ok" : "plain"} />
      </div>

      <Board className="text-center">
        <p className="text-sm text-muted">목표</p>
        <p className="text-3xl font-extrabold text-accent">{target}초</p>
        <div className="my-3 flex h-24 items-center justify-center rounded-card bg-bg" aria-live="off">
          {phase === "run" ? (
            visible ? (
              <span className="text-5xl font-extrabold tabular-nums">{elapsed.toFixed(1)}</span>
            ) : (
              <span className="text-xl font-bold text-muted" aria-label="숫자를 숨겼어요">
                속으로 세는 중
                <span className="ml-1 inline-block animate-pulse">…</span>
              </span>
            )
          ) : phase === "done" && last ? (
            <span className="text-5xl font-extrabold tabular-nums">{f2(last.t)}<span className="ml-1 text-2xl">초</span></span>
          ) : (
            <span className="text-xl font-bold text-muted">준비</span>
          )}
        </div>
        <button
          type="button"
          onPointerDown={onPointerDown}
          onClick={onClick}
          className={`min-h-[72px] w-full touch-manipulation rounded-card text-2xl font-extrabold transition active:scale-[0.99] ${phase === "run" ? "bg-bad text-white" : "bg-accent text-accent-ink hover:brightness-110"}`}
        >
          {phase === "run" ? "멈춰!" : phase === "done" ? "다시 시작" : "시작"}
        </button>
      </Board>

      <Say tone={say.tone}>{say.text}</Say>

      {recs.length > 0 && (
        <Board>
          <h3 className="mb-2 text-sm font-bold">기록 (최근 순)</h3>
          <ul className="space-y-1 text-sm">
            {[...recs].reverse().slice(0, 8).map((r, i) => {
              const e = errOf(r);
              const idx = recs.length - i;
              return (
                <li key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-card bg-bg px-3 py-1.5">
                  <span className="text-muted">{idx}번째 · 목표 {r.target}초</span>
                  <span className="tabular-nums">
                    {f2(r.t)}초 <strong className={Math.abs(e) <= 0.5 ? "text-ok" : "text-bad"}>({e >= 0 ? "+" : "−"}{f2(Math.abs(e))})</strong>
                  </span>
                </li>
              );
            })}
          </ul>
          {recs.length >= 3 && (
            <p className="mt-2 text-sm">
              평균적으로 {Math.abs(bias) < 0.05 ? "거의 정확하게" : `${f2(Math.abs(bias))}초 ${bias < 0 ? "빨리(빠른 편)" : "늦게(느린 편)"}`} 멈추고 있어요.
            </p>
          )}
        </Board>
      )}

      <div className="flex flex-wrap gap-2">
        <GButton onClick={() => { setRecs([]); setP("idle"); setElapsed(0); }} disabled={phase === "run"}>
          다시 하기 (기록 지우기)
        </GButton>
      </div>
      <p className="text-xs text-muted">화면과 손가락의 반응 시간 때문에 0.1~0.2초 정도 늦게 눌릴 수 있어서 완벽하게 0초 오차를 만들기는 어려워요. 오차의 +는 늦게, −는 일찍 멈췄다는 뜻이에요.</p>
    </div>
  );
}
