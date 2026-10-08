import { useRef, useState } from "react";
import RichMath, { MathLine } from "../RichMath";
import {
  channelMatrix, countNumbers, grayAll, heartGrid, makeGrid, matrixTex, randomGrid, resizeGrid, rgbCss, rng,
  setChannel, setGray, type Grid,
} from "./Pixels.logic";

const SIZES = [3, 4, 5];
const CH = [
  { name: "R", label: "빨강", color: "#e03131" },
  { name: "G", label: "초록", color: "#2f9e44" },
  { name: "B", label: "파랑", color: "#1c7ed6" },
] as const;

export default function Pixels() {
  const [n, setN] = useState(4);
  const [gray, setGrayMode] = useState(false);
  const [grid, setGrid] = useState<Grid>(() => heartGrid(4));
  const [sel, setSel] = useState(0);
  const seed = useRef(7);

  const p = grid[sel];
  const row = Math.floor(sel / n);
  const col = sel % n;

  const changeSize = (m: number) => {
    setGrid((g) => resizeGrid(g, n, m));
    setN(m);
    setSel(0);
  };
  const toggleGray = (on: boolean) => {
    setGrayMode(on);
    if (on) setGrid((g) => grayAll(g));
  };
  const onKey = (e: React.KeyboardEvent) => {
    let r = row, c = col;
    if (e.key === "ArrowRight") c++;
    else if (e.key === "ArrowLeft") c--;
    else if (e.key === "ArrowDown") r++;
    else if (e.key === "ArrowUp") r--;
    else return;
    e.preventDefault();
    r = Math.min(n - 1, Math.max(0, r));
    c = Math.min(n - 1, Math.max(0, c));
    setSel(r * n + c);
  };

  const btn = "min-h-[44px] rounded-lg border border-line bg-bg px-3 text-sm font-medium text-ink";

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="text-sm font-bold text-accent">체험 도구 · 픽셀과 RGB 행렬 편집기</h3>
      <p className="mt-1 text-sm text-muted">
        칸을 눌러 고른 뒤 슬라이더로 색을 바꿔 보세요. 그림이 바뀌면 오른쪽(아래) 숫자 행렬도 같이 바뀌어요.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">격자 크기</span>
        {SIZES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => changeSize(m)}
            aria-pressed={n === m}
            className={`min-h-[44px] min-w-[56px] rounded-lg border px-3 text-sm font-medium ${n === m ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink"}`}
          >
            {m}×{m}
          </button>
        ))}
        <label className="ml-1 flex min-h-[44px] items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="h-5 w-5" checked={gray} onChange={(e) => toggleGray(e.target.checked)} />
          흑백(회색조) 모드
        </label>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,260px)_1fr]">
        <div>
          <div
            role="grid"
            aria-label={`${n}×${n} 픽셀 그림. 화살표 키로 칸을 옮길 수 있어요`}
            onKeyDown={onKey}
            className="mx-auto grid aspect-square w-full max-w-[260px] gap-[2px] rounded-lg border border-line bg-line p-[2px]"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
          >
            {grid.map((px, i) => (
              <button
                key={i}
                type="button"
                role="gridcell"
                tabIndex={i === sel ? 0 : -1}
                aria-selected={i === sel}
                aria-label={`${Math.floor(i / n) + 1}행 ${(i % n) + 1}열, 값 ${gray ? px[0] : px.join(", ")}`}
                onClick={() => setSel(i)}
                className={`min-h-[44px] w-full rounded-[3px] ${i === sel ? "outline outline-[3px] outline-offset-[-3px] outline-accent ring-2 ring-surface" : ""}`}
                style={{ background: rgbCss(px) }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button type="button" className={btn} onClick={() => { seed.current += 1; setGrid(randomGrid(n, gray, rng(seed.current))); }}>임의로 채우기</button>
            <button type="button" className={btn} onClick={() => setGrid(makeGrid(n))}>모두 흰색</button>
            <button type="button" className={btn} onClick={() => setGrid(gray ? grayAll(heartGrid(n)) : heartGrid(n))}>하트 모양 예시</button>
          </div>
        </div>

        <div className="min-w-0">
          <div className="rounded-lg bg-accent-soft p-3 text-sm text-accent">
            선택한 칸: <b>{row + 1}행 {col + 1}열</b> →{" "}
            <RichMath text={`$a_{${row + 1}${col + 1}}$`} /> ={" "}
            <b>{gray ? p[0] : `(${p[0]}, ${p[1]}, ${p[2]})`}</b>
            <span
              className="ml-2 inline-block h-4 w-4 rounded align-middle ring-1 ring-line"
              style={{ background: rgbCss(p) }}
              aria-hidden
            />
          </div>

          <div className="mt-2 space-y-2">
            {gray ? (
              <Slider
                label="밝기 (0=검정, 255=흰색)"
                color="var(--color-accent, #4263eb)"
                value={p[0]}
                onChange={(v) => setGrid((g) => setGray(g, sel, v))}
              />
            ) : (
              CH.map((c, k) => (
                <Slider
                  key={c.name}
                  label={`${c.name} · ${c.label}`}
                  color={c.color}
                  value={p[k]}
                  onChange={(v) => setGrid((g) => setChannel(g, sel, k as 0 | 1 | 2, v))}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-bg p-3">
        <p className="text-sm text-ink">
          숫자의 개수 = {n}행 × {n}열 × {gray ? 1 : 3}채널 = <b>{countNumbers(n, gray)}개</b>
          <span className="text-muted">{gray ? " (흑백은 행렬 1개)" : " (컬러는 R·G·B 행렬 3개)"}</span>
        </p>
        <div className={`mt-1 grid gap-2 ${gray ? "" : "md:grid-cols-3"}`}>
          {gray ? (
            <MathLine tex={matrixTex(channelMatrix(grid, n, 0), "A")} />
          ) : (
            CH.map((c, k) => (
              <div key={c.name} className="min-w-0 overflow-x-auto">
                <MathLine tex={matrixTex(channelMatrix(grid, n, k as 0 | 1 | 2), c.name)} />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Slider({ label, color, value, onChange }: { label: string; color: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="grid grid-cols-[1fr_72px] items-center gap-x-3 gap-y-0">
      <label className="col-span-2 text-sm font-medium text-ink">{label}</label>
      <input
        type="range"
        min={0}
        max={255}
        value={value}
        aria-label={`${label} 슬라이더`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full"
        style={{ accentColor: color }}
      />
      <input
        type="number"
        min={0}
        max={255}
        value={value}
        aria-label={`${label} 숫자 입력`}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="h-11 w-full rounded-lg border border-line bg-bg px-2 text-center text-ink"
      />
    </div>
  );
}
