import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat, rand } from "./kit";

// <pure>
function isPrime(n: number): boolean {
  if (!Number.isInteger(n) || n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}
/** p+q=n 인 소수 쌍 (p≤q) 모두 */
function goldbachPairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let p = 2; p <= n / 2; p++) if (isPrime(p) && isPrime(n - p)) out.push([p, n - p]);
  return out;
}
// </pure>

const MIN = 4;
const MAX = 200;
const EVENS: number[] = [];
for (let n = MIN; n <= MAX; n += 2) EVENS.push(n);
const COUNTS = EVENS.map((n) => goldbachPairs(n).length);
const MIN_C = Math.min(...COUNTS);
const MAX_C = Math.max(...COUNTS);
const MIN_N = EVENS[COUNTS.indexOf(MIN_C)];
const MAX_N = EVENS[COUNTS.indexOf(MAX_C)];
const PRIMES = Array.from({ length: MAX }, (_, i) => i + 1).filter(isPrime);

type Tab = "explore" | "pair" | "all";
type Say_ = { t: "info" | "ok" | "bad"; s: string };

export default function GoldbachGame() {
  const [tab, setTab] = useState<Tab>("explore");
  const [n, setN] = useState(30);
  const [showPrime, setShowPrime] = useState(true);
  const [score, setScore] = useState({ ok: 0, tries: 0 });

  // 한 쌍 찾기
  const [q1, setQ1] = useState(() => 6 + 2 * rand(40));
  const [slots, setSlots] = useState<number[]>([]);
  // 모든 쌍 찾기
  const [q2, setQ2] = useState(() => 20 + 2 * rand(40));
  const [found, setFound] = useState<number[]>([]);
  const [msg, setMsg] = useState<Say_>({ t: "info", s: "짝수를 눌러 보세요. 합이 되는 소수 짝을 모두 보여 줘요." });

  const pairs = useMemo(() => goldbachPairs(n), [n]);
  const pairs2 = useMemo(() => goldbachPairs(q2), [q2]);
  const showN = tab === "explore" ? n : tab === "pair" ? q1 : q2;

  const goTab = (t: Tab) => {
    setTab(t);
    if (t === "explore") setMsg({ t: "info", s: "짝수를 눌러 보세요. 합이 되는 소수 짝을 모두 보여 줘요." });
    if (t === "pair") setMsg({ t: "info", s: `${q1} 이 되도록 소수 두 개를 골라 보세요. (같은 소수를 두 번 골라도 돼요)` });
    if (t === "all") setMsg({ t: "info", s: `${q2} 을 두 소수의 합으로 나타내는 방법을 모두 찾아요. 소수를 하나씩 눌러 보세요.` });
  };

  const pickSlot = (p: number) => {
    setSlots((s) => (s.length >= 2 ? [p] : [...s, p]));
  };
  const check1 = () => {
    if (slots.length < 2) {
      setMsg({ t: "info", s: "소수를 두 개 골라 주세요." });
      return;
    }
    const sum = slots[0] + slots[1];
    const ok = sum === q1;
    setScore((s) => ({ ok: s.ok + (ok ? 1 : 0), tries: s.tries + 1 }));
    setMsg(ok ? { t: "ok", s: `맞아요! ${slots[0]} + ${slots[1]} = ${q1}` } : { t: "bad", s: `${slots[0]} + ${slots[1]} = ${sum} 이에요. ${q1} 이 되는 짝을 다시 찾아봐요.` });
  };
  const next1 = () => {
    setQ1(6 + 2 * rand(60));
    setSlots([]);
    setMsg({ t: "info", s: "새 문제예요!" });
  };
  const tryP = (p: number) => {
    const q = q2 - p;
    if (found.includes(Math.min(p, q))) {
      setMsg({ t: "info", s: `${Math.min(p, q)} + ${Math.max(p, q)} 는 이미 찾았어요.` });
      return;
    }
    if (isPrime(q)) {
      const lo = Math.min(p, q);
      const nf = [...found, lo];
      setFound(nf);
      if (nf.length === pairs2.length) {
        setScore((s) => ({ ok: s.ok + 1, tries: s.tries + 1 }));
        setMsg({ t: "ok", s: `모두 찾았어요! ${q2} 은 소수 두 개의 합으로 ${pairs2.length}가지로 나타낼 수 있어요.` });
      } else setMsg({ t: "ok", s: `${lo} + ${q2 - lo} = ${q2} 찾았어요! (${nf.length} / ${pairs2.length})` });
    } else setMsg({ t: "bad", s: `${q2} − ${p} = ${q} 은 소수가 아니에요.` });
  };
  const next2 = () => {
    setQ2(20 + 2 * rand(80));
    setFound([]);
    setMsg({ t: "info", s: "새 문제예요!" });
  };
  const giveUp = () => {
    setFound(pairs2.map(([p]) => p));
    setScore((s) => ({ ...s, tries: s.tries + 1 }));
    setMsg({ t: "info", s: `정답을 보여 줬어요. ${q2} 은 모두 ${pairs2.length}가지예요.` });
  };

  const shownPairs = tab === "all" ? pairs2.filter(([p]) => found.includes(p)) : tab === "explore" ? pairs : [];

  // 막대/수직선 그림
  const lineW = 600;
  const sx = (v: number) => 20 + (v / showN) * (lineW - 40);
  const numberLine = (
    <svg viewBox={`0 0 ${lineW} ${64 + shownPairs.length * 22}`} width="100%" role="img" aria-label={`${showN} 의 소수 쌍을 보여 주는 수직선`} className="block w-full rounded-card bg-bg">
      <line x1={20} y1={30} x2={lineW - 20} y2={30} stroke="#94a3b8" strokeWidth={2} />
      {Array.from({ length: showN + 1 }, (_, v) => v).filter(isPrime).map((p) => (
        <g key={p}>
          <circle cx={sx(p)} cy={30} r={showN > 100 ? 2.5 : 3.5} fill={showPrime ? "#ef4444" : "#94a3b8"} />
          {showN <= 60 && showPrime && (
            <text x={sx(p)} y={18} textAnchor="middle" fontSize={9} fill="#ef4444">
              {p}
            </text>
          )}
        </g>
      ))}
      <text x={20} y={46} fontSize={10} fill="#64748b">0</text>
      <text x={lineW - 20} y={46} textAnchor="end" fontSize={10} fill="#64748b">{showN}</text>
      {shownPairs.map(([p, qq], i) => {
        const y = 68 + i * 22;
        return (
          <g key={p}>
            <rect x={20} y={y - 10} width={sx(p) - 20} height={14} rx={3} fill="#38bdf8" />
            <rect x={sx(p)} y={y - 10} width={sx(qq) - 20} height={14} rx={3} fill="#f59e0b" />
            <text x={20 + 4} y={y + 1} fontSize={10} fill="#fff" fontWeight={700}>{p}</text>
            <text x={lineW - 24} y={y + 1} textAnchor="end" fontSize={10} fill="#fff" fontWeight={700}>{qq}</text>
          </g>
        );
      })}
    </svg>
  );

  const maxBar = MAX_C;
  const gw = 600;
  const gh = 130;
  const bw = (gw - 30) / EVENS.length;

  return (
    <div className="space-y-3">
      <Board>
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="게임 방식">
          <GButton pressed={tab === "explore"} onClick={() => goTab("explore")}>짝수 탐험</GButton>
          <GButton pressed={tab === "pair"} onClick={() => goTab("pair")}>한 쌍 찾기</GButton>
          <GButton pressed={tab === "all"} onClick={() => goTab("all")}>모든 쌍 찾기</GButton>
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="퀘스트 점수" value={`${score.ok} / ${score.tries}`} tone={score.ok > 0 ? "ok" : "plain"} />
          {tab === "explore" && <Stat label={`${n} 의 쌍`} value={`${pairs.length}개`} />}
          {tab === "all" && <Stat label="찾은 쌍" value={`${found.length} / ${pairs2.length}`} tone={found.length === pairs2.length ? "ok" : "plain"} />}
        </div>

        {tab === "explore" && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <GButton pressed={showPrime} onClick={() => setShowPrime((v) => !v)}>소수 표시 {showPrime ? "끄기" : "켜기"}</GButton>
              <span className="text-xs text-muted">숫자판 아래 작은 수는 쌍의 개수예요{showPrime ? "" : " (소수 표시를 켜면 보여요)"}.</span>
            </div>
            <div role="group" aria-label="짝수 숫자판" className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))" }}>
              {EVENS.map((e, i) => (
                <button
                  key={e}
                  type="button"
                  aria-pressed={e === n}
                  aria-label={`${e}, 쌍 ${COUNTS[i]}개`}
                  onClick={() => {
                    setN(e);
                    setMsg({ t: "info", s: `${e} = ${goldbachPairs(e).map(([p, q]) => `${p}+${q}`).join(", ")}` });
                  }}
                  className={`flex min-h-[44px] flex-col items-center justify-center rounded-card border text-sm font-bold tabular-nums ${e === n ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface hover:bg-bg"}`}
                >
                  {e}
                  {showPrime && <span className={`text-[10px] font-semibold ${e === n ? "" : "text-muted"}`}>{COUNTS[i]}쌍</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "pair" && (
          <div>
            <p className="text-lg font-extrabold">
              {slots[0] ?? "□"} + {slots[1] ?? "□"} = {q1}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="소수 목록">
              {PRIMES.filter((p) => p < q1).map((p) => (
                <button key={p} type="button" onClick={() => pickSlot(p)} className="min-h-[44px] min-w-[44px] rounded-card border border-line bg-surface px-2 font-bold tabular-nums hover:bg-bg">
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <GButton variant="primary" onClick={check1}>합 확인</GButton>
              <GButton onClick={() => setSlots([])}>지우기</GButton>
              <GButton onClick={next1}>새 문제</GButton>
            </div>
          </div>
        )}

        {tab === "all" && (
          <div>
            <p className="font-semibold">
              {q2} = 소수 + 소수 로 나타내는 방법을 모두 찾아요. (소수 하나를 누르면 나머지가 소수인지 확인해요)
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="소수 목록">
              {PRIMES.filter((p) => p <= q2 / 2).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => tryP(p)}
                  className={`min-h-[44px] min-w-[44px] rounded-card border px-2 font-bold tabular-nums ${found.includes(p) ? "border-ok bg-ok-soft text-ok" : "border-line bg-surface hover:bg-bg"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <GButton onClick={giveUp}>정답 보기</GButton>
              <GButton onClick={() => { setFound([]); setMsg({ t: "info", s: "찾은 것을 지웠어요." }); }}>다시 하기</GButton>
              <GButton onClick={next2}>새 문제</GButton>
            </div>
          </div>
        )}

        <div className="mt-3">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
      </Board>

      {(tab === "explore" || (tab === "all" && found.length > 0)) && (
        <Board>
          <h3 className="mb-2 font-bold">
            {showN} = 소수 + 소수 ({shownPairs.length}쌍)
          </h3>
          <ul className="mb-3 flex flex-wrap gap-1.5 text-sm font-semibold tabular-nums">
            {shownPairs.map(([p, qq]) => (
              <li key={p} className="rounded-full bg-accent-soft px-3 py-1 text-accent">
                {p} + {qq}
              </li>
            ))}
          </ul>
          {numberLine}
          <p className="mt-1 text-xs text-muted">위 수직선의 점은 소수예요. 아래 막대는 한 줄이 한 쌍이고, 파랑(p) + 주황(q)을 이으면 길이가 {showN} 이 돼요.</p>
        </Board>
      )}

      {tab === "explore" && (
        <Board>
          <h3 className="font-bold">짝수마다 쌍이 몇 개일까요?</h3>
          <p className="mb-2 text-sm text-muted">막대를 누르면 그 짝수로 이동해요. (쌍이 가장 적은 곳 {MIN_C}쌍, 가장 많은 곳 {MAX_N} 에서 {MAX_C}쌍)</p>
          <svg viewBox={`0 0 ${gw} ${gh + 26}`} width="100%" role="group" aria-label="4부터 200까지 짝수의 소수 쌍 개수 막대 그래프" className="block w-full rounded-card bg-bg">
            {EVENS.map((e, i) => {
              const h = (COUNTS[i] / maxBar) * gh;
              const sel = e === n;
              return (
                <g key={e} onClick={() => setN(e)} style={{ cursor: "pointer" }}>
                  <rect x={20 + i * bw} y={4} width={bw} height={gh} fill="transparent" />
                  <rect x={20 + i * bw + 0.5} y={4 + gh - h} width={Math.max(1, bw - 1)} height={h} fill={sel ? "#ef4444" : COUNTS[i] === MIN_C ? "#94a3b8" : COUNTS[i] === MAX_C ? "#f59e0b" : "#38bdf8"} />
                </g>
              );
            })}
            <line x1={20} y1={4 + gh} x2={gw - 10} y2={4 + gh} stroke="#94a3b8" />
            {[4, 50, 100, 150, 200].map((v) => (
              <text key={v} x={20 + ((v - 4) / 2) * bw + bw / 2} y={gh + 20} textAnchor="middle" fontSize={10} fill="#64748b">
                {v}
              </text>
            ))}
          </svg>
          <div className="mt-2 flex flex-wrap gap-2">
            <GButton variant="soft" onClick={() => { setN(MIN_N); setMsg({ t: "info", s: `${MIN_N} 은 쌍이 ${MIN_C}개뿐이에요. 4, 6, 8 처럼 작은 짝수는 쌍이 적어요.` }); }}>쌍이 가장 적은 짝수 (처음 {MIN_N})</GButton>
            <GButton variant="soft" onClick={() => { setN(MAX_N); setMsg({ t: "info", s: `4~200 중 ${MAX_N} 의 쌍이 ${MAX_C}개로 가장 많아요.` }); }}>쌍이 가장 많은 짝수 ({MAX_N})</GButton>
          </div>
        </Board>
      )}

      <Board>
        <p className="text-sm">
          <strong>골드바흐 추측</strong>: “4보다 큰 모든 짝수는 두 소수의 합으로 나타낼 수 있다.” 컴퓨터로 아주 큰 수까지 확인했지만 반례는 찾지 못했어요. 그래도 <strong>아직 아무도 증명하지 못한 미해결 문제</strong>예요. 여기서 4~200 이 모두 되는 것을 확인해도 증명이 되는 것은 아니에요.
        </p>
      </Board>
    </div>
  );
}
