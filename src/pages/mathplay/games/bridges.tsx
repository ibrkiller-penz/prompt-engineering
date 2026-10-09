import { useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, oops, stageClear, tick, useStage } from "./kit";

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

/** 레벨용 다리 자리 12곳 (0~7은 위와 같고, 8~11을 더 놓을 수 있어요) */
export const SLOTS: Bridge[] = [
  ...CLASSIC,
  B(7, "C", "D", "M 620 60 C 690 130 690 250 620 320", [672, 190]),
  B(8, "C", "B", "M 522 60 L 522 166", [522, 108]),
  B(9, "D", "B", "M 522 320 L 522 204", [522, 266]),
  B(10, "A", "B", "M 236 160 Q 323 84 410 160", [323, 122]),
  B(11, "A", "B", "M 236 214 Q 323 296 410 214", [323, 255]),
];
/** 레벨별 다리 수 */
export const LEVEL_K = [4, 5, 5, 6, 6, 7, 8, 9, 10, 11];
/** 모든 땅에 다리가 있고, 이어져 있고, 홀수 땅이 0곳 또는 2곳인 지도 = 한 번에 건너는 길이 있는 지도 */
export function solvable(bs: Bridge[]): boolean {
  const d = degrees(bs);
  if (LAND_IDS.some((l) => d[l] === 0)) return false;
  const seen = new Set<LandId>(["A"]);
  const st: LandId[] = ["A"];
  while (st.length) {
    const l = st.pop()!;
    for (const b of bs) if (touches(b, l) && !seen.has(other(b, l))) {
      seen.add(other(b, l));
      st.push(other(b, l));
    }
  }
  return seen.size === 4 && oddLands(bs).length <= 2;
}
const cache: Record<number, Bridge[][]> = {};
/** 다리 k개짜리 풀 수 있는 지도 모두 */
export function mapsWith(k: number): Bridge[][] {
  if (cache[k]) return cache[k];
  const out: Bridge[][] = [];
  for (let m = 0; m < 1 << SLOTS.length; m++) {
    let c = 0;
    for (let i = 0; i < SLOTS.length; i++) if (m & (1 << i)) c++;
    if (c !== k) continue;
    const bs = SLOTS.filter((_, i) => m & (1 << i));
    if (solvable(bs)) out.push(bs);
  }
  return (cache[k] = out);
}
export function levelMap(level: number, rnd: () => number = Math.random): Bridge[] {
  const L = Math.min(10, Math.max(1, level));
  let all = mapsWith(LEVEL_K[L - 1]);
  // 레벨 3·5는 출발할 땅이 정해진(홀수 땅 2곳) 지도만
  if (L === 3 || L === 5) all = all.filter((m) => oddLands(m).length === 2);
  return all[Math.floor(rnd() * all.length)];
}

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
    if (d.includes("Q")) {
      const [x0, y0, x1, y1, x2, y2] = v;
      const u = 1 - t;
      out.push([u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]);
    } else if (d.includes("C")) {
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

const REDUCE = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** 주인공 곰돌이 (가운데가 0,0) */
function Bear({ mood }: { mood: "ok" | "happy" | "sad" }) {
  return (
    <g>
      <ellipse cx="0" cy="26" rx="20" ry="5" fill="rgba(0,0,0,0.25)" />
      <circle cx="-17" cy="-17" r="9" fill="url(#br-bear)" stroke="#7c2d12" strokeWidth="2.5" />
      <circle cx="17" cy="-17" r="9" fill="url(#br-bear)" stroke="#7c2d12" strokeWidth="2.5" />
      <circle cx="-17" cy="-17" r="4" fill="#fecdd3" />
      <circle cx="17" cy="-17" r="4" fill="#fecdd3" />
      <circle cx="0" cy="0" r="24" fill="url(#br-bear)" stroke="#7c2d12" strokeWidth="3" />
      <ellipse cx="0" cy="8" rx="11" ry="8" fill="#ffedd5" />
      <circle cx="-8" cy="-4" r="3.5" fill="#1c1917" />
      <circle cx="8" cy="-4" r="3.5" fill="#1c1917" />
      <circle cx="-7" cy="-5" r="1.2" fill="#fff" />
      <circle cx="9" cy="-5" r="1.2" fill="#fff" />
      <circle cx="-15" cy="5" r="3.5" fill="#fb7185" opacity="0.6" />
      <circle cx="15" cy="5" r="3.5" fill="#fb7185" opacity="0.6" />
      <ellipse cx="0" cy="4" rx="3.5" ry="2.5" fill="#1c1917" />
      <path d={mood === "sad" ? "M -5 13 Q 0 9 5 13" : mood === "happy" ? "M -6 9 Q 0 17 6 9" : "M -4 10 Q 0 14 4 10"} fill={mood === "happy" ? "#be123c" : "none"} stroke="#1c1917" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

type Msg = { tone: "info" | "ok" | "bad"; text: string };
type G = { start: LandId | null; path: number[] };
const BIG = "min-h-[48px]! text-base";
const ROUNDS = 3;

export default function BridgesGame() {
  const level = useStage();
  const [bsState, setBs] = useState<Bridge[]>(() => levelMap(level));
  const [round, setRound] = useState(1);
  const [g, setG] = useState<G>({ start: null, path: [] });
  const [hint, setHint] = useState(false);
  const [stucks, setStucks] = useState(0);
  // 다리를 건널 때 ‘나’가 다리를 따라 걸어가는 애니메이션
  const [walkAnim, setWalkAnim] = useState<{ d: string; rev: boolean; k: number } | null>(null);
  const animTimer = useRef(0);
  const [msg, setMsg] = useState<Msg>({ tone: "info", text: "땅을 눌러 출발해요!" });

  const gRef = useRef(g);
  const mapRef = useRef(bsState);
  const roundRef = useRef(1);
  const timer = useRef(0);

  const clearTimer = () => {
    window.clearTimeout(timer.current);
    timer.current = 0;
  };
  useEffect(() => () => {
    clearTimer();
    window.clearTimeout(animTimer.current);
  }, []);

  const commit = (ng: G) => {
    gRef.current = ng;
    setG(ng);
  };
  const bsOf = () => mapRef.current;

  const resetRun = (text: string, next: Bridge[] = mapRef.current) => {
    clearTimer();
    mapRef.current = next;
    setBs(next);
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
    // 다리 그림은 한쪽 끝에서 다른 쪽 끝으로 그려져 있어서, 출발한 땅 쪽 끝이 어디인지 보고 걷는 방향을 정한다
    const pts = samplePath(b.d);
    const st = LAND[at].stand;
    const rev = Math.hypot(pts[0][0] - st[0], pts[0][1] - st[1]) > Math.hypot(pts[pts.length - 1][0] - st[0], pts[pts.length - 1][1] - st[1]);
    window.clearTimeout(animTimer.current);
    setWalkAnim({ d: b.d, rev, k: Date.now() });
    animTimer.current = window.setTimeout(() => setWalkAnim(null), 520);
    if (np.length === bs.length) {
      cheer();
      if (roundRef.current >= ROUNDS) {
        setMsg({ tone: "ok", text: `⭐ 대단해요! 레벨 ${level}의 지도를 모두 건넜어요!` });
        timer.current = window.setTimeout(() => stageClear(), 1200);
      } else {
        setMsg({ tone: "ok", text: `⭐ 대단해요! 다리를 모두 한 번씩 건넜어요! 곧 다음 지도가 나와요.` });
        timer.current = window.setTimeout(() => {
          roundRef.current += 1;
          setRound(roundRef.current);
          resetRun("새 지도예요! 땅을 눌러 출발해요!", levelMap(level));
        }, 2300);
      }
    } else if (!bs.some((x) => !np.includes(x.id) && touches(x, to))) {
      oops();
      setStucks((s) => s + 1);
      setMsg({ tone: "bad", text: `아깝다! ${to}에서 막혔어요. 잠시 뒤 다시 시작해요. (‘한 걸음 뒤로’로 바로 고칠 수도 있어요)` });
      timer.current = window.setTimeout(() => resetRun("다시 해 봐요! 이번엔 다른 길로 가 볼까요?"), 3000);
    } else {
      setMsg({ tone: "info", text: `${at}에서 ${to}로 건넜어요! 다음 땅을 눌러요. (${np.length}/${bs.length})` });
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
    // 아직 출발 전이거나, 출발만 하고 이어지지 않은 땅을 누르면 출발점을 그 땅으로 바꾼다
    const linkedFromStart = !!cur.start && bs.some((b) => touches(b, cur.start!) && other(b, cur.start!) === l);
    if (!cur.start || (cur.path.length === 0 && l !== cur.start && !linkedFromStart)) {
      clearTimer();
      commit({ start: l, path: [] });
      tick();
      setMsg({ tone: "info", text: `${l}에서 출발! 반짝이는 땅을 눌러 다리를 건너요.` });
      return;
    }
    const at = walk(bs, cur.start, cur.path);
    if (cur.path.length === bs.length || !bs.some((x) => !cur.path.includes(x.id) && touches(x, at))) return;
    if (l === at) {
      setMsg({ tone: "info", text: `지금 ${at}에 있어요. 다리로 이어진 다른 땅을 눌러요.` });
      return;
    }
    // 같은 두 땅을 잇는 다리는 어느 것을 건너도 똑같아서 아직 안 건넌 것 하나를 고른다
    const direct = bs.filter((b) => !cur.path.includes(b.id) && touches(b, at) && other(b, at) === l);
    if (direct.length) cross(direct[0]);
    else if (bs.some((b) => touches(b, at) && other(b, at) === l)) {
      oops();
      setMsg({ tone: "bad", text: `${at}와 ${l} 사이 다리는 이미 다 건넜어요. 반짝이는 땅으로 가요.` });
    } else {
      oops();
      setMsg({ tone: "bad", text: `${at}에서 ${l}로 바로 가는 다리가 없어요. 반짝이는 땅을 눌러요.` });
    }
  };

  const bs = bsState;
  const deg = degrees(bs);
  const odd = oddLands(bs);
  const good = startsThatWork(bs);
  const at = g.start ? walk(bs, g.start, g.path) : null;
  const used = new Set(g.path);
  const done = g.path.length === bs.length;
  const free = at ? bs.filter((b) => !used.has(b.id) && touches(b, at)) : [];
  const stuck = !!g.start && !done && free.length === 0;
  const over = done || stuck;
  const nextLands = new Set<LandId>(free.map((b) => other(b, at!)));
  const guideLand: LandId | null = !g.start ? (good[0] ?? "A") : null;

  const keyAct = (fn: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
  const route = g.start ? [g.start, ...g.path.map((_, i) => walk(bs, g.start!, g.path.slice(0, i + 1)))].join(" → ") : "";

  return (
    <div className="space-y-3 text-base">
      <p className="font-game text-center text-xl text-accent">레벨 {level} · 라운드 {round}/{ROUNDS}</p>
      <Board>
        <p className="mb-2 rounded-card bg-accent-soft px-3 py-2 text-base font-bold">
          {!g.start ? "① 출발할 땅을 눌러요 (다리는 한 번씩만!)" : over ? (done ? "성공! 별을 받았어요" : "막혔어요. 곧 다시 시작해요") : "② 반짝이는 땅을 누르면 다리를 건너요"}
        </p>
        <p className="mb-2 text-base text-muted">다리가 {bs.length}개 있어요. 모든 다리를 딱 한 번씩만 건너 보세요.</p>

        <style>{`
          @keyframes br-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
          @keyframes br-jump{0%,100%{transform:translateY(0) scale(1)}30%{transform:translateY(-22px) scale(1.1)}60%{transform:translateY(0) scale(.95)}}
          @keyframes br-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
          @keyframes br-twinkle{0%,100%{opacity:.2;transform:scale(.6)}50%{opacity:1;transform:scale(1.1)}}
          .br-bob{animation:br-bob 1.6s ease-in-out infinite}
          .br-jump{animation:br-jump .7s ease-in-out infinite}
          .br-shake{animation:br-shake .45s ease-in-out 2}
          .br-twinkle{animation:br-twinkle 1.2s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
          @media (prefers-reduced-motion: reduce){.br-bob,.br-jump,.br-shake,.br-twinkle{animation:none}}
        `}</style>
        <svg
          viewBox="0 0 700 380"
          className="block h-auto w-full select-none rounded-card"
          style={{ touchAction: "manipulation", fontFamily: "Jua, Pretendard Variable, sans-serif" }}
          role="group"
          aria-label={`다리 지도. 땅 4곳과 다리 ${bs.length}개`}
        >
          <defs>
            <linearGradient id="br-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#38bdf8" />
              <stop offset="0.5" stopColor="#0ea5e9" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
            <linearGradient id="br-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a3e635" />
              <stop offset="1" stopColor="#4ade80" />
            </linearGradient>
            <radialGradient id="br-isle" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#bef264" />
              <stop offset="1" stopColor="#4ade80" />
            </radialGradient>
            <radialGradient id="br-here" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#fef08a" />
              <stop offset="1" stopColor="#86efac" />
            </radialGradient>
            <radialGradient id="br-bear" cx="0.4" cy="0.35" r="0.7">
              <stop offset="0" stopColor="#fdba74" />
              <stop offset="1" stopColor="#c2410c" />
            </radialGradient>
          </defs>

          {/* 강물과 물결 */}
          <rect width="700" height="380" fill="url(#br-water)" />
          {[95, 130, 250, 285].map((y, i) => (
            <path key={i} d={`M ${-60 + (i % 2) * 30} ${y} q 15 -9 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0 t 30 0`} fill="none" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" opacity="0.55">
              {!REDUCE && <animateTransform attributeName="transform" type="translate" values="0 0; 60 0" dur={`${3 + i}s`} repeatCount="indefinite" />}
            </path>
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
                {ok && <path d={b.d} fill="none" stroke="#fde047" strokeWidth="34" strokeLinecap="round" opacity="0.8" className="animate-pulse" />}
                {/* 그림자 */}
                <path d={b.d} fill="none" stroke="rgba(3,105,161,0.45)" strokeWidth="26" strokeLinecap="round" transform="translate(4 6)" />
                {/* 난간 겸 테두리 */}
                <path d={b.d} fill="none" stroke={isUsed ? "#15803d" : "#7c2d12"} strokeWidth="26" strokeLinecap="round" />
                {/* 널빤지 */}
                <path d={b.d} fill="none" stroke={isUsed ? "#bbf7d0" : "#fbbf24"} strokeWidth="18" strokeLinecap="butt" />
                <path d={b.d} fill="none" stroke={isUsed ? "#4ade80" : "#b45309"} strokeWidth="18" strokeDasharray="3 9" strokeLinecap="butt" />
                <path d={b.d} fill="none" stroke="transparent" strokeWidth="64" pointerEvents="stroke" />
                {isUsed && (
                  <g>
                    <path className="br-twinkle" d={`M ${b.mid[0] + 22} ${b.mid[1] - 22} l 4 9 l 9 4 l -9 4 l -4 9 l -4 -9 l -9 -4 l 9 -4 Z`} fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
                    <circle cx={b.mid[0]} cy={b.mid[1]} r="16" fill="#16a34a" stroke="#fff" strokeWidth="3" />
                    <text x={b.mid[0]} y={b.mid[1] + 7} textAnchor="middle" fontSize="20" fill="#fff">
                      {order}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {LAND_IDS.map((l) => {
            const info = LAND[l];
            const pickable = !over && (!g.start || nextLands.has(l));
            const rec = hint && !g.start && good.includes(l);
            const ring = rec ? "#7c3aed" : pickable ? "#fde047" : "#15803d";
            const fill = at === l ? "url(#br-here)" : info.kind === "island" ? "url(#br-isle)" : "url(#br-grass)";
            return (
              <g key={l} role="button" tabIndex={0} aria-label={`${LAND_NAME[l]}${at === l ? " (지금 여기)" : ""}, 다리 ${deg[l]}개`} onClick={() => pickLand(l)} onKeyDown={keyAct(() => pickLand(l))} style={{ cursor: "pointer", outline: "none" }}>
                {info.kind === "island" ? (
                  <g>
                    {/* 모래사장 + 섬 */}
                    <ellipse cx={l === "A" ? 183 : 463} cy="197" rx={l === "A" ? 92 : 82} ry={l === "A" ? 64 : 59} fill="rgba(3,105,161,0.35)" />
                    <ellipse cx={l === "A" ? 180 : 460} cy="190" rx={l === "A" ? 92 : 82} ry={l === "A" ? 64 : 59} fill="#fde68a" stroke="#d97706" strokeWidth="3" />
                    <ellipse cx={l === "A" ? 180 : 460} cy="186" rx={l === "A" ? 80 : 70} ry={l === "A" ? 52 : 47} fill={fill} stroke={ring} strokeWidth={pickable || rec ? 6 : 3} className={pickable ? "animate-pulse" : ""} />
                  </g>
                ) : (
                  <g>
                    <rect x="-4" y={l === "C" ? -4 : 304} width="708" height="80" fill="#fde68a" stroke="#d97706" strokeWidth="3" />
                    <path d={l === "C" ? "M -4 -4 H 704 V 58 Q 640 70 580 60 T 460 62 T 340 58 T 220 62 T 100 58 T -4 62 Z" : "M -4 384 H 704 V 322 Q 640 310 580 320 T 460 318 T 340 322 T 220 318 T 100 322 T -4 318 Z"} fill={fill} stroke={ring} strokeWidth={pickable || rec ? 6 : 3} className={pickable ? "animate-pulse" : ""} />
                  </g>
                )}
                {/* 나무와 꽃 장식 */}
                {(l === "C" ? [[300, 26], [395, 34], [560, 24], [665, 32]] : l === "D" ? [[290, 352], [400, 344], [555, 354], [668, 348]] : l === "A" ? [[118, 190]] : []).map(([x, y], i) => (
                  <g key={i} pointerEvents="none">
                    <rect x={x - 3} y={y} width="6" height="12" rx="2" fill="#92400e" />
                    <circle cx={x} cy={y - 4} r="12" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
                    <circle cx={x - 4} cy={y - 8} r="4" fill="#4ade80" />
                  </g>
                ))}
                {(l === "C" ? [[250, 44], [610, 46]] : l === "D" ? [[240, 338], [610, 336]] : []).map(([x, y], i) => (
                  <g key={`f${i}`} pointerEvents="none">
                    <circle cx={x} cy={y} r="5" fill="#f472b6" />
                    <circle cx={x} cy={y} r="2" fill="#fef08a" />
                  </g>
                ))}
                <text x={info.label[0]} y={info.label[1] + 10} textAnchor="middle" fontSize="34" fill="#14532d" stroke="#fff" strokeWidth="5" paintOrder="stroke">
                  {l}
                </text>
                {g.start === l && (
                  <text x={info.label[0]} y={info.label[1] + 36} textAnchor="middle" fontSize="20" fill="#7c2d12" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                    출발
                  </text>
                )}
                {rec && (
                  <text x={info.label[0] + (info.kind === "bank" ? 120 : 0)} y={info.label[1] + (info.kind === "bank" ? 8 : 58)} textAnchor="middle" fontSize="22" fill="#6d28d9" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                    여기서 시작!
                  </text>
                )}
                {hint && (
                  <g>
                    <circle cx={info.badge[0]} cy={info.badge[1] - 4} r="21" fill={deg[l] % 2 ? "#fecaca" : "#e0e7ff"} stroke={deg[l] % 2 ? "#b91c1c" : "#4338ca"} strokeWidth="3" />
                    <text x={info.badge[0]} y={info.badge[1] + 5} textAnchor="middle" fontSize="26" fill={deg[l] % 2 ? "#b91c1c" : "#3730a3"}>
                      {deg[l]}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 처음 손짓: 출발하기 좋은 땅 위에서 손가락이 콕콕 */}
          {guideLand && (
            <g pointerEvents="none">
              <text x={LAND[guideLand].label[0] + 46} y={LAND[guideLand].label[1] + 12} fontSize="34">
                👆
                {!REDUCE && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -10; 0 0" dur="0.9s" repeatCount="indefinite" />}
              </text>
              <text x={LAND[guideLand].label[0] + 84} y={LAND[guideLand].label[1] + 2} fontSize="24" fill="#c2410c" stroke="#fff" strokeWidth="4" paintOrder="stroke">
                눌러요!
              </text>
            </g>
          )}

          {at && !walkAnim && (
            <g pointerEvents="none" transform={`translate(${LAND[at].stand[0]} ${LAND[at].stand[1]})`}>
              <g key={`${done}-${stuck}`} className={done ? "br-jump" : stuck ? "br-shake" : "br-bob"}>
                <Bear mood={done ? "happy" : stuck ? "sad" : "ok"} />
              </g>
            </g>
          )}
          {walkAnim && (
            <g key={walkAnim.k} pointerEvents="none">
              <animateMotion dur="0.5s" fill="freeze" path={walkAnim.d} keyPoints={walkAnim.rev ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear" />
              <g>
                {!REDUCE && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -8; 0 0" dur="0.25s" repeatCount="indefinite" />}
                <Bear mood="ok" />
              </g>
            </g>
          )}
        </svg>
      </Board>

      <div className="flex flex-wrap items-center gap-2">
        <Stat label="건넌 다리" value={`${g.path.length}/${bs.length}`} tone={done ? "ok" : "plain"} />
        <Stat label="라운드" value={`${round}/${ROUNDS}`} />
        <Stat label="다시 해 본 횟수" value={stucks} />
      </div>
      {route && <p className="text-base text-muted">지나온 길: <strong className="text-ink">{route}</strong></p>}
      <Say tone={msg.tone}>{msg.text}</Say>

      <div className="flex flex-wrap gap-2">
        <GButton onClick={undo} disabled={g.path.length === 0} className={BIG}>↶ 한 걸음 뒤로</GButton>
        <GButton variant="primary" onClick={() => resetRun("다시 시작해요! 땅을 눌러 출발해요.")} disabled={!g.start} className={BIG}>↻ 다시 하기</GButton>
        <GButton variant="soft" pressed={hint} onClick={() => setHint(!hint)} className={BIG}>{hint ? "힌트 숨기기" : "💡 힌트 보기"}</GButton>
      </div>

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
