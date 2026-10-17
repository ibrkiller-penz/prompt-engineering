// 벡터 연산 놀이터: 평면 벡터 a, b 의 합·차·실수배·크기·거리를 그림과 식으로 함께 봐요.
// 화살표 끝을 끌거나 ± 단추로 성분을 바꿔요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { describe, type Op } from "@legacy/widgets/VecOps.logic";
import Plot, { type PlotSeries } from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Hide, Note, Row, Seg, Tex } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const OPS: { id: Op; name: string; usesB: boolean }[] = [
  { id: "add", name: "합 a+b", usesB: true },
  { id: "sub", name: "차 a−b", usesB: true },
  { id: "scale", name: "실수배 k·a", usesB: false },
  { id: "norm", name: "크기 |a|", usesB: false },
  { id: "dist", name: "거리 |a−b|", usesB: true },
];
const EXAMPLES: { name: string; a: number[]; b: number[] }[] = [
  { name: "예시 1", a: [3, 2], b: [1, -4] },
  { name: "예시 2", a: [2, 5], b: [-3, 1] },
  { name: "예시 3", a: [-4, 3], b: [2, 2] },
];
const L = 8;
const R6 = (v: number) => Math.max(-6, Math.min(6, Math.round(v)));
const arrow = (from: number[], to: number[]) => [
  { x: from[0], y: from[1] },
  { x: to[0], y: to[1] },
];

export default function VecOps(props: WidgetProps) {
  const [op, setOp] = useState<Op>("add");
  const [a, setA] = useState([3, 2]);
  const [b, setB] = useState([1, -4]);
  const [k, setK] = useState(2);
  const d = describe(op, a, b, k);
  const usesB = OPS.filter((o) => o.id === op)[0].usesB;
  useMission(props, mission, { op, vector: d.vector, scalar: d.scalar });

  const series: PlotSeries[] = [{ label: "a", s: 1, kind: "line", data: arrow([0, 0], a) }];
  if (usesB) series.push({ label: "b", s: 2, kind: "line", data: arrow([0, 0], b) });
  if (op === "add" && d.vector) {
    series.push({ label: "b를 a 끝으로 옮김", s: 4, kind: "line", data: arrow(a, d.vector), noTable: true });
    series.push({ label: "a+b", s: 3, kind: "line", data: arrow([0, 0], d.vector), weight: 1.4 });
  }
  if (op === "sub" && d.vector) series.push({ label: "a−b", s: 3, kind: "line", data: arrow([0, 0], d.vector), weight: 1.4 });
  if (op === "scale" && d.vector) series.push({ label: "k·a", s: 3, kind: "line", data: arrow([0, 0], d.vector), weight: 1.4 });
  if (op === "dist") series.push({ label: "a와 b 끝 사이", s: 3, kind: "line", data: arrow(a, b), weight: 1.4 });

  const lim = Math.max(L, Math.ceil(Math.max.apply(null, series.reduce((m: number[], s) => m.concat(s.data.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y)))), [0])) + 1));

  return (
    <div className="wg-body">
      <Seg label="연산" value={op} options={OPS.map((o) => ({ value: o.id, label: o.name }))} onChange={setOp} />
      <Row>
        {EXAMPLES.map((e) => (
          <Btn
            key={e.name}
            onClick={() => {
              setA(e.a);
              setB(e.b);
            }}
          >
            {e.name}
          </Btn>
        ))}
      </Row>
      <div className="wg-two">
        <div className="wg-card">
          <h4 className="wg-h">
            <Tex tex={`\\vec{a}=(${fmtNum(a[0])},\\ ${fmtNum(a[1])})`} />
          </h4>
          <Stepper label="a₁" value={a[0]} min={-6} max={6} onChange={(v) => setA([v, a[1]])} />
          <Stepper label="a₂" value={a[1]} min={-6} max={6} onChange={(v) => setA([a[0], v])} />
        </div>
        {usesB ? (
          <div className="wg-card">
            <h4 className="wg-h">
              <Tex tex={`\\vec{b}=(${fmtNum(b[0])},\\ ${fmtNum(b[1])})`} />
            </h4>
            <Stepper label="b₁" value={b[0]} min={-6} max={6} onChange={(v) => setB([v, b[1]])} />
            <Stepper label="b₂" value={b[1]} min={-6} max={6} onChange={(v) => setB([b[0], v])} />
          </div>
        ) : op === "scale" ? (
          <div className="wg-card">
            <Stepper label="실수 k" value={k} min={-3} max={3} step={0.5} onChange={setK} />
          </div>
        ) : null}
      </div>
      <Plot
        title="좌표평면 위의 벡터"
        x={[-lim, lim]}
        y={[-lim, lim]}
        equal
        ratio={1}
        series={series}
        handles={[{ id: "a", x: a[0], y: a[1], label: "벡터 a 의 끝", s: 1, step: 1 }].concat(usesB ? [{ id: "b", x: b[0], y: b[1], label: "벡터 b 의 끝", s: 2, step: 1 }] : [])}
        onDrag={(id, p) => (id === "a" ? setA([R6(p.x), R6(p.y)]) : setB([R6(p.x), R6(p.y)]))}
      />
      <Hide label="계산 결과">
        {d.lines.map((t, i) => (
          <Tex key={i} block tex={t} />
        ))}
      </Hide>
      {d.scalar !== null ? (
        <Big label={op === "norm" ? "크기 |a|" : "거리 |a−b|"} tone={op === "dist" && Math.abs(d.scalar - 5) < 1e-9 ? "ok" : "plain"}>
          {fmtNum(d.scalar, 3)}
        </Big>
      ) : d.vector ? (
        <Big label={op === "add" ? "a+b" : op === "sub" ? "a−b" : "k·a"}>
          ({fmtNum(d.vector[0], 3)}, {fmtNum(d.vector[1], 3)})
        </Big>
      ) : null}
      <Note>벡터는 성분끼리 더하고 빼요. 크기는 피타고라스 정리로 구해요.</Note>
    </div>
  );
}
