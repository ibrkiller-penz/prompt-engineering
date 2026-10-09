import { useCallback, useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, fitCanvas, oops, tick, useFrame } from "./kit";

// <pure>
/** 이항계수 C(n,k) */
function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}
/** n 행의 갈톤 보드에서 k 번째 통(0..n)에 들어갈 이론 확률 C(n,k)/2^n */
function binomPmf(n: number, k: number): number {
  return binom(n, k) / Math.pow(2, n);
}
/** 구슬 하나의 길: 행마다 오른쪽으로 간 횟수 o_0=0, o_1, ..., o_n (마지막이 통 번호) */
function makePath(rows: number, rnd: () => number): number[] {
  const p = [0];
  for (let k = 0; k < rows; k++) p.push(p[k] + (rnd() < 0.5 ? 1 : 0));
  return p;
}
// </pure>

type Ball = { path: number[]; s: number; pred: number | null; x0: number };

const BALL_R = 5;
const BALL_COLORS = ["#f472b6", "#60a5fa", "#facc15", "#34d399", "#a78bfa", "#fb923c"];

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
/** 반짝이는 구슬 하나 */
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x - r / 3, y - r / 3, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.strokeStyle = "rgba(30,27,75,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function layout(w: number, rows: number) {
  const dx = Math.min(60, (w - 16) / (rows + 1));
  const dy = Math.min(34, dx * 0.85);
  const top = 52;
  const binTop = top + rows * dy - dy * 0.3;
  const h = Math.round(top + rows * dy + 140);
  return { dx, dy, top, binTop, h, cx: w / 2 };
}

