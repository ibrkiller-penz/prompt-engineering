// TF-IDF 계산기: 문서 세 개에서 단어 하나를 골라 tf, df, idf, tf-idf 를 차례로 계산해요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { df, idf, tf, tfidf, tokenize, topWords, vocabOf, type LogBase } from "@legacy/widgets/Tfidf.logic";
import { Big, Btn, Hide, Note, Row, Seg, Table, Tex, useIsBoard } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const DEFAULT_DOCS = ["오늘 급식은 맛있는 카레 였다", "오늘 수업은 재미있는 수학 이었다", "오늘 급식은 카레 카레 카레 대신 돈가스 였다"];
const EXAMPLE_DOCS = ["강아지는 산책을 좋아해요", "고양이는 낮잠을 좋아해요", "강아지와 고양이는 친구예요"];
const MAX_LEN = 120;
const f3 = (x: number) => (Math.round(x * 1000) / 1000).toFixed(3);

export default function Tfidf(props: WidgetProps) {
  const board = useIsBoard();
  const [texts, setTexts] = useState<string[]>(DEFAULT_DOCS);
  const [base, setBase] = useState<LogBase>("e");
  const [pick, setPick] = useState("카레");
  const docs = texts.map(tokenize);
  const N = docs.length;
  const vocab = vocabOf(docs);
  const word = vocab.indexOf(pick) >= 0 ? pick : vocab[0] || "";
  const dfv = word ? df(docs, word) : 0;
  const idfv = word ? idf(N, dfv, base) : null;
  const log = base === "e" ? "\\ln" : "\\log_{10}";
  const tops = docs.map((d) => topWords(vocab.map((w) => tfidf(d, docs, w, base)), vocab));
  const topInAll = tops.some((t) => t.indexOf(word) >= 0);
  useMission(props, mission, { N, word, df: dfv, topInAll });

  return (
    <div className="wg-body">
      {board ? (
        <ol className="wg-docs">
          {texts.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      ) : (
        <div className="wg-fields">
          {texts.map((t, i) => (
            <label key={i} className="wg-field">
              <span>문서 {i + 1}</span>
              <input className="wg-input" maxLength={MAX_LEN} value={t} onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
        </div>
      )}
      <Row>
        <Btn onClick={() => setTexts(DEFAULT_DOCS)}>예시 1: 급식</Btn>
        <Btn onClick={() => setTexts(EXAMPLE_DOCS)}>예시 2: 동물</Btn>
      </Row>
      <Seg
        label="로그"
        value={base}
        options={[
          { value: "e", label: "자연로그 ln" },
          { value: "10", label: "상용로그 log₁₀" },
        ]}
        onChange={setBase}
      />
      <p className="wg-line-label">단어를 골라요</p>
      <div className="wg-chips" role="group" aria-label="단어 고르기">
        {vocab.map((w) => (
          <button key={w} type="button" className={"wg-btn wg-chip-btn" + (w === word ? " is-on" : "")} aria-pressed={w === word} onClick={() => setPick(w)}>
            {w}
          </button>
        ))}
      </div>
      {word ? (
        <>
          <Big label={`'${word}'의 idf`} sub={`${N}개 문서 중 ${dfv}개에 있어요`}>
            {idfv === null ? "—" : f3(idfv)}
          </Big>
          <Hide label="점수 계산">
          <Tex block tex={`\\text{idf}=${log}\\frac{N}{\\text{df}}=${log}\\frac{${N}}{${dfv}}=${idfv === null ? "\\text{정의 안 됨}" : f3(idfv)}`} />
          <Table
            caption={`'${word}'의 점수`}
            head={["문서", "tf", "tf × idf"]}
            rows={docs.map((d, i) => {
              const t = tf(d, word);
              const cnt = d.filter((x) => x === word).length;
              return [`문서 ${i + 1}`, <Tex key="t" tex={`\\frac{${cnt}}{${d.length}}=${f3(t)}`} />, f3(tfidf(d, docs, word, base))];
            })}
          />
          {dfv === N ? <Note>'{word}'는 모든 문서에 있어서 idf 가 0이에요. 어느 문서에서도 특별하지 않은 단어라는 뜻이에요.</Note> : null}
          <Note>
            문서마다 점수 1등: {tops.map((t, i) => `문서 ${i + 1} → ${t.length ? t.join(", ") : "없음"}`).join(" · ")}
          </Note>
          </Hide>
          <p className="wg-sr">고른 단어 {word}, 들어 있는 문서 수 {dfv}, idf {idfv === null ? "정의 안 됨" : fmtNum(idfv, 3)}</p>
        </>
      ) : (
        <Note>문서에 단어가 없어요. 문장을 적어 봐요.</Note>
      )}
    </div>
  );
}
