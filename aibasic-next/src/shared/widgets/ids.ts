// 체험 도구 전체의 id 와 화면 이름(순수 데이터, DOM 없음).
// 순서는 src/content/types.ts 의 WidgetId 와 같아요.
import type { WidgetId } from "../contracts.ts";

export const WIDGET_IDS: readonly WidgetId[] = [
  "turing",
  "rulevslearn",
  "bigdata",
  "bow",
  "tfidf",
  "cosine",
  "sentiment",
  "pixels",
  "imgtransform",
  "knn",
  "bayes",
  "regression",
  "gradient",
  "truth",
  "flow",
  "vecops",
  "tangent",
];

/** 도구 이름(안내 데이터가 없을 때 쓰는 기본 제목) */
export const WIDGET_TITLES: Record<WidgetId, string> = {
  turing: "튜링 테스트 체험",
  rulevslearn: "규칙과 학습 비교하기",
  bigdata: "데이터가 많아지면 평균은?",
  bow: "단어 가방 만들기",
  tfidf: "TF-IDF 계산기",
  cosine: "문장 유사도(코사인)",
  sentiment: "감성 사전 점수 매기기",
  pixels: "픽셀과 RGB 행렬",
  imgtransform: "행렬로 이미지 바꾸기",
  knn: "가까운 이웃으로 분류하기(k-NN)",
  bayes: "베이즈 확률 업데이트",
  regression: "점을 찍으면 회귀직선",
  gradient: "경사하강법 따라가기",
  truth: "진리표 만들기",
  flow: "순서도 따라가기",
  vecops: "벡터 연산 놀이터",
  tangent: "평균변화율에서 접선으로",
};

export function isWidgetId(x: string): x is WidgetId {
  return (WIDGET_IDS as readonly string[]).indexOf(x) >= 0;
}
