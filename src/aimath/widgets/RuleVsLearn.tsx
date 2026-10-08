import { useEffect, useMemo, useState } from "react";
import {
  INIT_MODEL, accuracy, boundarySegment, makeData, modelPredict, rulePredict, trainEpoch,
} from "./RuleVsLearn.logic";
import type { Model, Pt, Rule } from "./RuleVsLearn.logic";

const btn = "min-h-[44px] rounded-card px-4 py-2 font-semibold";
const S = 150;
const pad = 14;
const sx = (v: number) => pad + (v / 10) * (S - 2 * pad);
const sy = (v: number) => S - pad - (v / 10) * (S - 2 * pad);

function Scatter({ data, line, rule }: { data: Pt[]; line?: Model; rule?: Rule }) {
  const seg = line ? boundarySegment(line) : null;
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[300px]" role="img" aria-label="메시지 산점도">
      <rect x={pad} y={pad} width={S - 2 * pad} height={S - 2 * pad} fill="none" stroke="currentColor" className="text-line" />
      {rule && (
        <>
          <line x1={sx(rule.t1)} x2={sx(rule.t1)} y1={pad} y2={S - pad} stroke="currentColor" className="text-accent" strokeDasharray="3 3" />
          <line x1={pad} x2={S - pad} y1={sy(rule.t2)} y2={sy(rule.t2)} stroke="currentColor" className="text-accent" strokeDasharray="3 3" />
        </>
      )}
      {seg && <line x1={sx(seg[0].x)} y1={sy(seg[0].y)} x2={sx(seg[1].x)} y2={sy(seg[1].y)} stroke="currentColor" className="text-accent" strokeWidth={2} />}
      {data.map((p, i) =>
        p.label === 1 ? (
          <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={3.5} fill="currentColor" className="text-bad" />
        ) : (
          <rect key={i} x={sx(p.x) - 3} y={sy(p.y) - 3} width={6} height={6} fill="currentColor" className="text-ok" />
        ),
      )}
      <text x={S / 2} y={S - 2} textAnchor="middle" fontSize={7} fill="currentColor" className="text-muted">느낌표 수 →</text>
      <text x={6} y={S / 2} fontSize={7} fill="currentColor" className="text-muted" transform={`rotate(-90 6 ${S / 2})`} textAnchor="middle">광고 단어 수 →</text>
    </svg>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function RuleVsLearn() {
  const train = useMemo(() => makeData(20, 7), []);
  const [rule, setRule] = useState<Rule>({ t1: 5, t2: 5, op: "AND" });
  const [model, setModel] = useState<Model>(INIT_MODEL);
  const [epoch, setEpoch] = useState(0);
  const [auto, setAuto] = useState(false);
  const [round, setRound] = useState(0); // 새 데이터 횟수
  const [fresh, setFresh] = useState<Pt[]>([]);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    if (!auto) return;
    if (epoch >= 30) { setAuto(false); return; }
    const t = setTimeout(() => step(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, epoch]);

  function step() {
    setModel((m) => trainEpoch(m, train, epoch));
    setEpoch((e) => e + 1);
  }
  function resetModel() {
    setAuto(false); setModel(INIT_MODEL); setEpoch(0);
  }
  function newData() {
    setFresh(makeData(20, 1000 + round));
    setRound((r) => r + 1);
  }

  const rp = (p: Pt) => rulePredict(rule, p);
  const mp = (p: Pt) => modelPredict(model, p);
  const trained = epoch > 0;
  const ruleTrain = accuracy(rp, train);
  const modelTrain = accuracy(mp, train);
  const hasFresh = fresh.length > 0;
  const ruleFresh = hasFresh ? accuracy(rp, fresh) : 0;
  const modelFresh = hasFresh ? accuracy(mp, fresh) : 0;

  let verdict = "규칙을 만들어 보고, 오른쪽 AI도 학습시켜 보세요.";
  if (hasFresh && trained) {
    const dr = ruleTrain - ruleFresh, dm = modelTrain - modelFresh;
    if (modelFresh > ruleFresh) verdict = "처음 보는 데이터에서는 학습한 AI가 더 잘 맞혔어요. 데이터의 패턴(대각선 경계)을 스스로 찾았기 때문이에요.";
    else if (modelFresh < ruleFresh) verdict = "이번엔 규칙이 더 잘 맞혔어요. 하지만 AI는 데이터를 더 학습할수록 좋아져요. 규칙은 사람이 직접 고쳐야 해요.";
    else verdict = "이번엔 비슷해요. 새 데이터를 여러 번 받아 보세요.";
    if (dr > 0.1 && dr > dm) verdict += " 규칙은 처음 데이터에만 맞춰 둔 탓에 새 데이터에서 점수가 떨어졌어요.";
  } else if (trained) verdict = "AI가 데이터를 보고 스스로 경계선을 찾고 있어요. '새 데이터'로 실력을 확인해 보세요.";

  return (
    <section className="rounded-card border border-line bg-surface p-4" aria-label="규칙 기반 대 학습 기반">
      <h3 className="font-bold text-ink">체험 도구 · 규칙 기반 vs 학습 기반</h3>
      <p className="mt-1 text-sm text-muted">문자 메시지가 스팸(빨간 동그라미)인지 정상(초록 네모)인지 가려내요. 왼쪽은 내가 규칙을 직접 짜고, 오른쪽은 AI가 데이터로 배워요.</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-card border border-line bg-bg p-3">
          <h4 className="font-bold text-ink">규칙 기반 (내가 규칙 작성)</h4>
          <p className="mt-1 text-sm text-ink">
            IF 느낌표 ≥ <b>{rule.t1}</b> <b className="text-accent">{rule.op}</b> 광고 단어 ≥ <b>{rule.t2}</b> THEN 스팸
          </p>
          <label className="mt-2 block text-sm text-ink">느낌표 기준 {rule.t1}
            <input type="range" min={0} max={10} step={1} value={rule.t1} onChange={(e) => setRule({ ...rule, t1: Number(e.target.value) })} className="block h-11 w-full" />
          </label>
          <label className="block text-sm text-ink">광고 단어 기준 {rule.t2}
            <input type="range" min={0} max={10} step={1} value={rule.t2} onChange={(e) => setRule({ ...rule, t2: Number(e.target.value) })} className="block h-11 w-full" />
          </label>
          <div className="mt-1 flex gap-2" role="group" aria-label="조건 연결">
            {(["AND", "OR"] as const).map((o) => (
              <button key={o} type="button" aria-pressed={rule.op === o} onClick={() => setRule({ ...rule, op: o })}
                className={`${btn} ${rule.op === o ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"}`}>{o === "AND" ? "그리고(AND)" : "또는(OR)"}</button>
            ))}
          </div>
          <Scatter data={hasFresh ? [...train, ...fresh] : train} rule={rule} />
          <p className="text-sm text-ink">처음 데이터 정확도 <b>{pct(ruleTrain)}</b>{hasFresh && <> · 새 데이터 <b className={ruleFresh < ruleTrain ? "text-bad" : "text-ok"}>{pct(ruleFresh)}</b></>}</p>
        </div>

        <div className="rounded-card border border-line bg-bg p-3">
          <h4 className="font-bold text-ink">학습 기반 (AI가 데이터로 학습)</h4>
          <p className="mt-1 text-sm text-ink">epoch(데이터 한 바퀴) <b>{epoch}</b> / 30</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={step} disabled={epoch >= 30 || auto} className={`${btn} bg-accent text-accent-ink disabled:opacity-50`}>AI에게 학습시키기 (+1 epoch)</button>
            <button type="button" onClick={() => setAuto((a) => !a)} disabled={epoch >= 30} className={`${btn} bg-accent-soft text-accent disabled:opacity-50`}>{auto ? "멈춤" : "자동 재생"}</button>
            <button type="button" onClick={resetModel} className={`${btn} bg-surface text-ink border border-line`}>처음으로</button>
          </div>
          <Scatter data={hasFresh ? [...train, ...fresh] : train} line={trained ? model : undefined} />
          <p className="text-sm text-ink">처음 데이터 정확도 <b>{pct(modelTrain)}</b>{hasFresh && <> · 새 데이터 <b className={modelFresh < modelTrain ? "text-bad" : "text-ok"}>{pct(modelFresh)}</b></>}</p>
          <p className="text-xs text-muted">직선 = AI가 찾은 경계. 틀린 점이 있을 때마다 경계를 조금씩 고쳐요(퍼셉트론).</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={newData} className={`${btn} bg-accent text-accent-ink`}>새 데이터 20개 받기</button>
        <button type="button" onClick={() => setShowTable((s) => !s)} className={`${btn} bg-accent-soft text-accent`}>{showTable ? "표 닫기" : "데이터 표 보기"}</button>
      </div>
      <p className="mt-3 rounded-card bg-accent-soft p-3 text-sm text-accent" aria-live="polite">{verdict}</p>

      {showTable && (
        <div className="mt-3 max-h-56 overflow-auto rounded-card border border-line">
          <table className="w-full text-center text-sm text-ink">
            <thead className="bg-bg text-muted"><tr><th>느낌표</th><th>광고</th><th>정답</th><th>내 규칙</th><th>AI</th></tr></thead>
            <tbody>
              {train.map((p, i) => (
                <tr key={i} className="border-t border-line">
                  <td>{p.x}</td><td>{p.y}</td><td>{p.label ? "스팸" : "정상"}</td>
                  <td className={rp(p) === p.label ? "text-ok" : "text-bad"}>{rp(p) ? "스팸" : "정상"}</td>
                  <td className={!trained ? "text-muted" : mp(p) === p.label ? "text-ok" : "text-bad"}>{trained ? (mp(p) ? "스팸" : "정상") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
