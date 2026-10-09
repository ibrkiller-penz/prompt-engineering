import { useCallback, useRef, useState } from "react";
import { Board, GButton, Say, Stat, clamp, rand, svgPoint, useFrame } from "./kit";

// <pure>
/** 반지름 r 인 원이 θ(라디안)만큼 구른 뒤, 중심에서 d·r 떨어진 점의 위치 (x는 오른쪽, y는 땅 위 높이) */
function trochoidPoint(r: number, d: number, th: number): [number, number] {
  return [r * (th - d * Math.sin(th)), r * (1 - d * Math.cos(th))];
}
const circumference = (r: number) => 2 * Math.PI * r;
const archHeight = (r: number) => 2 * r;
// </pure>

type Q = { text: string; answer: number; choices: number[]; hint: string; why: string };
type Pos = "edge" | "in" | "out";
const POS_D: Record<Pos, number> = { edge: 1, in: 0.5, out: 1.5 };

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

function makeQuestions(): Q[] {
  const kinds = shuffle([0, 1, 2, 3, rand(4)]);
  return kinds.map((k): Q => {
    const c = 10 * (2 + rand(4)); // 20~50
    const D = 10 * (1 + rand(3)); // 10~30
    if (k === 0)
      return { text: `바퀴 둘레가 ${c} cm 예요. 바퀴가 한 바퀴 굴러가면 바퀴 가운데는 몇 cm 갈까요?`, answer: c, choices: shuffle([c, c / 2, 2 * c]), hint: "힌트: 바퀴가 한 바퀴 돌면 바퀴 둘레만큼 가요. 아래 파란 막대를 보세요.", why: "한 바퀴 돌면 바퀴 둘레만큼 가요." };
    if (k === 1)
      return { text: `바퀴 둘레가 ${c} cm 예요. 바퀴가 두 바퀴 굴러가면 몇 cm 갈까요?`, answer: 2 * c, choices: shuffle([2 * c, c, 3 * c]), hint: `힌트: 한 바퀴에 ${c} cm 씩 가요. 두 바퀴 위치까지 끌어 보세요.`, why: `${c} cm 가 두 번이니까 ${2 * c} cm 예요.` };
    if (k === 2)
      return { text: `바퀴 지름(가장 긴 폭)이 ${D} cm 예요. 빨간 점이 가장 높이 올라가면 땅에서 몇 cm 일까요? (점은 가장자리)`, answer: D, choices: shuffle([D, D / 2, 2 * D]), hint: "힌트: 점이 바퀴 맨 위에 오면 가장 높아요. 반 바퀴 굴려 보세요.", why: "맨 위에 오면 바퀴 지름만큼 높아요." };
    const a = Math.round(3.14 * D * 10) / 10;
    return { text: `바퀴 지름이 ${D} cm 예요. 바퀴 둘레는 지름의 3.14배쯤이에요. 한 바퀴 굴러가면 약 몇 cm 갈까요?`, answer: a, choices: shuffle([a, 2 * D, 4 * D]), hint: `힌트: ${D} × 3.14 를 계산해 봐요.`, why: `${D} × 3.14 = ${a} 이니까 약 ${a} cm 예요.` };
  });
}

const W = 720;
const H = 270;
const R = 48; // 화면에서 바퀴 반지름(px)
const X0 = 60;
const GY = 140; // 땅 높이(y)
const TURNS = 2;
const TH_MAX = TURNS * 2 * Math.PI;
const BIG = "!min-h-[48px] !text-base";

