import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, cheer, oops, stageClear, svgPoint, tick, useStage } from "./kit";
import { BIG, Pill, Talk } from "./easykit";
import { fits, hintFor, makePuzzle, mirror, slotKey, type Puzzle, type Slot } from "./timestable.math";

type Msg = { t: "info" | "ok" | "bad"; s: string };
const ROUNDS = 3;
const VW = 372;
const CS = 56;
const TILE = 26; // 조각 반지름
const JUA = { fontFamily: "Jua, Pretendard Variable, sans-serif" };

export default function TimesTableGame() {
  const level = useStage();
  const [puz, setPuz] = useState<Puzzle>(() => makePuzzle(level, Math.random));
  const [done, setDone] = useState(0);
  const [filled, setFilled] = useState<Record<string, number>>({});
  const [used, setUsed] = useState<boolean[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number; moved: boolean } | null>(null);
  const [hov, setHov] = useState<Slot | null>(null);
  const [back, setBack] = useState<number | null>(null); // 튕겨 돌아가는 조각
  const [shake, setShake] = useState<string>("");
  const [pop, setPop] = useState<string>("");
  const [hint, setHint] = useState<{ slot: Slot; text: string } | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [msg, setMsg] = useState<Msg>({ t: "info", s: "👆 아래 쿠키 조각을 끌어다 빈칸(점선)에 놓아요!" });
  const svgRef = useRef<SVGSVGElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const n = puz.n;
  const gx0 = (VW - (n + 1) * CS) / 2, gy0 = 18;
  const trayY = gy0 + (n + 1) * CS + 30;
  const H = trayY + TILE * 2 + 40;
  const cellX = (c: number) => gx0 + (c + 1) * CS;
  const cellY = (r: number) => gy0 + (r + 1) * CS;
  const step = Math.min(TILE * 2 + 8, (VW - 48 - TILE * 2) / Math.max(1, puz.tiles.length - 1));
  const tilesW = (puz.tiles.length - 1) * step + TILE * 2;
  const tileCx = (i: number) => (VW - tilesW) / 2 + TILE + i * step;
  const tileCy = trayY + TILE + 8;
  const slotCenter = (s: Slot): [number, number] => (s.k === "cell" ? [cellX(s.c) + CS / 2, cellY(s.r) + CS / 2] : s.k === "rowH" ? [gx0 + CS / 2, cellY(s.r) + CS / 2] : [cellX(s.c) + CS / 2, gy0 + CS / 2]);
  const openSlots = puz.slots.filter((s) => filled[slotKey(s)] === undefined);
  const symmetric = puz.rows.every((v, i) => v === puz.cols[i]);

  // 이 칸의 머리 수(보이거나 이미 채운 것)
  const rowV = (r: number): number | null => { const k = `r${r}`; return puz.slots.some((s) => slotKey(s) === k) ? filled[k] ?? null : puz.rows[r]; };
  const colV = (c: number): number | null => { const k = `h${c}`; return puz.slots.some((s) => slotKey(s) === k) ? filled[k] ?? null : puz.cols[c]; };

  const slotAt = (x: number, y: number): Slot | null => {
    let best: Slot | null = null, bd = CS * 0.62;
    for (const s of openSlots) {
      const [cx, cy] = slotCenter(s);
      const d = Math.hypot(x - cx, y - cy);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };

  function tryPlace(i: number, s: Slot) {
    const v = puz.tiles[i];
    const key = slotKey(s);
    if (fits(puz, s, v)) {
      const nf = { ...filled, [key]: v };
      const nu = [...used]; nu[i] = true;
      setFilled(nf); setUsed(nu); setSel(null); setPop(key); setHov(null); setHint(null);
      if (Object.keys(nf).length === puz.slots.length) {
        cheer();
        const last = done + 1 >= ROUNDS;
        setDone((d) => d + 1);
        setMsg({ t: "ok", s: "와, 곱셈표를 완성했어요! ⭐" + (last ? ` 레벨 ${level}의 라운드 3개를 모두 깼어요!` : " 곧 다음 표예요.") });
      } else {
        tick();
        setMsg({ t: "ok", s: s.k === "cell" ? `딱 맞아요! ${puz.rows[s.r]} × ${puz.cols[s.c]} = ${v} ✨` : `맞아요! 이 머리 수는 ${v}예요 ✨` });
      }
    } else {
      oops();
      setShake(key); setBack(i); setSel(null);
      setTimeout(() => { setShake(""); setBack(null); }, 450);
      const rv = s.k === "cell" ? rowV(s.r) : null, cv = s.k === "cell" ? colV(s.c) : null;
      setMsg({ t: "bad", s: s.k === "cell" && rv !== null && cv !== null && level <= 5 ? `아쉬워요! ${rv} × ${cv} 는 ${rv * cv}이에요. ${v}은(는) 다른 칸에 어울려요. 다시 해 봐요!` : `아직 아니에요! ${v}은(는) 여기 말고 다른 칸이에요. ‘세로 수 × 가로 수’를 생각해 봐요. 괜찮아요, 다시!` });
    }
  }

  const onTileDown = (i: number) => (e: React.PointerEvent) => {
    if (used[i] || !svgRef.current) return;
    e.stopPropagation();
    svgRef.current.setPointerCapture(e.pointerId);
    const [x, y] = svgPoint(svgRef.current, e.clientX, e.clientY);
    start.current = { x, y };
    setDrag({ i, x, y, moved: false });
  };
  const onMove = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    if (drag) {
      const s = start.current!;
      setDrag({ ...drag, x, y, moved: drag.moved || Math.hypot(x - s.x, y - s.y) > 8 });
      setHov(slotAt(x, y - 30));
    } else setHov(slotAt(x, y));
  };
  const onUp = () => {
    if (!drag) return;
    if (drag.moved) {
      const s = slotAt(drag.x, drag.y - 30);
      if (s) tryPlace(drag.i, s);
      else { setBack(drag.i); setTimeout(() => setBack(null), 300); setHov(null); }
    } else {
      tick();
      setSel(sel === drag.i ? null : drag.i);
      setMsg({ t: "info", s: sel === drag.i ? "선택을 풀었어요." : "이 조각을 놓을 빈칸을 눌러요!" });
    }
    setDrag(null);
  };
  const onSlotDown = (s: Slot) => (e: React.PointerEvent) => {
    if (sel === null || drag) return;
    e.stopPropagation();
    tryPlace(sel, s);
  };

  function newRound() {
    setPuz(makePuzzle(level, Math.random));
    setFilled({}); setUsed([]); setSel(null); setDrag(null); setHov(null); setHint(null); setHintUsed(false);
    setMsg({ t: "info", s: "새 곱셈표예요! 👆 쿠키 조각을 끌어다 빈칸에 놓아요." });
  }
  useEffect(() => {
    if (Object.keys(filled).length !== puz.slots.length || !puz.slots.length) return;
    const id = done >= ROUNDS ? setTimeout(stageClear, 1200) : setTimeout(newRound, 2400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled]);

  function giveHint() {
    const h = hintFor(puz, new Set(Object.keys(filled)));
    if (!h) return;
    setHint(h); setHintUsed(true);
    setMsg({ t: "info", s: "💡 " + h.text });
  }

  // 지금 보고 있는 칸(마우스를 올린 곳, 아니면 힌트 칸)
  const focus: Slot | null = hov ?? hint?.slot ?? null;
  const fr = focus?.k === "cell" ? focus.r : focus?.k === "rowH" ? focus.r : -1;
  const fc = focus?.k === "cell" ? focus.c : focus?.k === "colH" ? focus.c : -1;
  const mir = focus?.k === "cell" ? mirror(puz, focus.r, focus.c) : null;
  const eqR = fr >= 0 ? rowV(fr) : null, eqC = fc >= 0 ? colV(fc) : null;
  const showDots = level <= 3 || (level <= 6 && hintUsed);
  const dotsOk = focus?.k === "cell" && eqR !== null && eqC !== null;
  const dotsMemo = useMemo(() => (dotsOk ? [eqR as number, eqC as number] : null), [dotsOk, eqR, eqC]);

  const cookie = (cx: number, cy: number, v: number | string, k: string, opts: { r?: number; dim?: boolean; sel?: boolean; hover?: boolean } = {}) => {
    const r = opts.r ?? TILE;
    return (
      <g key={k} pointerEvents="none" opacity={opts.dim ? 0.5 : 1}>
        <ellipse cx={cx + 2} cy={cy + r - 2} rx={r * 0.85} ry={r * 0.22} fill="#000" opacity={0.18} />
        <circle cx={cx} cy={cy} r={r} fill="url(#tt-cookie)" stroke="#b45309" strokeWidth={opts.sel ? 5 : 3} />
        {opts.sel && <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke="#0d9488" strokeWidth={3} strokeDasharray="5 4" />}
        {[[-0.55, -0.35], [0.6, -0.1], [-0.2, 0.6]].map(([dx, dy], i) => <ellipse key={i} cx={cx + dx * r} cy={cy + dy * r} rx={r * 0.1} ry={r * 0.07} fill="#92400e" opacity={0.55} />)}
        <text x={cx} y={cy + r * 0.34} fontSize={r * 0.95} fill="#78350f" textAnchor="middle" stroke="#fff7e0" strokeWidth={4} paintOrder="stroke" style={JUA}>{v}</text>
      </g>
    );
  };

  const eqText = (() => {
    if (!focus) return null;
    if (focus.k === "cell") return `${eqR ?? "?"} × ${eqC ?? "?"} = ${filled[slotKey(focus)] ?? "?"}`;
    return focus.k === "rowH" ? "왼쪽 세로 머리 수 자리예요" : "위쪽 가로 머리 수 자리예요";
  })();

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-game text-xl">레벨 {level} · 라운드 {Math.min(done + 1, ROUNDS)}/{ROUNDS}</span>
        <Pill label="깬 라운드" value={"⭐".repeat(done) || "0"} tone={done ? "ok" : "plain"} />
        <Pill label="남은 빈칸" value={openSlots.length} />
      </div>
      <p className="mt-2 font-game text-2xl leading-snug">🍪 쿠키 조각을 빈칸에 놓아 곱셈표를 완성해요!</p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${H}`}
        className="mx-auto mt-2 w-full max-w-[480px] select-none rounded-card"
        style={{ touchAction: "none" }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { setDrag(null); setHov(null); }}
        onPointerLeave={() => !drag && setHov(null)}
        role="group"
        aria-label="곱셈표 퍼즐. 쿠키 조각을 빈칸으로 끌어다 놓아요"
      >
        <defs>
          <linearGradient id="tt-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ccfbf1" /><stop offset="1" stopColor="#99f6e4" /></linearGradient>
          <linearGradient id="tt-sheet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff7e0" /><stop offset="1" stopColor="#fde7b0" /></linearGradient>
          <radialGradient id="tt-cookie" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#fef3c7" /><stop offset="0.55" stopColor="#fbbf24" /><stop offset="1" stopColor="#d97706" /></radialGradient>
          <linearGradient id="tt-rowh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#93c5fd" /><stop offset="1" stopColor="#3b82f6" /></linearGradient>
          <linearGradient id="tt-colh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fdba74" /><stop offset="1" stopColor="#f97316" /></linearGradient>
          <style>{`
            .tt-shake { animation: tt-shake .4s ease-in-out; transform-box: fill-box; transform-origin: center; }
            @keyframes tt-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
            .tt-pop { animation: tt-pop .55s cubic-bezier(.2,1.6,.4,1) both; transform-box: fill-box; transform-origin: center; }
            @keyframes tt-pop { 0% { transform: scale(.6); } 100% { transform: scale(1); } }
            .tt-glow { animation: tt-glow 1s ease-in-out infinite; }
            @keyframes tt-glow { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
            .tt-back { transition: transform .28s cubic-bezier(.3,1.5,.5,1); }
            @media (prefers-reduced-motion: reduce) { .tt-shake, .tt-pop, .tt-glow, .tt-back { animation: none; transition: none; } }
          `}</style>
        </defs>
        <rect x={0} y={0} width={VW} height={H} rx={24} fill="url(#tt-bg)" />
        <rect x={gx0 - 10} y={gy0 - 8} width={(n + 1) * CS + 20} height={(n + 1) * CS + 20} rx={22} fill="#92400e" opacity={0.2} transform="translate(0 5)" />
        <rect x={gx0 - 10} y={gy0 - 8} width={(n + 1) * CS + 20} height={(n + 1) * CS + 20} rx={22} fill="url(#tt-sheet)" stroke="#b45309" strokeWidth={4} />

        {/* 칸 */}
        {puz.rows.map((_, r) => puz.cols.map((_, c) => {
          const slot = puz.slots.find((s) => s.k === "cell" && s.r === r && s.c === c);
          const key = `c${r}_${c}`;
          const v = slot ? filled[key] : puz.rows[r] * puz.cols[c];
          const x = cellX(c), y = cellY(r);
          const lit = r === fr || c === fc;
          const isMir = mir && mir[0] === r && mir[1] === c;
          const isHint = hint && slotKey(hint.slot) === key;
          return (
            <g key={key} onPointerDown={slot && v === undefined ? onSlotDown(slot) : undefined} className={shake === key ? "tt-shake" : pop === key ? "tt-pop" : ""}>
              <rect x={x + 3} y={y + 3} width={CS - 6} height={CS - 6} rx={12} fill={lit ? "#fef08a" : "#ffffff"} stroke={slot && v === undefined ? "#0d9488" : "#fcd34d"} strokeWidth={slot && v === undefined ? 3 : 2} strokeDasharray={slot && v === undefined ? "7 5" : undefined} />
              {slot && v === undefined ? (
                <text x={x + CS / 2} y={y + CS / 2 + 9} fontSize={26} fill="#0d9488" textAnchor="middle" pointerEvents="none" style={JUA}>?</text>
              ) : slot ? (
                cookie(x + CS / 2, y + CS / 2, v as number, "p" + key, { r: 22 })
              ) : (
                <text x={x + CS / 2} y={y + CS / 2 + 9} fontSize={26} fill="#7c2d12" textAnchor="middle" pointerEvents="none" style={JUA}>{v}</text>
              )}
              {isMir && <rect x={x + 1} y={y + 1} width={CS - 2} height={CS - 2} rx={14} fill="none" stroke="#7c3aed" strokeWidth={4} className="tt-glow" pointerEvents="none" />}
              {isHint && <rect x={x + 1} y={y + 1} width={CS - 2} height={CS - 2} rx={14} fill="#14b8a6" opacity={0.3} className="tt-glow" pointerEvents="none" />}
            </g>
          );
        }))}
        {/* 머리 칸 */}
        <g pointerEvents="none">
          <rect x={gx0 + 3} y={gy0 + 3} width={CS - 6} height={CS - 6} rx={12} fill="#a78bfa" stroke="#6d28d9" strokeWidth={2.5} />
          <text x={gx0 + CS / 2} y={gy0 + CS / 2 + 10} fontSize={30} fill="#fff" textAnchor="middle" style={JUA}>×</text>
        </g>
        {puz.cols.map((_, c) => {
          const slot = puz.slots.find((s) => s.k === "colH" && s.c === c);
          const key = `h${c}`;
          const v = slot ? filled[key] : puz.cols[c];
          const x = cellX(c), y = gy0;
          const isHint = hint && slotKey(hint.slot) === key;
          return (
            <g key={key} onPointerDown={slot && v === undefined ? onSlotDown(slot) : undefined} className={shake === key ? "tt-shake" : pop === key ? "tt-pop" : ""}>
              <rect x={x + 3} y={y + 3} width={CS - 6} height={CS - 6} rx={12} fill={c === fc ? "#fdba74" : "url(#tt-colh)"} stroke="#c2410c" strokeWidth={slot && v === undefined ? 3 : 2.5} strokeDasharray={slot && v === undefined ? "7 5" : undefined} opacity={slot && v === undefined ? 0.55 : 1} />
              <text x={x + CS / 2} y={y + CS / 2 + 10} fontSize={slot && v === undefined ? 28 : 30} fill="#fff" textAnchor="middle" stroke="#9a3412" strokeWidth={3} paintOrder="stroke" pointerEvents="none" style={JUA}>{v ?? "?"}</text>
              {isHint && <rect x={x + 1} y={y + 1} width={CS - 2} height={CS - 2} rx={14} fill="#14b8a6" opacity={0.35} className="tt-glow" pointerEvents="none" />}
            </g>
          );
        })}
        {puz.rows.map((_, r) => {
          const slot = puz.slots.find((s) => s.k === "rowH" && s.r === r);
          const key = `r${r}`;
          const v = slot ? filled[key] : puz.rows[r];
          const x = gx0, y = cellY(r);
          const isHint = hint && slotKey(hint.slot) === key;
          return (
            <g key={key} onPointerDown={slot && v === undefined ? onSlotDown(slot) : undefined} className={shake === key ? "tt-shake" : pop === key ? "tt-pop" : ""}>
              <rect x={x + 3} y={y + 3} width={CS - 6} height={CS - 6} rx={12} fill={r === fr ? "#93c5fd" : "url(#tt-rowh)"} stroke="#1d4ed8" strokeWidth={slot && v === undefined ? 3 : 2.5} strokeDasharray={slot && v === undefined ? "7 5" : undefined} opacity={slot && v === undefined ? 0.55 : 1} />
              <text x={x + CS / 2} y={y + CS / 2 + 10} fontSize={slot && v === undefined ? 28 : 30} fill="#fff" textAnchor="middle" stroke="#1e3a8a" strokeWidth={3} paintOrder="stroke" pointerEvents="none" style={JUA}>{v ?? "?"}</text>
              {isHint && <rect x={x + 1} y={y + 1} width={CS - 2} height={CS - 2} rx={14} fill="#14b8a6" opacity={0.35} className="tt-glow" pointerEvents="none" />}
            </g>
          );
        })}
        {/* 대칭선 */}
        {symmetric && n >= 2 && <line x1={cellX(0) + 6} y1={cellY(0) + 6} x2={cellX(n - 1) + CS - 6} y2={cellY(n - 1) + CS - 6} stroke="#7c3aed" strokeWidth={3} strokeDasharray="3 9" strokeLinecap="round" opacity={0.45} pointerEvents="none" />}

        {/* 쿠키 접시와 조각 */}
        <rect x={14} y={trayY - 6} width={VW - 28} height={TILE * 2 + 28} rx={20} fill="#0f766e" opacity={0.22} transform="translate(0 4)" />
        <rect x={14} y={trayY - 6} width={VW - 28} height={TILE * 2 + 28} rx={20} fill="#ffffff" stroke="#0d9488" strokeWidth={3} opacity={0.9} />
        {puz.tiles.map((v, i) => {
          if (used[i]) return null;
          const dragging = drag?.i === i && drag.moved;
          const cx = dragging ? drag!.x : tileCx(i), cy = dragging ? drag!.y - 30 : tileCy;
          return (
            <g key={i} onPointerDown={onTileDown(i)} style={{ cursor: "grab" }} className={back === i ? "tt-back" : ""}>
              <circle cx={tileCx(i)} cy={tileCy} r={TILE + 4} fill="transparent" />
              {dragging ? cookie(cx, cy, v, "d" + i, { r: TILE + 3, sel: true }) : cookie(cx, cy, v, "t" + i, { sel: sel === i })}
              {!dragging && <circle cx={tileCx(i)} cy={tileCy} r={TILE + 4} fill="transparent" />}
            </g>
          );
        })}
        {openSlots.length === puz.slots.length && !drag && (
          <g className="gz-bob" pointerEvents="none"><text x={VW / 2} y={trayY - 12} fontSize={30} textAnchor="middle">👆</text></g>
        )}
      </svg>

      {/* 곱셈식과 점 그림 */}
      <div className="mt-2 flex min-h-[84px] flex-wrap items-center gap-3 rounded-card bg-bg px-3 py-2">
        {focus && eqText ? (
          <>
            <span className="font-game text-3xl tabular-nums">{eqText}</span>
            {showDots && dotsMemo && (
              <svg width={Math.min(dotsMemo[1], 9) * 15 + 6} height={Math.min(dotsMemo[0], 9) * 15 + 6} role="img" aria-label={`점 ${dotsMemo[0]}줄, 한 줄에 ${dotsMemo[1]}개`}>
                {Array.from({ length: dotsMemo[0] }, (_, r) => Array.from({ length: dotsMemo[1] }, (_, c) => <circle key={`${r}${c}`} cx={10 + c * 15} cy={10 + r * 15} r={5.5} fill="#f97316" stroke="#9a3412" strokeWidth={1.5} />))}
              </svg>
            )}
            {mir && <span className="text-base font-bold text-[#7c3aed]">보라색 테두리 칸은 짝이에요. 곱이 같아요!</span>}
          </>
        ) : (
          <span className="text-base text-muted">쿠키 조각을 끌어서 빈칸 위로 가져가 보세요. 가로 수와 세로 수가 반짝여요. {symmetric ? "보라 점선(대각선)을 기준으로 짝 칸은 같은 수예요." : ""}</span>
        )}
      </div>

      <div className="mt-3"><Talk tone={msg.t}>{msg.s}</Talk></div>
      <div className="mt-3 flex flex-wrap gap-2">
        <GButton className={BIG} onClick={giveHint} disabled={!openSlots.length}>💡 힌트</GButton>
        {sel !== null && <GButton className={BIG} onClick={() => setSel(null)}>선택 풀기</GButton>}
      </div>
    </Board>
  );
}
