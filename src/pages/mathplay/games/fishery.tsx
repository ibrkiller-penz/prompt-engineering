import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, cheer, oops, tick, useFrame } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { BOAT, FISH_CSS, Fish, NetKnob, NetRing, SEA_H, SEA_W, SeaBack, SeaDefs, fishPos } from "./fishery.art";
import { COLLAPSE, K, MSY, START, bestScore, simulate, stepYear } from "./fishery.logic";

type Msg = { t: string; tone: "info" | "ok" | "bad" };
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const MAXH = 300;
const STEP = 25;

type Anim = { k: number; caught: { x: number; y: number; dir: number; i: number }[]; bornFrom: number; bornTo: number };

/** 바닷속: 그림 한 마리 = 10마리. 그물이 잡을 물고기는 그물 동그라미가 씌워져요 */
function Tank({ n, h, t, anim, mood }: { n: number; h: number; t: number; anim: Anim | null; mood: "" | "party" | "shake" }) {
  const fish = Math.round(n / 10);
  const catching = Math.min(fish, Math.round(h / 10));
  return (
    <div className={`w-full ${mood === "shake" ? "sea-shake" : ""}`}>
      <svg viewBox={`0 0 ${SEA_W} ${SEA_H}`} className="block w-full rounded-[18px] border-[3px] border-[#0c4a6e] shadow-[0_4px_0_0_#0c4a6e]" role="img" aria-label={`바닷속. 물고기 약 ${Math.round(n)}마리 (그림 한 마리가 10마리). 그물로 ${h}마리를 잡을 거예요`}>
        <SeaDefs />
        <SeaBack />
        <g className={mood === "party" ? "fish-party" : ""}>
          {Array.from({ length: fish }, (_, i) => {
            const p = fishPos(i, t);
            const born = !!anim && i >= anim.bornFrom && i < anim.bornTo;
            return (
              <g key={born ? `b${anim!.k}-${i}` : i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}>
                <g className={born ? "fish-born" : ""}>
                  {i >= fish - catching && <NetRing />}
                  <g transform={`scale(${p.dir} 1)`}>
                    <Fish k={i} />
                  </g>
                  {born && <path className="sea-spark" d="M12 -12 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z" fill="#fef08a" stroke="#ca8a04" strokeWidth={0.6} />}
                </g>
              </g>
            );
          })}
        </g>
        {anim?.caught.map((c) => (
          <g key={`c${anim.k}-${c.i}`} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
            <g className="fish-catch" style={{ ["--dx" as string]: `${BOAT.x - c.x}px`, ["--dy" as string]: `${BOAT.y - c.y}px` }}>
              <NetRing />
              <g transform={`scale(${c.dir} 1)`}>
                <Fish k={c.i} />
              </g>
            </g>
          </g>
        ))}
        {fish === 0 && <text x={150} y={130} textAnchor="middle" fontSize={20} fill="#fff" style={{ fontFamily: "Jua, Pretendard Variable, sans-serif" }}>텅 비었어요…</text>}
      </svg>
    </div>
  );
}

/** 그물을 위아래로 끄는 큰 막대. 위로 갈수록 많이 잡아요 */
function NetSlider({ value, onChange, disabled, hint }: { value: number; onChange: (v: number) => void; disabled: boolean; hint: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const from = (clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientY - r.top - 28) / (r.height - 56)));
    const v = Math.round(((1 - ratio) * MAXH) / STEP) * STEP;
    if (v !== value) {
      tick();
      onChange(v);
    }
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = true;
    from(e.clientY);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current && !disabled) from(e.clientY);
  };
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(MAXH, value + STEP));
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(0, value - STEP));
    else return;
    e.preventDefault();
  };
  return (
    <div className="flex w-20 shrink-0 flex-col items-center">
      <span className="font-game mb-1 text-base text-accent">많이 ↑</span>
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="그물: 올해 잡을 물고기 수"
        aria-valuemin={0}
        aria-valuemax={MAXH}
        aria-valuenow={value}
        aria-valuetext={`${value}마리`}
        aria-orientation="vertical"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
        onKeyDown={key}
        style={{ touchAction: "none" }}
        className={`relative w-16 flex-1 select-none rounded-full border-[3px] border-[#0c4a6e] bg-gradient-to-b from-[#0369a1] via-[#0ea5e9] to-[#bae6fd] shadow-[0_4px_0_0_#0c4a6e] ${disabled ? "opacity-50" : "cursor-grab"}`}
      >
        {Array.from({ length: MAXH / STEP + 1 }, (_, k) => (
          <span key={k} className="pointer-events-none absolute left-1/2 h-0.5 w-5 -translate-x-1/2 rounded bg-white/70" style={{ top: `calc(28px + (100% - 56px) * ${1 - k / (MAXH / STEP)} - 1px)` }} />
        ))}
        <span className="pointer-events-none absolute left-1/2 h-14 w-14 -translate-x-1/2" style={{ top: `calc((100% - 56px) * ${1 - value / MAXH})` }}>
          <NetKnob />
        </span>
        {hint && (
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 animate-bounce text-3xl" style={{ top: `calc((100% - 56px) * ${1 - value / MAXH} + 52px)` }} aria-hidden="true">
            👆
          </span>
        )}
      </div>
      <span className="font-game mt-1 text-base text-muted">조금 ↓</span>
    </div>
  );
}

