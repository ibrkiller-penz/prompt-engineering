// 인공지능 기초 꼭지의 내용 형식. 내용 파일(content/aibasic/**)은 모두 이 형식을 따른다.
// aimath 의 src/aimath/types.ts 와 호환되고, 다음 차이가 있어요(docs/aibasic-next-계약.md).
//  - Block 에 code(파이썬 코드) 추가
//  - Lesson.prereq·aiStory·project 는 선택, goals(학습 목표) 추가
//  - Section.keypoints(한 줄 정리) 추가
//  - 수식(math 블록·$..$)은 쓰지 않아도 돼요. 인공지능 기초에는 체험 도구가 없어요(widget 블록 없음).

/** 글자 서식: **굵게**, 줄바꿈은 \n. 그 밖의 HTML 은 쓰지 않는다. */
export type Text = string;

/** 체험 도구 id. 인공지능 기초는 도구를 쓰지 않아서 도구 코드는 번들에 들어가지 않아요(widget 블록이 없으면 안 쓰여요) */
export type WidgetId =
  | "turing"
  | "rulevslearn"
  | "bigdata"
  | "bow"
  | "tfidf"
  | "cosine"
  | "sentiment"
  | "pixels"
  | "imgtransform"
  | "knn"
  | "bayes"
  | "regression"
  | "gradient"
  | "truth"
  | "flow"
  | "vecops"
  | "tangent";

export type Block =
  | { t: "p"; text: Text }
  | { t: "math"; tex: string | string[] }
  | { t: "term"; term: string; def: Text }
  | { t: "callout"; kind: "tip" | "warn" | "aha" | "try"; title?: string; text: Text }
  | { t: "table"; head: Text[]; rows: Text[][]; caption?: Text }
  | { t: "list"; items: Text[]; ordered?: boolean }
  | { t: "example"; title: Text; problem: Text; steps: Text[]; answer: Text }
  | { t: "dialog"; lines: { who: string; text: Text }[] }
  | { t: "code"; code: string; lang?: "python" }
  | { t: "widget"; id: WidgetId; caption?: Text };

export interface Section {
  heading: Text;
  blocks: Block[];
  /** 이 소제목의 한 줄 정리(변환 때 끝에 callout aha '한 줄 정리' 로도 들어가요) */
  keypoints?: Text[];
}

interface QBase {
  id: string; // 진도 저장 키. 한 번 정하면 바꾸지 않는다
  level: 1 | 2 | 3 | 4 | 5;
  group: Text; // 예: '계단 확인 1계단', '단원 마무리'
  prompt: Text;
  new?: Text;
}
export type Question =
  | (QBase & { type: "choice"; choices: Text[]; answer: number; hints: [Text, Text]; solution: Text })
  | (QBase & { type: "number"; answer: number; tolerance?: number; unit?: string; hints: [Text, Text]; solution: Text })
  | (QBase & { type: "ox"; answer: boolean; hints: [Text, Text]; solution: Text })
  | (QBase & { type: "open"; model: Text; rubric: Text[]; hints?: [Text, Text] });

export interface Lesson {
  id: string; // 예: "u2_1_3"
  unit: number;
  order: number;
  title: string;
  subtitle: string;
  minutes: number;
  story: Text[]; // 이야기(등장인물 대화 포함)
  question: Text; // 오늘의 핵심 질문
  goals?: Text[]; // 학습 목표
  prereq?: { title: string; intro?: Text; items: { term: string; text: Text }[] };
  sections: Section[]; // 개념 정리(원본 계단 1개 = 소제목 1개)
  terms: { term: string; def: Text }[]; // 용어 카드
  aiStory?: { title: string; paragraphs: Text[] };
  practice: Question[]; // 계단 확인 문제 → 퀴즈
  project?: { title: string; goal: Text; materials?: Text[]; steps: Text[]; think: Text[] };
  summary: Text[];
}

/** 이야기 중간에 들어가는 작은 삽화. after 번째 문단 다음에, 가로폭 30% 이하로 글 옆에 떠 있다(public/ 아래 경로). */
export interface StoryImage {
  after: number;
  src: string;
  alt: string;
}

export interface UnitContent {
  id: number;
  why: { title: string; paragraphs: Text[] };
  opening: { title: string; paragraphs: Text[]; images?: StoryImage[] };
  stories?: { title: string; kicker?: string; paragraphs: Text[]; images?: StoryImage[] }[];
  test: Question[]; // 단원 마무리(종합 문제)
  future: { title: string; paragraphs: Text[] };
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
