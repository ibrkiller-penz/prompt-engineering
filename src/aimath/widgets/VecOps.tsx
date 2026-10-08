import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { MathLine } from "../RichMath";
import { add, clampInt, clampNum, describe, fmt, normSq, sqrtShow, sub, scale } from "./VecOps.logic";
import type { Op } from "./VecOps.logic";

type V2 = [number, number];

const OPS: { id: Op; name: string; usesB: boolean }[] = [
  { id: "add", name: "합 a+b", usesB: true },
  { id: "sub", name: "차 a−b", usesB: true },
  { id: "scale", name: "실수배 k·a", usesB: false },
  { id: "norm", name: "크기 |a|", usesB: false },
  { id: "dist", name: "거리 |a−b|", usesB: true },
];

const EXAMPLES = [
  { name: "영화 후기 반응", note: "성분: 재미·감동·긴장·지루함 점수", a2: [3, 2] as V2, b2: [1, -4] as V2, an: [5, 4, 2, 1], bn: [4, 5, 1, 2] },
  { name: "단어 빈도", note: "성분: '사랑'·'학교'·'시험' 단어가 나온 횟수", a2: [2, 5] as V2, b2: [-3, 1] as V2, an: [3, 0, 2], bn: [1, 2, 2] },
  { name: "음식 취향 평가", note: "성분: 매운맛·단맛·짠맛·신맛·쓴맛 점수", a2: [-4, 3] as V2, b2: [2, 2] as V2, an: [5, 1, 3, 0, 2], bn: [4, 2, 3, 1, 0] },
];

const COL_A = "var(--color-accent)";
const COL_B = "var(--color-warn)";
const COL_R = "var(--color-ok)";

function Arrow({ x, y, color, w = 0.12, dash }: { x: number; y: number; color: string; w?: number; dash?: string }) {
  return <ArrowFrom x0={0} y0={0} x={x} y={y} color={color} w={w} dash={dash} />;
}

function ArrowFrom({ x0, y0, x, y, color, w = 0.12, dash }: { x0: number; y0: number; x: number; y: number; color: string; w?: number; dash?: string }) {
  const dx = x - x0;
  const dy = y - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return <circle cx={x0} cy={-y0} r={0.15} fill={color} />;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(0.7, len);
  const bx = x - ux * head;
  const by = y - uy * head;
  const px = -uy * head * 0.4;
  const py = ux * head * 0.4;
  return (
    <g>
      <line x1={x0} y1={-y0} x2={bx} y2={-by} stroke={color} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" />
      <polygon points={`${x},${-y} ${bx + px},${-(by + py)} ${bx - px},${-(by - py)}`} fill={color} />
    </g>
  );
}

function Plane({ op, a, b, k, setA, setB }: { op: Op; a: V2; b: V2; k: number; setA: (v: V2) => void; setB: (v: V2) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const showB = OPS.find((o) => o.id === op)!.usesB;

  const toPoint = (e: PointerEvent): V2 | null => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return [clampInt(p.x, -6, 6), clampInt(-p.y, -6, 6)];
  };

  const handle = (name: string, v: V2, set: (v: V2) => void, color: string) => {
    const onPointerDown = (e: PointerEvent<SVGGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent<SVGGElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      const p = toPoint(e);
      if (p) set(p);
    };
    const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
      const d: Record<string, V2> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
      const m = d[e.key];
      if (!m) return;
      e.preventDefault();
      set([clampInt(v[0] + m[0], -6, 6), clampInt(v[1] + m[1], -6, 6)]);
    };
    return (
      <g
        tabIndex={0}
        role="slider"
        aria-label={`벡터 ${name}의 끝점. 화살표 키로 옮겨요`}
        aria-valuetext={`(${v[0]}, ${v[1]})`}
        aria-valuenow={v[0]}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        className="cursor-grab outline-none focus-visible:[&>circle:first-child]:stroke-[#000]"
        style={{ touchAction: "none" }}
      >
        <circle cx={v[0]} cy={-v[1]} r={1} fill="transparent" stroke="none" />
        <circle cx={v[0]} cy={-v[1]} r={0.3} fill={color} stroke="var(--color-surface)" strokeWidth={0.06} />
        <text x={v[0] + 0.45} y={-v[1] - 0.45} fontSize={0.7} fontWeight={700} fill={color}>{name}</text>
      </g>
    );
  };

  const ticks = Array.from({ length: 13 }, (_, i) => i - 6);
  const sum = add(a, b);
  const diff = sub(a, b);
  const ka = scale(k, a);

  return (
    <svg
      ref={svgRef}
      viewBox="-7 -7 14 14"
      role="img"
      aria-label="좌표평면 위의 벡터 a와 b"
      className="mx-auto block aspect-square w-full max-w-[420px] rounded-card border border-line bg-bg"
      style={{ touchAction: "none" }}
    >
      <g className="text-muted">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={t} y1={-6} x2={t} y2={6} stroke="currentColor" strokeWidth={t === 0 ? 0.08 : 0.02} opacity={t === 0 ? 0.7 : 0.25} />
            <line x1={-6} y1={-t} x2={6} y2={-t} stroke="currentColor" strokeWidth={t === 0 ? 0.08 : 0.02} opacity={t === 0 ? 0.7 : 0.25} />
            {t !== 0 && t % 2 === 0 && (
              <>
                <text x={t} y={0.75} fontSize={0.5} textAnchor="middle" fill="currentColor">{t}</text>
                <text x={-0.2} y={-t + 0.18} fontSize={0.5} textAnchor="end" fill="currentColor">{t}</text>
              </>
            )}
          </g>
        ))}
      </g>

      {op === "add" && (
        <g stroke={COL_R} strokeWidth={0.07} strokeDasharray="0.2 0.15" opacity={0.8}>
          <line x1={a[0]} y1={-a[1]} x2={sum[0]} y2={-sum[1]} />
          <line x1={b[0]} y1={-b[1]} x2={sum[0]} y2={-sum[1]} />
        </g>
      )}
      {op === "sub" && <ArrowFrom x0={b[0]} y0={b[1]} x={a[0]} y={a[1]} color={COL_R} w={0.07} dash="0.2 0.15" />}
      {op === "dist" && (
        <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} stroke={COL_R} strokeWidth={0.12} strokeDasharray="0.25 0.15" />
      )}

      {op === "add" && <Arrow x={sum[0]} y={sum[1]} color={COL_R} w={0.1} />}
      {op === "sub" && <Arrow x={diff[0]} y={diff[1]} color={COL_R} w={0.1} />}
      {op === "scale" && <Arrow x={ka[0]} y={ka[1]} color={COL_R} w={0.1} />}

      <Arrow x={a[0]} y={a[1]} color={COL_A} />
      {showB && <Arrow x={b[0]} y={b[1]} color={COL_B} />}
      {handle("a", a, setA, COL_A)}
      {showB && handle("b", b, setB, COL_B)}
    </svg>
  );
}

