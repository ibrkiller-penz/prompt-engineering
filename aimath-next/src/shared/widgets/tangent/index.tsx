// 평균변화율에서 순간변화율로: h 를 줄이면 할선의 기울기가 접선의 기울기에 가까워져요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { FUNCTIONS, H_STEPS, TABLE_H, avgRate, round, tangentLine, trend } from "@legacy/widgets/Tangent.logic";
import Plot, { type PlotSeries } from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Hide, Readout, Row, Seg, Split, Table, Tex, Toggle, Note, useIsBoard } from "../kit.tsx";
import { sampleFn } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const p = (x: number) => (x < 0 ? `(${round(x)})` : round(x));
const TREND: Record<string, string> = { up: "증가하고 있어요", down: "감소하고 있어요", flat: "평평해요(기울기 0)" };

export default function Tangent(props: WidgetProps) {
  const board = useIsBoard();
  const [fnId, setFnId] = useState(FUNCTIONS[0].id);
  const fn = FUNCTIONS.filter((f) => f.id === fnId)[0] || FUNCTIONS[0];
  const [a, setA] = useState(1);
  const [hIdx, setHIdx] = useState(1);
  const [showTan, setShowTan] = useState(false);
  const h = H_STEPS[hIdx];
  const avg = avgRate(fn, a, h);
  const tl = tangentLine(fn, a);
  useMission(props, mission, { h, avg, slope: tl.m, showTan });

  const line = (m: number, x0: number, y0: number) => [
    { x: fn.xlo, y: y0 + m * (fn.xlo - x0) },
    { x: fn.xhi, y: y0 + m * (fn.xhi - x0) },
  ];
  const series: PlotSeries[] = [
    { label: "y=f(x)", s: 1, kind: "line", data: sampleFn(fn.f, fn.xlo, fn.xhi, 160), noTable: true },
    { label: "할선", s: 2, kind: "line", data: line(avg, a, fn.f(a)), noTable: true },
    {
      label: "두 점",
      s: 2,
      kind: "points",
      data: [
        { x: a, y: fn.f(a) },
        { x: a + h, y: fn.f(a + h) },
      ],
    },
  ];
  if (showTan) series.push({ label: "접선", s: 3, kind: "line", data: line(tl.m, a, tl.fa), noTable: true });

  const seg = (
    <Seg
      label="함수"
      value={fnId}
      options={FUNCTIONS.map((f) => ({ value: f.id, label: f.name }))}
      onChange={(id) => {
        setFnId(id);
        setA(1);
      }}
    />
  );
  const plot = (
    <Plot
      title="함수 그래프, 할선, 접선"
      x={[fn.xlo, fn.xhi]}
      y={[fn.ylo, fn.yhi]}
      xLabel="x"
      yLabel="y"
      boardMaxH={520}
      series={series}
      summary={`x=${round(a)}에서 h=${h}일 때 평균변화율은 ${round(avg)}, 접선의 기울기는 ${round(tl.m)}이에요.`}
      handles={[{ id: "a", x: a, y: fn.f(a), label: "점 a", s: 2, step: 0.5 }]}
      onDrag={(_, pt) => setA(Math.max(fn.xlo + 1, Math.min(fn.xhi - 2, Math.round(pt.x * 2) / 2)))}
    />
  );
  const controls = (
    <Row>
      <Stepper inline label="a" value={a} min={fn.xlo + 1} max={fn.xhi - 2} step={0.5} onChange={setA} />
      <Stepper inline label="h" value={hIdx} min={0} max={H_STEPS.length - 1} format={(i) => String(H_STEPS[i])} onChange={setHIdx} />
      <Toggle label="접선 보기" on={showTan} onChange={setShowTan} />
    </Row>
  );
  const big = <Big label="평균변화율(할선의 기울기)">{round(avg)}</Big>;
  const calc = (
    <Hide label="계산 과정">
      <Tex block tex={`\\frac{f(a+h)-f(a)}{h}=\\frac{f(${round(a + h)})-f(${round(a)})}{${h}}=\\frac{${round(fn.f(a + h))}-${p(fn.f(a))}}{${h}}=${round(avg)}`} />
    </Hide>
  );
  const table = <Table caption={`a=${round(a)}에서 h를 줄여 가면`} head={["h", "평균변화율"]} rows={TABLE_H.map((t) => [String(t), round(avgRate(fn, a, t))])} hl={(i) => TABLE_H[i] === h} />;
  const tan = showTan ? (
    <>
      <Tex block tex={`f'(${round(a)})=\\lim_{h\\to 0}\\frac{f(${round(a)}+h)-f(${round(a)})}{h}=${round(tl.m)}`} />
      <Readout label="접선의 기울기" tone="ok">
        {round(tl.m)} · 그래프가 {TREND[trend(tl.m)]}
      </Readout>
    </>
  ) : (
    <Note>h를 0.01까지 줄인 뒤 '접선 보기'를 눌러 두 기울기를 비교해 봐요.</Note>
  );

  // 칠판: 왼쪽 = 함수 고르기 + 그림, 오른쪽 = ± 조작 → [평균변화율 | 표] → 계산 → 접선(스크롤 없이 한 화면)
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <Split
          a={
            <>
              {seg}
              {plot}
            </>
          }
          b={
            <>
              {controls}
              <div className="wg-two">
                {big}
                {table}
              </div>
              {calc}
              {tan}
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="wg-body">
      {seg}
      {plot}
      {controls}
      {big}
      {calc}
      {table}
      {tan}
    </div>
  );
}
