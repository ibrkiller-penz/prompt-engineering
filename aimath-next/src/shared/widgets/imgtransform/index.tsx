// 행렬로 이미지 바꾸기: 6×6 흑백 그림(0~255 행렬)에 밝기·반전·대칭·회전·필터를 차례로 적용해요.
import { useState } from "react";
import type { WidgetProps } from "../../contracts.ts";
import {
  PRESETS,
  blur,
  brightness,
  contrast,
  edge,
  flipH,
  flipV,
  invert,
  matrixTex,
  rotateCCW,
  rotateCW,
  sharpen,
  transpose,
  cycleValue,
  type Img,
  type OpResult,
} from "@legacy/widgets/ImgTransform.logic";
import Stepper from "../Stepper.tsx";
import { Big, Note, Row, Seg, Split, Tex, useIsBoard } from "../kit.tsx";
import { mission } from "./mission.ts";
import { useMission } from "../useMission.ts";

type OpKey = "bright" | "contrast" | "invert" | "flipH" | "flipV" | "transpose" | "rotCW" | "rotCCW" | "blur" | "sharpen" | "edge";
const OPS: { key: OpKey; label: string }[] = [
  { key: "bright", label: "밝기 +k" },
  { key: "contrast", label: "대비 a배" },
  { key: "invert", label: "반전 255−x" },
  { key: "flipH", label: "좌우 대칭" },
  { key: "flipV", label: "상하 대칭" },
  { key: "transpose", label: "전치" },
  { key: "rotCW", label: "시계 90°" },
  { key: "rotCCW", label: "반시계 90°" },
  { key: "blur", label: "흐리게" },
  { key: "sharpen", label: "선명하게" },
  { key: "edge", label: "윤곽선" },
];
const same = (a: Img, b: Img) => a.length === b.length && a.every((r, i) => r.length === b[i].length && r.every((v, j) => v === b[i][j]));
const res = (img: Img): OpResult => ({ img, clipped: 0 });

function Pic({ img, label, onCell }: { img: Img; label: string; onCell?: (i: number, j: number) => void }) {
  const C = img.length ? img[0].length : 0;
  return (
    <div className={"wg-pixels wg-pic" + (onCell ? " is-edit" : " is-view")} style={{ gridTemplateColumns: `repeat(${C}, 1fr)` }} role="img" aria-label={label}>
      {img.map((row, i) =>
        row.map((v, j) =>
          onCell ? (
            <button key={i + ":" + j} type="button" className="wg-pixel" style={{ background: `rgb(${v},${v},${v})` }} aria-label={`${i + 1}행 ${j + 1}열 값 ${v}`} onClick={() => onCell(i, j)}>
              <span className="wg-pixel-pad" />
            </button>
          ) : (
            <span key={i + ":" + j} className="wg-pixel" style={{ background: `rgb(${v},${v},${v})` }}>
              <span className="wg-pixel-pad" />
            </span>
          ),
        ),
      )}
    </div>
  );
}

