// 벡터 연산 미션(순수)
import type { MissionSet } from "../mission.types.ts";
import { near } from "../mission.types.ts";

export interface VecOpsState {
  op: "add" | "sub" | "scale" | "norm" | "dist";
  vector: number[] | null;
  scalar: number | null;
}

export const mission: MissionSet<VecOpsState> = {
  def: "dist5",
  judges: {
    /** 두 벡터 사이 거리를 5로 */
    dist5: (s) => s.op === "dist" && s.scalar !== null && near(s.scalar, 5, 1e-6),
    /** 합이 영벡터가 되게 */
    sumZero: (s) => s.op === "add" && !!s.vector && s.vector.length > 0 && s.vector.every((v) => near(v, 0)),
    /** 크기가 5인 벡터 만들기 */
    norm5: (s) => s.op === "norm" && s.scalar !== null && near(s.scalar, 5, 1e-6),
  },
};
