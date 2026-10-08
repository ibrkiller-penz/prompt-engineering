import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import RichMath from "./RichMath";
import { recordResult } from "./store";
import type { QResult } from "./store";
import type { Question } from "./types";

/** 문제 id 로 정한 섞기(새로고침해도 같은 순서) */
function seededOrder(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rnd = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "3/4", "1,200", "12%" 같은 입력을 숫자로 */
export function parseNumber(s: string): number | null {
  const t = s.replace(/[,\s]/g, "").replace(/^[−–]/, "-").replace(/%$/, "");
  if (!t) return null;
  const f = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (f) return Number(f[2]) === 0 ? null : Number(f[1]) / Number(f[2]);
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : null;
}

const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

type Status = "idle" | "wrong" | "correct" | "solution";

/** 정답일 때 화면 가운데에 겹쳐 그려지는 큰 동그라미 */
function CircleOverlay() {
  // 카드의 애니메이션(transform) 안에 두면 fixed 가 카드 기준이 되므로 body 로 뺀다
  return createPortal(
    <div className="am-circle" aria-hidden>
      <svg viewBox="0 0 100 100" width="min(70vw, 320px)" height="min(70vw, 320px)">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" pathLength="100" />
      </svg>
    </div>,
    document.body,
  );
}

export function QuestionCard({
  q,
  onDone,
  onNext,
  open = true,
}: {
  q: Question;
  onDone?: (ok: boolean) => void;
  /** 있으면 정답 뒤에 ‘다음 문제’ 단추를 보여 준다 */
  onNext?: () => void;
  open?: boolean;
}) {
  const order = useMemo(() => (q.type === "choice" ? seededOrder(q.choices.length, q.id) : []), [q]);
  const [sel, setSel] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [hints, setHints] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(false); // 오답일 때 한 번 흔들기

  const finish = (ok: boolean) => {
    if (!done) {
      setDone(true);
      recordResult(q.id, ok);
      onDone?.(ok);
    }
  };

  const check = () => {
    if (q.type === "choice") {
      if (sel == null) return setMsg("보기를 하나 골라 주세요.");
      if (order[sel] === q.answer) { setStatus("correct"); setMsg(""); finish(true); }
      else { setStatus("wrong"); setShake(true); setMsg("아쉬워요. 힌트를 보고 다시 해 봐요."); }
    } else if (q.type === "number") {
      const v = parseNumber(text);
      if (v == null) return setMsg("숫자(소수나 3/4 같은 분수)로 입력해 주세요.");
      const tol = q.tolerance ?? 1e-9 * Math.max(1, Math.abs(q.answer));
      if (Math.abs(v - q.answer) <= tol + 1e-12) { setStatus("correct"); setMsg(""); finish(true); }
      else { setStatus("wrong"); setShake(true); setMsg("값이 달라요. 힌트를 보고 다시 해 봐요."); }
    }
  };
  const chooseOx = (v: boolean) => {
    if (status === "correct" || status === "solution") return;
    setSel(v ? 1 : 0);
    if (q.type === "ox" && v === q.answer) { setStatus("correct"); setMsg(""); finish(true); }
    else { setStatus("wrong"); setShake(true); setMsg("아쉬워요. 힌트를 보고 다시 해 봐요."); }
  };
  const showSolution = () => {
    if (status !== "correct") setStatus("solution");
    finish(status === "correct");
  };
  const selfGrade = (ok: boolean) => { setStatus(ok ? "correct" : "solution"); finish(ok); };

  const locked = status === "correct" || status === "solution";
  const hintList = q.type === "open" ? q.hints ?? [] : q.hints;

  return (
    <article onAnimationEnd={(e) => e.target === e.currentTarget && setShake(false)} className={`rounded-card border bg-surface p-4 sm:p-5 ${status === "correct" ? "am-pop border-ok" : status === "wrong" ? `${shake ? "am-shake " : ""}border-bad/60` : "border-line"}`} aria-label="문제">
      {status === "correct" && <CircleOverlay />}
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-semibold text-accent">{q.group}</span>
        <span className="text-warn" title={`난이도 ${q.level}`} aria-label={`난이도 ${q.level} / 5`}>{stars(q.level)}</span>
      </header>
      {q.new && (
        <p className="mt-2 text-sm text-muted">
          <b className="text-ink">새로 더해진 것</b> · <RichMath text={q.new} />
        </p>
      )}
      <p className="mt-3 text-[1.05rem] font-semibold leading-relaxed"><RichMath text={q.prompt} /></p>

      {open && (
        <>
          {q.type === "choice" && (
            <ul className="mt-3 grid gap-2" role="radiogroup" aria-label="보기">
              {order.map((orig, j) => {
                const on = sel === j;
                const right = locked && orig === q.answer;
                return (
                  <li key={orig}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={locked}
                      onClick={() => { setSel(j); setStatus("idle"); setMsg(""); }}
                      className={`flex min-h-[44px] w-full items-center gap-3 rounded-card border px-3 py-2 text-left transition ${
                        right ? "border-ok bg-ok-soft" : on ? "border-accent bg-accent-soft" : "border-line bg-bg hover:border-accent"
                      }`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${on || right ? "bg-accent text-accent-ink" : "bg-line/70 text-muted"}`}>{"①②③④⑤"[j]}</span>
                      <span><RichMath text={q.choices[orig]} /></span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {q.type === "number" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`in-${q.id}`}>답</label>
              <input
                id={`in-${q.id}`}
                inputMode="decimal"
                autoComplete="off"
                value={text}
                disabled={locked}
                onChange={(e) => { setText(e.target.value); setStatus("idle"); setMsg(""); }}
                onKeyDown={(e) => e.key === "Enter" && !locked && check()}
                placeholder="답을 입력하세요"
                className="min-h-[44px] w-48 rounded-card border border-line bg-bg px-3 text-lg outline-none focus:border-accent"
              />
              {q.unit && <span className="text-muted"><RichMath text={q.unit} /></span>}
            </div>
          )}

          {q.type === "ox" && (
            <div className="mt-3 flex gap-3">
              {[true, false].map((v) => {
                const on = sel === (v ? 1 : 0);
                const right = locked && q.answer === v;
                return (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={locked}
                    onClick={() => chooseOx(v)}
                    className={`min-h-[56px] w-24 rounded-card border-2 text-2xl font-extrabold transition ${
                      right ? "border-ok bg-ok-soft text-ok" : on ? "border-bad bg-bad-soft text-bad" : "border-line bg-bg hover:border-accent"
                    }`}
                    aria-label={v ? "맞아요(O)" : "틀려요(X)"}
                  >
                    {v ? "O" : "X"}
                  </button>
                );
              })}
            </div>
          )}

          {q.type === "open" && (
            <div className="mt-3">
              <label className="sr-only" htmlFor={`in-${q.id}`}>내 답</label>
              <textarea
                id={`in-${q.id}`}
                rows={4}
                value={text}
                disabled={locked}
                onChange={(e) => setText(e.target.value)}
                placeholder="내 생각을 적어 보세요 (이 기기에만 있고 저장되지 않아요)"
                className="w-full rounded-card border border-line bg-bg px-3 py-2 leading-relaxed outline-none focus:border-accent"
              />
            </div>
          )}

          {msg && <p className="mt-2 text-sm font-semibold text-bad" role="alert">{msg}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(q.type === "choice" || q.type === "number") && !locked && (
              <button type="button" onClick={check} className="min-h-[44px] rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">확인</button>
            )}
            {!locked && hints < hintList.length && (
              <button type="button" onClick={() => setHints((h) => h + 1)} className="min-h-[44px] rounded-card border border-line px-4 font-semibold hover:bg-bg">
                💡 힌트 {hints + 1}
              </button>
            )}
            {!locked && q.type !== "open" && (
              <button type="button" onClick={showSolution} className="min-h-[44px] rounded-card border border-line px-4 font-semibold text-muted hover:bg-bg">풀이 보기</button>
            )}
          </div>

          {hints > 0 && (
            <ol className="mt-3 space-y-2">
              {hintList.slice(0, hints).map((h, i) => (
                <li key={i} className="rounded-card bg-warn-soft px-3 py-2 text-sm text-warn"><b>힌트 {i + 1}</b> · <RichMath text={h} /></li>
              ))}
            </ol>
          )}

          {q.type === "open" && !locked && (
            <OpenReveal q={q} onGrade={selfGrade} />
          )}

          {locked && (
            <div className={`mt-3 rounded-card p-3 ${status === "correct" ? "bg-ok-soft" : "bg-bg"}`} role="status">
              
              <p className={`font-bold ${status === "correct" ? "text-ok" : "text-ink"}`}>
                {status === "correct" ? "정답이에요! 🎉" : "풀이를 봤어요. 다음에 다시 도전해요."}
              </p>
              {q.type !== "open" && (
                <p className="mt-1 leading-relaxed"><RichMath text={q.solution} /></p>
              )}
              {q.type === "open" && <OpenModel q={q} />}
              {onNext && (
                <button type="button" onClick={onNext} className="mt-3 min-h-[44px] rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">
                  다음 문제 ▶
                </button>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );

}

function OpenModel({ q }: { q: Extract<Question, { type: "open" }> }) {
  return (
    <div className="mt-2">
      <p className="text-sm font-bold text-muted">모범 답안</p>
      <p className="mt-1 leading-relaxed"><RichMath text={q.model} /></p>
      <p className="mt-2 text-sm font-bold text-muted">이런 점이 들어가면 좋아요</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.95rem]">
        {q.rubric.map((r, i) => <li key={i}><RichMath text={r} /></li>)}
      </ul>
    </div>
  );
}

function OpenReveal({ q, onGrade }: { q: Extract<Question, { type: "open" }>; onGrade: (ok: boolean) => void }) {
  const [shown, setShown] = useState(false);
  const [checks, setChecks] = useState<boolean[]>(q.rubric.map(() => false));
  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className="mt-3 min-h-[44px] rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">
        모범 답안 보고 스스로 채점하기
      </button>
    );
  }
  const n = checks.filter(Boolean).length;
  return (
    <div className="mt-3 rounded-card bg-bg p-3">
      <OpenModel q={q} />
      <p className="mt-3 text-sm font-bold">내 답에 들어 있는 것에 체크해요</p>
      <ul className="mt-1 space-y-1">
        {q.rubric.map((r, i) => (
          <li key={i}>
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={checks[i]} onChange={() => setChecks((c) => c.map((v, k) => (k === i ? !v : v)))} />
              <span className="text-[0.95rem]"><RichMath text={r} /></span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => onGrade(n >= Math.ceil(q.rubric.length / 2))} className="mt-2 min-h-[44px] rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">
        채점 끝 ({n}/{q.rubric.length})
      </button>
    </div>
  );
}

/** 계단식: 한 번에 한 문제. 풀거나 풀이를 보면 다음 계단이 열린다. */
export function StairRunner({ questions, results }: { questions: Question[]; results: Record<string, QResult> }) {
  const first = questions.findIndex((q) => !results[q.id]);
  const [cur, setCur] = useState(first === -1 ? questions.length : first);
  const [open, setOpen] = useState<Record<string, number>>({}); // 다시 풀기용 key 증가
  const [peek, setPeek] = useState<string | null>(null);

  const [held, setHeld] = useState<string | null>(null); // 방금 푼 카드는 효과·풀이를 볼 수 있게 열어 둔다
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** 푼 카드를 접고 다음 문제 카드를 화면 가운데로 */
  const goNext = (i: number) => {
    clearTimeout(timer.current);
    setHeld(null);
    const next = questions[i + 1];
    if (!next) return;
    setTimeout(() => {
      const el = document.getElementById(`q-${next.id}`);
      const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    }, 60);
  };

  let lastGroup = "";
  return (
    <div className="space-y-3">
      {questions.slice(0, Math.min(cur + 1, questions.length)).map((q, i) => {
        const header = q.group !== lastGroup ? q.group : null;
        lastGroup = q.group;
        const r = results[q.id];
        const isCur = i === cur;
        const expanded = isCur || peek === q.id || held === q.id;
        return (
          <div key={q.id} id={`q-${q.id}`}>
            {header && i > 0 && <h4 className="mb-2 mt-6 text-sm font-bold tracking-wide text-accent">▸ {header}</h4>}
            {expanded ? (
              <QuestionCard
                key={q.id + ":" + (open[q.id] ?? 0)}
                q={q}
                onDone={(ok) => {
                  if (!isCur) return;
                  setCur((c) => Math.max(c, i + 1));
                  setHeld(q.id);
                  clearTimeout(timer.current);
                  if (ok) timer.current = setTimeout(() => goNext(i), 1100); // 효과를 보여 준 뒤 다음 문제로
                }}
                onNext={i < questions.length - 1 ? () => goNext(i) : undefined}
              />
            ) : (
              <button
                type="button"
                onClick={() => { setPeek(q.id); setOpen((o) => ({ ...o, [q.id]: (o[q.id] ?? 0) + 1 })); }}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-card border border-line bg-surface px-3 py-2 text-left hover:border-accent"
                aria-label={`${i + 1}번 문제 다시 보기`}
              >
                <span className={`text-lg ${r?.ok ? "text-ok" : "text-bad"}`} aria-hidden>{r?.ok ? "✓" : "✗"}</span>
                <span className="text-sm text-muted">{i + 1}번</span>
                <span className="line-clamp-1 flex-1 text-[0.95rem]"><RichMath text={q.prompt} /></span>
                <span className="text-xs text-muted">다시 풀기</span>
              </button>
            )}
          </div>
        );
      })}
      {cur < questions.length ? (
        <p className="text-center text-sm text-muted">남은 문제 {questions.length - cur - 1}개 · 풀면 다음 문제가 열려요</p>
      ) : (
        <Finish questions={questions} results={results} />
      )}
    </div>
  );
}

export function Finish({ questions, results }: { questions: Question[]; results: Record<string, QResult> }) {
  const ok = questions.filter((q) => results[q.id]?.ok).length;
  const pct = Math.round((ok / questions.length) * 100);
  return (
    <div className="rounded-card border-2 border-accent bg-accent-soft p-4 text-center">
      <p className="text-lg font-extrabold">다 풀었어요! 🎉</p>
      <p className="mt-1">맞힌 문제 <b className="text-accent">{ok}</b> / {questions.length} ({pct}%)</p>
      {ok < questions.length && <p className="mt-1 text-sm text-muted">틀린 문제는 위쪽의 ✗ 줄을 눌러 다시 풀거나 ‘오답노트’에서 모아 볼 수 있어요.</p>}
    </div>
  );
}
