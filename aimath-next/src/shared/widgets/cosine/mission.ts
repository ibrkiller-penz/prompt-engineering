// 문장 유사도(코사인) 미션(순수)
import type { MissionSet } from "../mission.types.ts";
import { near } from "../mission.types.ts";

export interface CosineState {
  mode: "text" | "vec";
  cos: number | null; // 영벡터가 있으면 null
}

export const mission: MissionSet<CosineState> = {
  def: "orthogonal",
  judges: {
    /** 벡터 모드에서 코사인 0(수직) 만들기 */
    orthogonal: (s) => s.mode === "vec" && s.cos !== null && near(s.cos, 0),
    /** 코사인 1(같은 방향) 만들기 */
    same: (s) => s.cos !== null && near(s.cos, 1),
    /** 벡터 모드에서 코사인 −1(반대 방향) 만들기 */
    opposite: (s) => s.mode === "vec" && s.cos !== null && near(s.cos, -1),
  },
};
