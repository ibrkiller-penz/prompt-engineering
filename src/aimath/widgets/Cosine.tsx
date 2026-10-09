import { useState } from "react";
import RichMath from "../RichMath";
import { buildVocab, cosine, countVector, tokenize } from "./Cosine.logic";
import type { CosResult } from "./Cosine.logic";

const MAX_LEN = 150;
const PRESETS = [
  { name: "비슷한 문장", a: "나는 강아지를 좋아해요", b: "나는 고양이를 좋아해요" },
  { name: "전혀 다른 문장", a: "나는 강아지를 좋아해요", b: "내일 수학 시험이 있어요" },
  { name: "같은 문장", a: "나는 강아지를 좋아해요", b: "나는 강아지를 좋아해요" },
];

const r4 = (x: number) => String(Math.round(x * 10000) / 10000);
const vec = (v: number[]) => "(" + v.join(", ") + ")";

function Steps({ a, b, res }: { a: number[]; b: number[]; res: CosResult }) {
  if (a.length === 0) return <p className="text-sm text-muted">단어를 입력해 주세요.</p>;
  const prod = a.map((x, i) => `${x}×${b[i]}`).join(" + ");
  const sqA = a.map((x) => `${x}²`).join(" + ");
  const sqB = b.map((x) => `${x}²`).join(" + ");
  return (
    <div className="space-y-1 rounded-card bg-bg p-3 text-sm leading-7">
      <div className="overflow-x-auto whitespace-nowrap">A = {vec(a)}, B = {vec(b)}</div>
      <div className="overflow-x-auto whitespace-nowrap">A·B = {prod} = <b>{res.dot}</b></div>
      <div className="overflow-x-auto whitespace-nowrap">|A| = √({sqA}) = √{res.normSqA} ≈ <b>{r4(res.normA)}</b></div>
      <div className="overflow-x-auto whitespace-nowrap">|B| = √({sqB}) = √{res.normSqB} ≈ <b>{r4(res.normB)}</b></div>
      {res.cos === null ? (
        <div className="rounded-card bg-bad-soft p-2 text-bad">
          한쪽이 영벡터(모든 성분이 0)예요. 길이가 0이면 0으로 나누게 되어서 코사인 유사도를 정할 수 없어요.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto whitespace-nowrap">
            cos θ = A·B / (|A||B|) = {res.dot} / ({r4(res.normA)} × {r4(res.normB)}) ≈ <b className="text-accent">{r4(res.cos)}</b>
          </div>
          <div>각도 θ ≈ <b>{r4(res.angleDeg ?? 0)}°</b></div>
          <div className="text-muted">
            {res.cos > 0.999 ? "방향이 거의 같아요. 아주 비슷해요!" : res.cos < 0.001 ? "서로 수직이에요. 겹치는 단어가 없어요." : res.cos >= 0.5 ? "꽤 비슷한 방향이에요." : "조금만 비슷해요."}
          </div>
        </>
      )}
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      aria-label={label}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className="min-h-[44px] w-full min-w-0 rounded-card border border-line bg-bg px-2 text-center text-base text-ink"
    />
  );
}

export default function Cosine() {
  const [sa, setSa] = useState(PRESETS[0].a);
  const [sb, setSb] = useState(PRESETS[0].b);
  const [dim, setDim] = useState(2);
  const [va, setVa] = useState([3, 4, 0, 0]);
  const [vb, setVb] = useState([4, 3, 0, 0]);

  const ta = tokenize(sa);
  const tb = tokenize(sb);
  const vocab = buildVocab(ta, tb);
  const ca = countVector(ta, vocab);
  const cb = countVector(tb, vocab);
  const resText = cosine(ca, cb);

  const na = va.slice(0, dim);
  const nb = vb.slice(0, dim);
  const resNum = cosine(na, nb);

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · 문장 유사도(코사인)</div>
      <p className="mb-3 text-sm text-muted">
        두 문장을 단어 개수 벡터로 바꾼 뒤, 두 벡터가 이루는 각의 코사인으로 얼마나 비슷한지 재어 봐요. (공백으로 단어를 나누고 조사는 그대로 둬요.)
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => { setSa(p.a); setSb(p.b); }}
            className="min-h-[44px] rounded-card border border-line bg-bg px-3 text-sm text-ink"
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {([["문장 A", sa, setSa], ["문장 B", sb, setSb]] as const).map(([label, val, set]) => (
          <label key={label} className="block text-sm">
            <span className="mb-1 block font-bold">{label} <span className="font-normal text-muted">({val.length}/{MAX_LEN}자)</span></span>
            <textarea value={val} maxLength={MAX_LEN} rows={2} onChange={(e) => set(e.target.value)} className="min-h-[44px] w-full rounded-card border border-line bg-bg p-2 text-base text-ink" />
          </label>
        ))}
      </div>

      <h4 className="mt-4 mb-1 text-sm font-bold">1. 단어 개수 벡터</h4>
      {vocab.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[300px] border-collapse text-center text-sm">
            <thead>
              <tr className="bg-bg">
                <th className="border border-line p-1.5" />
                {vocab.map((w) => <th key={w} className="border border-line p-1.5 font-normal">{w}</th>)}
              </tr>
            </thead>
            <tbody>
              {([["A", ca], ["B", cb]] as const).map(([n, v]) => (
                <tr key={n}>
                  <th className="border border-line p-1.5">{n}</th>
                  {v.map((c, i) => <td key={i} className={"border border-line p-1.5 " + (c > 0 ? "bg-accent-soft font-bold text-accent" : "text-muted")}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 className="mt-4 mb-1 text-sm font-bold">2. 계산 과정</h4>
      <div className="mb-1 text-sm"><RichMath text={"$\\cos\\theta=\\dfrac{A\\cdot B}{|A||B|}$"} /></div>
      <Steps a={ca} b={cb} res={resText} />

      <h4 className="mt-5 mb-1 text-sm font-bold">3. 숫자로 직접 벡터 넣어 보기</h4>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span>차원</span>
        {[2, 3, 4].map((d) => (
          <button key={d} type="button" aria-pressed={dim === d} onClick={() => setDim(d)} className={"min-h-[44px] min-w-[44px] rounded-card border px-3 " + (dim === d ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}>
            {d}
          </button>
        ))}
      </div>
      {([["A", va, setVa], ["B", vb, setVb]] as const).map(([n, v, set]) => (
        <div key={n} className="mb-2 flex items-center gap-2 text-sm">
          <span className="w-5 font-bold">{n}</span>
          <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${dim}, minmax(0, 1fr))` }}>
            {Array.from({ length: dim }, (_, i) => (
              <NumInput key={i} label={`벡터 ${n}의 ${i + 1}번째 성분`} value={v[i]} onChange={(x) => set(v.map((o, j) => (j === i ? x : o)))} />
            ))}
          </div>
        </div>
      ))}
      <Steps a={na} b={nb} res={resNum} />
    </div>
  );
}
