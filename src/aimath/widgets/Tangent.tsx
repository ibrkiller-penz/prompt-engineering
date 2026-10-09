import { useId, useMemo, useState } from "react";
import RichMath, { MathLine } from "../RichMath";
import { FUNCTIONS, H_STEPS, TABLE_H, avgRate, round, tangentLine, trend } from "./Tangent.logic";
import type { TFn } from "./Tangent.logic";

const VW = 400, VH = 260, ML = 34, MR = 12, MT = 12, MB = 24;
const pw = VW - ML - MR, ph = VH - MT - MB;

const p = (x: number) => (x < 0 ? `(${round(x)})` : round(x));
/** 부호를 앞에 붙인 항: +3, -3 */
const signed = (x: number) => (x < 0 ? `-${round(-x)}` : `+${round(x)}`);

function niceTicks(lo: number, hi: number, n = 5): number[] {
  const raw = (hi - lo) / n;
  const step = [1, 2, 5, 10, 20].find((s) => s >= raw) ?? 20;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

export default function Tangent() {
  const [fnId, setFnId] = useState(FUNCTIONS[0].id);
  const fn: TFn = FUNCTIONS.find((x) => x.id === fnId)!;
  const [a, setA] = useState(1);
  const [hIdx, setHIdx] = useState(1);
  const [showTan, setShowTan] = useState(false);
  const clipId = useId();
  const h = H_STEPS[hIdx];

  const X = (x: number) => ML + ((x - fn.xlo) / (fn.xhi - fn.xlo)) * pw;
  const Y = (y: number) => MT + ph - ((y - fn.ylo) / (fn.yhi - fn.ylo)) * ph;

  const curve = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = fn.xlo + ((fn.xhi - fn.xlo) * i) / 200;
      pts.push(`${X(x).toFixed(1)},${Y(fn.f(x)).toFixed(1)}`);
    }
    return pts.join(" ");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  const fa = fn.f(a);
  const fah = fn.f(a + h);
  const rate = avgRate(fn, a, h);
  const tan = tangentLine(fn, a);
  const tr = trend(tan.m);
  const line = (m: number, x0: number, y0: number) => {
    const xa = fn.xlo, xb = fn.xhi;
    return { x1: X(xa), y1: Y(y0 + m * (xa - x0)), x2: X(xb), y2: Y(y0 + m * (xb - x0)) };
  };
  const sec = line(rate, a, fa);
  const tl = line(tan.m, a, fa);
  const xTicks = niceTicks(fn.xlo, fn.xhi, 8);
  const yTicks = niceTicks(fn.ylo, fn.yhi, 5);
  const inView = (x: number) => x >= fn.xlo && x <= fn.xhi;

  const trendText = {
    up: "오른쪽으로 갈수록 올라가요",
    down: "오른쪽으로 갈수록 내려가요",
    flat: "평평해요",
  }[tr];
  const gdText =
    tr === "flat"
      ? "기울기가 0이면 그 자리에서는 움직일 방향이 없어요(멈춰요)."
      : `기울기 부호가 ${tr === "up" ? "+이므로 왼쪽" : "−이므로 오른쪽"}으로 움직여요.`;

  // 접선의 방정식 (숫자 대입)
  const dx = a < 0 ? `x+${round(-a)}` : a === 0 ? "x" : `x-${round(a)}`;
  const tanTex =
    `y=f'(a)(x-a)+f(a)=${p(tan.m)}\\left(${dx}\\right)${signed(tan.fa)}` +
    `\\;\\Rightarrow\\; y=${tan.m === 0 ? "" : `${tan.m === 1 ? "" : tan.m === -1 ? "-" : round(tan.m)}x`}${
      tan.m === 0 ? round(tan.b) : tan.b === 0 ? "" : signed(tan.b)
    }`;

  const slider = "h-11 w-full";
  const accent = { accentColor: "var(--accent)" };
  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="평균변화율과 접선 체험 도구">
      <h3 className="text-base font-bold text-ink">체험 도구 · 평균변화율에서 순간변화율로</h3>
      <p className="mt-1 text-sm text-muted">
        두 점을 잇는 직선(할선)의 기울기가 평균변화율이에요. 두 점을 가까이 붙이면(h를 0에 가깝게) 접선의 기울기가 돼요.
      </p>

      <label className="mt-3 block text-sm text-ink">함수 고르기
        <select value={fnId} onChange={(e) => setFnId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-card border border-line bg-bg px-3 text-ink">
          {FUNCTIONS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>

      <svg viewBox={`0 0 ${VW} ${VH}`} className="mt-3 w-full select-none rounded-card bg-bg text-ink" role="img"
        aria-label={`${fn.name} 그래프. a=${round(a)}와 a+h=${round(a + h)} 두 점을 잇는 할선의 기울기는 ${round(rate)}${showTan ? `, 접선의 기울기는 ${round(tan.m)}` : ""}`}>
        <defs><clipPath id={clipId}><rect x={ML} y={MT} width={pw} height={ph} /></clipPath></defs>
        {xTicks.map((t) => (
          <g key={`x${t}`} fontSize="10" fill="currentColor" opacity="0.7">
            <line x1={X(t)} y1={MT} x2={X(t)} y2={MT + ph} stroke="currentColor" opacity="0.12" />
            <text x={X(t)} y={MT + ph + 14} textAnchor="middle">{t}</text>
          </g>
        ))}
        {yTicks.map((t) => (
          <g key={`y${t}`} fontSize="10" fill="currentColor" opacity="0.7">
            <line x1={ML} y1={Y(t)} x2={ML + pw} y2={Y(t)} stroke="currentColor" opacity="0.12" />
            <text x={ML - 4} y={Y(t) + 3} textAnchor="end">{t}</text>
          </g>
        ))}
        {fn.ylo < 0 && fn.yhi > 0 && <line x1={ML} y1={Y(0)} x2={ML + pw} y2={Y(0)} stroke="currentColor" opacity="0.4" />}
        <line x1={X(0)} y1={MT} x2={X(0)} y2={MT + ph} stroke="currentColor" opacity="0.4" />
        <g clipPath={`url(#${clipId})`}>
          <polyline points={curve} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.75" />
          {showTan && <line {...tl} stroke="var(--ok, #16a34a)" strokeWidth="2" />}
          <line {...sec} stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 3" />
        </g>
        {inView(a) && <circle cx={X(a)} cy={Y(fa)} r={6} fill="var(--accent)" stroke="var(--surface, #fff)" strokeWidth="1.5" />}
        {inView(a + h) && <circle cx={X(a + h)} cy={Y(fah)} r={5} fill="var(--accent)" opacity="0.7" stroke="var(--surface, #fff)" strokeWidth="1.5" />}
      </svg>
      <p className="mt-1 text-xs text-muted">
        <span className="font-bold text-accent">점선</span>은 할선{showTan && <>, <span className="font-bold text-ok">초록 실선</span>은 접선</>}이에요.
      </p>

      <div className="mt-2 grid gap-1 sm:grid-cols-2 sm:gap-4">
        <label className="block text-sm text-ink">점 a = <b>{round(a)}</b>
          <input type="range" aria-label="점 a" min={-3} max={3} step={0.5} value={a} onChange={(e) => setA(Number(e.target.value))} className={slider} style={accent} />
        </label>
        <label className="block text-sm text-ink">간격 h = <b>{h}</b> <span className="text-muted">(2 → 0.01)</span>
          <input type="range" aria-label="간격 h" min={0} max={H_STEPS.length - 1} step={1} value={hIdx} onChange={(e) => setHIdx(Number(e.target.value))} className={slider} style={accent}
            aria-valuetext={`h는 ${h}`} />
        </label>
      </div>

      <div className="mt-3 rounded-card border border-line bg-bg p-3">
        <p className="text-sm font-bold text-ink">평균변화율 (할선의 기울기)</p>
        <p className="text-xs text-muted">두 점 (a, f(a)) = ({round(a)}, {round(fa)}), (a+h, f(a+h)) = ({round(a + h)}, {round(fah)})</p>
        <MathLine tex={`\\dfrac{f(a+h)-f(a)}{h}=\\dfrac{f(${round(a + h)})-f(${round(a)})}{${h}}=\\dfrac{${p(fah)}-${p(fa)}}{${h}}=${round(rate)}`} />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-right text-sm">
          <caption className="mb-1 text-left text-sm font-bold text-ink">h를 줄이면 평균변화율은? (a = {round(a)})</caption>
          <thead><tr className="text-muted"><th scope="col" className="p-1.5 text-left">h</th><th scope="col" className="p-1.5">a+h</th><th scope="col" className="p-1.5">평균변화율</th></tr></thead>
          <tbody>
            {TABLE_H.map((t) => (
              <tr key={t} className={`border-t border-line ${t === h ? "bg-accent-soft font-bold" : ""}`}>
                <td className="p-1.5 text-left">{t}</td><td className="p-1.5">{round(a + t)}</td><td className="p-1.5">{round(avgRate(fn, a, t), 4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-ink">
          h가 0에 가까워질수록 평균변화율이 <b>{round(tan.m, 4)}</b> 근처의 한 값에 다가가요. 이 값이 a에서의 순간변화율, 곧 접선의 기울기(미분계수)예요.
        </p>
      </div>

      <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
        <input type="checkbox" checked={showTan} onChange={(e) => setShowTan(e.target.checked)} className="h-6 w-6" style={accent} />
        접선 보이기
      </label>

      {showTan && (
        <div className="mt-2 space-y-3" aria-live="polite">
          <div className="rounded-card bg-accent-soft p-3 text-sm text-ink">
            <p>
              <RichMath text={`$x=${round(a)}$ 에서 미분계수 $f'(${round(a)})=${round(tan.m)}$ 이에요. ${trendText}.`} />
            </p>
            <p className="mt-1">
              <RichMath text={`**손실함수라면** 경사하강법은 이 기울기의 반대 방향(부호가 +면 왼쪽, -면 오른쪽)으로 움직여요. ${gdText}`} />
            </p>
          </div>
          <div className="rounded-card border border-line bg-bg p-3">
            <p className="text-sm font-bold text-ink">접선의 방정식</p>
            <MathLine tex={tanTex} />
          </div>
        </div>
      )}
    </section>
  );
}
