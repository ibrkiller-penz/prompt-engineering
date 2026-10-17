// 감성 사전 점수: 후기 속 낱말을 사전 점수로 더해 긍정·부정·중립을 정해요. 사전 방식이 틀리는 문장도 살펴봐요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { highlight, matchReview, totalScore, verdict, type DictEntry } from "@legacy/widgets/Sentiment.logic";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Hide, Note, Row, Table, Tex, useIsBoard } from "../kit.tsx";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const DICT: DictEntry[] = [
  { word: "최고", score: 2 },
  { word: "맛있", score: 2 },
  { word: "재미있", score: 1 },
  { word: "좋", score: 1 },
  { word: "친절", score: 1 },
  { word: "별로", score: -1 },
  { word: "불편", score: -1 },
  { word: "재미없", score: -2 },
  { word: "실망", score: -2 },
  { word: "최악", score: -2 },
];
const REVIEWS = [
  { name: "긍정 후기", text: "음식이 맛있고 직원도 친절해서 정말 좋았어요 최고!" },
  { name: "부정 후기", text: "기다리는 내내 불편했고 음식도 별로여서 실망했어요" },
  { name: "애매한 후기", text: "분위기는 좋았지만 가격은 별로였어요" },
];
const TRICKY = ["이 영화 재미없지 않다", "실망하지 않았어요 최고였어요", "좋다고 말하기엔 너무 별로다"];
const MAX_LEN = 150;
const sign = (n: number) => (n > 0 ? "+" + n : n < 0 ? "−" + -n : "0");

export default function Sentiment(props: WidgetProps) {
  const board = useIsBoard();
  const [text, setText] = useState(REVIEWS[0].text);
  const [threshold, setThreshold] = useState(1);
  const [trickySeen, setTrickySeen] = useState(false);
  const matches = matchReview(text, DICT);
  const total = totalScore(matches);
  const v = verdict(total, threshold);
  const segs = highlight(text, DICT);
  useMission(props, mission, { matches: matches.length, total, verdict: v, trickySeen });

  return (
    <div className="wg-body">
      <Row>
        {REVIEWS.map((r) => (
          <Btn key={r.name} onClick={() => setText(r.text)}>
            {r.name}
          </Btn>
        ))}
      </Row>
      {board ? null : (
        <label className="wg-field">
          <span>후기</span>
          <input className="wg-input" maxLength={MAX_LEN} value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      )}
      <p className="wg-quote wg-marked">
        {segs.map((s, i) =>
          s.score === null ? (
            <span key={i}>{s.text}</span>
          ) : (
            <mark key={i} className={s.score > 0 ? "wg-pos" : "wg-neg"}>
              {s.text}
              <sup>{sign(s.score)}</sup>
            </mark>
          ),
        )}
      </p>
      <Table
        caption="감성 사전(일부)"
        head={["낱말", "점수"]}
        rows={DICT.map((d) => [d.word, sign(d.score)])}
      />
      <Hide label="점수 합계">
      <Tex block tex={matches.length ? `\\text{합계}=${matches.map((m) => (m.score < 0 ? `(${m.score})` : String(m.score))).join("+")}=${total}` : "\\text{합계}=0"} />
      </Hide>
      <Stepper label="기준점 t" value={threshold} min={1} max={4} onChange={setThreshold} />
      <Big label="판정" tone={v === "긍정" ? "ok" : v === "부정" ? "bad" : "plain"} sub={`합계 ${sign(total)}, 기준 ±${threshold}`}>
        {v === "긍정" ? "＋ " : v === "부정" ? "− " : "○ "}
        {v}
      </Big>
      <Note>합계가 t 이상이면 긍정, −t 이하면 부정, 그 사이면 중립이에요.</Note>
      <p className="wg-line-label">사전이 헷갈리는 문장</p>
      <Row>
        {TRICKY.map((t) => (
          <Btn
            key={t}
            onClick={() => {
              setText(t);
              setTrickySeen(true);
            }}
          >
            {t}
          </Btn>
        ))}
      </Row>
      {trickySeen ? <Note>'않다', '~기엔' 같은 말은 사전에 점수가 없어서 뜻이 뒤집혀도 점수는 그대로예요. 사전 방식의 한계예요.</Note> : null}
    </div>
  );
}
