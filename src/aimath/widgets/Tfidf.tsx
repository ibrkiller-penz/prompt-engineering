import { useState } from "react";
import RichMath from "../RichMath";
import { df, idf, tf, tfidf, tokenize, topWords, vocabOf } from "./Tfidf.logic";
import type { LogBase } from "./Tfidf.logic";

const DEFAULT_DOCS = [
  "오늘 급식은 맛있는 카레 였다",
  "오늘 수업은 재미있는 수학 이었다",
  "오늘 급식은 카레 카레 카레 대신 돈가스 였다",
];
const MAX_LEN = 120;

const f3 = (x: number) => (Math.round(x * 1000) / 1000).toFixed(3);

export default function Tfidf() {
  const [texts, setTexts] = useState<string[]>(DEFAULT_DOCS);
  const [base, setBase] = useState<LogBase>("e");
  const [pick, setPick] = useState("카레");

  const docs = texts.map(tokenize);
  const N = docs.length;
  const vocab = vocabOf(docs);
  const baseName = base === "e" ? "ln" : "log₁₀";
  const chosen = vocab.includes(pick) ? pick : vocab[0] ?? "";
  const dfv = df(docs, chosen);
  const idfv = idf(N, dfv, base);

  const scores = docs.map((d) => vocab.map((w) => tfidf(d, docs, w, base)));
  const tops = scores.map((row) => topWords(row, vocab));
  const hasAny = vocab.length > 0;

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · TF-IDF 계산기</div>
      <p className="mb-3 text-sm text-muted">
        문서 세 개를 고쳐 써 보세요. 어느 문서에서만 자주 나오는 단어일수록 점수가 커져요. (공백으로 단어를 나누고 조사는 그대로 둬요.)
      </p>

      <div className="grid gap-3">
        {texts.map((t, i) => (
          <label key={i} className="block text-sm">
            <span className="mb-1 block font-bold">문서 {i + 1} <span className="font-normal text-muted">({t.length}/{MAX_LEN}자)</span></span>
            <textarea
              value={t}
              maxLength={MAX_LEN}
              rows={2}
              onChange={(e) => setTexts(texts.map((x, j) => (j === i ? e.target.value : x)))}
              className="min-h-[44px] w-full rounded-card border border-line bg-bg p-2 text-base text-ink"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-bold">로그 밑:</span>
        {(["e", "10"] as const).map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBase(b)}
            aria-pressed={base === b}
            className={"min-h-[44px] min-w-[64px] rounded-card border px-3 " + (base === b ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
          >
            {b === "e" ? "e (자연로그)" : "10 (상용로그)"}
          </button>
        ))}
      </div>

      <h4 className="mt-4 mb-1 text-sm font-bold">1. 한 단어를 골라 단계별로 계산하기</h4>
      {!hasAny ? (
        <p className="text-sm text-muted">문서에 단어를 입력하면 계산이 시작돼요.</p>
      ) : (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            단어
            <select value={chosen} onChange={(e) => setPick(e.target.value)} className="min-h-[44px] rounded-card border border-line bg-bg px-2 text-base">
              {vocab.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
          <div className="mt-2 space-y-1 rounded-card bg-bg p-3 text-sm leading-7">
            <div><RichMath text={"$\\text{tf}(t,d)=\\dfrac{\\text{문서 d에서 t의 개수}}{\\text{문서 d의 전체 단어 수}}$"} /></div>
            {docs.map((d, i) => {
              const c = d.filter((x) => x === chosen).length;
              return <div key={i}>문서 {i + 1}: tf = {c}/{d.length || 0} = <b>{f3(tf(d, chosen))}</b></div>;
            })}
            <div className="pt-1">
              df (단어가 들어 있는 문서 수) = <b>{dfv}</b>, 문서 수 N = <b>{N}</b>
            </div>
            <div>
              <RichMath text={base === "e" ? "$\\text{idf}=\\ln\\dfrac{N}{\\text{df}}$" : "$\\text{idf}=\\log_{10}\\dfrac{N}{\\text{df}}$"} />
              {idfv === null ? (
                <span className="text-bad"> → df가 0이라서 계산할 수 없어요. (이 단어는 어느 문서에도 없어요. tf-idf는 0으로 둬요.)</span>
              ) : (
                <span> = {baseName}({N}/{dfv}) = <b>{f3(idfv)}</b></span>
              )}
            </div>
            {idfv !== null && (
              <div>
                tf-idf = tf × idf →{" "}
                {docs.map((d, i) => (
                  <span key={i} className="mr-2 whitespace-nowrap">문서{i + 1}: <b>{f3(tfidf(d, docs, chosen, base))}</b></span>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <h4 className="mt-4 mb-1 text-sm font-bold">2. 모든 단어의 tf-idf 표</h4>
      {hasAny && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-center text-sm">
            <thead>
              <tr className="bg-bg">
                <th className="border border-line p-1.5 text-left">단어</th>
                <th className="border border-line p-1.5 font-normal">df</th>
                <th className="border border-line p-1.5 font-normal">idf</th>
                {docs.map((_, i) => (
                  <th key={i} className="border border-line p-1.5 font-normal">문서{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vocab.map((w, wi) => {
                const i2 = idf(N, df(docs, w), base);
                return (
                  <tr key={w}>
                    <th className="border border-line p-1.5 text-left">{w}</th>
                    <td className="border border-line p-1.5">{df(docs, w)}</td>
                    <td className="border border-line p-1.5">{i2 === null ? "-" : f3(i2)}</td>
                    {docs.map((_, di) => {
                      const top = tops[di].includes(w);
                      return (
                        <td key={di} className={"border border-line p-1.5 " + (top ? "bg-accent-soft font-bold text-accent" : scores[di][wi] === 0 ? "text-muted" : "")}>
                          {f3(scores[di][wi])}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-muted">색칠된 칸은 그 문서에서 점수가 가장 큰 단어예요. 점수가 모두 0인 문서는 색칠하지 않아요.</p>
        </div>
      )}

      <p className="mt-3 rounded-card bg-accent-soft p-3 text-sm text-accent">
        왜 흔한 단어는 점수가 낮을까요? 모든 문서에 들어 있으면 df = N 이라서 idf = log(N/N) = log 1 = 0 이고, tf에 0을 곱하면 점수도 0이 되기 때문이에요.
      </p>
    </div>
  );
}
