// 픽셀과 RGB 행렬: 칸을 골라 빨강·초록·파랑 값을 바꾸면 그림과 행렬이 함께 바뀌어요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { channelMatrix, countNumbers, grayAll, heartGrid, makeGrid, matrixTex, randomGrid, resizeGrid, rgbCss, rng, setChannel, setGray, type Grid } from "@legacy/widgets/Pixels.logic";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Note, Row, Seg, Split, Tex, Toggle, useIsBoard } from "../kit.tsx";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const SIZES = [3, 4, 5];
const CH: { ch: 0 | 1 | 2; name: string; sym: string }[] = [
  { ch: 0, name: "빨강 R", sym: "R" },
  { ch: 1, name: "초록 G", sym: "G" },
  { ch: 2, name: "파랑 B", sym: "B" },
];

export default function Pixels(props: WidgetProps) {
  const [n, setN] = useState(4);
  const [grid, setGrid] = useState<Grid>(() => heartGrid(4));
  const [gray, setGrayMode] = useState(false);
  const [sel, setSel] = useState(0);
  const [seed, setSeed] = useState(3);
  useMission(props, mission, { cells: grid, gray });

  const p = grid[sel] || grid[0];
  const changeN = (to: number) => {
    setGrid(resizeGrid(grid, n, to));
    setN(to);
    setSel(0);
  };
  const toGray = (on: boolean) => {
    setGrayMode(on);
    if (on) setGrid(grayAll(grid));
  };

  // 칠판: 왼쪽 = 크기·예시·그림, 가운데 = 고른 칸의 값 ± · 필요한 수, 오른쪽 = 행렬
  const board = useIsBoard();
  const left = (
    <>
      <Row>
        <Seg label="크기" value={n} options={SIZES.map((s) => ({ value: s, label: s + "×" + s }))} onChange={changeN} />
        <Toggle label="흑백" on={gray} onChange={toGray} />
      </Row>
      <Row>
        <Btn onClick={() => setGrid(gray ? grayAll(heartGrid(n)) : heartGrid(n))}>예시: 하트</Btn>
        <Btn onClick={() => setGrid(makeGrid(n))}>모두 흰색</Btn>
        <Btn
          onClick={() => {
            setGrid(randomGrid(n, gray, rng(seed)));
            setSeed(seed + 1);
          }}
        >
          무작위
        </Btn>
      </Row>
      <div className="wg-pixels" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} role="grid" aria-label={`${n}×${n} 픽셀 그림. 칸을 눌러 골라요`}>
        {grid.map((c, i) => (
          <button
            key={i}
            type="button"
            className={"wg-pixel" + (i === sel ? " is-sel" : "")}
            style={{ background: rgbCss(c) }}
            aria-label={`${Math.floor(i / n) + 1}행 ${(i % n) + 1}열: ${gray ? "밝기 " + c[0] : `R ${c[0]}, G ${c[1]}, B ${c[2]}`}`}
            aria-pressed={i === sel}
            onClick={() => setSel(i)}
          >
            <span className="wg-pixel-pad" />
          </button>
        ))}
      </div>
    </>
  );
  const mid = (
    <>
      <p className="wg-line-label">
        고른 칸: {Math.floor(sel / n) + 1}행 {(sel % n) + 1}열
      </p>
      {gray ? (
        <Stepper inline label="밝기" value={p[0]} min={0} max={255} step={5} slider onChange={(v) => setGrid(setGray(grid, sel, v))} />
      ) : (
        CH.map((c) => <Stepper inline key={c.ch} label={c.name} value={p[c.ch]} min={0} max={255} step={5} slider onChange={(v) => setGrid(setChannel(grid, sel, c.ch, v))} />)
      )}
      <Big label="그림을 저장하는 데 필요한 수" sub={gray ? `${n}×${n} 밝기 행렬 1개` : `${n}×${n} 행렬 3개(R, G, B)`}>
        {countNumbers(n, gray)}개
      </Big>
    </>
  );
  const mats = (
    <div className="wg-mats">{gray ? <Tex block tex={matrixTex(channelMatrix(grid, n, 0), "L")} /> : CH.map((c) => <Tex key={c.ch} block tex={matrixTex(channelMatrix(grid, n, c.ch), c.sym)} />)}</div>
  );
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <Split a={left} b={mid} c={mats} />
      </div>
    );
  }
  return (
    <div className="wg-body">
      {left}
      {mid}
      {mats}
      <Note>컬러 그림은 R, G, B 행렬 세 개로, 흑백 그림은 밝기 행렬 하나로 나타내요. 0은 어둡고 255는 가장 밝아요.</Note>
    </div>
  );
}
