import { useCallback, useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, fitCanvas, oops, stageClear, tick, useFrame, useStage } from "./kit";

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
type GKind = "drop" | "most" | "least" | "path" | "count";
const LEVEL_ROWS = [6, 6, 7, 8, 8, 9, 10, 10, 11, 12];
const LEVEL_PLAN: GKind[][] = [
  ["drop", "most", "least"],
  ["drop", "most", "path"],
  ["most", "path", "least"],
  ["drop", "most", "path"],
  ["most", "count", "path"],
  ["least", "count", "most"],
  ["path", "count", "most"],
  ["count", "most", "path"],
  ["most", "count", "path"],
  ["count", "path", "most"],
];
const DROP_N = [20, 30, 30, 50, 50, 50, 50, 50, 50, 50];
/** 가장 많이 쌓일 칸(0부터): 줄 수가 짝수면 가운데 하나, 홀수면 가운데 둘 */
const modeBins = (rows: number) => (rows % 2 === 0 ? [rows / 2] : [(rows - 1) / 2, (rows + 1) / 2]);
/** 가장 적게 쌓일 칸: 양 끝 */
const leastBins = (rows: number) => [0, rows];
type Choice = { text: string; answer: number; choices: number[]; unit: string; why: string };
function pathQuestion(rows: number, level: number, rnd: () => number): Choice {
  if (level <= 2)
    return { text: `못이 ${rows}줄이에요. 구슬이 맨 왼쪽 1번 칸에 들어가려면 못에 부딪힐 때마다 왼쪽으로 몇 번 가야 할까요?`, answer: rows, choices: [1, rows - 1, rows], unit: "번", why: `못이 ${rows}줄이니까 ${rows}번 모두 왼쪽으로 가야 해요. 그래서 끝 칸은 잘 안 나와요.` };
  const b = 2 + Math.floor(rnd() * (rows - 1)); // 2..rows (1부터 센 칸 번호)
  const ans = b - 1;
  const set = new Set([ans]);
  for (const c of [b, rows - ans, ans - 1, ans + 2]) if (set.size < 3 && c >= 0 && c <= rows) set.add(c);
  return { text: `못이 ${rows}줄이에요. 구슬이 ${b}번 칸에 들어가려면 오른쪽으로 몇 번 가야 할까요? (나머지는 왼쪽)`, answer: ans, choices: [...set].sort((x, y) => x - y), unit: "번", why: `1번 칸은 오른쪽 0번, 2번 칸은 1번… ${b}번 칸은 오른쪽으로 ${ans}번이에요.` };
}
function countQuestion(rows: number): Choice {
  const m = modeBins(rows)[0];
  const a = Math.round(100 * binomPmf(rows, m));
  return { text: `못이 ${rows}줄이에요. 구슬 100개를 떨어뜨리면 가운데 ${m + 1}번 칸에는 대략 몇 개쯤 들어갈까요?`, answer: a, choices: [Math.round(a / 3), a, Math.min(95, 2 * a)], unit: "개", why: `계산하면 100개 중 약 ${a}개예요. 가운데로 가는 길이 가장 많아서 그래요.` };
}
// </pure>

type Ball = { path: number[]; s: number; pred: number | null; x0: number };

const BALL_R = 5;
function roundIntro(k: GKind, rows: number, level: number) {
  if (k === "drop") return `위쪽을 눌러서 구슬을 ${DROP_N[level - 1]}개 떨어뜨려 봐요! 꾹 누르면 계속 떨어져요.`;
  if (k === "most") return "구슬을 아주 많이 떨어뜨리면 어느 칸에 가장 많이 쌓일까요? 아래 칸을 눌러 🚩 를 꽂아요. (먼저 구슬을 떨어뜨려 봐도 돼요)";
  if (k === "least") return "구슬을 아주 많이 떨어뜨리면 어느 칸에 가장 적게 쌓일까요? 아래 칸을 눌러 🚩 를 꽂아요.";
  return `못이 ${rows}줄이에요. 위의 문제를 읽고 답을 골라요. 구슬을 떨어뜨려 보며 생각해도 돼요!`;
}
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
  const top = 64;
  const binTop = top + rows * dy - dy * 0.3;
  const h = Math.round(top + rows * dy + 140);
  return { dx, dy, top, binTop, h, cx: w / 2 };
}

