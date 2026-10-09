import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat } from "./kit";
import { MISSIONS, ceil2, circumscribed, floor2, gap, inscribed, missionOk } from "./archpi.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
const CHAIN = [6, 12, 24, 48, 96];
const BIG = "!min-h-[48px] !text-base";
const f2 = (v: number) => v.toFixed(2);

function missionText(i: number) {
  const m = MISSIONS[i];
  return m.is314 ? "두 값이 ‘3.14’와 ‘3.15’ 사이로 모일 때까지 늘려요!" : `두 값의 차이를 ${m.gap} 보다 작게 만들어요!`;
}

export default function ArchPiGame() {
  const [n, setN] = useState(6);
  const [mi, setMi] = useState(0);
  const [stars, setStars] = useState(0);
  const [ok, setOk] = useState(false);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "아래 ‘변 늘리기’ 단추를 눌러 보세요. 도형이 원에 점점 가까워져요!" });

  const lo = inscribed(n), hi = circumscribed(n);
  const R = 100;
  const half = Math.max(R / Math.cos(Math.PI / n) + 14, 125);
  const ptsIn = useMemo(() => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / n; return [R * Math.cos(a), R * Math.sin(a)]; }), [n]);
  const ptsOut = useMemo(() => Array.from({ length: n }, (_, k) => { const a = -Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / n; const r2 = R / Math.cos(Math.PI / n); return [r2 * Math.cos(a), r2 * Math.sin(a)]; }), [n]);
  const poly = (p: number[][]) => p.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");

  const span = Math.max(hi - Math.PI, Math.PI - lo) * 1.6;
  const a0 = Math.PI - span, a1 = Math.PI + span;
  const bx = (v: number) => 20 + ((v - a0) / (a1 - a0)) * 360;

  const apply = (v: number) => {
    const m = Math.max(3, Math.min(96, Math.round(v)));
    setN(m);
    if (ok) return;
    if (missionOk(mi, m)) {
      setOk(true);
      setStars((s) => s + 1);
      const last = mi === MISSIONS.length - 1;
      setMsg({
        t: "ok",
        s: last
          ? `대단해요! ⭐ ${m}각형이면 원의 둘레 ÷ 지름이 ${f2(floor2(inscribed(m)))} 와 ${f2(ceil2(circumscribed(m)))} 사이예요. 그래서 3.14쯤이에요! 별 ${stars + 1}개를 모았어요!`
          : `잘했어요! ⭐ ${m}각형에서 성공! 두 값의 차이가 ${f2(gap(m))} 로 줄었어요. ‘다음 미션’을 눌러요.`,
      });
    } else {
      setMsg({ t: "info", s: `${m}각형이에요. 두 값의 차이는 ${f2(gap(m))} 예요. 더 늘리면 차이가 더 줄어요!` });
    }
  };
  const next = CHAIN.find((c) => c > n);
  const nextMission = () => {
    setMi((x) => x + 1);
    setOk(false);
    setHint(false);
    setN(6);
    setMsg({ t: "info", s: "새 미션이에요! 다시 6각형에서 시작해요." });
  };
  const reset = () => {
    setMi(0); setStars(0); setOk(false); setHint(false); setN(6);
    setMsg({ t: "info", s: "처음부터 다시 해요. ‘변 늘리기’를 눌러 보세요!" });
  };
  const finished = ok && mi === MISSIONS.length - 1;
  const rows = CHAIN.filter((c) => c <= n || c === CHAIN.find((x) => x >= n));
  const rowsShown = [...new Set([...rows, n])].sort((a, b) => a - b);

  return (
    <Board>
      <p className="text-base">
        원 안에 꼭 맞는 도형(<span className="font-bold text-[#2563eb]">파랑</span>)과 원을 감싸는 도형(<span className="font-bold text-[#d97706]">주황</span>)의 둘레를 재 보면, 원의 둘레는 그 사이에 있어요.
        <br />
        원의 둘레 ÷ 지름 = <strong>3.14쯤</strong> 이에요. 이 수를 원주율이라고 해요.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Stat label="미션" value={`${mi + 1}/${MISSIONS.length}`} />
        <Stat label="별" value={"⭐".repeat(stars) || "0"} tone={stars ? "ok" : "plain"} />
        <Stat label="변" value={`${n}개`} />
      </div>

      <p className="mt-3 rounded-card bg-accent-soft/70 px-3 py-2 text-base font-bold">🎯 미션 {mi + 1} · {missionText(mi)}</p>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <svg viewBox={`${-half} ${-half} ${2 * half} ${2 * half}`} className="mx-auto w-full max-w-[420px] rounded-card bg-bg" role="img" aria-label={`원 안에 꼭 맞는 ${n}각형과 원을 감싸는 ${n}각형`}>
            <polygon points={poly(ptsOut)} fill="#f59e0b22" stroke="#d97706" strokeWidth={1.8} strokeLinejoin="round" />
            <circle cx={0} cy={0} r={R} fill="none" stroke="var(--ink)" strokeWidth={1.8} />
            <polygon points={poly(ptsIn)} fill="#2563eb22" stroke="#2563eb" strokeWidth={1.8} strokeLinejoin="round" />
          </svg>
          <p className="mt-1 text-center text-base font-bold">{n}각형</p>
        </div>

        <div className="min-w-0">
          <table className="w-full text-right text-base tabular-nums">
            <caption className="pb-1 text-left text-sm text-muted">도형의 둘레 ÷ 지름</caption>
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1 text-left font-semibold">도형</th>
                <th className="py-1 font-semibold text-[#2563eb]">안쪽(파랑)</th>
                <th className="py-1 font-semibold text-[#d97706]">바깥(주황)</th>
              </tr>
            </thead>
            <tbody>
              {rowsShown.map((m) => (
                <tr key={m} className={`border-b border-line/60 ${m === n ? "bg-accent-soft font-bold" : ""}`}>
                  <td className="py-1.5 text-left">{m}각형</td>
                  <td className="py-1.5">{f2(floor2(inscribed(m)))}</td>
                  <td className="py-1.5">{f2(ceil2(circumscribed(m)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">원의 둘레 ÷ 지름은 늘 이 두 수 사이에 있어요.</p>
        </div>
      </div>

      <svg viewBox="0 0 400 96" className="mt-3 w-full rounded-card bg-bg" role="img" aria-label={`원주율은 ${f2(floor2(lo))} 과 ${f2(ceil2(hi))} 사이에 있어요`}>
        <line x1={20} x2={380} y1={52} y2={52} stroke="var(--line)" strokeWidth={2} />
        <rect x={bx(lo)} y={42} width={Math.max(2, bx(hi) - bx(lo))} height={20} rx={3} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={2} />
        <line x1={bx(Math.PI)} x2={bx(Math.PI)} y1={30} y2={74} stroke="#e11d48" strokeWidth={2.5} />
        <text x={bx(Math.PI)} y={24} fontSize={13} fontWeight={800} fill="#e11d48" textAnchor="middle">원주율 3.14쯤</text>
        <text x={bx(lo)} y={90} fontSize={13} fill="#2563eb" textAnchor={n < 20 ? "end" : "middle"}>{f2(floor2(lo))}</text>
        <text x={bx(hi)} y={90} fontSize={13} fill="#d97706" textAnchor={n < 20 ? "start" : "middle"}>{f2(ceil2(hi))}</text>
      </svg>
      <p className="mt-1 text-sm text-muted">파란 칸 안에 원주율(빨간 선)이 있어요. 변이 많을수록 칸이 좁아져요. (눈금은 확대해서 그려요)</p>

      <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>
      {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">💡 변을 늘리면 도형이 원을 더 꼭 닮아서, 파랑 값은 커지고 주황 값은 작아져요. 둘이 3.14 근처로 모여요!</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="변의 수 늘리기">
        {finished ? (
          <GButton variant="primary" className={BIG} onClick={reset}>🔄 처음부터 다시 하기</GButton>
        ) : (
          <GButton variant="primary" className={BIG} disabled={!next} onClick={() => next && apply(next)}>
            {next ? `변 늘리기 → ${next}각형` : "다 늘렸어요"}
          </GButton>
        )}
        {ok && !finished && <GButton variant="soft" className={BIG} onClick={nextMission}>다음 미션 ▶</GButton>}
        <GButton className={BIG} onClick={() => setHint((v) => !v)} pressed={hint}>💡 힌트</GButton>
        {!finished && <GButton className={BIG} onClick={reset}>다시 하기</GButton>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-base" aria-label="늘리는 순서">
        {CHAIN.map((c, i) => (
          <span key={c} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-muted">→</span>}
            <GButton variant={n === c ? "primary" : "ghost"} pressed={n === c} className="!min-h-[48px] !min-w-[48px] !px-3" onClick={() => apply(c)}>{c}</GButton>
          </span>
        ))}
      </div>

      <details className="mt-4 rounded-card border border-line p-3">
        <summary className="cursor-pointer text-base font-bold">더 해 보기: 변의 수를 마음대로 바꿔요</summary>
        <div className="mt-2">
          <label className="flex min-h-[48px] flex-wrap items-center gap-x-3 gap-y-1 text-base font-semibold">
            <span>변의 수</span>
            <input type="range" min={3} max={96} step={1} value={n} onChange={(e) => apply(+e.target.value)} className="h-6 min-w-[8rem] flex-1 accent-[var(--accent)]" aria-label="변의 수" />
            <span className="w-14 text-right tabular-nums">{n}개</span>
          </label>
          <div className="mt-1 flex gap-2">
            <GButton className={BIG} onClick={() => apply(n - 1)} disabled={n <= 3}>−1</GButton>
            <GButton className={BIG} onClick={() => apply(n + 1)} disabled={n >= 96}>+1</GButton>
          </div>
          <p className="mt-2 text-sm text-muted">자세한 값: 안쪽 {lo.toFixed(4)}, 바깥 {hi.toFixed(4)} (원주율은 3.14159…)</p>
        </div>
      </details>

      <p className="mt-4 rounded-card bg-bg p-3 text-base">
        📜 아주 옛날 그리스의 아르키메데스는 6각형에서 시작해 12, 24, 48, 96각형까지 변을 두 배씩 늘려서, 원주율이 3과 10/71보다 크고 3과 1/7보다 작다는 것을 알아냈어요.
      </p>
    </Board>
  );
}