export default function GaltonGame() {
  const [rows, setRows] = useState(6);
  const [hard, setHard] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const [theory, setTheory] = useState(false);
  const [pred, setPred] = useState<number | null>(null);
  const [score, setScore] = useState({ hit: 0, tries: 0 });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "위쪽을 눌러서 구슬을 떨어뜨려 봐요! 꾹 누르면 계속 떨어져요. 아래 칸을 누르면 🚩 로 예측할 수 있어요." });
  const [, setTick] = useState(0);
  const [width, setWidth] = useState(640);

  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const counts = useRef<number[]>(new Array(7).fill(0));
  const balls = useRef<Ball[]>([]);
  const queue = useRef(0);
  const relAcc = useRef(0);
  const bellShown = useRef(false);
  const holding = useRef<{ x: number; t: number; acc: number } | null>(null);
  const scoreRef = useRef(score);
  scoreRef.current = score;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const upd = () => setWidth(Math.max(280, Math.floor(el.clientWidth)));
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = counts.current.reduce((a, b) => a + b, 0);
  const lay = layout(width, rows);

  const flash = (cls: string) => {
    const el = wrap.current;
    if (!el) return;
    el.classList.remove("am-pop", "am-shake");
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const land = (b: Ball) => {
    const bin = b.path[rows];
    counts.current[bin]++;
    if (b.pred !== null) {
      const hit = b.pred === bin;
      const sc = scoreRef.current;
      const tries = sc.tries + 1;
      setScore({ hit: sc.hit + (hit ? 1 : 0), tries });
      if (hit) cheer();
      else oops();
      flash(hit ? "am-pop" : "am-shake");
      const tail = tries >= 5 ? ` 5번 끝! 별 ${sc.hit + (hit ? 1 : 0)}개예요. 이제 ‘구슬 100개’를 떨어뜨려 봐요.` : "";
      setMsg(hit ? { t: "ok", s: `맞았어요! ⭐ 구슬이 ${bin + 1}번 칸에 들어갔어요. 잘했어요!${tail}` } : { t: "bad", s: `아쉬워요! 구슬은 ${bin + 1}번 칸에 들어갔어요. 괜찮아요, 다시 해 봐요!${tail}` });
    }
    const tot = counts.current.reduce((a, c) => a + c, 0);
    if (tot >= 100 && !bellShown.current && queue.current === 0 && balls.current.length <= 1) {
      bellShown.current = true;
      setMsg({ t: "ok", s: "구슬이 많이 쌓였어요! 가운데 칸이 가장 높고 양쪽은 낮아요. 종 모양이 보이나요? 왜 가운데에 많이 쌓일까요?" });
    }
  };

  const draw = useCallback(() => {
    const c = cv.current;
    if (!c) return;
    const L = layout(width, rows);
    if (c.dataset.w !== `${width}x${L.h}`) {
      c.dataset.w = `${width}x${L.h}`;
      c.style.width = `${width}px`;
      c.style.height = `${L.h}px`;
    }
    const ctx = fitCanvas(c, width, L.h);
    ctx.clearRect(0, 0, width, L.h);
    const bot = L.h - 24;
    const cs = counts.current;
    const tot = cs.reduce((a, b) => a + b, 0);
    const left = L.cx - ((rows + 1) * L.dx) / 2;
    const right = left + (rows + 1) * L.dx;
    const binH = bot - L.binTop;
    // 나무 틀 + 핀볼 유리판
    const wood = ctx.createLinearGradient(0, 0, 0, L.h);
    wood.addColorStop(0, "#fbbf24");
    wood.addColorStop(1, "#b45309");
    ctx.fillStyle = wood;
    roundRect(ctx, 0, 0, width, L.h, 18);
    ctx.fill();
    const glass = ctx.createLinearGradient(0, 0, 0, L.h);
    glass.addColorStop(0, "#5b21b6");
    glass.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = glass;
    roundRect(ctx, 7, 7, width - 14, L.h - 14, 13);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(12 + ((i * 97) % (width - 24)), 12 + ((i * 53) % Math.max(20, L.binTop - 20)), i % 5 === 0 ? 1.8 : 1, 0, 7);
      ctx.fill();
    }
    // 깔때기
    ctx.strokeStyle = "#fcd34d";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(left + 4, 12);
    ctx.lineTo(L.cx - 12, L.top - 14);
    ctx.moveTo(right - 4, 12);
    ctx.lineTo(L.cx + 12, L.top - 14);
    ctx.stroke();
    // 통(칸)
    for (let b = 0; b <= rows; b++) {
      if (pred === b) {
        ctx.fillStyle = "rgba(250,204,21,0.28)";
        ctx.fillRect(left + b * L.dx + 2, L.binTop, L.dx - 4, binH);
      }
    }
    ctx.fillStyle = "#fcd34d";
    for (let b = 0; b <= rows + 1; b++) {
      roundRect(ctx, left + b * L.dx - 2.5, L.binTop, 5, binH, 2.5);
      ctx.fill();
    }
    roundRect(ctx, left - 3, bot, right - left + 6, 5, 2.5);
    ctx.fill();
    // 쌓인 구슬 (다 들어가면 구슬로, 넘치면 사탕 막대로)
    const diam = Math.max(6, Math.min(L.dx - 8, 13));
    const per = Math.max(1, Math.floor((L.dx - 8) / diam));
    const maxC = Math.max(0, ...cs.slice(0, rows + 1));
    const ballMode = Math.ceil(maxC / per) * diam <= binH - 36;
    const expMax = tot ? Math.max(...cs.map((_, k) => tot * binomPmf(rows, k))) : 0;
    const maxV = Math.max(8, maxC, theory ? expMax : 0);
    const unit = ballMode ? diam / per : (binH - 36) / maxV;
    for (let b = 0; b <= rows; b++) {
      const x = left + b * L.dx;
      const n = cs[b];
      if (ballMode) {
        const off = (L.dx - per * diam) / 2;
        for (let j = 0; j < n; j++) {
          const col = j % per;
          const row = Math.floor(j / per);
          drawBall(ctx, x + off + diam / 2 + col * diam, bot - diam / 2 - row * diam, diam / 2 - 0.4, BALL_COLORS[(b * 3 + j) % BALL_COLORS.length]);
        }
      } else if (n > 0) {
        const hgt = n * unit;
        const g = ctx.createLinearGradient(x, 0, x + L.dx, 0);
        g.addColorStop(0, "#f472b6");
        g.addColorStop(0.5, "#fbcfe8");
        g.addColorStop(1, "#ec4899");
        ctx.fillStyle = g;
        roundRect(ctx, x + 4, bot - hgt, L.dx - 8, hgt, 5);
        ctx.fill();
      }
      const top = ballMode ? bot - Math.ceil(n / per) * diam : bot - n * unit;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      if (n > 0) {
        ctx.font = "15px Jua, sans-serif";
        ctx.strokeStyle = "#1e1b4b";
        ctx.lineWidth = 4;
        ctx.strokeText(String(n), x + L.dx / 2, Math.max(L.binTop + 36, top - 5));
        ctx.fillStyle = "#fff";
        ctx.fillText(String(n), x + L.dx / 2, Math.max(L.binTop + 36, top - 5));
      }
      if (pred === b) {
        ctx.font = "16px Jua, sans-serif";
        ctx.strokeStyle = "#1e1b4b";
        ctx.lineWidth = 4;
        ctx.strokeText("🚩여기!", x + L.dx / 2, L.binTop + 18);
        ctx.fillStyle = "#fde047";
        ctx.fillText("🚩여기!", x + L.dx / 2, L.binTop + 18);
      }
      ctx.font = "15px Jua, sans-serif";
      ctx.fillStyle = "#fff7d6";
      ctx.fillText(String(b + 1), x + L.dx / 2, L.h - 9);
    }
    // 수학으로 계산한 모양
    if (theory && tot > 0) {
      const ys = Array.from({ length: rows + 1 }, (_, b) => Math.max(L.binTop + 4, bot - tot * binomPmf(rows, b) * unit));
      for (const [w, col] of [
        [6, "#1e1b4b"],
        [3, "#fde047"],
      ] as const) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.beginPath();
        ys.forEach((y, b) => (b ? ctx.lineTo(left + b * L.dx + L.dx / 2, y) : ctx.moveTo(left + L.dx / 2, y)));
        ctx.stroke();
      }
    }
    // 금색 못
    for (let k = 0; k < rows; k++) {
      for (let j = 0; j <= k; j++) {
        const x = L.cx + (j - k / 2) * L.dx;
        const y = L.top + k * L.dy;
        const g = ctx.createRadialGradient(x - 1.5, y - 1.5, 0.5, x, y, 5);
        g.addColorStop(0, "#fffbeb");
        g.addColorStop(1, "#f59e0b");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "#92400e";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // 떨어지는 구슬
    for (const b of balls.current) {
      const P = (k: number): [number, number] =>
        k < 0 ? [b.x0, 12] : [L.cx + (b.path[k] - k / 2) * L.dx, k >= rows ? L.binTop + 8 : L.top + k * L.dy - 8];
      const k = Math.floor(b.s);
      const f = b.s - k;
      const [x0, y0] = P(k);
      const [x1, y1] = P(Math.min(rows, k + 1));
      const e = f * f * (3 - 2 * f);
      const x = x0 + (x1 - x0) * e;
      const y = y0 + (y1 - y0) * f * f - Math.sin(Math.PI * f) * L.dy * 0.2;
      drawBall(ctx, x, y, BALL_R + 1, b.pred !== null ? "#facc15" : "#f472b6");
    }
    // 처음 안내
    if (tot === 0 && balls.current.length === 0) {
      ctx.textAlign = "center";
      const hy = L.top + rows * L.dy * 0.42;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRect(ctx, L.cx - 135, hy - 26, 270, 54, 27);
      ctx.fill();
      ctx.font = "18px Jua, sans-serif";
      ctx.fillStyle = "#6d28d9";
      ctx.fillText("👆 위쪽을 눌러 구슬을 떨어뜨려요!", L.cx, hy - 3);
      ctx.font = "14px Jua, sans-serif";
      ctx.fillStyle = "#6b6280";
      ctx.fillText("꾹 누르면 계속 떨어져요", L.cx, hy + 18);
    }
  }, [width, rows, theory, pred]);

  useFrame((_t, dt) => {
    // 대기 중인 구슬 내보내기
    if (queue.current > 0) {
      relAcc.current += dt * 25 * speed;
      while (relAcc.current >= 1 && queue.current > 0) {
        relAcc.current -= 1;
        queue.current--;
        balls.current.push({ path: makePath(rows, Math.random), s: -1, pred: null, x0: lay.cx + (Math.random() - 0.5) * lay.dx * rows * 0.6 });
      }
    }
    const h = holding.current;
    if (h) {
      h.t += dt;
      if (h.t > 0.35) {
        h.acc += dt * 4 * speed;
        while (h.acc >= 1) {
          h.acc -= 1;
          spawn(h.x);
        }
      }
    }
    const rate = 4.5 * speed;
    const still: Ball[] = [];
    let landed = false;
    for (const b of balls.current) {
      b.s += dt * rate;
      if (b.s >= rows) {
        land(b);
        landed = true;
      } else still.push(b);
    }
    balls.current = still;
    if (landed) setTick((v) => v + 1);
    draw();
  });

  // 크기·설정 바뀌면 바로 다시 그림
  useEffect(() => {
    draw();
  }, [draw]);

  const reset = (r = rows) => {
    counts.current = new Array(r + 1).fill(0);
    balls.current = [];
    queue.current = 0;
    bellShown.current = false;
    setPred(null);
    setTick((v) => v + 1);
  };
  const spawn = (x: number) => {
    const left = lay.cx - ((rows + 1) * lay.dx) / 2;
    const x0 = clamp(x, left + 8, left + (rows + 1) * lay.dx - 8);
    const useP = pred !== null && score.tries < 5 && !balls.current.some((b) => b.pred !== null);
    balls.current.push({ path: makePath(rows, Math.random), s: -1, pred: useP ? pred : null, x0 });
    tick();
    if (useP) {
      setMsg({ t: "info", s: `🚩 ${(pred ?? 0) + 1}번 칸으로 예측했어요. 구슬이 내려와요…` });
      setPred(null);
    }
  };
  const dropMany = () => {
    queue.current += 100;
    bellShown.current = false;
    setMsg({ t: "info", s: "구슬 100개를 떨어뜨려요. 쌓이는 모양을 지켜봐요." });
  };

  const localXY = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const [x, y] = localXY(e);
    if (y >= lay.binTop - 4) {
      const left = lay.cx - ((rows + 1) * lay.dx) / 2;
      const b = Math.floor((x - left) / lay.dx);
      if (b >= 0 && b <= rows && score.tries < 5) {
        tick();
        setPred((p) => (p === b ? null : b));
        setMsg({ t: "info", s: `🚩 ${b + 1}번 칸에 깃발을 꽂았어요! 이제 위쪽을 눌러 구슬을 떨어뜨려요.` });
      }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    holding.current = { x, t: 0, acc: 0 };
    spawn(x);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (holding.current) holding.current.x = localXY(e)[0];
  };
  const onUp = () => {
    holding.current = null;
  };

  const roundsLeft = score.tries < 5;
  const BIG = "!min-h-[48px] !text-base";
  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="font-game mb-2 text-xl">
          {roundsLeft ? "👆 위쪽을 눌러 구슬을 떨어뜨려요. 아래 칸을 누르면 🚩 예측!" : "🚩 예측 5번이 끝났어요. 구슬을 마음껏 떨어뜨려 봐요!"}
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="🚩 예측" value={`${Math.min(score.tries, 5)} / 5`} />
          <Stat label="별" value={score.hit > 0 ? "⭐".repeat(score.hit) : "0"} tone={score.hit > 0 ? "ok" : "plain"} />
          <Stat label="떨어진 구슬" value={total} />
        </div>
        <div ref={wrap} className="w-full overflow-hidden rounded-[18px] shadow-[0_6px_0_rgba(120,53,15,0.35)]">
          <canvas
            ref={cv}
            role="button"
            tabIndex={0}
            aria-label={`구슬 판. 누르면 구슬이 떨어져요. 칸 ${rows + 1}개, 칸별 구슬 수: ${counts.current.slice(0, rows + 1).join(", ")}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                spawn(lay.cx);
              }
            }}
            style={{ touchAction: "none", display: "block", cursor: "pointer" }}
          />
        </div>
        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="soft" className={BIG} onClick={dropMany}>구슬 100개 한꺼번에</GButton>
          <GButton className={BIG} onClick={() => { reset(); setScore({ hit: 0, tries: 0 }); setMsg({ t: "info", s: "처음부터 다시 해요. 위쪽을 눌러 구슬을 떨어뜨려요!" }); }}>처음부터</GButton>
        </div>
      </Board>

      <Board>
        <GButton className={BIG} pressed={hard} onClick={() => { setHard((h) => !h); if (hard) setTheory(false); }}>🔥 더 어려운 도전 {hard ? "닫기" : "열기"}</GButton>
        {hard && (
          <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="속도">
          <span className="font-semibold">속도</span>
          {([["느리게", 0.8], ["보통", 1.5], ["빠르게", 3]] as const).map(([l, v]) => (
            <GButton key={l} className={BIG} pressed={speed === v} onClick={() => setSpeed(v)}>{l}</GButton>
          ))}
        </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="못 줄 수">
              <span className="font-semibold">못 줄 수</span>
              {[6, 8, 10, 12].map((r) => (
                <GButton key={r} className={BIG} pressed={rows === r} onClick={() => { setRows(r); reset(r); }}>{r}줄</GButton>
              ))}
            </div>
            <GButton className={BIG} pressed={theory} onClick={() => setTheory((v) => !v)}>수학으로 계산한 모양 겹쳐 보기</GButton>
            <p className="text-base">
              {rows}줄이면 칸이 {rows + 1}개예요. 오른쪽으로 k번 갈 가능성은 C({rows}, k) / 2^{rows} 이에요. 가운데 칸은 {(100 * binomPmf(rows, Math.floor(rows / 2))).toFixed(1)}% 쯤이에요. 구슬을 많이 떨어뜨릴수록 주황 선과 막대가 비슷해져요.
            </p>
          </div>
        )}
      </Board>
    </div>
  );
}
