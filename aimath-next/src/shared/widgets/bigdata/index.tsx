// 데이터가 많아지면 평균이 안정될까? 시험 점수 모집단(진짜 평균 65점)에서 n명을 뽑아 평균을 봐요.
import { useMemo, useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { TRUE_MEAN, histogram, interpret, mean, runningMeans, sample, sd } from "@legacy/widgets/BigData.logic";
import Plot from "../Plot.tsx";
import { Big, Btn, Hide, Note, Readout, Row, Seg, Split, Toggle, useIsBoard } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const SIZES = [5, 20, 100, 1000, 10000];

export default function BigData(props: WidgetProps) {
  const [n, setN] = useState(20);
  const [seed, setSeed] = useState(1);
  const [biased, setBiased] = useState(false);
  const xs = useMemo(() => sample(n, seed, biased), [n, seed, biased]);
  const m = mean(xs);
  const run = useMemo(() => runningMeans(xs, 160), [xs]);
  const hist = useMemo(() => histogram(xs), [xs]);
  useMission(props, mission, { n, biased, mean: m });

  const err = Math.abs(m - TRUE_MEAN);
  const histMax = Math.max.apply(null, hist.concat([1]));

  const board = useIsBoard();
  const top = (
    <>
      <Seg label="뽑는 사람 수 n" value={n} options={SIZES.map((v) => ({ value: v, label: v.toLocaleString("ko-KR") + "명" }))} onChange={setN} />
      <Row>
        <Btn onClick={() => setSeed(seed + 1)}>다시 뽑기</Btn>
        <Toggle label="한쪽에서만 뽑기(학원 앞 설문)" on={biased} onChange={setBiased} />
      </Row>
    </>
  );
  const nums = (
    <div className={board ? "wg-two" : "wg-stack"}>
      <Big label="표본 평균" sub={`진짜 평균 ${TRUE_MEAN}점`}>
        {fmtNum(m, 1)}점
      </Big>
      <div className="wg-grid3">
        <Readout label="진짜 평균과 차이" tone={err < 1.5 ? "ok" : "plain"}>
          {fmtNum(err, 2)}점
        </Readout>
        <Readout label="표준편차">{fmtNum(sd(xs), 2)}점</Readout>
      </div>
    </div>
  );
  const plot = (
    <Plot
      title="뽑은 사람이 늘어날 때 누적 평균"
      boardMaxH={470}
      x={[1, Math.max(2, n)]}
      y={[30, 100]}
      xLabel="지금까지 뽑은 사람 수"
      yLabel="평균 점수"
      series={[
        { label: "누적 평균", s: 1, kind: "line", data: run.map((p) => ({ x: p.k, y: p.m })) },
        {
          label: "진짜 평균 " + TRUE_MEAN + "점",
          s: 2,
          kind: "line",
          data: [
            { x: 1, y: TRUE_MEAN },
            { x: Math.max(2, n), y: TRUE_MEAN },
          ],
          noTable: true,
        },
      ]}
      summary={`${n}명을 뽑았더니 평균이 ${fmtNum(m, 1)}점이에요. 진짜 평균과 ${fmtNum(err, 1)}점 차이예요.`}
    />
  );
  const rest = (
    <>
      <p className="wg-line-label">점수 분포(가로: 10점 단위 점수대, 막대 높이: 사람 수)</p>
      <div className="wg-bars" role="img" aria-label={"점수 분포: " + hist.map((h, i) => `${i * 10}점대 ${h}명`).join(", ")}>
        {hist.map((h, i) => (
          <div key={i} className="wg-bar-col">
            <div className="wg-bar-track">
              <div className="wg-bar" style={{ height: Math.round((h / histMax) * 100) + "%" }} />
            </div>
            <span className="wg-bar-label">{i * 10}</span>
          </div>
        ))}
      </div>
      <Hide label="해석">
        <Note>{interpret(n, m, biased)}</Note>
      </Hide>
    </>
  );

  // 칠판: 맨 위 = n 고르기·다시 뽑기·한쪽에서만, 왼쪽 = 누적 평균 그림, 오른쪽 = 표본 평균 → 분포 → 해석
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <div className="wg-topline">{top}</div>
        <Split
          a={plot}
          b={
            <>
              {nums}
              {rest}
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="wg-body">
      <Note>학생 수가 아주 많은 학교의 시험 점수에서 n명을 뽑아 평균을 내요. 이 학교의 진짜 평균은 {TRUE_MEAN}점이에요.</Note>
      {top}
      {plot}
      {nums}
      {rest}
    </div>
  );
}
