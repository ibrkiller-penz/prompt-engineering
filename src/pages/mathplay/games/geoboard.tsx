import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, cheer, oops, stageClear, svgPoint, tick, useStage } from "./kit";
import { BIG, Pill, Talk } from "./easykit";
import { area2, canAdd, canClose, describe, eq, explain, fmtArea, fullCells, gridOf, makeQuest, satisfies, sides, type Pt, type Quest } from "./geoboard.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
const ROUNDS = 3;
const GAP = 60; // 못 사이(그림 좌표)
const PAD = 40;
const JUA = { fontFamily: "S-Core Dream, Pretendard Variable, sans-serif" };
const WHY: Record<string, string> = {
  cross: "고무줄이 서로 겹치거나 닿으면 안 돼요. 다른 못을 눌러 봐요.",
  dup: "이미 고무줄이 지나간 못이에요. 처음 못으로 돌아가면 도형이 닫혀요.",
};

export default function GeoboardGame() {
  const level = useStage();
  const N = gridOf(level);
  const [quest, setQuest] = useState<Quest>(() => makeQuest(level, 0, Math.random));
  const [done, setDone] = useState(0); // 깬 라운드
  const [path, setPath] = useState<Pt[]>([]);
  const [closed, setClosed] = useState(false);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "👆 못을 톡 눌러 시작해요! 못에서 못으로 손가락을 끌어도 돼요." });
  const [mood, setMood] = useState<"idle" | "win" | "lose">("idle");
  const [mouse, setMouse] = useState<Pt | null>(null);
  const [wrongKey, setWrongKey] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef(false);
  const pathRef = useRef<Pt[]>([]);
  const closedRef = useRef(false);
  pathRef.current = path;
  closedRef.current = closed;

  const W = (N - 1) * GAP + PAD * 2;
  const X = (x: number) => PAD + x * GAP;
  const Y = (y: number) => PAD + y * GAP;
  const pts = (p: Pt[]) => p.map((q) => `${X(q[0])},${Y(q[1])}`).join(" ");
  const info = useMemo(() => (closed ? explain(path, N) : null), [closed, path, N]);
  const cells = useMemo(() => (closed ? fullCells(path, N) : []), [closed, path, N]);

  /** 그림 좌표 (px,py) 에서 가까운 못. r 은 못 사이의 몇 배까지 인정할지 */
  function pinNear(px: number, py: number, r: number): Pt | null {
    const gx = Math.round((px - PAD) / GAP), gy = Math.round((py - PAD) / GAP);
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return null;
    return Math.hypot(px - X(gx), py - Y(gy)) <= GAP * r ? [gx, gy] : null;
  }
  const svgXY = (e: React.PointerEvent): [number, number] | null => (svgRef.current ? svgPoint(svgRef.current, e.clientX, e.clientY) : null);

  function finish(p: Pt[]) {
    setClosed(true);
    const a2 = area2(p);
    if (satisfies(quest.spec, p)) {
      cheer();
      setMood("win");
      const last = done + 1 >= ROUNDS;
      setDone((d) => d + 1);
      setMsg({ t: "ok", s: `와, 해냈어요! ⭐ 넓이가 ${fmtArea(a2)}인 도형이에요!` + (last ? ` 레벨 ${level}의 라운드 3개를 모두 깼어요!` : " 곧 다음 문제예요.") });
    } else {
      oops();
      setMood("lose");
      setWrongKey((k) => k + 1);
      const c = sides(p);
      let why = `넓이가 ${fmtArea(a2)}이에요. 목표는 ${fmtArea(quest.spec.area2)}!`;
      if (a2 === quest.spec.area2) why = `넓이 ${fmtArea(a2)}는 맞아요! 그런데 모양 조건이 달라요(지금은 변 ${c}개).`;
      setMsg({ t: "bad", s: `아깝지만 괜찮아요! ${why} 곧 고무줄이 풀려요. ‘되돌리기’로 한 칸씩 고쳐 봐요.` });
    }
  }

  function press(p: Pt, quiet = false) {
    if (closedRef.current) return;
    const cp = pathRef.current;
    if (!cp.length) {
      tick();
      setPath([p]);
      setMsg({ t: "info", s: "좋아요! 다음 못을 눌러 이어 가요. 처음 못으로 돌아오면 도형이 닫혀요." });
      return;
    }
    if (eq(cp[cp.length - 1], p)) return;
    if (cp.length >= 3 && eq(cp[0], p)) {
      if (canClose(cp)) finish(cp);
      else if (quiet) return;
      else {
        oops();
        setMsg({ t: "bad", s: "이렇게 닫으면 고무줄이 겹쳐요. ‘되돌리기’를 눌러 다른 길로 가 봐요." });
      }
      return;
    }
    if (cp.length === 2 && eq(cp[0], p)) {
      if (quiet) return;
      setMsg({ t: "info", s: "못이 한 개 더 필요해요. 다른 못을 눌러 삼각형부터 만들어요." });
      return;
    }
    const r = canAdd(cp, p);
    if (!r.ok) {
      if (r.why !== "same" && !quiet) {
        oops();
        setMsg({ t: "bad", s: WHY[r.why] ?? WHY.cross });
      }
      return;
    }
    tick();
    setPath([...cp, p]);
    setMsg({ t: "info", s: cp.length + 1 >= 3 ? "처음 못(깜빡이는 못)을 누르면 도형이 닫혀요!" : "좋아요! 다음 못을 눌러요." });
  }

  const lastXY = useRef<[number, number] | null>(null);
  const trail = useRef<[number, number][]>([]);
  const cand = useRef<{ pin: Pt; trailIdx: number } | null>(null);
  const resetGesture = () => {
    gesture.current = false;
    lastXY.current = null;
    trail.current = [];
    cand.current = null;
  };
  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    gesture.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const xy = svgXY(e);
    if (!xy) return;
    lastXY.current = xy;
    trail.current = [xy];
    cand.current = null;
    const p = pinNear(xy[0], xy[1], 0.5);
    if (p) press(p);
  };
  /** 끌고 가다가 못 근처에서 방향이 꺾이면 그 못을 고무줄에 걸어요(곧게 지나가기만 하면 걸지 않아요) */
  function checkTurn(x: number, y: number) {
    const near = pinNear(x, y, 0.3);
    if (near && (!cand.current || !eq(cand.current.pin, near))) cand.current = { pin: near, trailIdx: trail.current.length - 1 };
    const c = cand.current;
    if (!c) return;
    const cx = X(c.pin[0]), cy = Y(c.pin[1]);
    if (Math.hypot(x - cx, y - cy) <= GAP * 0.45) return;
    cand.current = null; // 못 근처를 벗어났어요: 손가락 길이 꺾였는지 살펴봐요
    const tr = trail.current;
    let mid = tr[c.trailIdx], md = Infinity; // 못에 가장 가까이 갔던 지점
    for (let k = c.trailIdx; k < tr.length; k++) {
      const d = Math.hypot(tr[k][0] - cx, tr[k][1] - cy);
      if (d < md) { md = d; mid = tr[k]; }
    }
    let a = tr[0];
    for (let k = c.trailIdx; k >= 0; k--) {
      a = tr[k];
      if (Math.hypot(a[0] - mid[0], a[1] - mid[1]) >= GAP * 0.6) break;
    }
    const v1: [number, number] = [mid[0] - a[0], mid[1] - a[1]], v2: [number, number] = [x - mid[0], y - mid[1]];
    const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
    if (l1 < 1 || l2 < 1) return;
    const ang = (Math.acos(Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1]) / (l1 * l2)))) * 180) / Math.PI;
    if (ang > 8) press(c.pin, true);
  }
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const xy = svgXY(e);
    if (!xy) return;
    if (!closedRef.current && pathRef.current.length) setMouse([(xy[0] - PAD) / GAP, (xy[1] - PAD) / GAP]);
    if (!gesture.current) return;
    const [x0, y0] = lastXY.current ?? xy;
    const steps = Math.max(1, Math.ceil(Math.hypot(xy[0] - x0, xy[1] - y0) / 6));
    for (let k = 1; k <= steps; k++) {
      const x = x0 + ((xy[0] - x0) * k) / steps, y = y0 + ((xy[1] - y0) * k) / steps;
      trail.current.push([x, y]);
      checkTurn(x, y);
    }
    lastXY.current = xy;
  };
  const onUp = (e: React.PointerEvent<SVGSVGElement>) => {
    // 손가락을 뗀 곳이 못 근처면 그 못까지 이어 줘요
    const xy = svgXY(e);
    if (gesture.current && xy) {
      const p = pinNear(xy[0], xy[1], 0.5);
      if (p) press(p);
    }
    resetGesture();
  };

  function undo() {
    if (closed) {
      setClosed(false);
      setMood("idle");
      setMsg({ t: "info", s: "고무줄을 풀었어요. 다시 ‘되돌리기’로 고치거나 못을 눌러 이어 봐요." });
      return;
    }
    if (!path.length) return;
    tick();
    setPath(path.slice(0, -1));
  }
  function clearAll() {
    setPath([]);
    setClosed(false);
    setMood("idle");
    setMsg({ t: "info", s: "고무줄을 모두 풀었어요. 👆 못을 눌러 다시 시작!" });
  }

  function nextRound() {
    const q = makeQuest(level, done, Math.random, [quest.spec.area2]);
    setQuest(q);
    setPath([]);
    setClosed(false);
    setHint(false);
    setMood("idle");
    setMsg({ t: "info", s: "새 문제예요! 👆 못을 눌러 시작해요." });
  }

  // 성공하면 잠깐 보여 주고 다음 라운드(3개째면 레벨 클리어). 실패하면 잠깐 뒤 고무줄만 풀어 줘요.
  useEffect(() => {
    if (!closed) return;
    if (mood === "win") {
      const id = done >= ROUNDS ? setTimeout(stageClear, 1200) : setTimeout(nextRound, 2600);
      return () => clearTimeout(id);
    }
    if (mood === "lose") {
      const id = setTimeout(() => {
        if (closedRef.current) {
          setClosed(false);
          setMood("idle");
        }
      }, 2200);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed, mood, done]);

  const first = path[0];
  const open = !closed && path.length > 0;
  const pulseFirst = open && path.length >= 3;
  const preview = open && mouse ? mouse : null;
  const last = path[path.length - 1];

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-game text-xl">레벨 {level} · 라운드 {Math.min(done + 1, ROUNDS)}/{ROUNDS}</span>
        <Pill label="깬 라운드" value={"⭐".repeat(done) || "0"} tone={done ? "ok" : "plain"} />
      </div>
      <p className="mt-2 font-game text-2xl leading-snug">📐 {describe(quest.spec)}</p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${W}`}
        className="mx-auto mt-2 w-full max-w-[480px] select-none rounded-card"
        style={{ touchAction: "none", cursor: "pointer" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={resetGesture}
        onPointerLeave={() => setMouse(null)}
        role="group"
        aria-label={`고무줄 판. 못 ${N}×${N}개. 못을 차례로 누르거나 끌어서 고무줄을 걸어요`}
      >
        <defs>
          <linearGradient id="gb-table" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#99f6e4" /><stop offset="1" stopColor="#5eead4" /></linearGradient>
          <linearGradient id="gb-wood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fde7b0" /><stop offset="1" stopColor="#f4b860" /></linearGradient>
          <radialGradient id="gb-nail" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#ffffff" /><stop offset="0.6" stopColor="#cbd5e1" /><stop offset="1" stopColor="#64748b" /></radialGradient>
          <linearGradient id="gb-band" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f472b6" /><stop offset="1" stopColor="#fb7185" /></linearGradient>
          <style>{`
            .gb-shake { animation: gb-shake .45s ease-in-out 2; transform-box: fill-box; transform-origin: center; }
            @keyframes gb-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
            .gb-pulse { animation: gb-pulse 0.9s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
            @keyframes gb-pulse { 0%,100% { transform: scale(1); opacity: .9; } 50% { transform: scale(1.5); opacity: .35; } }
            .gb-pop { animation: gb-pop .6s cubic-bezier(.2,1.6,.4,1) both; transform-box: fill-box; transform-origin: center; }
            @keyframes gb-pop { 0% { transform: scale(.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
            .gb-tw { animation: gb-tw 1s ease-in-out infinite; }
            @keyframes gb-tw { 0%,100% { opacity: .3; } 50% { opacity: 1; } }
            @media (prefers-reduced-motion: reduce) { .gb-shake, .gb-pulse, .gb-pop, .gb-tw { animation: none; } }
          `}</style>
        </defs>
        <rect x={0} y={0} width={W} height={W} rx={26} fill="url(#gb-table)" />
        <rect x={10} y={16} width={W - 20} height={W - 20} rx={22} fill="#0f766e" opacity={0.18} />
        <rect x={10} y={10} width={W - 20} height={W - 20} rx={22} fill="url(#gb-wood)" stroke="#b45309" strokeWidth={5} />
        <rect x={20} y={20} width={W - 40} height={W - 40} rx={16} fill="none" stroke="#fff7e0" strokeWidth={3} opacity={0.7} />
        {/* 눈금 은은하게 */}
        {Array.from({ length: N - 1 }, (_, y) => Array.from({ length: N - 1 }, (_, x) => <rect key={`${x}-${y}`} x={X(x)} y={Y(y)} width={GAP} height={GAP} fill="none" stroke="#d99a3d" strokeWidth={1.5} opacity={0.35} />))}

        {/* 힌트: 반투명 모양 */}
        {hint && !closed && <polygon points={pts(quest.shape)} fill="#14b8a6" opacity={0.28} stroke="#0f766e" strokeWidth={4} strokeDasharray="10 7" strokeLinejoin="round" pointerEvents="none" />}

        {/* 닫힌 도형: 색칠 + 꽉 찬 칸 */}
        {closed && (
          <g key={wrongKey + path.length} className={mood === "lose" ? "gb-shake" : "gb-pop"} pointerEvents="none">
            <polygon points={pts(path)} fill="#fb7185" opacity={0.38} />
            {cells.map(([cx, cy], i) => (
              <g key={i}>
                <rect x={X(cx) + 4} y={Y(cy) + 4} width={GAP - 8} height={GAP - 8} rx={8} fill="#fde047" opacity={0.85} stroke="#ca8a04" strokeWidth={2} />
                <text x={X(cx) + GAP / 2} y={Y(cy) + GAP / 2 + 8} fontSize={22} fill="#854d0e" textAnchor="middle" style={JUA}>{i + 1}</text>
              </g>
            ))}
          </g>
        )}

        {/* 고무줄 */}
        {path.length >= 2 && (
          <g pointerEvents="none" className={closed && mood === "lose" ? "gb-shake" : ""}>
            <polyline points={pts(path) + (closed ? ` ${X(first[0])},${Y(first[1])}` : "")} fill="none" stroke="#9d174d" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts(path) + (closed ? ` ${X(first[0])},${Y(first[1])}` : "")} fill="none" stroke="url(#gb-band)" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={pts(path) + (closed ? ` ${X(first[0])},${Y(first[1])}` : "")} fill="none" stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} transform="translate(-1.5 -2)" />
          </g>
        )}
        {preview && last && !closed && (
          <line x1={X(last[0])} y1={Y(last[1])} x2={PAD + preview[0] * GAP} y2={PAD + preview[1] * GAP} stroke="#f472b6" strokeWidth={6} strokeLinecap="round" strokeDasharray="2 10" opacity={0.8} pointerEvents="none" />
        )}

        {/* 못 */}
        {Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => {
          const used = path.some((q) => q[0] === x && q[1] === y);
          const isFirst = first && first[0] === x && first[1] === y;
          return (
            <g key={`${x}-${y}`} pointerEvents="none">
              {isFirst && pulseFirst && <circle cx={X(x)} cy={Y(y)} r={13} fill="#fde047" className="gb-pulse" />}
              <ellipse cx={X(x) + 1.5} cy={Y(y) + 5} rx={9} ry={4} fill="#000" opacity={0.2} />
              <circle cx={X(x)} cy={Y(y)} r={used ? 10 : 8} fill="url(#gb-nail)" stroke={used ? "#be185d" : "#475569"} strokeWidth={used ? 3 : 2} />
            </g>
          );
        }))}

        {/* 처음 3초 손짓 */}
        {!path.length && !closed && (
          <g className="gz-bob" pointerEvents="none">
            <text x={X(0) + 6} y={Y(0) + 48} fontSize={38} textAnchor="middle">👆</text>
          </g>
        )}
        {mood === "win" && (
          <g className="gb-tw" pointerEvents="none">
            {[[0.12, 0.12, 1], [0.88, 0.14, 0.8], [0.9, 0.86, 1], [0.1, 0.88, 0.7]].map(([fx, fy, k], i) => (
              <path key={i} transform={`translate(${fx * W} ${fy * W}) scale(${k})`} d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill="#fde047" stroke="#f59e0b" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-base">
        <Pill label="못" value={path.length} />
        {closed ? <Pill label="변" value={`${sides(path)}개`} /> : null}
        {closed ? <Pill label="넓이" value={fmtArea(area2(path))} tone={mood === "win" ? "ok" : "bad"} /> : null}
      </div>
      {info && <p className="mt-2 rounded-card bg-accent-soft px-3 py-2 text-base font-bold">🔢 {info.text}</p>}

      <div className="mt-3"><Talk tone={msg.t}>{msg.s}</Talk></div>
      {hint && <p className="mt-2 rounded-card bg-bg px-3 py-2 text-base">💡 점선 모양을 따라 못을 이어 보세요! 꼭 이 모양이 아니어도, 넓이가 같으면 다른 모양도 괜찮아요.</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <GButton className={BIG} onClick={undo} disabled={!path.length}>↩ 되돌리기</GButton>
        <GButton className={BIG} onClick={clearAll} disabled={!path.length}>🧹 모두 풀기</GButton>
        <GButton className={BIG} pressed={hint} onClick={() => setHint((v) => !v)}>💡 힌트</GButton>
      </div>
    </Board>
  );
}
