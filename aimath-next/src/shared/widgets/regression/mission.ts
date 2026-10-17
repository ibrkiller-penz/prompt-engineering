// 회귀직선 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface RegressionState {
  n: number;
  mine: boolean; // 내 직선 켰나
  mySse: number | null;
  bestSse: number | null; // 최소제곱 직선의 오차제곱합
}

export const mission: MissionSet<RegressionState> = {
  def: "closeFit",
  judges: {
    /** 내 직선의 오차제곱합을 최소제곱 직선의 1.1배 안으로 */
    closeFit: (s) => s.mine && s.mySse !== null && s.bestSse !== null && s.n >= 2 && s.mySse <= s.bestSse * 1.1 + 0.05,
    /** 점을 5개 이상 찍기 */
    points5: (s) => s.n >= 5,
  },
};
