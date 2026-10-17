// 순서도 따라가기: 한 칸씩 넘기며 지금 칸과 변수 값을 표로 채워요. ① 합에서는 판단 칸의 빈칸 조건도 골라 봐요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { COND_OPTIONS, PRESET_INFO, PRESET_ORDER, buildProgram, checkBlank, explainTex, run, type Inputs, type PresetId } from "@legacy/widgets/Flow.logic";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Hide, Note, Row, Seg, Split, Table, Tex, Toggle, Verdict, useIsBoard } from "../kit.tsx";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const KIND_NAME: Record<string, string> = { start: "시작", end: "끝", proc: "처리", dec: "판단", io: "입출력" };
const DEF: Inputs = { n: 5, a: 7, b: 12, c: 6 };

// 칠판에서는 변수 값 표를 최근 몇 줄만 보여 줘요(세로 864 안에 들도록)
const BOARD_ROWS = 6;

export default function Flow(props: WidgetProps) {
  const board = useIsBoard();
  const [preset, setPreset] = useState<PresetId>("sum");
  const [inp, setInp] = useState<Inputs>(DEF);
  const [idx, setIdx] = useState(-1);
  const [blankOn, setBlankOn] = useState(false);
  const [cond, setCond] = useState("lt");
  const [blankRes, setBlankRes] = useState<boolean | null>(null);
  const info = PRESET_INFO[preset];
  const condKey = preset === "sum" && blankOn ? cond : "le";
  const prog = buildProgram(preset, inp, condKey);
  const trace = run(prog);
  const steps = trace.steps;
  const cur = idx >= 0 ? steps[idx] : null;
  const done = idx >= steps.length - 1 && steps.length > 0;
  useMission(props, mission, { preset, done, blankOk: blankRes });

  const choose = (id: PresetId) => {
    setPreset(id);
    const d = PRESET_INFO[id].defaults;
    setInp({ n: d.n !== undefined ? d.n : DEF.n, a: d.a !== undefined ? d.a : DEF.a, b: d.b !== undefined ? d.b : DEF.b, c: d.c !== undefined ? d.c : DEF.c });
    setIdx(-1);
    setBlankRes(null);
  };
  const setVal = (k: "n" | "a" | "b" | "c", v: number) => {
    const next = { n: inp.n, a: inp.a, b: inp.b, c: inp.c };
    next[k] = v;
    setInp(next);
    setIdx(-1);
  };
  const order = Object.keys(prog.nodes);
  const nodeLabel = (id: string | undefined) => (id && prog.nodes[id] ? prog.nodes[id].label : "");
  const shown = steps.slice(0, idx + 1);

  const skip = board ? Math.max(0, shown.length - BOARD_ROWS) : 0;
  const setup = (
    <>
      <Seg label="순서도" value={preset} options={PRESET_ORDER.map((id) => ({ value: id, label: PRESET_INFO[id].name }))} onChange={choose} />
      <Row>
        {info.inputs.map((k) => (
          <Stepper inline key={k} label={k === "n" ? "N" : k} value={inp[k]} min={info.min} max={info.max} onChange={(v) => setVal(k, v)} />
        ))}
      </Row>
      {preset === "sum" ? (
        <div className="wg-card">
          <Toggle
            label="판단 칸을 빈칸으로"
            on={blankOn}
            onChange={(v) => {
              setBlankOn(v);
              setIdx(-1);
              setBlankRes(null);
            }}
          />
          {blankOn ? (
            <>
              <Seg
                label="빈칸에 넣을 조건"
                value={cond}
                options={COND_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
                onChange={(k) => {
                  setCond(k);
                  setIdx(-1);
                  setBlankRes(null);
                }}
              />
              <Btn
                primary
                onClick={() => {
                  setBlankRes(checkBlank(inp.n, cond).ok);
                }}
              >
                이 조건으로 확인하기
              </Btn>
              {blankRes !== null ? (
                <Verdict keep ok={blankRes}>
                  {(() => {
                    const r = checkBlank(inp.n, cond);
                    if (r.truncated) return "끝나지 않고 계속 반복해요. 다른 조건을 골라 봐요.";
                    return r.ok ? `맞아요. 출력이 ${r.output}로 1부터 ${inp.n}까지의 합과 같아요.` : `출력이 ${r.output}이라서 원하는 값 ${r.expected}와 달라요.`;
                  })()}
                </Verdict>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
  const chart = (
    <>
      <ol className="wg-flow" aria-label="순서도 칸">
        {order.map((id) => {
          const n = prog.nodes[id];
          const on = cur && cur.node === id;
          return (
            <li key={id} className={"wg-node wg-node-" + n.kind + (on ? " is-on" : "")} aria-current={on ? "step" : undefined}>
              <span className="wg-node-kind">{KIND_NAME[n.kind]}</span>
              <span className="wg-node-label">{n.label}</span>
              {n.kind === "dec" ? (
                <span className="wg-node-branch">
                  예 → {nodeLabel(n.yes)} · 아니오 → {nodeLabel(n.no)}
                </span>
              ) : null}
              {on && cur && cur.branch ? <span className="wg-node-now"> ({cur.branch})</span> : null}
            </li>
          );
        })}
      </ol>
      <Row>
        <Btn onClick={() => setIdx(-1)}>처음으로</Btn>
        <Btn onClick={() => setIdx(Math.max(-1, idx - 1))} disabled={idx < 0}>
          이전
        </Btn>
        <Btn primary onClick={() => setIdx(Math.min(steps.length - 1, idx + 1))} disabled={done}>
          다음 칸
        </Btn>
        <Btn onClick={() => setIdx(steps.length - 1)} disabled={done}>
          끝까지
        </Btn>
      </Row>
    </>
  );
  const result = (
    <>
      <Table
        caption={`변수 값 표 (${Math.max(0, idx + 1)} / ${steps.length}칸)` + (skip ? ` · 최근 ${BOARD_ROWS}줄` : "")}
        head={["차례", "칸", ...prog.varNames]}
        rows={shown
          .slice(skip)
          .map((s, i) => [String(skip + i + 1), s.label + (s.branch ? " (" + s.branch + ")" : ""), ...prog.varNames.map((v) => (s.vars[v] === undefined ? "" : String(s.vars[v])))])}
        hl={(i) => skip + i === idx}
      />
      {trace.truncated && done ? <Note>너무 오래 반복해서 멈췄어요. 끝나지 않는 순서도예요.</Note> : null}
      {done && trace.output !== null ? (
        <>
          <Big label="출력">{String(trace.output)}</Big>
          <Hide label="결과 설명">
            <Tex block tex={explainTex(preset, inp, trace.output)} />
          </Hide>
        </>
      ) : null}
    </>
  );

  // 칠판: 왼쪽 = 순서도 고르기·입력·빈칸, 가운데 = 순서도와 넘기기 단추, 오른쪽 = 변수 값 표(최근 줄)·출력
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <Split a={setup} b={chart} c={result} />
      </div>
    );
  }
  return (
    <div className="wg-body">
      {setup}
      {chart}
      {result}
    </div>
  );
}
