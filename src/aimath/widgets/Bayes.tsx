import { useMemo, useState } from "react";
import RichMath, { MathLine } from "../RichMath";
import { iconGroups, posterior, probB, splitCounts, updateChain } from "./Bayes.logic";

interface Scenario {
  id: string;
  name: string;
  a: string; // A의 이름
  b: string; // B의 이름(관찰된 것)
  prior: number;
  hit: number;
  fa: number;
  story: string;
}

const SCENARIOS: Scenario[] = [
  { id: "spam", name: "스팸 메일 필터", a: "스팸 메일", b: "'무료' 단어 포함", prior: 20, hit: 80, fa: 10,
    story: "받은 메일 중 20%가 스팸이에요. 스팸의 80%에는 '무료'라는 단어가 있고, 정상 메일에도 10%는 '무료'가 들어 있어요. '무료'가 든 메일이 왔다면 스팸일 확률은?" },
  { id: "disease", name: "질병 검사", a: "병에 걸림", b: "검사 양성", prior: 1, hit: 90, fa: 9,
    story: "어떤 병에 걸린 사람은 전체의 1%예요. 병이 있으면 검사가 90% 양성으로 나오고, 병이 없어도 9%는 양성으로 나와요. 양성이 나왔다면 정말 병에 걸렸을 확률은?" },
];

const COLORS = ["var(--accent)", "#8fb7e8", "#e08a2e", "#cfd6de"];
const NAMES = ["A이고 B", "A이고 B 아님", "A 아니고 B", "A도 B도 아님"];

