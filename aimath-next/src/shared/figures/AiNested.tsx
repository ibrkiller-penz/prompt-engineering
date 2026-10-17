// u1-1 · 인공지능 ⊃ 기계학습 ⊃ 딥러닝(안쪽으로 겹친 원). 공개 단계 3: 인공지능 → 기계학습 → 딥러닝.
import type { FigureProps } from "./types.ts";
import { C, FigureFrame, Part, fillStyle, useReveal } from "./kit.tsx";
import { metaOf } from "./lookup.ts";
import { useUiSurface } from "../ui/surface.ts";

const META = metaOf("ai-nested");

export default function AiNested(props: FigureProps) {
  const { shown } = useReveal(META, props);
  // 휴대폰은 그림이 작게 줄어서 작은 글자를 키워요
  const small = useUiSurface(props.surface) === "phone" ? 19 : 16;
  // 원 세 개가 아래쪽에서 거의 맞닿게 겹쳐요(포함 관계가 한눈에 보이게).
  return (
    <FigureFrame meta={META} props={props} viewBox="0 0 480 350">
      <Part on={shown(1)}>
        <circle cx={240} cy={178} r={162} style={{ fill: C.accent, fillOpacity: 0.08, stroke: C.accent, strokeWidth: 3 }} />
        <text x={240} y={52} textAnchor="middle" fontSize={24} fontWeight={700} style={fillStyle(C.accentInk)}>
          인공지능
        </text>
        <text x={240} y={80} textAnchor="middle" fontSize={small} style={fillStyle(C.ink2)}>
          가장 넓은 이름
        </text>
      </Part>
      <Part on={shown(2)}>
        <circle cx={240} cy={222} r={116} style={{ fill: C.accent, fillOpacity: 0.14, stroke: C.accent, strokeWidth: 3 }} />
        <text x={240} y={138} textAnchor="middle" fontSize={22} fontWeight={700} style={fillStyle(C.accentInk)}>
          기계학습
        </text>
        <text x={240} y={166} textAnchor="middle" fontSize={small} style={fillStyle(C.ink2)}>
          데이터로 규칙 찾기
        </text>
      </Part>
      <Part on={shown(3)}>
        <circle cx={240} cy={262} r={70} style={{ fill: C.accent, fillOpacity: 0.26, stroke: C.accent, strokeWidth: 3 }} />
        <text x={240} y={258} textAnchor="middle" fontSize={22} fontWeight={700} style={fillStyle(C.ink)}>
          딥러닝
        </text>
        <text x={240} y={284} textAnchor="middle" fontSize={small - 1} style={fillStyle(C.ink)}>
          여러 겹 신경망
        </text>
      </Part>
    </FigureFrame>
  );
}
