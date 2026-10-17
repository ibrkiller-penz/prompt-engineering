// 단어 가방(Bag of Words): 두 문장 → 단어집합 → 원-핫 벡터 → 빈도 벡터, 그리고 합집합의 원소 수.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { buildVocab, countVector, oneHot, setStats, tokenize, uniqueInOrder } from "@legacy/widgets/Bow.logic";
import { Big, Btn, Hide, Note, Row, Table, Tex, Verdict, useIsBoard } from "../kit.tsx";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const MAX_LEN = 200;
const PRESETS = [
  { name: "강아지·고양이", a: "나는 강아지를 좋아해요", b: "나는 고양이를 좋아해요 고양이는 귀여워요" },
  { name: "급식", a: "오늘 급식은 카레 였다", b: "내일 급식은 카레 가 아니다" },
  { name: "전혀 다른 문장", a: "비가 와요", b: "수학 시험 공부 중" },
];

export default function Bow(props: WidgetProps) {
  const board = useIsBoard();
  const [a, setA] = useState(PRESETS[0].a);
  const [b, setB] = useState(PRESETS[0].b);
  const [pick, setPick] = useState("");
  const ta = tokenize(a);
  const tb = tokenize(b);
  const vocab = buildVocab(ta, tb);
  const st = setStats(ta, tb);
  const word = vocab.indexOf(pick) >= 0 ? pick : vocab[0] || "";
  useMission(props, mission, { vocab: vocab.length, inter: st.nInter, union: st.nUnion });

  return (
    <div className="wg-body">
      <Row>
        {PRESETS.map((p) => (
          <Btn
            key={p.name}
            onClick={() => {
              setA(p.a);
              setB(p.b);
            }}
          >
            {p.name}
          </Btn>
        ))}
      </Row>
      {board ? (
        <div className="wg-two">
          <p className="wg-quote">문장 A: {a}</p>
          <p className="wg-quote">문장 B: {b}</p>
        </div>
      ) : (
        <div className="wg-fields">
          <label className="wg-field">
            <span>문장 A</span>
            <input className="wg-input" maxLength={MAX_LEN} value={a} onChange={(e) => setA(e.target.value)} />
          </label>
          <label className="wg-field">
            <span>문장 B</span>
            <input className="wg-input" maxLength={MAX_LEN} value={b} onChange={(e) => setB(e.target.value)} />
          </label>
        </div>
      )}
      <Note>띄어쓰기로 자르고 문장부호는 지웠어요. 조사는 그대로 둬서 '고양이를'과 '고양이는'은 다른 단어예요.</Note>
      <p className="wg-line-label">단어집합 V</p>
      <div className="wg-chips" role="group" aria-label="단어를 누르면 원-핫 벡터를 보여 줘요">
        {vocab.map((w) => (
          <button key={w} type="button" className={"wg-btn wg-chip-btn" + (w === word ? " is-on" : "")} aria-pressed={w === word} onClick={() => setPick(w)}>
            {w}
          </button>
        ))}
      </div>
      {word ? (
        <div>
          <p className="wg-line">'{word}'의 원-핫 벡터</p>
          <Tex block tex={"(" + oneHot(word, vocab).join(",\\ ") + ")"} />
        </div>
      ) : null}
      {vocab.length ? (
        <Table
          caption="빈도 벡터(단어가 나온 횟수)"
          head={["", ...vocab]}
          rows={[
            ["A", ...countVector(ta, vocab).map(String)],
            ["B", ...countVector(tb, vocab).map(String)],
          ]}
        />
      ) : (
        <Note>문장을 적으면 단어집합이 생겨요.</Note>
      )}
      <Big label="단어집합의 크기 n(A∪B)" sub={`함께 쓴 단어 ${st.nInter}개`}>
        {st.nUnion}개
      </Big>
      <Hide label="계산 과정">
      <Tex block tex={`n(A\\cup B)=n(A)+n(B)-n(A\\cap B)=${st.nA}+${st.nB}-${st.nInter}=${st.rhs}`} />
      <Verdict ok={st.holds}>
        A의 단어 {st.nA}개, B의 단어 {st.nB}개, 함께 쓴 단어 {st.nInter}개({uniqueInOrder(ta.filter((w) => tb.indexOf(w) >= 0)).join(", ") || "없음"})예요. 단어집합 크기 {st.nUnion}개와 같아요.
      </Verdict>
      </Hide>
    </div>
  );
}
