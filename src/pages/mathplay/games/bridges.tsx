import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, tick, svgPoint } from "./kit";

// ==PURE-START==
export type LandId = "A" | "B" | "C" | "D";
export type Bridge = { id: number; a: LandId; b: LandId; d: string; mid: [number, number] };
export type MapId = "classic" | "minus" | "plus";

export const LAND_IDS: LandId[] = ["A", "B", "C", "D"];

const B = (id: number, a: LandId, b: LandId, d: string, mid: [number, number]): Bridge => ({ id, a, b, d, mid });

const CLASSIC: Bridge[] = [
  B(0, "C", "A", "M 140 60 L 140 150", [140, 105]),
  B(1, "C", "A", "M 215 60 L 215 148", [215, 104]),
  B(2, "D", "A", "M 140 320 L 140 230", [140, 275]),
  B(3, "D", "A", "M 215 320 L 215 232", [215, 276]),
  B(4, "A", "B", "M 250 190 L 400 190", [325, 190]),
  B(5, "C", "B", "M 460 60 L 460 150", [460, 105]),
  B(6, "D", "B", "M 460 320 L 460 230", [460, 275]),
];

export const MAPS: Record<MapId, { name: string; note: string; bridges: Bridge[] }> = {
  classic: { name: "옛날 지도 (아주 어려워요)", note: "옛날 독일 도시의 유명한 다리 지도예요. 모든 다리를 딱 한 번씩 건너는 길이 없는 것으로 유명해요. 그래도 도전해 볼까요?", bridges: CLASSIC },
  minus: { name: "쉬운 지도 1", note: "다리가 6개 있어요. 모든 다리를 딱 한 번씩만 건너 보세요.", bridges: CLASSIC.filter((b) => b.id !== 4) },
  plus: { name: "쉬운 지도 2", note: "다리가 8개 있어요. 모든 다리를 딱 한 번씩만 건너 보세요.", bridges: [...CLASSIC, B(7, "C", "D", "M 620 60 C 690 130 690 250 620 320", [672, 190])] },
};

export function other(b: Bridge, l: LandId): LandId {
  return b.a === l ? b.b : b.a;
}
export function touches(b: Bridge, l: LandId): boolean {
  return b.a === l || b.b === l;
}
export function degrees(bs: Bridge[]): Record<LandId, number> {
  const r: Record<LandId, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const b of bs) {
    r[b.a]++;
    r[b.b]++;
  }
  return r;
}
export function oddLands(bs: Bridge[]): LandId[] {
  const d = degrees(bs);
  return LAND_IDS.filter((l) => d[l] % 2 === 1);
}
/** start 에서 출발해 모든 다리를 한 번씩 건너는 길이 있는가 (완전탐색) */
export function canWalkAll(bs: Bridge[], start: LandId, used: Set<number> = new Set(), at: LandId = start): boolean {
  if (used.size === bs.length) return true;
  for (const b of bs) {
    if (used.has(b.id) || !touches(b, at)) continue;
    used.add(b.id);
    const ok = canWalkAll(bs, start, used, other(b, at));
    used.delete(b.id);
    if (ok) return true;
  }
  return false;
}
export function startsThatWork(bs: Bridge[]): LandId[] {
  return LAND_IDS.filter((l) => canWalkAll(bs, l));
}
/** 출발점과 건넌 다리 차례로 지금 서 있는 땅 */
export function walk(bs: Bridge[], start: LandId, path: number[]): LandId {
  let at = start;
  for (const id of path) at = other(bs.find((b) => b.id === id)!, at);
  return at;
}
/** 길(M..L 또는 M..C) 위의 점들 */
export function samplePath(d: string, n = 12): [number, number][] {
  const v = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (d.includes("C")) {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = v;
      const u = 1 - t;
      out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    } else out.push([v[0] + (v[2] - v[0]) * t, v[1] + (v[3] - v[1]) * t]);
  }
  return out;
}
/** 지도 위의 점이 어느 땅 위인가 (조금 넉넉하게) */
export function landAt(x: number, y: number): LandId | null {
  if (y < 72) return "C";
  if (y > 308) return "D";
  if (((x - 180) / 92) ** 2 + ((y - 190) / 66) ** 2 <= 1) return "A";
  if (((x - 460) / 82) ** 2 + ((y - 190) / 60) ** 2 <= 1) return "B";
  return null;
}
export function distToPoints(x: number, y: number, pts: [number, number][]): number {
  return Math.min(...pts.map(([px, py]) => Math.hypot(px - x, py - y)));
}
// ==PURE-END==

