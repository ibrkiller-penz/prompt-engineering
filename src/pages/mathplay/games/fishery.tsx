import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, cheer, oops, stageClear, tick, useFrame, useStage } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { BOAT, FISH_CSS, Fish, NetKnob, NetRing, SEA_H, SEA_W, SeaBack, SeaDefs, fishPos } from "./fishery.art";
import { COLLAPSE, K, fishRound, stepYear } from "./fishery.logic";

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
        {fish === 0 && <text x={150} y={130} textAnchor="middle" fontSize={20} fill="#fff" style={{ fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" }}>텅 비었어요…</text>}
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
  const stage = useStage();
  const [round, setRound] = useState(1);
  const q = useMemo(() => fishRound(stage, round), [stage, round]);
  const years = q.years;
  const msy = Math.round(q.msy);
  const [h, setH] = useState(50);
  const [touched, setTouched] = useState(false);
  const [stock, setStock] = useState([q.start]);
  const [catches, setCatches] = useState<number[]>([]);
  const [done, setDone] = useState<"" | "win" | "short" | "collapse">("");
  const [stars, setStars] = useState(0);
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: `🎯 ${years}년 동안 ${q.goal}마리 넘게 잡아요! 물고기가 너무 줄면 안 돼요. 그물을 위아래로 끌어 올해 잡을 마릿수를 정해요.`, tone: "info" });
  const [t, setT] = useState(0);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [left, setLeft] = useState(0);

  const year = catches.length;
  const n = stock[stock.length - 1];
  const total = catches.reduce((a, b) => a + b, 0);

  const nextYear = () => {
    if (done) return;
    const r = stepYear(n, h, q.r);
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
      setStars(0);
      setMsg({ t: `앗, 물고기가 ${Math.round(r.next)}마리로 너무 적어졌어요. 괜찮아요! 그물을 조금 내려서 다시 해 봐요.`, tone: "bad" });
    } else if (c.length >= years) {
      if (tot >= q.goal) {
        const st = tot >= q.best * 0.97 ? 3 : tot >= q.goal + (q.best - q.goal) / 2 ? 2 : 1;
        cheer();
        setDone("win");
        setStars(st);
        setWins((w) => w + 1);
        setLeft(round >= 3 ? 1.2 : 2.4);
        setMsg({ t: round >= 3 ? `해냈어요! 바다 3곳을 모두 지키며 잡았어요. 별 ${st}개!` : `해냈어요! ${Math.round(tot)}마리를 잡았어요. 별 ${st}개! 곧 다음 바다로 가요.`, tone: "ok" });
      } else {
        oops();
        setDone("short");
        setStars(0);
        setMsg({ t: `물고기는 지켰어요! 그런데 목표까지 ${Math.round(q.goal - tot)}마리 모자라요. 조금 더 잡아도 괜찮을 때가 있어요. 다시 해 봐요!`, tone: "bad" });
      }
    } else {
      tick();
      const delta = r.next - n;
      setMsg({
        t: `${c.length}년째: ${Math.round(r.catchAmt)}마리를 잡았어요. 바다에 ${Math.round(r.next)}마리가 남았어요. ${delta >= 0 ? "물고기가 늘었어요!" : "내년엔 물고기가 줄어요."}`,
        tone: delta >= 0 ? "ok" : "info",
      });
    }
  };

  useFrame((_tt, dt) => {
    if (!reduced()) setT((x) => x + dt);
    if (done === "win" && left > 0) {
      const nl = left - dt;
      if (nl <= 0) {
        setLeft(0);
        goNext();
      } else setLeft(nl);
    }
  }, true);

  const restart = (start: number, y: number, goal: number) => {
    setAnim(null);
    setStock([start]);
    setCatches([]);
    setDone("");
    setStars(0);
    setLeft(0);
    setMsg({ t: `🎯 ${y}년 동안 ${goal}마리 넘게 잡아요! 물고기가 너무 줄면 안 돼요.`, tone: "info" });
  };
  function goNext() {
    if (round >= 3) {
      stageClear();
      return;
    }
    const nq = fishRound(stage, round + 1);
    setRound(round + 1);
    restart(nq.start, nq.years, nq.goal);
  }

  return (
    <div className="space-y-3">
      <style>{FISH_CSS}</style>
      <Board className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-game rounded-full bg-accent px-4 py-1 text-lg text-white shadow-[0_3px_0_0_rgba(0,0,0,0.2)]">레벨 {stage} · 라운드 {round}/3</span>
          <span className="flex gap-1" aria-label={`바다 3곳 중 ${round - 1 + (done === "win" ? 1 : 0)}곳 성공`}>
            {[1, 2, 3].map((k) => (
              <span key={k} className={`text-2xl ${k < round || (k === round && done === "win") ? "" : "opacity-25 grayscale"}`}>🐳</span>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill label="해" value={`${year}/${years}`} />
          <Pill label="🌊" value={`${Math.round(n)}마리`} tone={n < 250 ? "bad" : "plain"} />
          <Pill label="🪣" value={`${Math.round(total)}마리`} tone={total >= q.goal ? "ok" : "plain"} />
        </div>
        <div aria-label={`목표 ${q.goal}마리 중 ${Math.round(total)}마리`} role="img">
          <div className="flex justify-between text-sm font-bold"><span>🎯 목표 {q.goal}마리</span><span>{Math.min(100, Math.round((total / q.goal) * 100))}%</span></div>
          <div className="mt-1 h-4 overflow-hidden rounded-full border-2 border-line bg-bg">
            <div className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f97316] transition-all" style={{ width: `${Math.min(100, (total / q.goal) * 100)}%` }} />
          </div>
        </div>
        {done && <p className="gz-pop text-center text-4xl"><Stars n={stars} /></p>}
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <div className="mx-auto flex max-w-[560px] gap-2">
          <div className="min-w-0 flex-1">
            <Tank n={n} h={done ? 0 : h} t={t} anim={anim} mood={done === "win" ? "party" : done ? "shake" : ""} />
          </div>
          <NetSlider value={h} onChange={(v) => { setH(v); setTouched(true); }} disabled={!!done} hint={!touched && !done} />
        </div>
        <p className="font-game text-center text-3xl tabular-nums">올해 <span className="text-accent">{h}</span>마리 잡기 <span className="text-sm font-normal text-muted">(🐟 하나 = 10마리)</span></p>
        {done === "win" ? (
          <GButton variant="primary" className="min-h-[60px]! w-full text-2xl" onClick={goNext}>{round >= 3 ? "🎉 레벨 클리어!" : `다음 바다 ▶ (${Math.max(1, Math.ceil(left))})`}</GButton>
        ) : (
          <div className="flex gap-2">
            <GButton variant="primary" className="min-h-[60px]! flex-1 text-2xl" onClick={done ? () => restart(q.start, years, q.goal) : nextYear}>{done ? "다시 해 보기 ▶" : "한 해 지나기 ▶"}</GButton>
            {!done && <GButton className={`${BIG} min-h-[60px]!`} onClick={() => restart(q.start, years, q.goal)}>다시 하기</GButton>}
          </div>
        )}
        {wins > 0 && <p className="text-center text-sm text-muted">성공 {wins}번</p>}
      </Board>

      {done && (
        <Board className="space-y-2">
          <p className="rounded-card bg-accent-soft/60 p-4 text-base leading-relaxed">
            💡 이 바다에서는 해마다 <strong>{msy}마리쯤</strong> 잡으면 물고기가 줄지 않고 오래오래 잡을 수 있어요. 그보다 많이 잡으면 물고기가 점점 줄어요. 처음 물고기가 적을 때는 조금만 잡고 늘기를 기다리는 것도 방법이에요.
          </p>
          <p className="text-sm text-muted">이번 판에서 컴퓨터가 찾은 가장 많은 양: {Math.round(q.best)}마리</p>
        </Board>
      )}

      <Board>
        <p className="font-game mb-1 text-lg">🐟 바다의 물고기는 몇 마리일까요?</p>
        <Chart stock={stock} years={years} />
        <p className="text-sm text-muted">파란 선이 빨간 점선 아래로 내려가면 물고기가 너무 적은 거예요.</p>
      </Board>
    </div>
  );
}
