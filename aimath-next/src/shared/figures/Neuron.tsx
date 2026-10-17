// u1-1 · 인공 뉴런: 입력 → 가중합 → 판정 → 출력. 공개 단계 4.
// 기호는 레슨 식과 같아요: z = w₁x₁ + w₂x₂, z ≥ θ 이면 y = 1, z < θ 이면 y = 0.
// 칠판·준비 화면은 가로(왼→오), 휴대폰은 세로(위→아래)로 그려요.
import type { CSSProperties } from "react";
import type { FigureProps } from "./types.ts";
import { ArrowDefs, C, FigureFrame, M, Part, Sub, fillStyle, strokeStyle, useReveal, useSvgId } from "./kit.tsx";
import { useUiSurface } from "../ui/surface.ts";
import { metaOf } from "./lookup.ts";

const META = metaOf("neuron");

const NODE: CSSProperties = { fill: C.surface, stroke: C.line, strokeWidth: 2.5 };
const SUM: CSSProperties = { fill: C.accentSoft, stroke: C.accent, strokeWidth: 3 };
const BOX: CSSProperties = { fill: C.surface, stroke: C.line, strokeWidth: 2.5 };
const OUT: CSSProperties = { fill: C.accent, stroke: C.accent, strokeWidth: 2.5 };

function Formula() {
  return (
    <>
      <M>z</M>
      <tspan> = </tspan>
      <Sub base="w" sub="1" />
      <Sub base="x" sub="1" />
      <tspan> + </tspan>
      <Sub base="w" sub="2" />
      <Sub base="x" sub="2" />
    </>
  );
}

function Judge() {
  return (
    <>
      <M>z</M>
      <tspan> ≥ </tspan>
      <M>θ</M>
      <tspan> ?</tspan>
    </>
  );
}

