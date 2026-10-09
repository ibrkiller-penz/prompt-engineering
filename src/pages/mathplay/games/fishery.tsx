import { useMemo, useState } from "react";
import { Board, GButton, Say, Slider, Stat, useFrame } from "./kit";
import { COLLAPSE, K, MSY, R as GROWTH, START, YEARS, bestScore, simulate, stepYear } from "./fishery.logic";

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

function Chart({ stock, catches }: { stock: number[]; catches: number[] }) {
  const W = 340,
    H = 150,
    L = 34,
    B = 22,
    T = 8,
    Rr = 8;
  const px = (y: number) => L + (y / YEARS) * (W - L - Rr);
  const py = (v: number) => H - B - (v / K) * (H - B - T);
  const bw = (W - L - Rr) / YEARS - 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="물고기 수와 해마다 잡은 양 그래프">
      {[0, 500, 1000].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - Rr} y1={py(v)} y2={py(v)} stroke="var(--line)" />
          <text x={L - 4} y={py(v) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">{v}</text>
        </g>
      ))}
      <line x1={L} x2={W - Rr} y1={py(COLLAPSE)} y2={py(COLLAPSE)} stroke="#ef4444" strokeDasharray="4 3" />
      <text x={W - Rr} y={py(COLLAPSE) - 2} textAnchor="end" fontSize={8} fill="#ef4444">붕괴선 {COLLAPSE}</text>
      {catches.map((c, i) => (
        <rect key={i} x={px(i + 1) - bw / 2} y={py((c / 300) * K)} width={bw} height={Math.max(0, H - B - py((c / 300) * K))} fill="#f59e0b" opacity={0.75} />
      ))}
      <polyline points={stock.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ")} fill="none" stroke="#0ea5e9" strokeWidth={2.5} strokeLinejoin="round" />
      {stock.map((v, i) => (
        <circle key={i} cx={px(i)} cy={py(v)} r={2.5} fill="#0ea5e9" />
      ))}
      {[0, 5, 10, 15, 20].map((y) => (
        <text key={y} x={px(y)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--muted)">{y}년</text>
      ))}
    </svg>
  );
}

