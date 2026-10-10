import { useCallback, useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, stageClear, svgPoint, useStage } from "./kit";
import { FNS, judge, makeQuest, questText, zeroTol, type Quest } from "./slope.math";

const W = 400;
const PX0 = 40, PX1 = 390;
const TY0 = 12, TY1 = 190; // 위 그래프
const BY0 = 232, BY1 = 392; // 아래 그래프
const BINS = 140;

const fmt = (v: number) => (Math.abs(v) < 0.005 ? "0" : v.toFixed(2).replace(/\.?0+$/, ""));

export default function SlopeGame() {
  const level = useStage();
  const [fi, setFi] = useState((level - 1) % FNS.length);
  const fn = FNS[fi];
  const [x, setX] = useState(() => (FNS[(level - 1) % FNS.length].id === "sqrt" ? 4 : 1));
  const [quest, setQuest] = useState<Quest>(() => makeQuest(FNS[(level - 1) % FNS.length], Math.random));
  const [trail, setTrail] = useState<Set<number>>(new Set());
  const [showAns, setShowAns] = useState(false);
  const [score, setScore] = useState(0);
  const [hit, setHit] = useState(0);
  const [tries, setTries] = useState(0);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "그래프 위를 끌어서 점을 움직여 보세요. 아래 그래프에 기울기가 찍혀요." });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef(false);
  const lastBin = useRef<number | null>(null);

  const mx = (v: number) => PX0 + ((v - fn.x0) / (fn.x1 - fn.x0)) * (PX1 - PX0);
  const my = (v: number) => TY1 - ((v - fn.y0) / (fn.y1 - fn.y0)) * (TY1 - TY0);
  const dy = (v: number) => BY1 - ((v - fn.d0) / (fn.d1 - fn.d0)) * (BY1 - BY0);
  const binOf = (v: number) => clamp(Math.round(((v - fn.x0) / (fn.x1 - fn.x0)) * BINS), 0, BINS);
  const xOfBin = (b: number) => fn.x0 + ((fn.x1 - fn.x0) * b) / BINS;

  const m = fn.df(x);

  const mark = useCallback((nx: number, ox: number | null) => {
    setTrail((old) => {
      const s = new Set(old);
      const b1 = binOf(nx);
      const b0 = ox === null ? b1 : lastBin.current ?? b1;
      const [a, b] = b0 < b1 ? [b0, b1] : [b1, b0];
      for (let b2 = a; b2 <= b; b2++) if (xOfBin(b2) >= fn.lo - 1e-9) s.add(b2);
      lastBin.current = b1;
      return s;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn]);

  const moveTo = (nx: number) => {
    const v = clamp(nx, fn.lo, fn.x1);
    mark(v, x);
    setX(v);
    setDone(false);
  };

  const fromPointer = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [px] = svgPoint(svg, e.clientX, e.clientY);
    moveTo(fn.x0 + ((px - PX0) / (PX1 - PX0)) * (fn.x1 - fn.x0));
  };

  const newQuest = (f = fn, keep = false) => {
    const q = makeQuest(f, Math.random);
    setQuest(q);
    setDone(false);
    if (!keep) setMsg({ t: "info", s: "새 문제예요! " + questText(q, level) });
  };

  const reset = (idx = fi, keepScore = false) => {
    const f = FNS[idx];
    setTrail(new Set());
    lastBin.current = null;
    setX(clamp(f.id === "sqrt" ? 4 : f.id === "sin" ? 1 : 1, f.lo, f.x1));
    if (!keepScore) {
      setScore(0);
      setHit(0);
      setTries(0);
      setStreak(0);
    }
    const q = makeQuest(f, Math.random);
    setQuest(q);
    setDone(false);
    setMsg({ t: "info", s: "처음부터 시작해요. " + questText(q, level) });
  };

  const pick = (i: number) => {
    setFi(i);
    reset(i, true);
  };

  const check = () => {
    if (done) {
      setMsg({ t: "info", s: "이미 맞혔어요! ‘새 문제’를 눌러 이어 가요." });
      return;
    }
    setTries((t) => t + 1);
    if (judge(quest, m, level)) {
      const gain = 10 + Math.min(streak, 4) * 2;
      setScore((s) => s + gain);
      setHit((h) => h + 1);
      setStreak((s) => s + 1);
      setDone(true);
      cheer();
      setMsg({ t: "ok", s: `맞아요! x = ${fmt(x)} 에서 기울기는 ${fmt(m)} 이에요. +${gain}점 🎉` + (hit + 1 >= ROUNDS ? ` 레벨 ${level}의 라운드 3개를 모두 깼어요!` : " 곧 다음 라운드예요.") });
    } else {
      setStreak(0);
      let hint = "";
      if (quest.kind === "zero") hint = "접선이 수평(기울기 0)이 되는 곳을 찾아봐요.";
      else if (quest.kind === "pos") hint = "접선이 오른쪽으로 올라가는 곳이어야 해요.";
      else if (quest.kind === "neg") hint = "접선이 오른쪽으로 내려가는 곳이어야 해요.";
      else hint = m > (quest.target as number) ? "기울기가 너무 커요. 더 완만한 쪽으로 가 봐요." : "기울기가 아직 작아요. 더 가파른 쪽으로 가 봐요.";
      oops();
      setMsg({ t: "bad", s: `아쉬워요. 지금 기울기는 ${fmt(m)} 이에요. ${hint}` });
    }
  };

  // 맞히면: 3라운드째면 레벨 클리어, 아니면 잠깐 뒤 저절로 새 문제
  useEffect(() => {
    if (!done) return;
    const id = hit >= ROUNDS ? setTimeout(stageClear, 1200) : setTimeout(() => newQuest(), 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, hit]);

  const onKey = (e: React.KeyboardEvent) => {
    const step = ((fn.x1 - fn.x0) / 200) * (e.shiftKey ? 5 : 1);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") (e.preventDefault(), moveTo(x + step));
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") (e.preventDefault(), moveTo(x - step));
    else if (e.key === "Enter" || e.key === " ") (e.preventDefault(), check());
  };

  // 곡선 경로
  const N = 160;
  const curve = (g: (v: number) => number, ym: (v: number) => number) =>
    Array.from({ length: N + 1 }, (_, i) => {
      const v = fn.lo + ((fn.x1 - fn.lo) * i) / N;
      return `${i ? "L" : "M"}${mx(v).toFixed(1)} ${ym(g(v)).toFixed(1)}`;
    }).join("");

  const tl = (fn.x1 - fn.x0) * 0.16;
  const tx0 = x - tl, tx1 = x + tl;
  const ty0 = fn.f(x) + m * (tx0 - x), ty1 = fn.f(x) + m * (tx1 - x);
  const col = Math.abs(m) <= zeroTol(level) ? "var(--muted)" : m > 0 ? "var(--color-ok)" : "var(--color-bad)";
  const trailBins = [...trail].sort((a, b) => a - b);

  const axisX = (y0: number, y1: number, ym: (v: number) => number) =>
    y0 < 0 && y1 > 0 ? <line x1={PX0} x2={PX1} y1={ym(0)} y2={ym(0)} stroke="var(--muted)" strokeWidth={1} /> : null;
  const axisY = (ya: number, yb: number) => (fn.x0 < 0 && fn.x1 > 0 ? <line x1={mx(0)} x2={mx(0)} y1={ya} y2={yb} stroke="var(--muted)" strokeWidth={1} /> : null);

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="함수 고르기">
        <span className="text-sm font-semibold text-muted">함수</span>
        {FNS.map((f, i) => (
          <GButton key={f.id} variant={i === fi ? "primary" : "ghost"} pressed={i === fi} onClick={() => pick(i)}>
            f(x) = {f.label}
          </GButton>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-game text-lg">레벨 {level} · 라운드 {Math.min(hit + 1, ROUNDS)}/{ROUNDS}</span>
        <Stat label="점수" value={score} />
        <Stat label="맞힘/시도" value={`${hit}/${tries}`} />
        <Stat label="연속" value={streak} tone={streak >= 2 ? "ok" : "plain"} />
      </div>

      <p className="mt-3 rounded-card bg-bg px-3 py-2 text-[0.95rem] font-semibold">🎯 문제 · {questText(quest, level)}</p>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} 410`}
        className="mt-3 w-full select-none rounded-card bg-bg"
        style={{ touchAction: "none", cursor: "ew-resize" }}
        role="slider"
        tabIndex={0}
        aria-label={`함수 ${fn.label} 위의 점. 좌우 화살표로 움직여요`}
        aria-valuemin={Math.round(fn.lo * 100) / 100}
        aria-valuemax={Math.round(fn.x1 * 100) / 100}
        aria-valuenow={Math.round(x * 100) / 100}
        aria-valuetext={`x ${fmt(x)}, 기울기 ${fmt(m)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          drag.current = true;
          lastBin.current = null;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => drag.current && fromPointer(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
      >
        <defs>
          <clipPath id="slope-top"><rect x={PX0} y={TY0} width={PX1 - PX0} height={TY1 - TY0} /></clipPath>
        </defs>
        {/* 위 그래프 */}
        <rect x={PX0} y={TY0} width={PX1 - PX0} height={TY1 - TY0} fill="var(--surface)" stroke="var(--line)" />
        {axisX(fn.y0, fn.y1, my)}
        {axisY(TY0, TY1)}
        <text x={PX0 + 4} y={TY0 + 12} fontSize={11} fill="var(--muted)">y = f(x) = {fn.label}</text>
        <path d={curve(fn.f, my)} fill="none" stroke="var(--accent)" strokeWidth={2.5} clipPath="url(#slope-top)" />
        <line x1={mx(tx0)} y1={my(ty0)} x2={mx(tx1)} y2={my(ty1)} stroke={col} strokeWidth={2.5} clipPath="url(#slope-top)" />
        <circle cx={mx(x)} cy={my(fn.f(x))} r={9} fill="var(--surface)" stroke={col} strokeWidth={3} />
        <circle cx={mx(x)} cy={my(fn.f(x))} r={3.5} fill={col} />

        {/* 아래 그래프 */}
        <rect x={PX0} y={BY0} width={PX1 - PX0} height={BY1 - BY0} fill="var(--surface)" stroke="var(--line)" />
        {axisX(fn.d0, fn.d1, dy)}
        {axisY(BY0, BY1)}
        <text x={PX0 + 4} y={BY0 + 12} fontSize={11} fill="var(--muted)">기울기 f′(x)</text>
        {showAns && <path d={curve(fn.df, dy)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" />}
        {trailBins.map((b) => (
          <circle key={b} cx={mx(xOfBin(b))} cy={dy(fn.df(xOfBin(b)))} r={2.4} fill="var(--accent)" />
        ))}
        <line x1={mx(x)} x2={mx(x)} y1={my(fn.f(x))} y2={dy(m)} stroke="var(--line)" strokeDasharray="3 3" />
        <circle cx={mx(x)} cy={dy(m)} r={7} fill={col} stroke="var(--surface)" strokeWidth={2} />

        <text x={PX0} y={406} fontSize={10} fill="var(--muted)">{fmt(fn.x0)}</text>
        <text x={PX1} y={406} fontSize={10} fill="var(--muted)" textAnchor="end">{fmt(fn.x1)}</text>
        <text x={W / 2} y={406} fontSize={10} fill="var(--muted)" textAnchor="middle">x</text>
      </svg>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
        <span>x = <strong className="tabular-nums">{fmt(x)}</strong></span>
        <span>f(x) = <strong className="tabular-nums">{fmt(fn.f(x))}</strong></span>
        <span className="font-bold" style={{ color: col }}>
          접선의 기울기 f′(x) = {fmt(m)}
        </span>
        <span className="text-muted">공식 f′(x) = {fn.dlabel}</span>
      </div>

      <div className="mt-3">
        <Say tone={msg.t}>{msg.s}</Say>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <GButton variant="primary" onClick={check}>여기에 표시</GButton>
        <GButton variant="soft" onClick={() => newQuest()}>새 문제</GButton>
        <GButton pressed={showAns} onClick={() => setShowAns((v) => !v)}>기울기 곡선 미리 보기</GButton>
        <GButton onClick={() => reset()}>다시 하기</GButton>
      </div>
      {fn.zeros.length === 0 && <p className="mt-2 text-xs text-muted">√x 에는 기울기가 0인 곳이 없어서 ‘0’ 문제는 나오지 않아요.</p>}
    </Board>
  );
}

const ROUNDS = 3;
