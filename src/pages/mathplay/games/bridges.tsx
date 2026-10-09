import { useState } from "react";
import { Board, GButton, Say, Stat } from "./kit";

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
  classic: { name: "쾨니히스베르크 (다리 7개)", note: "옛날 도시 쾨니히스베르크의 다리 지도예요.", bridges: CLASSIC },
  minus: { name: "다리 하나 없애기 (6개)", note: "두 섬을 잇던 가운뎃다리를 없앤 지도예요.", bridges: CLASSIC.filter((b) => b.id !== 4) },
  plus: { name: "다리 하나 더하기 (8개)", note: "두 강둑을 바깥쪽으로 잇는 다리를 하나 더한 지도예요.", bridges: [...CLASSIC, B(7, "C", "D", "M 620 60 C 690 130 690 250 620 320", [672, 190])] },
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
// ==PURE-END==

const LAND: Record<LandId, { kind: "island" | "bank"; label: [number, number]; stand: [number, number]; badge: [number, number] }> = {
  A: { kind: "island", label: [180, 172], stand: [180, 205], badge: [180, 232] },
  B: { kind: "island", label: [460, 172], stand: [460, 205], badge: [460, 232] },
  C: { kind: "bank", label: [50, 28], stand: [340, 28], badge: [100, 28] },
  D: { kind: "bank", label: [50, 352], stand: [340, 352], badge: [100, 352] },
};
const LAND_NAME: Record<LandId, string> = { A: "큰 섬 A", B: "작은 섬 B", C: "윗 강둑 C", D: "아랫 강둑 D" };

type Msg = { tone: "info" | "ok" | "bad"; text: string };

