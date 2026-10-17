// 평균변화율 → 접선 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface TangentState {
  h: number;
  avg: number; // 평균변화율
  slope: number; // 접선의 기울기
  showTan: boolean;
}

export const mission: MissionSet<TangentState> = {
  def: "close",
  judges: {
    /** h 를 0.01 까지 줄이고 접선을 켜서 두 기울기 비교하기 */
    close: (s) => s.h <= 0.01 && s.showTan,
    /** 평균변화율과 접선 기울기 차이를 0.1 보다 작게 */
    gap01: (s) => Math.abs(s.avg - s.slope) < 0.1,
  },
};
