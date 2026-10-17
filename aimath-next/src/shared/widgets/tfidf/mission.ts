// TF-IDF 미션(순수)
import type { MissionSet } from "../mission.types.ts";

export interface TfidfState {
  N: number; // 문서 수
  word: string; // 고른 단어
  df: number; // 고른 단어가 든 문서 수
  topInAll: boolean; // 고른 단어가 어떤 문서에서든 점수 1등인가
}

export const mission: MissionSet<TfidfState> = {
  def: "everywhere",
  judges: {
    /** 모든 문서에 들어 있어 idf 가 0 이 되는 단어 찾기 */
    everywhere: (s) => s.N > 0 && s.word !== "" && s.df === s.N,
    /** 어떤 문서에서 점수 1등인 단어 찾기 */
    top: (s) => s.word !== "" && s.topInAll,
  },
};