const f3 = (x: number) => (Math.round(x * 1000) / 1000).toString();
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toString()}%`;

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-sm text-ink">
        <span>{label}</span>
        <span className="font-bold text-accent">{value}%</span>
      </span>
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full" style={{ accentColor: "var(--accent)" }} />
    </label>
  );
}

export default function Bayes() {
  const [sid, setSid] = useState("spam");
  const sc = SCENARIOS.find((s) => s.id === sid)!;
  const [prior, setPrior] = useState(SCENARIOS[0].prior);
  const [hit, setHit] = useState(SCENARIOS[0].hit);
  const [fa, setFa] = useState(SCENARIOS[0].fa);
  const [mode, setMode] = useState<"once" | "update">("once");
  const [k, setK] = useState(0); // B가 추가로 나온 횟수

  const pick = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)!;
    setSid(id); setPrior(s.prior); setHit(s.hit); setFa(s.fa); setK(0);
  };
  const edit = (set: (v: number) => void) => (v: number) => { set(v); setK(0); };

  const p0 = prior / 100, t = hit / 100, f = fa / 100;
  const chain = useMemo(() => updateChain(p0, t, f, k), [p0, t, f, k]);
  const p = chain[k]; // 지금 쓰는 사전확률
  const post = posterior(p, t, f);
  const pB = probB(p, t, f);
  const counts = useMemo(() => splitCounts(p, t, f), [p, t, f]);
  const icons = useMemo(() => iconGroups(counts), [counts]);
  const cB = counts.ab + counts.nab;

  const COLS = 50;
  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="베이즈 체험 도구">
      <h3 className="text-base font-bold text-ink">체험 도구 · 베이즈로 확률 고치기</h3>
      <p className="mt-1 text-sm text-muted">슬라이더를 움직이면 1000명의 색깔이 바뀌어요. 'B가 나왔을 때 A일 확률'이 처음 확률과 얼마나 다른지 비교해 보세요.</p>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="이야기 고르기">
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" onClick={() => pick(s.id)} aria-pressed={sid === s.id}
            className={`min-h-11 rounded-card border px-4 text-sm font-bold ${sid === s.id ? "border-transparent bg-accent text-accent-ink" : "border-line bg-bg text-ink"}`}>{s.name}</button>
        ))}
      </div>
      <p className="mt-2 rounded-card bg-accent-soft p-3 text-sm text-ink">{sc.story}</p>

      <div className="mt-3 grid gap-1 sm:grid-cols-3 sm:gap-4">
        <Slider label={`P(A): ${sc.a} 비율`} value={prior} min={0.5} max={99.5} step={0.5} onChange={edit(setPrior)} />
        <Slider label={`P(B|A): ${sc.a}일 때 B`} value={hit} min={0} max={100} step={1} onChange={edit(setHit)} />
        <Slider label="P(B|¬A): 아닐 때도 B" value={fa} min={0} max={100} step={1} onChange={edit(setFa)} />
      </div>
      <p className="text-xs text-muted">A = {sc.a}, B = {sc.b}</p>

      <div className="mt-3 flex gap-2" role="group" aria-label="모드">
        {([["once", "한 번 계산"], ["update", "계속 업데이트"]] as const).map(([m, label]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); setK(0); }}
            className={`min-h-11 flex-1 rounded-card border px-3 text-sm font-bold ${mode === m ? "border-transparent bg-accent text-accent-ink" : "border-line bg-bg text-ink"}`}>{label}</button>
        ))}
      </div>

      {/* 1000명 아이콘 */}
      <div className="mt-4">
        <p className="text-sm font-bold text-ink">1000명으로 보기 {mode === "update" && k > 0 ? <span className="font-normal text-muted">(A 비율 {pct(p)}로 다시 만든 1000명)</span> : null}</p>
        <svg viewBox="0 0 500 200" role="img" aria-label={`1000명 중 A이고 B ${counts.ab}명, A이고 B 아님 ${counts.anb}명, A 아니고 B ${counts.nab}명, 둘 다 아님 ${counts.nanb}명`} className="mt-1 w-full rounded-card bg-bg">
          {icons.map((g, i) => (
            <circle key={i} cx={5 + (i % COLS) * 10} cy={5 + Math.floor(i / COLS) * 10} r={3.6} fill={COLORS[g]} />
          ))}
        </svg>
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink">
          {NAMES.map((n, i) => (
            <li key={n} className="flex items-center gap-1.5"><span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i] }} />{n}</li>
          ))}
        </ul>
      </div>

      {/* 2x2 표 */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-center text-sm">
          <caption className="sr-only">1000명을 A와 B로 나눈 표</caption>
          <thead>
            <tr className="text-muted"><th className="p-2" /><th className="p-2">B</th><th className="p-2">B 아님</th><th className="p-2">합계</th></tr>
          </thead>
          <tbody>
            <tr><th className="border border-line p-2 text-left text-muted">A</th><td className="border border-line p-2 font-bold text-accent">{counts.ab}</td><td className="border border-line p-2">{counts.anb}</td><td className="border border-line bg-bg p-2">{counts.ab + counts.anb}</td></tr>
            <tr><th className="border border-line p-2 text-left text-muted">A 아님</th><td className="border border-line p-2 font-bold" style={{ color: "#b45f12" }}>{counts.nab}</td><td className="border border-line p-2">{counts.nanb}</td><td className="border border-line bg-bg p-2">{counts.nab + counts.nanb}</td></tr>
            <tr><th className="border border-line bg-bg p-2 text-left text-muted">합계</th><td className="border border-line bg-bg p-2">{cB}</td><td className="border border-line bg-bg p-2">{1000 - cB}</td><td className="border border-line bg-bg p-2">1000</td></tr>
          </tbody>
        </table>
        <p className="mt-1 text-xs text-muted">(사람 수는 반올림해서 합이 1000이 되게 맞췄어요.)</p>
      </div>

      {/* 나무그림 */}
      <div className="mt-4">
        <p className="text-sm font-bold text-ink">나무그림 (곱셈으로 이어가기)</p>
        <svg viewBox="0 0 360 210" role="img" aria-label="확률 나무그림" className="mt-1 w-full rounded-card bg-bg text-ink" fontSize="11">
          <g stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.55">
            <path d="M40 105 L120 55" /><path d="M40 105 L120 155" />
            <path d="M150 55 L225 30" /><path d="M150 55 L225 80" /><path d="M150 155 L225 130" /><path d="M150 155 L225 180" />
          </g>
          <g fill="currentColor">
            <text x="6" y="109">전체</text>
            <text x="30" y="68">P(A)={f3(p)}</text>
            <text x="30" y="156" dy="14">P(¬A)={f3(1 - p)}</text>
            <text x="122" y="59">A</text>
            <text x="122" y="159">¬A</text>
            <text x="165" y="34" fontSize="10">{f3(t)}</text>
            <text x="165" y="86" fontSize="10" dy="6">{f3(1 - t)}</text>
            <text x="165" y="136" fontSize="10">{f3(f)}</text>
            <text x="165" y="190" fontSize="10" dy="6">{f3(1 - f)}</text>
            {[
              [30, "A∩B", p * t],
              [80, "A∩¬B", p * (1 - t)],
              [130, "¬A∩B", (1 - p) * f],
              [180, "¬A∩¬B", (1 - p) * (1 - f)],
            ].map(([y, nm, v], i) => (
              <g key={i}>
                <text x="228" y={(y as number) + 4} fontWeight={i === 0 || i === 2 ? "bold" : "normal"}>{nm as string}</text>
                <text x="282" y={(y as number) + 4} fontWeight={i === 0 || i === 2 ? "bold" : "normal"}>{f3(v as number)}</text>
              </g>
            ))}
          </g>
        </svg>
        <p className="mt-1 text-xs text-muted">가지 위 숫자는 조건부확률이고, 오른쪽 끝 숫자는 가지를 따라 곱한 값이에요. B가 나온 경우(굵은 글씨) 두 개를 합치면 P(B)={f3(pB)}예요.</p>
      </div>

      {/* 사후확률 */}
      <div className="mt-4 rounded-card border border-line bg-bg p-3">
        <p className="text-sm font-bold text-ink">B가 나왔을 때 A일 확률 P(A|B)</p>
        {post === null ? (
          <p className="mt-2 text-sm text-bad">B가 나올 확률이 0이라서 계산할 수 없어요. P(B|A)나 P(B|¬A)를 0보다 크게 해 보세요.</p>
        ) : (
          <>
            <MathLine tex={"P(A|B)=\\frac{P(A)P(B|A)}{P(A)P(B|A)+P(\\neg A)P(B|\\neg A)}"} />
            <MathLine tex={`=\\frac{${f3(p)}\\times ${f3(t)}}{${f3(p)}\\times ${f3(t)}+${f3(1 - p)}\\times ${f3(f)}}=\\frac{${f3(p * t)}}{${f3(pB)}}\\approx ${f3(post)}`} />
            <p className="text-sm text-ink">
              <RichMath text={`1000명 중 B인 사람은 ${cB}명이고 그중 A는 ${counts.ab}명이니까 $\\frac{${counts.ab}}{${cB}}$ 로 어림해도 같아요.`} />
            </p>
            <p className="mt-2 rounded-card bg-accent-soft p-3 text-sm text-ink">
              <RichMath text={`처음엔 A가 **${pct(p)}** 였는데, B를 확인하고 나니 **${pct(post)}** 로 바뀌었어요.`} />
              {post < 0.5 && p < 0.5 ? " 그래도 A가 아닐 가능성이 더 커요. 처음에 A가 드물었기 때문이에요." : ""}
            </p>
          </>
        )}
      </div>

      {/* 계속 업데이트 */}
      {mode === "update" && (
        <div className="mt-4 rounded-card border border-line p-3">
          <p className="text-sm text-ink">B가 또 나오면, 방금 구한 확률(사후확률)이 <b>다음 계산의 사전확률</b>이 돼요.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" disabled={post === null || k >= 12} onClick={() => setK(k + 1)} className="min-h-11 rounded-card bg-accent px-4 text-sm font-bold text-accent-ink disabled:opacity-40">B가 또 나왔어요</button>
            <button type="button" onClick={() => setK(0)} className="min-h-11 rounded-card border border-line bg-bg px-4 text-sm text-ink">처음으로</button>
          </div>
          <ol className="mt-3 space-y-2">
            {chain.map((v, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-muted">{i === 0 ? "처음 P(A)" : `${i}번째 B 뒤`}</span>
                <span className="relative h-5 flex-1 rounded bg-bg" role="img" aria-label={pct(v)}>
                  <span className="absolute inset-y-0 left-0 rounded bg-accent" style={{ width: `${v * 100}%` }} />
                </span>
                <span className="w-14 shrink-0 text-right font-bold text-ink">{pct(v)}</span>
              </li>
            ))}
          </ol>
          {k >= 12 && <p className="mt-2 text-xs text-muted">12번까지 해 봤어요. 처음으로 돌아가 다른 값도 해 보세요.</p>}
        </div>
      )}
    </section>
  );
}
