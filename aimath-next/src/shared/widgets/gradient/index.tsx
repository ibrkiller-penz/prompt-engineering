// 경사하강법 따라가기: 기울기의 반대쪽으로 η만큼씩 내려가며 가장 낮은 곳을 찾아요.
// 시작점은 그래프 위 손잡이를 좌우로 끌거나 ± 단추로 정해요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { FUNCTIONS, classify, stepOnce, type Status } from "@legacy/widgets/Gradient.logic";
import Plot from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Hide, Note, Readout, Row, Seg, Split, Tex, Verdict, useIsBoard } from "../kit.tsx";
import { fmtNum, sampleFn } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const ETAS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 1.1, 1.2];
const MAX_STEPS = 50;
const MESSAGES: Record<Status, { ok: boolean | null; text: string }> = {
  start: { ok: null, text: "'한 걸음'을 눌러 출발해요." },
  moving: { ok: null, text: "내려가는 중이에요." },
  converged: { ok: true, text: "가장 낮은 곳(최솟값) 근처에 도착했어요. 기울기가 거의 0이에요." },
  local: { ok: false, text: "작은 골짜기(극소)에 멈췄어요. 더 낮은 곳이 따로 있어요. 시작점을 바꿔 봐요." },
  diverged: { ok: false, text: "학습률이 너무 커서 점점 멀리 튀어 나갔어요(발산)." },
  oscillating: { ok: false, text: "골짜기 양쪽을 왔다 갔다 해요. 학습률을 줄여 봐요." },
};

export default function Gradient(props: WidgetProps) {
  const [fnId, setFnId] = useState(FUNCTIONS[0].id);
  const fn = FUNCTIONS.filter((f) => f.id === fnId)[0] || FUNCTIONS[0];
  const [start, setStart] = useState(fn.defaultStart);
  const [etaIdx, setEtaIdx] = useState(3);
  const [ws, setWs] = useState<number[]>([fn.defaultStart]);
  const eta = ETAS[etaIdx];
  const status = classify(fn, ws);
  const steps = ws.length - 1;
  useMission(props, mission, { status, steps, eta });

  const reset = (s = start) => setWs([s]);
  const go = (n: number) => {
    const out = ws.slice();
    for (let i = 0; i < n && out.length - 1 < MAX_STEPS; i++) {
      const w = out[out.length - 1];
      const nx = stepOnce(fn, w, eta).wNew;
      out.push(nx);
      if (!Number.isFinite(nx) || Math.abs(nx) > 1e3) break;
    }
    setWs(out);
  };
  const w = ws[ws.length - 1];
  const { slope, wNew } = stepOnce(fn, w, eta);
  const fvals = ws.map((v) => fn.f(v));
  const yHi = Math.max.apply(
    null,
    sampleFn(fn.f, fn.lo, fn.hi, 60).map((p) => p.y),
  );
  const yLo = Math.min.apply(
    null,
    sampleFn(fn.f, fn.lo, fn.hi, 60).map((p) => p.y),
  );
  const path = ws.map((v, i) => ({ x: v, y: fvals[i] })).filter((p) => p.x >= fn.lo - 1 && p.x <= fn.hi + 1);
  const m = MESSAGES[status];

  const board = useIsBoard();
  const fnSeg = (
    <Seg
      label="함수"
      value={fnId}
      options={FUNCTIONS.map((f) => ({ value: f.id, label: f.formula }))}
      onChange={(id) => {
        const f = FUNCTIONS.filter((x) => x.id === id)[0];
        setFnId(id);
        setStart(f.defaultStart);
        setWs([f.defaultStart]);
      }}
    />
  );
  const graph = (
    <>
      <Tex block tex={fn.tex + ",\\quad " + fn.dtex} />
      <Plot
        title="함수 그래프와 내려간 길"
        boardMaxH={420}
        x={[fn.lo, fn.hi]}
        y={[Math.floor(yLo - 0.5), Math.ceil(yHi)]}
        xLabel="w"
        yLabel="f(w)"
        series={[
          { label: "f(w)", s: 1, kind: "line", data: sampleFn(fn.f, fn.lo, fn.hi, 160), noTable: true },
          { label: "지나온 자리", s: 2, kind: "line", data: path, size: 1.2 },
        ]}
        summary={`${steps}걸음 뒤 w = ${fmtNum(w, 3)}, f(w) = ${fmtNum(fn.f(w), 3)}이에요.`}
        handles={steps === 0 ? [{ id: "w0", x: start, y: fn.f(start), label: "시작점 w₀", s: 2, step: 0.5 }] : []}
        onDrag={(_, p) => {
          const v = Math.max(fn.lo, Math.min(fn.hi, Math.round(p.x * 2) / 2));
          setStart(v);
          reset(v);
        }}
      />
    </>
  );
  const controls = (
    <>
      <Row>
        <Stepper
          inline
          label="시작점 w₀"
          value={start}
          min={fn.lo}
          max={fn.hi}
          step={0.5}
          onChange={(v) => {
            setStart(v);
            reset(v);
          }}
        />
        <Stepper
          inline
          label="학습률 η"
          value={etaIdx}
          min={0}
          max={ETAS.length - 1}
          format={(i) => String(ETAS[i])}
          onChange={(i) => {
            setEtaIdx(i);
            reset();
          }}
        />
      </Row>
      <Row>
        <Btn primary onClick={() => go(1)} disabled={steps >= MAX_STEPS}>
          한 걸음
        </Btn>
        <Btn onClick={() => go(10)} disabled={steps >= MAX_STEPS}>
          10걸음
        </Btn>
        <Btn onClick={() => reset()}>처음으로</Btn>
      </Row>
      <Hide label="다음 자리 계산">
        <Tex block tex={`w_{\\text{new}}=w-\\eta f'(w)=${fmtNum(w, 3)}-${eta}\\times(${fmtNum(slope, 3)})=${fmtNum(wNew, 3)}`} />
      </Hide>
    </>
  );
  const result = (
    <>
      <div className={board ? "wg-two" : "wg-stack"}>
        <Big label="지금 w" sub={`f(w) = ${fmtNum(fn.f(w), 3)}`}>
          {fmtNum(w, 3)}
        </Big>
        <div className="wg-grid3">
          <Readout label="걸음 수" keep>
            {steps}
          </Readout>
          <Readout label="기울기 f'(w)">{fmtNum(slope, 3)}</Readout>
        </div>
      </div>
      <Verdict ok={m.ok}>{m.text}</Verdict>
    </>
  );

  // 칠판: 맨 위 = 함수 고르기, 왼쪽 = 식과 그림, 오른쪽 = ± 조작·걸음 → 계산 → 지금 w · 걸음 수 → 판정
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <div className="wg-topline">{fnSeg}</div>
        <Split
          a={graph}
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
      {fnSeg}
      {graph}
      {controls}
      {result}
      <Note>기울기가 양수면 왼쪽으로, 음수면 오른쪽으로 움직여요. 학습률 η는 한 걸음의 크기를 정해요.</Note>
    </div>
  );
}