export default function ImgTransform(props: WidgetProps) {
  const board = useIsBoard();
  const [preset, setPreset] = useState("smiley");
  const [start, setStart] = useState<Img>(PRESETS.smiley.img);
  const [img, setImg] = useState<Img>(PRESETS.smiley.img);
  const [ops, setOps] = useState<string[]>([]);
  const [k, setK] = useState(60);
  const [a, setA] = useState(2);
  const [clipped, setClipped] = useState(0);
  const isSame = same(img, start);
  useMission(props, mission, { ops, same: isSame });

  const choose = (id: string) => {
    setPreset(id);
    setStart(PRESETS[id].img);
    setImg(PRESETS[id].img);
    setOps([]);
    setClipped(0);
  };
  const apply = (key: OpKey) => {
    const r: OpResult =
      key === "bright"
        ? brightness(img, k)
        : key === "contrast"
          ? contrast(img, a)
          : key === "invert"
            ? invert(img)
            : key === "flipH"
              ? res(flipH(img))
              : key === "flipV"
                ? res(flipV(img))
                : key === "transpose"
                  ? res(transpose(img))
                  : key === "rotCW"
                    ? res(rotateCW(img))
                    : key === "rotCCW"
                      ? res(rotateCCW(img))
                      : key === "blur"
                        ? blur(img)
                        : key === "sharpen"
                          ? sharpen(img)
                          : edge(img);
    setImg(r.img);
    setClipped(r.clipped);
    setOps(ops.concat([key]));
  };
  const editStart = (i: number, j: number) => {
    const next = start.map((r, x) => r.map((v, y) => (x === i && y === j ? cycleValue(v) : v)));
    setStart(next);
    setImg(next);
    setOps([]);
    setClipped(0);
  };
  const names = ops.map((o) => {
    const f = OPS.filter((x) => x.key === o)[0];
    return f ? f.label : o;
  });

  const seg = <Seg label="그림" value={preset} options={Object.keys(PRESETS).map((id) => ({ value: id, label: PRESETS[id].label }))} onChange={choose} />;
  const steppers = (
    <Row>
      <Stepper inline label="밝기 k" value={k} min={-120} max={120} step={10} onChange={setK} />
      <Stepper inline label="대비 a" value={a} min={0.5} max={3} step={0.5} onChange={setA} />
    </Row>
  );
  const startCard = (
    <div className="wg-card">
      <h4 className="wg-h">처음 그림</h4>
      <Pic img={start} label="처음 그림(칸을 누르면 밝기가 바뀌어요)" onCell={editStart} />
      <Note>칸을 누르면 0 → 64 → 128 → 192 → 255 차례로 바뀌어요.</Note>
    </div>
  );
  const nowCard = (
    <div className="wg-card">
      <h4 className="wg-h">바꾼 그림</h4>
      <Pic img={img} label="연산을 적용한 그림" />
      <p className="wg-line">{isSame ? "처음 그림과 같아요." : "처음 그림과 달라요."}</p>
    </div>
  );
  const opsBox = (
    <>
      <div className="wg-chips" role="group" aria-label="연산 적용하기">
        {OPS.map((o) => (
          <button key={o.key} type="button" className="wg-btn wg-chip-btn" onClick={() => apply(o.key)}>
            {o.label}
          </button>
        ))}
        <button
          type="button"
          className="wg-btn wg-chip-btn"
          onClick={() => {
            setImg(start);
            setOps([]);
            setClipped(0);
          }}
        >
          처음으로
        </button>
      </div>
      <p className="wg-line">적용한 차례: {names.length ? names.join(" → ") : "아직 없어요"}</p>
      <Big label="처음 그림과 비교" tone={isSame ? "ok" : "plain"} sub={`연산 ${ops.length}번 적용`}>
        {isSame ? "같아요" : "달라요"}
      </Big>
      {clipped > 0 ? <Note>0보다 작거나 255보다 큰 값 {clipped}칸은 0 또는 255로 잘랐어요.</Note> : null}
    </>
  );
  const mat = <Tex block tex={matrixTex(img)} />;

  // 칠판: 맨 위 = 그림 고르기·밝기 k·대비 a, 아래 = [처음 그림 | 바꾼 그림 + 행렬 | 연산 단추·비교]
  if (board) {
    return (
      <div className="wg-body wg-body-split">
        <div className="wg-topline">
          {seg}
          {steppers}
        </div>
        <Split
          a={startCard}
          b={
            <>
              {nowCard}
              {mat}
            </>
          }
          c={opsBox}
        />
      </div>
    );
  }
  return (
    <div className="wg-body">
      {seg}
      <div className="wg-two">
        {startCard}
        {nowCard}
      </div>
      {steppers}
      {opsBox}
      {mat}
    </div>
  );
}
