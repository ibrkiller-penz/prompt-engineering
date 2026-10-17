// 행렬로 이미지 바꾸기 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface ImgTransformState {
  ops: string[]; // 적용한 연산 이름 차례
  same: boolean; // 지금 그림이 처음 그림과 같은가
}

export const mission: MissionSet<ImgTransformState> = {
  def: "backToStart",
  judges: {
    /** 연산을 2번 이상 했는데 처음 그림으로 되돌아오기 */
    backToStart: (s) => s.ops.length >= 2 && s.same,
    /** 윤곽선 필터 써 보기 */
    edge: (s) => s.ops.indexOf("edge") >= 0,
  },
};