export default function Neuron(props: FigureProps) {
  const { shown } = useReveal(META, props);
  const vertical = useUiSurface(props.surface) === "phone";
  const arrow = useSvgId("nr-arrow");
  const ah = "url(#" + arrow + ")";
  const line = strokeStyle(C.ink2, 2.5);

  if (vertical) {
    // 세로: 입력(위) → 가중합 → 판정 → 출력(아래). 설명 글은 오른쪽에.
    return (
      <FigureFrame meta={META} props={props} viewBox="0 0 360 530" maxWidth={420}>
        <ArrowDefs id={arrow} color={C.ink2} />
        <Part on={shown(1)}>
          <circle cx={70} cy={60} r={28} style={NODE} />
          <text x={70} y={68} textAnchor="middle" fontSize={24} style={fillStyle(C.ink)}>
            <Sub base="x" sub="1" />
          </text>
          <circle cx={190} cy={60} r={28} style={NODE} />
          <text x={190} y={68} textAnchor="middle" fontSize={24} style={fillStyle(C.ink)}>
            <Sub base="x" sub="2" />
          </text>
          <text x={236} y={56} fontSize={20} fontWeight={700} style={fillStyle(C.ink)}>
            입력
          </text>
          <text x={236} y={80} fontSize={18} style={fillStyle(C.ink2)}>
            값을 받아요
          </text>
        </Part>
        <Part on={shown(2)}>
          <line x1={84} y1={85} x2={120} y2={168} style={line} markerEnd={ah} />
          <line x1={176} y1={85} x2={140} y2={168} style={line} markerEnd={ah} />
          <text x={92} y={136} textAnchor="end" fontSize={20} style={fillStyle(C.accentInk)}>
            <tspan fontSize={16}>×</tspan>
            <Sub base="w" sub="1" />
          </text>
          <text x={168} y={136} fontSize={20} style={fillStyle(C.accentInk)}>
            <tspan fontSize={16}>×</tspan>
            <Sub base="w" sub="2" />
          </text>
          <circle cx={130} cy={210} r={38} style={SUM} />
          <text x={130} y={206} textAnchor="middle" fontSize={26} style={fillStyle(C.ink)}>
            +
          </text>
          <text x={130} y={232} textAnchor="middle" fontSize={20} style={fillStyle(C.ink)}>
            <M>z</M>
          </text>
          <text x={186} y={198} fontSize={20} fontWeight={700} style={fillStyle(C.ink)}>
            가중합
          </text>
          <text x={186} y={226} fontSize={19} style={fillStyle(C.ink)}>
            <Formula />
          </text>
          <text x={186} y={252} fontSize={18} style={fillStyle(C.ink2)}>
            곱해서 모두 더해요
          </text>
        </Part>
        <Part on={shown(3)}>
          <line x1={130} y1={248} x2={130} y2={296} style={line} markerEnd={ah} />
          <rect x={72} y={300} width={116} height={60} rx={10} style={BOX} />
          <text x={130} y={338} textAnchor="middle" fontSize={22} style={fillStyle(C.ink)}>
            <Judge />
          </text>
          <text x={206} y={326} fontSize={20} fontWeight={700} style={fillStyle(C.ink)}>
            판정
          </text>
          <text x={206} y={352} fontSize={18} style={fillStyle(C.ink2)}>
            <M>θ</M>
            <tspan> 는 기준선</tspan>
          </text>
        </Part>
        <Part on={shown(4)}>
          <line x1={130} y1={360} x2={130} y2={414} style={line} markerEnd={ah} />
          <circle cx={130} cy={448} r={30} style={OUT} />
          <text x={130} y={457} textAnchor="middle" fontSize={24} style={fillStyle(C.onAccent)}>
            <M>y</M>
          </text>
          <text x={186} y={432} fontSize={20} fontWeight={700} style={fillStyle(C.ink)}>
            출력
          </text>
          <text x={186} y={458} fontSize={18} style={fillStyle(C.ok)}>
            예 → 1
          </text>
          <text x={186} y={484} fontSize={18} style={fillStyle(C.ink2)}>
            아니요 → 0
          </text>
        </Part>
      </FigureFrame>
    );
  }

  return (
    <FigureFrame meta={META} props={props} viewBox="0 0 500 290">
      <ArrowDefs id={arrow} color={C.ink2} />
      <Part on={shown(1)}>
        <text x={52} y={28} textAnchor="middle" fontSize={18} fontWeight={700} style={fillStyle(C.ink2)}>
          입력
        </text>
        <circle cx={52} cy={88} r={28} style={NODE} />
        <text x={52} y={96} textAnchor="middle" fontSize={24} style={fillStyle(C.ink)}>
          <Sub base="x" sub="1" />
        </text>
        <circle cx={52} cy={210} r={28} style={NODE} />
        <text x={52} y={218} textAnchor="middle" fontSize={24} style={fillStyle(C.ink)}>
          <Sub base="x" sub="2" />
        </text>
        <text x={52} y={266} textAnchor="middle" fontSize={15} style={fillStyle(C.ink2)}>
          값을 받아요
        </text>
      </Part>
      <Part on={shown(2)}>
        <text x={200} y={28} textAnchor="middle" fontSize={18} fontWeight={700} style={fillStyle(C.ink2)}>
          가중합
        </text>
        <line x1={80} y1={95} x2={158} y2={136} style={line} markerEnd={ah} />
        <line x1={80} y1={203} x2={158} y2={164} style={line} markerEnd={ah} />
        <text x={112} y={100} textAnchor="middle" fontSize={20} style={fillStyle(C.accentInk)}>
          <tspan fontSize={15}>×</tspan>
          <Sub base="w" sub="1" />
        </text>
        <text x={112} y={214} textAnchor="middle" fontSize={20} style={fillStyle(C.accentInk)}>
          <tspan fontSize={15}>×</tspan>
          <Sub base="w" sub="2" />
        </text>
        <circle cx={200} cy={150} r={38} style={SUM} />
        <text x={200} y={146} textAnchor="middle" fontSize={26} style={fillStyle(C.ink)}>
          +
        </text>
        <text x={200} y={172} textAnchor="middle" fontSize={20} style={fillStyle(C.ink)}>
          <M>z</M>
        </text>
        <text x={190} y={236} textAnchor="middle" fontSize={17} style={fillStyle(C.ink)}>
          <Formula />
        </text>
        <text x={190} y={266} textAnchor="middle" fontSize={15} style={fillStyle(C.ink2)}>
          곱해서 모두 더해요
        </text>
      </Part>
      <Part on={shown(3)}>
        <text x={330} y={28} textAnchor="middle" fontSize={18} fontWeight={700} style={fillStyle(C.ink2)}>
          판정
        </text>
        <line x1={238} y1={150} x2={276} y2={150} style={line} markerEnd={ah} />
        <rect x={280} y={118} width={100} height={64} rx={10} style={BOX} />
        <text x={330} y={158} textAnchor="middle" fontSize={22} style={fillStyle(C.ink)}>
          <Judge />
        </text>
        <text x={330} y={210} textAnchor="middle" fontSize={15} style={fillStyle(C.ink2)}>
          <M>θ</M>
          <tspan> 는 기준선(임곗값)</tspan>
        </text>
      </Part>
      <Part on={shown(4)}>
        <text x={448} y={28} textAnchor="middle" fontSize={18} fontWeight={700} style={fillStyle(C.ink2)}>
          출력
        </text>
        <line x1={380} y1={150} x2={414} y2={150} style={line} markerEnd={ah} />
        <circle cx={448} cy={150} r={30} style={OUT} />
        <text x={448} y={159} textAnchor="middle" fontSize={24} style={fillStyle(C.onAccent)}>
          <M>y</M>
        </text>
        <text x={448} y={100} textAnchor="middle" fontSize={15} style={fillStyle(C.ok)}>
          예 → 1
        </text>
        <text x={448} y={210} textAnchor="middle" fontSize={15} style={fillStyle(C.ink2)}>
          아니요 → 0
        </text>
      </Part>
    </FigureFrame>
  );
}
