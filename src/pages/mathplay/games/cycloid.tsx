import { useCallback, useEffect, useRef, useState } from "react";
import { Board, GButton, Say, Stat, cheer, clamp, oops, stageClear, svgPoint, tick, useFrame, useStage } from "./kit";

// <pure>
/** 반지름 r 인 원이 θ(라디안)만큼 구른 뒤, 중심에서 d·r 떨어진 점의 위치 (x는 오른쪽, y는 땅 위 높이) */
function trochoidPoint(r: number, d: number, th: number): [number, number] {
  return [r * (th - d * Math.sin(th)), r * (1 - d * Math.cos(th))];
}
const circumference = (r: number) => 2 * Math.PI * r;
const archHeight = (r: number) => 2 * r;
// </pure>

type Need = "half" | "full";
/** 문제 하나. d = 빨간 점 위치(바퀴 반지름에 대한 비), fixD = 답이 점 위치에 따라 달라져서 점을 못 옮기는 문제 */
type Q = { text: string; need: Need; answer: number; choices: number[]; hint: string; why: string; d: number; fixD: boolean };

// <pure>
/** 레벨별 문제 종류(라운드 3개): A 한 바퀴, F 반 바퀴, B 여러 바퀴, C 가장 높이(가장자리), D 지름→둘레, E 안쪽 점 높이, O 바깥쪽 점 높이 */
const LEVEL_KINDS = ["AAC", "AFC", "ABC", "BCD", "DBC", "DEB", "EDF", "ODB", "EOD", "ODB"];
function shuf<T>(a: T[], rnd: () => number): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
const r1 = (x: number) => Math.round(x * 10) / 10;
function makeQuestions(level: number, rnd: () => number): Q[] {
  const L = Math.min(10, Math.max(1, level));
  const pick = (a: number[]) => a[Math.floor(rnd() * a.length)];
  const cPool = L <= 3 ? [10, 20, 30] : L <= 6 ? [20, 30, 40, 50] : [40, 50, 60, 70, 80, 90];
  const dPool = L <= 6 ? [10, 20, 30] : [20, 30, 40, 50];
  return LEVEL_KINDS[L - 1].split("").map((k): Q => {
    const c = pick(cPool);
    const D = pick(dPool);
    const base = { d: 1, fixD: false };
    if (k === "A") return { ...base, text: `바퀴 둘레가 ${c} cm 예요. 한 바퀴 굴러가면 바퀴 가운데는 몇 cm 갈까요?`, need: "full", answer: c, choices: shuf([c, c / 2, 2 * c], rnd), hint: "바퀴가 한 바퀴 돌면 바퀴 둘레만큼 가요. 노란 줄자를 보세요.", why: "한 바퀴 돌면 바퀴 둘레만큼 가요." };
    if (k === "F") return { ...base, text: `바퀴 둘레가 ${c} cm 예요. 반 바퀴만 굴러가면 몇 cm 갈까요?`, need: "half", answer: c / 2, choices: shuf([c / 2, c, c / 4], rnd), hint: "반 바퀴는 바퀴 둘레의 절반만큼 가요.", why: `${c} cm 의 절반이니까 ${c / 2} cm 예요.` };
    if (k === "B") {
      const n = L <= 5 ? 2 : L <= 8 ? 3 : pick([4, 5]);
      return { ...base, text: `바퀴 둘레가 ${c} cm 예요. ${n}바퀴 굴러가면 몇 cm 갈까요? (한 바퀴만 굴려 봐요)`, need: "full", answer: n * c, choices: shuf([n * c, (n - 1) * c, (n + 1) * c], rnd), hint: `한 바퀴에 ${c} cm 씩 가요. ${n}바퀴는 ${n}배예요.`, why: `${c} × ${n} = ${n * c} cm 예요.` };
    }
    if (k === "C") return { d: 1, fixD: true, text: `바퀴 지름이 ${D} cm 예요. 가장자리의 별이 가장 높이 올라가면 땅에서 몇 cm 일까요? (반 바퀴 굴려 봐요)`, need: "half", answer: D, choices: shuf([D, D / 2, 2 * D], rnd), hint: "별이 바퀴 맨 위에 오면 가장 높아요. 반 바퀴 굴렸을 때예요.", why: "맨 위에 오면 바퀴 지름만큼 높아요." };
    if (k === "D") {
      const a = r1(3.14 * D);
      return { ...base, text: `바퀴 지름이 ${D} cm 예요. 바퀴 둘레는 지름의 3.14배쯤이에요. 한 바퀴 굴러가면 약 몇 cm 갈까요?`, need: "full", answer: a, choices: shuf([a, 2 * D, 4 * D], rnd), hint: `${D} × 3.14 를 계산해 봐요.`, why: `${D} × 3.14 = ${a} 이니까 약 ${a} cm 예요.` };
    }
    if (k === "E") return { d: 0.5, fixD: true, text: `바퀴 지름이 ${D} cm 예요. 별을 바퀴 가운데와 가장자리의 딱 중간에 붙였어요. 별이 가장 높을 때 땅에서 몇 cm 일까요?`, need: "half", answer: r1(0.75 * D), choices: shuf([r1(0.75 * D), D, D / 2], rnd), hint: `바퀴 가운데는 땅에서 ${D / 2} cm 높이에 있어요. 별은 가운데에서 ${D / 4} cm 위로 올라가요.`, why: `${D / 2} + ${D / 4} = ${r1(0.75 * D)} cm 예요.` };
    return { d: 1.5, fixD: true, text: `바퀴 지름이 ${D} cm 예요. 별을 바퀴 밖으로 반지름의 절반만큼 더 나간 곳에 붙였어요. 별이 가장 높을 때 땅에서 몇 cm 일까요?`, need: "half", answer: r1(1.25 * D), choices: shuf([r1(1.25 * D), D, r1(1.5 * D)], rnd), hint: `바퀴 가운데는 땅에서 ${D / 2} cm 높이, 별은 가운데에서 ${r1(0.75 * D)} cm 떨어져 있어요.`, why: `${D / 2} + ${r1(0.75 * D)} = ${r1(1.25 * D)} cm 예요.` };
  });
}
// </pure>

