import { useState } from "react";
import { buildVocab, countVector, oneHot, setStats, tokenize, uniqueInOrder } from "./Bow.logic";

const MAX_LEN = 200;

function Chips({ words }: { words: string[] }) {
  if (words.length === 0) return <span className="text-muted">(단어가 없어요)</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.map((w) => (
        <span key={w} className="rounded-full bg-accent-soft px-2.5 py-1 text-sm text-accent">
          {w}
        </span>
      ))}
    </div>
  );
}

export default function Bow() {
  const [textA, setTextA] = useState("나는 강아지를 좋아해요");
  const [textB, setTextB] = useState("나는 고양이를 좋아해요 고양이는 귀여워요");
  const [pick, setPick] = useState("");

  const tokA = tokenize(textA);
  const tokB = tokenize(textB);
  const setA = uniqueInOrder(tokA);
  const setB = uniqueInOrder(tokB);
  const vocab = buildVocab(tokA, tokB);
  const chosen = vocab.includes(pick) ? pick : vocab[0] ?? "";
  const hot = oneHot(chosen, vocab);
  const vecA = countVector(tokA, vocab);
  const vecB = countVector(tokB, vocab);
  const st = setStats(tokA, tokB);

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · 단어집합과 빈도 벡터</div>
      <p className="mb-3 text-sm text-muted">
        두 문장을 고쳐 써 보세요. 글을 단어로 쪼개 집합으로 만들고, 단어마다 번호를 붙여 벡터로 바꿔 줘요.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {([["문서 A", textA, setTextA], ["문서 B", textB, setTextB]] as const).map(([label, val, set]) => (
          <label key={label} className="block text-sm">
            <span className="mb-1 block font-bold">{label} <span className="font-normal text-muted">({val.length}/{MAX_LEN}자)</span></span>
            <textarea
              value={val}
              maxLength={MAX_LEN}
              rows={3}
              onChange={(e) => set(e.target.value)}
              className="min-h-[44px] w-full rounded-card border border-line bg-bg p-2 text-base text-ink"
            />
          </label>
        ))}
      </div>
      <p className="mt-2 rounded-card bg-bg p-2 text-xs text-muted">
        알림: 여기서는 공백으로 단어를 나누고 문장부호만 지우는 간단한 방식이에요. 그래서 &quot;고양이를&quot;과 &quot;고양이는&quot;처럼 조사가 붙은 말은 서로 다른 단어로 세요.
      </p>

      <h4 className="mt-4 mb-1 text-sm font-bold">1. 각 문서의 단어집합</h4>
      <div className="space-y-2 text-sm">
        <div><div className="mb-1 text-muted">A : 서로 다른 단어 {setA.length}개</div><Chips words={setA} /></div>
        <div><div className="mb-1 text-muted">B : 서로 다른 단어 {setB.length}개</div><Chips words={setB} /></div>
      </div>

      <h4 className="mt-4 mb-1 text-sm font-bold">2. 전체 단어장 (합집합, 처음 나온 순서)</h4>
      {vocab.length === 0 ? (
        <p className="text-sm text-muted">문장을 입력하면 단어장이 만들어져요.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {vocab.map((w, i) => (
            <span key={w} className="rounded border border-line bg-bg px-2 py-1 text-sm">
              <span className="text-muted">{i}</span> {w}
            </span>
          ))}
        </div>
      )}

      <h4 className="mt-4 mb-1 text-sm font-bold">3. 원-핫 벡터</h4>
      {vocab.length > 0 && (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            단어 고르기
            <select
              value={chosen}
              onChange={(e) => setPick(e.target.value)}
              className="min-h-[44px] rounded-card border border-line bg-bg px-2 text-base"
            >
              {vocab.map((w, i) => (
                <option key={w} value={w}>{i} · {w}</option>
              ))}
            </select>
          </label>
          <p className="mt-2 overflow-x-auto font-mono text-sm">
            &quot;{chosen}&quot; → [{hot.join(", ")}]
          </p>
          <p className="text-xs text-muted">고른 단어의 자리만 1이고 나머지는 모두 0이에요.</p>
        </>
      )}

      <h4 className="mt-4 mb-1 text-sm font-bold">4. 빈도 벡터 (단어가 몇 번 나왔는지)</h4>
      {vocab.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-center text-sm">
            <thead>
              <tr className="bg-bg">
                <th className="border border-line p-1.5 text-left">문서</th>
                {vocab.map((w, i) => (
                  <th key={w} className="border border-line p-1.5 font-normal"><span className="text-muted">{i}</span><br />{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([["A", vecA], ["B", vecB]] as const).map(([name, vec]) => (
                <tr key={name}>
                  <th className="border border-line p-1.5 text-left">{name}</th>
                  {vec.map((c, i) => (
                    <td key={i} className={"border border-line p-1.5 " + (c > 0 ? "bg-accent-soft font-bold text-accent" : "text-muted")}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 font-mono text-xs text-muted">A = [{vecA.join(", ")}] , B = [{vecB.join(", ")}]</p>
        </div>
      )}

      <h4 className="mt-4 mb-1 text-sm font-bold">5. 원소의 개수로 확인하기</h4>
      <div className="rounded-card bg-bg p-3 text-sm leading-7">
        <div>n(A) = {st.nA}, n(B) = {st.nB}, n(A∩B) = {st.nInter}, n(A∪B) = {st.nUnion}</div>
        <div>
          n(A) + n(B) − n(A∩B) = {st.nA} + {st.nB} − {st.nInter} = <b>{st.rhs}</b>
        </div>
        <div className={st.holds ? "font-bold text-ok" : "font-bold text-bad"}>
          {st.holds ? `n(A∪B) = ${st.nUnion} 와 같아요. 등식이 성립해요!` : "서로 달라요. (이런 일은 없어야 해요)"}
        </div>
      </div>
    </div>
  );
}
