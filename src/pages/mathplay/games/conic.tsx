import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { Board, GButton, Say, Slider, Stat, cheer, oops, rand, stageClear, svgPoint, useStage } from "./kit";
import { D, classify, curveSegments, measure, pointAt, snapE, type Kind, checkTask, conicTask, type ConicTask } from "./conic.logic";

const S = 40; // 1 단위 = 40 칸
const X_MIN = -9;
const Y_MAX = 4.5;
const VW = 560;
const VH = 360;
const sx = (x: number) => (x - X_MIN) * S;
const sy = (y: number) => (Y_MAX - y) * S;
const inView = (p: [number, number]) => p[0] > X_MIN + 0.4 && p[0] < X_MIN + VW / S - 0.4 && Math.abs(p[1]) < Y_MAX - 0.4;
const N = 720;
const th = (i: number) => (i / N) * Math.PI * 2;
const validTh = (e: number) => {
  const a: number[] = [];
  for (let i = 0; i < N; i++) {
    const den = 1 + e * Math.cos(th(i));
    if (Math.abs(den) < 1e-6) continue;
    if (inView(pointAt(e, th(i)))) a.push(th(i));
  }
  return a;
};
const COLOR: Record<Kind, string> = { 타원: "#2563eb", 포물선: "#16a34a", 쌍곡선: "#c026d3" };
const KINDS: Kind[] = ["타원", "포물선", "쌍곡선"];
const sample = (k: Kind) => (k === "타원" ? [0.3, 0.5, 0.7, 0.85][rand(4)] : k === "포물선" ? 1 : [1.3, 1.6, 2, 2.5, 3][rand(5)]);
const f2 = (x: number) => String(+x.toFixed(2));
type Mode = "free" | "name" | "ratio";

