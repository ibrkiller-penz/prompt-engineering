import { useState } from "react";
import RichMath, { MathLine } from "../RichMath";
import {
  BLUR_KERNEL, EDGE_KERNEL, PRESETS, SHARPEN_KERNEL, blur, brightness, contrast, cycleValue, edge, flipH, flipV,
  invert, matrixTex, rotateCCW, rotateCW, scalar, sharpen, transpose, type Img, type OpResult,
} from "./ImgTransform.logic";

type OpKey =
  | "bright" | "contrast" | "scalar" | "invert" | "flipH" | "flipV" | "cw" | "ccw" | "transpose" | "blur" | "sharpen" | "edge";

const OPS: { key: OpKey; label: string; param?: { name: string; def: number; min: number; max: number; step: number } }[] = [
  { key: "bright", label: "밝기 조절 (+k / −k)", param: { name: "k", def: 50, min: -255, max: 255, step: 10 } },
  { key: "contrast", label: "대비 (128 기준 a배)", param: { name: "a", def: 1.5, min: 0, max: 4, step: 0.1 } },
  { key: "scalar", label: "단순 상수배 (a·x)", param: { name: "a", def: 0.5, min: 0, max: 4, step: 0.1 } },
  { key: "invert", label: "반전 (255−x)" },
  { key: "flipH", label: "좌우 대칭" },
  { key: "flipV", label: "상하 대칭" },
  { key: "cw", label: "90° 시계 방향 회전" },
  { key: "ccw", label: "90° 반시계 방향 회전" },
  { key: "transpose", label: "전치 (행↔열)" },
  { key: "blur", label: "흐리게 (3×3 평균)" },
  { key: "sharpen", label: "선명하게 (샤픈 커널)" },
  { key: "edge", label: "윤곽선 (엣지 커널)" },
];

const kTex = (k: number[][], div?: number) =>
  `${div ? `\\tfrac{1}{${div}}` : ""}\\begin{pmatrix} ${k.map((r) => r.join(" & ")).join(" \\\\ ")} \\end{pmatrix}`;

function run(key: OpKey, m: Img, p: number): { r: OpResult; formula: string } {
  const noClip = (img: Img): OpResult => ({ img, clipped: 0 });
  const sign = p >= 0 ? `+ ${p}` : `- ${-p}`;
  switch (key) {
    case "bright": return { r: brightness(m, p), formula: `B_{ij} = \\mathrm{clip}(A_{ij} ${sign})` };
    case "contrast": return { r: contrast(m, p), formula: `B_{ij} = \\mathrm{clip}(${p}\\,(A_{ij}-128)+128)` };
    case "scalar": return { r: scalar(m, p), formula: `B = ${p}A \\quad (B_{ij}=\\mathrm{clip}(${p}\\,A_{ij}))` };
    case "invert": return { r: invert(m), formula: `B_{ij} = 255 - A_{ij}` };
    case "flipH": return { r: noClip(flipH(m)), formula: `B_{ij} = A_{i,\\,n+1-j}` };
    case "flipV": return { r: noClip(flipV(m)), formula: `B_{ij} = A_{m+1-i,\\,j}` };
    case "cw": return { r: noClip(rotateCW(m)), formula: `B = (A^{T}\\text{의 좌우 대칭}),\\; B_{ij} = A_{m+1-j,\\,i}` };
    case "ccw": return { r: noClip(rotateCCW(m)), formula: `B = (A^{T}\\text{의 상하 대칭}),\\; B_{ij} = A_{j,\\,n+1-i}` };
    case "transpose": return { r: noClip(transpose(m)), formula: `B = A^{T},\\; B_{ij} = A_{ji}` };
    case "blur": return { r: blur(m), formula: `B = A * ${kTex(BLUR_KERNEL, 9)}` };
    case "sharpen": return { r: sharpen(m), formula: `B = A * ${kTex(SHARPEN_KERNEL)}` };
    case "edge": return { r: edge(m), formula: `B = A * ${kTex(EDGE_KERNEL)}` };
  }
}

