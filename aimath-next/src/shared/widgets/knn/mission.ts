// k-NN 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface KnnState {
  k: number;
  winner: number; // 지금 k 로 고른 반
  winnerK1: number; // 같은 자리에서 k=1 일 때
  winnerK5: number; // 같은 자리에서 k=5 일 때
  x?: number; // 새 점 자리(판정에는 안 쓰고, 처음 조작을 알아채는 데 써요)
  y?: number;
}

export const mission: MissionSet<KnnState> = {
  def: "kFlip",
  judges: {
    /** k=1 과 k=5 의 답이 달라지는 자리 찾기 */
    kFlip: (s) => s.winnerK1 !== s.winnerK5,
  },
};
