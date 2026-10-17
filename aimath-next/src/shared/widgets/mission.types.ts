// 미션 판정 함수의 공통 모양(순수, DOM 없음).
// data/widget-guides.json 의 mission.judge 에 적힌 이름으로 판정 함수를 골라요.

/** 도구의 지금 상태를 받아 미션을 해냈는지 */
export type Judge<S> = (s: S) => boolean;

export interface MissionSet<S> {
  /** judge 이름 → 판정 함수 */
  judges: Record<string, Judge<S>>;
  /** 안내 데이터에 judge 가 없을 때 쓰는 기본 이름 */
  def: string;
}

/** 이름으로 판정(모르는 이름이면 기본, 그것도 없으면 false). 판정 중 오류가 나면 false */
export function runJudge<S>(set: MissionSet<S>, name: string | undefined, state: S): boolean {
  const f = (name && set.judges[name]) || set.judges[set.def];
  if (!f) return false;
  try {
    return !!f(state);
  } catch {
    return false;
  }
}

export const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
