import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Board, GButton, cheer, oops, stageClear, tick, useStage } from "./kit";
import { BIG, Pill, Stars, Talk } from "./easykit";
import { greedyHint, isGoal, makeBoard, slideLevel, slideLine, solveBoard, type Board as B } from "./sliding.logic";

type Msg = { t: string; tone: "info" | "ok" | "bad" };
const ANIMALS = ["🐶", "🐱", "🐰", "🦊", "🐼", "🐸", "🐵", "🦁", "🐯", "🐨", "🐷", "🐮", "🐔", "🐧", "🦄"];
const HUES = [340, 20, 45, 95, 160, 195, 225, 265, 305, 10, 130, 180, 250, 285, 60];
const css = `
@media (prefers-reduced-motion: no-preference){
.sl-glow{animation:sl-glow 1s ease-in-out infinite}
.sl-hop{animation:sl-hop .5s ease-in-out 4}
.sl-shake{animation:sl-shake .4s ease-in-out 1}
}
@keyframes sl-glow{0%,100%{box-shadow:0 0 0 3px #f59e0b,0 0 8px 2px #fbbf2480}50%{box-shadow:0 0 0 6px #f59e0b,0 0 18px 6px #fbbf24c0}}
@keyframes sl-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes sl-shake{0%,100%{translate:0}25%{translate:-6px}50%{translate:6px}75%{translate:-3px}}
`;
const stars3 = (moves: number, min: number) => (moves <= min ? 3 : moves <= Math.ceil(min * 1.5) ? 2 : 1);

