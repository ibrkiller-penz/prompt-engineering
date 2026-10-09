import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, rand, stageClear, svgPoint, tick, useStage } from "./kit";
import { BIG } from "./easykit";

// ==PURE==
export type Cell = [number, number]; // [줄(0~9), 칸(0~9)]
export type PieceDef = { shape: string; cells: Cell[]; anchor: Cell; vis: boolean[] };
export type BoardDef = { pieces: PieceDef[]; revealed: boolean[] };

export const SHAPES: Record<string, Cell[]> = {
  sq: [[0, 0], [0, 1], [1, 0], [1, 1]],
  rect23: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], // 2줄 × 3칸
  rect32: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], // 3줄 × 2칸
  L4: [[0, 0], [1, 0], [2, 0], [2, 1]],
  T4: [[0, 0], [0, 1], [0, 2], [1, 1]],
  bar3: [[0, 0], [0, 1], [0, 2]],
  bar3v: [[0, 0], [1, 0], [2, 0]],
};
/** (줄, 칸)에 있는 수: 오른쪽 +1, 아래 +10 */
export const numAt = (r: number, c: number) => r * 10 + c + 1;
export const dims = (cells: Cell[]) => ({ h: Math.max(...cells.map((x) => x[0])) + 1, w: Math.max(...cells.map((x) => x[1])) + 1 });
export const absCells = (p: { cells: Cell[]; anchor: Cell }): Cell[] => p.cells.map(([r, c]) => [p.anchor[0] + r, p.anchor[1] + c]);

/** 레벨(1~10)별 규칙: 조각 수, 모양 후보, 조각에 보이는 수(최소~최대), 표에 보이는 칸의 비율, 구멍 둘레에 꼭 보일 칸 수 */
export function levelSpec(level: number) {
  const L = Math.max(1, Math.min(10, level));
  const shapes = L === 1 ? ["rect23"] : L === 2 ? ["rect23", "sq"] : L === 3 ? ["sq", "rect23", "rect32"] : L <= 5 ? ["sq", "rect23", "rect32", "L4"] : L <= 7 ? ["sq", "rect32", "L4", "T4"] : ["sq", "L4", "T4", "bar3", "bar3v"];
  return {
    count: L <= 6 ? 3 : 4,
    shapes,
    visMin: [4, 3, 3, 3, 2, 2, 2, 2, 1, 1][L - 1],
    visMax: [5, 4, 3, 3, 3, 2, 2, 2, 2, 2][L - 1],
    reveal: [0.85, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25][L - 1],
    minNb: L <= 3 ? 4 : L <= 6 ? 3 : L <= 8 ? 2 : 1,
  };
}

/** 조각(보이는 수만)이 들어갈 수 있는 모든 자리(왼쪽 위 칸). 하나뿐이어야 유일한 해예요. */
export function fits(p: PieceDef): Cell[] {
  const { h, w } = dims(p.cells);
  const out: Cell[] = [];
  for (let r = 0; r + h <= 10; r++)
    for (let c = 0; c + w <= 10; c++) {
      let ok = true;
      for (let i = 0; i < p.cells.length && ok; i++) {
        if (!p.vis[i]) continue;
        const [dr, dc] = p.cells[i];
        const shown = numAt(p.anchor[0] + dr, p.anchor[1] + dc);
        if (numAt(r + dr, c + dc) !== shown) ok = false;
      }
      if (ok) out.push([r, c]);
    }
  return out;
}

