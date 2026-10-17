// 규칙 기반 vs 학습 기반: 스팸 메일을 '느낌표 수 · 광고 단어 수'로 나눠요.
// 왼쪽은 내가 만든 규칙(IF … THEN 스팸), 오른쪽은 데이터를 보고 스스로 고치는 모델(퍼셉트론)이에요.
import { useMemo, useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { INIT_MODEL, accuracy, boundarySegment, makeData, modelPredict, rulePredict, trainEpoch, type Model, type Rule } from "@legacy/widgets/RuleVsLearn.logic";
import Plot from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Readout, Row, Seg, Note } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const N = 40;
const pct = (v: number) => Math.round(v * 100) + "%";

export default function RuleVsLearn(props: WidgetProps) {
  const [seed, setSeed] = useState(7);
  const data = useMemo(() => makeData(N, seed), [seed]);
  const [rule, setRule] = useState<Rule>({ t1: 5, t2: 5, op: "AND" });
  const [model, setModel] = useState<Model>(INIT_MODEL);
  const [epoch, setEpoch] = useState(0);

  const ruleAcc = accuracy((p) => rulePredict(rule, p), data);
  const modelAcc = accuracy((p) => modelPredict(model, p), data);
  useMission(props, mission, { ruleAcc, modelAcc, epoch });

  const train = (times: number) => {
    let m = model;
    for (let i = 0; i < times; i++) m = trainEpoch(m, data, epoch + i);
    setModel(m);
    setEpoch(epoch + times);
  };
  const reset = () => {
    setModel(INIT_MODEL);
    setEpoch(0);
  };

  const spam = data.filter((p) => p.label === 1);
  const ham = data.filter((p) => p.label === 0);
  const seg = boundarySegment(model);

  return (
    <div className="wg-body">
      <Note>점 하나가 메일 한 통이에요. 가로는 느낌표 수, 세로는 광고 단어 수예요. 스팸과 정상 메일을 가장 잘 나누는 방법을 찾아봐요. 칠해진 영역의 모서리(◆)를 끌어도 규칙이 바뀌어요.</Note>
      <Plot
        title="메일 40통의 위치와 두 가지 경계"
        x={[0, 10]}
        y={[0, 10]}
        equal
        xLabel="느낌표 수"
        yLabel="광고 단어 수"
        series={[
          { label: "스팸", s: 1, kind: "points", data: spam },
          { label: "정상", s: 2, kind: "points", data: ham },
          { label: "학습한 경계", s: 3, kind: "segs", data: seg ? [seg[0], seg[1]] : [], noTable: true },
        ]}
        summary={`스팸 ${spam.length}통, 정상 ${ham.length}통이에요. 규칙 정확도 ${pct(ruleAcc)}, 학습 모델 정확도 ${pct(modelAcc)}예요.`}
        handles={[{ id: "rule", x: rule.t1, y: rule.t2, label: "규칙의 기준 모서리", s: 4, step: 0.5 }]}
        onDrag={(_, p) => setRule({ t1: Math.round(p.x * 2) / 2, t2: Math.round(p.y * 2) / 2, op: rule.op })}
        under={(sc) => {
          // 규칙이 '스팸'이라고 하는 곳을 옅게 칠해요
          const x0 = sc.x(rule.t1);
          const y0 = sc.y(rule.t2);
          const L = sc.x(0), R = sc.x(10), T = sc.y(10), B = sc.y(0);
          return rule.op === "AND" ? (
            <rect className="wg-zone" x={x0} y={T} width={Math.max(0, R - x0)} height={Math.max(0, y0 - T)} />
          ) : (
            <path className="wg-zone" d={`M${L},${T}H${R}V${B}H${x0}V${y0}H${L}Z`} />
          );
        }}
      />
      <div className="wg-two">
        <div className="wg-card">
          <h4 className="wg-h">내가 만든 규칙</h4>
          <p className="wg-code">
            IF 느낌표 ≥ {fmtNum(rule.t1)} {rule.op === "AND" ? "그리고" : "또는"} 광고 단어 ≥ {fmtNum(rule.t2)} THEN 스팸
          </p>
          <Stepper label="느낌표 기준" value={rule.t1} min={0} max={10} step={0.5} slider onChange={(v) => setRule({ ...rule, t1: v })} />
          <Stepper label="광고 단어 기준" value={rule.t2} min={0} max={10} step={0.5} slider onChange={(v) => setRule({ ...rule, t2: v })} />
          <Seg
            label="잇는 말"
            value={rule.op}
            options={[
              { value: "AND", label: "그리고(AND)" },
              { value: "OR", label: "또는(OR)" },
            ]}
            onChange={(op) => setRule({ ...rule, op })}
          />
        </div>
        <div className="wg-card">
          <h4 className="wg-h">데이터로 배우는 모델</h4>
          <p className="wg-code">
            {fmtNum(model.w1, 2)}·x + {fmtNum(model.w2, 2)}·y + {fmtNum(model.b, 2)} &gt; 0 이면 스팸
          </p>
          <Row>
            <Btn primary onClick={() => train(1)}>
              한 바퀴 학습
            </Btn>
            <Btn onClick={() => train(5)}>5바퀴</Btn>
            <Btn onClick={reset}>처음으로</Btn>
          </Row>
          <Readout label="학습 횟수" keep>
            {epoch}바퀴
          </Readout>
        </div>
      </div>
      <div className="wg-two">
        <Big label="규칙 정확도" tone={ruleAcc >= 0.8 ? "ok" : "plain"}>
          {pct(ruleAcc)}
        </Big>
        <Big label="모델 정확도" tone={epoch > 0 && modelAcc > ruleAcc ? "ok" : "plain"}>
          {pct(modelAcc)}
        </Big>
      </div>
      <Row>
        <Btn onClick={() => setSeed(seed + 1)}>새 메일 40통 받기</Btn>
      </Row>
      <Note>새 메일을 받아도 규칙과 모델은 그대로예요. 어느 쪽이 새 데이터에서도 잘 맞는지 비교해 봐요.</Note>
    </div>
  );
}
