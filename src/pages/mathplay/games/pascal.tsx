import { useMemo, useState, type ReactNode } from "react";
import { Board, GButton, Slider, Stat, rand } from "./kit";
import { choices, shallowDiagonal, triangle } from "./pascal.logic";

const CW = 60;
const RH = 52;
const R = 27;
const LM = 14;
const RM_SUM = 64;
const BIG = "min-h-[48px]! px-3 text-base";
type Mode = "blank" | "sumq" | "parity" | "rowsum" | "basic" | "mod3" | "diag";
const MAIN: { id: Mode; label: string }[] = [
  { id: "blank", label: "빈칸 채우기" },
  { id: "sumq", label: "줄 합 맞히기" },
  { id: "parity", label: "홀수 색칠" },
  { id: "rowsum", label: "줄 합 보기" },
];
const MORE: { id: Mode; label: string }[] = [
  { id: "basic", label: "그냥 보기" },
  { id: "mod3", label: "3의 배수 색칠" },
  { id: "diag", label: "비스듬히 더하기" },
];
const GUIDE: Record<Mode, string> = {
  blank: "노란 ? 칸에 들어갈 수를 골라요. 위의 두 수를 더하면 돼요.",
  sumq: "노란 줄의 수를 모두 더하면 얼마일까요?",
  parity: "홀수인 칸이 색칠돼요. 어떤 무늬가 보이나요? 칸을 눌러 봐요.",
  rowsum: "칸을 누르면 그 줄의 합이 나와요. 오른쪽에 모든 줄의 합이 있어요.",
  basic: "칸을 누르면 위의 두 수가 보여요. 두 수를 더하면 그 칸의 수가 돼요.",
  mod3: "3으로 나누어떨어지는 수(3의 배수)가 주황색이에요. 칸을 눌러 봐요.",
  diag: "초록색 칸을 모두 더해 봐요. 아래 막대로 줄을 바꿀 수 있어요.",
};
const key = (n: number, k: number) => `${n},${k}`;
const SEL = { n: -1, k: -1 };
type Msg = { t: "info" | "ok" | "bad"; s: ReactNode };

