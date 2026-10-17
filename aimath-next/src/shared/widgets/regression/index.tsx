// 점을 찍으면 회귀직선: 최소제곱으로 구한 직선과 내가 그은 직선의 오차제곱합을 비교해요.
// 휴대폰은 그림을 눌러 점을 찍고, 칠판은 ± 단추로 자리를 정한 뒤 '점 찍기'를 눌러요.
// 찍은 점은 끌어서 옮길 수 있고, 끌기 대신 '점 옮기기'의 ± 단추로도 옮길 수 있어요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import { PRESETS, computeStats, predict, sseFor, type Pt } from "@legacy/widgets/Regression.logic";
import Plot from "../Plot.tsx";
import Stepper from "../Stepper.tsx";
import { Big, Btn, Hide, Note, Readout, Row, Seg, Tex, Toggle, useHidden, useIsBoard } from "../kit.tsx";
import { fmtNum } from "../plot.logic.ts";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

const MAX_POINTS = 20;
const snap = (v: number) => Math.min(10, Math.max(0, Math.round(v * 2) / 2));
const PRESET_BTNS: { id: string; label: string }[] = [
  { id: "positive", label: "양의 상관" },
  { id: "negative", label: "음의 상관" },
  { id: "none", label: "상관 없음" },
  { id: "outlier", label: "튀는 점" },
];
const sgn = (x: number, d = 3) => (x < 0 ? "-" + fmtNum(-x, d) : "+" + fmtNum(x, d));

