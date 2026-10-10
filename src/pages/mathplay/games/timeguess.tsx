import { useEffect, useRef, useState } from "react";
import { Board, Say, Stat, cheer, oops, stageClear, tick, useFrame, useStage } from "./kit";
import { Stars } from "./easykit";

// ==PURE==
export type Rec = { target: number; t: number };
/** 멈춘 시간 − 목표 시간 (양수면 늦게 멈춤) */
export const errOf = (r: Rec) => r.t - r.target;
export const meanAbs = (rs: Rec[]) => (rs.length ? rs.reduce((s, r) => s + Math.abs(errOf(r)), 0) / rs.length : 0);
export const meanSigned = (rs: Rec[]) => (rs.length ? rs.reduce((s, r) => s + errOf(r), 0) / rs.length : 0);
export const closest = (rs: Rec[]): Rec | null => rs.reduce<Rec | null>((b, r) => (!b || Math.abs(errOf(r)) < Math.abs(errOf(b)) ? r : b), null);
/** 레벨(1~10)별 규칙: 목표 초, 통과 오차(초), 숫자 보이기("all" 계속 / "first" 처음 1초 / "none" 안 보임) */
export function levelSpec(level: number): { target: number; tol: number; show: "all" | "first" | "none" } {
  const L = Math.max(1, Math.min(10, level));
  return {
    target: [3, 3, 4, 5, 5, 6, 7, 8, 9, 10][L - 1],
    tol: [1, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7, 0.6, 0.6, 0.5][L - 1],
    show: L <= 3 ? "all" : L <= 6 ? "first" : "none",
  };
}
/** 오차에 따른 별: 통과 오차의 1/3 이내 3개, 2/3 이내 2개, 통과 오차 이내 1개(통과), 넘으면 0개(다시) */
export const starsFor = (a: number, tol: number) => (a <= tol / 3 ? 3 : a <= (tol * 2) / 3 ? 2 : a <= tol ? 1 : 0);
// ==END==

type Phase = "idle" | "run" | "done";
const ROUNDS = 3;
const f2 = (x: number) => x.toFixed(2);
const REDUCE = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const CSS = `
@keyframes tg-hop { 0%,100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-14px) scale(1.04); } 60% { transform: translateY(0) scale(.98); } }
@keyframes tg-hop2 { 0%,100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-14px) scale(1.04); } 60% { transform: translateY(0) scale(.98); } }
@keyframes tg-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
@keyframes tg-shake2 { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-8px); } 40% { transform: translateX(8px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
.tg-hop0 { animation: tg-hop .7s ease-out; } .tg-hop1 { animation: tg-hop2 .7s ease-out; }
.tg-shake0 { animation: tg-shake .45s ease-in-out; } .tg-shake1 { animation: tg-shake2 .45s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .tg-hop0, .tg-hop1, .tg-shake0, .tg-shake1 { animation: none; } }
`;