export default function FisheryGame() {
  const [h, setH] = useState(100);
  const [stock, setStock] = useState([START]);
  const [catches, setCatches] = useState<number[]>([]);
  const [done, setDone] = useState<"" | "end" | "collapse">("");
  const [auto, setAuto] = useState(false);
  const [wins, setWins] = useState(0);
  const [bestMine, setBestMine] = useState(0);
  const [msg, setMsg] = useState<Msg>({ t: `물고기가 ${START}마리 있어요. 올해 잡을 양을 정하고 ‘다음 해’를 눌러요. ${COLLAPSE}마리 아래로 떨어지면 붕괴해요.`, tone: "info" });
  const [t, setT] = useState(0);
  const [acc, setAcc] = useState(0);

  const best = useMemo(() => bestScore(), []);
  const sustain = useMemo(() => simulate(Array(YEARS).fill(MSY)).total, []);

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
      setMsg({ t: `${c.length}년째에 물고기가 ${Math.round(r.next)}마리로 줄어 붕괴했어요… 너무 많이 잡았어요.`, tone: "bad" });
    } else if (c.length >= YEARS) {
      setDone("end");
      setAuto(false);
      setWins((w) => w + 1);
      setBestMine((b) => Math.max(b, Math.round(tot)));
      setMsg({ t: `20년을 버텼어요! 총 어획량 ${Math.round(tot)}.`, tone: "ok" });
    } else {
      const delta = r.next - n;
      setMsg({ t: `${c.length}년째: ${Math.round(r.catchAmt)}마리를 잡았어요. 물고기는 ${Math.round(n)} → ${Math.round(r.next)}마리 (${delta >= 0 ? "+" : ""}${Math.round(delta)}).`, tone: delta >= 0 ? "ok" : "info" });
    }
  };

  useFrame((_tt, dt) => {
    if (!reduced()) setT((x) => x + dt);
    if (auto) {
      const a = acc + dt;
      if (a >= 0.5) {
        setAcc(0);
        nextYear();
      } else setAcc(a);
    }
  }, true);

  const reset = () => {
    setStock([START]);
    setCatches([]);
    setDone("");
    setAuto(false);
    setMsg({ t: "다시 시작해요. 이번엔 어떻게 해 볼까요?", tone: "info" });
  };

  return (
    <div className="space-y-3">
      <Board className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Stat label="해" value={`${year} / ${YEARS}`} />
          <Stat label="물고기" value={Math.round(n)} tone={n < 250 ? "bad" : "plain"} />
          <Stat label="총 어획량" value={Math.round(total)} />
          <Stat label="내 최고 점수" value={bestMine || "-"} tone={bestMine ? "ok" : "plain"} />
          <Stat label="성공" value={wins} />
        </div>
        <Tank n={n} t={t} />
        <Slider label="올해 잡을 양" value={h} min={0} max={300} step={5} onChange={setH} show={(v) => `${v}마리`} />
        <div className="flex flex-wrap gap-2">
          <GButton variant="primary" onClick={nextYear} disabled={!!done}>다음 해 ▶</GButton>
          <GButton onClick={() => setAuto((a) => !a)} disabled={!!done} pressed={auto}>{auto ? "⏸ 멈춤" : "⏩ 자동 진행"}</GButton>
          <GButton onClick={reset}>다시 하기</GButton>
        </div>
        <Say tone={msg.tone}>{msg.t}</Say>
      </Board>

      <Board>
        <p className="mb-1 text-sm font-bold">물고기 수(파란 선)와 해마다 잡은 양(주황 막대)</p>
        <Chart stock={stock} catches={catches} />
        <p className="text-xs text-muted">막대는 최대 300마리가 그래프 맨 위에 오도록 그렸어요.</p>
      </Board>

      {done && (
        <Board className="space-y-2">
          <h3 className="font-extrabold">{done === "end" ? "결과" : "붕괴 결과"}</h3>
          <div className="space-y-1.5 text-sm" role="img" aria-label={`내 점수 ${Math.round(total)}, 해마다 ${MSY}마리씩 잡는 방법 ${Math.round(sustain)}, 계산으로 찾은 최고 점수 ${Math.round(best)}`}>
            {[["내 점수", total, "bg-accent"], [`해마다 ${MSY}마리`, sustain, "bg-ok"], ["계산으로 찾은 최고", best, "bg-muted"]].map(([l, v, c]) => (
              <div key={l as string} className="flex items-center gap-2">
                <span className="w-32 shrink-0">{l}</span>
                <div className="h-4 flex-1 rounded-full bg-bg"><div className={`h-4 rounded-full ${c}`} style={{ width: `${Math.min(100, ((v as number) / best) * 100)}%` }} /></div>
                <strong className="w-12 text-right tabular-nums">{Math.round(v as number)}</strong>
              </div>
            ))}
          </div>
          <p className="rounded-card bg-accent-soft/60 p-3 text-sm">
            이 모델은 N' = N + r·N·(1 − N/K) − 잡은 양 (r={GROWTH}, K={K}) 이에요. 물고기가 자라는 양은 K/2 = {K / 2}마리쯤에서 가장 커서 r·K/4 = <strong>{MSY}</strong>마리예요. 그래서 오래 계속 잡으려면 해마다 <strong>{MSY}마리 안팎</strong>이 한계예요.
            {done === "collapse" ? " 그보다 많이 잡으면 줄어든 물고기가 다시 불어나는 양도 작아져서 점점 더 빨리 줄어요." : ""}
            {" "}20년이 끝나는 마지막에 몰아 잡으면 점수가 더 높아질 수 있지만(최고 점수 {Math.round(best)}), 그 뒤에는 물고기가 남지 않아요.
          </p>
        </Board>
      )}
    </div>
  );
}