function Chart({ stock, years }: { stock: number[]; years: number }) {
  const W = 340,
    H = 150,
    L = 40,
    B = 24,
    T = 8,
    Rr = 10;
  const px = (y: number) => L + (y / years) * (W - L - Rr);
  const py = (v: number) => H - B - (v / K) * (H - B - T);
  const tick = years > 10 ? [0, 5, 10, 15, 20] : Array.from({ length: years + 1 }, (_, i) => i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="해마다 바다에 있는 물고기 수 그래프">
      {[0, 500, 1000].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - Rr} y1={py(v)} y2={py(v)} stroke="var(--line)" />
          <text x={L - 4} y={py(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{v}</text>
        </g>
      ))}
      <line x1={L} x2={W - Rr} y1={py(COLLAPSE)} y2={py(COLLAPSE)} stroke="#ef4444" strokeDasharray="4 3" />
      <text x={W - Rr} y={py(COLLAPSE) - 3} textAnchor="end" fontSize={11} fill="#ef4444">너무 적어요</text>
      <defs>
        <linearGradient id="fish-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#38bdf8" stopOpacity={0.5} />
          <stop offset="1" stopColor="#38bdf8" stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <polygon points={`${px(0)},${py(0)} ${stock.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")} ${px(stock.length - 1)},${py(0)}`} fill="url(#fish-area)" />
      <polyline points={stock.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")} fill="none" stroke="#0284c7" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      {stock.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={4} fill="#fff" stroke="#0284c7" strokeWidth={2.2} />
      ))}
      {tick.map((y) => (
        <text key={y} x={px(y)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">{y}년</text>
      ))}
    </svg>
  );
}