function IntInput({ label, value, onChange, lo, hi, step = 1 }: { label: string; value: number; onChange: (n: number) => void; lo: number; hi: number; step?: number }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      min={lo}
      max={hi}
      step={step}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === "" || e.target.value === "-" ? 0 : Number(e.target.value))}
      className="min-h-[44px] w-full min-w-0 rounded-card border border-line bg-bg px-1 text-center text-base text-ink"
    />
  );
}

function Result({ op, a, b, k }: { op: Op; a: number[]; b: number[]; k: number }) {
  const r = describe(op, a, b, k);
  let summary: string;
  if (r.vector) summary = `결과 벡터: (${r.vector.map(fmt).join(", ")})`;
  else {
    const s = sqrtShow(op === "norm" ? normSq(a) : normSq(sub(a, b)));
    summary = (op === "norm" ? "|a| = " : "|a−b| = ") + s.text;
  }
  return (
    <div className="rounded-card bg-bg p-3 text-sm" aria-live="polite">
      {r.lines.map((t, i) => <MathLine key={i} tex={t} />)}
      <div className="mt-1 font-bold text-accent">{summary}</div>
    </div>
  );
}

export default function VecOps() {
  const [mode, setMode] = useState<"2d" | "nd">("2d");
  const [op, setOp] = useState<Op>("add");
  const [k, setK] = useState(2);
  const [a2, setA2] = useState<V2>([3, 2]);
  const [b2, setB2] = useState<V2>([1, -4]);
  const [dim, setDim] = useState(4);
  const [an, setAn] = useState<number[]>([5, 4, 2, 1, 0]);
  const [bn, setBn] = useState<number[]>([4, 5, 1, 2, 0]);
  const [note, setNote] = useState("");

  const usesB = OPS.find((o) => o.id === op)!.usesB;
  const opName = OPS.find((o) => o.id === op)!.name;

  const loadExample = (e: (typeof EXAMPLES)[number]) => {
    setA2(e.a2);
    setB2(e.b2);
    setDim(e.an.length);
    setAn([...e.an, 0, 0].slice(0, 5));
    setBn([...e.bn, 0, 0].slice(0, 5));
    setNote(e.note);
  };

  const setComp = (v: number[], set: (x: number[]) => void, i: number, x: number) => set(v.map((o, j) => (j === i ? clampNum(x, -99, 99) : o)));

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · 벡터의 성분과 연산</div>
      <p className="mb-3 text-sm text-muted">벡터는 숫자를 줄지어 놓은 것이에요. 성분끼리 더하고, 빼고, 실수를 곱해 보며 결과를 확인해요.</p>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="보기 방식">
        {([["2d", "2차원 (그림)"], ["nd", "n차원 (숫자)"]] as const).map(([id, name]) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={"min-h-[44px] rounded-card border px-3 text-sm " + (mode === id ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}>
            {name}
          </button>
        ))}
      </div>

      <div className="mb-1 text-sm font-bold">예시 불러오기</div>
      <div className="mb-1 flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <button key={e.name} type="button" onClick={() => loadExample(e)} className="min-h-[44px] rounded-card border border-line bg-bg px-3 text-sm text-ink">
            {e.name}
          </button>
        ))}
      </div>
      {note && <p className="mb-2 text-sm text-muted">{note} (n차원 모드에서 보여요)</p>}

      {mode === "2d" ? (
        <>
          <div className="mt-3 mb-2 flex flex-wrap gap-2" role="group" aria-label="연산 고르기">
            {OPS.map((o) => (
              <button key={o.id} type="button" aria-pressed={op === o.id} onClick={() => setOp(o.id)} className={"min-h-[44px] rounded-card border px-3 text-sm " + (op === o.id ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}>
                {o.name}
              </button>
            ))}
          </div>

          <Plane op={op} a={a2} b={b2} k={k} setA={setA2} setB={setB2} />
          <p className="mt-1 mb-3 text-center text-sm text-muted">점(끝점)을 끌거나, 점을 고른 뒤 방향키로 옮길 수 있어요. 결과가 칸 밖으로 나가면 잘려 보여요.</p>

          <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: usesB ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }}>
            <fieldset className="min-w-0 rounded-card border border-line p-2">
              <legend className="px-1 text-sm font-bold" style={{ color: COL_A }}>벡터 a</legend>
              <div className="grid grid-cols-2 gap-2">
                <IntInput label="벡터 a의 첫째 성분 a1" value={a2[0]} lo={-6} hi={6} onChange={(x) => setA2([clampInt(x, -6, 6), a2[1]])} />
                <IntInput label="벡터 a의 둘째 성분 a2" value={a2[1]} lo={-6} hi={6} onChange={(x) => setA2([a2[0], clampInt(x, -6, 6)])} />
              </div>
            </fieldset>
            {usesB && (
              <fieldset className="min-w-0 rounded-card border border-line p-2">
                <legend className="px-1 text-sm font-bold" style={{ color: COL_B }}>벡터 b</legend>
                <div className="grid grid-cols-2 gap-2">
                  <IntInput label="벡터 b의 첫째 성분 b1" value={b2[0]} lo={-6} hi={6} onChange={(x) => setB2([clampInt(x, -6, 6), b2[1]])} />
                  <IntInput label="벡터 b의 둘째 성분 b2" value={b2[1]} lo={-6} hi={6} onChange={(x) => setB2([b2[0], clampInt(x, -6, 6)])} />
                </div>
              </fieldset>
            )}
          </div>

          {op === "scale" && (
            <label className="mb-3 block text-sm">
              <span className="font-bold">실수 k = {fmt(k)}</span>
              <input
                type="range"
                min={-3}
                max={3}
                step={0.5}
                value={k}
                aria-label="실수배 k (−3부터 3까지, 0.5 간격)"
                onChange={(e) => setK(Number(e.target.value))}
                className="mt-1 block min-h-[44px] w-full accent-[var(--color-accent)]"
              />
            </label>
          )}

          <div className="mb-1 text-sm font-bold">{opName} 계산 과정</div>
          <Result op={op} a={a2} b={b2} k={k} />
        </>
      ) : (
        <>
          <p className="mt-3 mb-2 text-sm text-muted">각 성분은 한 단어의 빈도나 한 항목의 평가 점수일 수 있어요. 성분 개수가 같은 벡터끼리만 계산할 수 있어요.</p>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
            <span>성분 개수</span>
            {[3, 4, 5].map((d) => (
              <button key={d} type="button" aria-pressed={dim === d} onClick={() => setDim(d)} className={"min-h-[44px] min-w-[44px] rounded-card border px-3 " + (dim === d ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}>
                {d}
              </button>
            ))}
          </div>
          {([["a", an, setAn], ["b", bn, setBn]] as const).map(([n, v, set]) => (
            <div key={n} className="mb-2 flex items-center gap-2 text-sm">
              <span className="w-5 font-bold">{n}</span>
              <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }}>
                {Array.from({ length: dim }, (_, i) => (
                  <IntInput key={i} label={`벡터 ${n}의 ${i + 1}번째 성분`} value={v[i]} lo={-99} hi={99} onChange={(x) => setComp(v, set, i, x)} />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-3 flex flex-col gap-3">
            {OPS.map((o) => (
              <div key={o.id}>
                {o.id === "scale" && (
                  <label className="mb-1 block text-sm">
                    <span className="font-bold">실수 k = {fmt(k)}</span>
                    <input type="range" min={-3} max={3} step={0.5} value={k} aria-label="실수배 k (−3부터 3까지, 0.5 간격)" onChange={(e) => setK(Number(e.target.value))} className="mt-1 block min-h-[44px] w-full accent-[var(--color-accent)]" />
                  </label>
                )}
                <div className="mb-1 text-sm font-bold">{o.name}</div>
                <Result op={o.id} a={an.slice(0, dim)} b={bn.slice(0, dim)} k={k} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
