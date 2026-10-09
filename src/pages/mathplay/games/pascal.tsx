import { useMemo, useState } from "react";
import { Board, GButton, Say, Slider, Stat, rand } from "./kit";
import { fib, popcount, shallowDiagonal, triangle } from "./pascal.logic";

const CW = 44;
const RH = 40;
const R = 19;
const LM = 18;
const RM_SUM = 66;
type View = "basic" | "parity" | "mod3" | "rowsum" | "diag";
type Mode = View | "blank" | "sumq";
const TABS: { id: Mode; label: string }[] = [
  { id: "basic", label: "기본" },
  { id: "parity", label: "홀짝 색칠" },
  { id: "mod3", label: "3의 배수" },
  { id: "rowsum", label: "줄 합" },
  { id: "diag", label: "사선 합" },
  { id: "blank", label: "빈칸 채우기" },
  { id: "sumq", label: "이 줄의 합은?" },
];
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).split("").map((c) => SUP[+c]).join("");
const key = (n: number, k: number) => `${n},${k}`;
const SEL = { n: -1, k: -1 };

function pickHidden(rows: number, count = 3): Set<string> {
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

export default function PascalGame() {
  const [rows, setRows] = useState(8);
  const [mode, setMode] = useState<Mode>("basic");
  const [sel, setSel] = useState(SEL);
  const [diagN, setDiagN] = useState(6);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(0);
  const [ans, setAns] = useState("");
  const [sumRow, setSumRow] = useState(4);
  const [sumDone, setSumDone] = useState(false);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string } | null>(null);

  const T = useMemo(() => triangle(rows), [rows]);
  const quest = mode === "blank" || mode === "sumq";
  const roundDone = mode === "blank" ? hidden.size === 0 : sumDone;
  const finished = quest && round >= 5;
  const dN = Math.min(diagN, rows - 1);
  const diagCells = mode === "diag" ? shallowDiagonal(dN) : [];

  const begin = (md: Mode, rws: number) => {
    setMode(md);
    setSel(SEL);
    setAns("");
    setTries(0);
    setRound(0);
    setScore(0);
    setSumDone(false);
    setMsg(null);
    if (md === "blank") {
      const h = pickHidden(rws);
      setHidden(h);
      const f = [...h][0].split(",").map(Number);
      setSel({ n: f[0], k: f[1] });
      setMsg({ t: "info", s: "? 칸의 수를 윗줄 두 수의 합으로 구해서 적어 봐요." });
    } else {
      setHidden(new Set());
      if (md === "sumq") {
        setSumRow(3 + rand(rws - 3));
        setMsg({ t: "info", s: "표시된 줄의 수를 모두 더하면 얼마일까요?" });
      }
    }
  };
  const nextRound = () => {
    const r = round + 1;
    setRound(r);
    setAns("");
    setTries(0);
    setSumDone(false);
    if (r >= 5) {
      setMsg({ t: score >= (mode === "blank" ? 13 : 4) ? "ok" : "info", s: `끝! 점수는 ${score}점이에요. '다시 하기'로 도전해 봐요.` });
      setSel(SEL);
      return;
    }
    if (mode === "blank") {
      const h = pickHidden(rows);
      setHidden(h);
      const f = [...h][0].split(",").map(Number);
      setSel({ n: f[0], k: f[1] });
      setMsg({ t: "info", s: `${r + 1}번째 판이에요. ? 칸을 채워 봐요.` });
    } else {
      setSumRow(3 + rand(rows - 3));
      setMsg({ t: "info", s: `${r + 1}번째 판이에요. 표시된 줄의 합은?` });
    }
  };
  const submit = () => {
    const v = Number(ans.trim());
    if (!ans.trim() || !Number.isInteger(v)) {
      setMsg({ t: "bad", s: "정수로 적어 주세요." });
      return;
    }
    if (mode === "blank") {
      const { n, k } = sel;
      const k0 = key(n, k);
      if (!hidden.has(k0)) return;
      const truth = T[n][k];
      if (v === truth) {
        const h = new Set(hidden);
        h.delete(k0);
        setHidden(h);
        const add = tries === 0 ? 1 : 0;
        setScore((s) => s + add);
        setAns("");
        setTries(0);
        const rest = [...h][0];
        if (rest) {
          const f = rest.split(",").map(Number);
          setSel({ n: f[0], k: f[1] });
        }
        setMsg({
          t: "ok",
          s: `맞아요! ${T[n - 1][k - 1]} + ${T[n - 1][k]} = ${truth}.` + (h.size === 0 ? " 이번 판 완성! 다음 판으로 가요." : " 다음 ? 칸도 채워 봐요.") + (add ? " (+1점)" : " (두 번째부터는 점수 없음)"),
        });
      } else {
        setTries((x) => x + 1);
        setMsg({ t: "bad", s: `아직이에요. 이 칸의 윗줄 두 수는 ${T[n - 1][k - 1]} 와(과) ${T[n - 1][k]} 예요. 더해 봐요.` });
      }
    } else if (mode === "sumq") {
      const truth = T[sumRow].reduce((a, b) => a + b, 0);
      setSumDone(true);
      if (v === truth) {
        setScore((s) => s + 1);
        setMsg({ t: "ok", s: `맞아요! ${T[sumRow].join(" + ")} = ${truth} = 2${sup(sumRow)}. 줄 번호가 n이면 합은 2ⁿ이에요.` });
      } else setMsg({ t: "bad", s: `아쉬워요. ${T[sumRow].join(" + ")} = ${truth} = 2${sup(sumRow)} 이에요.` });
    }
  };

  const tap = (n: number, k: number) => {
    setSel({ n, k });
    if (!(mode === "blank")) setMsg(null);
  };

  // 칸 위치
  const W = rows * CW;
  const vw = LM + W + (mode === "rowsum" ? RM_SUM : 0);
  const vh = rows * RH + 6;
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
    if (inSumRow(n)) {
      fill = "#fde68a";
      stroke = "#b45309";
      text = "#1c1917";
    }
    if (mode === "diag" && inDiag(n, k)) {
      fill = "#34d399";
      stroke = "#047857";
      text = "#052e16";
    }
    if (isParent(n, k) && mode !== "sumq") {
      fill = "#fde68a";
      stroke = "#b45309";
      text = "#1c1917";
    }
    if (isSel(n, k)) stroke = "#dc2626";
    return { fill, stroke, text };
  };

  // 정보 문구
  const info = (() => {
    if (msg) return msg;
    const { n, k } = sel;
    const has = n >= 0;
    if (mode === "diag") {
      const parts = diagCells.map(([a, b]) => T[a][b]);
      return { t: "info" as const, s: `사선 ${dN}: ${parts.join(" + ")} = ${parts.reduce((a, b) => a + b, 0)} = 피보나치 수 F${dN + 1} = ${fib(dN + 1)}. 사선 번호를 바꿔 봐요.` };
    }
    if (mode === "rowsum") {
      if (!has) return { t: "info" as const, s: "칸을 누르면 그 줄의 합을 보여 줘요. 오른쪽에는 모든 줄의 합이 있어요." };
      const r = T[n];
      return { t: "info" as const, s: `${n}줄: ${r.join(" + ")} = ${r.reduce((a, b) => a + b, 0)} = 2${sup(n)}` };
    }
    if (mode === "parity") {
      if (!has) return { t: "info" as const, s: "홀수인 칸을 색칠했어요. 칸을 눌러 그 줄의 홀수 개수를 살펴봐요." };
      const odd = T[n].filter((x) => x % 2 === 1).length;
      return { t: "info" as const, s: `${n}줄: 홀수가 ${odd}개예요. ${n} 을(를) 2진수로 쓰면 ${n.toString(2)} 이고 1이 ${popcount(n)}개 → 2${sup(popcount(n))} = ${2 ** popcount(n)}개 (0~12줄에서 확인했어요).` };
    }
    if (mode === "mod3") {
      const cnt = T.flat().filter((x) => x % 3 === 0).length;
      return { t: "info" as const, s: `주황색은 3의 배수예요. ${rows}줄 안에서 모두 ${cnt}개예요. 칸을 눌러 윗줄 합도 확인해 봐요.` };
    }
    if (!has) return { t: "info" as const, s: "칸을 눌러 보세요. 그 칸의 윗줄 두 수와 합 식을 보여 줘요." };
    if (k === 0 || k === n) return { t: "info" as const, s: `${n}줄의 양 끝은 늘 1이에요.` };
    return { t: "info" as const, s: `C(${n},${k}) = C(${n - 1},${k - 1}) + C(${n - 1},${k}) = ${T[n - 1][k - 1]} + ${T[n - 1][k]} = ${T[n][k]}` };
  })();

  const needAnswer = (mode === "blank" && sel.n >= 0 && hidden.has(key(sel.n, sel.k)) && !finished) || (mode === "sumq" && !sumDone && !finished);

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="보기 방식">
        {TABS.map((t) => (
          <GButton key={t.id} pressed={mode === t.id} variant="ghost" className="px-3 text-sm" onClick={() => (t.id === "blank" || t.id === "sumq" ? begin(t.id, rows) : (setMode(t.id), setSel(SEL), setMsg(null), setHidden(new Set())))}>
            {t.label}
          </GButton>
        ))}
      </div>

      {quest && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Stat label="판" value={finished ? "끝" : `${round + 1} / 5`} />
          <Stat label="점수" value={score} tone={score ? "ok" : "plain"} />
          {mode === "blank" && <Stat label="남은 ?" value={hidden.size} />}
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-card bg-bg p-1">
        <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" style={{ maxWidth: vw * 1.5, margin: "0 auto", display: "block", touchAction: "manipulation" }} role="group" aria-label="파스칼 삼각형 판">
          {sel.n >= 1 &&
            sel.n < rows &&
            [sel.k - 1, sel.k]
              .filter((k) => k >= 0 && k <= sel.n - 1)
              .map((k) => <line key={k} x1={cx(sel.n - 1, k)} y1={cy(sel.n - 1, ) + R - 3} x2={cx(sel.n, sel.k)} y2={cy(sel.n) - R + 3} stroke="#b45309" strokeWidth={2} strokeDasharray="4 3" />)}
          {T.map((row, n) => (
            <g key={n}>
              <text x={LM - 6} y={cy(n)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="var(--muted)">{n}</text>
              {row.map((v, k) => {
                const hid = mode === "blank" && hidden.has(key(n, k));
                const st = cellStyle(n, k, v);
                const label = hid ? "?" : String(v);
                const fs = hid ? 16 : label.length <= 2 ? 15 : label.length === 3 ? 12.5 : 10;
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
                    {hid ? <rect x={-R} y={-R} width={2 * R} height={2 * R} rx={8} fill="#fef3c7" stroke={isSel(n, k) ? "#dc2626" : "#b45309"} strokeWidth={isSel(n, k) ? 3 : 2} strokeDasharray="4 3" /> : <circle r={R} fill={st.fill} stroke={st.stroke} strokeWidth={isSel(n, k) ? 3 : 1.5} />}
                    <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fontWeight={700} fill={hid ? "#92400e" : st.text}>{label}</text>
                  </g>
                );
              })}
              {mode === "rowsum" && (
                <text x={LM + W + 6} y={cy(n)} dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--accent)">
                  2{sup(n)}={2 ** n}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-3 space-y-2">
        <Say tone={info.t}>{info.s}</Say>
        {mode === "sumq" && !finished && <p className="text-lg font-extrabold">{sumRow}줄(노란 줄)의 모든 수의 합은?</p>}
      </div>

      {mode === "diag" && (
        <div className="mt-2">
          <Slider label="사선 번호" value={dN} min={0} max={rows - 1} onChange={setDiagN} />
        </div>
      )}

      {needAnswer && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex items-center gap-2 text-sm font-semibold">
            {mode === "blank" ? "? 칸의 수" : "합"}
            <input value={ans} onChange={(e) => setAns(e.target.value)} inputMode="numeric" aria-label="정답 입력" className="min-h-[44px] w-28 rounded-card border border-line bg-surface px-3 text-base tabular-nums" />
          </label>
          <GButton variant="primary" onClick={submit}>확인</GButton>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {quest && roundDone && !finished && <GButton variant="primary" onClick={nextRound}>{round >= 4 ? "결과 보기" : "다음 판"}</GButton>}
        {quest && <GButton onClick={() => begin(mode, rows)}>다시 하기</GButton>}
        {!quest && <GButton onClick={() => { setSel(SEL); setMsg(null); }}>선택 지우기</GButton>}
      </div>

      <div className="mt-3">
        <Slider
          label="줄 수"
          value={rows}
          min={mode === "blank" ? 5 : 4}
          max={12}
          show={(v) => `${v}줄`}
          onChange={(v) => {
            setRows(v);
            setSel(SEL);
            if (quest) begin(mode, v);
          }}
        />
        <p className="text-xs text-muted">화면이 좁으면 줄 수를 줄이면 숫자가 커져요. 0줄은 맨 위, 줄 번호는 왼쪽에 있어요.</p>
      </div>
    </Board>
  );
}
