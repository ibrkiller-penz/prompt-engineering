// 인공지능 수학 꼭지의 내용 형식. 내용 파일(content/aimath/**)은 모두 이 형식을 따른다. 자세한 규칙: docs/인공지능수학_콘텐츠형식.md

/** 글자 서식: **굵게**, $수식$(KaTeX), 줄바꿈은 \n. 그 밖의 HTML 은 쓰지 않는다. */
export type Text = string;

export type WidgetId =
  | "turing" // 튜링 테스트 체험
  | "rulevslearn" // 규칙 기반 vs 학습 기반
  | "bigdata" // 데이터가 많아지면 평균이 안정되는 실험
  | "bow" // 단어집합·원-핫·빈도 벡터 만들기
  | "tfidf" // TF-IDF 계산기
  | "cosine" // 문장 유사도(코사인) 계산기
  | "sentiment" // 감성 사전 점수 계산기
  | "pixels" // 픽셀과 RGB 행렬 편집기
  | "imgtransform" // 행렬로 이미지 변환(밝기·반전·대칭·회전·필터)
  | "knn" // 거리 기반 분류(k-NN)
  | "bayes" // 조건부확률·베이즈 업데이트
  | "regression" // 점을 찍으면 회귀직선
  | "gradient" // 경사하강법 시각화
  | "truth" // 진리표 만들기(논리 연산자 ∧ ∨ ⊕ ~)
  | "flow" // 순서도 따라가며 변수 값 표 채우기
  | "vecops" // 벡터의 성분·합·차·실수배·크기·거리
  | "tangent"; // 평균변화율에서 순간변화율(접선의 기울기)로

export type Block =
  | { t: "p"; text: Text }
  | { t: "math"; tex: string | string[] } // 별도 줄로 보이는 수식(KaTeX). 여러 줄이면 배열
  | { t: "term"; term: string; def: Text }
  | { t: "callout"; kind: "tip" | "warn" | "aha" | "try"; title?: string; text: Text }
  | { t: "table"; head: Text[]; rows: Text[][]; caption?: Text }
  | { t: "list"; items: Text[]; ordered?: boolean }
  | { t: "example"; title: Text; problem: Text; steps: Text[]; answer: Text }
  | { t: "dialog"; lines: { who: string; text: Text }[] }
  | { t: "widget"; id: WidgetId; caption?: Text };

export interface Section {
  heading: Text;
  blocks: Block[];
}

interface QBase {
  id: string; // 진도 저장 키. 한 번 정하면 바꾸지 않는다
  level: 1 | 2 | 3 | 4 | 5; // 1 개념 확인 ★ … 5 심화 ★★★★★
  group: Text; // 예: '개념 확인', '유형 2 · 단어집합 만들기', '실력 UP', '수능 맛보기'
  prompt: Text;
  new?: Text; // 바로 앞 문제보다 새로 더해진 한 가지(계단식 구성)
}
export type Question =
  | (QBase & { type: "choice"; choices: Text[]; answer: number; hints: [Text, Text]; solution: Text })
  | (QBase & { type: "number"; answer: number; tolerance?: number; unit?: string; hints: [Text, Text]; solution: Text })
  | (QBase & { type: "ox"; answer: boolean; hints: [Text, Text]; solution: Text })
  | (QBase & { type: "open"; model: Text; rubric: Text[]; hints?: [Text, Text] }); // 서술형: 모범 답안을 보고 스스로 채점

export interface Lesson {
  id: string; // 예: "u2-1"
  unit: number;
  order: number;
  title: string;
  subtitle: string;
  minutes: number;
  story: Text[]; // 이야기(등장인물 대화 포함)
  question: Text; // 오늘의 핵심 질문
  prereq?: { title: string; intro?: Text; items: { term: string; text: Text }[] }; // 먼저 알고 가요(이전 학년 수학 복습 카드)
  sections: Section[]; // 개념 정리
  terms: { term: string; def: Text }[]; // 용어 카드
  aiStory: { title: string; paragraphs: Text[] }; // AI 이야기(역사·활용 읽을거리)
  practice: Question[]; // 계단식 연습
  project: { title: string; goal: Text; materials?: Text[]; steps: Text[]; think: Text[] }; // AI 프로젝트(활동)
  summary: Text[];
}

export interface UnitContent {
  id: number;
  why: { title: string; paragraphs: Text[] }; // 왜 배울까
  opening: { title: string; paragraphs: Text[] }; // 대단원을 여는 이야기
  stories?: { title: string; kicker?: string; paragraphs: Text[] }[]; // 단원 시작 전에 읽는 이야기 시리즈(역사·사람·사건·현실 사례)
  test: Question[]; // 대단원 마무리(종합 문제)
  future: { title: string; paragraphs: Text[] }; // 수학! 미래를 꿈꾸다(진로·직업 이야기)
}

export interface UnitMeta {
  id: number;
  slug: string;
  roman: string;
  title: string;
  short: string;
  icon: string;
  color: string;
  soft: string;
  lessons: { id: string; title: string; short: string }[];
}
