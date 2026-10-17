// 튜링 테스트 체험 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface TuringState {
  answered: number; // 고른 판 수
  total: number; // 전체 판 수
  score: number; // 기계를 맞힌 판 수
}

export const mission: MissionSet<TuringState> = {
  def: "finish",
  judges: {
    /** 모든 판을 끝까지 골라 봐요 */
    finish: (s) => s.total > 0 && s.answered >= s.total,
    /** 끝까지 하고 기계를 6판 이상 맞혀요 */
    score6: (s) => s.total > 0 && s.answered >= s.total && s.score >= 6,
  },
};
