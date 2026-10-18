// u1-1 · 튜링 테스트 칸막이. 공개 단계 4: 심판 → 칸막이와 두 상대 → 글자로만 대화 → 누가 기계일까?
// 어느 쪽이 기계인지는 정하지 않아요(정답을 그림이 미리 알려 주지 않게).
import type { FigureProps } from "./types.ts";
import { ArrowDefs, C, FigureFrame, Part, fillStyle, strokeStyle, useReveal, useSvgId } from "./kit.tsx";
import { metaOf } from "./lookup.ts";
import { useUiSurface } from "../ui/surface.ts";

const META = metaOf("turing");

/** 단순한 사람 모양(머리 + 어깨) */
function Person({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y - 26 * s} r={17 * s} style={{ fill: color }} />
      <path
        d={`M${x - 30 * s},${y + 26 * s} C${x - 30 * s},${y - 6 * s} ${x + 30 * s},${y - 6 * s} ${x + 30 * s},${y + 26 * s} z`}
        style={{ fill: color }}
      />
    </g>
  );
}

/** 말풍선 속 '가나다' 글자 쪽지 */
function Note({ x, y, text, fs }: { x: number; y: number; text: string; fs: number }) {
  return (
    <g>
      <rect x={x - fs * 2.1} y={y - 17} width={fs * 4.2} height={30} rx={8} style={{ fill: C.infoBg, stroke: C.info, strokeWidth: 2 }} />
      <text x={x} y={y + 5} textAnchor="middle" fontSize={fs} style={fillStyle(C.info)}>
        {text}
      </text>
    </g>
  );
}

export default function Turing(props: FigureProps) {
  const { shown } = useReveal(META, props);
  // 휴대폰은 그림이 약 0.7배로 줄어서 작은 글자를 키워요(최소 약 13px)
  const phone = useUiSurface(props.surface) === "phone";
  const fsS = phone ? 19 : 15;
  const fsM = phone ? 20 : 16;
  const arrow = useSvgId("tu-arrow");
  const ah = "url(#" + arrow + ")";
  return (
    <FigureFrame meta={META} props={props} viewBox="0 0 480 310">
      <ArrowDefs id={arrow} color={C.info} />
      <Part on={shown(1)}>
        <Person x={70} y={170} color={C.accent} />
        <text x={70} y={230} textAnchor="middle" fontSize={20} fontWeight={700} style={fillStyle(C.ink)}>
          심판
        </text>
      </Part>
      <Part on={shown(2)}>
        {/* 칸막이: 빗금 대신 굵은 판 + 점선 무늬 */}
        <rect x={186} y={34} width={18} height={232} rx={4} style={{ fill: C.surface2, stroke: C.line, strokeWidth: 2.5 }} />
        <line x1={195} y1={46} x2={195} y2={254} style={strokeStyle(C.line, 2, { strokeDasharray: "6 8" })} />
        <text x={195} y={290} textAnchor="middle" fontSize={fsM} style={fillStyle(C.ink2)}>
          칸막이
        </text>
        {/* 상대 A, B: 안 보이는 방 */}
        <rect x={300} y={36} width={150} height={100} rx={12} style={{ fill: C.surface, stroke: C.line, strokeWidth: 2.5 }} />
        <rect x={300} y={166} width={150} height={100} rx={12} style={{ fill: C.surface, stroke: C.line, strokeWidth: 2.5 }} />
        <text x={330} y={96} textAnchor="middle" fontSize={30} fontWeight={700} style={fillStyle(C.ink)}>
          A
        </text>
        <text x={330} y={226} textAnchor="middle" fontSize={30} fontWeight={700} style={fillStyle(C.ink)}>
          B
        </text>
        <text x={400} y={80} textAnchor="middle" fontSize={fsS} style={fillStyle(C.ink2)}>
          사람일까?
        </text>
        <text x={400} y={102} textAnchor="middle" fontSize={fsS} style={fillStyle(C.ink2)}>
          기계일까?
        </text>
        <text x={400} y={210} textAnchor="middle" fontSize={fsS} style={fillStyle(C.ink2)}>
          사람일까?
        </text>
        <text x={400} y={232} textAnchor="middle" fontSize={fsS} style={fillStyle(C.ink2)}>
          기계일까?
        </text>
        {phone ? null : (
          <text x={375} y={292} textAnchor="middle" fontSize={fsS} style={fillStyle(C.ink2)}>
            한쪽은 사람, 한쪽은 기계
          </text>
        )}
      </Part>
      <Part on={shown(3)}>
        <line x1={108} y1={128} x2={294} y2={86} style={strokeStyle(C.info, 2.5)} markerEnd={ah} />
        <line x1={108} y1={160} x2={294} y2={216} style={strokeStyle(C.info, 2.5)} markerEnd={ah} />
        <Note x={144} y={92} text="가나다" fs={fsM} />
        <Note x={144} y={214} text="가나다" fs={fsM} />
        <text x={250} y={160} textAnchor="middle" fontSize={fsS} style={fillStyle(C.info)}>
          글자로만
        </text>
      </Part>
      <Part on={shown(4)}>
        <rect x={10} y={20} width={136} height={58} rx={14} style={{ fill: C.warnBg, stroke: C.warn, strokeWidth: 2 }} />
        <text x={78} y={45} textAnchor="middle" fontSize={fsM} fontWeight={700} style={fillStyle(C.warn)}>
          어느 쪽이
        </text>
        <text x={78} y={67} textAnchor="middle" fontSize={fsM} fontWeight={700} style={fillStyle(C.warn)}>
          기계일까?
        </text>
        <path d="M66,78 L72,96 L84,78 z" style={{ fill: C.warn }} />
      </Part>
    </FigureFrame>
  );
}
