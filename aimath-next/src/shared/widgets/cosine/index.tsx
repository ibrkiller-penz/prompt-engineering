// 코사인 유사도: 문장 두 개를 빈도 벡터로 바꿔 사잇각의 코사인을 구해요. 벡터 모드에서는 2차원 화살표로 직접 만져 봐요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { buildVocab, cosine, countVector, tokenize } from "@legacy/widgets/Cosine.logic";
import Plot from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Hide, Note, Readout, Row, Seg, Table, Tex, useIsBoard } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const MAX_LEN = 150;
const PRESETS = [
  { name: "비슷한 문장", a: "나는 강아지를 좋아해요", b: "나는 고양이를 좋아해요" },
  { name: "전혀 다른 문장", a: "나는 강아지를 좋아해요", b: "내일 수학 시험이 있어요" },
  { name: "같은 문장", a: "나는 강아지를 좋아해요", b: "나는 강아지를 좋아해요" },
];
const vecTex = (v: number[]) => "(" + v.join(",\\ ") + ")";
const r4 = (x: number) => fmtNum(x, 4);
const R5 = (v: number) => Math.max(-5, Math.min(5, Math.round(v)));

export default function Cosine(props: WidgetProps) {
  const board = useIsBoard();
  const [mode, setMode] = useState<"text" | "vec">("text");
  const [sa, setSa] = useState(PRESETS[0].a);
  const [sb, setSb] = useState(PRESETS[0].b);
  const [va, setVa] = useState([3, 4]);
  const [vb, setVb] = useState([4, 3]);

  const ta = tokenize(sa);
  const tb = tokenize(sb);
  const vocab = buildVocab(ta, tb);
  const A = mode === "text" ? countVector(ta, vocab) : va;
  const B = mode === "text" ? countVector(tb, vocab) : vb;
  const r = cosine(A, B);
  useMission(props, mission, { mode, cos: r.cos });

  const formula =
    r.cos === null
      ? "\\cos\\theta\\ \\text{는 영벡터가 있어 정할 수 없어요}"
      : `\\cos\\theta=\\frac{A\\cdot B}{|A||B|}=\\frac{${r.dot}}{\\sqrt{${r.normSqA}}\\sqrt{${r.normSqB}}}\\approx ${r4(r.cos)}`;

  return (
    <div className="wg-body">
      <Seg
        label="무엇으로 해 볼까요"
        value={mode}
        options={[
          { value: "text", label: "문장" },
          { value: "vec", label: "2차원 벡터" },
        ]}
        onChange={setMode}
      />
      {mode === "text" ? (
        <>
          <Row>
            {PRESETS.map((p) => (
              <Btn
                key={p.name}
                onClick={() => {
                  setSa(p.a);
                  setSb(p.b);
                }}
              >
                {p.name}
              </Btn>
            ))}
          </Row>
          {board ? (
            <div className="wg-two">
              <p className="wg-quote">A: {sa}</p>
              <p className="wg-quote">B: {sb}</p>
            </div>
          ) : (
            <div className="wg-fields">
              <label className="wg-field">
                <span>문장 A</span>
                <input className="wg-input" maxLength={MAX_LEN} value={sa} onChange={(e) => setSa(e.target.value)} />
              </label>
              <label className="wg-field">
                <span>문장 B</span>
                <input className="wg-input" maxLength={MAX_LEN} value={sb} onChange={(e) => setSb(e.target.value)} />
              </label>
            </div>
          )}
          {vocab.length ? <Table caption="빈도 벡터" head={["", ...vocab]} rows={[["A", ...A.map(String)], ["B", ...B.map(String)]]} /> : null}
          <Tex block tex={`A=${vecTex(A)}`} />
          <Tex block tex={`B=${vecTex(B)}`} />
        </>
      ) : (
        <>
          <div className="wg-two">
            <div className="wg-card">
              <h4 className="wg-h">벡터 A</h4>
              <Stepper label="A의 x" value={va[0]} min={-5} max={5} onChange={(v) => setVa([v, va[1]])} />
              <Stepper label="A의 y" value={va[1]} min={-5} max={5} onChange={(v) => setVa([va[0], v])} />
            </div>
            <div className="wg-card">
              <h4 className="wg-h">벡터 B</h4>
              <Stepper label="B의 x" value={vb[0]} min={-5} max={5} onChange={(v) => setVb([v, vb[1]])} />
              <Stepper label="B의 y" value={vb[1]} min={-5} max={5} onChange={(v) => setVb([vb[0], v])} />
            </div>
          </div>
          <Plot
            title="두 벡터 A, B"
            x={[-5, 5]}
            y={[-5, 5]}
            equal
            ratio={1}
            series={[
              { label: "A", s: 1, kind: "line", data: [{ x: 0, y: 0 }, { x: va[0], y: va[1] }] },
              { label: "B", s: 2, kind: "line", data: [{ x: 0, y: 0 }, { x: vb[0], y: vb[1] }] },
            ]}
            summary={`A는 (${va[0]}, ${va[1]}), B는 (${vb[0]}, ${vb[1]})이에요.`}
            handles={[
              { id: "a", x: va[0], y: va[1], label: "벡터 A 의 끝", s: 1, step: 1 },
              { id: "b", x: vb[0], y: vb[1], label: "벡터 B 의 끝", s: 2, step: 1 },
            ]}
            onDrag={(id, p) => (id === "a" ? setVa([R5(p.x), R5(p.y)]) : setVb([R5(p.x), R5(p.y)]))}
          />
        </>
      )}
      <Hide label="계산 과정">
        <Tex block tex={formula} />
      </Hide>
      <Big label="코사인 유사도" tone={r.cos !== null && r.cos > 0.7 ? "ok" : "plain"} sub={r.cos === null ? "영벡터가 있어 정할 수 없어요" : undefined}>
        {r.cos === null ? "—" : r4(r.cos)}
      </Big>
      <div className="wg-grid3">
        <Readout label="사잇각">{r.angleDeg === null ? "—" : fmtNum(r.angleDeg, 1) + "°"}</Readout>
      </div>
      <Note>1에 가까울수록 같은 방향(비슷한 문장), 0이면 수직(겹치는 단어가 없음)이에요. 단어 빈도는 음수가 없어서 문장끼리는 0보다 작아지지 않아요.</Note>
    </div>
  );
}
