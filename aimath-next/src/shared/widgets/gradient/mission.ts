// 경사하강법 미션(순수). status 는 옛 Gradient.logic 의 classify 결과예요.
import type { MissionSet } from "../mission.types.ts";

export type GStatus = "start" | "converged" | "local" | "diverged" | "oscillating" | "moving";
export interface GradientState {
  status: GStatus;
  steps: number;
  eta: number;
}

export const mission: MissionSet<GradientState> = {
  def: "converge",
  judges: {
    /** 가장 낮은 곳에 도착 */
    converge: (s) => s.status === "converged",
    /** 10걸음 안에 도착 */
    fast: (s) => s.status === "converged" && s.steps <= 10,
    /** 학습률이 너무 커서 튀어 나가는 경우 보기 */
    diverge: (s) => s.status === "diverged",
    /** 작은 골짜기(극소)에 갇히는 경우 보기 */
    local: (s) => s.status === "local",
  },
};