export default function SlidingGame() {
  const stage = useStage();
  const { rows, cols } = slideLevel(stage);
  const [boards] = useState(() => [1, 2, 3].map(() => makeBoard(stage)));
  const [round, setRound] = useState(1);
  const cur = boards[round - 1];
  const [b, setB] = useState<B>(cur.board);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [stars, setStars] = useState(0);
  const [hint, setHint] = useState(-1);
  const [touched, setTouched] = useState(false);
  const [shake, setShake] = useState(-1);
  const [msg, setMsg] = useState<Msg>({ t: `🎯 1부터 차례로 맞춰요. 빈칸은 오른쪽 아래로! 빈칸 옆 타일을 눌러요.`, tone: "info" });
  const [drag, setDrag] = useState<{ tile: number; off: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dr = useRef<{ tile: number; sx: number; sy: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!won) return;
    const id = window.setTimeout(() => {
      if (round >= 3) stageClear();
      else {
        const nb = boards[round];
        setRound(round + 1);
        setB(nb.board);
        setMoves(0);
        setWon(false);
        setStars(0);
        setHint(-1);
        setMsg({ t: `라운드 ${round + 1}: 새 판이에요! 1부터 차례로 맞춰요.`, tone: "info" });
      }
    }, round >= 3 ? 1200 : 2200);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  const blank = b.indexOf(0);
  const rb = Math.floor(blank / cols),
    cb = blank % cols;
  const inLine = (p: number) => p !== blank && (Math.floor(p / cols) === rb || p % cols === cb);
  /** 빈칸 쪽으로 향하는 단위 방향 */
  const dirOf = (p: number): [number, number] => {
    const r = Math.floor(p / cols),
      c = p % cols;
    return r === rb ? [cb > c ? 1 : -1, 0] : [0, rb > r ? 1 : -1];
  };
  /** p 부터 빈칸 바로 앞까지의 칸들 */
  const lineCells = (p: number) => {
    const [dx, dy] = dirOf(p);
    const out: number[] = [];
    let r = Math.floor(p / cols),
      c = p % cols;
    while (r !== rb || c !== cb) {
      out.push(r * cols + c);
      r += dy;
      c += dx;
    }
    return out;
  };

  const doSlide = (p: number) => {
    const res = slideLine(rows, cols, b, p);
    setTouched(true);
    setHint(-1);
    if (!res) {
      oops();
      setShake(p);
      window.setTimeout(() => setShake(-1), 450);
      setMsg({ t: "그 타일은 빈칸과 한 줄에 있지 않아요. 빈칸이 있는 줄(가로·세로)의 타일을 눌러요.", tone: "bad" });
      return;
    }
    tick();
    const nm = moves + res.count;
    setB(res.board);
    setMoves(nm);
    if (isGoal(res.board)) {
      const st = stars3(nm, cur.min);
      setWon(true);
      setStars(st);
      cheer();
      setMsg({ t: round >= 3 ? `해냈어요! 별 ${st}개! 레벨을 모두 깼어요!` : `해냈어요! ${nm}번 만에 완성! (가장 적게는 ${cur.min}번) 별 ${st}개! 곧 다음 판이에요.`, tone: "ok" });
    } else setMsg({ t: res.count > 1 ? `${res.count}칸을 한꺼번에 밀었어요!` : "좋아요! 계속 맞춰 봐요.", tone: "info" });
  };

  const showHint = () => {
    const path = solveBoard(rows, cols, b, 45, 400000);
    const p = path && path.length ? path[0] : greedyHint(rows, cols, b);
    setHint(p);
    tick();
    setMsg({ t: `💡 반짝이는 타일을 눌러 봐요${path ? ` (이 판은 ${path.length}번이면 끝나요)` : ""}.`, tone: "info" });
  };
  const reset = () => {
    setB(cur.board);
    setMoves(0);
    setHint(-1);
    setMsg({ t: "처음 모양으로 되돌렸어요.", tone: "info" });
  };

  const down = (p: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (won || p === blank) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dr.current = { tile: p, sx: e.clientX, sy: e.clientY, moved: false };
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = dr.current;
    if (!d || !boxRef.current) return;
    const cell = boxRef.current.clientWidth / cols;
    const dx = e.clientX - d.sx,
      dy = e.clientY - d.sy;
    if (Math.hypot(dx, dy) > 8) d.moved = true;
    if (!d.moved || !inLine(d.tile)) return;
    const [ux, uy] = dirOf(d.tile);
    const off = Math.max(0, Math.min(cell, dx * ux + dy * uy));
    setDrag({ tile: d.tile, off });
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const d = dr.current;
    dr.current = null;
    const off = drag?.off ?? 0;
    setDrag(null);
    if (!d || !boxRef.current) return;
    const cell = boxRef.current.clientWidth / cols;
    if (!d.moved) return doSlide(d.tile);
    if (inLine(d.tile) && off > cell * 0.3) return doSlide(d.tile);
    if (!inLine(d.tile)) return doSlide(d.tile);
    void e;
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (won) return;
    const map: Record<string, number> = { ArrowLeft: cb < cols - 1 ? blank + 1 : -1, ArrowRight: cb > 0 ? blank - 1 : -1, ArrowUp: rb < rows - 1 ? blank + cols : -1, ArrowDown: rb > 0 ? blank - cols : -1 };
    if (e.key in map) {
      e.preventDefault();
      if (map[e.key] >= 0) doSlide(map[e.key]);
    }
  };

  const dragCells = drag ? lineCells(drag.tile) : [];
  const handPos = !touched && !won ? [blank - cols, blank + cols, blank - 1, blank + 1].find((p, k) => p >= 0 && p < rows * cols && (k < 2 || Math.floor(p / cols) === rb)) ?? -1 : -1;

  return (
    <div className="space-y-3">
      <style>{css}</style>
      <Board className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-game rounded-full bg-accent px-4 py-1 text-lg text-white shadow-[0_3px_0_0_rgba(0,0,0,0.2)]">레벨 {stage} · 라운드 {round}/3</span>
          <span className="flex gap-1" aria-label={`판 3개 중 ${round - 1 + (won ? 1 : 0)}개 성공`}>
            {[1, 2, 3].map((k) => (
              <span key={k} className={`text-2xl ${k < round || (k === round && won) ? "" : "opacity-25 grayscale"}`}>🧩</span>
            ))}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill label="이동" value={moves} />
          <Pill label="가장 적게" value={cur.min} />
        </div>
        {won && <p className="gz-pop text-center text-4xl"><Stars n={stars} /></p>}
        <Talk tone={msg.tone}>{msg.t}</Talk>
        <div className="mx-auto w-full max-w-[420px] rounded-[26px] border-[3px] border-[#be185d] bg-gradient-to-b from-[#fbcfe8] to-[#f9a8d4] p-2.5 shadow-[0_5px_0_0_#be185d]">
          <div ref={boxRef} tabIndex={0} onKeyDown={onKey} className="relative w-full select-none outline-none focus-visible:ring-4 focus-visible:ring-accent/50" style={{ aspectRatio: `${cols} / ${rows}` }} role="application" aria-label={`숫자 밀기 판 ${rows}줄 ${cols}칸. 빈칸 옆 타일을 누르거나 빈칸 쪽으로 밀어요`}>
            <div className="absolute inset-0 rounded-[16px] bg-[#fdf2f8]" style={{ boxShadow: "inset 0 3px 8px rgba(190,24,93,.25)" }} />
            {b.map((v, p) => {
              if (v === 0) return null;
              const r = Math.floor(p / cols),
                c = p % cols;
              const inDrag = dragCells.includes(p);
              const off = inDrag ? drag!.off : 0;
              const [ux, uy] = inDrag ? dirOf(drag!.tile) : [0, 0];
              const right = v - 1 === p;
              return (
                <div
                  key={v}
                  className={`absolute touch-none ${won ? "sl-hop" : ""} ${shake === p ? "sl-shake" : ""}`}
                  style={{
                    left: `${(c / cols) * 100}%`,
                    top: `${(r / rows) * 100}%`,
                    width: `${100 / cols}%`,
                    height: `${100 / rows}%`,
                    padding: 3,
                    transform: `translate(${ux * off}px, ${uy * off}px)`,
                    transition: inDrag ? "none" : "left .16s ease-out, top .16s ease-out, transform .12s",
                    touchAction: "none",
                    animationDelay: won ? `${(v % 5) * 60}ms` : undefined,
                    zIndex: inDrag ? 5 : 1,
                  }}
                  onPointerDown={down(p)}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={() => { dr.current = null; setDrag(null); }}
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`${v}번 타일`}
                    className={`relative flex h-full w-full items-center justify-center rounded-[18px] border-[3px] ${hint === p ? "sl-glow" : ""}`}
                    style={{
                      background: `linear-gradient(160deg, hsl(${HUES[(v - 1) % HUES.length]} 90% 82%), hsl(${HUES[(v - 1) % HUES.length]} 80% 62%))`,
                      borderColor: `hsl(${HUES[(v - 1) % HUES.length]} 60% 38%)`,
                      boxShadow: `0 4px 0 0 hsl(${HUES[(v - 1) % HUES.length]} 60% 38%)`,
                      pointerEvents: "none",
                    }}
                  >
                    <span aria-hidden className={`absolute right-1 top-0.5 leading-none ${cols >= 4 ? "text-[1.05rem] sm:text-2xl" : "text-[1.5rem] sm:text-3xl"}`}>{ANIMALS[(v - 1) % ANIMALS.length]}</span>
                    <span className={`font-game leading-none text-white ${cols >= 4 ? "mt-3 text-[2rem] sm:text-5xl" : "text-[2.4rem] sm:text-6xl"}`} style={{ WebkitTextStroke: "2.5px rgba(60,20,50,.75)", paintOrder: "stroke fill" }}>{v}</span>
                    {right && <span aria-hidden className="absolute bottom-0.5 left-1.5 text-sm">✅</span>}
                  </button>
                  {handPos === p && <span aria-hidden className="gz-bob pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2 text-4xl">👆</span>}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-center text-sm text-muted">빈칸 옆 타일을 <b>눌러요</b>. 빈칸 쪽으로 <b>밀어도</b> 돼요. 한 줄에 여러 개도 한 번에 밀려요.</p>
        <div className="flex gap-2">
          <GButton variant="primary" className="min-h-[56px]! flex-1 text-xl" onClick={showHint} disabled={won}>💡 힌트</GButton>
          <GButton className={`${BIG} min-h-[56px]!`} onClick={reset} disabled={won}>다시 하기</GButton>
        </div>
      </Board>
    </div>
  );
}
