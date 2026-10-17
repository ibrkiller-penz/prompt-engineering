// 가까운 이웃으로 분류하기(k-NN): 새 점(★)에서 가까운 k개가 어느 반인지 세어 다수결로 정해요.
// 새 점(★)은 끌거나, 그림을 누르거나(휴대폰), ± 단추로 옮겨요.
import { useMemo, useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { CLASS_NAMES, PRESET_POINTS, classify, decisionGrid, type Metric } from "@legacy/widgets/Knn.logic";
import Plot, { type PlotSeries } from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Note, Readout, Row, Seg, Split, Toggle, Tex, useIsBoard } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const CELLS = 20;
const snap = (v: number) => Math.max(0, Math.min(10, Math.round(v * 2) / 2));

export default function Knn(props: WidgetProps) {
  const board = useIsBoard();
  const [q, setQ] = useState({ x: 5, y: 5 });
  const [k, setK] = useState(3);
  const [metric, setMetric] = useState<Metric>("euclid");
  const [shade, setShade] = useState(false);
  const pts = PRESET_POINTS;
  const nCls = CLASS_NAMES.length;
  const r = classify(pts, q, k, metric, nCls);
  const w1 = classify(pts, q, 1, metric, nCls).winner;
  const w5 = classify(pts, q, 5, metric, nCls).winner;
  useMission(props, mission, { k, winner: r.winner, winnerK1: w1, winnerK5: w5, x: q.x, y: q.y });
  const grid = useMemo(() => (shade ? decisionGrid(pts, k, metric, nCls, CELLS) : null), [shade, k, metric, pts, nCls]);

  const series: PlotSeries[] = CLASS_NAMES.map((name, c) => ({ label: name, s: c + 1, kind: "points" as const, data: pts.filter((p) => p.cls === c).map((p) => ({ x: p.x, y: p.y })) }));
  series.push({ label: "새 점", s: 4, kind: "points", data: [q], size: 1.6 });
  const near = r.neighbors[r.neighbors.length - 1];

  const plot = (
    <Plot
      title="동물 15마리와 새 점"
      boardMaxH={520}
      x={[0, 10]}
      y={[0, 10]}
      equal
      ratio={1}
      xLabel="특징 1"
      yLabel="특징 2"
      series={series}
      summary={`새 점 (${fmtNum(q.x)}, ${fmtNum(q.y)})에서 가까운 ${k}개 중 ${r.votes.map((v, c) => CLASS_NAMES[c] + " " + v).join(", ")}이라서 ${CLASS_NAMES[r.winner]}(으)로 분류해요.`}
      onPick={board ? undefined : (p) => setQ({ x: snap(p.x), y: snap(p.y) })}
      handles={[{ id: "q", x: q.x, y: q.y, label: "새 점", s: 4, step: 0.5 }]}
      onDrag={(_, p) => setQ({ x: snap(p.x), y: snap(p.y) })}
      under={(sc) =>
        grid ? (
          <g className="wg-shade">
            {grid.map((row, i) =>
              row.map((c, j) => (
                <rect
                  key={i + ":" + j}
                  className={"wg-s" + (c + 1)}
                  x={sc.x((j * 10) / CELLS)}
                  y={sc.y(10 - (i * 10) / CELLS)}
                  width={sc.x(10 / CELLS) - sc.x(0) + 0.5}
                  height={sc.y(0) - sc.y(10 / CELLS) + 0.5}
                />
              )),
            )}
          </g>
        ) : null
      }
      over={(sc) => (
        <g className="wg-links">
          {r.neighbors.map((nb) => (
            <line key={nb.idx} x1={sc.x(q.x)} y1={sc.y(q.y)} x2={sc.x(nb.x)} y2={sc.y(nb.y)} />
          ))}
          {metric === "euclid" && near ? <circle className="wg-ring" cx={sc.x(q.x)} cy={sc.y(q.y)} r={Math.abs(sc.x(near.dist) - sc.x(0))} /> : null}
        </g>
      )}
    />
  );
  const controls = (
    <>
      <Row>
        <Stepper inline label="새 점 x" value={q.x} min={0} max={10} step={0.5} onChange={(x) => setQ({ x, y: q.y })} />
        <Stepper inline label="새 점 y" value={q.y} min={0} max={10} step={0.5} onChange={(y) => setQ({ x: q.x, y })} />
        <Stepper inline label="이웃 수 k" value={k} min={1} max={15} onChange={setK} />
      </Row>
      <Row>
        <Seg
          label="거리"
          value={metric}
          options={[
            { value: "euclid", label: "유클리드" },
            { value: "manhattan", label: "맨해튼" },
          ]}
          onChange={setMetric}
        />
        <Toggle label="영역 색칠" on={shade} onChange={setShade} />
        <Btn
          onClick={() => {
            // k=1 이면 강아지, k=3·5 면 고양이로 답이 갈리는 자리예요(미션 힌트)
            setQ({ x: 5, y: 5.5 });
            setK(3);
          }}
        >
          예시 자리
        </Btn>
      </Row>
    </>
  );
  const result = (
    <>
      <Tex block tex={metric === "euclid" ? "d=\\sqrt{(x_1-x_2)^2+(y_1-y_2)^2}" : "d=|x_1-x_2|+|y_1-y_2|"} />
      <div className="wg-grid3">
        {r.votes.map((v, c) => (
          <Readout key={c} label={CLASS_NAMES[c]} tone={c === r.winner ? "ok" : "plain"}>
            {v}표
          </Readout>
        ))}
      </div>
      <div className={board ? "wg-two" : "wg-stack"}>
        <Big label="분류 결과" tone="ok" sub={r.tieBroken ? "동점이라 가장 가까운 이웃을 따랐어요" : undefined}>
          {CLASS_NAMES[r.winner]}
        </Big>
        <Readout label="같은 자리에서 k=1 과 k=5">
          k=1이면 {CLASS_NAMES[w1]}, k=5이면 {CLASS_NAMES[w5]}이에요.
        </Readout>
      </div>
    </>
  );

  // 칠판: 왼쪽 = 그림, 오른쪽 = 새 점·k ± → 거리·색칠 → 거리 식 → 표 수 → 분류 결과
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <Split
          a={plot}
          b={
            <>
              {controls}
              {result}
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="wg-body">
      {plot}
      <Note>새 점을 끌거나, 그림을 누르면 그 자리로 옮겨 가요.</Note>
      {controls}
      {result}
    </div>
  );
}
