import { useEffect, useMemo, useState } from "react";
import { MathLine } from "../RichMath";
import { COND_OPTIONS, PRESET_INFO, PRESET_ORDER, buildProgram, checkBlank, clamp, explainTex, run } from "./Flow.logic";
import type { FNode, Inputs, PresetId } from "./Flow.logic";

interface Box { x: number; y: number; w: number; h: number }
interface Edge { d: string; label?: string; lx?: number; ly?: number }
interface Layout { w: number; h: number; nodes: Record<string, Box>; edges: Edge[] }

const loopLayout: Layout = {
  w: 320,
  h: 320,
  nodes: {
    start: { x: 110, y: 22, w: 100, h: 30 },
    init: { x: 110, y: 85, w: 130, h: 34 },
    dec: { x: 110, y: 155, w: 130, h: 60 },
    body: { x: 110, y: 230, w: 130, h: 34 },
    inc: { x: 110, y: 290, w: 130, h: 30 },
    out: { x: 262, y: 155, w: 90, h: 34 },
    end: { x: 262, y: 230, w: 80, h: 30 },
  },
  edges: [
    { d: "M110,37 V68" },
    { d: "M110,102 V125" },
    { d: "M110,185 V213", label: "예", lx: 118, ly: 202 },
    { d: "M110,247 V275" },
    { d: "M45,290 H16 V155 H45" },
    { d: "M175,155 H217", label: "아니오", lx: 180, ly: 148 },
    { d: "M262,172 V215" },
  ],
};

const diffLayout: Layout = {
  w: 320,
  h: 375,
  nodes: {
    start: { x: 160, y: 22, w: 100, h: 30 },
    in: { x: 160, y: 78, w: 140, h: 34 },
    dec: { x: 160, y: 150, w: 130, h: 60 },
    ab: { x: 70, y: 235, w: 110, h: 34 },
    ba: { x: 250, y: 235, w: 110, h: 34 },
    out: { x: 160, y: 300, w: 120, h: 34 },
    end: { x: 160, y: 350, w: 90, h: 30 },
  },
  edges: [
    { d: "M160,37 V61" },
    { d: "M160,95 V120" },
    { d: "M95,150 H70 V218", label: "예", lx: 74, ly: 144 },
    { d: "M225,150 H250 V218", label: "아니오", lx: 230, ly: 144 },
    { d: "M70,252 V272 H160 V283" },
    { d: "M250,252 V272 H160 V283" },
    { d: "M160,317 V335" },
  ],
};

const maxLayout: Layout = {
  w: 320,
  h: 440,
  nodes: {
    start: { x: 110, y: 22, w: 100, h: 30 },
    in: { x: 110, y: 68, w: 140, h: 34 },
    set: { x: 110, y: 118, w: 110, h: 32 },
    d1: { x: 110, y: 185, w: 130, h: 60 },
    s1: { x: 255, y: 185, w: 100, h: 32 },
    d2: { x: 110, y: 275, w: 130, h: 60 },
    s2: { x: 255, y: 275, w: 100, h: 32 },
    out: { x: 110, y: 360, w: 120, h: 34 },
    end: { x: 110, y: 415, w: 90, h: 30 },
  },
  edges: [
    { d: "M110,37 V51" },
    { d: "M110,85 V102" },
    { d: "M110,134 V155" },
    { d: "M175,185 H205", label: "예", lx: 178, ly: 178 },
    { d: "M110,215 V245", label: "아니오", lx: 116, ly: 232 },
    { d: "M255,201 V226 H110 V245" },
    { d: "M175,275 H205", label: "예", lx: 178, ly: 268 },
    { d: "M110,305 V343", label: "아니오", lx: 116, ly: 326 },
    { d: "M255,291 V322 H110 V343" },
    { d: "M110,377 V400" },
  ],
};

const LAYOUTS: Record<PresetId, Layout> = { sum: loopLayout, prod: loopLayout, diff: diffLayout, max: maxLayout };

