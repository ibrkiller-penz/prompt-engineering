import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { Board, GButton, Slider, Stat, cheer, oops, rand, tick } from "./kit";
import { choices, shallowDiagonal, triangle } from "./pascal.logic";

const CW = 60;
const RH = 52;
const R = 27;
const LM = 14;
const RM_SUM = 64;
const BIG = "min-h-[48px]! px-3 text-base";
type Mode = "blank" | "sumq" | "parity" | "rowsum" | "basic" | "mod3" | "diag";
const MORE: { id: Mode; label: string }[] = [
  { id: "blank", label: "빈칸 채우기" },
  { id: "sumq", label: "줄 합 맞히기" },
  { id: "parity", label: "홀수 색칠" },
  { id: "rowsum", label: "줄 합 보기" },
  { id: "basic", label: "그냥 보기" },
  { id: "mod3", label: "3의 배수 색칠" },
  { id: "diag", label: "비스듬히 더하기" },
];
const GUIDE: Record<Mode, string> = {
  blank: "노란 두 수를 더하면 ? 가 돼요. 알맞은 풍선을 ? 칸으로 끌어다 놓아요.",
  sumq: "노란 줄의 수를 모두 더하면 얼마일까요?",
  parity: "홀수인 칸이 색칠돼요. 어떤 무늬가 보이나요? 칸을 눌러 봐요.",
  rowsum: "칸을 누르면 그 줄의 합이 나와요. 오른쪽에 모든 줄의 합이 있어요.",
  basic: "칸을 누르면 위의 두 수가 보여요. 두 수를 더하면 그 칸의 수가 돼요.",
  mod3: "3으로 나누어떨어지는 수(3의 배수)가 주황색이에요. 칸을 눌러 봐요.",
  diag: "초록색 칸을 모두 더해 봐요. 아래 막대로 줄을 바꿀 수 있어요.",
};
const key = (n: number, k: number) => `${n},${k}`;
type Pal = { top: string; base: string; edge: string; ink: string };
const ROWPAL: Pal[] = [
  { top: "#ffe0ef", base: "#f9a8d4", edge: "#db2777", ink: "#831843" },
  { top: "#ffe8cc", base: "#fdba74", edge: "#ea580c", ink: "#7c2d12" },
  { top: "#ecfccb", base: "#bef264", edge: "#65a30d", ink: "#365314" },
  { top: "#dcfce7", base: "#86efac", edge: "#16a34a", ink: "#14532d" },
  { top: "#d5f7fd", base: "#67e8f9", edge: "#0891b2", ink: "#164e63" },
  { top: "#e3e7ff", base: "#a5b4fc", edge: "#4f46e5", ink: "#312e81" },
  { top: "#efe7ff", base: "#c4b5fd", edge: "#7c3aed", ink: "#4c1d95" },
];
const PAL: Record<string, Pal> = {
  cream: { top: "#fffdf7", base: "#fbeedb", edge: "#d9b98a", ink: "#8a6a45" },
  purple: { top: "#c4b5fd", base: "#8b5cf6", edge: "#5b21b6", ink: "#ffffff" },
  orange: { top: "#fed7aa", base: "#fb923c", edge: "#c2410c", ink: "#431407" },
  gold: { top: "#fff7ae", base: "#facc15", edge: "#a16207", ink: "#422006" },
  green: { top: "#bbf7d0", base: "#34d399", edge: "#047857", ink: "#052e16" },
};
const ALLPAL: [string, Pal][] = [...ROWPAL.map((p, i) => [`r${i}`, p] as [string, Pal]), ...Object.entries(PAL)];
const BALLOON = ["#f43f5e", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4"];
const FONT = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
const BW = CW - 6;
const BH = RH - 6;
const FLOOR = 30;
const SEL = { n: -1, k: -1 };
type Msg = { t: "info" | "ok" | "bad"; s: ReactNode };

function Tip({ tone = "info", children }: { tone?: Msg["t"]; children: ReactNode }) {
  const c = tone === "ok" ? "bg-ok-soft text-ok border-ok/30" : tone === "bad" ? "bg-bad-soft text-bad border-bad/30 pa-shake" : "bg-accent-soft text-ink border-accent/20";
  return (
    <p key={tone + String(children).length} className={`rounded-2xl border-2 px-4 py-3 text-lg leading-relaxed shadow-[0_3px_0_0_rgba(0,0,0,0.06)] font-game ${c}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

const CSS = `
@keyframes pa-flow{to{stroke-dashoffset:-14}}
@keyframes pa-pop{0%{transform:scale(.6)}55%{transform:scale(1.35)}100%{transform:scale(1)}}
@keyframes pa-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes pa-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-4deg)}40%{transform:translateX(6px) rotate(4deg)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes pa-spark{0%{opacity:0;transform:scale(.2)}40%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(.8) translateY(-14px)}}
@keyframes pa-wob{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes pa-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
.pa-shake{animation:pa-shake .45s ease-in-out;transform-box:fill-box;transform-origin:center}
.pa-spark{animation:pa-spark 1s ease-out both;transform-box:fill-box;transform-origin:center}
.pa-wob{animation:pa-wob 1.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.pa-flowbadge{animation:pa-bob 1s ease-in-out infinite}
.pa-sway{animation:pa-sway 2.2s ease-in-out infinite;transform-origin:50% 100%}
.pa-flow{animation:pa-flow .7s linear infinite}
.pa-pop{animation:pa-pop .5s ease-out;transform-box:fill-box;transform-origin:center}
.pa-bob{display:inline-block;animation:pa-bob 1s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.pa-flow,.pa-pop,.pa-bob,.pa-shake,.pa-spark,.pa-wob,.pa-sway,.pa-flowbadge{animation:none!important}}
`;

/** 진짜 풍선 모양: 반사광, 매듭, 줄 */
function Balloon({ v, color }: { v: number; color: string }) {
  return (
    <>
      <span
        className="font-game relative flex h-[68px] w-[60px] items-center justify-center rounded-[50%] text-[1.7rem] text-white"
        style={{
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.85) 0 9%, transparent 10%), radial-gradient(circle at 40% 35%, color-mix(in srgb, ${color} 55%, white), ${color} 60%, color-mix(in srgb, ${color} 75%, black))`,
          boxShadow: `inset -4px -6px 0 rgba(0,0,0,.12), 0 4px 0 color-mix(in srgb, ${color} 60%, black)`,
          textShadow: "0 2px 0 rgba(0,0,0,.3)",
        }}
      >
        {v}
      </span>
      <span className="-mt-[2px] h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent" style={{ borderBottomColor: color }} />
      <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
        <path d="M6 0 C 1 5, 11 10, 6 20" stroke="#94a3b8" strokeWidth="1.6" fill="none" />
      </svg>
    </>
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
  const h = pickHidden(6, 1);
  const f = [...h][0].split(",").map(Number);
  return { h, sel: { n: f[0], k: f[1] }, opts: choices(t[f[0]][f[1]], [t[f[0] - 1][f[1] - 1], t[f[0] - 1][f[1]]]) };
}

export default function PascalGame() {
  const [init] = useState(initial);
  const [rows, setRows] = useState(6);
  const [mode, setMode] = useState<Mode>("blank");
  const [more, setMore] = useState(false);
  const [popCell, setPopCell] = useState("");
  const [shake, setShake] = useState({ k: "", n: 0 });
  const [drag, setDrag] = useState<null | { v: number; x: number; y: number }>(null);
  const dragStart = useRef({ x: 0, y: 0, moved: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(360);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCw(el.clientWidth));
    ro.observe(el);
    setCw(el.clientWidth);
    return () => ro.disconnect();
  }, []);
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
  useEffect(() => {
    if (!quest || !roundDone || finished) return;
    const id = setTimeout(nextRound, mode === "blank" ? 1700 : 2600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest, roundDone, finished, round, mode]);
  const dN = Math.min(diagN, rows - 1);
  const diagCells = mode === "diag" ? shallowDiagonal(dN) : [];

  const blankOpts = (n: number, k: number) => setOpts(choices(T[n][k], [T[n - 1][k - 1], T[n - 1][k]]));
  const setupBlank = (rws: number, t = triangle(rws), r = 0) => {
    const h = pickHidden(rws, r < 2 ? 1 : 2);
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
    if (md === "blank") setupBlank(rws, undefined, 0);
    else if (md === "sumq") setupSum(rws);
  };
  const nextRound = () => {
    const r = round + 1;
    setRound(r);
    if (r >= 5) {
      setSel(SEL);
      setMsg({ t: "ok", s: `끝까지 해냈어요! ⭐ ${stars}개를 모았어요. 정말 잘했어요!` });
      cheer();
      return;
    }
    setMsg({ t: "info", s: `${r + 1}번째 판이에요. 해 봐요!` });
    if (mode === "blank") setupBlank(rows, T, r);
    else setupSum(rows, T);
  };
  const pickAnswer = (v: number, cell?: { n: number; k: number }) => {
    if (mode === "blank") {
      const { n, k } = cell ?? sel;
      if (!hidden.has(key(n, k))) return;
      const truth = T[n][k];
      if (cell && (cell.n !== sel.n || cell.k !== sel.k) && v !== truth) {
        setSel(cell);
        blankOpts(n, k);
        setWrong([]);
        oops();
        setShake((x) => ({ k: key(n, k), n: x.n + 1 }));
        setMsg({ t: "bad", s: `괜찮아요! 이 칸은 ${T[n - 1][k - 1]} + ${T[n - 1][k]} 예요. 다른 풍선을 놓아 봐요.` });
        return;
      }
      if (v === truth) {
        setPopCell(key(n, k));
        if (hidden.size === 1) cheer();
        else tick();
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
        oops();
        setShake((x) => ({ k: key(n, k), n: x.n + 1 }));
        setMsg({ t: "bad", s: `괜찮아요, 다시 해 봐요! 노란 두 칸은 ${T[n - 1][k - 1]} 와(과) ${T[n - 1][k]} 예요. 두 수를 더해요.` });
      }
    } else if (mode === "sumq") {
      const truth = 2 ** sumRow;
      if (v === truth) {
        const first = wrong.length === 0;
        if (first) setStars((s) => s + 1);
        setSumDone(true);
        cheer();
        setMsg({ t: "ok", s: `${first ? "⭐ " : ""}맞아요! ${T[sumRow].join(" + ")} = ${truth}` });
      } else {
        setWrong((w) => [...w, v]);
        oops();
        setMsg({ t: "bad", s: `괜찮아요, 다시 해 봐요! ${T[sumRow].join(" + ")} 를 차례로 더해 봐요.` });
      }
    }
  };

  const tap = (n: number, k: number) => {
    tick();
    if (mode === "blank") {
      if (hidden.has(key(n, k))) {
        setSel({ n, k });
        blankOpts(n, k);
        setWrong([]);
        setMsg({ t: "info", s: "노란 두 수를 더한 풍선을 ? 칸에 놓아요." });
      } else {
        setSel({ n, k });
        setMsg(null);
      }
      return;
    }
    setSel({ n, k });
    if (mode !== "sumq") setMsg(null);
  };

  const cellScreen = (n: number, k: number) => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    return { x: m.a * cx(n, k) + m.e, y: m.d * cy(n) + m.f, r: Math.abs(m.a) * R };
  };
  const balloonDown = (e: RPointerEvent<HTMLButtonElement>, v: number) => {
    if (wrong.includes(v)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, moved: false };
    setDrag({ v, x: e.clientX, y: e.clientY });
  };
  const balloonMove = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y) > 10) dragStart.current.moved = true;
    setDrag({ v: drag.v, x: e.clientX, y: e.clientY });
  };
  const balloonUp = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const v = drag.v;
    setDrag(null);
    let target: { n: number; k: number } | undefined;
    if (dragStart.current.moved) {
      let best = Infinity;
      for (const h of hidden) {
        const [n, k] = h.split(",").map(Number);
        const c = cellScreen(n, k);
        if (!c) continue;
        const d = Math.hypot(e.clientX - c.x, e.clientY - 24 - c.y);
        if (d < c.r * 1.6 && d < best) {
          best = d;
          target = { n, k };
        }
      }
      if (!target) return; // 엉뚱한 곳에 놓으면 풍선은 제자리로
    }
    pickAnswer(v, target);
  };

  const W = rows * CW;
  const vw = LM + W + (mode === "rowsum" ? RM_SUM : 0);
  const vh = (rows - 1) * RH + 2 * R + 8 + FLOOR;
  // 넓은 화면에서는 배경을 옆으로 넓혀 판을 꽉 채운다
  const VBW = Math.max(vw, cw / 1.15);
  const EXT = (VBW - vw) / 2;
  const cx = (n: number, k: number) => LM + W / 2 + (k - n / 2) * CW;
  const cy = (n: number) => R + 4 + n * RH;

  const isSel = (n: number, k: number) => sel.n === n && sel.k === k;
  const isParent = (n: number, k: number) => sel.n >= 1 && n === sel.n - 1 && (k === sel.k - 1 || k === sel.k) && k >= 0 && k <= n;
  const inDiag = (n: number, k: number) => diagCells.some(([a, b]) => a === n && b === k);
  const inSumRow = (n: number) => (mode === "sumq" ? n === sumRow : mode === "rowsum" ? n === sel.n : false);

  const cellPal = (n: number, k: number, v: number): string => {
    if (mode === "diag" && inDiag(n, k)) return "green";
    if (inSumRow(n) || (isParent(n, k) && mode !== "sumq")) return "gold";
    if (mode === "parity") return v % 2 === 1 ? "purple" : "cream";
    if (mode === "mod3") return v % 3 === 0 ? "orange" : "cream";
    if (mode === "diag") return "cream";
    return `r${n % ROWPAL.length}`;
  };
  const palOf = (id: string): Pal => (id.startsWith("r") ? ROWPAL[+id.slice(1)] : PAL[id]);

  const info = ((): Msg => {
    if (msg) return msg;
    const { n, k } = sel;
    const has = n >= 0;
    if (mode === "blank") return { t: "info", s: hidden.size ? "노란 두 칸을 더한 수예요. 풍선을 ? 칸에 놓아요." : "잘했어요! 곧 다음 판이 나와요." };
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
      <style>{CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        {quest && (
          <>
            <Stat label="판" value={finished ? "끝" : `${round + 1} / 5`} />
            <Stat label="별" value={"⭐".repeat(Math.min(stars, 10)) || "0"} tone={stars ? "ok" : "plain"} />
          </>
        )}
        <GButton variant="soft" pressed={more} className={`${BIG} ml-auto`} onClick={() => setMore((m) => !m)}>🔥 더 어려운 도전 {more ? "▲" : "▼"}</GButton>
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

      <p className="font-game mt-3 text-lg text-ink">{GUIDE[mode]}</p>

      <div ref={wrapRef} className="mt-2 overflow-hidden rounded-3xl border-4 border-white shadow-[0_6px_0_0_rgba(0,0,0,0.06),0_10px_24px_rgba(124,58,237,0.12)]">
        <svg ref={svgRef} viewBox={`${-EXT} 0 ${VBW} ${vh}`} width="100%" style={{ display: "block", touchAction: "manipulation" }} role="group" aria-label="파스칼 삼각형 블록 판">
          <defs>
            <linearGradient id="pa-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fdf4ff" />
              <stop offset="1" stopColor="#ede9fe" />
            </linearGradient>
            <linearGradient id="pa-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6c48a" />
              <stop offset="1" stopColor="#d9955a" />
            </linearGradient>
            <pattern id="pa-dots" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="6" cy="6" r="2.4" fill="#e9d5ff" />
              <circle cx="20" cy="20" r="2" fill="#fbcfe8" />
            </pattern>
            {ALLPAL.map(([id, p]) => (
              <linearGradient key={id} id={`pa-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={p.top} />
                <stop offset="1" stopColor={p.base} />
              </linearGradient>
            ))}
          </defs>
          <rect x={-EXT} width={VBW} height={vh} fill="url(#pa-sky)" />
          <rect x={-EXT} width={VBW} height={vh - FLOOR} fill="url(#pa-dots)" />
          <rect x={-EXT} y={vh - FLOOR} width={VBW} height={FLOOR} fill="url(#pa-wood)" />
          <rect x={-EXT} y={vh - FLOOR} width={VBW} height={4} fill="#b9773f" opacity={0.55} />
          <ellipse cx={LM + W / 2} cy={vh - FLOOR + 3} rx={W / 2 + 6} ry={6} fill="#000" opacity={0.08} />
          {T.map((row, n) => (
            <g key={n}>
              <text x={LM - 4} y={cy(n)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="#a78bfa" style={FONT}>{n}</text>
              {row.map((v, k) => {
                const hid = mode === "blank" && hidden.has(key(n, k));
                const pid = cellPal(n, k, v);
                const pl = palOf(pid);
                const label = hid ? "?" : String(v);
                const fs = hid ? 30 : label.length <= 2 ? 27 : label.length === 3 ? 21 : 16;
                const selected = isSel(n, k);
                const popped = popCell === key(n, k) && !hid;
                const shaking = hid && shake.k === key(n, k);
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
                    <g key={shaking ? `s${shake.n}` : "n"} className={popped ? "pa-pop" : shaking ? "pa-shake" : undefined}>
                      {hid ? (
                        <>
                          <rect x={-BW / 2} y={-BH / 2 + 4} width={BW} height={BH} rx={13} fill="#000" opacity={0.08} />
                          <rect x={-BW / 2} y={-BH / 2} width={BW} height={BH} rx={13} fill="#ffffff" stroke={selected ? "#f59e0b" : "#c4b5fd"} strokeWidth={selected ? 4 : 3} strokeDasharray="7 5" />
                          <text textAnchor="middle" dominantBaseline="central" fontSize={fs} fill="#7c3aed" className="pa-wob" style={FONT}>?</text>
                        </>
                      ) : (
                        <>
                          <rect x={-BW / 2} y={-BH / 2 + 4} width={BW} height={BH} rx={13} fill={pl.edge} />
                          <rect x={-BW / 2} y={-BH / 2} width={BW} height={BH} rx={13} fill={`url(#pa-${pid})`} stroke={pl.edge} strokeWidth={2.2} />
                          <rect x={-BW / 2 + 7} y={-BH / 2 + 5} width={BW - 22} height={6} rx={3} fill="#fff" opacity={0.6} />
                          {pid === "gold" && isParent(n, k) && <rect x={-BW / 2 - 4} y={-BH / 2 - 4} width={BW + 8} height={BH + 12} rx={16} fill="none" stroke="#fbbf24" strokeWidth={3} strokeDasharray="5 4" className="pa-flow" />}
                          {selected && <rect x={-BW / 2 - 4} y={-BH / 2 - 4} width={BW + 8} height={BH + 12} rx={16} fill="none" stroke="#fbbf24" strokeWidth={3.5} />}
                          <text textAnchor="middle" dominantBaseline="central" y={1} fontSize={fs} fill={pl.ink} style={FONT}>{label}</text>
                        </>
                      )}
                    </g>
                    {popped && (
                      <g style={{ pointerEvents: "none" }}>
                        {[[-30, -26], [30, -22], [0, -36]].map(([dx, dy], i) => (
                          <text key={i} x={dx} y={dy} fontSize={16} textAnchor="middle" className="pa-spark" style={{ animationDelay: `${i * 0.12}s` }}>✨</text>
                        ))}
                      </g>
                    )}
                  </g>
                );
              })}
              {mode === "rowsum" && (
                <text x={LM + W + 8} y={cy(n)} dominantBaseline="central" fontSize={20} fill="#7c3aed" style={FONT}>
                  ={2 ** n}
                </text>
              )}
            </g>
          ))}
          {sel.n >= 2 && sel.n < rows && sel.k >= 1 && sel.k <= sel.n - 1 && (
            <g transform={`translate(${cx(sel.n, sel.k)},${cy(sel.n - 1) + BH / 2 + 2})`} style={{ pointerEvents: "none" }}><g className="pa-flowbadge">
              <path d="M-7 8 L7 8 L0 17 Z" fill="#f59e0b" stroke="#b45309" strokeWidth={1.5} strokeLinejoin="round" />
              <circle r={12} fill="#fde047" stroke="#b45309" strokeWidth={2.5} />
              <text textAnchor="middle" dominantBaseline="central" y={1} fontSize={20} fill="#92400e" style={FONT}>+</text>
            </g></g>
          )}
        </svg>
      </div>

      <div className="mt-3 space-y-3">
        {showOpts && mode === "blank" && (
          <div>
            <p className="font-game mb-1 text-lg text-ink">
              <span className="pa-bob" aria-hidden>👆</span> 풍선을 ? 칸에 끌어다 놓아요 (톡 눌러도 돼요)
            </p>
            <div className="flex flex-wrap items-start gap-4 rounded-2xl bg-gradient-to-b from-sky-100 to-sky-50 px-3 pb-2 pt-3">
              {opts.map((o, i) => (
                <button
                  key={o}
                  type="button"
                  aria-label={`${o} 풍선`}
                  disabled={wrong.includes(o)}
                  onPointerDown={(e) => balloonDown(e, o)}
                  onPointerMove={balloonMove}
                  onPointerUp={balloonUp}
                  onPointerCancel={() => setDrag(null)}
                  className="pa-sway relative flex h-[92px] w-16 select-none flex-col items-center disabled:opacity-25"
                  style={{ touchAction: "none", opacity: drag?.v === o ? 0.3 : undefined, animationDelay: `${i * 0.3}s` }}
                >
                  <Balloon v={o} color={BALLOON[i % BALLOON.length]} />
                </button>
              ))}
            </div>
          </div>
        )}
        {showOpts && mode === "sumq" && (
          <div>
            <p className="mb-1 text-base font-semibold">{sumRow}줄의 합은?</p>
            <div className="flex flex-wrap gap-2">
              {opts.map((o) => (
                <GButton key={o} variant="soft" disabled={wrong.includes(o)} className="min-h-[56px]! min-w-[72px] text-xl" onClick={() => pickAnswer(o)}>
                  {o}
                </GButton>
              ))}
            </div>
          </div>
        )}
        <Tip tone={info.t}>{info.s}</Tip>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {quest && roundDone && !finished && <GButton variant="primary" className={BIG} onClick={nextRound}>{round >= 4 ? "끝내기 ▶" : "다음 판 ▶"}</GButton>}
        {quest && <GButton className={BIG} onClick={() => begin(mode, rows)}>다시 하기</GButton>}
        {!quest && <GButton className={BIG} onClick={() => { setSel(SEL); setMsg(null); }}>선택 지우기</GButton>}
      </div>

      {mode === "diag" && (
        <div className="mt-2">
          <Slider label="줄 고르기" value={dN} min={0} max={rows - 1} onChange={setDiagN} />
        </div>
      )}
      {drag && (
        <div className="pointer-events-none fixed z-[70] flex w-16 flex-col items-center drop-shadow-xl" style={{ left: drag.x - 32, top: drag.y - 56 }}>
          <Balloon v={drag.v} color={BALLOON[Math.max(0, opts.indexOf(drag.v)) % BALLOON.length]} />
        </div>
      )}
    </Board>
  );
}