export default function Regression(props: WidgetProps) {
  const board = useIsBoard();
  const hidden = useHidden();
  const [pts, setPts] = useState<Pt[]>(PRESETS.positive);
  const [preset, setPreset] = useState("positive");
  const [showRes, setShowRes] = useState(false);
  const [mine, setMine] = useState(false);
  const [ma, setMa] = useState(0.5);
  const [mb, setMb] = useState(2);
  const [nx, setNx] = useState(5);
  const [ny, setNy] = useState(5);
  const [px, setPx] = useState(11);
  const [sel, setSel] = useState(0);
  const st = computeStats(pts);
  const mySse = pts.length ? sseFor(pts, ma, mb) : null;
  useMission(props, mission, { n: pts.length, mine, mySse, bestSse: st.sse });

  const add = (p: Pt) => {
    if (pts.length >= MAX_POINTS) return;
    setPts(pts.concat([{ x: snap(p.x), y: snap(p.y) }]));
    setSel(pts.length);
    setPreset("");
  };
  const si = Math.min(sel, Math.max(0, pts.length - 1));
  const move = (i: number, p: Pt) => {
    if (i < 0 || i >= pts.length) return;
    setPts(pts.map((q, j) => (j === i ? { x: snap(p.x), y: snap(p.y) } : q)));
    setSel(i);
    setPreset("");
  };
  const ok = st.a !== null && st.b !== null;
  const line = (a: number, b: number) => [{ x: 0, y: b }, { x: 10, y: a * 10 + b }];

  const series = [
    { label: "점", s: 1, kind: "points" as const, data: pts },
    { label: "회귀직선", s: 2, kind: "line" as const, data: ok && !hidden ? line(st.a as number, st.b as number) : [], noTable: true },
  ];
  if (mine) series.push({ label: "내 직선", s: 3, kind: "line" as const, data: line(ma, mb), noTable: true });

  return (
    <div className="wg-body">
      <Seg
        label="점 모양"
        value={preset}
        options={PRESET_BTNS.map((p) => ({ value: p.id, label: p.label }))}
        onChange={(id) => {
          setPreset(id);
          setPts(PRESETS[id]);
        }}
      />
      <Plot
        title="점과 회귀직선"
        x={[0, 10]}
        y={[0, 10]}
        equal
        ratio={1}
        series={series}
        summary={hidden ? `점 ${pts.length}개예요. 회귀직선은 가려 두었어요.` : ok ? `점 ${pts.length}개, 회귀직선은 y = ${fmtNum(st.a as number)}x ${sgn(st.b as number)}이에요.` : `점 ${pts.length}개예요. 직선을 구하려면 x가 다른 점이 2개 이상 있어야 해요.`}
        onPick={board ? undefined : add}
        handles={pts.map((p, i) => ({ id: String(i), x: p.x, y: p.y, label: `${i + 1}번 점`, s: 1, step: 0.5, small: i !== si }))}
        onDrag={(id, p) => move(parseInt(id, 10), p)}
        under={(sc) =>
          showRes && ok && !hidden ? (
            <g className="wg-resid">
              {pts.map((p, i) => (
                <line key={i} x1={sc.x(p.x)} x2={sc.x(p.x)} y1={sc.y(p.y)} y2={sc.y(predict(st.a as number, st.b as number, p.x))} />
              ))}
            </g>
          ) : null
        }
      />
      {board ? (
        <Row>
          <Stepper label="새 점 x" value={nx} min={0} max={10} step={0.5} onChange={setNx} />
          <Stepper label="새 점 y" value={ny} min={0} max={10} step={0.5} onChange={setNy} />
          <Btn primary disabled={pts.length >= MAX_POINTS} onClick={() => add({ x: nx, y: ny })}>
            점 찍기
          </Btn>
        </Row>
      ) : (
        <Note>그림을 누르면 점이 찍혀요(최대 {MAX_POINTS}개). 찍은 점은 끌어서 옮길 수 있어요.</Note>
      )}
      {pts.length ? (
        <div className="wg-card">
          <h4 className="wg-h">점 옮기기</h4>
          <Row>
            <Stepper label="고른 점" value={si + 1} min={1} max={pts.length} format={(v) => v + "번"} onChange={(v) => setSel(v - 1)} />
            <Stepper label="x" value={pts[si].x} min={0} max={10} step={0.5} onChange={(v) => move(si, { x: v, y: pts[si].y })} />
            <Stepper label="y" value={pts[si].y} min={0} max={10} step={0.5} onChange={(v) => move(si, { x: pts[si].x, y: v })} />
          </Row>
        </div>
      ) : null}
      <Row>
        <Btn onClick={() => setPts(pts.slice(0, -1))} disabled={!pts.length}>
          마지막 점 지우기
        </Btn>
        <Btn
          onClick={() => {
            setPts([]);
            setPreset("");
          }}
        >
          모두 지우기
        </Btn>
        <Toggle label="잔차 보기" on={showRes} onChange={setShowRes} />
        <Toggle label="내 직선 긋기" on={mine} onChange={setMine} />
      </Row>
      {ok ? (
        <>
          <Hide label="회귀직선의 식">
            <Tex block tex={`\\hat{y}=${fmtNum(st.a as number)}x${sgn(st.b as number)}`} />
          </Hide>
          <Big label="상관계수 r" tone={st.r !== null && Math.abs(st.r) >= 0.7 ? "ok" : "plain"}>
            {st.r === null ? "—" : fmtNum(st.r, 3)}
          </Big>
          <div className="wg-grid3">
            <Readout label="오차제곱합(회귀직선)">{fmtNum(st.sse as number, 3)}</Readout>
          </div>
        </>
      ) : (
        <Note>{st.problem === "vertical" ? "점들의 x가 모두 같아서 기울기를 정할 수 없어요." : "점을 2개 이상 찍어 봐요."}</Note>
      )}
      {mine ? (
        <div className="wg-card">
          <h4 className="wg-h">내 직선 y = ax + b</h4>
          <Row>
            <Stepper label="기울기 a" value={ma} min={-3} max={3} step={0.05} slider onChange={setMa} />
            <Stepper label="절편 b" value={mb} min={-5} max={12} step={0.1} slider onChange={setMb} />
          </Row>
          <Readout label="오차제곱합(내 직선)" tone={mySse !== null && st.sse !== null && mySse <= st.sse * 1.1 + 0.05 ? "ok" : "plain"}>
            {mySse === null ? "—" : fmtNum(mySse, 3)}
          </Readout>
        </div>
      ) : null}
      {ok ? (
        <Row>
          <Stepper label="x 값으로 예측" value={px} min={0} max={20} step={0.5} onChange={setPx} />
          <Readout label="예측값">
            <Tex tex={`\\hat{y}=${fmtNum(predict(st.a as number, st.b as number, px), 3)}`} />
          </Readout>
        </Row>
      ) : null}
    </div>
  );
}
