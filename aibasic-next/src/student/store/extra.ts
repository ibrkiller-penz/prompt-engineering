// 학생 기록 가운데 공용 키 목록(src/shared/storage/keys.ts)에 아직 없는 키.
// 같은 접두사(aibn:s1:)에 저장하고, 기록 파일(백업)에도 함께 담아요. 순수 데이터(DOM 없음).
// 공용 목록에 이 키들이 들어가면(개발1) 여기 목록은 겹쳐도 괜찮아요(중복을 걸러요).
import type { KeyInfo } from "../../shared/storage/keys.ts";

/** 소제목 끝 카드를 지나간 기록(읽음 판정 전 단계): 레슨 → 소제목 번호 */
export type SeenMap = Record<string, number[]>;
/** '생각해 보기' 답(학생이 쓴 글): 레슨 → 항목 키("p0" 처럼) → 글 */
export type ThinkMap = Record<string, Record<string, string>>;
/** 스스로 돌아보기(레슨 끝): 1 아직 어려워요 · 2 조금 알겠어요 · 3 설명할 수 있어요 */
export type SelfLevel = 1 | 2 | 3;
export type SelfMap = Record<string, { level: SelfLevel; ts: number }>;
/** 프로젝트 활동: 레슨 → 해낸 단계 번호, 다 했는지 */
export type ProjMap = Record<string, { steps: number[]; done: boolean; ts: number }>;
/** 오늘 푼 복습 수(하루 최대 5문제를 지키려고) */
export interface RvDay {
  day: string;
  n: number;
}

export interface StudentExtra {
  seen: SeenMap;
  think: ThinkMap;
  self: SelfMap;
  proj: ProjMap;
  rvday: RvDay | null;
}
export type ExtraKey = keyof StudentExtra;

export const EXTRA_KEYS: Record<ExtraKey, KeyInfo> = {
  seen: { label: "지나간 소제목", desc: "개념 소제목의 마지막 카드까지 넘긴 곳을 저장해요(확인 문제를 풀면 '읽음'이 돼요).", backup: true },
  think: { label: "생각해 보기", desc: "'생각해 보기'에 직접 쓴 글을 저장해요. 이름이나 연락처는 쓰지 말아 주세요.", backup: true },
  self: { label: "스스로 돌아보기", desc: "레슨을 마치고 고른 '얼마나 알겠는지' 표시를 저장해요.", backup: true },
  proj: { label: "프로젝트 활동", desc: "프로젝트 활동에서 해낸 단계를 저장해요.", backup: true },
  rvday: { label: "오늘의 복습 수", desc: "오늘 푼 복습 문제 수를 저장해요(하루 5문제까지만 내려고).", backup: false },
};

export const extraKeyList = Object.keys(EXTRA_KEYS) as ExtraKey[];

/** '생각해 보기' 글 한 칸의 최대 길이 */
export const THINK_MAX = 1000;