export function makeBoard(rnd: (n: number) => number, level: number): BoardDef {
  const sp = levelSpec(level);
  for (let attempt = 0; attempt < 2000; attempt++) {
    const pieces: PieceDef[] = [];
    const taken = new Set<number>(); // 구멍 + 둘레 한 칸(겹치거나 맞닿지 않게)
    let ok = true;
    for (let k = 0; k < sp.count && ok; k++) {
      let placed = false;
      for (let t = 0; t < 60 && !placed; t++) {
        const shape = sp.shapes[rnd(sp.shapes.length)];
        const cells = SHAPES[shape];
        const { h, w } = dims(cells);
        const anchor: Cell = [rnd(11 - h), rnd(11 - w)];
        const abs = absCells({ cells, anchor });
        if (abs.some(([r, c]) => taken.has(r * 10 + c))) continue;
        for (const [r, c] of abs) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) taken.add((r + dr) * 10 + (c + dc));
        // 보이는 수 고르기
        const n = Math.min(cells.length, sp.visMin + rnd(sp.visMax - sp.visMin + 1));
        const idx = cells.map((_, i) => i).sort(() => rnd(3) - 1).slice(0, n);
        pieces.push({ shape, cells, anchor, vis: cells.map((_, i) => idx.includes(i)) });
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (!ok) continue;
    const hole = new Set<number>();
    for (const p of pieces) for (const [r, c] of absCells(p)) hole.add(r * 10 + c);
    const revealed = Array.from({ length: 100 }, () => false);
    const rest = Array.from({ length: 100 }, (_, i) => i).filter((i) => !hole.has(i)).sort(() => rnd(3) - 1);
    const nShow = Math.round(rest.length * sp.reveal);
    for (let i = 0; i < nShow; i++) revealed[rest[i]] = true;
    // 구멍마다 둘레(위아래좌우)에 보이는 칸을 최소 minNb 개
    for (const p of pieces) {
      const nb = new Set<number>();
      for (const [r, c] of absCells(p))
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr > 9 || cc < 0 || cc > 9 || hole.has(rr * 10 + cc)) continue;
          nb.add(rr * 10 + cc);
        }
      const list = [...nb];
      let have = list.filter((i) => revealed[i]).length;
      for (const i of list.sort(() => rnd(3) - 1)) {
        if (have >= Math.min(sp.minNb, list.length)) break;
        if (!revealed[i]) {
          revealed[i] = true;
          have++;
        }
      }
    }
    if (pieces.every((p) => { const f = fits(p); return f.length === 1 && f[0][0] === p.anchor[0] && f[0][1] === p.anchor[1]; })) return { pieces, revealed };
  }
  throw new Error("board");
}
// ==END==

const ROUNDS = 3;
const GF = { fontFamily: "Jua, Pretendard Variable, sans-serif" };
const CSS = `
@keyframes hd-pop { 0% { transform: scale(.7); opacity: .4; } 60% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
@keyframes hd-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-3px); } }
.hd-pop { animation: hd-pop .45s ease-out; transform-box: fill-box; transform-origin: center; }
.hd-shake { animation: hd-shake .4s ease-in-out; }
@media (prefers-reduced-motion: reduce) { .hd-pop, .hd-shake { animation: none; } }
`;
const CELL = 36;
const BX = 10;
const BY = 10;
const TCELL = 28; // 아래 선반의 조각 칸 크기
const TRAY_Y = 452; // 선반 조각의 가운데 높이
const COLORS: [string, string][] = [["#fb7185", "#be123c"], ["#60a5fa", "#1d4ed8"], ["#34d399", "#047857"], ["#fbbf24", "#b45309"]];
const colTint = (c: number) => `hsl(${c * 36} 85% 90%)`;

type Drag = { i: number; x: number; y: number };

