import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, stageClear, tick, useStage } from "./kit";

// ==PURE-START==
export type Parsed = { names: string[]; cells: number[][]; adj: boolean[][] };

/** 격자 문자열 → 영역 목록·칸 번호·이웃 관계. '.' 은 바다(칠하지 않음). */
export function parseMap(rows: string[]): Parsed {
  const names = Array.from(new Set(rows.join("").split("").filter((c) => c !== "."))).sort();
  const cells = rows.map((r) => r.split("").map((c) => (c === "." ? -1 : names.indexOf(c))));
  const n = names.length;
  const adj = Array.from({ length: n }, () => Array<boolean>(n).fill(false));
  const H = rows.length;
  const W = rows[0].length;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = cells[y][x];
      if (a < 0) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= W || yy >= H) continue;
        const b = cells[yy][xx];
        if (b >= 0 && b !== a) {
          adj[a][b] = true;
          adj[b][a] = true;
        }
      }
    }
  return { names, cells, adj };
}

/** k가지 색으로 칠할 수 있으면 한 가지 칠하기를, 아니면 null (완전탐색) */
export function colorable(adj: boolean[][], k: number): number[] | null {
  const n = adj.length;
  const col = Array<number>(n).fill(-1);
  const go = (i: number): boolean => {
    if (i === n) return true;
    for (let c = 0; c < k; c++) {
      if (adj[i].some((v, j) => v && col[j] === c)) continue;
      col[i] = c;
      if (go(i + 1)) return true;
      col[i] = -1;
    }
    return false;
  };
  return go(0) ? col : null;
}

/** 꼭 필요한 최소 색의 수 */
export function chromatic(adj: boolean[][]): number {
  for (let k = 1; ; k++) if (colorable(adj, k)) return k;
}

/** 이웃인데 같은 색으로 칠해진 영역 번호들 */
export function conflicts(adj: boolean[][], colors: (number | null)[]): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < adj.length; i++)
    for (let j = i + 1; j < adj.length; j++) if (adj[i][j] && colors[i] !== null && colors[i] === colors[j]) {
      s.add(i);
      s.add(j);
    }
  return s;
}
/** 이미 칠한 칸(fixed, null=아직)을 그대로 두고 k색으로 나머지를 칠할 수 있으면 전체 칠하기를, 아니면 null */
export function solveFrom(adj: boolean[][], k: number, fixed: (number | null)[]): number[] | null {
  const n = adj.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (adj[i][j] && fixed[i] !== null && fixed[i] === fixed[j]) return null;
  const col: (number | null)[] = fixed.slice();
  const go = (i: number): boolean => {
    if (i === n) return true;
    if (fixed[i] !== null) return go(i + 1);
    for (let c = 0; c < k; c++) {
      if (adj[i].some((v, j) => v && col[j] === c)) continue;
      col[i] = c;
      if (go(i + 1)) return true;
      col[i] = null;
    }
    return false;
  };
  return go(0) ? (col as number[]) : null;
}
/** 나라 n개짜리 무작위 지도 (W×H 칸). 씨앗에서 무작위로 넓혀 가서 나라마다 한 덩어리가 돼요. */
export function genMap(n: number, rnd: () => number = Math.random, W = 12, H = 8, minSize = Math.min(5, Math.floor((W * H) / (2 * n)))): string[] {
  for (let tries = 0; tries < 500; tries++) {
    const g: number[] = Array(W * H).fill(-1);
    const front: [number, number][] = [];
    const cells = Array.from({ length: W * H }, (_, i) => i);
    for (let r = 0; r < n; r++) {
      const k = r + Math.floor(rnd() * (cells.length - r));
      [cells[r], cells[k]] = [cells[k], cells[r]];
      g[cells[r]] = r;
      front.push([cells[r], r]);
    }
    while (front.length) {
      const k = Math.floor(rnd() * front.length);
      const [c, r] = front[k];
      const x = c % W;
      const y = Math.floor(c / W);
      const nb = [x > 0 ? c - 1 : -1, x < W - 1 ? c + 1 : -1, y > 0 ? c - W : -1, y < H - 1 ? c + W : -1].filter((v) => v >= 0 && g[v] === -1);
      if (!nb.length) {
        front.splice(k, 1);
        continue;
      }
      const t = nb[Math.floor(rnd() * nb.length)];
      g[t] = r;
      front.push([t, r]);
    }
    const size = Array(n).fill(0);
    g.forEach((r) => size[r]++);
    if (size.some((v) => v < minSize)) continue;
    const L = "ABCDEFGHIJKLMNOP";
    return Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => L[g[y * W + x]]).join(""));
  }
  if (minSize > 1) return genMap(n, rnd, W, H, minSize - 1);
  throw new Error("지도를 못 만들었어요");
}
/** 레벨별 나라 수 */
export const LEVEL_N = [5, 6, 7, 8, 9, 10, 10, 11, 12, 12];
/** 레벨 문제: 지도와 쓸 수 있는 색 수. 레벨 1~6은 4색(언제나 충분), 레벨 7부터는 꼭 필요한 최소 색만 줘요. */
export function levelPuzzle(level: number, rnd: () => number = Math.random): { rows: string[]; ncol: number; chi: number } {
  const L = Math.min(10, Math.max(1, level));
  let best: { rows: string[]; chi: number } | null = null;
  for (let t = 0; t < 60; t++) {
    const rows = genMap(LEVEL_N[L - 1], rnd);
    const chi = chromatic(parseMap(rows).adj);
    if (L <= 6 || !best || chi > best.chi) best = { rows, chi };
    if (L <= 6) break;
    if (L <= 8 ? chi >= 3 : chi >= 4) break;
  }
  return { rows: best!.rows, ncol: L <= 6 ? 4 : Math.max(3, best!.chi), chi: best!.chi };
}
// ==PURE-END==

