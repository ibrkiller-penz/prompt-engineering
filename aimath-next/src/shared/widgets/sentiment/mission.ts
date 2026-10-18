// 감성 사전 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface SentimentState {
  matches: number; // 사전에 걸린 낱말 수
  total: number; // 점수 합
  verdict: "긍정" | "부정" | "중립";
  trickySeen: boolean; // 헷갈리는 문장을 살펴봤나
}

export const mission: MissionSet<SentimentState> = {
  def: "neutral",
  judges: {
    /** 낱말이 걸렸는데도 '중립'이 나오게 만들기 */
    neutral: (s) => s.matches > 0 && s.verdict === "중립",
    /** 헷갈리는 문장(부정 표현) 살펴보기 */
    tricky: (s) => s.trickySeen,
  },
};
