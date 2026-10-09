import { useState } from "react";
import { PAIRS, PRACTICES, combine, evalRow, fmt, gradeCells, practiceAnswers, truthRows } from "./Truth.logic";
import type { Cell, Notation } from "./Truth.logic";

function ValueCell({ v, mode, strong }: { v: boolean; mode: Notation; strong?: boolean }) {
  return (
    <span className={"font-bold " + (v ? "text-ok" : "text-bad") + (strong ? " text-base" : "")}>{fmt(v, mode)}</span>
  );
}

function Toggle({ label, value, mode, onChange }: { label: string; value: boolean; mode: Notation; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-6 font-bold">{label}</span>
      {[true, false].map((b) => (
        <button
          key={String(b)}
          type="button"
          aria-pressed={value === b}
          aria-label={`${label}를 ${b ? "참" : "거짓"}(${fmt(b, mode)})으로`}
          onClick={() => onChange(b)}
          className={"min-h-[44px] min-w-[56px] rounded-card border px-3 font-bold " + (value === b ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
        >
          {fmt(b, mode)}
        </button>
      ))}
    </div>
  );
}

export default function Truth() {
  const [mode, setMode] = useState<Notation>("TF");
  const [p, setP] = useState(true);
  const [q, setQ] = useState(false);
  const [pairIdx, setPairIdx] = useState(0);
  const [pracIdx, setPracIdx] = useState(0);
  const [answers, setAnswers] = useState<Cell[]>([null, null, null, null]);
  const [checked, setChecked] = useState(false);
  const [showAns, setShowAns] = useState(false);

  const cur = evalRow(p, q);
  const rows = truthRows();
  const pair = PAIRS[pairIdx];
  const combos = combine(pair);
  const correct = practiceAnswers(pracIdx);
  const grades = gradeCells(pracIdx, answers);
  const allFilled = answers.every((a) => a !== null);
  const score = grades.filter((g) => g === true).length;

  const pickPractice = (i: number) => {
    setPracIdx(i);
    setAnswers([null, null, null, null]);
    setChecked(false);
    setShowAns(false);
  };
  const setAnswer = (i: number, v: boolean) => {
    setAnswers(answers.map((a, j) => (j === i ? v : a)));
    setChecked(false);
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4 text-ink">
      <div className="mb-1 text-sm font-bold text-accent">체험 도구 · 진리표</div>
      <p className="mb-3 text-sm text-muted">
        참인지 거짓인지 분명하게 가릴 수 있는 문장을 <b>명제</b>라고 하고, 참(T) 또는 거짓(F)을 그 명제의 <b>진릿값</b>이라고 해요.
        명제 p, q를 <b>논리 연산자</b>(NOT·AND·OR·XOR)로 이으면 새 명제가 되고, 모든 경우의 진릿값을 한눈에 모은 표가 <b>진리표</b>예요.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span>표기</span>
        {([["TF", "T / F"], ["10", "1 / 0"]] as const).map(([m, l]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={"min-h-[44px] min-w-[64px] rounded-card border px-3 " + (mode === m ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
          >
            {l}
          </button>
        ))}
      </div>

      <h4 className="mb-1 text-sm font-bold">1. p, q를 정해 보세요</h4>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <Toggle label="p" value={p} mode={mode} onChange={setP} />
        <Toggle label="q" value={q} mode={mode} onChange={setQ} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" aria-live="polite">
        {([["NOT · ~p", cur.notP], ["AND · p∧q", cur.and], ["OR · p∨q", cur.or], ["XOR · p⊕q", cur.xor]] as const).map(([n, v]) => (
          <div key={n} className="rounded-card bg-bg p-2 text-center">
            <div className="text-xs text-muted">{n}</div>
            <ValueCell v={v} mode={mode} strong />
          </div>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-sm" aria-label="p, q의 네 가지 경우에 대한 진리표">
          <thead>
            <tr className="bg-bg">
              {["p", "q", "~p", "p∧q", "p∨q", "p⊕q"].map((h) => (
                <th key={h} scope="col" className="border border-line p-1.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = r.p === p && r.q === q;
              return (
                <tr key={`${r.p}${r.q}`} className={on ? "bg-accent-soft" : ""} aria-current={on ? "true" : undefined}>
                  {[r.p, r.q, r.notP, r.and, r.or, r.xor].map((v, i) => (
                    <td key={i} className={"border border-line p-1.5 " + (on ? "outline outline-2 -outline-offset-2 outline-accent" : "")}>
                      <ValueCell v={v} mode={mode} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-muted">XOR(배타적 논리합)은 p, q 중 정확히 하나만 참일 때 참이에요.</p>

      <h4 className="mt-5 mb-1 text-sm font-bold">2. 명제 만들기</h4>
      <p className="mb-2 text-sm text-muted">예시 명제 쌍을 고르면 p, q의 진릿값이 정해지고, 이어 만든 문장의 진릿값이 나와요.</p>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="예시 명제 쌍 고르기">
        {PAIRS.map((pr, i) => (
          <button
            key={pr.name}
            type="button"
            aria-pressed={pairIdx === i}
            onClick={() => setPairIdx(i)}
            className={"min-h-[44px] rounded-card border px-3 text-sm " + (pairIdx === i ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
          >
            {pr.name}
          </button>
        ))}
      </div>
      <div className="mb-2 space-y-1 rounded-card bg-bg p-3 text-sm leading-6">
        <div>p: {pair.p} → <ValueCell v={pair.pv} mode={mode} /></div>
        <div>q: {pair.q} → <ValueCell v={pair.qv} mode={mode} /></div>
      </div>
      <ul className="space-y-2 text-sm">
        {combos.map((c) => (
          <li key={c.key} className="rounded-card border border-line p-2">
            <div className="text-xs text-muted">{c.name} · {c.op}</div>
            <div className="break-keep leading-6">{c.sentence}</div>
            <div>진릿값: <ValueCell v={c.value} mode={mode} strong /> <span className="text-muted">({c.value ? "참인 명제" : "거짓인 명제"})</span></div>
          </li>
        ))}
      </ul>

      <h4 className="mt-5 mb-1 text-sm font-bold">3. 진리표 채우기</h4>
      <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="연습할 식 고르기">
        {PRACTICES.map((pr, i) => (
          <button
            key={pr.label}
            type="button"
            aria-pressed={pracIdx === i}
            onClick={() => pickPractice(i)}
            className={"min-h-[44px] rounded-card border px-3 text-sm " + (pracIdx === i ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
          >
            {pr.label}
          </button>
        ))}
      </div>
      <p className="mb-1 text-sm">식 <b className="text-accent">{PRACTICES[pracIdx].label}</b> 의 빈칸을 채워 보세요.</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-sm" aria-label="빈칸 채우기 진리표">
          <thead>
            <tr className="bg-bg">
              <th scope="col" className="border border-line p-1.5">p</th>
              <th scope="col" className="border border-line p-1.5">q</th>
              <th scope="col" className="border border-line p-1.5">{PRACTICES[pracIdx].label}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const g = grades[i];
              return (
                <tr key={i}>
                  <td className="border border-line p-1.5"><ValueCell v={r.p} mode={mode} /></td>
                  <td className="border border-line p-1.5"><ValueCell v={r.q} mode={mode} /></td>
                  <td className={"border border-line p-1.5 " + (checked && g === true ? "bg-ok-soft" : checked && g !== true ? "bg-bad-soft" : "")}>
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      {[true, false].map((b) => (
                        <button
                          key={String(b)}
                          type="button"
                          aria-pressed={answers[i] === b}
                          aria-label={`p=${fmt(r.p, mode)}, q=${fmt(r.q, mode)}일 때 ${fmt(b, mode)}로 답하기`}
                          onClick={() => setAnswer(i, b)}
                          className={"min-h-[44px] min-w-[44px] rounded-card border font-bold " + (answers[i] === b ? "border-accent bg-accent text-accent-ink" : "border-line bg-bg text-ink")}
                        >
                          {fmt(b, mode)}
                        </button>
                      ))}
                      {checked && (
                        <span className={"ml-1 text-xs font-bold " + (g === true ? "text-ok" : "text-bad")}>
                          {g === null ? "빈칸" : g ? "맞음" : "틀림"}
                        </span>
                      )}
                      {showAns && <span className="ml-1 text-xs text-muted">정답 <ValueCell v={correct[i]} mode={mode} /></span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setChecked(true)} className="min-h-[44px] rounded-card border border-accent bg-accent px-4 text-sm font-bold text-accent-ink">확인</button>
        <button type="button" aria-pressed={showAns} onClick={() => setShowAns(!showAns)} className="min-h-[44px] rounded-card border border-line bg-bg px-4 text-sm text-ink">{showAns ? "정답 숨기기" : "정답 보기"}</button>
        <button type="button" onClick={() => pickPractice(pracIdx)} className="min-h-[44px] rounded-card border border-line bg-bg px-4 text-sm text-ink">다시 풀기</button>
      </div>
      {checked && (
        <p className="mt-2 text-sm" aria-live="polite">
          {allFilled ? (score === 4 ? <span className="font-bold text-ok">4칸 모두 맞았어요!</span> : <span className="font-bold text-bad">4칸 중 {score}칸이 맞았어요. 틀린 칸을 다시 생각해 보세요.</span>) : <span className="text-muted">비어 있는 칸이 있어요. 모두 채우고 확인해 보세요.</span>}
        </p>
      )}
    </div>
  );
}
