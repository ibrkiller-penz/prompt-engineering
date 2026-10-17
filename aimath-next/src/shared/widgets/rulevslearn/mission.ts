// 규칙 vs 학습 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface RuleVsLearnState {
  ruleAcc: number; // 0..1, 내가 만든 규칙의 정확도
  modelAcc: number; // 0..1, 학습한 모델의 정확도
  epoch: number; // 학습한 횟수
}

export const mission: MissionSet<RuleVsLearnState> = {
  def: "learnBeats",
  judges: {
    /** 규칙만으로 80% 넘기기 */
    rule80: (s) => s.ruleAcc >= 0.8,
    /** 한 번 이상 학습해서 규칙보다 정확하게 */
    learnBeats: (s) => s.epoch >= 1 && s.modelAcc > s.ruleAcc,
    /** 학습으로 90% 넘기기 */
    learn90: (s) => s.epoch >= 1 && s.modelAcc >= 0.9,
  },
};