export default function TimeGuessGame() {
  const level = useStage();
  const spec = levelSpec(level);
  const target = spec.target;
  const starsOf = (a: number) => starsFor(a, spec.tol);
  const timer = useRef(0);
  const [cleared, setCleared] = useState(0); // 깬 라운드 수
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [recs, setRecs] = useState<Rec[]>([]);
  const phaseRef = useRef<Phase>("idle");
  const t0 = useRef(0);
  const skipClick = useRef(false);
  const always = spec.show === "all";
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useFrame(() => setElapsed((performance.now() - t0.current) / 1000), phase === "run");

  const setP = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const full = cleared >= ROUNDS;
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
    if (starsOf(a) >= 1) {
      cheer();
      const n = cleared + 1;
      setCleared(n);
      if (n >= ROUNDS) timer.current = window.setTimeout(stageClear, 1200);
    } else oops();
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

  const last = recs[recs.length - 1];
  const best = closest(recs);
  const avg = meanAbs(recs);
  const bias = meanSigned(recs);
  const visible = phase === "run" && (always || (spec.show === "first" && elapsed < 1));
  const lastErr = last ? errOf(last) : 0;
  const lastStars = last ? starsOf(Math.abs(lastErr)) : 0;

  // 목표를 향해 물이 차올라요(숫자가 보일 때만)
  const prog = phase === "run" && visible ? Math.min(1, elapsed / target) : phase === "done" && always && last ? Math.min(1, last.t / last.target) : 0;
  const waterTop = 97 - prog * 94;
  const jelly =
    phase === "run"
      ? { g: "radial-gradient(circle at 35% 28%, #ffd0d0 0%, #ff5a5a 38%, #c81e1e 100%)", s: "#8f1414" }
      : phase === "done" && lastStars >= 1
        ? { g: "radial-gradient(circle at 35% 28%, #e3ffd9 0%, #4ade80 40%, #15803d 100%)", s: "#0f5c2c" }
        : phase === "done"
          ? { g: "radial-gradient(circle at 35% 28%, #fff7cc 0%, #fbbf24 40%, #d97706 100%)", s: "#9a5b05" }
          : { g: "radial-gradient(circle at 35% 28%, #ffe0d6 0%, #ff8a5c 38%, #e8552f 100%)", s: "#9a2d14" };
  const react = phase === "done" && last ? (lastStars >= 1 ? `tg-hop${recs.length % 2}` : `tg-shake${recs.length % 2}`) : "";

  let say: { tone: "info" | "ok" | "bad"; text: string };
  if (full) {
    say = { tone: "ok", text: `레벨 ${level} 클리어! 시간 감각이 대단해요!` };
  } else if (phase === "idle") {
    say = { tone: "info", text: `커다란 동그라미를 누르면 시작해요. 마음속으로 ${target}초를 세다가 ${target}초가 됐다고 느끼면 다시 눌러요!` };
  } else if (phase === "run") {
    say = { tone: "info", text: visible && always ? "시간이 흐르고 있어요. 목표 시간에 다시 눌러요!" : "속으로 세는 중이에요… 때가 되면 동그라미를 눌러요!" };
  } else if (last) {
    const a = Math.abs(lastErr);
    const how = a < 0.005 ? "딱 맞았어요!" : `${f2(a)}초 ${lastErr < 0 ? "일찍" : "늦게"} 멈췄어요.`;
    say = { tone: lastStars >= 1 ? "ok" : "bad", text: `목표 ${last.target}초, 내 기록 ${f2(last.t)}초 → ${how} ${lastStars === 3 ? "정말 정확해요! 대단해요!" : lastStars >= 1 ? "통과! 잘했어요! 다시 눌러 다음 라운드!" : `괜찮아요! ${spec.tol}초 안으로 맞추면 통과예요. 다시 눌러 봐요.`}` };
  } else {
    say = { tone: "info", text: "준비됐어요." };
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(cleared + 1, ROUNDS)}/${ROUNDS}`} />
        <Stat label="통과" value={`±${spec.tol}초`} />
        <Stat label="평균 차이" value={recs.length ? `${f2(avg)}초` : "-"} tone={recs.length && avg <= 0.5 ? "ok" : "plain"} />
        <Stat label="제일 가까운 기록" value={best ? `${f2(Math.abs(errOf(best)))}초` : "-"} tone={best ? "ok" : "plain"} />
      </div>

      <Board className="text-center">
        <style>{CSS}</style>
        <p className="font-game text-2xl">
          목표 <span className="text-4xl text-accent">{target}초</span>
        </p>
        <div className={`relative mx-auto my-3 w-[min(78vw,300px)] ${react}`} style={{ aspectRatio: "1" }}>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <clipPath id="tg-bowl">
                <circle cx="50" cy="50" r="47" />
              </clipPath>
              <linearGradient id="tg-water" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#7dd3fc" />
                <stop offset="1" stopColor="#0284c7" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="#eff9ff" stroke="#7dd3fc" strokeWidth="2.5" />
            <g clipPath="url(#tg-bowl)">
              <g transform={`translate(0 ${waterTop})`}>
                <path d="M -100 0 q 6.25 -3 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 t 12.5 0 L 200 120 L -100 120 Z" fill="url(#tg-water)" opacity="0.9">
                  {!REDUCE && <animateTransform attributeName="transform" type="translate" values="0 0;-25 0" dur="1.2s" repeatCount="indefinite" />}
                </path>
                {prog > 0.05 && <text x="80" y="-1" fontSize="9">🐟</text>}
              </g>
              {[18, 30, 72, 84].map((x, i) => (
                <circle key={x} cx={x} cy={88 - i * 3} r="1.6" fill="#fff" opacity={prog > 0.1 ? 0.8 : 0} />
              ))}
            </g>
            <circle cx="50" cy="50" r="48" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
            <path d="M 18 30 A 36 36 0 0 1 36 12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          </svg>
          <button
            type="button"
            onPointerDown={onPointerDown}
            onClick={onClick}
            disabled={full}
            aria-label={phase === "run" ? "멈춰" : "시작"}
            className="font-game absolute inset-[15%] flex touch-manipulation select-none flex-col items-center justify-center rounded-full text-white transition active:translate-y-[4px] active:scale-[0.98] disabled:opacity-50"
            style={{ background: jelly.g, boxShadow: `inset 0 -10px 0 rgba(0,0,0,0.12), inset 0 8px 14px rgba(255,255,255,0.45), 0 8px 0 ${jelly.s}, 0 16px 22px rgba(0,0,0,0.22)`, textShadow: "0 2px 0 rgba(0,0,0,0.25)" }}
          >
            <span className="pointer-events-none absolute left-[18%] top-[12%] h-[16%] w-[30%] -rotate-[25deg] rounded-full bg-white/60" aria-hidden="true" />
            {phase === "run" ? (
              visible ? (
                <>
                  <span className="text-6xl tabular-nums">{elapsed.toFixed(1)}</span>
                  <span className="mt-1 text-xl">눌러서 멈춰요!</span>
                </>
              ) : (
                <>
                  <span className="text-3xl">속으로 세는 중…</span>
                  <span className="mt-1 text-xl">눌러서 멈춰요!</span>
                </>
              )
            ) : phase === "done" && last ? (
              <>
                <span key={recs.length} className="gz-pop text-5xl tabular-nums">{f2(last.t)}초</span>
                <span className="mt-1 text-2xl" aria-hidden="true">{"⭐".repeat(lastStars) || "💪"}</span>
                {!full && <span className="mt-1 text-lg">다시 눌러요</span>}
              </>
            ) : (
              <>
                <span className="text-5xl">시작!</span>
                <span className="gz-bob mt-1 text-lg">👆 여기를 눌러요</span>
              </>
            )}
          </button>
        </div>
        {last && phase === "done" && <Stars n={lastStars} />}
        {spec.show !== "all" && phase !== "done" && <p className="text-base text-muted">{spec.show === "first" ? "숫자는 처음 1초만 보여요." : "이 레벨은 숫자가 안 보여요. 속으로 세어요!"}</p>}
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
                    {f2(r.t)}초 <strong className={Math.abs(e) <= spec.tol ? "text-ok" : "text-bad"}>({e >= 0 ? "+" : "−"}{f2(Math.abs(e))})</strong>
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

      <p className="text-base text-muted">손가락이 움직이는 시간 때문에 0.1~0.2초쯤 늦게 눌릴 수 있어요. 그래서 완벽하게 맞추기는 어려워요. (+는 늦게, −는 일찍 멈췄다는 뜻이에요.)</p>
    </div>
  );
}
