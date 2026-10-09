import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";
import { circumscribed, fixes314, fmt, gap, inscribed, minSidesFor314, minSidesForGap } from "./archpi.math";

type Mode = "free" | "q314" | "qgap";
type Msg = { t: "info" | "ok" | "bad"; s: string };
const CHAIN = [6, 12, 24, 48, 96];
const TOLS = [0.1, 0.05, 0.01, 0.005, 0.002];
const MIN314 = minSidesFor314();

export default function ArchPiGame() {
  const [n, setN] = useState(6);
  const [mode, setMode] = useState<Mode>("free");
  const [tol, setTol] = useState(0.01);
  const [score, setScore] = useState(0);
  const [hit, setHit] = useState(0);
  const [tries, setTries] = useState(0);
  const [done1, setDone1] = useState(false); // 첫 성공
  const [doneMin, setDoneMin] = useState(false); // 최소 성공
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "변의 수를 늘려 보세요. 파란 안쪽 다각형과 주황 바깥쪽 다각형이 원에 점점 가까워져요." });

  const lo = inscribed(n), hi = circumscribed(n);
  const R = 100;
  const half = Math.max(R / Math.cos(Math.PI / n) + 14, 125);
  const cx = 0, cy = 0;
  const ptsIn = useMemo(() => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / n; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; }), [n]);
  const ptsOut = useMemo(() => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / n; const r2 = R / Math.cos(Math.PI / n); return [cx + r2 * Math.cos(a), cy + r2 * Math.sin(a)]; }), [n]);
  const poly = (p: number[][]) => p.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");

  // 구간 막대: π 가 가운데, 눈금은 n 에 맞춰 확대
  const span = Math.max(hi - Math.PI, Math.PI - lo) * 1.6;
  const a0 = Math.PI - span, a1 = Math.PI + span;
  const bx = (v: number) => 20 + ((v - a0) / (a1 - a0)) * 360;

  const set = (v: number) => setN(Math.max(3, Math.min(96, Math.round(v))));
  const double = () => set(n < 6 ? 6 : n * 2);

  const rows = useMemo(() => [...new Set([...CHAIN, n])].sort((a, b) => a - b), [n]);

  const change = (m: Mode) => {
    setMode(m);
    setScore(0); setHit(0); setTries(0); setDone1(false); setDoneMin(false);
    if (m === "free") setMsg({ t: "info", s: "변의 수를 늘려 보세요. 두 어림값 사이에 원주율 π 가 들어 있어요." });
    if (m === "q314") {
      setN(12);
      setMsg({ t: "info", s: "소수 둘째 자리까지 3.14 로 확정하려면, 아래 어림값이 3.14 이상이고 위 어림값이 3.15 보다 작아야 해요. 변을 몇 개로 하면 될까요?" });
    }
    if (m === "qgap") newGap();
  };

  function newGap() {
    const t = TOLS[rand(TOLS.length)];
    setTol(t);
    setN(6);
    setDone1(false); setDoneMin(false);
    setMsg({ t: "info", s: `목표예요. 위 어림값과 아래 어림값의 차이를 ${t} 보다 작게 만들어 보세요. 변이 적을수록 좋아요!` });
  }

  const check314 = () => {
    setTries((x) => x + 1);
    if (fixes314(n)) {
      let gain = 0;
      if (!done1) gain += 10;
      if (n === MIN314 && !doneMin) gain += 10;
      setDone1(true);
      if (n === MIN314) setDoneMin(true);
      setScore((s) => s + gain);
      setHit((h) => h + 1);
      if (n === MIN314) setMsg({ t: "ok", s: `최소예요! 변 ${n}개에서 ${fmt(lo)} < π < ${fmt(hi)} 이라 3.14 가 확정돼요. 변이 ${n - 1}개면 아래 어림값이 ${fmt(inscribed(n - 1))} 로 3.14 보다 작아요. +${gain}점 🎉` });
      else setMsg({ t: "ok", s: `성공! ${fmt(lo)} < π < ${fmt(hi)} 이라 3.14 가 확정돼요. +${gain}점. 더 적은 변으로도 될까요? 줄여 보세요.` });
    } else if (lo < 3.14) {
      setMsg({ t: "bad", s: `아직이에요. 아래 어림값이 ${fmt(lo)} 로 3.14 보다 작아요. 변을 더 늘려 봐요.` });
    } else {
      setMsg({ t: "bad", s: `아직이에요. 위 어림값이 ${fmt(hi)} 로 3.15 이상이에요. 변을 더 늘려 봐요.` });
    }
  };

  const checkGap = () => {
    setTries((x) => x + 1);
    const g = gap(n);
    const best = minSidesForGap(tol);
    if (g < tol) {
      let gain = 0;
      if (!done1) gain += 10;
      if (n === best && !doneMin) gain += 10;
      setDone1(true);
      if (n === best) setDoneMin(true);
      setScore((s) => s + gain);
      setHit((h) => h + 1);
      setMsg({ t: "ok", s: n === best ? `딱 최소예요! 변 ${n}개에서 차이는 ${fmt(g)} < ${tol}. +${gain}점 🎉` : `성공! 차이 ${fmt(g)} < ${tol}. +${gain}점. 더 적은 변으로도 될 수 있어요. 줄여서 다시 확인해 봐요.` });
    } else {
      setMsg({ t: "bad", s: `아직이에요. 지금 차이는 ${fmt(g)} 이라 ${tol} 보다 커요. 변을 늘려 봐요.` });
    }
  };

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="놀이 방법">
        <GButton variant={mode === "free" ? "primary" : "ghost"} pressed={mode === "free"} onClick={() => change("free")}>자유 탐험</GButton>
        <GButton variant={mode === "q314" ? "primary" : "ghost"} pressed={mode === "q314"} onClick={() => change("q314")}>3.14 확정하기</GButton>
        <GButton variant={mode === "qgap" ? "primary" : "ghost"} pressed={mode === "qgap"} onClick={() => change("qgap")}>목표 오차 맞추기</GButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Stat label="변의 수" value={n} />
        {mode !== "free" && <Stat label="점수" value={score} />}
        {mode !== "free" && <Stat label="맞힘/시도" value={`${hit}/${tries}`} />}
        {mode === "qgap" && <Stat label="목표 차이" value={`< ${tol}`} />}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <svg viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`} className="mx-auto w-full max-w-[420px] rounded-card bg-bg" role="img" aria-label={`반지름 1인 원에 내접하는 정 ${n}각형과 외접하는 정 ${n}각형`}>
          <polygon points={poly(ptsOut)} fill="#f59e0b22" stroke="#d97706" strokeWidth={1.6} strokeLinejoin="round" />
          <circle cx={0} cy={0} r={R} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
          <polygon points={poly(ptsIn)} fill="#2563eb22" stroke="#2563eb" strokeWidth={1.6} strokeLinejoin="round" />
          <line x1={0} y1={0} x2={R} y2={0} stroke="var(--muted)" strokeDasharray="3 3" />
          <text x={R / 2} y={-4} fontSize={11} fill="var(--muted)" textAnchor="middle">1</text>
          <circle cx={0} cy={0} r={2.5} fill="var(--ink)" />
        </svg>

        <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs tabular-nums sm:text-sm">
              <caption className="pb-1 text-left text-xs text-muted">둘레의 절반 (원주율 π ≈ 3.14159…)</caption>
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-1 text-left font-semibold">변</th>
                  <th className="py-1 font-semibold text-[#2563eb]">안쪽(내접)</th>
                  <th className="py-1 font-semibold text-[#d97706]">바깥(외접)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m} className={`border-b border-line/60 ${m === n ? "bg-accent-soft font-bold" : ""}`}>
                    <td className="py-1 text-left">{m}각형</td>
                    <td className="py-1">{fmt(inscribed(m))}</td>
                    <td className="py-1">{fmt(circumscribed(m))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">안쪽 = n·sin(π/n), 바깥 = n·tan(π/n). 반지름 1인 원의 둘레는 2π 이므로 다각형 둘레의 절반이 π 의 어림값이에요.</p>
        </div>
      </div>

      <svg viewBox="0 0 400 96" className="mt-3 w-full rounded-card bg-bg" role="img" aria-label={`원주율은 ${fmt(lo)} 과 ${fmt(hi)} 사이에 있어요`}>
        <line x1={20} x2={380} y1={52} y2={52} stroke="var(--line)" strokeWidth={2} />
        <rect x={bx(lo)} y={42} width={Math.max(2, bx(hi) - bx(lo))} height={20} rx={3} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={2} />
        <line x1={bx(Math.PI)} x2={bx(Math.PI)} y1={30} y2={74} stroke="#e11d48" strokeWidth={2.5} />
        <text x={bx(Math.PI)} y={24} fontSize={12} fontWeight={800} fill="#e11d48" textAnchor="middle">π = 3.14159…</text>
        <text x={bx(lo)} y={88} fontSize={11} fill="#2563eb" textAnchor={n < 20 ? "end" : "middle"}>{fmt(lo, 4)}</text>
        <text x={bx(hi)} y={88} fontSize={11} fill="#d97706" textAnchor={n < 20 ? "start" : "middle"}>{fmt(hi, 4)}</text>
        <text x={20} y={14} fontSize={10} fill="var(--muted)">{a0.toFixed(3)}</text>
        <text x={380} y={14} fontSize={10} fill="var(--muted)" textAnchor="end">{a1.toFixed(3)}</text>
      </svg>
      <p className="mt-1 text-xs text-muted">눈금은 변의 수에 맞춰 확대해서 그려요. 변이 많을수록 같은 막대가 더 가는 구간을 보여 줘요. (구간 길이 {fmt(hi - lo)})</p>

      <div className="mt-3">
        <label className="flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold">
          <span className="w-24 shrink-0">변의 수 n</span>
          <input type="range" min={3} max={96} step={1} value={n} onChange={(e) => set(+e.target.value)} className="h-6 min-w-[8rem] flex-1 accent-[var(--accent)]" aria-label="변의 수" />
          <span className="w-16 shrink-0 text-right tabular-nums text-muted">{n}개</span>
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <GButton onClick={() => set(n - 1)} disabled={n <= 3}>−1</GButton>
          <GButton onClick={() => set(n + 1)} disabled={n >= 96}>+1</GButton>
          <span className="mx-1 text-sm text-muted">아르키메데스:</span>
          {CHAIN.map((m) => (
            <GButton key={m} variant={n === m ? "primary" : "ghost"} pressed={n === m} onClick={() => set(m)} className="!min-w-[44px] !px-2">{m}</GButton>
          ))}
          <GButton variant="soft" onClick={double} disabled={n >= 96}>두 배로 늘리기</GButton>
        </div>
      </div>

      <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "q314" && <GButton variant="primary" onClick={check314}>이 변의 수로 확인</GButton>}
        {mode === "qgap" && (
          <>
            <GButton variant="primary" onClick={checkGap}>이 변의 수로 확인</GButton>
            <GButton variant="soft" onClick={newGap}>새 문제</GButton>
          </>
        )}
        <GButton onClick={() => change(mode)}>다시 하기</GButton>
      </div>

      <p className="mt-4 rounded-card bg-bg p-3 text-sm">
        📜 아르키메데스(기원전 3세기)는 6각형에서 시작해 12, 24, 48, 96각형까지 두 배씩 늘려 가며 3 10/71 &lt; π &lt; 3 1/7 임을 보였어요. 변 96개일 때 위 표처럼 {fmt(inscribed(96), 4)} &lt; π &lt; {fmt(circumscribed(96), 4)} 이에요.
      </p>
    </Board>
  );
}
