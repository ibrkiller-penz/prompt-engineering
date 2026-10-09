import { useMemo, useState } from "react";
import { Board, GButton, useFrame } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { COLLAPSE, K, MSY, START, bestScore, simulate, stepYear } from "./fishery.logic";

type Msg = { t: string; tone: "info" | "ok" | "bad" };
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Tank({ n, t }: { n: number; t: number }) {
  const fish = Math.round(n / 10);
  const list = Array.from({ length: fish }, (_, i) => {
    const bx = (i * 0.618034 * 7919) % 1;
    const by = (i * 0.754877 * 104729) % 1;
    const dir = i % 2 ? 1 : -1;
    const x = 20 + bx * 330 + Math.sin(t * 0.8 + i) * 8;
    const y = 18 + by * 125 + Math.cos(t * 0.6 + i * 1.7) * 3;
    return { i, x, y, dir, c: ["#f59e0b", "#fb7185", "#38bdf8", "#34d399"][i % 4] };
  });
  return (
    <svg viewBox="0 0 400 170" className="w-full rounded-card" role="img" aria-label={`수조. 물고기 약 ${Math.round(n)}마리 (그림 한 마리가 10마리)`}>
      <defs>
        <linearGradient id="fw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bae6fd" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="400" height="170" fill="url(#fw)" />
      <rect x="0" y="158" width="400" height="12" fill="#a8a29e" opacity="0.6" />
      {list.map((f) => (
        <g key={f.i} transform={`translate(${f.x} ${f.y}) scale(${f.dir} 1)`}>
          <ellipse cx="0" cy="0" rx="9" ry="5" fill={f.c} />
          <polygon points="-8,0 -15,-5 -15,5" fill={f.c} />
          <circle cx="4" cy="-1.2" r="1.2" fill="#0f172a" />
        </g>
      ))}
      {fish === 0 && <text x="200" y="90" textAnchor="middle" fontSize="16" fill="#fff">텅 비었어요…</text>}
    </svg>
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
      <polyline points={stock.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")} fill="none" stroke="#0ea5e9" strokeWidth={3} strokeLinejoin="round" />
      {stock.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={3.5} fill="#0ea5e9" />
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
  const [stock, setStock] = useState([START]);
  const [catches, setCatches] = useState<number[]>([]);
  const [done, setDone] = useState<"" | "end" | "collapse">("");
  const [stars, setStars] = useState(0);
  const [auto, setAuto] = useState(false);
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: `바다에 물고기가 ${START}마리 있어요. 올해 몇 마리를 잡을지 정하고 ‘다음 해’를 눌러요. 너무 많이 잡으면 내년에 물고기가 줄어요!`, tone: "info" });
  const [t, setT] = useState(0);
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
    if (r.collapsed) {
      setDone("collapse");
      setAuto(false);
      setStars(0);
      setMsg({ t: `앗, 물고기가 ${Math.round(r.next)}마리로 너무 적어졌어요. 괜찮아요! 다음엔 조금 덜 잡아 봐요. 다시 해 볼까요?`, tone: "bad" });
    } else if (c.length >= years) {
      const st = tot >= sustain ? 3 : tot >= sustain * 0.7 ? 2 : 1;
      setDone("end");
      setAuto(false);
      setStars(st);
      setWins((w) => w + 1);
      setMsg({ t: `와, 해냈어요! ${years}년 동안 물고기를 지켰어요. 모두 ${Math.round(tot)}마리를 잡았어요. 별 ${st}개!`, tone: "ok" });
    } else {
      const delta = r.next - n;
      setMsg({
        t: `${c.length}년째: ${Math.round(r.catchAmt)}마리를 잡았어요. 바다의 물고기가 ${Math.round(n)}마리에서 ${Math.round(r.next)}마리가 됐어요. ${delta >= 0 ? "물고기가 늘었어요!" : "내년엔 물고기가 줄어요. 조금 덜 잡아 볼까요?"}`,
        tone: delta >= 0 ? "ok" : "info",
      });
    }
  };

  useFrame((_tt, dt) => {
    if (!reduced()) setT((x) => x + dt);
    if (auto) {
      const a = acc + dt;
      if (a >= 0.6) {
        setAcc(0);
        nextYear();
      } else setAcc(a);
    }
  }, true);

  const reset = (y = years) => {
    setYears(y);
    setStock([START]);
    setCatches([]);
    setDone("");
    setStars(0);
    setAuto(false);
    setMsg({ t: y === 7 ? "다시 시작해요. 7년 동안 물고기를 지켜 봐요!" : "어려운 도전이에요! 20년 동안 물고기를 지켜 봐요.", tone: "info" });
  };

  const sustainTxt = Math.round(sustain);
  return (
    <div className="space-y-3">
      <Board className="space-y-3">
        <p className="text-base font-bold">🎯 목표: {years}년 동안 바다에 물고기가 남도록 하면서, 많이 잡아 봐요!</p>
        <div className="flex flex-wrap gap-2">
          <GButton className={BIG} pressed={years === 7} onClick={() => reset(7)}>쉬움 7년</GButton>
          <GButton className={BIG} pressed={years === 20} onClick={() => reset(20)}>🏆 더 어려운 도전 20년</GButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill label="지금" value={`${year}/${years}년`} />
          <Pill label="바다의 물고기" value={`${Math.round(n)}마리`} tone={n < 250 ? "bad" : "plain"} />
          <Pill label="잡은 물고기" value={`${Math.round(total)}마리`} />
          <Pill label="성공" value={`${wins}번`} tone={wins ? "ok" : "plain"} />
        </div>
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <Tank n={n} t={t} />
        <div className="space-y-1">
          <p className="text-base font-bold">올해 잡을 물고기는 몇 마리?</p>
          <div className="flex items-center gap-2">
            <GButton className={`${BIG} shrink-0`} onClick={() => setH((v) => Math.max(0, v - 25))} disabled={!!done} title="25마리 줄이기">− 25</GButton>
            <input type="range" min={0} max={300} step={25} value={h} disabled={!!done} onChange={(e) => setH(+e.target.value)} aria-label="올해 잡을 물고기 수" className="h-10 min-w-0 flex-1 accent-[var(--accent)]" />
            <GButton className={`${BIG} shrink-0`} onClick={() => setH((v) => Math.min(300, v + 25))} disabled={!!done} title="25마리 늘리기">+ 25</GButton>
          </div>
          <p className="text-center text-2xl font-extrabold tabular-nums">{h}마리</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GButton variant="primary" className={BIG} onClick={nextYear} disabled={!!done}>다음 해 ▶</GButton>
          <GButton className={BIG} onClick={() => reset()}>다시 하기</GButton>
        </div>
      </Board>

      <Board>
        <p className="mb-1 text-base font-bold">바다의 물고기는 몇 마리일까요?</p>
        <Chart stock={stock} years={years} />
        <p className="text-sm text-muted">파란 선이 빨간 점선 아래로 내려가면 물고기가 너무 적은 거예요.</p>
      </Board>

      {done && (
        <Board className="space-y-3">
          <h3 className="text-lg font-extrabold">{done === "end" ? "결과" : "아쉬워요, 다시 해 봐요"} <Stars n={stars} /></h3>
          <div className="space-y-2 text-base" role="img" aria-label={`내가 잡은 물고기 ${Math.round(total)}마리, 해마다 ${MSY}마리씩 잡을 때 ${sustainTxt}마리`}>
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
        </Board>
      )}

      <details className="rounded-card border border-line bg-surface p-3">
        <summary className="flex min-h-[48px] cursor-pointer items-center text-base font-bold">⚙ 더 해 보기</summary>
        <div className="mt-2">
          <GButton className={BIG} onClick={() => setAuto((a) => !a)} disabled={!!done} pressed={auto}>{auto ? "⏸ 멈춤" : "⏩ 같은 양으로 자동 진행"}</GButton>
          <p className="mt-2 text-sm text-muted">정한 양으로 한 해씩 저절로 넘어가요. 중간에 양을 바꿀 수도 있어요.</p>
        </div>
      </details>
    </div>
  );
}
