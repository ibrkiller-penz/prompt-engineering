// u1-1 · 3-4-2 인공신경망. 칠판·준비 화면은 가로(왼→오), 휴대폰은 세로(위→아래)로 그려요.
// 공개 단계 4: 입력층 → 은닉층 + 연결 12 → 출력층 + 연결 8 → 가중치 20 + 편향 6 = 26.
import type { FigureProps } from "./types.ts";
import { C, FigureFrame, Part, fillStyle, strokeStyle, useReveal } from "./kit.tsx";
import { useUiSurface } from "../ui/surface.ts";
import { metaOf } from "./lookup.ts";

const META = metaOf("net-342");

interface Pt {
  x: number;
  y: number;
}

/** 한 층의 노드 자리: 가운데 c 를 기준으로 간격 gap 만큼 n 개 */
export function layerPoints(n: number, c: number, gap: number): number[] {
  const out: number[] = [];
  const start = c - ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) out.push(start + i * gap);
  return out;
}

interface Layout {
  viewBox: string;
  inp: Pt[];
  hid: Pt[];
  out: Pt[];
  r: number;
  /** 층 이름 자리 */
  labels: { x: number; y: number; anchor: "middle" | "start"; t1: string; t2: string }[];
  /** 연결 수 자리 */
  counts: { x: number; y: number; anchor: "middle" | "start"; t: string }[];
  total: { x: number; y: number };
  maxWidth?: number;
}

function wide(): Layout {
  const X = [110, 320, 530];
  const inp = layerPoints(3, 200, 82).map((y) => ({ x: X[0], y }));
  const hid = layerPoints(4, 200, 82).map((y) => ({ x: X[1], y }));
  const out = layerPoints(2, 200, 82).map((y) => ({ x: X[2], y }));
  return {
    viewBox: "0 0 640 430",
    inp,
    hid,
    out,
    r: 25,
    labels: [
      { x: X[0], y: 372, anchor: "middle", t1: "입력층", t2: "노드 3개" },
      { x: X[1], y: 372, anchor: "middle", t1: "은닉층", t2: "노드 4개" },
      { x: X[2], y: 372, anchor: "middle", t1: "출력층", t2: "노드 2개" },
    ],
    counts: [
      { x: 215, y: 30, anchor: "middle", t: "연결 3×4 = 12개" },
      { x: 425, y: 30, anchor: "middle", t: "연결 4×2 = 8개" },
    ],
    total: { x: 320, y: 422 },
  };
}

function tall(): Layout {
  const Y = [86, 276, 466];
  const cx = 150;
  const inp = layerPoints(3, cx, 72).map((x) => ({ x, y: Y[0] }));
  const hid = layerPoints(4, cx, 72).map((x) => ({ x, y: Y[1] }));
  const out = layerPoints(2, cx, 72).map((x) => ({ x, y: Y[2] }));
  return {
    viewBox: "0 0 400 580",
    inp,
    hid,
    out,
    r: 22,
    labels: [
      { x: 296, y: Y[0] - 4, anchor: "start", t1: "입력층", t2: "노드 3개" },
      { x: 296, y: Y[1] - 4, anchor: "start", t1: "은닉층", t2: "노드 4개" },
      { x: 296, y: Y[2] - 4, anchor: "start", t1: "출력층", t2: "노드 2개" },
    ],
    counts: [
      { x: 296, y: (Y[0] + Y[1]) / 2 + 6, anchor: "start", t: "연결 12개" },
      { x: 296, y: (Y[1] + Y[2]) / 2 + 6, anchor: "start", t: "연결 8개" },
    ],
    total: { x: 200, y: 568 },
  };
}

function edges(a: Pt[], b: Pt[], r: number, vertical: boolean) {
  const out = [];
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      const p = a[i];
      const q = b[j];
      // 노드 테두리에서 시작·끝나게 살짝 줄여요
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = (dx / d) * r;
      const uy = (dy / d) * r;
      out.push(
        <line
          key={i + "-" + j + (vertical ? "v" : "h")}
          x1={p.x + ux}
          y1={p.y + uy}
          x2={q.x - ux}
          y2={q.y - uy}
          style={strokeStyle(C.ink2, 1.6, { strokeOpacity: 0.75 })}
        />,
      );
    }
  }
  return out;
}

function nodes(ps: Pt[], r: number, kind: "in" | "hid" | "out") {
  const st =
    kind === "hid"
      ? { fill: C.accentSoft, stroke: C.accent, strokeWidth: 3 }
      : kind === "out"
        ? { fill: C.accent, stroke: C.accent, strokeWidth: 3 }
        : { fill: C.surface, stroke: C.line, strokeWidth: 2.5 };
  return ps.map((p, i) => <circle key={kind + i} cx={p.x} cy={p.y} r={r} style={st} />);
}