export default function GaltonGame() {
  const level = Math.min(10, Math.max(1, useStage()));
  const rows = LEVEL_ROWS[level - 1];
  const plan = LEVEL_PLAN[level - 1];
  const [ri, setRi] = useState(0);
  const kind = plan[ri];
  const [choice] = useState<Record<number, Choice | null>>(() => Object.fromEntries(plan.map((k, i) => [i, k === "path" ? pathQuestion(rows, level, Math.random) : k === "count" ? countQuestion(rows) : null])));
  const q = choice[ri];
  const [done, setDone] = useState<null | "fast" | "show">(null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [stars, setStars] = useState(0);
  const speed = 1.5;
  const [theory, setTheory] = useState(false);
  const [pred, setPred] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: roundIntro(plan[0], rows, level) });
  const [, setTick] = useState(0);
  const [width, setWidth] = useState(640);

  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const counts = useRef<number[]>(new Array(rows + 1).fill(0));
  const balls = useRef<Ball[]>([]);
  const queue = useRef(0);
  const relAcc = useRef(0);
  const holding = useRef<{ x: number; t: number; acc: number } | null>(null);
  const doneRef = useRef(done);
  doneRef.current = done;

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
  const win = (text: string, show: boolean) => {
    cheer();
    flash("am-pop");
    if (wrong.length === 0) setStars((s) => s + 1);
    setMsg({ t: "ok", s: text });
    setDone(show ? "show" : "fast");
    if (show) {
      counts.current = new Array(rows + 1).fill(0);
      balls.current = [];
      queue.current = 100;
      setTick((v) => v + 1);
    }
  };
  const miss = (text: string, v: number) => {
    oops();
    flash("am-shake");
    setWrong((w) => [...w, v]);
    setMsg({ t: "bad", s: text });
  };
  const land = (b: Ball) => {
    const bin = b.path[rows];
    counts.current[bin]++;
    if (kind === "drop" && !doneRef.current) {
      const tot = counts.current.reduce((a, c) => a + c, 0);
      if (tot >= DROP_N[level - 1]) {
        doneRef.current = "fast";
        win(`⭐ 구슬 ${DROP_N[level - 1]}개 성공! 가운데 쪽에 더 많이 쌓인 게 보이나요?`, false);
      }
    }
  };

  // 라운드를 깨면 다음 라운드로, 마지막이면 레벨 클리어
  useEffect(() => {
    if (!done) return;
    const wait = done === "show" ? 4200 : 1600;
    if (ri >= plan.length - 1) {
      const id = setTimeout(stageClear, done === "show" ? 3200 : 1200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      const nr = ri + 1;
      setRi(nr);
      setDone(null);
      setWrong([]);
      setPred(null);
      counts.current = new Array(rows + 1).fill(0);
      balls.current = [];
      queue.current = 0;
      setMsg({ t: "info", s: roundIntro(plan[nr], rows, level) });
    }, wait);
    return () => clearTimeout(id);
  }, [done, ri, plan, rows, level]);

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
      const hy = 28; // 깔때기 위(못보다 위)
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRect(ctx, L.cx - 130, hy - 23, 260, 46, 23);
      ctx.fill();
      ctx.font = "17px Jua, sans-serif";
      ctx.fillStyle = "#6d28d9";
      ctx.fillText("👆 여기를 눌러 구슬을 떨어뜨려요!", L.cx, hy - 2);
      ctx.font = "13px Jua, sans-serif";
      ctx.fillStyle = "#6b6280";
      ctx.fillText("꾹 누르면 계속 떨어져요", L.cx, hy + 15);
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

  const spawn = (x: number) => {
    const left = lay.cx - ((rows + 1) * lay.dx) / 2;
    const x0 = clamp(x, left + 8, left + (rows + 1) * lay.dx - 8);
    balls.current.push({ path: makePath(rows, Math.random), s: -1, pred: null, x0 });
    tick();
  };
  const dropMany = () => {
    queue.current += 100;
    tick();
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
      if (b >= 0 && b <= rows && (kind === "most" || kind === "least") && !done && !wrong.includes(b)) {
        tick();
        setPred(b);
        const okSet = kind === "most" ? modeBins(rows) : leastBins(rows);
        if (okSet.includes(b))
          win(kind === "most" ? `🚩 맞아요! ⭐ 가운데 ${b + 1}번 칸이에요. 이제 구슬 100개로 확인해 봐요!` : `🚩 맞아요! ⭐ 맨 끝 칸은 ${rows}번 모두 같은 쪽으로 가야 해서 가장 적어요. 100개로 확인해 봐요!`, true);
        else {
          miss(kind === "most" ? "아쉬워요! 구슬이 가운데로 가는 길이 가장 많아요. 다시 골라 봐요." : "아쉬워요! 한쪽으로만 계속 가야 하는 칸이 가장 드물어요. 다시 골라 봐요.", b);
          setPred(null);
        }
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

  const answer = (v: number) => {
    if (!q || done || wrong.includes(v)) return;
    if (v === q.answer) win(`맞아요! ⭐ ${q.why}${kind === "count" ? " 진짜로 100개를 떨어뜨려 볼게요!" : ""}`, kind === "count");
    else miss("아쉬워요. 괜찮아요, 다시 골라 봐요!", v);
  };
  const BIG = "!min-h-[48px] !text-base";
  const title = kind === "drop" ? `👆 위쪽을 눌러 구슬 ${DROP_N[level - 1]}개를 떨어뜨려요 (꾹 누르면 계속!)` : kind === "most" ? "🚩 구슬이 가장 많이 쌓일 칸을 눌러요" : kind === "least" ? "🚩 구슬이 가장 적게 쌓일 칸을 눌러요" : "🤔 생각해서 골라요";
  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="font-game mb-2 text-xl">{title}</p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label={`레벨 ${level} · 라운드`} value={`${ri + 1} / ${plan.length}`} />
          <Stat label="못" value={`${rows}줄`} />
          <Stat label="별" value={stars > 0 ? "⭐".repeat(stars) : "0"} tone={stars > 0 ? "ok" : "plain"} />
          <Stat label="떨어진 구슬" value={kind === "drop" ? `${total} / ${DROP_N[level - 1]}` : total} />
        </div>
        {q && (
          <div className="mb-3">
            <p className="font-game text-lg">{q.text}</p>
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="답 고르기">
              {q.choices.map((v) => (
                <GButton key={v} className={`${BIG} !text-xl`} variant={done && v === q.answer ? "primary" : "ghost"} disabled={wrong.includes(v) || (!!done && v !== q.answer)} onClick={() => answer(v)}>
                  {v}{q.unit}
                </GButton>
              ))}
            </div>
          </div>
        )}
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
          <GButton className={BIG} onClick={() => { counts.current = new Array(rows + 1).fill(0); balls.current = []; queue.current = 0; setTick((v) => v + 1); }}>구슬 비우기</GButton>
          <GButton className={BIG} pressed={theory} onClick={() => setTheory((v) => !v)}>계산한 모양 보기</GButton>
        </div>
      </Board>
    </div>
  );
}
