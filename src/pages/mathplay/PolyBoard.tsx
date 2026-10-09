import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHAPES, transform, type Cell, type Placed } from "./poly";

/** 칸의 종류: void=판 밖, open=덮어야 하는 칸, target=덮지 말고 남길 칸 */
export type CellKind = "void" | "open" | "target";

export type PieceDef = { id: string; name: string; color: string };

type Props = {
  kinds: CellKind[][];
  labels?: (string | undefined)[][];
  pieces: PieceDef[];
  /** 정답 하나(보기 단추용). 없으면 정답 보기 단추를 숨긴다. */
  solution: Placed[] | null | (() => Placed[] | null);
  /** 문제가 바뀌면 값을 바꿔 준다. 놓은 조각이 모두 지워진다. */
  resetKey: string | number;
  /** 다 덮었을 때 보일 말 */
  doneText: string;
  cellPx?: number;
};

const key = (r: number, c: number) => `${r},${c}`;

/** 조각을 놓는 판. 마우스는 칸 위에 올리면 놓일 자리가 보이고 누르면 놓인다. 터치는 한 번 눌러 자리를 보고, 같은 칸을 다시 눌러 놓는다. */
export default function PolyBoard({ kinds, labels, pieces, solution, resetKey, doneText, cellPx = 44 }: Props) {
  const R = kinds.length;
  const C = kinds[0].length;
  const [placed, setPlaced] = useState<Record<string, Cell[]>>({});
  const [sel, setSel] = useState<string>(pieces[0]?.id ?? "");
  const [rot, setRot] = useState(0);
  const [flip, setFlip] = useState(false);
  const [hover, setHover] = useState<Cell | null>(null);
  const [peek, setPeek] = useState<Record<string, Cell[]> | null>(null);
  const [noSolution, setNoSolution] = useState(false);
  const lastPointer = useRef<string>("mouse");
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // 마우스로 조각을 끌고 있는 중: 시작한 자리와 움직였는지(클릭과 구분)
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    setPlaced({});
    setPeek(null);
    setNoSolution(false);
    setSel(pieces[0]?.id ?? "");
    setRot(0);
    setFlip(false);
    setHover(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const shown = peek ?? placed;
  const owner = useMemo(() => {
    const m = new Map<string, string>();
    for (const [id, cells] of Object.entries(shown)) cells.forEach(([r, c]) => m.set(key(r, c), id));
    return m;
  }, [shown]);

  const def = pieces.find((p) => p.id === sel);
  const shape = useMemo(() => (def ? transform(SHAPES[def.name], rot, flip) : []), [def, rot, flip]);
  // 조각의 중심에 가장 가까운 칸을 '잡는 곳'으로 삼는다
  const anchor = useMemo<Cell>(() => {
    if (!shape.length) return [0, 0];
    const cr = shape.reduce((s, x) => s + x[0], 0) / shape.length;
    const cc = shape.reduce((s, x) => s + x[1], 0) / shape.length;
    return shape.reduce((best, x) => (Math.hypot(x[0] - cr, x[1] - cc) < Math.hypot(best[0] - cr, best[1] - cc) ? x : best), shape[0]);
  }, [shape]);

  const ghost = useMemo(() => {
    if (!hover || !def || peek || placed[def.id]) return null;
    const cells = shape.map(([a, b]) => [hover[0] + a - anchor[0], hover[1] + b - anchor[1]] as Cell);
    const ok = cells.every(([r, c]) => r >= 0 && c >= 0 && r < R && c < C && kinds[r][c] === "open" && !owner.has(key(r, c)));
    return { cells, ok };
  }, [hover, def, shape, anchor, peek, placed, R, C, kinds, owner]);

  const openCount = useMemo(() => kinds.flat().filter((k) => k === "open").length, [kinds]);
  const covered = useMemo(() => {
    let n = 0;
    owner.forEach((_, k) => {
      const [r, c] = k.split(",").map(Number);
      if (kinds[r][c] === "open") n++;
    });
    return n;
  }, [owner, kinds]);
  const done = covered === openCount && !peek;

  const nextUnplaced = useCallback(
    (after: Record<string, Cell[]>, from: string) => {
      const order = pieces.map((p) => p.id);
      const start = order.indexOf(from);
      for (let i = 1; i <= order.length; i++) {
        const id = order[(start + i) % order.length];
        if (!after[id]) return id;
      }
      return from;
    },
    [pieces],
  );

  const rotate = useCallback(() => setRot((x) => (x + 1) % 4), []);
  const mirror = useCallback(() => setFlip((x) => !x), []);

  /** (r,c)를 잡는 곳으로 해서 조각 id 를 놓을 수 있으면 놓고 true */
  const placeAt = (id: string, r: number, c: number, base: Record<string, Cell[]>) => {
    const d = pieces.find((p) => p.id === id);
    if (!d) return false;
    const cells = shape.map(([a, b]) => [r + a - anchor[0], c + b - anchor[1]] as Cell);
    const taken = new Set<string>();
    for (const [pid, cs] of Object.entries(base)) if (pid !== id) cs.forEach(([rr, cc]) => taken.add(key(rr, cc)));
    const ok = cells.every(([rr, cc]) => rr >= 0 && cc >= 0 && rr < R && cc < C && kinds[rr][cc] === "open" && !taken.has(key(rr, cc)));
    if (!ok) return false;
    const next = { ...base, [id]: cells };
    setPlaced(next);
    setSel(nextUnplaced(next, id));
    setRot(0);
    setFlip(false);
    setHover(null);
    return true;
  };

  const onCell = (r: number, c: number) => {
    if (peek) return;
    const who = owner.get(key(r, c));
    if (who) {
      // 놓은 조각을 누르면 집어 든다(터치·키보드). 마우스는 pointerdown 에서 끌기로 처리한다.
      const rest = { ...placed };
      delete rest[who];
      setPlaced(rest);
      setSel(who);
      setRot(0);
      setFlip(false);
      setHover([r, c]);
      return;
    }
    if (lastPointer.current === "touch" && !(hover && hover[0] === r && hover[1] === c)) {
      setHover([r, c]);
      return;
    }
    if (!def) return;
    if (!placeAt(def.id, r, c, placed)) setHover([r, c]);
  };

  // 포인터 위치 → 판의 칸
  const cellAt = (clientX: number, clientY: number): Cell | null => {
    const el = svgRef.current;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const x = ((clientX - b.left) / b.width) * W - pad;
    const y = ((clientY - b.top) / b.height) * H - pad;
    const c = Math.floor(x / S);
    const r = Math.floor(y / S);
    return r >= 0 && c >= 0 && r < R && c < C ? [r, c] : null;
  };

  // 마우스 끌기: 조각 목록이나 판 위의 조각에서 시작해 놓고 싶은 칸에서 놓는다. 오른쪽 단추나 R·F 로 돌리고 뒤집는다.
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4;
      if (moved !== drag.moved) setDrag({ ...drag, moved });
      setHover(cellAt(e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const at = cellAt(e.clientX, e.clientY);
      if (drag.moved && at) placeAt(drag.id, at[0], at[1], placed);
      else if (drag.moved) setHover(null);
      setDrag(null);
    };
    const ctx = (e: Event) => {
      e.preventDefault();
      rotate();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("contextmenu", ctx);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("contextmenu", ctx);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, placed, shape, anchor, kinds]);

  const startDrag = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === "touch" || e.button !== 0 || peek) return;
    e.preventDefault();
    // 이미 놓은 조각이면 먼저 들어 올린다
    if (placed[id]) {
      const rest = { ...placed };
      delete rest[id];
      setPlaced(rest);
    }
    setSel(id);
    setRot(0);
    setFlip(false);
    setDrag({ id, sx: e.clientX, sy: e.clientY, moved: false });
  };


  // 키보드: R 돌리기, F 뒤집기
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "r" || e.key === "R") rotate();
      if (e.key === "f" || e.key === "F") mirror();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [rotate, mirror]);

  const showAnswer = () => {
    const s = typeof solution === "function" ? solution() : solution;
    if (!s) {
      setNoSolution(true);
      return;
    }
    const m: Record<string, Cell[]> = {};
    // 같은 이름의 조각이 둘 이상이면 아직 쓰지 않은 id 를 차례로 배정
    const free = [...pieces];
    for (const p of s) {
      const i = free.findIndex((x) => x.name === p.name);
      if (i >= 0) {
        m[free[i].id] = p.cells;
        free.splice(i, 1);
      }
    }
    setPeek(m);
  };

  const S = cellPx;
  const pad = 2;
  const W = C * S + pad * 2;
  const H = R * S + pad * 2;
  const colorOf = (id: string) => pieces.find((p) => p.id === id)?.color ?? "#999";

  return (
    <div ref={wrap} className="select-none">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mx-auto block w-full touch-manipulation"
            style={{ maxWidth: C * S * 1.3 + 8 }}
            role="img"
            aria-label="조각을 놓는 판"
            onPointerDown={(e) => (lastPointer.current = e.pointerType)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
          >
            {kinds.map((row, r) =>
              row.map((k, c) => {
                if (k === "void") return null;
                const id = owner.get(key(r, c));
                const g = ghost?.cells.some(([a, b]) => a === r && b === c);
                const label = labels?.[r]?.[c];
                const x = pad + c * S;
                const y = pad + r * S;
                const fill = id ? colorOf(id) : g ? (ghost!.ok ? colorOf(sel) : "#fca5a5") : k === "target" ? "#fef3c7" : "#fff";
                return (
                  <g
                    key={key(r, c)}
                    onPointerEnter={(e) => e.pointerType === "mouse" && setHover([r, c])}
                    onClick={() => onCell(r, c)}
                    onPointerDown={(e) => {
                      if (id && !peek) startDrag(e, id);
                    }}
                    style={{ cursor: drag ? "grabbing" : id ? "grab" : k === "open" ? "pointer" : "default" }}
                  >
                    <rect
                      x={x + 1}
                      y={y + 1}
                      width={S - 2}
                      height={S - 2}
                      rx={5}
                      fill={fill}
                      fillOpacity={g && !id ? 0.55 : 1}
                      stroke={k === "target" ? "#d97706" : id ? "rgba(0,0,0,.25)" : "#cbd5e1"}
                      strokeWidth={k === "target" ? 2.5 : 1}
                      strokeDasharray={k === "target" && !id ? "4 3" : undefined}
                    />
                    {label !== undefined && (
                      <text
                        x={x + S / 2}
                        y={y + S / 2 + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={label.length > 2 ? S * 0.3 : S * 0.38}
                        fontWeight={k === "target" ? 800 : 600}
                        fill={id ? "rgba(0,0,0,.55)" : k === "target" ? "#92400e" : "#475569"}
                        pointerEvents="none"
                      >
                        {label}
                      </text>
                    )}
                  </g>
                );
              }),
            )}
          </svg>
        </div>

        <div className="lg:w-64 lg:shrink-0">
          <p className="text-sm font-semibold text-muted">조각 고르기</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="조각 목록">
            {pieces.map((p) => {
              const isPlaced = !!shown[p.id];
              const cells = transform(SHAPES[p.name], 0, false);
              const pr = Math.max(...cells.map((x) => x[0])) + 1;
              const pc = Math.max(...cells.map((x) => x[1])) + 1;
              const u = 11;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={!!peek}
                    onClick={() => {
                      if (isPlaced) {
                        const rest = { ...placed };
                        delete rest[p.id];
                        setPlaced(rest);
                      }
                      setSel(p.id);
                      setRot(0);
                      setFlip(false);
                    }}
                    onPointerDown={(e) => startDrag(e, p.id)}
                    aria-pressed={sel === p.id}
                    aria-label={`${p.name.toUpperCase()} 조각${isPlaced ? ", 놓음(누르면 집어 들어요)" : ""}`}
                    className={`flex h-[62px] min-w-[62px] items-center justify-center rounded-card border-2 bg-surface p-1.5 transition ${
                      sel === p.id && !peek ? "border-accent shadow" : "border-line hover:border-accent/60"
                    } ${isPlaced ? "opacity-40" : ""}`}
                  >
                    <svg width={pc * u} height={pr * u} viewBox={`0 0 ${pc * u} ${pr * u}`} aria-hidden>
                      {cells.map(([a, b]) => (
                        <rect key={key(a, b)} x={b * u + 0.5} y={a * u + 0.5} width={u - 1} height={u - 1} rx={2} fill={p.color} />
                      ))}
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={rotate} disabled={!!peek} className="min-h-[44px] rounded-card border border-line bg-surface px-3 font-semibold hover:bg-bg disabled:opacity-40">
              ↻ 돌리기 <span className="text-xs text-muted">(R)</span>
            </button>
            <button type="button" onClick={mirror} disabled={!!peek} className="min-h-[44px] rounded-card border border-line bg-surface px-3 font-semibold hover:bg-bg disabled:opacity-40">
              ⇆ 뒤집기 <span className="text-xs text-muted">(F)</span>
            </button>
          </div>

          {def && !peek && (
            <div className="mt-3 rounded-card bg-bg p-2 text-center" aria-label="지금 놓을 모양">
              <svg width={(Math.max(...shape.map((x) => x[1])) + 1) * 16} height={(Math.max(...shape.map((x) => x[0])) + 1) * 16} aria-hidden className="mx-auto">
                {shape.map(([a, b]) => (
                  <rect key={key(a, b)} x={b * 16 + 1} y={a * 16 + 1} width={14} height={14} rx={3} fill={def.color} />
                ))}
              </svg>
              <p className="mt-1 text-xs text-muted">지금 놓을 모양</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPlaced({});
                setPeek(null);
                setNoSolution(false);
              }}
              className="min-h-[44px] rounded-card border border-line bg-surface px-3 font-semibold hover:bg-bg"
            >
              다시 시작
            </button>
            {peek ? (
              <button type="button" onClick={() => setPeek(null)} className="min-h-[44px] rounded-card bg-accent px-3 font-semibold text-accent-ink hover:brightness-110">
                내 풀이로 돌아가기
              </button>
            ) : (
              <button type="button" onClick={showAnswer} className="min-h-[44px] rounded-card border border-line bg-surface px-3 font-semibold hover:bg-bg">
                답 하나 보기
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted" aria-live="polite">
        {peek
          ? "정답 하나를 보여 주는 중이에요. 답은 하나가 아닐 수 있어요."
          : `덮은 칸 ${covered} / ${openCount}`}
        {!peek && <span className="ml-2 text-xs">· 조각을 끌어다 놓아요. 끄는 중 오른쪽 단추(또는 R)로 돌리고 F로 뒤집어요.</span>}
        {noSolution && <span className="ml-2 font-semibold text-bad">이 문제는 답을 찾지 못했어요.</span>}
      </p>
      {done && (
        <p className="mt-2 rounded-card bg-ok-soft p-3 font-semibold text-ok" role="status">
          🎉 {doneText}
        </p>
      )}
    </div>
  );
}