export default function BridgesGame() {
  const [mapId, setMapId] = useState<MapId>("classic");
  const [start, setStart] = useState<LandId | null>(null);
  const [path, setPath] = useState<number[]>([]);
  const [hint, setHint] = useState(false);
  const [wins, setWins] = useState(0);
  const [stucks, setStucks] = useState(0);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "먼저 출발할 땅을 눌러 보세요." });

  const map = MAPS[mapId];
  const bs = map.bridges;
  const deg = degrees(bs);
  const odd = oddLands(bs);
  const at = start ? walk(bs, start, path) : null;
  const used = new Set(path);
  const done = path.length === bs.length;
  const free = at ? bs.filter((b) => !used.has(b.id) && touches(b, at)) : [];
  const stuck = !!start && !done && free.length === 0;
  const over = done || stuck;

  const reset = (text = "처음부터 다시! 출발할 땅을 눌러 보세요.") => {
    setStart(null);
    setPath([]);
    setMsg({ tone: "info", text });
  };

  const changeMap = (id: MapId) => {
    setMapId(id);
    setStart(null);
    setPath([]);
    setMsg({ tone: "info", text: "지도를 바꿨어요. 출발할 땅을 눌러 보세요." });
  };

  const cross = (b: Bridge) => {
    if (!start || !at || over) {
      if (!start) setMsg({ tone: "info", text: "먼저 출발할 땅을 눌러 주세요." });
      return;
    }
    if (used.has(b.id)) {
      setMsg({ tone: "bad", text: "이미 건넌 다리예요. 다리는 한 번만 건널 수 있어요." });
      return;
    }
    if (!touches(b, at)) {
      setMsg({ tone: "info", text: `지금 ${at}에 있어요. ${at}에 이어진 다리를 눌러 주세요.` });
      return;
    }
    const np = [...path, b.id];
    const to = other(b, at);
    setPath(np);
    if (np.length === bs.length) {
      setWins((w) => w + 1);
      setMsg({ tone: "ok", text: `성공! 다리 ${bs.length}개를 모두 한 번씩 건너 ${to}에 도착했어요.` });
    } else if (!bs.some((x) => !np.includes(x.id) && touches(x, to))) {
      setStucks((s) => s + 1);
      setMsg({
        tone: "bad",
        text:
          mapId === "classic"
            ? `${to}에서 막혔어요. 건너지 못한 다리가 ${bs.length - np.length}개 남았어요. 이 지도는 어디서 출발해도 이렇게 된다고 알려져 있어요. ‘지도 바꾸기’로 다른 지도를 해 봐요.`
            : `${to}에서 막혔어요. 건너지 못한 다리가 ${bs.length - np.length}개 남았어요. 되돌리기로 한 걸음 물러나 다른 길을 찾아봐요.`,
      });
    } else {
      setMsg({ tone: "info", text: `${at}에서 ${to}로 건넜어요. (${np.length}/${bs.length})` });
    }
  };

  const pickLand = (l: LandId) => {
    if (!start) {
      setStart(l);
      setMsg({ tone: "info", text: `${l}에서 출발해요. 이어진 다리를 눌러 건너 보세요.` });
      return;
    }
    if (path.length === 0 && l !== start) {
      setStart(l);
      setMsg({ tone: "info", text: `출발점을 ${l}로 바꿨어요. 이어진 다리를 눌러 보세요.` });
      return;
    }
    if (over || !at) return;
    const direct = free.filter((b) => other(b, at) === l);
    if (direct.length === 1) cross(direct[0]);
    else if (direct.length > 1) setMsg({ tone: "info", text: `${at}와 ${l} 사이에 다리가 ${direct.length}개 있어요. 건널 다리를 직접 눌러 주세요.` });
    else if (l !== at) setMsg({ tone: "info", text: `${at}에서 ${l}로 바로 가는 남은 다리가 없어요.` });
  };

  const undo = () => {
    if (path.length === 0) return;
    setPath(path.slice(0, -1));
    setMsg({ tone: "info", text: "한 걸음 되돌렸어요." });
  };

  const route = start ? [start, ...path.map((_, i) => walk(bs, start, path.slice(0, i + 1)))].join(" → ") : "";
  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };

  return (
    <div className="space-y-3">
      <Board>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="지도 바꾸기">
          {(Object.keys(MAPS) as MapId[]).map((id) => (
            <GButton key={id} variant={id === mapId ? "soft" : "ghost"} pressed={id === mapId} onClick={() => changeMap(id)} className="text-sm">
              {MAPS[id].name}
            </GButton>
          ))}
        </div>
        <p className="mb-2 text-sm text-muted">{map.note}</p>

        <svg viewBox="0 0 700 380" className="block h-auto w-full select-none rounded-card" style={{ touchAction: "manipulation" }} role="group" aria-label={`다리 지도. 땅 4곳과 다리 ${bs.length}개`}>
          <rect width="700" height="380" fill="#bae6fd" />
          {[60, 120, 255, 330].map((y, i) => (
            <path key={i} d={`M ${20 + i * 40} ${y} q 12 -8 24 0 t 24 0`} fill="none" stroke="#7dd3fc" strokeWidth="2" opacity="0.8" />
          ))}

          {bs.map((b) => {
            const isUsed = used.has(b.id);
            const ok = !!at && !over && !isUsed && touches(b, at);
            const order = path.indexOf(b.id) + 1;
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
                {ok && <path d={b.d} fill="none" stroke="#f59e0b" strokeWidth="26" strokeLinecap="round" opacity="0.55" className="animate-pulse" />}
                <path d={b.d} fill="none" stroke={isUsed ? "#166534" : "#78350f"} strokeWidth="16" strokeLinecap="butt" />
                <path d={b.d} fill="none" stroke={isUsed ? "#86efac" : "#e9c78a"} strokeWidth="10" strokeLinecap="butt" />
                <path d={b.d} fill="none" stroke={isUsed ? "#166534" : "#a16207"} strokeWidth="10" strokeDasharray="2 8" strokeLinecap="butt" opacity="0.6" />
                <path d={b.d} fill="none" stroke="transparent" strokeWidth="56" pointerEvents="stroke" />
                {isUsed && (
                  <g>
                    <circle cx={b.mid[0]} cy={b.mid[1]} r="13" fill="#166534" />
                    <text x={b.mid[0]} y={b.mid[1] + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff">
                      {order}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {LAND_IDS.map((l) => {
            const info = LAND[l];
            const pickable = !start || (path.length === 0 && l !== start);
            const isStart = start === l;
            const isAt = at === l;
            return (
              <g key={l} role="button" tabIndex={0} aria-label={`${LAND_NAME[l]}${isAt ? " (지금 여기)" : ""}, 다리 ${deg[l]}개`} onClick={() => pickLand(l)} onKeyDown={keyAct(() => pickLand(l))} style={{ cursor: "pointer", outline: "none" }}>
                {info.kind === "island" ? (
                  <ellipse cx={l === "A" ? 180 : 460} cy="190" rx={l === "A" ? 80 : 70} ry={l === "A" ? 55 : 50} fill={isAt ? "#bbf7d0" : "#d9f99d"} stroke={pickable ? "#f59e0b" : "#4d7c0f"} strokeWidth={pickable ? 5 : 3} className={pickable ? "animate-pulse" : ""} />
                ) : (
                  <rect x="-4" y={l === "C" ? -4 : 310} width="708" height="74" rx="10" fill={isAt ? "#bbf7d0" : "#d9f99d"} stroke={pickable ? "#f59e0b" : "#4d7c0f"} strokeWidth={pickable ? 5 : 3} className={pickable ? "animate-pulse" : ""} />
                )}
                <text x={info.label[0]} y={info.label[1] + 6} textAnchor="middle" fontSize="22" fontWeight="800" fill="#365314">
                  {l}
                </text>
                {isStart && (
                  <text x={info.label[0]} y={info.label[1] + 28} textAnchor="middle" fontSize="13" fontWeight="700" fill="#365314">
                    출발
                  </text>
                )}
                {hint && (
                  <g>
                    <circle cx={info.badge[0]} cy={info.badge[1] - 4} r="17" fill={deg[l] % 2 ? "#fecaca" : "#e0e7ff"} stroke={deg[l] % 2 ? "#b91c1c" : "#4338ca"} strokeWidth="2" />
                    <text x={info.badge[0]} y={info.badge[1] + 3} textAnchor="middle" fontSize="20" fontWeight="800" fill={deg[l] % 2 ? "#b91c1c" : "#3730a3"}>
                      {deg[l]}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {at && (
            <g pointerEvents="none">
              <circle cx={LAND[at].stand[0]} cy={LAND[at].stand[1]} r="17" fill="#ea580c" stroke="#fff" strokeWidth="3" />
              <text x={LAND[at].stand[0]} y={LAND[at].stand[1] + 6} textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">
                나
              </text>
            </g>
          )}
        </svg>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="건넌 다리" value={`${path.length}/${bs.length}`} tone={done ? "ok" : "plain"} />
        <Stat label="성공" value={wins} tone={wins ? "ok" : "plain"} />
        <Stat label="막힌 횟수" value={stucks} />
      </div>
      {route && <p className="text-sm text-muted">지나온 길: <strong className="text-ink">{route}</strong></p>}
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton onClick={undo} disabled={path.length === 0}>↶ 되돌리기</GButton>
        <GButton onClick={() => reset()} disabled={!start}>↻ 처음부터</GButton>
        <GButton variant="soft" pressed={hint} onClick={() => setHint(!hint)}>{hint ? "힌트 끄기" : "힌트 켜기"}</GButton>
      </div>

      {hint && (
        <Board className="text-sm leading-relaxed">
          <p>
            각 땅에 이어진 다리 수: {LAND_IDS.map((l) => `${l}=${deg[l]}`).join(", ")}
          </p>
          <p>
            다리가 <strong>홀수 개</strong>인 땅은 <strong>{odd.length}곳</strong>이에요{odd.length ? ` (${odd.join(", ")})` : ""}.
            홀수 개인 땅이 0곳이거나 2곳이면 모든 다리를 한 번씩 건너는 길이 있다고 알려져 있어요.
          </p>
        </Board>
      )}
    </div>
  );
}