function Tip({ tone = "info", children }: { tone?: Msg["t"]; children: ReactNode }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok" : tone === "bad" ? "bg-bad-soft text-bad" : "bg-accent-soft/70 text-ink";
  return (
    <p className={`rounded-card px-3 py-2.5 text-base font-semibold leading-relaxed ${c}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

function pickHidden(rows: number, count = 2): Set<string> {
  for (let tries = 0; tries < 200; tries++) {
    const cells: [number, number][] = [];
    while (cells.length < count) {
      const n = 2 + rand(rows - 2);
      const k = 1 + rand(n - 1);
      if (!cells.some(([a, b]) => a === n && b === k)) cells.push([n, k]);
    }
    const rel = (a: [number, number], b: [number, number]) => b[0] === a[0] + 1 && (b[1] === a[1] || b[1] === a[1] + 1);
    if (cells.every((a) => cells.every((b) => !rel(a, b)))) return new Set(cells.map(([n, k]) => key(n, k)));
  }
  return new Set([key(rows - 1, 1)]);
}

function initial() {
  const t = triangle(6);
  const h = pickHidden(6);
  const f = [...h][0].split(",").map(Number);
  return { h, sel: { n: f[0], k: f[1] }, opts: choices(t[f[0]][f[1]], [t[f[0] - 1][f[1] - 1], t[f[0] - 1][f[1]]]) };
}

export default function PascalGame() {
  const [init] = useState(initial);
  const [rows, setRows] = useState(6);
  const [mode, setMode] = useState<Mode>("blank");
  const [more, setMore] = useState(false);
  const [sel, setSel] = useState(init.sel);
  const [diagN, setDiagN] = useState(5);
  const [hidden, setHidden] = useState<Set<string>>(init.h);
  const [round, setRound] = useState(0);
  const [stars, setStars] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [opts, setOpts] = useState<number[]>(init.opts);
  const [sumRow, setSumRow] = useState(3);
  const [sumDone, setSumDone] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);

  const T = useMemo(() => triangle(rows), [rows]);
  const quest = mode === "blank" || mode === "sumq";
  const roundDone = mode === "blank" ? hidden.size === 0 : sumDone;
  const finished = quest && round >= 5;
  const dN = Math.min(diagN, rows - 1);
  const diagCells = mode === "diag" ? shallowDiagonal(dN) : [];

  const blankOpts = (n: number, k: number) => setOpts(choices(T[n][k], [T[n - 1][k - 1], T[n - 1][k]]));
  const setupBlank = (rws: number, t = triangle(rws)) => {
    const h = pickHidden(rws);
    setHidden(h);
    const f = [...h][0].split(",").map(Number);
    setSel({ n: f[0], k: f[1] });
    setOpts(choices(t[f[0]][f[1]], [t[f[0] - 1][f[1] - 1], t[f[0] - 1][f[1]]]));
    setWrong([]);
  };
  const setupSum = (rws: number, t = triangle(rws)) => {
    const n = 2 + rand(rws - 2);
    setSumRow(n);
    setSumDone(false);
    setOpts(choices(2 ** n, [2 ** n - 1, 2 ** (n - 1)]));
    setWrong([]);
    void t;
  };

  const begin = (md: Mode, rws: number) => {
    setMode(md);
    setSel(SEL);
    setRound(0);
    setStars(0);
    setMsg(null);
    setHidden(new Set());
    setWrong([]);
    setSumDone(false);
    if (md === "blank") setupBlank(rws);
    else if (md === "sumq") setupSum(rws);
  };
  const nextRound = () => {
    const r = round + 1;
    setRound(r);
    if (r >= 5) {
      setSel(SEL);
      setMsg({ t: "ok", s: `끝까지 해냈어요! ⭐ ${stars}개를 모았어요. 정말 잘했어요!` });
      return;
    }
    setMsg({ t: "info", s: `${r + 1}번째 판이에요. 해 봐요!` });
    if (mode === "blank") setupBlank(rows, T);
    else setupSum(rows, T);
  };
  const pickAnswer = (v: number) => {
    if (mode === "blank") {
      const { n, k } = sel;
      if (!hidden.has(key(n, k))) return;
      const truth = T[n][k];
      if (v === truth) {
        const h = new Set(hidden);
        h.delete(key(n, k));
        setHidden(h);
        const first = wrong.length === 0;
        if (first) setStars((s) => s + 1);
        setWrong([]);
        const rest = [...h][0];
        if (rest) {
          const f = rest.split(",").map(Number);
          setSel({ n: f[0], k: f[1] });
          blankOpts(f[0], f[1]);
        }
        setMsg({ t: "ok", s: `${first ? "⭐ " : ""}맞아요! ${T[n - 1][k - 1]} + ${T[n - 1][k]} = ${truth}.` + (h.size === 0 ? " 이번 판을 모두 채웠어요!" : " 다음 ? 칸도 해 봐요.") });
      } else {
        setWrong((w) => [...w, v]);
        setMsg({ t: "bad", s: `괜찮아요, 다시 해 봐요! 노란 두 칸은 ${T[n - 1][k - 1]} 와(과) ${T[n - 1][k]} 예요. 두 수를 더해요.` });
      }
    } else if (mode === "sumq") {
      const truth = 2 ** sumRow;
      if (v === truth) {
        const first = wrong.length === 0;
        if (first) setStars((s) => s + 1);
        setSumDone(true);
        setMsg({ t: "ok", s: `${first ? "⭐ " : ""}맞아요! ${T[sumRow].join(" + ")} = ${truth}` });
      } else {
        setWrong((w) => [...w, v]);
        setMsg({ t: "bad", s: `괜찮아요, 다시 해 봐요! ${T[sumRow].join(" + ")} 를 차례로 더해 봐요.` });
      }
    }
  };

  const tap = (n: number, k: number) => {
    if (mode === "blank") {
      if (hidden.has(key(n, k))) {
        setSel({ n, k });
        blankOpts(n, k);
        setWrong([]);
        setMsg({ t: "info", s: "위의 두 수를 더해서 맞는 수를 골라요." });
      } else {
        setSel({ n, k });
        setMsg(null);
      }
      return;
    }
    setSel({ n, k });
    if (mode !== "sumq") setMsg(null);
  };

  const W = rows * CW;
  const vw = LM + W + (mode === "rowsum" ? RM_SUM : 0);
  const vh = (rows - 1) * RH + 2 * R + 8;
  const cx = (n: number, k: number) => LM + W / 2 + (k - n / 2) * CW;
  const cy = (n: number) => R + 4 + n * RH;

  const isSel = (n: number, k: number) => sel.n === n && sel.k === k;
  const isParent = (n: number, k: number) => sel.n >= 1 && n === sel.n - 1 && (k === sel.k - 1 || k === sel.k) && k >= 0 && k <= n;
  const inDiag = (n: number, k: number) => diagCells.some(([a, b]) => a === n && b === k);
  const inSumRow = (n: number) => (mode === "sumq" ? n === sumRow : mode === "rowsum" ? n === sel.n : false);

  const cellStyle = (n: number, k: number, v: number) => {
    let fill = "var(--surface)";
    let stroke = "var(--line)";
    let text = "var(--ink)";
    if (mode === "basic" || quest) fill = "var(--accent-soft)";
    if (mode === "parity" && v % 2 === 1) {
      fill = "var(--accent)";
      text = "var(--accent-ink)";
      stroke = "var(--accent)";
    }
    if (mode === "mod3" && v % 3 === 0) {
      fill = "#f59e0b";
      stroke = "#b45309";
      text = "#1c1917";
    }
    if (inSumRow(n) || (isParent(n, k) && mode !== "sumq")) {
      fill = "#fde68a";
      stroke = "#b45309";
      text = "#1c1917";
    }
    if (mode === "diag" && inDiag(n, k)) {
      fill = "#34d399";
      stroke = "#047857";
      text = "#052e16";
    }
    if (isSel(n, k)) stroke = "#dc2626";
    return { fill, stroke, text };
  };

  const info = ((): Msg => {
    if (msg) return msg;
    const { n, k } = sel;
    const has = n >= 0;
    if (mode === "blank") return { t: "info", s: hidden.size ? "아래 보기에서 답을 골라요. 노란 칸이 위의 두 수예요." : "다음 판으로 가 봐요." };
    if (mode === "sumq") return { t: "info", s: "보기 중에서 답을 골라요." };
    if (mode === "diag") {
      const parts = diagCells.map(([a, b]) => T[a][b]);
      return { t: "info", s: `초록 칸을 더하면 ${parts.join(" + ")} = ${parts.reduce((a, b) => a + b, 0)} 이에요. 1, 1, 2, 3, 5, 8, 13… 순서에 나오는 수예요.` };
    }
    if (mode === "rowsum") {
      if (!has) return { t: "info", s: "아무 칸이나 눌러 봐요." };
      const r = T[n];
      const sum = r.reduce((a, b) => a + b, 0);
      return { t: "info", s: `${n}줄: ${r.join(" + ")} = ${sum}.` + (n >= 2 ? ` 2를 ${n}번 곱한 수(${Array(n).fill(2).join("×")})와 같아요!` : n === 1 ? " 2예요." : " 1이에요.") };
    }
    if (mode === "parity") {
      if (!has) return { t: "info", s: "칸을 누르면 그 줄에 홀수가 몇 개인지 알려 줘요." };
      return { t: "info", s: `${n}줄에는 홀수가 ${T[n].filter((x) => x % 2 === 1).length}개 있어요.` };
    }
    if (mode === "mod3") return { t: "info", s: `주황 칸은 ${T.flat().filter((x) => x % 3 === 0).length}개예요.` };
    if (!has) return { t: "info", s: "칸을 눌러 보세요." };
    if (k === 0 || k === n) return { t: "info", s: "줄의 양 끝은 늘 1이에요." };
    return { t: "info", s: `${T[n][k]} = ${T[n - 1][k - 1]} + ${T[n - 1][k]}  (노란 두 칸을 더해요)` };
  })();

  const showOpts = quest && !finished && !roundDone && opts.length > 0 && (mode === "sumq" || (sel.n >= 0 && hidden.has(key(sel.n, sel.k))));
  const goMode = (m: Mode) => (m === "blank" || m === "sumq" ? begin(m, rows) : (setMode(m), setSel(SEL), setMsg(null), setHidden(new Set())));

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="놀이 고르기">
        {MAIN.map((t) => (
          <GButton key={t.id} pressed={mode === t.id} className={BIG} onClick={() => goMode(t.id)}>{t.label}</GButton>
        ))}
        <GButton variant="soft" pressed={more} className={BIG} onClick={() => setMore((m) => !m)}>{more ? "접기 ▲" : "더 보기 ▼"}</GButton>
      </div>
      {more && (
        <div className="mt-2 rounded-card bg-bg p-3">
          <div className="flex flex-wrap gap-2">
            {MORE.map((t) => (
              <GButton key={t.id} pressed={mode === t.id} className={BIG} onClick={() => goMode(t.id)}>{t.label}</GButton>
            ))}
          </div>
          <div className="mt-2">
            <Slider
              label="줄 수"
              value={rows}
              min={5}
              max={12}
              show={(v) => `${v}줄`}
              onChange={(v) => {
                setRows(v);
                setSel(SEL);
                if (quest) begin(mode, v);
              }}
            />
            <p className="text-sm text-muted">줄이 많아지면 칸이 작아져요.</p>
          </div>
        </div>
      )}

      {quest && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Stat label="판" value={finished ? "끝" : `${round + 1} / 5`} />
          <Stat label="별" value={"⭐".repeat(Math.min(stars, 10)) || "0"} tone={stars ? "ok" : "plain"} />
        </div>
      )}

      <p className="mt-3 text-base font-semibold">{GUIDE[mode]}</p>

      <div className="mt-2 overflow-hidden rounded-card bg-bg p-1">
        <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: vw * 1.4, margin: "0 auto", display: "block", touchAction: "manipulation" }} role="group" aria-label="파스칼 삼각형 판">
          {sel.n >= 1 &&
            sel.n < rows &&
            [sel.k - 1, sel.k]
              .filter((k) => k >= 0 && k <= sel.n - 1)
              .map((k) => <line key={k} x1={cx(sel.n - 1, k)} y1={cy(sel.n - 1) + R - 3} x2={cx(sel.n, sel.k)} y2={cy(sel.n) - R + 3} stroke="#b45309" strokeWidth={2.4} strokeDasharray="4 3" />)}
          {T.map((row, n) => (
            <g key={n}>
              <text x={LM - 4} y={cy(n)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="var(--muted)">{n}</text>
              {row.map((v, k) => {
                const hid = mode === "blank" && hidden.has(key(n, k));
                const st = cellStyle(n, k, v);
                const label = hid ? "?" : String(v);
                const fs = hid ? 26 : label.length <= 2 ? 24 : label.length === 3 ? 19 : 15;
                return (
                  <g
                    key={k}
                    transform={`translate(${cx(n, k)},${cy(n)})`}
                    tabIndex={0}
                    role="button"
                    aria-label={hid ? `${n}줄 ${k + 1}번째 빈칸` : `${n}줄 ${k + 1}번째 칸 ${v}`}
                    style={{ cursor: "pointer", outline: "none" }}
                    onClick={() => tap(n, k)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        tap(n, k);
                      }
                    }}
                  >
                    {hid ? <circle r={R} fill="#fef3c7" stroke={isSel(n, k) ? "#dc2626" : "#b45309"} strokeWidth={isSel(n, k) ? 3.5 : 2.4} strokeDasharray="5 3" /> : <circle r={R} fill={st.fill} stroke={st.stroke} strokeWidth={isSel(n, k) ? 3.5 : 1.6} />}
                    <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={800} fill={hid ? "#92400e" : st.text}>{label}</text>
                  </g>
                );
              })}
              {mode === "rowsum" && (
                <text x={LM + W + 8} y={cy(n)} dominantBaseline="central" fontSize={18} fontWeight={800} fill="var(--accent)">
                  ={2 ** n}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 space-y-3">
        <Tip tone={info.t}>{info.s}</Tip>
        {showOpts && (
          <div>
            <p className="mb-1 text-base font-semibold">{mode === "blank" ? "? 칸에 들어갈 수는?" : `${sumRow}줄의 합은?`}</p>
            <div className="flex flex-wrap gap-2">
              {opts.map((o) => (
                <GButton key={o} variant="soft" disabled={wrong.includes(o)} className="min-h-[52px]! min-w-[72px] text-xl" onClick={() => pickAnswer(o)}>
                  {o}
                </GButton>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {quest && roundDone && !finished && <GButton variant="primary" className={BIG} onClick={nextRound}>{round >= 4 ? "결과 보기" : "다음 판"}</GButton>}
        {quest && <GButton className={BIG} onClick={() => begin(mode, rows)}>다시 하기</GButton>}
        {!quest && <GButton className={BIG} onClick={() => { setSel(SEL); setMsg(null); }}>선택 지우기</GButton>}
      </div>

      {mode === "diag" && (
        <div className="mt-2">
          <Slider label="줄 고르기" value={dN} min={0} max={rows - 1} onChange={setDiagN} />
        </div>
      )}
    </Board>
  );
}
