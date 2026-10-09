import { useMemo, useState } from "react";
import { Board, GButton, Say, Stat } from "./kit";

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
// ==PURE-END==

type MapDef = { id: string; name: string; rows: string[]; why: string };

const MAPS: MapDef[] = [
  {
    id: "brick",
    name: "벽돌 마을",
    rows: ["AAAABBBBCCCC", "AAAABBBBCCCC", "DDEEEEFFFFGG", "DDEEEEFFFFGG", "HHHHIIIIJJJJ", "HHHHIIIIJJJJ"],
    why: "서로 이웃한 세 나라가 있어서 2색으로는 안 돼요. 하지만 3색이면 충분해요.",
  },
  {
    id: "village",
    name: "마을 지도",
    rows: ["AAAABBBBCCCC", "AAAABBBBCCCC", "DDDEEEEEFFCC", "DDDEEEEEFFGG", "HHHHEEEEFFGG", "HHHHIIIIIIGG", "HHHHIIIIIIGG"],
    why: "이웃 관계를 따져 보면 3색으로는 어떻게 칠해도 꼭 막히는 곳이 생겨요. 컴퓨터로 모든 경우를 검사해서 4색이 필요하다는 것을 확인했어요.",
  },
  {
    id: "star",
    name: "별 모양 나라",
    rows: ["AAAAABBBBBGG", "AAAAABBBBBGG", "AAEEEEEBBBCC", "FFEEEEECCCCC", "FFEEEEECCCCC", "FFFDDDDCCCCH", "FFFDDDDCCCHH", "FFFDDDDHHHHH"],
    why: "가운데 나라 E를 다섯 나라(A, B, C, D, F)가 고리처럼 둘러싸고 있어요. 고리가 홀수 개라서 두 색만으로는 고리를 칠할 수 없고, E는 또 다른 색이 필요해서 4색이 필요해요.",
  },
  {
    id: "k4",
    name: "네 나라가 만나는 곳",
    rows: ["GGAAAAAABBHH", "GGAAAAAABBHH", "GGAAEEEEBBHH", "IICCEEEEBBJJ", "IICCCCCCBBJJ", "IICCCCCCCCJJ", "KKKKKKKKKKJJ"],
    why: "A, B, C, E 네 나라가 모두 서로 이웃해요. 네 나라가 다 달라야 하니 4색이 필요해요.",
  },
];

const PALETTE = [
  { fill: "#fde047", name: "노랑" },
  { fill: "#60a5fa", name: "파랑" },
  { fill: "#4ade80", name: "초록" },
  { fill: "#fb923c", name: "주황" },
  { fill: "#c084fc", name: "보라" },
];
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
    let best: [number, number] = [0, 0];
    let bd = 1e9;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (p.cells[y][x] === r) {
      const d = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d < bd) { bd = d; best = [x + 0.5, y + 0.5]; }
    }
    return best;
  });
  return { p, W, H, edges, labels, chi: chromatic(p.adj), canThree: !!colorable(p.adj, 3) };
}

type Msg = { tone: "info" | "ok" | "bad"; text: string };