const LAND: Record<LandId, { kind: "island" | "bank"; label: [number, number]; stand: [number, number]; badge: [number, number] }> = {
  A: { kind: "island", label: [180, 172], stand: [180, 205], badge: [180, 232] },
  B: { kind: "island", label: [460, 172], stand: [460, 205], badge: [460, 232] },
  C: { kind: "bank", label: [50, 28], stand: [340, 28], badge: [100, 28] },
  D: { kind: "bank", label: [50, 352], stand: [340, 352], badge: [100, 352] },
};
const LAND_NAME: Record<LandId, string> = { A: "큰 섬 A", B: "작은 섬 B", C: "윗 강둑 C", D: "아랫 강둑 D" };

type Msg = { tone: "info" | "ok" | "bad"; text: string };
type G = { start: LandId | null; path: number[] };
const BIG = "min-h-[48px]! text-base";
const GOAL = 5;

export default function BridgesGame() {
  const [mapId, setMapId] = useState<MapId>("minus");
  const [g, setG] = useState<G>({ start: null, path: [] });
  const [hint, setHint] = useState(false);
  const [more, setMore] = useState(false);
  const [wins, setWins] = useState(0);
  const [stucks, setStucks] = useState(0);
  const [pt, setPt] = useState<[number, number] | null>(null);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "섬이나 강둑에서 손가락을 끌어 다음 땅으로 가 봐요!" });

  const gRef = useRef(g);
  const mapRef = useRef(mapId);
  const winsRef = useRef(0);
  const timer = useRef(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ touched: number | null } | null>(null);

  const clearTimer = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
  };
  useEffect(() => clearTimer, []);

  const commit = (ng: G) => {
    gRef.current = ng;
    setG(ng);
  };
  const bsOf = () => MAPS[mapRef.current].bridges;

  const resetRun = (text: string, id: MapId = mapRef.current) => {
    clearTimer();
    mapRef.current = id;
    setMapId(id);
    commit({ start: null, path: [] });
    setMsg({ tone: "info", text });
  };

  /** 다리 하나를 건너 본다. 건넜으면 true */
  const cross = (b: Bridge): boolean => {
    const cur = gRef.current;
    const bs = bsOf();
    if (!cur.start) {
      setMsg({ tone: "info", text: "먼저 땅에서 시작해요. 땅을 눌러 보세요!" });
      return false;
    }
    const at = walk(bs, cur.start, cur.path);
    if (cur.path.length === bs.length || !bs.some((x) => !cur.path.includes(x.id) && touches(x, at))) return false;
    if (cur.path.includes(b.id)) {
      setMsg({ tone: "bad", text: "그 다리는 이미 건넜어요. 다리는 한 번만 건널 수 있어요." });
      return false;
    }
    if (!touches(b, at)) {
      setMsg({ tone: "info", text: `지금 ${at}에 있어요. ${at}에서 이어진 다리로 가요.` });
      return false;
    }
    clearTimer();
    const np = [...cur.path, b.id];
    const to = other(b, at);
    commit({ start: cur.start, path: np });
    tick();
    if (np.length === bs.length) {
      winsRef.current += 1;
      const w = winsRef.current;
      setWins(w);
      cheer();
      if (w >= GOAL) setMsg({ tone: "ok", text: `⭐ 별 ${GOAL}개 완성! 정말 대단해요!` });
      else {
        setMsg({ tone: "ok", text: `⭐ 대단해요! 다리를 모두 한 번씩 건넜어요! 곧 다음 지도가 나와요.` });
        timer.current = window.setTimeout(() => resetRun("새 판이에요! 섬이나 강둑에서 손가락을 끌어 봐요!", mapRef.current === "minus" ? "plus" : mapRef.current === "plus" ? "minus" : mapRef.current), 2300);
      }
    } else if (!bs.some((x) => !np.includes(x.id) && touches(x, to))) {
      oops();
      setStucks((s) => s + 1);
      setMsg({ tone: "bad", text: mapRef.current === "classic" ? `아깝다! ${to}에서 막혔어요. 이 지도는 어디서 시작해도 이렇게 된다고 알려져 있어요. 쉬운 지도로 바꿔 볼까요?` : `아깝다! ${to}에서 막혔어요. 잠시 뒤 다시 시작해요. (‘한 걸음 뒤로’로 바로 고칠 수도 있어요)` });
      if (mapRef.current !== "classic") timer.current = window.setTimeout(() => resetRun("다시 해 봐요! 이번엔 다른 길로 가 볼까요?"), 3000);
    } else {
      setMsg({ tone: "info", text: `${at}에서 ${to}로 건넜어요! 계속 끌어 봐요. (${np.length}/${bs.length})` });
    }
    return true;
  };

  const undo = () => {
    const cur = gRef.current;
    if (cur.path.length === 0) return;
    clearTimer();
    commit({ start: cur.start, path: cur.path.slice(0, -1) });
    tick();
    setMsg({ tone: "info", text: "한 걸음 뒤로 갔어요." });
  };

  const pickLand = (l: LandId) => {
    const cur = gRef.current;
    const bs = bsOf();
    if (!cur.start || (cur.path.length === 0 && l !== cur.start)) {
      clearTimer();
      commit({ start: l, path: [] });
      tick();
      setMsg({ tone: "info", text: `${l}에서 시작해요! ${l}에서 손가락을 끌거나, 반짝이는 다리를 눌러요.` });
      return;
    }
    const at = walk(bs, cur.start, cur.path);
    const direct = bs.filter((b) => !cur.path.includes(b.id) && touches(b, at) && other(b, at) === l);
    if (direct.length === 1) cross(direct[0]);
    else if (direct.length > 1) setMsg({ tone: "info", text: `${at}와 ${l} 사이에 다리가 ${direct.length}개 있어요. 건널 다리를 눌러요.` });
  };

  const svgXY = (e: React.PointerEvent): [number, number] => svgPoint(svgRef.current!, e.clientX, e.clientY);

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const [x, y] = svgXY(e);
    const L = landAt(x, y);
    const cur = gRef.current;
    const bs = bsOf();
    if (!L) return;
    const over = !!cur.start && (cur.path.length === bs.length || !bs.some((b) => !cur.path.includes(b.id) && touches(b, walk(bs, cur.start!, cur.path))));
    if (over) return;
    if (!cur.start || (cur.path.length === 0 && L !== cur.start)) {
      clearTimer();
      commit({ start: L, path: [] });
      tick();
      setMsg({ tone: "info", text: `${L}에서 시작! 손가락을 끌어 다음 땅으로 가 봐요.` });
    } else if (L !== walk(bs, cur.start, cur.path)) return;
    drag.current = { touched: null };
    setPt([x, y]);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 무시 */
    }
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const [x, y] = svgXY(e);
    setPt([x, y]);
    const cur = gRef.current;
    const bs = bsOf();
    if (!cur.start) return;
    const at = walk(bs, cur.start, cur.path);
    let best: number | null = null;
    let bd = 34;
    for (const b of bs) {
      if (!touches(b, at)) continue;
      const d = distToPoints(x, y, samplePath(b.d));
      if (d < bd) {
        bd = d;
        best = b.id;
      }
    }
    if (best !== null) drag.current.touched = best;
    const L = landAt(x, y);
    if (!L || L === at) return;
    const cand = bs.filter((b) => !cur.path.includes(b.id) && touches(b, at) && other(b, at) === L);
    const last = cur.path.length ? bs.find((b) => b.id === cur.path[cur.path.length - 1])! : null;
    if (cand.length) {
      const pick = cand.find((b) => b.id === drag.current!.touched) ?? cand[0];
      cross(pick);
      drag.current.touched = null;
    } else if (last && touches(last, at) && other(last, at) === L && drag.current.touched === last.id) {
      undo();
      drag.current.touched = null;
    }
  };

  const onUp = () => {
    drag.current = null;
    setPt(null);
  };

  const bs = MAPS[mapId].bridges;
  const map = MAPS[mapId];
  const deg = degrees(bs);
  const odd = oddLands(bs);
  const good = startsThatWork(bs);
  const at = g.start ? walk(bs, g.start, g.path) : null;
  const used = new Set(g.path);
  const done = g.path.length === bs.length;
  const free = at ? bs.filter((b) => !used.has(b.id) && touches(b, at)) : [];
  const stuck = !!g.start && !done && free.length === 0;
  const over = done || stuck;
  const guide = !g.start ? (bs.find((b) => good.includes(b.a)) ?? bs[0]) : null;

  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
  const route = g.start ? [g.start, ...g.path.map((_, i) => walk(bs, g.start!, g.path.slice(0, i + 1)))].join(" → ") : "";

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="mb-2 rounded-card bg-accent-soft px-3 py-2 text-base font-bold">
          {!g.start ? "땅에서 손가락을 끌어 다리를 건너요 (다리마다 한 번만!)" : over ? (done ? "성공! 별을 받았어요" : "막혔어요. 곧 다시 시작해요") : "‘나’를 끌어 다음 땅까지 가 봐요. 반짝이는 다리를 눌러도 돼요"}
        </p>
        <p className="mb-2 text-base text-muted">{map.note}</p>

        <svg
          ref={svgRef}
          viewBox="0 0 700 380"
          className="block h-auto w-full select-none rounded-card"
          style={{ touchAction: "none" }}
          role="group"
          aria-label={`다리 지도. 땅 4곳과 다리 ${bs.length}개`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <rect width="700" height="380" fill="#bae6fd" />
          {[60, 120, 255, 330].map((y, i) => (
            <path key={i} d={`M ${20 + i * 40} ${y} q 12 -8 24 0 t 24 0`} fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.8" />
          ))}

          {bs.map((b) => {
            const isUsed = used.has(b.id);
            const ok = !!at && !over && !isUsed && touches(b, at);
            const order = g.path.indexOf(b.id) + 1;
            return (
              <g
                key={b.id}
                role="button"
                tabIndex={0}
                aria-label={`다리 ${b.id + 1}: ${b.a}와 ${b.b}를 이어요. ${isUsed ? "건넌 다리" : "아직 안 건넜어요"}`}
                onClick={() => cross(b)}
                onKeyDown={keyAct(() => cross(b))}
                style={{ cursor: "pointer", outline: "none" }}
              >
                {ok && <path d={b.d} fill="none" stroke="#f59e0b" strokeWidth="30" strokeLinecap="round" opacity="0.65" className="animate-pulse" />}
                <path d={b.d} fill="none" stroke={isUsed ? "#166534" : "#78350f"} strokeWidth="20" strokeLinecap="butt" />
                <path d={b.d} fill="none" stroke={isUsed ? "#86efac" : "#e9c78a"} strokeWidth="13" strokeLinecap="butt" />
                <path d={b.d} fill="none" stroke={isUsed ? "#166534" : "#a16207"} strokeWidth="13" strokeDasharray="2 8" strokeLinecap="butt" opacity="0.6" />
                <path d={b.d} fill="none" stroke="transparent" strokeWidth="64" pointerEvents="stroke" />
                {isUsed && (
                  <g>
                    <circle cx={b.mid[0]} cy={b.mid[1]} r="16" fill="#166534" />
                    <text x={b.mid[0]} y={b.mid[1] + 7} textAnchor="middle" fontSize="20" fontWeight="800" fill="#fff">
                      {order}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {LAND_IDS.map((l) => {
            const info = LAND[l];
            const pickable = !g.start || (g.path.length === 0 && l !== g.start);
            const rec = hint && !g.start && good.includes(l);
            return (
              <g key={l} role="button" tabIndex={0} aria-label={`${LAND_NAME[l]}${at === l ? " (지금 여기)" : ""}, 다리 ${deg[l]}개`} onClick={() => pickLand(l)} onKeyDown={keyAct(() => pickLand(l))} style={{ cursor: "pointer", outline: "none" }}>
                {info.kind === "island" ? (
                  <ellipse cx={l === "A" ? 180 : 460} cy="190" rx={l === "A" ? 80 : 70} ry={l === "A" ? 55 : 50} fill={at === l ? "#bbf7d0" : "#d9f99d"} stroke={rec ? "#7c3aed" : pickable ? "#f59e0b" : "#4d7c0f"} strokeWidth={pickable || rec ? 6 : 3} className={pickable ? "animate-pulse" : ""} />
                ) : (
                  <rect x="-4" y={l === "C" ? -4 : 310} width="708" height="74" rx="10" fill={at === l ? "#bbf7d0" : "#d9f99d"} stroke={rec ? "#7c3aed" : pickable ? "#f59e0b" : "#4d7c0f"} strokeWidth={pickable || rec ? 6 : 3} className={pickable ? "animate-pulse" : ""} />
                )}
                <text x={info.label[0]} y={info.label[1] + 8} textAnchor="middle" fontSize="30" fontWeight="800" fill="#365314">
                  {l}
                </text>
                {g.start === l && (
                  <text x={info.label[0]} y={info.label[1] + 34} textAnchor="middle" fontSize="20" fontWeight="700" fill="#365314">
                    시작
                  </text>
                )}
                {rec && (
                  <text x={info.label[0] + (info.kind === "bank" ? 120 : 0)} y={info.label[1] + (info.kind === "bank" ? 8 : 54)} textAnchor="middle" fontSize="20" fontWeight="800" fill="#6d28d9">
                    여기서 시작!
                  </text>
                )}
                {hint && (
                  <g>
                    <circle cx={info.badge[0]} cy={info.badge[1] - 4} r="21" fill={deg[l] % 2 ? "#fecaca" : "#e0e7ff"} stroke={deg[l] % 2 ? "#b91c1c" : "#4338ca"} strokeWidth="3" />
                    <text x={info.badge[0]} y={info.badge[1] + 5} textAnchor="middle" fontSize="26" fontWeight="800" fill={deg[l] % 2 ? "#b91c1c" : "#3730a3"}>
                      {deg[l]}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 처음 3초 손짓: 손가락이 다리를 따라 움직여요 */}
          {guide && (
            <g pointerEvents="none">
              <circle r="20" fill="#fff" stroke="#ea580c" strokeWidth="5" opacity="0.95">
                <animateMotion dur="1.8s" repeatCount="indefinite" path={guide.d} />
              </circle>
              <text x={samplePath(guide.d)[0][0] + 28} y={samplePath(guide.d)[0][1] - 14} fontSize="22" fontWeight="800" fill="#c2410c">
                끌어 봐요!
              </text>
            </g>
          )}

          {pt && at && (
            <line x1={LAND[at].stand[0]} y1={LAND[at].stand[1]} x2={pt[0]} y2={pt[1] - 34} stroke="#ea580c" strokeWidth="6" strokeDasharray="4 10" strokeLinecap="round" pointerEvents="none" />
          )}
          {at && (
            <g pointerEvents="none" transform={pt ? `translate(${pt[0] - LAND[at].stand[0]}, ${pt[1] - 34 - LAND[at].stand[1]})` : undefined}>
              <circle cx={LAND[at].stand[0]} cy={LAND[at].stand[1] + 4} r="22" fill="rgba(0,0,0,0.25)" />
              <circle cx={LAND[at].stand[0]} cy={LAND[at].stand[1]} r="24" fill="#ea580c" stroke="#fff" strokeWidth="4" />
              <text x={LAND[at].stand[0]} y={LAND[at].stand[1] + 8} textAnchor="middle" fontSize="22" fontWeight="800" fill="#fff">
                나
              </text>
            </g>
          )}
        </svg>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="건넌 다리" value={`${g.path.length}/${bs.length}`} tone={done ? "ok" : "plain"} />
        <Stat label="⭐ 별" value={`${wins}/${GOAL}`} tone={wins ? "ok" : "plain"} />
        <Stat label="다시 해 본 횟수" value={stucks} />
      </div>
      {route && <p className="text-base text-muted">지나온 길: <strong className="text-ink">{route}</strong></p>}
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton onClick={undo} disabled={g.path.length === 0} className={BIG}>↶ 한 걸음 뒤로</GButton>
        <GButton variant="primary" onClick={() => resetRun("다시 시작해요! 섬이나 강둑에서 손가락을 끌어 봐요.")} disabled={!g.start} className={BIG}>↻ 다시 하기</GButton>
        <GButton variant="soft" pressed={hint} onClick={() => setHint(!hint)} className={BIG}>{hint ? "힌트 숨기기" : "💡 힌트 보기"}</GButton>
        <GButton pressed={more} onClick={() => setMore(!more)} className={BIG}>{more ? "어려운 도전 닫기" : "더 어려운 도전"}</GButton>
      </div>

      {more && (
        <Board className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">지도 고르기</span>
          {(["minus", "plus", "classic"] as MapId[]).map((id) => (
            <GButton key={id} variant={id === mapId ? "soft" : "ghost"} pressed={id === mapId} onClick={() => resetRun("새 지도예요. 섬이나 강둑에서 손가락을 끌어 봐요!", id)} className={BIG}>
              {MAPS[id].name}
            </GButton>
          ))}
        </Board>
      )}

      {hint && (
        <Board className="text-base leading-relaxed">
          <p>땅 위의 숫자는 <strong>그 땅에 이어진 다리가 몇 개</strong>인지 알려 줘요.</p>
          {odd.length === 2 ? (
            <p>빨간 숫자(홀수)인 땅이 2곳이에요: <strong>{odd.join(", ")}</strong>. 그중 한 곳에서 시작하면 모든 다리를 건널 수 있어요!</p>
          ) : odd.length === 0 ? (
            <p>빨간 숫자가 없어요. 어디서 시작해도 돼요.</p>
          ) : (
            <p>빨간 숫자(홀수)인 땅이 {odd.length}곳이나 있어요. 이런 지도는 어디서 시작해도 모든 다리를 한 번씩 건널 수 없다고 알려져 있어요.</p>
          )}
        </Board>
      )}
    </div>
  );
}
