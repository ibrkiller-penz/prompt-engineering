// 베이즈 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface BayesState {
  prior: number; // 0..1
  hit: number; // P(B|A)
  fa: number; // P(B|not A)
  post: number | null; // P(A|B)
  chainLast: number; // B 가 여러 번 나온 뒤 확률
  repeats: number; // B 가 더 나온 횟수
}

export const mission: MissionSet<BayesState> = {
  def: "baseRate",
  judges: {
    /** 검사가 90% 이상 정확해도 P(A|B) 가 50% 아래인 경우 만들기 */
    baseRate: (s) => s.hit >= 0.9 && s.post !== null && s.post < 0.5,
    /** B 가 거듭 나와 확률이 90% 를 넘게 */
    update90: (s) => s.repeats >= 1 && s.chainLast >= 0.9,
  },
};