function Shape({ p, k, x0, y0, size, all, level }: { p: PieceDef; k: number; x0: number; y0: number; size: number; all: boolean; level: number }) {
  const [fill, line] = COLORS[k % COLORS.length];
  void level;
  return (
    <g pointerEvents="none">
      {p.cells.map(([r, c], i) => {
        const shown = all || p.vis[i];
        return (
          <g key={i}>
            <rect x={x0 + c * size + 1} y={y0 + r * size + 1} width={size - 2} height={size - 2} rx={size * 0.2} fill={fill} stroke={line} strokeWidth="2.5" />
            <rect x={x0 + c * size + 4} y={y0 + r * size + 3} width={size - 8} height={(size - 8) * 0.3} rx="3" fill="#fff" opacity="0.3" />
            {shown ? (
              <text x={x0 + c * size + size / 2} y={y0 + r * size + size / 2 + size * 0.17} fontSize={size * 0.52} textAnchor="middle" fill="#fff" stroke={line} strokeWidth="2.5" paintOrder="stroke" style={GF}>
                {numAt(p.anchor[0] + r, p.anchor[1] + c)}
              </text>
            ) : (
              <text x={x0 + c * size + size / 2} y={y0 + r * size + size / 2 + size * 0.17} fontSize={size * 0.5} textAnchor="middle" fill="#fff" opacity="0.85" style={GF}>
                ?
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Round({ level, board, onResult }: { level: number; board: BoardDef; onResult: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [placed, setPlaced] = useState<boolean[]>(() => board.pieces.map(() => false));
  const [drag, setDrag] = useState<Drag | null>(null);
  const [hint, setHint] = useState(false);
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState<{ i: number; n: number } | null>(null);
  const [last, setLast] = useState(-1);
  const [msg, setMsg] = useState<{ tone: "info" | "ok" | "bad"; text: string } | null>(null);
  const n = board.pieces.length;
  const slotX = (i: number) => (380 * (i + 0.5)) / n;
  const hole = new Set<number>();
  for (const p of board.pieces) for (const [r, c] of absCells(p)) hole.add(r * 10 + c);
  const filled = new Set<number>();
  board.pieces.forEach((p, i) => placed[i] && absCells(p).forEach(([r, c]) => filled.add(r * 10 + c)));

  const anchorOf = (i: number, cx: number, cy: number): Cell => {
    const { h, w } = dims(board.pieces[i].cells);
    return [Math.round((cy - BY) / CELL - h / 2), Math.round((cx - BX) / CELL - w / 2)];
  };
  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setTouched(true);
    for (let i = 0; i < n; i++) {
      if (placed[i]) continue;
      const { h, w } = dims(board.pieces[i].cells);
      const cx = slotX(i);
      if (Math.abs(x - cx) < (w * TCELL) / 2 + 14 && Math.abs(y - TRAY_Y) < (h * TCELL) / 2 + 14) {
        svg.setPointerCapture(e.pointerId);
        setDrag({ i, x, y });
        tick();
        return;
      }
    }
  };
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    setDrag({ ...drag, x, y });
  };
  const up = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    const p = board.pieces[d.i];
    const a = anchorOf(d.i, d.x, d.y - 46);
    if (a[0] === p.anchor[0] && a[1] === p.anchor[1]) {
      const np = placed.map((v, j) => (j === d.i ? true : v));
      setPlaced(np);
      setLast(d.i);
      if (np.every(Boolean)) {
        cheer();
        setMsg({ tone: "ok", text: "와, 100칸 표가 다 맞춰졌어요! 잘했어요! ⭐" });
        onResult();
      } else {
        tick();
        setMsg({ tone: "ok", text: "딱 맞아요! 다음 조각도 찾아봐요." });
      }
    } else {
      oops();
      setShake((s) => ({ i: d.i, n: (s?.n ?? 0) + 1 }));
      const v = p.cells.findIndex((_, i) => p.vis[i]);
      const [dr, dc] = p.cells[v];
      setMsg({ tone: "bad", text: `아쉬워요, 괜찮아요! 조각에 보이는 ${numAt(p.anchor[0] + dr, p.anchor[1] + dc)}은(는) 표의 어디에 있을까요? 오른쪽으로 한 칸 가면 +1, 아래로 한 줄 가면 +10이에요.` });
    }
  };

  // 끌고 있는 조각이 놓일 자리 미리 보기
  const dragAnchor = drag ? anchorOf(drag.i, drag.x, drag.y - 46) : null;
  const preview = drag && dragAnchor ? absCells({ cells: board.pieces[drag.i].cells, anchor: dragAnchor }) : [];
  const inside = preview.length > 0 && preview.every(([r, c]) => r >= 0 && r < 10 && c >= 0 && c < 10);

  return (
    <div className="space-y-3">
      <Board>
        <p className="font-game mb-2 text-center text-2xl leading-snug">찢어진 자리에 알맞은 조각을 끌어다 놓아요!</p>
        <svg
          ref={svgRef}
          viewBox="0 0 380 500"
          className="mx-auto block w-full max-w-[460px] touch-none select-none"
          style={{ touchAction: "none" }}
          role="group"
          aria-label="100칸 표와 아래 선반의 조각들. 조각을 끌어서 찢어진 자리에 놓아요."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={() => setDrag(null)}
        >
          <defs>
            <linearGradient id="hd-paper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ede9fe" />
              <stop offset="1" stopColor="#c4b5fd" />
            </linearGradient>
            <linearGradient id="hd-desk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fde68a" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="380" height="500" rx="18" fill="url(#hd-paper)" />
          <rect x={BX - 5} y={BY - 5} width={10 * CELL + 10} height={10 * CELL + 10} rx="12" fill="#fff" stroke="#7c3aed" strokeWidth="4" />
          {Array.from({ length: 100 }, (_, i) => {
            const r = Math.floor(i / 10);
            const c = i % 10;
            const x = BX + c * CELL;
            const y = BY + r * CELL;
            const isHole = hole.has(i);
            if (isHole && !filled.has(i)) {
              return (
                <g key={i}>
                  <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx="5" fill="#4c1d95" opacity="0.88" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 3" />
                </g>
              );
            }
            if (isHole) return null;
            const show = board.revealed[i] || hint;
            return (
              <g key={i}>
                <rect x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx="5" fill={show ? (level <= 5 ? colTint(c) : "#e0f2fe") : "#f3f0ff"} stroke={show ? "#c4b5fd" : "#ddd6fe"} strokeWidth="1.5" />
                {show ? (
                  <text x={x + CELL / 2} y={y + CELL / 2 + 6} fontSize="17" textAnchor="middle" fill="#3b0764" style={GF}>
                    {i + 1}
                  </text>
                ) : (
                  <circle cx={x + CELL / 2} cy={y + CELL / 2} r="2.5" fill="#c4b5fd" />
                )}
              </g>
            );
          })}
          {/* 맞춘 조각 */}
          {board.pieces.map((p, i) =>
            placed[i] ? (
              <g key={i} className={last === i ? "hd-pop" : ""}>
                <Shape p={p} k={i} x0={BX + p.anchor[1] * CELL} y0={BY + p.anchor[0] * CELL} size={CELL} all level={level} />
              </g>
            ) : null,
          )}
          {/* 놓일 자리 미리 보기 */}
          {drag &&
            inside &&
            preview.map(([r, c], i) => <rect key={i} x={BX + c * CELL + 2} y={BY + r * CELL + 2} width={CELL - 4} height={CELL - 4} rx="6" fill="rgba(250,204,21,0.45)" stroke="#f59e0b" strokeWidth="3" />)}

          {/* 조각 선반 */}
          <rect x="6" y="390" width="368" height="104" rx="16" fill="url(#hd-desk)" stroke="#b45309" strokeWidth="4" />
          <text x="190" y="408" fontSize="14" textAnchor="middle" fill="#7c2d12" style={GF}>조각 선반 · 끌어서 올려요</text>
          {board.pieces.map((p, i) => {
            if (placed[i]) return null;
            const { h, w } = dims(p.cells);
            const lifted = drag?.i === i;
            return (
              <g key={`${i}-${shake?.i === i ? shake.n : 0}`} opacity={lifted ? 0.35 : 1} className={shake?.i === i ? "hd-shake" : ""}>
                <Shape p={p} k={i} x0={slotX(i) - (w * TCELL) / 2} y0={TRAY_Y - (h * TCELL) / 2 + 4} size={TCELL} all={false} level={level} />
              </g>
            );
          })}
          {/* 끌고 있는 조각: 손가락 위로 띄워서 안 가려지게 */}
          {drag && (() => {
            const p = board.pieces[drag.i];
            const { h, w } = dims(p.cells);
            return (
              <g pointerEvents="none">
                <Shape p={p} k={drag.i} x0={drag.x - (w * CELL) / 2} y0={drag.y - 46 - (h * CELL) / 2} size={CELL} all={false} level={level} />
              </g>
            );
          })()}
          {!touched && placed.every((v) => !v) && (
            <text fontSize="26" aria-hidden="true">
              👆
              <animate attributeName="x" values={`${slotX(0)};${BX + board.pieces[0].anchor[1] * CELL + 20};${BX + board.pieces[0].anchor[1] * CELL + 20};${slotX(0)}`} dur="3s" repeatCount="indefinite" />
              <animate attributeName="y" values={`${TRAY_Y + 10};${BY + board.pieces[0].anchor[0] * CELL + 40};${BY + board.pieces[0].anchor[0] * CELL + 40};${TRAY_Y + 10}`} dur="3s" repeatCount="indefinite" />
            </text>
          )}
        </svg>
        <p className="text-center text-base text-muted">→ 오른쪽 칸은 <b>+1</b>, ↓ 아래 칸은 <b>+10</b>이에요.</p>
      </Board>
      {msg ? <Say tone={msg.tone}>{msg.text}</Say> : <Say>조각에 보이는 수를 먼저 찾아요. 표에서 그 수가 있어야 할 자리는 어디일까요?</Say>}
      {hint && <Say>표의 수가 모두 보여요. 조각의 수와 같은 줄·같은 칸을 찾아 구멍에 맞춰 봐요. (한 줄은 10칸이에요!)</Say>}
      <GButton pressed={hint} onClick={() => setHint((h) => !h)} className={BIG}>
        힌트: 표의 수 모두 보기 {hint ? "끄기" : "켜기"}
      </GButton>
    </div>
  );
}

export default function HundredGame() {
  const level = useStage();
  const timer = useRef(0);
  const [cleared, setCleared] = useState(0);
  const [boards] = useState<BoardDef[]>(() => [0, 1, 2].map(() => makeBoard(rand, level)));
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onResult = () => {
    const n = cleared + 1;
    if (n >= ROUNDS) timer.current = window.setTimeout(stageClear, 1200);
    else timer.current = window.setTimeout(() => setCleared(n), 2200);
  };
  return (
    <div className="space-y-3">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label={`레벨 ${level}`} value={`라운드 ${Math.min(cleared + 1, ROUNDS)}/${ROUNDS}`} />
      </div>
      <Round key={cleared} level={level} board={boards[Math.min(cleared, ROUNDS - 1)]} onResult={onResult} />
    </div>
  );
}