const PALETTE = [
  { fill: "#fde047", dark: "#ca8a04", name: "노랑" },
  { fill: "#60a5fa", dark: "#1d4ed8", name: "파랑" },
  { fill: "#4ade80", dark: "#15803d", name: "초록" },
  { fill: "#fb923c", dark: "#c2410c", name: "주황" },
  { fill: "#c084fc", dark: "#7e22ce", name: "보라" },
];
const REDUCE = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const JUA = { fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" };

/** 나라마다 붙는 작은 그림 (집 또는 나무), 가운데가 0,0 */
function Icon({ kind }: { kind: number }) {
  if (kind % 3 === 0)
    return (
      <g>
        <rect x="-9" y="-4" width="18" height="13" rx="2" fill="#fff7ed" stroke="#7c2d12" strokeWidth="2" />
        <path d="M -12 -3 L 0 -13 L 12 -3 Z" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" strokeLinejoin="round" />
        <rect x="-3" y="2" width="6" height="7" fill="#92400e" />
      </g>
    );
  if (kind % 3 === 1)
    return (
      <g>
        <rect x="-2.5" y="2" width="5" height="9" rx="1.5" fill="#92400e" />
        <circle cx="0" cy="-3" r="9" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
        <circle cx="-3" cy="-6" r="3" fill="#86efac" />
      </g>
    );
  return (
    <g>
      <path d="M -11 9 L -3 -8 L 2 1 L 5 -4 L 12 9 Z" fill="#a8a29e" stroke="#44403c" strokeWidth="2" strokeLinejoin="round" />
      <path d="M -5 -4 L -3 -8 L -1 -4 Z" fill="#fff" />
    </g>
  );
}
const CELL = 40;

type Edge = { x1: number; y1: number; x2: number; y2: number; a: number; b: number };

function buildGeometry(rows: string[]) {
  const p = parseMap(rows);
  const H = rows.length;
  const W = rows[0].length;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -2 : p.cells[y][x]);
  const edges: Edge[] = [];
  for (let y = 0; y <= H; y++)
    for (let x = 0; x <= W; x++) {
      if (x < W) {
        const a = at(x, y - 1);
        const b = at(x, y);
        if (a !== b) edges.push({ x1: x * CELL, y1: y * CELL, x2: (x + 1) * CELL, y2: y * CELL, a, b });
      }
      if (y < H) {
        const a = at(x - 1, y);
        const b = at(x, y);
        if (a !== b) edges.push({ x1: x * CELL, y1: y * CELL, x2: x * CELL, y2: (y + 1) * CELL, a, b });
      }
    }
  const labels = p.names.map((_, r) => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.cells[y][x] === r) { sx += x + 0.5; sy += y + 0.5; n++; }
    const cx = sx / n;
    const cy = sy / n;
    // 라벨(아이콘·원·이름)이 차지하는 상자 전체가 같은 나라 안에 들어가는 칸을 고른다.
    // 상자: 아이콘(왼쪽)과 원·이름(오른쪽)을 나란히 둔 가로 약 −30~+24px, 세로 약 −14~+14px(CELL=40px).
    // 그런 칸이 여럿이면 경계에서 가장 먼 칸, 같으면 무게중심에 가까운 칸.
    const inside = (px: number, py: number) => {
      const ix = Math.floor(px);
      const iy = Math.floor(py);
      return ix >= 0 && iy >= 0 && ix < W && iy < H && p.cells[iy][ix] === r;
    };
    let best: [number, number] = [0, 0];
    let bestScore = -1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.cells[y][x] === r) {
      const ax = x + 0.5;
      const ay = y + 0.5;
      let miss = 0;
      for (let sx = -0.75; sx <= 0.651; sx += 0.1) for (let sy = -0.4; sy <= 0.401; sy += 0.1) {
        if (!inside(ax + sx, ay + sy)) miss++;
      }
      let dEdge = Math.min(x + 0.5, W - x - 0.5, y + 0.5, H - y - 0.5) ** 2;
      for (let y2 = 0; y2 < H; y2++) for (let x2 = 0; x2 < W; x2++) {
        if (p.cells[y2][x2] !== r) dEdge = Math.min(dEdge, (ax - x2 - 0.5) ** 2 + (ay - y2 - 0.5) ** 2);
      }
      const dC = (ax - cx) ** 2 + (ay - cy) ** 2;
      const score = -miss * 100 + dEdge - 0.01 * dC;
      if (score > bestScore) { bestScore = score; best = [ax, ay]; }
    }
    return best;
  });
  return { p, W, H, edges, labels, chi: chromatic(p.adj), canThree: !!colorable(p.adj, 3) };
}

