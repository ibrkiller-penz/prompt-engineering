// 픽셀과 RGB 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export type Rgb = [number, number, number];
export interface PixelsState {
  cells: Rgb[];
  gray: boolean;
}

const has = (s: PixelsState, f: (p: Rgb) => boolean) => s.cells.some(f);

export const mission: MissionSet<PixelsState> = {
  def: "yellow",
  judges: {
    /** 노란색(255, 255, 0) 칸 만들기 */
    yellow: (s) => !s.gray && has(s, (p) => p[0] === 255 && p[1] === 255 && p[2] === 0),
    /** 검은 칸(0, 0, 0) 만들기 */
    black: (s) => has(s, (p) => p[0] === 0 && p[1] === 0 && p[2] === 0),
    /** 흑백으로 바꿔 보기 */
    gray: (s) => s.gray,
  },
};
