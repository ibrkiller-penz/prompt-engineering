// 단어 가방 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface BowState {
  vocab: number; // 단어집합 크기
  inter: number; // 두 문장에 함께 있는 단어 수
  union: number;
}

export const mission: MissionSet<BowState> = {
  def: "share2",
  judges: {
    /** 두 문장이 단어를 2개 이상 함께 쓰게 */
    share2: (s) => s.inter >= 2,
    /** 단어집합이 8개 이상 되게 */
    vocab8: (s) => s.vocab >= 8,
    /** 함께 쓰는 단어가 하나도 없게 */
    disjoint: (s) => s.union > 0 && s.inter === 0,
  },
};
