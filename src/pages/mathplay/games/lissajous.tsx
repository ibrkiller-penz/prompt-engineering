import { useEffect, useMemo, useRef, useState } from "react";
import { Board, GButton, Say, Slider, Stat, cheer, fitCanvas, oops, stageClear, useFrame, useStage } from "./kit";
import { TAU, gcd, levelTargets, overlap, point, rad, sampleCurve, type Target } from "./lissajous.math";

type Mode = "free" | "quest";
const M = 38; // 막대 두께
const ROUNDS = 3;

function NumRow({ label, v, set }: { label: string; v: number; set: (n: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-sm font-semibold">{label}</span>
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <GButton key={n} variant={v === n ? "primary" : "ghost"} pressed={v === n} onClick={() => set(n)} className="!min-w-[44px] !px-0" title={`${label} ${n}`}>
          <span aria-label={`${label}를 ${n}으로`}>{n}</span>
        </GButton>
      ))}
    </div>
  );
}

export default function LissajousGame() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(1);
  const [deg, setDeg] = useState(0);
  const [trace, setTrace] = useState<"fade" | "full">("full");
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const level = useStage();
  const [mode, setMode] = useState<Mode>("quest");
  const [targets, setTargets] = useState<Target[]>(() => levelTargets(level, Math.random));
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [solved, setSolved] = useState(0);
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState(false);
  const [got, setGot] = useState(false);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "주황 점선과 똑같은 모양이 되도록 a, b, δ를 맞춰 보세요. 다 맞으면 ‘정답 확인’!" });

  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const size = useRef(320);
  const tRef = useRef(0);

  const target = targets[qi] ?? targets[0];
  const targetCurve = useMemo(() => sampleCurve(target.a, target.b, rad(target.deg), 240), [target]);
  const myCurve = useMemo(() => sampleCurve(a, b, rad(deg), 240), [a, b, deg]);
  const ov = useMemo(() => overlap(myCurve, targetCurve, 0.05), [myCurve, targetCurve]);

  const P = useRef({ a, b, deg, trace, mode, targetCurve, playing, speed });
  P.current = { a, b, deg, trace, mode, targetCurve, playing, speed };

  const draw = (dt: number) => {
    const c = cv.current;
    if (!c) return;
    const S = size.current;
    const p = P.current;
    if (p.playing) tRef.current = (tRef.current + dt * 1.4 * p.speed) % (TAU * 60);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const css = getComputedStyle(c);
    const col = (n: string, d: string) => css.getPropertyValue(n).trim() || d;
    const ink = col("--ink", "#1f2328"), muted = col("--muted", "#5b6168"), line = col("--line", "#e3e1da"), accent = col("--accent", "#3b5bdb"), surf = col("--surface", "#fff");
    ctx.clearRect(0, 0, S, S);
    const x0 = M, y0 = M, PW = S - M - 6;
    const cx = (u: number) => x0 + ((u + 1) / 2) * PW;
    const cy = (v: number) => y0 + ((1 - v) / 2) * PW; // 위가 +
    // 판
    ctx.fillStyle = surf;
    ctx.fillRect(x0, y0, PW, PW);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, PW, PW);
    ctx.beginPath();
    ctx.moveTo(cx(0), y0); ctx.lineTo(cx(0), y0 + PW);
    ctx.moveTo(x0, cy(0)); ctx.lineTo(x0 + PW, cy(0));
    ctx.stroke();

    // 목표 모양(퀘스트)
    if (p.mode === "quest") {
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.beginPath();
      p.targetCurve.forEach(([u, v], i) => (i ? ctx.lineTo(cx(u), cy(v)) : ctx.moveTo(cx(u), cy(v))));
      ctx.stroke();
      ctx.restore();
    }

    const d = rad(p.deg);
    const t = tRef.current;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (p.trace === "full") {
      ctx.strokeStyle = accent;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= 360; i++) {
        const [u, v] = point(p.a, p.b, d, (TAU * i) / 360);
        i ? ctx.lineTo(cx(u), cy(v)) : ctx.moveTo(cx(u), cy(v));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      // 최근 한 바퀴(2π)를 서서히 사라지게
      const SEG = 150;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2.8;
      for (let i = 0; i < SEG; i++) {
        const t0 = t - TAU + (TAU * i) / SEG, t1 = t - TAU + (TAU * (i + 1)) / SEG;
        const q0 = point(p.a, p.b, d, t0), q1 = point(p.a, p.b, d, t1);
        ctx.globalAlpha = Math.pow((i + 1) / SEG, 1.6);
        ctx.beginPath();
        ctx.moveTo(cx(q0[0]), cy(q0[1]));
        ctx.lineTo(cx(q1[0]), cy(q1[1]));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const [u, v] = point(p.a, p.b, d, t);
    // 막대: 위(가로 진동), 왼쪽(세로 진동)
    ctx.strokeStyle = muted;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx(-1), M / 2); ctx.lineTo(cx(1), M / 2);
    ctx.moveTo(M / 2, cy(1)); ctx.lineTo(M / 2, cy(-1));
    ctx.stroke();
    // 안내선
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx(u), M / 2); ctx.lineTo(cx(u), cy(v));
    ctx.moveTo(M / 2, cy(v)); ctx.lineTo(cx(u), cy(v));
    ctx.stroke();
    ctx.restore();
    // 막대 위 점
    ctx.fillStyle = "#e11d48";
    ctx.beginPath(); ctx.arc(cx(u), M / 2, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = "#0891b2";
    ctx.beginPath(); ctx.arc(M / 2, cy(v), 7, 0, TAU); ctx.fill();
    // 합성된 점
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(cx(u), cy(v), 6, 0, TAU); ctx.fill();
    ctx.fillStyle = surf;
    ctx.beginPath(); ctx.arc(cx(u), cy(v), 2.5, 0, TAU); ctx.fill();
  };

  useFrame((_, dt) => draw(dt), true);

  // 크기 맞추기
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => {
      const w = Math.max(240, Math.min(480, Math.floor(el.clientWidth)));
      size.current = w;
      if (cv.current) {
        fitCanvas(cv.current, w, w);
        cv.current.style.width = w + "px";
        cv.current.style.height = w + "px";
      }
      draw(0);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = gcd(a, b);
  const period = g === 1 ? "2π" : `2π ÷ ${g}`;
  const done = mode === "quest" && solved >= ROUNDS;
  const tg = gcd(target.a, target.b);

  const startQuest = () => {
    setTargets(levelTargets(level, Math.random));
    setQi(0);
    setScore(0);
    setSolved(0);
    setTries(0);
    setHint(false);
    setGot(false);
    setA(1); setB(1); setDeg(0);
    setTrace("full");
    setMode("quest");
    setMsg({ t: "info", s: "주황 점선과 똑같은 모양이 되도록 a, b, δ를 맞춰 보세요. 다 맞으면 ‘정답 확인’!" });
  };

  const goFree = () => {
    setMode("free");
    setTrace("fade");
    setMsg({ t: "info", s: "자유롭게 바꿔 보세요. a=1, b=2, δ=0° 는 눕힌 8자가 돼요." });
  };

  const check = () => {
    if (got || done) return;
    setTries((n) => n + 1);
    if (ov.same) {
      const gain = hint ? 5 : 10;
      setScore((s) => s + gain);
      setSolved((n) => n + 1);
      setGot(true);
      cheer();
      setMsg({ t: "ok", s: `딱 맞아요! ‘${target.name}’ 은(는) a:b = ${target.a / tg}:${target.b / tg}, δ = ${target.deg}° 로 만들 수 있어요. +${gain}점 🎉` + (solved + 1 >= ROUNDS ? ` 레벨 ${level}의 라운드 3개를 모두 깼어요!` : " 곧 다음 모양이에요.") });
    } else {
      oops();
      setMsg({ t: "bad", s: `아직이에요. 겹침 ${Math.round(ov.pct * 100)}%. 점선과 모양이 달라요. 먼저 가로·세로로 몇 번 왕복하는지(a:b)부터 살펴봐요.` });
    }
  };

  // 맞히면: 3라운드째면 레벨 클리어, 아니면 잠깐 뒤 저절로 다음 모양
  useEffect(() => {
    if (!got) return;
    const id = solved >= ROUNDS ? setTimeout(stageClear, 1200) : setTimeout(next, 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [got, solved]);

  function next() {
    if (qi + 1 >= targets.length) setTargets((t) => [...t, ...levelTargets(level, Math.random, 1)]);
    setQi((n) => n + 1);
    setHint(false);
    setGot(false);
    setA(1); setB(1); setDeg(0);
    setMsg({ t: "info", s: "다음 모양이에요. 점선과 겹치게 맞춰 봐요." });
  }

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="놀이 방법">
        <GButton variant={mode === "free" ? "primary" : "ghost"} pressed={mode === "free"} onClick={goFree}>자유 탐험</GButton>
        <GButton variant={mode === "quest" ? "primary" : "ghost"} pressed={mode === "quest"} onClick={startQuest}>모양 맞추기 퀘스트</GButton>
      </div>

      {mode === "quest" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Stat label="점수" value={score} />
          <span className="font-game text-lg">레벨 {level} · 라운드 {Math.min(solved + 1, ROUNDS)}/{ROUNDS}</span>
          <Stat label="확인" value={`${tries}번`} />
          <Stat label="겹침" value={`${Math.round(ov.pct * 100)}%`} tone={ov.same ? "ok" : "plain"} />
        </div>
      )}
      {mode === "quest" && !done && (
        <p className="mt-2 rounded-card bg-bg px-3 py-2 text-[0.95rem] font-semibold">
          🎯 주황 점선과 같은 그림을 만들어요{hint && <span className="text-accent"> (힌트: a:b = {target.a / tg}:{target.b / tg}, 이름은 ‘{target.name}’)</span>}
        </p>
      )}

      <div className="mt-3 grid gap-4 md:grid-cols-[auto_1fr]">
        <div ref={wrap} className="min-w-0 md:w-[480px]">
          <canvas
            ref={cv}
            role="img"
            aria-label={`가로 진동 a=${a}, 세로 진동 b=${b}, 위상차 ${deg}도로 그려지는 리사주 도형. 위쪽 막대 위 빨간 점이 가로 진동, 왼쪽 막대 위 파란 점이 세로 진동이에요.`}
            className="block rounded-card bg-bg"
            style={{ touchAction: "pan-y" }}
          />
          <p className="mt-1 text-xs text-muted">
            <span className="text-[#e11d48]">●</span> 위 막대: 가로 진동 x = sin(a·t + δ) · <span className="text-[#0891b2]">●</span> 왼쪽 막대: 세로 진동 y = sin(b·t)
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <NumRow label="가로 a" v={a} set={setA} />
          <NumRow label="세로 b" v={b} set={setB} />
          <Slider label="어긋남 δ" value={deg} min={0} max={360} step={15} onChange={setDeg} show={(v) => `${v}°`} />
          <Slider label="빠르기" value={speed} min={0.25} max={2} step={0.25} onChange={setSpeed} show={(v) => `×${v}`} />
          <div className="flex flex-wrap gap-2">
            <GButton onClick={() => setPlaying((v) => !v)} pressed={!playing}>{playing ? "⏸ 멈추기" : "▶ 움직이기"}</GButton>
            <GButton pressed={trace === "full"} onClick={() => setTrace((v) => (v === "fade" ? "full" : "fade"))}>
              {trace === "full" ? "한 바퀴 전체 보는 중" : "서서히 사라지는 자취"}
            </GButton>
          </div>
          <p className="rounded-card bg-bg p-3 text-sm">
            t 가 0 에서 2π 까지 가는 동안 가로로 <strong>{a}</strong>번, 세로로 <strong>{b}</strong>번 왕복해요. a, b 가 정수이면 곡선은 t = 2π 에서 정확히 출발점으로 돌아와 닫혀요
            (이 경우 가장 짧은 닫힘 주기: <strong>{period}</strong>).
          </p>
        </div>
      </div>

      <div className="mt-3"><Say tone={msg.t}>{msg.s}</Say></div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "quest" ? (
          <>
            <GButton variant="primary" onClick={check} disabled={got || done}>정답 확인</GButton>
            <GButton variant="soft" onClick={() => setHint(true)} disabled={hint || got || done}>힌트 (점수 반)</GButton>
            <GButton onClick={next} disabled={done || got}>다른 모양</GButton>
            <GButton onClick={startQuest}>다시 하기</GButton>
          </>
        ) : (
          <>
            <GButton variant="soft" onClick={() => { setA(1); setB(2); setDeg(0); }}>눕힌 8자 보기</GButton>
            <GButton onClick={() => { setA(3); setB(2); setDeg(90); }}>3:2 보기</GButton>
            <GButton onClick={() => { setA(3); setB(2); setDeg(90); setSpeed(1); tRef.current = 0; }}>다시 하기</GButton>
          </>
        )}
      </div>
    </Board>
  );
}