const W = 440;
const H = 270;
const R = 48;
const X0 = 60;
const GY = 140;
const TH_MAX = 2 * Math.PI;
const BIG = "!min-h-[48px] !text-base";
const ROUNDS = 3;
const GF = "S-Core Dream, Pretendard Variable, sans-serif";
function starPath(x: number, y: number, r1: number, r2: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? r2 : r1;
    d += `${i ? "L" : "M"}${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}`;
  }
  return d + "Z";
}

export default function CycloidGame() {
  const level = useStage();
  const [qs] = useState<Q[]>(() => makeQuestions(level, Math.random));
  const [th, setTh] = useState(0);
  const [d, setD] = useState(qs[0].d);
  const [playing, setPlaying] = useState(false);
  const [touched, setTouched] = useState(false);
  const [round, setRound] = useState(0);
  const [reached, setReached] = useState(false);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [stars, setStars] = useState(0);
  const [hint, setHint] = useState(false);
  const [fx, setFx] = useState<{ k: number; t: "ok" | "bad" | "" }>({ k: 0, t: "" });
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "바퀴를 손가락으로 옆으로 끌어 굴려 봐요!" });
  const svgRef = useRef<SVGSVGElement>(null);
  const mode = useRef<"wheel" | "pen" | null>(null);
  const lastSnap = useRef<number | null>(null);
  const q = qs[Math.min(round, ROUNDS - 1)];
  const needTh = q.need === "half" ? Math.PI : TH_MAX;

  useFrame((_t, dt) => {
    setTh((v) => {
      const n = v + dt * 1.6;
      if (n >= TH_MAX) {
        setPlaying(false);
        return TH_MAX;
      }
      return n;
    });
  }, playing);

  // 목표만큼 굴리면 보기가 나타나요
  useEffect(() => {
    if (!reached && th >= needTh - 0.001) {
      setReached(true);
      setMsg({ t: "info", s: "잘 굴렸어요! 이제 알맞은 답을 눌러 보세요." });
    }
  }, [th, reached, needTh]);

  // 맞히면 잠깐 뒤 자동으로 다음 문제, 3문제를 다 풀면 레벨 클리어
  useEffect(() => {
    if (!solved) return;
    if (round >= ROUNDS - 1) {
      const id = setTimeout(stageClear, 1200);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => {
      const nr = round + 1;
      setRound(nr);
      setWrong([]);
      setSolved(false);
      setHint(false);
      setReached(false);
      setPlaying(false);
      setTh(0);
      setD(qs[nr].d);
      setMsg({ t: "info", s: qs[nr].d !== 1 ? "다음 문제예요! 별 자리가 바뀌었어요. 바퀴를 굴려 봐요." : "다음 문제예요! 바퀴를 다시 굴려 봐요." });
    }, 1600);
    return () => clearTimeout(id);
  }, [solved, round, qs]);

  const penPos = (thv: number, dv: number): [number, number] => {
    const [x, y] = trochoidPoint(R, dv, thv);
    return [X0 + x, GY - y];
  };

  const onDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setTouched(true);
    setPlaying(false);
    const [x, y] = svgPoint(svg, e.clientX, e.clientY);
    const [pxx, pyy] = penPos(th, d);
    mode.current = Math.hypot(x - pxx, y - pyy) < 22 && th > 0 && !q.fixD ? "pen" : "wheel";
    onMove(e);
  };
  const onMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const svg = svgRef.current;
      if (!svg || !mode.current) return;
      const [x, y] = svgPoint(svg, e.clientX, e.clientY);
      if (mode.current === "wheel") {
        let v = clamp((x - X0) / R, 0, TH_MAX);
        let snap: number | null = null;
        for (const k of [Math.PI, TH_MAX]) if (Math.abs(v - k) < 0.1) { v = k; snap = k; }
        if (snap !== lastSnap.current && snap !== null) tick(); // 철컥!
        lastSnap.current = snap;
        setTh(v);
      } else {
        const cxx = X0 + R * th;
        const cyy = GY - R;
        let nd = clamp(Math.hypot(x - cxx, y - cyy) / R, 0, 1.5);
        for (const k of [0.5, 1]) if (Math.abs(nd - k) < 0.08) nd = k;
        setD(nd);
      }
    },
    [th],
  );
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    setTouched(true);
    setPlaying(false);
    setTh((v) => {
      let n = clamp(v + (e.key === "ArrowRight" ? 0.2 : -0.2), 0, TH_MAX);
      for (const k of [Math.PI, TH_MAX]) if (Math.abs(n - k) < 0.1) n = k;
      return n;
    });
  };

  const cx = X0 + R * th;
  const cy = GY - R;
  const [penX, penY] = penPos(th, d);
  const pts: string[] = [];
  const steps = Math.max(2, Math.ceil(th / 0.05));
  for (let i = 0; i <= steps; i++) {
    const [x, y] = penPos((th * i) / steps, d);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const rollDist = R * th;
  const barW = circumference(R);
  void archHeight;

  const pick = (v: number) => {
    if (solved) return;
    if (v === q.answer) {
      setSolved(true);
      cheer();
      setFx((f) => ({ k: f.k + 1, t: "ok" }));
      if (wrong.length === 0) {
        setStars((s) => s + 1);
        setMsg({ t: "ok", s: `맞아요! ⭐ 잘했어요! ${q.why}` });
      } else setMsg({ t: "ok", s: `맞아요! 끝까지 해냈어요. ${q.why}` });
    } else {
      oops();
      setFx((f) => ({ k: f.k + 1, t: "bad" }));
      setWrong((w) => [...w, v]);
      setMsg({ t: "bad", s: "아쉬워요. 괜찮아요, 다시 해 봐요! 힌트를 눌러도 돼요." });
    }
  };
  return (
    <div className="space-y-3 text-base">
      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label={`레벨 ${level} · 라운드`} value={`${round + 1} / ${ROUNDS}`} />
          <Stat label="별" value={stars > 0 ? "⭐".repeat(stars) : "0"} tone={stars > 0 ? "ok" : "plain"} />
        </div>
        <p className="font-game mb-2 text-xl">{q.text}</p>
        <div key={fx.k} className={fx.t === "ok" ? "am-pop" : fx.t === "bad" ? "am-shake" : ""}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="slider"
          tabIndex={0}
          aria-label="바퀴를 옆으로 끌어 굴리기"
          aria-valuemin={0}
          aria-valuemax={TH_MAX}
          aria-valuenow={Math.round(th * 100) / 100}
          className="mx-auto block w-full max-w-[560px] select-none overflow-hidden rounded-card shadow-[0_6px_0_rgba(76,29,149,0.18)]"
          style={{ touchAction: "none", cursor: "ew-resize", fontFamily: GF }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (mode.current = null)}
          onPointerCancel={() => (mode.current = null)}
          onKeyDown={onKey}
        >
          <defs>
            <linearGradient id="cy-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a5d8ff" />
              <stop offset="1" stopColor="#ffe3f1" />
            </linearGradient>
            <linearGradient id="cy-grass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#86efac" />
              <stop offset="1" stopColor="#34d399" />
            </linearGradient>
            <linearGradient id="cy-rainbow" gradientUnits="userSpaceOnUse" x1={X0 - R} y1="0" x2={X0 + barW + R} y2="0">
              <stop offset="0" stopColor="#f43f5e" />
              <stop offset="0.2" stopColor="#fb923c" />
              <stop offset="0.4" stopColor="#facc15" />
              <stop offset="0.6" stopColor="#22c55e" />
              <stop offset="0.8" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="cy-tape" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fde047" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
            <radialGradient id="cy-hub" cx="0.35" cy="0.35" r="0.8">
              <stop offset="0" stopColor="#fff7ad" />
              <stop offset="1" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
          {/* 하늘·해·구름·언덕 */}
          <rect width={W} height={GY} fill="url(#cy-sky)" />
          <g aria-hidden>
            <circle cx={W - 46} cy={38} r={22} fill="#fde047" stroke="#f59e0b" strokeWidth={3} />
            <circle cx={W - 53} cy={35} r={2.2} fill="#92400e" />
            <circle cx={W - 39} cy={35} r={2.2} fill="#92400e" />
            <path d={`M${W - 54} ${44} Q${W - 46} ${51} ${W - 38} ${44}`} stroke="#92400e" strokeWidth={2} fill="none" strokeLinecap="round" />
            {[
              [110, 34, 1],
              [270, 24, 0.8],
            ].map(([x, y, s]) => (
              <g key={x} transform={`translate(${x} ${y}) scale(${s})`} fill="#fff">
                <ellipse cx={0} cy={6} rx={30} ry={11} />
                <circle cx={-12} cy={0} r={12} />
                <circle cx={8} cy={-4} r={15} />
              </g>
            ))}
            <path d={`M0 ${GY} Q 90 ${GY - 54} 190 ${GY} Q 290 ${GY - 44} 360 ${GY} Q 410 ${GY - 30} ${W} ${GY} Z`} fill="#bbf7d0" stroke="#4ade80" strokeWidth={2} />
            {/* 작은 놀이공원 천막 */}
            <g transform={`translate(${W - 92} ${GY - 44})`}>
              <rect x={0} y={20} width={44} height={24} fill="#fff" stroke="#db2777" strokeWidth={2} />
              <path d="M-4 22 L22 0 L48 22 Z" fill="#f472b6" stroke="#db2777" strokeWidth={2} strokeLinejoin="round" />
              <path d="M22 0 L13 22 M22 0 L31 22" stroke="#fff" strokeWidth={3} />
              <line x1={22} y1={0} x2={22} y2={-10} stroke="#db2777" strokeWidth={2} />
              <path d="M22 -10 L32 -6 L22 -2 Z" fill="#facc15" />
            </g>
          </g>
          {/* 길·풀밭 */}
          <rect x={0} y={GY} width={W} height={34} fill="#fbcfe8" />
          <line x1={0} y1={GY} x2={W} y2={GY} stroke="#db2777" strokeWidth={3} />
          <line x1={0} y1={GY + 20} x2={W} y2={GY + 20} stroke="#fff" strokeWidth={3} strokeDasharray="12 10" />
          <rect x={0} y={GY + 34} width={W} height={H - GY - 34} fill="url(#cy-grass)" />
          <rect x={X0} y={GY + 3} width={rollDist} height={8} rx={4} fill="#38bdf8" stroke="#0369a1" strokeWidth={1.5} />
          {[
            [X0, "출발"],
            [X0 + R * Math.PI, "반"],
            [X0 + barW, "한 바퀴"],
          ].map(([x, label]) => (
            <g key={label as string}>
              <path d={`M${x} ${GY} l-6 10 h12 Z`} fill="#7c3aed" />
              <text x={x as number} y={GY + 30} textAnchor="middle" fontSize={label === "반" ? 14 : 17} fill="#fff" stroke="#9d174d" strokeWidth={3} paintOrder="stroke">
                {label}
              </text>
            </g>
          ))}
          {/* 무지개 자취 */}
          <polyline points={pts.join(" ")} fill="none" stroke="#fff" strokeOpacity={0.85} strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={pts.join(" ")} fill="none" stroke="url(#cy-rainbow)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
          {/* 바퀴 */}
          <ellipse cx={cx} cy={GY + 2} rx={R * 0.8} ry={5} fill="#9d174d" opacity={0.25} />
          <g transform={`rotate(${(th * 180) / Math.PI} ${cx} ${cy})`}>
            {Array.from({ length: 8 }, (_, i) => {
              const a0 = (i * Math.PI) / 4;
              const a1 = ((i + 1) * Math.PI) / 4;
              const rr = R - 8;
              const cols = ["#fecdd3", "#fef08a", "#bbf7d0", "#bae6fd"];
              return <path key={i} d={`M${cx} ${cy} L${cx + rr * Math.cos(a0)} ${cy + rr * Math.sin(a0)} A${rr} ${rr} 0 0 1 ${cx + rr * Math.cos(a1)} ${cy + rr * Math.sin(a1)} Z`} fill={cols[i % 4]} />;
            })}
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return <line key={i} x1={cx} y1={cy} x2={cx + (R - 8) * Math.cos(a)} y2={cy + (R - 8) * Math.sin(a)} stroke="#f472b6" strokeWidth={2.5} strokeLinecap="round" />;
            })}
            <circle cx={cx} cy={cy} r={R - 4} fill="none" stroke="#6d28d9" strokeWidth={8} />
            <circle cx={cx} cy={cy} r={R - 4} fill="none" stroke="#a78bfa" strokeWidth={3} strokeDasharray="5 7" />
          </g>
          <line x1={cx} y1={cy} x2={penX} y2={penY} stroke="#6d28d9" strokeWidth={2} strokeDasharray="4 3" />
          <circle cx={cx} cy={cy} r={8} fill="url(#cy-hub)" stroke="#b45309" strokeWidth={2} />
          {/* 반짝이 별 스티커 */}
          <g transform={`rotate(${(th * 180) / Math.PI} ${penX} ${penY})`}>
            <path d={starPath(penX, penY, 12, 5.5)} fill="#fde047" stroke="#ea580c" strokeWidth={2.5} strokeLinejoin="round" />
            <circle cx={penX - 3} cy={penY - 3} r={2} fill="#fff" />
          </g>
          {!touched && th === 0 && (
            <text fontSize={34} y={cy + 10} textAnchor="middle" aria-hidden>
              👉
              <animate attributeName="x" values={`${cx};${cx + 150};${cx}`} dur="1.8s" repeatCount="indefinite" />
            </text>
          )}

          {/* 줄자: 바퀴 둘레를 편 길이 */}
          <text x={X0} y={H - 58} fontSize={18} fill="#065f46" stroke="#fff" strokeWidth={4} paintOrder="stroke">
            바퀴 둘레를 쭉 펴면 📏
          </text>
          <rect x={X0} y={H - 50} width={barW} height={16} rx={8} fill="#fffbeb" stroke="#b45309" strokeWidth={2} />
          <rect x={X0} y={H - 50} width={Math.min(barW, rollDist)} height={16} rx={8} fill="url(#cy-tape)" />
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1={X0 + (barW * i) / 10} y1={H - 50} x2={X0 + (barW * i) / 10} y2={H - 44} stroke="#b45309" strokeWidth={1.5} />
          ))}
          <text x={X0} y={H - 10} fontSize={19} fill="#fff" stroke="#047857" strokeWidth={4} paintOrder="stroke">
            {(th / (2 * Math.PI)).toFixed(1)}바퀴 굴렀어요
          </text>
        </svg>
        </div>

        {!reached && (
          <p className="mt-2 text-base font-semibold text-accent">👆 바퀴를 옆으로 끌어서 {q.need === "half" ? "반 바퀴" : "한 바퀴"} 굴려 보세요. (‘철컥’ 하고 붙는 곳까지!)</p>
        )}

        {reached && (
          <div className="mt-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="답 고르기">
              {q.choices.map((v) => (
                <GButton key={v} className={`${BIG} !text-lg`} variant={solved && v === q.answer ? "primary" : "ghost"} disabled={wrong.includes(v) || (solved && v !== q.answer)} onClick={() => pick(v)}>
                  {v} cm
                </GButton>
              ))}
            </div>
            {!solved && (
              <div className="mt-2">
                <GButton className={BIG} variant="soft" onClick={() => setHint(true)}>💡 힌트</GButton>
                {hint && <p className="mt-2 rounded-card bg-bg p-2 text-base">{q.hint}</p>}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            <GButton className={BIG} onClick={() => { if (th >= TH_MAX) setTh(0); setTouched(true); setPlaying((p) => !p); }}>
              {playing ? "⏸ 멈추기" : "▶ 저절로 굴리기"}
            </GButton>
          )}
          <GButton className={BIG} onClick={() => { setPlaying(false); setTh(0); setReached(false); }}>처음으로</GButton>
        </div>
      </Board>

      {!q.fixD && (
        <p className="px-1 text-base text-muted">💡 바퀴를 조금 굴린 뒤 별을 끌면 별 자리를 바꿀 수 있어요. 길 모양이 어떻게 달라질까요?</p>
      )}
    </div>
  );
}