export default function FisheryGame() {
  const [years, setYears] = useState(7);
  const [h, setH] = useState(100);
  const [touched, setTouched] = useState(false);
  const [stock, setStock] = useState([START]);
  const [catches, setCatches] = useState<number[]>([]);
  const [done, setDone] = useState<"" | "end" | "collapse">("");
  const [stars, setStars] = useState(0);
  const [auto, setAuto] = useState(false);
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: `🎯 ${years}년 동안 물고기가 남게 하며 많이 잡아요. 그물을 위아래로 끌어 올해 잡을 마릿수를 정해요!`, tone: "info" });
  const [t, setT] = useState(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [acc, setAcc] = useState(0);

  const best = useMemo(() => bestScore(years), [years]);
  const sustain = useMemo(() => simulate(Array(years).fill(MSY)).total, [years]);

  const year = catches.length;
  const n = stock[stock.length - 1];
  const total = catches.reduce((a, b) => a + b, 0);

  const nextYear = () => {
    if (done) return;
    const r = stepYear(n, h);
    const c = [...catches, r.catchAmt];
    const s = [...stock, r.next];
    const tot = total + r.catchAmt;
    setCatches(c);
    setStock(s);
    const fOld = Math.round(n / 10);
    const cIcons = Math.min(fOld, Math.round(r.catchAmt / 10));
    const fNew = Math.round(r.next / 10);
    setAnim({
      k: c.length,
      caught: Array.from({ length: cIcons }, (_, j) => {
        const i = fOld - cIcons + j;
        return { ...fishPos(i, t), i };
      }),
      bornFrom: fOld - cIcons,
      bornTo: fNew,
    });
    if (r.collapsed) {
      oops();
      setDone("collapse");
      setAuto(false);
      setStars(0);
      setMsg({ t: `앗, 물고기가 ${Math.round(r.next)}마리로 너무 적어졌어요. 괜찮아요! 다음엔 그물을 조금 내려 봐요.`, tone: "bad" });
    } else if (c.length >= years) {
      const st = tot >= sustain ? 3 : tot >= sustain * 0.7 ? 2 : 1;
      cheer();
      setDone("end");
      setAuto(false);
      setStars(st);
      setWins((w) => w + 1);
      setMsg({ t: `해냈어요! ${years}년 동안 물고기를 지켰어요. 별 ${st}개!`, tone: "ok" });
    } else {
      tick();
      const delta = r.next - n;
      setMsg({
        t: `${c.length}년째: ${Math.round(r.catchAmt)}마리를 잡았어요. 바다에 ${Math.round(r.next)}마리가 남았어요. ${delta >= 0 ? "물고기가 늘었어요!" : "내년엔 물고기가 줄어요. 그물을 조금 내려 볼까요?"}`,
        tone: delta >= 0 ? "ok" : "info",
      });
    }
  };

  useFrame((_tt, dt) => {
    if (!reduced()) setT((x) => x + dt);
    if (auto) {
      const a = acc + dt;
      if (a >= 0.7) {
        setAcc(0);
        nextYear();
      } else setAcc(a);
    }
  }, true);

  const reset = (y = years) => {
    setAnim(null);
    setYears(y);
    setStock([START]);
    setCatches([]);
    setDone("");
    setStars(0);
    setAuto(false);
    setMsg({ t: y === 7 ? "다시 시작해요! 7년 동안 물고기를 지켜 봐요." : "20년 도전이에요! 오래오래 물고기를 지켜 봐요.", tone: "info" });
  };

  return (
    <div className="space-y-3">
      <style>{FISH_CSS}</style>
      <Board className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill label="해" value={`${year}/${years}`} />
          <Pill label="🌊" value={`${Math.round(n)}마리`} tone={n < 250 ? "bad" : "plain"} />
          <Pill label="🪣" value={`${Math.round(total)}마리`} />
          {wins > 0 && <Pill label="성공" value={`${wins}번`} tone="ok" />}
        </div>
        {done && <p className="gz-pop text-center text-4xl"><Stars n={stars} /></p>}
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <div className="mx-auto flex max-w-[560px] gap-2">
          <div className="min-w-0 flex-1">
            <Tank n={n} h={done ? 0 : h} t={t} anim={anim} mood={done === "end" ? "party" : done === "collapse" ? "shake" : ""} />
          </div>
          <NetSlider value={h} onChange={(v) => { setH(v); setTouched(true); }} disabled={!!done} hint={!touched && !done} />
        </div>
        <p className="font-game text-center text-3xl tabular-nums">올해 <span className="text-accent">{h}</span>마리 잡기 <span className="text-sm font-normal text-muted">(🐟 하나 = 10마리)</span></p>
        <div className="flex gap-2">
          <GButton variant="primary" className="min-h-[60px]! flex-1 text-2xl" onClick={nextYear} disabled={!!done}>한 해 지나기 ▶</GButton>
          <GButton className={`${BIG} min-h-[60px]!`} onClick={() => reset()}>다시 하기</GButton>
        </div>
      </Board>

      {done && (
        <Board className="space-y-3">
          <h3 className="text-lg font-extrabold">{done === "end" ? "결과" : "아쉬워요, 다시 해 봐요"} <Stars n={stars} /></h3>
          <div className="space-y-2 text-base" role="img" aria-label={`내가 잡은 물고기 ${Math.round(total)}마리, 해마다 ${MSY}마리씩 잡을 때 ${Math.round(sustain)}마리`}>
            {(years === 20 && done === "end"
              ? [["내가 잡은 물고기", total, "bg-accent"], [`해마다 ${MSY}마리`, sustain, "bg-ok"], ["컴퓨터가 찾은 가장 많은 양", best, "bg-muted"]]
              : [["내가 잡은 물고기", total, "bg-accent"], [`해마다 ${MSY}마리`, sustain, "bg-ok"]]
            ).map(([l, v, c]) => (
              <div key={l as string} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm sm:w-44 sm:text-base">{l}</span>
                <div className="h-5 flex-1 rounded-full bg-bg"><div className={`h-5 rounded-full ${c}`} style={{ width: `${Math.min(100, ((v as number) / Math.max(best, sustain, total)) * 100)}%` }} /></div>
                <strong className="w-14 text-right tabular-nums">{Math.round(v as number)}</strong>
              </div>
            ))}
          </div>
          <p className="rounded-card bg-accent-soft/60 p-4 text-base leading-relaxed">
            💡 이 바다에서는 해마다 <strong>{MSY}마리쯤</strong> 잡으면 물고기가 줄지 않고 오래오래 잡을 수 있어요. 그보다 많이 잡으면 물고기가 점점 줄어요.
            {years === 20 && done === "end" ? " 마지막 해에 한꺼번에 많이 잡으면 점수는 더 높아지지만, 그다음 해부터는 잡을 물고기가 없어요." : ""}
          </p>
          <GButton variant="primary" className={BIG} onClick={() => reset()}>또 해 보기 ▶</GButton>
        </Board>
      )}

      <Board>
        <p className="font-game mb-1 text-lg">🐟 바다의 물고기는 몇 마리일까요?</p>
        <Chart stock={stock} years={years} />
        <p className="text-sm text-muted">파란 선이 빨간 점선 아래로 내려가면 물고기가 너무 적은 거예요.</p>
      </Board>

      <details className="rounded-card border border-line bg-surface p-3">
        <summary className="flex min-h-[48px] cursor-pointer items-center text-base font-bold">🏆 더 어려운 도전</summary>
        <div className="mt-2 flex flex-wrap gap-2">
          <GButton className={BIG} pressed={years === 7} onClick={() => reset(7)}>7년 (쉬움)</GButton>
          <GButton className={BIG} pressed={years === 20} onClick={() => reset(20)}>20년 도전</GButton>
          <GButton className={BIG} onClick={() => setAuto((a) => !a)} disabled={!!done} pressed={auto}>{auto ? "⏸ 멈춤" : "⏩ 같은 양으로 자동 진행"}</GButton>
        </div>
      </details>
    </div>
  );
}