/** 편향 표시: 노드 오른쪽 위 작은 'b' 딱지 */
function biasTags(ps: Pt[], r: number) {
  return ps.map((p, i) => (
    <g key={"b" + i}>
      <circle cx={p.x + r * 0.78} cy={p.y - r * 0.78} r={11} style={{ fill: C.warnBg, stroke: C.warn, strokeWidth: 2 }} />
      <text x={p.x + r * 0.78} y={p.y - r * 0.78 + 5} textAnchor="middle" fontSize={14} fontWeight={700} style={fillStyle(C.warn)}>
        b
      </text>
    </g>
  ));
}

export default function Network342(props: FigureProps) {
  const sf = useUiSurface(props.surface);
  const vertical = sf === "phone";
  const L = vertical ? tall() : wide();
  const { shown } = useReveal(META, props);
  const fs = vertical ? 17 : 18;
  return (
    <FigureFrame meta={META} props={props} viewBox={L.viewBox} maxWidth={vertical ? 420 : undefined}>
      <Part on={shown(1)}>
        {nodes(L.inp, L.r, "in")}
        <text x={L.labels[0].x} y={L.labels[0].y} textAnchor={L.labels[0].anchor} fontSize={fs + 2} fontWeight={700} style={fillStyle(C.ink)}>
          {L.labels[0].t1}
        </text>
        <text x={L.labels[0].x} y={L.labels[0].y + fs + 6} textAnchor={L.labels[0].anchor} fontSize={fs - 1} style={fillStyle(C.ink2)}>
          {L.labels[0].t2}
        </text>
      </Part>
      <Part on={shown(2)}>
        {edges(L.inp, L.hid, L.r, vertical)}
        {nodes(L.hid, L.r, "hid")}
        <text x={L.labels[1].x} y={L.labels[1].y} textAnchor={L.labels[1].anchor} fontSize={fs + 2} fontWeight={700} style={fillStyle(C.ink)}>
          {L.labels[1].t1}
        </text>
        <text x={L.labels[1].x} y={L.labels[1].y + fs + 6} textAnchor={L.labels[1].anchor} fontSize={fs - 1} style={fillStyle(C.ink2)}>
          {L.labels[1].t2}
        </text>
        <text x={L.counts[0].x} y={L.counts[0].y} textAnchor={L.counts[0].anchor} fontSize={fs} fontWeight={700} style={fillStyle(C.accentInk)}>
          {L.counts[0].t}
        </text>
      </Part>
      <Part on={shown(3)}>
        {edges(L.hid, L.out, L.r, vertical)}
        {nodes(L.out, L.r, "out")}
        <text x={L.labels[2].x} y={L.labels[2].y} textAnchor={L.labels[2].anchor} fontSize={fs + 2} fontWeight={700} style={fillStyle(C.ink)}>
          {L.labels[2].t1}
        </text>
        <text x={L.labels[2].x} y={L.labels[2].y + fs + 6} textAnchor={L.labels[2].anchor} fontSize={fs - 1} style={fillStyle(C.ink2)}>
          {L.labels[2].t2}
        </text>
        <text x={L.counts[1].x} y={L.counts[1].y} textAnchor={L.counts[1].anchor} fontSize={fs} fontWeight={700} style={fillStyle(C.accentInk)}>
          {L.counts[1].t}
        </text>
      </Part>
      <Part on={shown(4)}>
        {biasTags(L.hid, L.r)}
        {biasTags(L.out, L.r)}
        {vertical ? (
          <text x={L.total.x} y={L.total.y - 28} textAnchor="middle" fontSize={fs} fontWeight={700} style={fillStyle(C.ink)}>
            <tspan>가중치 12+8=20개 · </tspan>
            <tspan style={fillStyle(C.warn)}>편향(b) 4+2=6개</tspan>
            <tspan x={L.total.x} dy={fs + 9}>
              모두 26개
            </tspan>
          </text>
        ) : (
          <text x={L.total.x} y={L.total.y} textAnchor="middle" fontSize={fs} fontWeight={700} style={fillStyle(C.ink)}>
            <tspan>가중치 12+8=20개 · </tspan>
            <tspan style={fillStyle(C.warn)}>편향(b) 4+2=6개</tspan>
            <tspan> · 모두 26개</tspan>
          </text>
        )}
      </Part>
    </FigureFrame>
  );
}
