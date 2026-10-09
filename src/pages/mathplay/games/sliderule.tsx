import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { Board, GButton, Say, Stat, clamp, rand, svgPoint } from "./kit";
import { logPos, offsetFor, valueAt, within } from "./sliderule.logic";

const VW = 640;
const VH = 232;
const X0 = 50;
const W = 540;
const TOP_Y = 34;
const BAR_H = 58;
const BOT_Y = 112;
const px = (p: number) => X0 + W * p;

type Tick = { v: number; kind: "major" | "mid" | "minor" };
const TICKS: Tick[] = (() => {
  const t: Tick[] = [];
  for (let i = 1; i <= 10; i++) t.push({ v: i, kind: "major" });
  for (let k = 11; k < 20; k++) t.push({ v: k / 10, kind: k === 15 ? "mid" : "minor" });
  for (let k = 22; k < 40; k += 2) if (k !== 30) t.push({ v: k / 10, kind: "minor" });
  for (let k = 45; k < 100; k += 5) if (k % 10 === 5) t.push({ v: k / 10, kind: "mid" });
  return t;
})();

const POOL: [number, number][] = [
  [2, 3], [1.5, 4], [2.5, 3.2], [3, 4], [1.2, 5], [2, 4.5], [6, 1.5], [2.2, 3], [3.5, 2], [1.8, 4], [4, 5], [3.5, 4], [6, 2.5], [8, 1.5], [2.5, 4], [1.5, 3],
];
const pick5 = () => {
  const a = [...POOL];
  const out: [number, number][] = [];
  while (out.length < 5) out.push(a.splice(rand(a.length), 1)[0]);
  // 쉬운 문제 먼저, 10 넘는 문제는 뒤쪽에
  return out.sort((x, y) => x[0] * x[1] - y[0] * y[1]);
};
const fmt = (x: number) => String(+x.toFixed(3));

function Scale({ y, up, shift = 0, clip, fill = "var(--surface)", stroke = "var(--line)" }: { y: number; up: boolean; shift?: number; clip?: string; fill?: string; stroke?: string }) {
  const x0 = px(shift);
  return (
    <g clipPath={clip}>
      <rect x={x0} y={y} width={W} height={BAR_H} rx={6} fill={fill} stroke={stroke} strokeWidth={stroke === "var(--line)" ? 1 : 2} />
      {TICKS.map(({ v, kind }) => {
        const x = x0 + W * logPos(v);
        const len = kind === "major" ? 24 : kind === "mid" ? 17 : 10;
        const ey = up ? y + BAR_H : y;
        const ty = up ? ey - len : ey + len;
        return <line key={v} x1={x} x2={x} y1={ey} y2={ty} stroke="var(--ink)" strokeWidth={kind === "major" ? 1.8 : 1} />;
      })}
      {TICKS.filter((t) => t.kind === "major").map(({ v }) => (
        <text key={v} x={x0 + W * logPos(v)} y={up ? y + 22 : y + BAR_H - 10} textAnchor="middle" fontSize={17} fontWeight={700} fill="var(--ink)">
          {v}
        </text>
      ))}
    </g>
  );
}