export default function CycloidGame() {
  const [th, setTh] = useState(0);
  const [pos, setPos] = useState<Pos>("edge");
  const [playing, setPlaying] = useState(false);
  const [qs, setQs] = useState<Q[]>(makeQuestions);
  const [round, setRound] = useState(0);
  const [wrong, setWrong] = useState<number[]>([]);
  const [solved, setSolved] = useState(false);
  const [stars, setStars] = useState(0);
  const [hint, setHint] = useState(false);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "바퀴를 옆으로 끌거나 ‘굴러가기’를 눌러 보세요. 빨간 점이 길을 그려요." });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const d = POS_D[pos];
  const finished = round >= 5;

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

  const setFromPointer = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const [x] = svgPoint(svg, cx, cy);
    let v = clamp((x - X0) / R, 0, TH_MAX);
    for (const k of [Math.PI, 2 * Math.PI, 4 * Math.PI]) if (Math.abs(v - k) < 0.1) v = k; // 반/한/두 바퀴에 달라붙게
    setTh(v);
  }, []);

  const cx = X0 + R * th;
  const cy = GY - R;
  const [px, py] = trochoidPoint(R, d, th);
  const penX = X0 + px;
  const penY = GY - py;
  const pts: string[] = [];
  const steps = Math.max(2, Math.ceil(th / 0.05));
  for (let i = 0; i <= steps; i++) {
    const t = (th * i) / steps;
    const [x, y] = trochoidPoint(R, d, t);
    pts.push(`${(X0 + x).toFixed(1)},${(GY - y).toFixed(1)}`);
  }
  const rollDist = R * th;
  const circ = circumference(R);
  const barW = circ;
  void archHeight;

  const q = qs[Math.min(round, 4)];
  const pick = (v: number) => {
    if (solved || finished) return;
    if (v === q.answer) {
      setSolved(true);
      if (wrong.length === 0) {
        setStars((s) => s + 1);
        setMsg({ t: "ok", s: `맞아요! ⭐ 잘했어요! ${q.why}` });
      } else setMsg({ t: "ok", s: `맞아요! 끝까지 해냈어요. ${q.why}` });
    } else {
      setWrong((w) => [...w, v]);
      setMsg({ t: "bad", s: "아쉬워요. 괜찮아요, 다시 해 봐요! ‘힌트’를 눌러도 돼요." });
    }
  };
  const next = () => {
    const nr = round + 1;
    setRound(nr);
    setWrong([]);
    setSolved(false);
    setHint(false);
    setPlaying(false);
    setTh(0);
    if (nr < 5) {
      if (qs[nr].text.includes("가장 높이")) setPos("edge");
      setMsg({ t: "info", s: "다음 문제예요. 바퀴를 굴려 보면서 풀어 봐요." });
    } else setMsg({ t: "ok", s: `5문제 끝! 별 ${stars}개를 모았어요. 정말 잘했어요!` });
  };
  const restart = () => {
    setQs(makeQuestions());
    setRound(0);
    setStars(0);
    setWrong([]);
    setSolved(false);
    setHint(false);
    setTh(0);
    setMsg({ t: "info", s: "처음부터 다시 해요. 바퀴를 굴려 보세요!" });
  };

  return (
    <div className="space-y-3 text-base">
      <Board>
        <p className="mb-2 text-base font-semibold">
          {th === 0 && !playing ? "👉 바퀴를 옆으로 끌어 보세요. 빨간 점이 어떤 길을 그릴까요?" : "빨간 점이 지나간 길이에요. 바퀴가 한 바퀴 돌면 바퀴 둘레만큼 가요."}
        </p>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="수평선 위를 굴러가는 바퀴와 바퀴 위 빨간 점이 그리는 길"
          className="block w-full select-none rounded-card bg-bg"
          style={{ touchAction: "none", cursor: "ew-resize" }}
          onPointerDown={(e) => {
            dragging.current = true;
            setPlaying(false);
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
            setFromPointer(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => dragging.current && setFromPointer(e.clientX, e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <line x1={10} y1={GY} x2={W - 10} y2={GY} stroke="#64748b" strokeWidth={2} />
          {Array.from({ length: TURNS + 1 }, (_, i) => (
            <g key={i}>
              <line x1={X0 + i * circ} y1={GY - 4} x2={X0 + i * circ} y2={GY + 6} stroke="#64748b" strokeWidth={2} />
              <text x={X0 + i * circ} y={GY + 26} textAnchor="middle" fontSize={20} fill="#64748b">
                {i === 0 ? "출발" : `${i}바퀴`}
              </text>
            </g>
          ))}
          <line x1={X0} y1={GY} x2={X0 + rollDist} y2={GY} stroke="#0ea5e9" strokeWidth={5} strokeLinecap="round" />
          <polyline points={pts.join(" ")} fill="none" stroke="#ef4444" strokeWidth={3} strokeLinejoin="round" />
          <circle cx={cx} cy={cy} r={R} fill="#38bdf8" fillOpacity={0.18} stroke="#0284c7" strokeWidth={2} />
          <line x1={cx} y1={cy} x2={penX} y2={penY} stroke="#0284c7" strokeWidth={1.5} strokeDasharray="4 3" />
          <circle cx={cx} cy={cy} r={3} fill="#0284c7" />
          <circle cx={penX} cy={penY} r={7} fill="#ef4444" stroke="#fff" strokeWidth={2} />

          <text x={X0} y={H - 56} fontSize={20} fill="#64748b">
            바퀴 둘레를 쭉 펴면
          </text>
          <rect x={X0} y={H - 46} width={barW} height={12} rx={6} fill="none" stroke="#0284c7" strokeWidth={1.5} />
          <rect x={X0} y={H - 46} width={Math.min(barW, rollDist)} height={12} rx={6} fill="#0ea5e9" />
          <text x={X0 + barW + 10} y={H - 35} fontSize={20} fill="#0284c7" fontWeight={700}>
            한 바퀴
          </text>
          <text x={X0} y={H - 8} fontSize={20} fill="#64748b">
            {(th / (2 * Math.PI)).toFixed(1)}바퀴 굴렀어요
          </text>
        </svg>

        <label className="mt-3 flex flex-wrap items-center gap-3 font-semibold">
          <span className="w-24 shrink-0">바퀴 굴리기</span>
          <input
            type="range"
            min={0}
            max={TH_MAX}
            step={0.01}
            value={th}
            aria-label="바퀴를 얼마나 굴릴지"
            onChange={(e) => {
              setPlaying(false);
              setTh(+e.target.value);
            }}
            className="h-12 min-w-[8rem] flex-1 accent-[var(--accent)]"
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          <GButton variant="primary" className={BIG} onClick={() => { if (th >= TH_MAX) setTh(0); setPlaying((p) => !p); }}>
            {playing ? "⏸ 멈추기" : "▶ 굴러가기"}
          </GButton>
          <GButton className={BIG} onClick={() => { setPlaying(false); setTh(0); }}>처음으로</GButton>
          <GButton variant="soft" className={BIG} onClick={() => { setPlaying(false); setTh(2 * Math.PI); }}>한 바퀴 굴린 곳</GButton>
        </div>
        <p className="mt-3 font-semibold">빨간 점을 어디에 놓을까요?</p>
        <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="빨간 점의 위치">
          <GButton className={BIG} pressed={pos === "edge"} onClick={() => setPos("edge")}>바퀴 가장자리</GButton>
          <GButton className={BIG} pressed={pos === "in"} onClick={() => setPos("in")}>바퀴 안쪽</GButton>
          <GButton className={BIG} pressed={pos === "out"} onClick={() => setPos("out")}>바퀴 바깥쪽</GButton>
        </div>
        <p className="mt-2 text-base text-muted">
          {pos === "edge" ? "가장자리 점은 뾰족한 아치 모양 길을 그려요." : pos === "in" ? "안쪽 점은 물결치는 완만한 길을 그려요." : "바깥쪽 점은 바퀴에 막대가 달린 것처럼 고리가 생겨요."}
        </p>
      </Board>

      <Board>
        <div className="mb-2 flex flex-wrap gap-2">
          <Stat label="문제" value={`${Math.min(round + 1, 5)} / 5`} />
          <Stat label="별" value={stars > 0 ? "⭐".repeat(stars) : "0"} tone={stars > 0 ? "ok" : "plain"} />
        </div>
        {!finished ? (
          <>
            <p className="text-lg font-bold">{q.text}</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="답 고르기">
              {q.choices.map((v) => (
                <GButton key={v} className={`${BIG} !text-lg`} variant={solved && v === q.answer ? "primary" : "ghost"} disabled={wrong.includes(v) || (solved && v !== q.answer)} onClick={() => pick(v)}>
                  {v} cm
                </GButton>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {!solved && <GButton className={BIG} variant="soft" onClick={() => setHint(true)}>💡 힌트</GButton>}
              {solved && <GButton className={BIG} variant="primary" onClick={next}>{round === 4 ? "결과 보기" : "다음 문제 ▶"}</GButton>}
            </div>
            {hint && !solved && <p className="mt-2 rounded-card bg-bg p-2 text-base">{q.hint}</p>}
          </>
        ) : (
          <div>
            <p className="text-lg font-bold">모두 풀었어요! 별 {stars}개 {"⭐".repeat(stars)}</p>
            <GButton className={`${BIG} mt-2`} variant="primary" onClick={restart}>다시 하기</GButton>
          </div>
        )}
        <div className="mt-3 [&_p]:!text-base">
          <Say tone={msg.t}>{msg.s}</Say>
        </div>
      </Board>
    </div>
  );
}
