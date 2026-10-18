// u1-2 · XOR 네 점. 공개 단계 3: 네 점 → 직선 하나로 해 보기(실패) → 직선 두 개(A: OR, B: NAND) 사이에 1만 남아요.
// 출력 1 = 채운 동그라미, 출력 0 = 빈 네모(색만으로 구분하지 않아요).
// 두 직선은 0과 1 입력에서 레슨 표의 퍼셉트론 A·B 와 같은 결과를 내는 경계를 보기 좋게 떨어뜨려 그렸어요
// (A: x₁+x₂ ≥ 0.5 ⇔ 0/1 입력에서 OR, B: x₁+x₂ ≤ 1.5 ⇔ 0/1 입력에서 NAND). 식은 그림에 쓰지 않아요.
import type { FigureProps } from "./types.ts";
import { C, FigureFrame, Part, Sub, fillStyle, strokeStyle, useReveal } from "./kit.tsx";
import { metaOf } from "./lookup.ts";
import { useUiSurface } from "../ui/surface.ts";

const META = metaOf("xor-points");

const O = { x: 90, y: 250 }; // 원점 자리
const U = 170; // 1 칸 길이

export const px = (x: number) => O.x + x * U;
export const py = (y: number) => O.y - y * U;

/** XOR 표: (x1, x2) → 출력 */
export const XOR_POINTS: { x: number; y: number; out: 0 | 1 }[] = [
  { x: 0, y: 0, out: 0 },
  { x: 1, y: 0, out: 1 },
  { x: 0, y: 1, out: 1 },
  { x: 1, y: 1, out: 0 },
];

/** x+y=k 직선을 [-0.35, 1.35] 범위에서 */
function diag(k: number) {
  const a = -0.35;
  const b = 1.35;
  // 끝점이 범위 안에 들게 자르기
  const x1 = Math.max(a, k - b);
  const x2 = Math.min(b, k - a);
  return { x1: px(x1), y1: py(k - x1), x2: px(x2), y2: py(k - x2) };
}

function Marker({ x, y, out, fs }: { x: number; y: number; out: 0 | 1; fs: number }) {
  const cx = px(x);
  const cy = py(y);
  const label = "(" + x + ", " + y + ")";
  const lx = x === 0 ? cx - 18 : cx + 18;
  const anchor = x === 0 ? "end" : "start";
  return (
    <g>
      {out === 1 ? (
        <circle cx={cx} cy={cy} r={17} style={{ fill: C.accent, stroke: C.accent, strokeWidth: 2.5 }} />
      ) : (
        <rect x={cx - 15} y={cy - 15} width={30} height={30} rx={3} style={{ fill: C.surface, stroke: C.ink, strokeWidth: 3 }} />
      )}
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={17} fontWeight={700} style={fillStyle(out === 1 ? C.onAccent : C.ink)}>
        {out}
      </text>
      <text x={lx} y={cy + (y === 1 ? -20 : 34)} textAnchor={anchor} fontSize={fs} style={fillStyle(C.ink2)}>
        {label}
      </text>
    </g>
  );
}

export default function XorPoints(props: FigureProps) {
  const { shown } = useReveal(META, props);
  const phone = useUiSurface(props.surface) === "phone";
  const fsM = phone ? 20 : 16;
  const A = diag(0.5);
  const B = diag(1.5);
  // 두 직선 사이 띠(1 인 점만 들어가요)
  const band = [diag(0.5), diag(1.5)];
  const bandPath =
    "M" + band[0].x1 + "," + band[0].y1 + " L" + band[0].x2 + "," + band[0].y2 + " L" + band[1].x2 + "," + band[1].y2 + " L" + band[1].x1 + "," + band[1].y1 + " z";
  return (
    <FigureFrame meta={META} props={props} viewBox="0 0 470 330">
      {/* 축은 언제나 보여요(0 단계에서도 틀이 보이게) */}
      <line x1={px(-0.3)} y1={O.y} x2={px(1.4)} y2={O.y} style={strokeStyle(C.line, 2)} />
      <line x1={O.x} y1={py(-0.3)} x2={O.x} y2={py(1.35)} style={strokeStyle(C.line, 2)} />
      <text x={px(1.4) + 4} y={O.y + 6} fontSize={20} style={fillStyle(C.ink2)}>
        <Sub base="x" sub="1" />
      </text>
      <text x={O.x} y={py(1.35) - 10} textAnchor="middle" fontSize={20} style={fillStyle(C.ink2)}>
        <Sub base="x" sub="2" />
      </text>
      <Part on={shown(3)}>
        <path d={bandPath} style={{ fill: C.accent, fillOpacity: 0.12 }} />
        <line x1={A.x1} y1={A.y1} x2={A.x2} y2={A.y2} style={strokeStyle(C.ok, 3)} />
        <line x1={B.x1} y1={B.y1} x2={B.x2} y2={B.y2} style={strokeStyle(C.ok, 3)} />
        <text x={A.x2 + 6} y={A.y2 + 4} fontSize={fsM} fontWeight={700} style={fillStyle(C.ok)}>
          A (OR)
        </text>
        <text x={B.x2 + 6} y={B.y2 + 16} fontSize={fsM} fontWeight={700} style={fillStyle(C.ok)}>
          B (NAND)
        </text>
        <text x={px(1.32)} y={py(1.3)} textAnchor="end" fontSize={fsM} fontWeight={700} style={fillStyle(C.ok)}>
          ✓ 두 선 사이 = 출력 1
        </text>
      </Part>
      <Part on={shown(2) && !shown(3)}>
        <line x1={px(0.5)} y1={py(1.35)} x2={px(0.5)} y2={py(-0.3)} style={strokeStyle(C.bad, 3, { strokeDasharray: "10 7" })} />
        <text x={px(0.5) + 8} y={phone ? py(0.62) : py(1.25)} fontSize={fsM} fontWeight={700} style={fillStyle(C.bad)}>
          {phone ? (
            <>
              <tspan>✗ 직선 하나로는</tspan>
              <tspan x={px(0.5) + 8} dy={fsM + 6}>
                1과 0이 섞여요
              </tspan>
            </>
          ) : (
            "✗ 직선 하나: 양쪽에 1과 0이 섞여요"
          )}
        </text>
      </Part>
      <Part on={shown(1)}>
        {XOR_POINTS.map((p) => (
          <Marker key={p.x + "," + p.y} x={p.x} y={p.y} out={p.out} fs={fsM} />
        ))}
        <circle cx={378} cy={146} r={10} style={{ fill: C.accent }} />
        <text x={396} y={152} fontSize={fsM - 1} style={fillStyle(C.ink2)}>
          출력 1
        </text>
        <rect x={368} y={170} width={20} height={20} rx={2} style={{ fill: C.surface, stroke: C.ink, strokeWidth: 2.5 }} />
        <text x={396} y={186} fontSize={fsM - 1} style={fillStyle(C.ink2)}>
          출력 0
        </text>
      </Part>
    </FigureFrame>
  );
}
