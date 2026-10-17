// 데이터가 많아지면 평균은? 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export const TRUE_MEAN = 65; // 옛 BigData.logic 의 TRUE_MEAN 과 같아요(시험이 확인해요)

export interface BigDataState {
  n: number;
  biased: boolean;
  mean: number;
}

export const mission: MissionSet<BigDataState> = {
  def: "stable",
  judges: {
    /** 고르게 1000명 이상 모아 진짜 평균과 1.5점 안으로 */
    stable: (s) => !s.biased && s.n >= 1000 && Math.abs(s.mean - TRUE_MEAN) < 1.5,
    /** 한쪽에서만 1000명 이상 모아도 진짜 평균에서 멀다는 것 확인 */
    biasTrap: (s) => s.biased && s.n >= 1000 && Math.abs(s.mean - TRUE_MEAN) >= 5,
  },
};