export default function MapColorGame() {
  const [mi, setMi] = useState(1);
  const [ncol, setNcol] = useState(4);
  const [tool, setTool] = useState(0); // 0..4 = 색, -1 = 지우개
  const [colors, setColors] = useState<(number | null)[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [wins, setWins] = useState(0);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "색을 고르고 나라를 눌러 칠해 보세요. 끌면서 칠할 수도 있어요." });

  const defs = MAPS[mi];
  const geo = useMemo(() => buildGeometry(defs.rows), [defs]);
  const { p, W, H } = geo;
  const n = p.names.length;
  const cur: (number | null)[] = colors.length === n ? colors : Array<number | null>(n).fill(null);
  const bad = conflicts(p.adj, cur);
  const painted = cur.filter((c) => c !== null).length;
  const usedColors = new Set(cur.filter((c) => c !== null)).size;
  const full = painted === n;

  const evaluate = (next: (number | null)[]) => {
    const cf = conflicts(p.adj, next);
    const pc = next.filter((c) => c !== null).length;
    if (pc < n) {
      setMsg(cf.size ? { tone: "bad", text: `이웃한 나라가 같은 색이에요. 빨간 테두리를 찾아 색을 바꿔 보세요. (${pc}/${n}칠함)` } : { tone: "info", text: `${pc}/${n}개 나라를 칠했어요.` });
      return;
    }
    if (cf.size === 0) {
      const k = new Set(next).size;
      setWins((w) => w + 1);
      setMsg({
        tone: "ok",
        text: k <= geo.chi ? `성공! ${k}색으로 모두 칠했어요. 이 지도는 ${geo.chi}색이 최소라서 더 줄일 수 없어요.` : `성공! ${k}색으로 칠했어요. 이 지도는 ${geo.chi}색으로도 칠할 수 있어요. 색 수를 줄여 다시 해 볼까요?`,
      });
    } else if (ncol < geo.chi) {
      setMsg({ tone: "bad", text: `다 칠했지만 이웃끼리 같은 색이 있어요. 사실 이 지도는 ${ncol}색으로는 칠할 수 없어요(모든 경우를 검사했어요). 색 개수를 늘려 보세요.` });
    } else {
      setMsg({ tone: "bad", text: "다 칠했지만 이웃끼리 같은 색인 곳이 있어요. 빨간 테두리를 고쳐 보세요." });
    }
  };

  const paint = (r: number) => {
    const val = tool === -1 ? null : tool;
    if (cur[r] === val) return;
    const next = cur.slice();
    next[r] = val;
    setColors(next);
    evaluate(next);
  };

  const reset = (text = "새로 시작해요. 색을 고르고 칠해 보세요.") => {
    setColors(Array<number | null>(n).fill(null));
    setMsg({ tone: "info", text });
  };

  const changeMap = (i: number) => {
    setMi(i);
    setColors([]);
    setShowHint(false);
    setMsg({ tone: "info", text: "새 지도예요. 색을 고르고 나라를 눌러 칠해 보세요." });
  };

  const changeNcol = (k: number) => {
    setNcol(k);
    if (tool >= k) setTool(0);
    const next = cur.map((c) => (c !== null && c >= k ? null : c));
    setColors(next);
    setMsg({ tone: "info", text: `이제 ${k}색만 쓸 수 있어요.` });
  };

  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className="space-y-3">
      <Board>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="지도 고르기">
          {MAPS.map((m, i) => (
            <GButton key={m.id} variant={i === mi ? "soft" : "ghost"} pressed={i === mi} onClick={() => changeMap(i)} className="text-sm">
              {m.name}
            </GButton>
          ))}
        </div>

        <svg viewBox={`0 0 ${W * CELL} ${H * CELL}`} className="block h-auto w-full select-none rounded-card bg-bg" style={{ touchAction: "manipulation" }} role="group" aria-label={`${defs.name}. 나라 ${n}개`}>
          {Array.from({ length: n }, (_, r) => (
            <g
              key={r}
              role="button"
              tabIndex={0}
              aria-label={`나라 ${p.names[r]}, ${cur[r] === null ? "칠하지 않음" : PALETTE[cur[r]!].name + "색"}${bad.has(r) ? ", 이웃과 색이 같아요" : ""}`}
              onClick={() => paint(r)}
              onKeyDown={keyAct(() => paint(r))}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse" && e.buttons === 1) paint(r);
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {p.cells.map((row, y) =>
                row.map((c, x) =>
                  c === r ? <rect key={`${x}-${y}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill={cur[r] === null ? "#f1f5f9" : PALETTE[cur[r]!].fill} stroke={cur[r] === null ? "#f1f5f9" : PALETTE[cur[r]!].fill} strokeWidth="0.6" /> : null,
                ),
              )}
            </g>
          ))}
          {geo.edges.map((e, i) => (
            <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#334155" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none" />
          ))}
          {geo.edges.map((e, i) =>
            bad.has(e.a) || bad.has(e.b) ? <line key={`r${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#dc2626" strokeWidth="5" strokeLinecap="round" pointerEvents="none" /> : null,
          )}
          {geo.labels.map(([x, y], r) => (
            <text key={r} x={x * CELL} y={y * CELL + 6} textAnchor="middle" fontSize="18" fontWeight="800" fill="#1e293b" stroke="#ffffff" strokeWidth="3" paintOrder="stroke" pointerEvents="none">
              {p.names[r]}
            </text>
          ))}
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="색 고르기">
          {PALETTE.slice(0, ncol).map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setTool(i)}
              aria-label={`${c.name}색 고르기`}
              aria-pressed={tool === i}
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-xs font-bold text-slate-800 ${tool === i ? "border-ink ring-2 ring-accent" : "border-line"}`}
              style={{ background: c.fill, touchAction: "manipulation" }}
            >
              {i + 1}
            </button>
          ))}
          <GButton variant="ghost" pressed={tool === -1} onClick={() => setTool(-1)} className="text-sm">
            지우개
          </GButton>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">쓸 수 있는 색</span>
          {[3, 4, 5].map((k) => (
            <GButton key={k} variant={ncol === k ? "soft" : "ghost"} pressed={ncol === k} onClick={() => changeNcol(k)} className="text-sm">
              {k}색
            </GButton>
          ))}
        </div>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="칠한 나라" value={`${painted}/${n}`} tone={full && bad.size === 0 ? "ok" : "plain"} />
        <Stat label="쓴 색" value={usedColors} />
        <Stat label="같은 색 이웃" value={bad.size ? `${bad.size}곳` : "없음"} tone={bad.size ? "bad" : "plain"} />
        <Stat label="성공" value={wins} tone={wins ? "ok" : "plain"} />
      </div>
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton variant="primary" onClick={() => reset()}>다시 칠하기</GButton>
        <GButton variant="soft" pressed={showHint} onClick={() => setShowHint(!showHint)}>{showHint ? "힌트 숨기기" : "이 지도는 몇 색이면 될까?"}</GButton>
      </div>

      {showHint && (
        <Board className="text-sm leading-relaxed">
          <p>
            이 지도의 나라는 {n}개예요. 컴퓨터가 모든 경우를 검사해 보니 <strong>{geo.canThree ? "3색으로 칠할 수 있어요" : "3색으로는 칠할 수 없어요"}</strong>
            {geo.canThree ? "." : ` (${geo.chi}색이면 가능해요).`}
          </p>
          <p className="mt-1 text-muted">{defs.why}</p>
        </Board>
      )}
    </div>
  );
}