export default function ConicGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [e, setE] = useState(0.6);
  const [t, setT] = useState(Math.PI / 2);
  const stage = useStage();
  const [mode, setMode] = useState<Mode>("name");
  const [task, setTask] = useState<ConicTask>(() => conicTask(stage));
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string } | null>(null);
  // 이름 맞추기
  const [qi, setQi] = useState(0);
  const [answered, setAnswered] = useState(false);
  // 비율 확인
  const [marks, setMarks] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [rounds, setRounds] = useState(0);

  const segs = useMemo(() => curveSegments(e), [e]);
  const ok = validTh(e);
  const tt = ok.length && !ok.some((x) => Math.abs(x - t) < 0.02) ? ok.reduce((b, x) => (Math.abs(Math.atan2(Math.sin(x - t), Math.cos(x - t))) < Math.abs(Math.atan2(Math.sin(b - t), Math.cos(b - t))) ? x : b), ok[0]) : t;
  const P = pointAt(e, tt);
  const m = measure(P);
  const kind = classify(e);
  const hideName = mode === "name" && !answered && task.type === "kind";

  const nearest = (x: number, y: number) => {
    let best = ok[0] ?? Math.PI / 2;
    let bd = Infinity;
    for (const a of ok) {
      const p = pointAt(e, a);
      const dd = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (dd < bd) {
        bd = dd;
        best = a;
      }
    }
    return best;
  };
  const world = (ev: RPointerEvent<SVGSVGElement>): [number, number] => {
    const [px, py] = svgPoint(svgRef.current!, ev.clientX, ev.clientY);
    return [px / S + X_MIN, Y_MAX - py / S];
  };
  const down = (ev: RPointerEvent<SVGSVGElement>) => {
    const [x, y] = world(ev);
    if (mode === "ratio") {
      let hit = -1;
      marks.forEach((a, i) => {
        const p = pointAt(e, a);
        if (Math.hypot(p[0] - x, p[1] - y) * S < 22) hit = i;
      });
      if (hit >= 0) {
        if (!found.includes(hit)) {
          const nf = [...found, hit];
          setFound(nf);
          const mm = measure(pointAt(e, marks[hit]));
          if (nf.length === marks.length) {
            setRounds((r) => r + 1);
            setMsg({ t: "ok", s: `모두 찾았어요! 세 점 모두 PF ÷ (준선까지 거리) = ${f2(mm.ratio)} = e 예요. 점이 어디에 있어도 비가 같아요.` });
          } else setMsg({ t: "ok", s: `이 점: PF = ${f2(mm.pf)}, 준선까지 = ${f2(mm.dist)}, 비 = ${f2(mm.ratio)} (e = ${f2(e)}). 다른 별도 눌러 봐요.` });
        }
        return;
      }
    }
    ev.currentTarget.setPointerCapture(ev.pointerId);
    dragging.current = true;
    setT(nearest(x, y));
  };
  const move = (ev: RPointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const [x, y] = world(ev);
    setT(nearest(x, y));
  };
  const stopDrag = () => {
    dragging.current = false;
  };
  const step = (dir: number) => {
    if (!ok.length) return;
    const i = ok.findIndex((a) => Math.abs(a - tt) < 1e-9);
    setT(ok[(i + dir + ok.length) % ok.length]);
  };
  const keyP = (ev: KeyboardEvent) => {
    const dir = ev.key === "ArrowRight" || ev.key === "ArrowUp" ? 1 : ev.key === "ArrowLeft" || ev.key === "ArrowDown" ? -1 : 0;
    if (!dir) return;
    ev.preventDefault();
    step(dir * (ev.shiftKey ? 10 : 2));
  };

  const newMarks = (ee: number) => {
    const v = validTh(ee);
    const out: number[] = [];
    while (out.length < 3 && v.length) {
      const a = v[rand(v.length)];
      if (out.every((b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) > 0.35)) out.push(a);
      if (out.length < 3 && out.length + 1 > v.length) break;
    }
    return out;
  };
  const startMode = (md: Mode) => {
    setMode(md);
    setFound([]);
    setAnswered(false);
    if (md === "name") {
      const tk = conicTask(stage);
      setTask(tk);
      if (tk.type === "kind") {
        setE(sample(KINDS.filter((x) => x !== tk.kind)[rand(2)]));
      } else setE(0.6);
      setQi(0);
      setMsg(null);
    } else if (md === "ratio") {
      const ee = [0.5, 0.7, 1, 1.5, 2][rand(5)];
      setE(ee);
      setMarks(newMarks(ee));
      setRounds(0);
      setMsg({ t: "info", s: "곡선 위의 노란 별 세 개를 눌러, 거리의 비가 정말 e 인지 확인해 봐요." });
    } else {
      setMsg(null);
    }
  };
  const check = () => {
    if (answered) return;
    if (checkTask(task, e)) {
      setAnswered(true);
      cheer();
      setMsg({ t: "ok", s: (task.type === "kind" ? `맞아요! e = ${f2(e)} 이므로 ${kind} 이에요.` : `맞아요! e = PF ÷ d = ${task.pf} ÷ ${task.d} = ${f2(task.e)} → ${kind}.`) + (qi >= 2 ? " 레벨 클리어!" : "") });
      setTimeout(qi >= 2 ? stageClear : nextQ, qi >= 2 ? 1200 : 1600);
    } else {
      oops();
      setMsg({ t: "bad", s: task.type === "kind" ? `아쉬워요. 지금 e = ${f2(e)} 는 ${kind} 이에요. ${task.kind} 은(는) ${task.kind === "타원" ? "e < 1" : task.kind === "포물선" ? "e = 1" : "e > 1"} 일 때예요. 다시 해 봐요.` : `아쉬워요. e 는 PF ÷ d 예요. ${task.pf} ÷ ${task.d} 를 계산해서 다시 맞춰 봐요.` });
    }
  };
  const nextQ = () => {
    if (qi >= 2) return;
    const tk = conicTask(stage);
    setTask(tk);
    if (tk.type === "kind") {
      setE(sample(KINDS.filter((x) => x !== tk.kind)[rand(2)]));
    }
    setQi((q) => q + 1);
    setAnswered(false);
    setMsg(null);
  };
  const newRound = () => {
    const ee = [0.4, 0.6, 0.8, 1, 1.4, 2, 2.6][rand(7)];
    setE(ee);
    setMarks(newMarks(ee));
    setFound([]);
    setMsg({ t: "info", s: "새 곡선이에요. 별 세 개를 찾아 눌러 봐요." });
  };

  const freeMsg = `e = ${f2(e)} → ${kind}. 점 P 를 끌어도 PF ÷ (준선까지 거리) = ${f2(m.ratio)} 로 늘 e 와 같아요.`;
  const dirY = sy(0);
  const pS = [sx(P[0]), sy(P[1])] as const;
  const dS = [sx(D), sy(P[1])] as const;

  return (
    <Board>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="놀이 방식">
        <GButton pressed={mode === "free"} onClick={() => startMode("free")}>자유 실험</GButton>
        <GButton pressed={mode === "name"} onClick={() => startMode("name")}>레벨 {stage} 놀이</GButton>
        <GButton pressed={mode === "ratio"} onClick={() => startMode("ratio")}>비율 확인하기</GButton>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Stat label="e" value={f2(e)} />
        <Stat label="곡선" value={hideName ? "???" : kind} />
        {mode === "name" && <Stat label={`레벨 ${stage}`} value={`라운드 ${Math.min(qi + 1, 3)}/3`} />}
        {mode === "ratio" && <Stat label="점수" value={`${rounds} 판`} tone={rounds ? "ok" : "plain"} />}
        {mode === "ratio" && <Stat label="찾은 별" value={`${found.length} / ${marks.length}`} />}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="mt-3 w-full select-none rounded-card border border-line bg-surface"
        style={{ touchAction: "none", cursor: "crosshair" }}
        role="img"
        aria-label="초점과 준선으로 그리는 이차곡선. 곡선 위의 점을 끌 수 있어요."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <defs>
          <clipPath id="cn-clip"><rect x={0} y={0} width={VW} height={VH} /></clipPath>
        </defs>
        <line x1={0} x2={VW} y1={dirY} y2={dirY} stroke="var(--line)" />
        <line x1={sx(D)} x2={sx(D)} y1={0} y2={VH} stroke="#ea580c" strokeWidth={2.4} strokeDasharray="7 5" />
        <text x={sx(D) + 6} y={16} fontSize={14} fontWeight={700} fill="#ea580c">준선 l</text>
        <g clipPath="url(#cn-clip)">
          {segs.map((sg, i) => (
            <polyline key={i} points={sg.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")} fill="none" stroke={hideName ? "var(--accent)" : COLOR[kind]} strokeWidth={3} strokeLinejoin="round" />
          ))}
        </g>
        {/* 거리 선 */}
        <line x1={sx(0)} y1={sy(0)} x2={pS[0]} y2={pS[1]} stroke="var(--accent)" strokeWidth={2.4} />
        <line x1={pS[0]} y1={pS[1]} x2={dS[0]} y2={dS[1]} stroke="#ea580c" strokeWidth={2.4} />
        <text x={(sx(0) + pS[0]) / 2 + 6} y={(sy(0) + pS[1]) / 2 - 6} fontSize={13} fontWeight={700} fill="var(--accent)">PF {f2(m.pf)}</text>
        <text x={(pS[0] + dS[0]) / 2} y={pS[1] + (pS[1] > 40 ? -8 : 18)} fontSize={13} fontWeight={700} textAnchor="middle" fill="#ea580c">d {f2(m.dist)}</text>
        {/* 초점 */}
        <circle cx={sx(0)} cy={sy(0)} r={6} fill="var(--ink)" />
        <text x={sx(0) - 8} y={sy(0) + 20} fontSize={14} fontWeight={800} fill="var(--ink)">F</text>
        {/* 별 표시 */}
        {mode === "ratio" &&
          marks.map((a, i) => {
            const p = pointAt(e, a);
            const done = found.includes(i);
            return (
              <g key={i}>
                <circle cx={sx(p[0])} cy={sy(p[1])} r={11} fill={done ? "var(--ok-soft, #dcfce7)" : "#facc15"} stroke={done ? "var(--ok, #15803d)" : "#a16207"} strokeWidth={2} />
                <text x={sx(p[0])} y={sy(p[1])} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={800} fill="#422006">{done ? "✓" : "★"}</text>
              </g>
            );
          })}
        {/* 끌 수 있는 점 P */}
        <g tabIndex={0} role="slider" aria-label="곡선 위의 점 P" aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round((tt * 180) / Math.PI)} onKeyDown={keyP} style={{ cursor: "grab", outline: "none" }} className="focus-visible:outline focus-visible:outline-2">
          <circle cx={pS[0]} cy={pS[1]} r={22} fill="transparent" />
          <circle cx={pS[0]} cy={pS[1]} r={8.5} fill="#dc2626" stroke="#fff" strokeWidth={2} />
          <text x={pS[0] + 12} y={pS[1] - 10} fontSize={14} fontWeight={800} fill="#dc2626">P</text>
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap gap-2">
        <Stat label="PF" value={f2(m.pf)} />
        <Stat label="준선까지 d" value={f2(m.dist)} />
        <Stat label="PF ÷ d" value={f2(m.ratio)} tone="ok" />
      </div>

      <div className="mt-3">
        <Slider label="비 e (이심률)" value={e} min={0.1} max={3} step={0.05} show={f2} onChange={(v) => setE(snapE(v))} />
        {mode === "ratio" && <p className="text-xs text-muted">e 를 바꾸면 별도 곡선을 따라 움직여요.</p>}
        <div className="mt-1 flex flex-wrap gap-2">
          <GButton variant="soft" onClick={() => setE(0.5)}>e = 0.5</GButton>
          <GButton variant="soft" onClick={() => setE(1)}>e = 1</GButton>
          <GButton variant="soft" onClick={() => setE(2)}>e = 2</GButton>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <Say tone={msg ? msg.t : "info"}>{msg ? msg.s : mode === "name" ? "e 막대를 움직여 곡선을 바꿔 보고, 맞다고 생각하면 '확인'을 눌러요." : freeMsg}</Say>
        {mode === "name" && (
          <p className="font-game rounded-2xl bg-accent-soft px-3 py-2 text-lg">
            {task.type === "kind" ? (
              <>목표: <span className="text-accent">{task.kind}</span> 을(를) 그리는 e 를 맞추고 '확인'!</>
            ) : (
              <>어떤 이차곡선 위의 점 P에서 PF = <span className="text-accent">{task.pf}</span>, 준선까지 d = <span className="text-accent">{task.d}</span> 예요. 이 곡선의 e 로 맞추고 '확인'!</>
            )}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "name" && !answered && <GButton variant="primary" onClick={check}>확인</GButton>}
        {mode === "ratio" && found.length === marks.length && marks.length > 0 && <GButton variant="primary" onClick={newRound}>새 곡선</GButton>}
        {mode !== "free" && <GButton onClick={() => startMode(mode)}>다시 하기</GButton>}
        {mode === "free" && <GButton onClick={() => { setE(0.6); setT(Math.PI / 2); }}>처음으로</GButton>}
      </div>
      <p className="mt-3 text-sm text-muted">
        곡선 위의 점 P 에서 초점 F까지 거리와 준선 l 까지 거리의 비가 e 일 때, 극좌표로 r = ℓ ÷ (1 + e·cosθ) (ℓ = e × {D}) 로 그려요. 0 &lt; e &lt; 1 이면 타원, e = 1 이면 포물선, e &gt; 1 이면 쌍곡선(두 갈래)이에요. 먼 곳은 화면 밖으로 잘려요.
      </p>
    </Board>
  );
}
