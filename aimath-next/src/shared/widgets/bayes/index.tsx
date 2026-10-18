// 베이즈 확률 업데이트: 1000명(통)으로 나눠 세면 P(A|B)가 보여요. B가 거듭 나오면 확률이 어떻게 바뀌는지도 봐요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { posterior, probB, splitCounts, updateChain } from "@legacy/widgets/Bayes.logic";
import Plot from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Hide, Note, Row, Seg, Split, Table, Tex, useIsBoard } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

interface Scenario {
  id: string;
  name: string;
  a: string;
  b: string;
  prior: number;
  hit: number;
  fa: number;
  story: string;
}
const SCENARIOS: Scenario[] = [
  {
    id: "spam",
    name: "스팸 메일 필터",
    a: "스팸 메일",
    b: "'무료' 단어 포함",
    prior: 20,
    hit: 80,
    fa: 10,
    story: "받은 메일 중 20%가 스팸이에요. 스팸의 80%에는 '무료'라는 단어가 있고, 정상 메일에도 10%는 '무료'가 들어 있어요.",
  },
  {
    id: "disease",
    name: "질병 검사",
    a: "병에 걸림",
    b: "검사 양성",
    prior: 1,
    hit: 90,
    fa: 9,
    story: "어떤 병에 걸린 사람은 전체의 1%예요. 병이 있으면 검사가 90% 양성으로 나오고, 병이 없어도 9%는 양성으로 나와요.",
  },
];
const pct = (x: number) => fmtNum(x * 100, 1) + "%";

export default function Bayes(props: WidgetProps) {
  const board = useIsBoard();
  const [sid, setSid] = useState("spam");
  const sc = SCENARIOS.filter((s) => s.id === sid)[0] || SCENARIOS[0];
  const [prior, setPrior] = useState(sc.prior);
  const [hit, setHit] = useState(sc.hit);
  const [fa, setFa] = useState(sc.fa);
  const [repeats, setRepeats] = useState(0);
  const P = prior / 100,
    H = hit / 100,
    F = fa / 100;
  const post = posterior(P, H, F);
  const c = splitCounts(P, H, F, 1000);
  const chain = updateChain(P, H, F, Math.max(repeats, 5));
  useMission(props, mission, { prior: P, hit: H, fa: F, post, chainLast: chain[repeats], repeats });

  const choose = (id: string) => {
    const s = SCENARIOS.filter((x) => x.id === id)[0];
    setSid(id);
    setPrior(s.prior);
    setHit(s.hit);
    setFa(s.fa);
    setRepeats(0);
  };

  // 칠판은 세로 자리가 모자라 A·B 기호로 줄여 쓰고, 기호 뜻을 이야기 끝에 붙여요
  const nB = board ? "B" : sc.b;
  const nA = board ? "A" : sc.a;
  const left = (
    <>
      <Seg label="상황" value={sid} options={SCENARIOS.map((s) => ({ value: s.id, label: s.name }))} onChange={choose} />
      <Note>
        {sc.story}
        {board ? ` (A: ${sc.a}, B: ${sc.b})` : null}
      </Note>
      <Row>
        <Stepper inline label={board ? "P(A)" : `P(${sc.a})`} value={prior} min={1} max={99} unit="%" slider onChange={setPrior} />
        <Stepper inline label={board ? "P(B | A)" : `P(${sc.b} | ${sc.a})`} value={hit} min={1} max={99} unit="%" slider onChange={setHit} />
        <Stepper inline label={board ? "P(B | A 아님)" : `P(${sc.b} | 아님)`} value={fa} min={1} max={99} unit="%" slider onChange={setFa} />
      </Row>
      <Table
        caption="1000개로 나눠 세기"
        head={["", nB, nB + " 아님", "합"]}
        rows={[
          [nA, String(c.ab), String(c.anb), String(c.ab + c.anb)],
          [nA + " 아님", String(c.nab), String(c.nanb), String(c.nab + c.nanb)],
          ["합", String(c.ab + c.nab), String(c.anb + c.nanb), "1000"],
        ]}
      />
    </>
  );
  const calc = (
    <Hide label="베이즈 정리 계산">
      <Tex
        block
        tex={`P(A\\mid B)=${board ? "" : "\\frac{P(A)P(B\\mid A)}{P(B)}="}\\frac{${fmtNum(P, 3)}\\times ${fmtNum(H, 3)}}{${fmtNum(probB(P, H, F), 4)}}\\approx ${post === null ? "?" : fmtNum(post, 4)}`}
      />
    </Hide>
  );
  const big = (
    <Big label={board ? "B일 때 A일 확률 P(A|B)" : `${sc.b}일 때 ${sc.a}일 확률 P(A|B)`} tone={post !== null && post >= 0.5 ? "ok" : "warn"} sub={`1000개 중 ${c.ab} ÷ ${c.ab + c.nab}`}>
      {post === null ? "—" : pct(post)}
    </Big>
  );
  const again = (
    <>
      <h4 className="wg-h">B가 여러 번 나오면?</h4>
      <Stepper label="B가 나온 횟수" value={repeats} min={0} max={5} onChange={setRepeats} />
    </>
  );
  const plot = (
    <Plot
      title="B가 거듭 나올 때 P(A)의 변화"
      x={[0, 5]}
      y={[0, 1]}
      xTicks={[0, 1, 2, 3, 4, 5]}
      xLabel="B가 나온 횟수"
      yLabel="확률"
      ratio={0.45}
      boardMaxH={260}
      series={[{ label: "P(A)", s: 1, kind: "line", data: chain.slice(0, Math.max(repeats, 0) + 1).map((p, i) => ({ x: i, y: p })) }]}
      summary={`B가 ${repeats}번 나온 뒤 확률은 ${pct(chain[repeats])}이에요.`}
    />
  );
  const note = <Note>한 번 계산한 사후확률을 다음 계산의 사전확률로 써요. 이것이 '베이즈 업데이트'예요.</Note>;

  // 칠판: 왼쪽 = 상황·세 확률·1000개 표, 오른쪽 = 계산 → [P(A|B) | 거듭 나오면] → 그림(스크롤 없이 한 화면)
  if (board) {
    return (
      <div className="wg-body wg-body-split wg-bayes">
        <Split
          a={left}
          b={
            <>
              {calc}
              <div className="wg-two">
                {big}
                <div>{again}</div>
              </div>
              {plot}
            </>
          }
        />
      </div>
    );
  }
  return (
    <div className="wg-body">
      {left}
      {calc}
      {big}
      {again}
      {plot}
      {note}
    </div>
  );
}