function Shape({ n, b, on }: { n: FNode; b: Box; on: boolean }) {
  const fill = on ? "var(--accent-soft)" : "var(--surface)";
  const stroke = on ? "var(--accent)" : "var(--muted)";
  const sw = on ? 3 : 1.5;
  const l = b.x - b.w / 2;
  const t = b.y - b.h / 2;
  if (n.kind === "start" || n.kind === "end") return <rect x={l} y={t} width={b.w} height={b.h} rx={b.h / 2} fill={fill} stroke={stroke} strokeWidth={sw} />;
  if (n.kind === "proc") return <rect x={l} y={t} width={b.w} height={b.h} fill={fill} stroke={stroke} strokeWidth={sw} />;
  if (n.kind === "dec") return <polygon points={`${b.x},${t} ${b.x + b.w / 2},${b.y} ${b.x},${t + b.h} ${l},${b.y}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
  const k = 10;
  return <polygon points={`${l + k},${t} ${l + b.w},${t} ${l + b.w - k},${t + b.h} ${l},${t + b.h}`} fill={fill} stroke={stroke} strokeWidth={sw} />;
}

const KIND_NAME: Record<string, string> = { start: "시작", end: "끝", proc: "처리", dec: "판단", io: "입출력" };

function NumInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="font-bold">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        aria-label={`${label} 값 (${min}부터 ${max}까지)`}
        value={value}
        onChange={(e) => onChange(clamp(e.target.value === "" ? min : Number(e.target.value), min, max))}
        className="min-h-[44px] w-20 min-w-0 rounded-card border border-line bg-bg px-2 text-center text-base text-ink"
      />
    </label>
  );
}

export default function Flow() {
  const [preset, setPreset] = useState<PresetId>("sum");
  const [inp, setInp] = useState<Inputs>({ n: 5, a: 7, b: 12, c: 6 });
  const [blankOn, setBlankOn] = useState(false);
  const [cond, setCond] = useState<string | null>(null);
  const [idx, setIdx] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const info = PRESET_INFO[preset];
  const blankMode = blankOn && preset === "sum";
  const unresolved = blankMode && cond === null;

  const prog = useMemo(() => {
    const p = buildProgram(preset, inp, blankMode ? cond ?? "le" : "le");
    if (unresolved) p.nodes.dec = { ...p.nodes.dec, label: "□ ?" };
    return p;
  }, [preset, inp, blankMode, cond, unresolved]);
  const trace = useMemo(() => run(prog), [prog]);
  const total = trace.steps.length;
  const finished = idx >= total - 1 && total > 0 && idx >= 0;
  const cur = idx >= 0 ? trace.steps[Math.min(idx, total - 1)] : null;
  const layout = LAYOUTS[preset];
  const blank = blankMode && cond ? checkBlank(inp.n, cond) : null;

  // 입력·프리셋·빈칸이 바뀌면 처음부터
  useEffect(() => {
    setIdx(-1);
    setPlaying(false);
  }, [preset, inp, blankMode, cond]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIdx((i) => {
        if (i >= total - 1) return i;
        return i + 1;
      });
    }, 700);
    return () => clearInterval(t);
  }, [playing, total]);

  useEffect(() => {
    if (playing && idx >= total - 1) setPlaying(false);
  }, [playing, idx, total]);

  const step = () => setIdx((i) => Math.min(i + 1, total - 1));
  const reset = () => {
    setIdx(-1);
    setPlaying(false);
  };
  const setNum = (k: keyof Inputs, v: number) => setInp((o) => ({ ...o, [k]: v }));
  const names = prog.varNames;
  const shown = trace.steps.slice(0, idx + 1);
  const disabled = unresolved;

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · 순서도 따라가기</div>
      <p className="mb-3 text-sm text-muted">
        순서도는 일을 처리하는 차례를 기호와 화살표로 그린 그림이에요. 둥근 사각형은 시작·끝, 사각형은 처리, 마름모는 판단, 기울어진 사각형은 입력·출력이에요.
        &lsquo;한 단계씩&rsquo;을 눌러 칸을 하나씩 따라가며 변수 값이 어떻게 바뀌는지 보세요.
      </p>

      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="순서도 고르기">
        {PRESET_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={preset === id}
            onClick={() => {
              setPreset(id);
              setInp((o) => ({ ...o, ...PRESET_INFO[id].defaults }));
            }}
            className={"min-h-[44px] rounded-card border px-3 text-sm " + (preset === id ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
          >
            {PRESET_INFO[id].name}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        {info.inputs.map((k) => (
          <NumInput key={k} label={k === "n" ? "N" : k} value={inp[k]} min={info.min} max={info.max} onChange={(v) => setNum(k, v)} />
        ))}
        <span className="text-xs text-muted">값을 바꾸면 처음부터 다시 시작해요.</span>
      </div>

      {preset === "sum" && (
        <div className="mb-3 rounded-card bg-bg p-3 text-sm">
          <label className="flex min-h-[44px] items-center gap-2">
            <input type="checkbox" checked={blankOn} onChange={(e) => { setBlankOn(e.target.checked); setCond(null); }} className="h-5 w-5" />
            <span className="font-bold">빈칸 맞히기</span>
            <span className="text-muted">판단 칸의 조건을 직접 골라요</span>
          </label>
          {blankMode && (
            <>
              <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="판단 칸에 넣을 조건 고르기">
                {COND_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    aria-pressed={cond === o.key}
                    onClick={() => setCond(o.key)}
                    className={"min-h-[44px] min-w-[56px] rounded-card border px-3 " + (cond === o.key ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="mt-2" aria-live="polite">
                {blank === null ? (
                  <span className="text-muted">조건을 고르면 1부터 N까지의 합이 제대로 나오는지 바로 알려 줘요.</span>
                ) : blank.ok ? (
                  <span className="font-bold text-ok">맞아요! 결과 {blank.output} = 1부터 {inp.n}까지의 합이에요.</span>
                ) : (
                  <span className="font-bold text-bad">
                    {blank.truncated ? "끝나지 않고 계속 반복돼요." : `결과가 ${blank.output}이에요. 1부터 ${inp.n}까지의 합 ${blank.expected}이(가) 아니에요.`} 다른 조건을 골라 보세요.
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="mx-auto block w-full max-w-[360px]" role="img" aria-label={`${info.title} 순서도. ${cur ? `지금은 ${KIND_NAME[cur.kind]} 칸 ${cur.label}` : "아직 시작 전"}`}>
        <defs>
          <marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
          </marker>
        </defs>
        {layout.edges.map((e, i) => (
          <g key={i}>
            <path d={e.d} fill="none" stroke="var(--muted)" strokeWidth="1.5" markerEnd="url(#flow-arrow)" />
            {e.label && <text x={e.lx} y={e.ly} fontSize="11" fill="var(--muted)">{e.label}</text>}
          </g>
        ))}
        {Object.values(prog.nodes).map((n) => {
          const b = layout.nodes[n.id];
          if (!b) return null;
          const on = cur?.node === n.id;
          return (
            <g key={n.id}>
              <Shape n={n} b={b} on={on} />
              <text x={b.x} y={b.y} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight={on ? 700 : 500} fill="var(--ink)">{n.label}</text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={step} disabled={disabled || finished} className="min-h-[44px] rounded-card border border-accent bg-accent px-4 text-sm font-bold text-accent-ink disabled:opacity-40">한 단계씩</button>
        <button type="button" aria-pressed={playing} onClick={() => setPlaying((p) => !p)} disabled={disabled || finished} className="min-h-[44px] rounded-card border border-line bg-bg px-4 text-sm text-ink disabled:opacity-40">{playing ? "멈춤" : "자동 재생"}</button>
        <button type="button" onClick={reset} className="min-h-[44px] rounded-card border border-line bg-bg px-4 text-sm text-ink">처음으로</button>
        <span className="text-xs text-muted">{idx + 1} / {total}단계</span>
      </div>
      {unresolved && <p className="mt-1 text-sm text-warn">먼저 위에서 판단 칸(□)에 들어갈 조건을 골라 주세요.</p>}

      <div className="mt-3 max-h-64 overflow-auto rounded-card border border-line">
        <table className="w-full min-w-[300px] border-collapse text-center text-sm" aria-label="단계별 변수 값">
          <thead>
            <tr className="bg-bg">
              <th scope="col" className="sticky top-0 border border-line bg-bg p-1.5">단계</th>
              <th scope="col" className="sticky top-0 border border-line bg-bg p-1.5">칸</th>
              {names.map((v) => <th key={v} scope="col" className="sticky top-0 border border-line bg-bg p-1.5">{v}</th>)}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={names.length + 2} className="p-2 text-muted">&lsquo;한 단계씩&rsquo;을 눌러 시작해 보세요.</td></tr>
            )}
            {shown.map((s, i) => {
              const last = i === idx;
              return (
                <tr key={i} className={last ? "bg-accent-soft font-bold" : ""}>
                  <td className="border border-line p-1.5">{i + 1}</td>
                  <td className="border border-line p-1.5">{s.label}{s.branch ? ` → ${s.branch}` : ""}</td>
                  {names.map((v) => <td key={v} className="border border-line p-1.5">{s.vars[v] ?? "–"}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {finished && (
        <div className="mt-3 rounded-card bg-bg p-3 text-center" aria-live="polite">
          {trace.truncated || trace.output === null ? (
            <div className="font-bold text-bad">{MAX_NOTE}</div>
          ) : (
            <>
              <div className="text-sm text-muted">출력값</div>
              <div className="text-4xl font-bold text-accent">{trace.output}</div>
              <MathLine tex={explainTex(preset, inp, trace.output)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

const MAX_NOTE = "너무 오래 반복해서 멈췄어요. 끝나지 않는 순서도예요.";