type Msg = { tone: "info" | "ok" | "bad"; text: string };
const BIG = "min-h-[48px]! text-base";
const ROUNDS = 3;

export default function MapColorGame() {
  const level = useStage();
  const [puz, setPuz] = useState(() => levelPuzzle(level));
  const [round, setRound] = useState(1);
  const ncol = puz.ncol;
  const [brush, setBrush] = useState<number | null>(null); // null = 톡 누르면 색이 바뀜, -1 = 지우개
  const [colors, setColors] = useState<(number | null)[]>([]);
  const [hintR, setHintR] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [splash, setSplash] = useState<{ r: number; c: number; k: number } | null>(null);
  const [shake, setShake] = useState(false);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "나라를 톡 누를 때마다 색이 바뀌어요. 붙은 나라는 다른 색으로!" });

  const geo = useMemo(() => buildGeometry(puz.rows), [puz]);
  const { p, W, H } = geo;
  const n = p.names.length;
  const cur: (number | null)[] = colors.length === n ? colors : Array<number | null>(n).fill(null);
  const bad = conflicts(p.adj, cur);
  const painted = cur.filter((c) => c !== null).length;
  const usedColors = new Set(cur.filter((c) => c !== null)).size;
  const full = painted === n;

  // 끌면서 칠할 때 최신 값을 쓰기 위한 참조
  const live = useRef({ cur, n, p, geo, ncol, brush, round });
  live.current = { cur, n, p, geo, ncol, brush, round };
  const colorsRef = useRef<(number | null)[]>(cur);
  colorsRef.current = cur;
  const lock = useRef(false);
  const timer = useRef(0);
  const drag = useRef<{ last: number | null; start: number | null; moved: boolean } | null>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const apply = (next: (number | null)[]) => {
    const L = live.current;
    const before = conflicts(L.p.adj, colorsRef.current).size;
    colorsRef.current = next;
    setColors(next);
    setHintR(null);
    setTouched(true);
    const cf = conflicts(L.p.adj, next);
    const pc = next.filter((c) => c !== null).length;
    if (cf.size > before) {
      oops();
      setShake(true);
      window.setTimeout(() => setShake(false), 450);
    } else tick();
    if (pc < L.n) {
      setMsg(cf.size ? { tone: "bad", text: "앗, 붙어 있는 나라가 같은 색이에요. 빨간 테두리를 다른 색으로 바꿔 봐요." } : { tone: "info", text: `좋아요! ${pc}/${L.n}개 칠했어요.` });
      return;
    }
    if (cf.size === 0) {
      const k = new Set(next).size;
      lock.current = true;
      cheer();
      if (L.round >= ROUNDS) {
        setMsg({ tone: "ok", text: `⭐ 대단해요! 레벨 ${level}의 지도를 모두 칠했어요!` });
        timer.current = window.setTimeout(() => stageClear(), 1200);
        return;
      }
      setMsg({ tone: "ok", text: k <= L.geo.chi ? `⭐ 대단해요! ${k}색으로 다 칠했어요! 곧 다음 지도가 나와요.` : `⭐ 성공! ${k}색으로 칠했어요. (이 지도는 ${L.geo.chi}색으로도 돼요) 곧 다음 지도가 나와요.` });
      timer.current = window.setTimeout(() => {
        lock.current = false;
        colorsRef.current = [];
        setColors([]);
        setSplash(null);
        setRound((r) => r + 1);
        setPuz(levelPuzzle(level));
        setBrush(null);
        setMsg({ tone: "info", text: "새 지도예요! 나라를 톡 눌러 칠해 봐요." });
      }, 2300);
    } else if (L.ncol < L.geo.chi) {
      setMsg({ tone: "bad", text: `아깝다! 사실 이 지도는 ${L.ncol}색으로는 칠할 수 없어요. 색을 다시 바꿔 봐요.` });
    } else {
      setMsg({ tone: "bad", text: "아깝다! 같은 색이 붙은 곳이 있어요. 빨간 테두리를 톡 눌러 색을 바꿔 봐요." });
    }
  };

  const paint = (r: number, mode: "tap" | "brush") => {
    if (lock.current) return;
    const L = live.current;
    const c = colorsRef.current.length === L.n ? colorsRef.current : Array<number | null>(L.n).fill(null);
    let val: number | null;
    if (mode === "tap" && L.brush === null) val = c[r] === null ? 0 : c[r]! + 1 >= L.ncol ? null : c[r]! + 1;
    else val = L.brush === -1 ? null : (L.brush ?? 0);
    if (c[r] === val) return;
    const next = c.slice();
    next[r] = val;
    if (val !== null) setSplash({ r, c: val, k: Date.now() });
    apply(next);
  };

  const regionAt = (e: React.PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-r]");
    return el ? Number(el.getAttribute("data-r")) : null;
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = regionAt(e);
    drag.current = { last: r, start: r, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
    if (r !== null && live.current.brush !== null) paint(r, "brush");
  };
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const r = regionAt(e);
    if (r === d.last) return;
    d.moved = true;
    d.last = r;
    if (r !== null && live.current.brush !== null) paint(r, "brush");
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && d.start !== null && live.current.brush === null) paint(d.start, "tap");
  };

  const reset = () => {
    window.clearTimeout(timer.current);
    lock.current = false;
    colorsRef.current = [];
    setColors([]);
    setSplash(null);
    setHintR(null);
    setMsg({ tone: "info", text: "새로 시작해요. 나라를 톡 눌러 보세요!" });
  };

  const giveHint = () => {
    if (bad.size) {
      const r = [...bad][0];
      setHintR(r);
      setMsg({ tone: "info", text: `나라 ${p.names[r]}가 이웃과 같은 색이에요. 톡 눌러서 색을 바꿔 봐요.` });
      return;
    }
    const sol = solveFrom(p.adj, ncol, cur);
    if (!sol) {
      setMsg({ tone: "info", text: ncol < geo.chi ? `이 지도는 ${ncol}색으로는 안 돼요. 색을 늘려 봐요.` : "지금 칠한 색 때문에 막힐 것 같아요. 몇 개를 지우고 다시 해 봐요." });
      return;
    }
    const r = cur.findIndex((c) => c === null);
    if (r < 0) return;
    setHintR(r);
    setMsg({ tone: "info", text: `나라 ${p.names[r]}에는 ${PALETTE[sol[r]].name}색을 칠해 보면 어때요? (보라색 점선이 그 나라예요)` });
  };

  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
  const [gx, gy] = geo.labels[0];

  return (
    <div className="space-y-3 text-base">
      <p className="font-game text-center text-xl text-accent">레벨 {level} · 라운드 {round}/{ROUNDS}</p>
      {level >= 7 && <p className="text-center font-bold text-ink">이번엔 물감이 딱 {ncol}가지뿐! 꼭 필요한 색만 있어요.</p>}
      <Board>
        <p className="mb-2 rounded-card bg-accent-soft px-3 py-2 text-base font-bold">
          {brush === null ? "나라를 톡 누를 때마다 색이 바뀌어요. 붙은 나라는 다른 색!" : brush === -1 ? "지우개예요. 나라를 누르거나 쓱쓱 문질러 지워요." : "물감을 골랐어요. 나라를 누르거나 손가락으로 쓱쓱 문질러 칠해요!"}
        </p>

        <style>{`
          @keyframes mc-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-7px)}50%{transform:translateX(7px)}75%{transform:translateX(-4px)}}
          .mc-shake{animation:mc-shake .4s ease-in-out}
          @media (prefers-reduced-motion: reduce){.mc-shake{animation:none}}
        `}</style>
        <div className={shake ? "mc-shake" : ""}>
        <svg
          viewBox={`-12 -12 ${W * CELL + 24} ${H * CELL + 24}`}
          className="block h-auto w-full select-none"
          style={{ touchAction: "none", ...JUA }}
          role="group"
          aria-label={`색칠할 지도. 나라 ${n}개`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <defs>
            <pattern id="mc-paper" width="12" height="12" patternUnits="userSpaceOnUse">
              <rect width="12" height="12" fill="#fff7e0" />
              <circle cx="3" cy="3" r="1.3" fill="#f5deb3" />
              <circle cx="9" cy="9" r="1.3" fill="#f5deb3" />
            </pattern>
            <radialGradient id="mc-shine" cx="0.3" cy="0.2" r="0.9">
              <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
              <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#7c2d12" stopOpacity="0.12" />
            </radialGradient>
          </defs>
          {/* 나무 액자 */}
          <rect x="-9" y="-6" width={W * CELL + 18} height={H * CELL + 18} rx="16" fill="#92400e" opacity="0.35" />
          <rect x="-10" y="-10" width={W * CELL + 20} height={H * CELL + 20} rx="16" fill="#d97706" stroke="#7c2d12" strokeWidth="3" />
          {Array.from({ length: n }, (_, r) => (
            <g
              key={r}
              data-r={r}
              role="button"
              tabIndex={0}
              aria-label={`나라 ${p.names[r]}, ${cur[r] === null ? "칠하지 않음" : PALETTE[cur[r]!].name + "색"}${bad.has(r) ? ", 이웃과 색이 같아요" : ""}`}
              onKeyDown={keyAct(() => paint(r, "tap"))}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {p.cells.map((row, y) =>
                row.map((c, x) =>
                  c === r ? <rect key={`${x}-${y}`} data-r={r} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={cur[r] === null ? "url(#mc-paper)" : PALETTE[cur[r]!].fill} stroke={cur[r] === null ? "#fff7e0" : PALETTE[cur[r]!].fill} strokeWidth="0.6" /> : null,
                ),
              )}
            </g>
          ))}
          {/* 물감이 번지는 반짝임 */}
          {splash && !REDUCE && splash.r < n && geo.labels[splash.r] && (
            <circle key={splash.k} cx={geo.labels[splash.r][0] * CELL} cy={geo.labels[splash.r][1] * CELL} r="0" fill="#fff" pointerEvents="none">
              <animate attributeName="r" from="4" to="70" dur="0.5s" fill="freeze" />
              <animate attributeName="opacity" from="0.8" to="0" dur="0.5s" fill="freeze" />
            </circle>
          )}
          <rect x="0" y="0" width={W * CELL} height={H * CELL} fill="url(#mc-shine)" pointerEvents="none" />
          {geo.edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />
          ))}
          {geo.edges.map((e, i) =>
            bad.has(e.a) || bad.has(e.b) ? <line key={`r${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#dc2626" strokeWidth="6" strokeLinecap="round" pointerEvents="none" /> : null,
          )}
          {hintR !== null &&
            geo.edges.map((e, i) =>
              e.a === hintR || e.b === hintR ? <line key={`h${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#7c3aed" strokeWidth="6" strokeDasharray="8 6" strokeLinecap="round" pointerEvents="none" /> : null,
            )}
          {geo.labels.map(([x, y], r) => (
            <g key={r} pointerEvents="none" transform={`translate(${x * CELL} ${y * CELL})`}>
              <g transform="translate(-17 -1)">
                <Icon kind={r} />
              </g>
              <circle cx="11" cy="0" r="12" fill="#fff" stroke={bad.has(r) ? "#dc2626" : "#7c2d12"} strokeWidth="2.5" />
              <text x="11" y="6" textAnchor="middle" fontSize="16" fill={bad.has(r) ? "#b91c1c" : "#422006"}>
                {p.names[r]}
              </text>
              {bad.has(r) && (
                <text x="24" y="-14" fontSize="18" fill="#dc2626" stroke="#fff" strokeWidth="3" paintOrder="stroke">
                  !
                </text>
              )}
            </g>
          ))}
          {/* 처음 3초 손짓 */}
          {!touched && painted === 0 && (
            <g pointerEvents="none">
              <circle cx={gx * CELL} cy={gy * CELL} r="14" fill="none" stroke="#ea580c" strokeWidth="5">
                {!REDUCE && <animate attributeName="r" values="12;34;12" dur="1.4s" repeatCount="indefinite" />}
                {!REDUCE && <animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite" />}
              </circle>
              <text x={gx * CELL + 14} y={gy * CELL + 48} fontSize="32">
                👆
                {!REDUCE && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -8; 0 0" dur="0.9s" repeatCount="indefinite" />}
              </text>
              <text x={gx * CELL} y={gy * CELL + 74} textAnchor="middle" fontSize="22" fill="#c2410c" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                톡! 눌러 봐요
              </text>
            </g>
          )}
        </svg>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-sm text-muted">물감통 (고르면 쓱쓱 문질러 칠할 수 있어요. 한 번 더 누르면 풀려요)</p>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="물감 고르기">
            {PALETTE.slice(0, ncol).map((c, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setBrush(brush === i ? null : i);
                  tick();
                }}
                aria-label={`${c.name}색 물감`}
                aria-pressed={brush === i}
                className={`font-game flex h-12 w-12 items-center justify-center rounded-full border-[3px] text-lg text-slate-900 shadow-[0_4px_0_rgba(0,0,0,0.25)] transition-transform ${brush === i ? "-translate-y-1 scale-110 ring-4 ring-accent" : ""}`}
                style={{ background: `radial-gradient(circle at 35% 30%, #ffffffcc 0 16%, ${c.fill} 42%, ${c.dark} 120%)`, borderColor: c.dark, touchAction: "manipulation" }}
              >
                {i + 1}
              </button>
            ))}
            <GButton variant="ghost" pressed={brush === -1} onClick={() => setBrush(brush === -1 ? null : -1)} className={BIG}>
              지우개
            </GButton>
          </div>
        </div>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="라운드" value={`${round}/${ROUNDS}`} />
        <Stat label="칠한 나라" value={`${painted}/${n}`} tone={full && bad.size === 0 ? "ok" : "plain"} />
        <Stat label="쓴 색" value={usedColors} />
        <Stat label="같은 색이 붙은 곳" value={bad.size ? `${bad.size}곳` : "없음"} tone={bad.size ? "bad" : "plain"} />
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton variant="primary" onClick={reset} className={BIG}>↻ 다시 칠하기</GButton>
        <GButton variant="soft" onClick={giveHint} className={BIG}>💡 힌트 보기</GButton>
      </div>

    </div>
  );
}