export default function ImgTransform() {
  const [src, setSrc] = useState<Img>(PRESETS.smiley.img);
  const [preset, setPreset] = useState("smiley");
  const [editing, setEditing] = useState(false);
  const [opKey, setOpKey] = useState<OpKey>("bright");
  const [params, setParams] = useState<Record<string, number>>({ bright: 50, contrast: 1.5, scalar: 0.5 });

  const op = OPS.find((o) => o.key === opKey)!;
  const p = params[opKey] ?? 0;
  const { r, formula } = run(opKey, src, Number.isFinite(p) ? p : 0);
  const note =
    r.clipped > 0
      ? `0~255를 벗어난 ${r.clipped}칸을 잘라서(클리핑) 0 또는 255로 바꿨어요.`
      : op.param || ["blur", "sharpen", "edge"].includes(opKey)
        ? "잘린(클리핑된) 칸은 없어요."
        : "";

  const btn = "min-h-[44px] rounded-lg border border-line bg-bg px-3 text-sm font-medium text-ink";

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="text-sm font-bold text-accent">체험 도구 · 행렬로 이미지 변환</h3>
      <p className="mt-1 text-sm text-muted">
        6×6 흑백 그림 = 숫자 행렬이에요. 연산을 고르면 &lsquo;변환 후&rsquo; 그림과 행렬이 어떻게 바뀌는지 볼 수 있어요. 0은 검정, 255는 흰색이에요.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {Object.entries(PRESETS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            aria-pressed={preset === k && !editing}
            onClick={() => { setSrc(v.img); setPreset(k); }}
            className={`min-h-[44px] rounded-lg border px-3 text-sm font-medium ${preset === k ? "border-accent bg-accent-soft text-accent" : "border-line bg-bg text-ink"}`}
          >
            {v.label}
          </button>
        ))}
        <label className="flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-5 w-5" checked={editing} onChange={(e) => setEditing(e.target.checked)} />
          직접 그리기 (칸을 누르면 값이 바뀜)
        </label>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Panel
          title="변환 전 (A)"
          img={src}
          onCell={editing ? (i, j) => setSrc((m) => m.map((row, a) => row.map((v, b) => (a === i && b === j ? cycleValue(v) : v)))) : undefined}
        />
        <Panel title="변환 후 (B)" img={r.img} />
      </div>
      {editing && <p className="mt-1 text-xs text-muted">직접 그리기: 칸을 누를 때마다 0 → 64 → 128 → 192 → 255 → 0 순서로 바뀌어요.</p>}

      <div className="mt-4 rounded-lg bg-bg p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-medium text-ink">
            연산 고르기
            <select
              className="mt-1 block h-11 w-full rounded-lg border border-line bg-surface px-2 text-ink"
              value={opKey}
              onChange={(e) => setOpKey(e.target.value as OpKey)}
            >
              {OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          {op.param && (
            <label className="text-sm font-medium text-ink">
              {op.param.name} 값
              <input
                type="number"
                className="mt-1 block h-11 w-28 rounded-lg border border-line bg-surface px-2 text-ink"
                min={op.param.min}
                max={op.param.max}
                step={op.param.step}
                value={params[opKey] ?? op.param.def}
                onChange={(e) => setParams((s) => ({ ...s, [opKey]: e.target.value === "" ? 0 : Number(e.target.value) }))}
              />
            </label>
          )}
        </div>
        <div className="mt-2 overflow-x-auto text-ink"><MathLine tex={formula} /></div>
        {note && <p className={`text-sm ${r.clipped > 0 ? "text-bad" : "text-muted"}`}>{note}</p>}
        {["blur", "sharpen", "edge"].includes(opKey) && (
          <p className="mt-1 text-xs text-muted">
            가장자리 처리: 그림 밖의 값은 가장 가까운 가장자리 칸의 값을 복제해서 써요(edge-clamp). 계산 결과는 반올림 후 0~255로 잘라요.
            <br />* 는 각 칸 주변 3×3 값과 커널을 곱해 더하는 계산이에요.
          </p>
        )}
        {opKey === "contrast" && <p className="mt-1 text-xs text-muted"><RichMath text="$a>1$ 이면 밝은 곳은 더 밝게, 어두운 곳은 더 어둡게 만들어요." /></p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`${btn} border-accent bg-accent text-accent-ink`} onClick={() => setSrc(r.img)}>
            B → 다시 입력으로 (연산 이어 붙이기)
          </button>
          <button type="button" className={btn} onClick={() => setSrc(PRESETS[preset].img)}>처음으로 되돌리기</button>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, img, onCell }: { title: string; img: Img; onCell?: (i: number, j: number) => void }) {
  const R = img.length;
  const C = img[0].length;
  return (
    <div className="min-w-0 rounded-lg border border-line p-2">
      <div className="text-sm font-bold text-ink">{title} <span className="font-normal text-muted">({R}×{C})</span></div>
      <div
        className="mx-auto mt-2 grid aspect-square w-full max-w-[200px] gap-px bg-line p-px"
        style={{ gridTemplateColumns: `repeat(${C}, minmax(0, 1fr))`, aspectRatio: `${C} / ${R}` }}
      >
        {img.map((row, i) =>
          row.map((v, j) => {
            const style = { background: `rgb(${v}, ${v}, ${v})` };
            return onCell ? (
              <button
                key={`${i}-${j}`}
                type="button"
                aria-label={`${i + 1}행 ${j + 1}열, 값 ${v}. 누르면 값이 바뀜`}
                onClick={() => onCell(i, j)}
                className="min-h-[28px] w-full"
                style={style}
              />
            ) : (
              <div key={`${i}-${j}`} className="min-h-[24px]" style={style} />
            );
          }),
        )}
      </div>
      <div className="mt-1 overflow-x-auto"><MathLine tex={matrixTex(img)} /></div>
    </div>
  );
}
