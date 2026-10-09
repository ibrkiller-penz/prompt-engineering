import { useState } from "react";
import { highlight, matchReview, totalScore, verdict } from "./Sentiment.logic";
import type { DictEntry, Segment } from "./Sentiment.logic";

const DEFAULT_DICT: DictEntry[] = [
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

function Marked({ segs }: { segs: Segment[] }) {
  return (
    <p className="rounded-card bg-bg p-3 text-base leading-8 break-words">
      {segs.map((s, i) =>
        s.score === null ? (
          <span key={i}>{s.text}</span>
        ) : s.score > 0 ? (
          <mark key={i} className="rounded bg-ok-soft px-0.5 font-bold text-ok">{s.text}</mark>
        ) : s.score < 0 ? (
          <mark key={i} className="rounded bg-bad-soft px-0.5 font-bold text-bad">{s.text}</mark>
        ) : (
          <mark key={i} className="rounded bg-line px-0.5 text-ink">{s.text}</mark>
        ),
      )}
    </p>
  );
}

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

function VerdictBadge({ total, threshold }: { total: number; threshold: number }) {
  const v = verdict(total, threshold);
  const cls = v === "긍정" ? "bg-ok-soft text-ok" : v === "부정" ? "bg-bad-soft text-bad" : "bg-bg text-ink border border-line";
  return <span className={"rounded-full px-3 py-1 font-bold " + cls}>{v}</span>;
}

export default function Sentiment() {
  const [dict, setDict] = useState<DictEntry[]>(DEFAULT_DICT);
  const [review, setReview] = useState(REVIEWS[0].text);
  const [threshold, setThreshold] = useState(1);
  const [tricky, setTricky] = useState(TRICKY[0]);
  const [nw, setNw] = useState("");
  const [ns, setNs] = useState(1);

  const matches = matchReview(review, dict);
  const total = totalScore(matches);
  const tm = matchReview(tricky, dict);
  const tt = totalScore(tm);

  const addWord = () => {
    const w = nw.trim();
    if (!w) return;
    setDict([...dict.filter((d) => d.word !== w), { word: w, score: ns }]);
    setNw("");
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · 감성 사전 점수 계산기</div>
      <p className="mb-3 text-sm text-muted">
        단어마다 점수를 적은 &quot;감성 사전&quot;으로 후기를 채점해요. 어절 안에 사전 단어가 들어 있으면 그 점수를 더해요. (예: &quot;맛있어요&quot;에는 &quot;맛있&quot;이 들어 있어요.)
      </p>

      <h4 className="mb-1 text-sm font-bold">1. 감성 사전 (−2 ~ +2)</h4>
      <ul className="mb-2 space-y-1.5">
        {dict.map((d, i) => (
          <li key={d.word + i} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate rounded bg-bg px-2 py-2.5">{d.word}</span>
            <input
              type="number"
              min={-2}
              max={2}
              step={1}
              aria-label={`${d.word} 점수`}
              value={d.score}
              onChange={(e) => {
                const n = Math.max(-2, Math.min(2, Math.round(Number(e.target.value) || 0)));
                setDict(dict.map((x, j) => (j === i ? { ...x, score: n } : x)));
              }}
              className="min-h-[44px] w-20 rounded-card border border-line bg-bg px-2 text-center text-base text-ink"
            />
            <button type="button" aria-label={`${d.word} 지우기`} onClick={() => setDict(dict.filter((_, j) => j !== i))} className="min-h-[44px] min-w-[44px] rounded-card border border-line bg-bg text-muted">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input aria-label="새 단어" placeholder="새 단어" value={nw} maxLength={10} onChange={(e) => setNw(e.target.value)} className="min-h-[44px] min-w-0 flex-1 rounded-card border border-line bg-bg px-2 text-base text-ink" />
        <input type="number" min={-2} max={2} step={1} aria-label="새 단어 점수" value={ns} onChange={(e) => setNs(Math.max(-2, Math.min(2, Math.round(Number(e.target.value) || 0))))} className="min-h-[44px] w-20 rounded-card border border-line bg-bg px-2 text-center text-base text-ink" />
        <button type="button" onClick={addWord} className="min-h-[44px] rounded-card bg-accent px-4 text-accent-ink">추가</button>
      </div>

      <h4 className="mt-4 mb-1 text-sm font-bold">2. 후기 쓰고 채점하기</h4>
      <div className="mb-2 flex flex-wrap gap-2">
        {REVIEWS.map((r) => (
          <button key={r.name} type="button" onClick={() => setReview(r.text)} className="min-h-[44px] rounded-card border border-line bg-bg px-3 text-sm text-ink">{r.name}</button>
        ))}
      </div>
      <label className="block text-sm">
        <span className="sr-only">후기 글</span>
        <textarea value={review} maxLength={200} rows={2} onChange={(e) => setReview(e.target.value)} className="min-h-[44px] w-full rounded-card border border-line bg-bg p-2 text-base text-ink" />
      </label>
      <div className="mt-2"><Marked segs={highlight(review, dict)} /></div>

      {matches.length === 0 ? (
        <p className="mt-2 text-sm text-muted">사전에 있는 단어가 하나도 없어서 합계가 0이에요.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[260px] border-collapse text-center text-sm">
            <thead>
              <tr className="bg-bg"><th className="border border-line p-1.5">후기 속 말</th><th className="border border-line p-1.5">걸린 사전 단어</th><th className="border border-line p-1.5">점수</th></tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={i}>
                  <td className="border border-line p-1.5">{m.token}</td>
                  <td className="border border-line p-1.5">{m.word}</td>
                  <td className={"border border-line p-1.5 font-bold " + (m.score > 0 ? "text-ok" : m.score < 0 ? "text-bad" : "")}>{sign(m.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span>합계 = {matches.length > 0 ? matches.map((m) => sign(m.score)).join(" ") + " = " : ""}<b>{total}</b></span>
        <VerdictBadge total={total} threshold={threshold} />
      </div>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        기준값(문턱)
        <input type="number" min={1} max={5} step={1} value={threshold} onChange={(e) => setThreshold(Math.max(1, Math.min(5, Math.round(Number(e.target.value) || 1))))} className="min-h-[44px] w-20 rounded-card border border-line bg-bg px-2 text-center text-base text-ink" />
        <span className="text-muted">합계가 +{threshold} 이상이면 긍정, −{threshold} 이하면 부정, 그 사이는 중립</span>
      </label>

      <div className="mt-5 rounded-card border border-line bg-bg p-3">
        <h4 className="mb-1 text-sm font-bold text-bad">한계: 부정(否定)하는 말은 어떨까?</h4>
        <p className="mb-2 text-sm text-muted">사전 방식은 단어만 보고 문장의 뜻은 보지 않아요. 아래 문장을 채점해 보세요.</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {TRICKY.map((t) => (
            <button key={t} type="button" onClick={() => setTricky(t)} className="min-h-[44px] rounded-card border border-line bg-surface px-3 text-sm text-ink">{t}</button>
          ))}
        </div>
        <label className="block text-sm">
          <span className="sr-only">직접 써 보는 문장</span>
          <input value={tricky} maxLength={80} onChange={(e) => setTricky(e.target.value)} className="min-h-[44px] w-full rounded-card border border-line bg-surface px-2 text-base text-ink" />
        </label>
        <div className="mt-2"><Marked segs={highlight(tricky, dict)} /></div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span>합계 <b>{tt}</b></span>
          <VerdictBadge total={tt} threshold={threshold} />
        </div>
        <p className="mt-2 text-sm">
          &quot;재미없지 않다&quot;는 사람에게는 &quot;꽤 재미있다&quot;에 가까운 말이지만, 컴퓨터는 &quot;재미없&quot;이라는 글자만 보고 −2점을 줘요. &quot;않다&quot;가 뒤집는 뜻은 점수에 반영되지 않기 때문이에요. 그래서 문맥을 읽는 방법이 더 필요해요.
        </p>
      </div>
    </div>
  );
}
