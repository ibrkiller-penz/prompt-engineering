import { useCallback, useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, fitCanvas, useFrame } from "./kit";

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

type Ball = { path: number[]; s: number; pred: number | null };

const BALL_R = 5;

function layout(w: number, rows: number) {
  const dx = Math.min(60, (w - 16) / (rows + 1));
  const dy = Math.min(34, dx * 0.85);
  const top = 24;
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
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "구슬이 어느 칸에 들어갈지 맞혀 봐요! 칸을 누르고 ‘구슬 떨어뜨리기’를 눌러요." });
  const [, setTick] = useState(0);
  const [width, setWidth] = useState(640);

  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const counts = useRef<number[]>(new Array(7).fill(0));
  const balls = useRef<Ball[]>([]);
  const queue = useRef(0);
  const relAcc = useRef(0);
  const bellShown = useRef(false);
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

  const land = (b: Ball) => {
    const bin = b.path[rows];
    counts.current[bin]++;
    if (b.pred !== null) {
      const hit = b.pred === bin;
      const sc = scoreRef.current;
      const tries = sc.tries + 1;
      setScore({ hit: sc.hit + (hit ? 1 : 0), tries });
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
    const bot = L.h - 22;
    const cs = counts.current;
    const tot = cs.reduce((a, b) => a + b, 0);
    const left = L.cx - ((rows + 1) * L.dx) / 2;
    const binH = bot - L.binTop;
    // 통 칸막이
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.5;
    for (let b = 0; b <= rows + 1; b++) {
      ctx.beginPath();
      ctx.moveTo(left + b * L.dx, L.binTop);
      ctx.lineTo(left + b * L.dx, bot);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(left, bot);
    ctx.lineTo(left + (rows + 1) * L.dx, bot);
    ctx.stroke();
    // 막대
    const expMax = tot ? Math.max(...cs.map((_, k) => tot * binomPmf(rows, k))) : 0;
    const maxV = Math.max(8, ...cs, theory ? expMax : 0);
    const unit = (binH - 22) / maxV;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    for (let b = 0; b <= rows; b++) {
      const x = left + b * L.dx;
      if (pred === b) {
        ctx.fillStyle = "rgba(245,158,11,0.18)";
        ctx.fillRect(x + 1, L.binTop, L.dx - 2, binH);
        ctx.fillStyle = "#b45309";
        ctx.fillText("내 예측", x + L.dx / 2, L.binTop + 14);
      }
      const hgt = cs[b] * unit;
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(x + 3, bot - hgt, L.dx - 6, hgt);
      if (cs[b] > 0) {
        ctx.fillStyle = "#0369a1";
        ctx.fillText(String(cs[b]), x + L.dx / 2, Math.max(L.binTop + 28, bot - hgt - 4));
      }
      ctx.fillStyle = "#64748b";
      ctx.fillText(String(b + 1), x + L.dx / 2, L.h - 6);
    }
    // 이론 곡선
    if (theory && tot > 0) {
      ctx.strokeStyle = "#f59e0b";
      ctx.fillStyle = "#f59e0b";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let b = 0; b <= rows; b++) {
        const x = left + b * L.dx + L.dx / 2;
        const y = bot - tot * binomPmf(rows, b) * unit;
        if (b === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let b = 0; b <= rows; b++) {
        ctx.beginPath();
        ctx.arc(left + b * L.dx + L.dx / 2, bot - tot * binomPmf(rows, b) * unit, 3.5, 0, 7);
        ctx.fill();
      }
    }
    // 못
    ctx.fillStyle = "#64748b";
    for (let k = 0; k < rows; k++) {
      for (let j = 0; j <= k; j++) {
        ctx.beginPath();
        ctx.arc(L.cx + (j - k / 2) * L.dx, L.top + k * L.dy, 2.8, 0, 7);
        ctx.fill();
      }
    }
    // 구슬
    ctx.fillStyle = "#0ea5e9";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    for (const b of balls.current) {
      const P = (k: number): [number, number] =>
        k < 0 ? [L.cx, L.top - L.dy] : [L.cx + (b.path[k] - k / 2) * L.dx, k >= rows ? L.binTop + 8 : L.top + k * L.dy - 7];
      const k = Math.floor(b.s);
      const f = b.s - k;
      const [x0, y0] = P(k);
      const [x1, y1] = P(Math.min(rows, k + 1));
      const e = f * f * (3 - 2 * f);
      const x = x0 + (x1 - x0) * e;
      const y = y0 + (y1 - y0) * f * f - Math.sin(Math.PI * f) * L.dy * 0.2;
      ctx.beginPath();
      ctx.arc(x, y, BALL_R, 0, 7);
      ctx.fill();
      ctx.stroke();
    }
  }, [width, rows, theory, pred]);

  useFrame((_t, dt) => {
    // 대기 중인 구슬 내보내기
    if (queue.current > 0) {
      relAcc.current += dt * 25 * speed;
      while (relAcc.current >= 1 && queue.current > 0) {
        relAcc.current -= 1;
        queue.current--;
        balls.current.push({ path: makePath(rows, Math.random), s: -1, pred: null });
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
  const dropOne = () => {
    if (balls.current.some((b) => b.pred !== null)) return; // 예측한 구슬이 아직 내려오는 중
    const roundsLeft = score.tries < 5;
    if (roundsLeft && pred === null) {
      setMsg({ t: "info", s: "먼저 구슬이 들어갈 칸을 눌러 보세요!" });
      return;
    }
    balls.current.push({ path: makePath(rows, Math.random), s: -1, pred: roundsLeft ? pred : null });
    if (roundsLeft && pred !== null) {
      setMsg({ t: "info", s: `${pred + 1}번 칸으로 예측했어요. 구슬이 내려와요…` });
      setPred(null);
    } else setMsg({ t: "info", s: "구슬을 떨어뜨렸어요!" });
  };
  const dropMany = () => {
    queue.current += 100;
    bellShown.current = false;
    setMsg({ t: "info", s: "구슬 100개를 떨어뜨려요. 쌓이는 모양을 지켜봐요." });
  };

  const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const left = lay.cx - ((rows + 1) * lay.dx) / 2;
    if (y < lay.binTop - 4) return;
    const b = Math.floor((x - left) / lay.dx);
    if (b >= 0 && b <= rows) setPred(b);
  };

  const roundsLeft = score.tries < 5;
  const BIG = "!min-h-[48px] !text-base";
  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="mb-2 text-base font-bold">
          {roundsLeft ? "👇 구슬이 들어갈 칸을 눌러 맞혀 보세요" : "예측 놀이가 끝났어요. 구슬을 마음껏 떨어뜨려 봐요!"}
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="예측" value={`${Math.min(score.tries, 5)} / 5`} />
          <Stat label="별" value={score.hit > 0 ? "⭐".repeat(score.hit) : "0"} tone={score.hit > 0 ? "ok" : "plain"} />
          <Stat label="떨어진 구슬" value={total} />
        </div>
        <div ref={wrap} className="w-full overflow-hidden rounded-card bg-bg">
          <canvas
            ref={cv}
            role="img"
            aria-label={`구슬 떨어뜨리기 판. 칸 ${rows + 1}개. 칸별 구슬 수: ${counts.current.slice(0, rows + 1).join(", ")}`}
            onPointerDown={(e) => roundsLeft && onCanvas(e)}
            style={{ touchAction: "manipulation", display: "block", cursor: "pointer" }}
          />
        </div>
        <p className="mt-1 text-base text-muted">구슬은 못에 닿을 때마다 왼쪽·오른쪽으로 반반씩 갈려요. 가운데 칸에 가장 많이 들어가요.</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="예측할 칸 고르기">
          {Array.from({ length: rows + 1 }, (_, b) => (
            <button
              key={b}
              type="button"
              aria-label={`${b + 1}번 칸 예측`}
              aria-pressed={pred === b}
              disabled={!roundsLeft}
              onClick={() => setPred(b)}
              className={`min-h-[48px] min-w-[48px] rounded-card border border-line px-2 text-lg font-bold tabular-nums disabled:opacity-40 ${pred === b ? "bg-accent text-accent-ink" : "bg-surface hover:bg-bg"}`}
            >
              {b + 1}
            </button>
          ))}
        </div>
        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <GButton variant="primary" className={BIG} onClick={dropOne}>구슬 떨어뜨리기</GButton>
          <GButton variant="soft" className={BIG} onClick={dropMany}>구슬 100개 한꺼번에</GButton>
          <GButton className={BIG} onClick={() => { reset(); setScore({ hit: 0, tries: 0 }); setMsg({ t: "info", s: "처음부터 다시 해요. 칸을 눌러 예측해 봐요!" }); }}>처음부터</GButton>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="속도">
          <span className="font-semibold">속도</span>
          {([["느리게", 0.8], ["보통", 1.5], ["빠르게", 3]] as const).map(([l, v]) => (
            <GButton key={l} className={BIG} pressed={speed === v} onClick={() => setSpeed(v)}>{l}</GButton>
          ))}
        </div>
      </Board>

      <Board>
        <GButton className={BIG} pressed={hard} onClick={() => { setHard((h) => !h); if (hard) setTheory(false); }}>🔥 더 어려운 도전 {hard ? "닫기" : "열기"}</GButton>
        {hard && (
          <div className="mt-3 space-y-3">
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