export default function SlideRuleGame() {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "slide" | "cursor"; grab: number } | null>(null);
  const [d, setD] = useState(0); // 아래 자 밀림 (길이 단위, -1~1)
  const [cx, setCx] = useState(0.3); // 커서 위치 (0~1)
  const [probs, setProbs] = useState(pick5);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [ans, setAns] = useState("");
  const [res, setRes] = useState<null | { ok: boolean; val: number }>(null);
  const [msg, setMsg] = useState<{ t: "info" | "ok" | "bad"; s: string }>({ t: "info", s: "아래 자를 끌어서 아래 자의 1을 위 자의 첫째 수에 맞춰 봐요." });

  const done = qi >= 5;
  const [a, b] = probs[Math.min(qi, 4)];
  const truth = a * b;
  const over = truth >= 10;

  const evt = (e: RPointerEvent<SVGSVGElement>) => svgPoint(svgRef.current!, e.clientX, e.clientY);
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    const [x, y] = evt(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (y >= BOT_Y - 6 && y <= BOT_Y + BAR_H + 6) {
      drag.current = { kind: "slide", grab: x - px(d) };
    } else {
      drag.current = { kind: "cursor", grab: 0 };
      setCx(clamp((x - X0) / W, 0, 1));
    }
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    const g = drag.current;
    if (!g) return;
    const [x] = evt(e);
    if (g.kind === "slide") setD(clamp((x - g.grab - X0) / W, -1, 1));
    else setCx(clamp((x - X0) / W, 0, 1));
  };
  const up = () => {
    drag.current = null;
  };
  const key = (which: "slide" | "cursor") => (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.02 : 0.003;
    const dir = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    if (which === "slide") setD((v) => clamp(v + dir * step, -1, 1));
    else setCx((v) => clamp(v + dir * step, 0, 1));
  };

  const topAtCursor = valueAt(cx);
  const pb = cx - d;
  const botAtCursor = pb >= 0 && pb <= 1 ? valueAt(pb) : null;
  const oneAt = d >= 0 ? valueAt(d) : null; // 아래 자 1이 마주 보는 위 눈금
  const tenAt = d + 1 <= 1 && d + 1 >= 0 ? valueAt(d + 1) : null; // 아래 자 10

  const submit = () => {
    if (res || done) return;
    const v = parseFloat(ans.replace(",", "."));
    if (!Number.isFinite(v)) {
      setMsg({ t: "bad", s: "숫자로 적어 주세요. 예: 6 또는 8.5" });
      return;
    }
    const ok = within(v, truth, 0.03);
    setRes({ ok, val: v });
    if (ok) {
      setScore((s) => s + 1);
      setMsg({ t: "ok", s: `맞아요! ${fmt(a)} × ${fmt(b)} = ${fmt(truth)}. 읽은 값 ${fmt(v)} 은(는) 오차 3% 안이에요.` });
    } else {
      setMsg({ t: "bad", s: `아쉬워요. 정답은 ${fmt(truth)} 이에요. 자가 정답 위치로 움직였어요. 눈금을 다시 살펴봐요.` });
    }
    // 정답 위치 보여 주기
    const dd = over ? offsetFor(a) - 1 : offsetFor(a);
    setD(dd);
    setCx(clamp(logPos(truth / (over ? 10 : 1)), 0, 1));
  };
  const next = () => {
    setRes(null);
    setAns("");
    setQi((i) => i + 1);
    setMsg({ t: "info", s: "새 문제예요. 아래 자의 1을 위 자의 첫째 수에 맞춰 봐요." });
  };
  const restart = () => {
    setProbs(pick5());
    setQi(0);
    setScore(0);
    setAns("");
    setRes(null);
    setD(0);
    setCx(0.3);
    setMsg({ t: "info", s: "새로 시작해요. 5문제를 풀어 봐요." });
  };
  const nudge = (v: number) => setD((x) => clamp(x + v, -1, 1));

  const gridLines = useMemo(() => [0, 1], []);
  const x1 = px(d);

  return (
    <Board>
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="문제" value={done ? "끝" : `${qi + 1} / 5`} />
        <Stat label="점수" value={`${score} / 5`} tone={score >= 4 ? "ok" : "plain"} />
      </div>

      <div className="mt-3">
        {done ? (
          <Say tone={score >= 4 ? "ok" : "info"}>
            {score === 5 ? "다섯 문제 모두 맞혔어요! 로그 자 달인이에요." : score >= 4 ? `${score}문제 맞혔어요. 아주 잘했어요!` : `${score}문제 맞혔어요. '다시 하기'로 한 번 더 해 봐요.`}
          </Say>
        ) : (
          <p className="rounded-card bg-accent-soft/60 px-3 py-2 text-lg font-extrabold" data-testid="problem">
            {fmt(a)} × {fmt(b)} = ?
          </p>
        )}
      </div>
      {!done && over && (
        <p className="mt-2 text-sm text-muted">
          결과가 10을 넘어요. 아래 자의 <b>1</b> 대신 오른쪽 끝의 <b>10</b>을 위 자의 {fmt(a)} 에 맞추고 읽은 뒤, 읽은 값에 10을 곱해요. (한 자릿수 옮기기)
        </p>
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className="mt-3 w-full select-none rounded-card bg-bg"
        style={{ touchAction: "none", cursor: "grab" }}
        role="img"
        aria-label="로그 눈금 자. 아래 자를 끌어서 옮길 수 있어요."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <defs>
          <clipPath id="sr-clip">
            <rect x={X0 - 18} y={BOT_Y - 4} width={W + 36} height={BAR_H + 8} />
          </clipPath>
        </defs>
        <text x={X0} y={20} fontSize={13} fill="var(--muted)">위 자 (고정)</text>
        <Scale y={TOP_Y} up />
        <text x={X0 + W} y={BOT_Y - 6} textAnchor="end" fontSize={13} fill="var(--muted)">아래 자 (끌어서 옮겨요)</text>
        <g
          tabIndex={0}
          role="slider"
          aria-label="아래 자 위치"
          aria-valuemin={-1}
          aria-valuemax={1}
          aria-valuenow={+d.toFixed(3)}
          onKeyDown={key("slide")}
          className="outline-none focus-visible:outline focus-visible:outline-2"
        >
          <Scale y={BOT_Y} up={false} shift={d} clip="url(#sr-clip)" fill="var(--accent-soft)" stroke="var(--accent)" />
          {/* 아래 자의 1과 10 표시 */}
          <circle cx={x1} cy={BOT_Y + BAR_H + 10} r={5} fill="var(--accent)" />
          <circle cx={px(d + 1)} cy={BOT_Y + BAR_H + 10} r={5} fill="var(--accent)" />
        </g>
        {/* 길이 더하기 표시: 아래 자의 1 위치까지 길이 */}
        {d > 0.001 && (
          <g>
            <line x1={X0} x2={x1} y1={TOP_Y + BAR_H + 26} y2={TOP_Y + BAR_H + 26} stroke="var(--accent)" strokeWidth={3} />
            <text x={(X0 + x1) / 2} y={TOP_Y + BAR_H + 22} textAnchor="middle" fontSize={12} fill="var(--accent)">밀린 길이</text>
          </g>
        )}
        {/* 커서 선 */}
        <g tabIndex={0} role="slider" aria-label="보조선(커서)" aria-valuemin={0} aria-valuemax={1} aria-valuenow={+cx.toFixed(3)} onKeyDown={key("cursor")} className="outline-none">
          <line x1={px(cx)} x2={px(cx)} y1={TOP_Y - 8} y2={BOT_Y + BAR_H + 8} stroke="#dc2626" strokeWidth={2} />
          <polygon points={`${px(cx) - 6},${TOP_Y - 14} ${px(cx) + 6},${TOP_Y - 14} ${px(cx)},${TOP_Y - 6}`} fill="#dc2626" />
        </g>
        {gridLines.map((p) => (
          <line key={p} x1={px(p)} x2={px(p)} y1={TOP_Y + BAR_H} y2={BOT_Y} stroke="var(--line)" strokeDasharray="3 3" />
        ))}
        <text x={VW / 2} y={VH - 6} textAnchor="middle" fontSize={13} fill="var(--muted)">
          길이 log {fmt(a)} + log {fmt(b)} = log({fmt(truth)})
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <GButton onClick={() => nudge(-0.004)} variant="ghost">◀ 조금 왼쪽</GButton>
        <GButton onClick={() => nudge(0.004)} variant="ghost">조금 오른쪽 ▶</GButton>
        <span className="text-muted">끌기가 어려우면 단추나 방향키(Shift는 크게)를 써요.</span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Stat label="커서 위 눈금" value={fmt(+topAtCursor.toPrecision(3))} />
        <Stat label="커서 아래 눈금" value={botAtCursor === null ? "자 밖" : fmt(+botAtCursor.toPrecision(3))} />
        <Stat label="아래 자 1은" value={oneAt === null ? "왼쪽 밖" : `위 ${fmt(+oneAt.toPrecision(3))}`} />
        {tenAt !== null && <Stat label="아래 자 10은" value={`위 ${fmt(+tenAt.toPrecision(3))}`} />}
      </div>

      <div className="mt-3 space-y-2">
        <Say tone={msg.t}>{msg.s}</Say>
        {res && !done && (
          <p className="rounded-card bg-bg px-3 py-2 text-sm">
            길이를 더하면 곱셈이 돼요: log {fmt(a)} + log {fmt(b)} = {fmt(+Math.log10(a).toFixed(3))} + {fmt(+Math.log10(b).toFixed(3))} = {fmt(+Math.log10(truth).toFixed(3))} = log {fmt(truth)}
          </p>
        )}
      </div>

      {!done && (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex items-center gap-2 text-sm font-semibold">
            자에서 읽은 값
            <input
              value={ans}
              onChange={(e) => setAns(e.target.value)}
              inputMode="decimal"
              disabled={!!res}
              aria-label="자에서 읽은 곱셈 결과"
              className="min-h-[44px] w-28 rounded-card border border-line bg-surface px-3 text-base tabular-nums"
            />
          </label>
          {res ? (
            <GButton variant="primary" onClick={next}>{qi === 4 ? "결과 보기" : "다음 문제"}</GButton>
          ) : (
            <GButton variant="primary" onClick={submit}>확인</GButton>
          )}
        </form>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <GButton onClick={restart}>다시 하기</GButton>
      </div>
      <p className="mt-3 text-sm text-muted">
        자의 눈금은 수가 아니라 log 값(길이)에 맞춰 그려졌어요. 두 길이를 이어 붙이면 log a + log b = log(a×b) 이므로, 이어 붙인 끝의 눈금이 곱이에요. 값은 3% 안이면 정답이에요.
      </p>
    </Board>
  );
}
