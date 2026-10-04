// 콘텐츠 JSON(content/prompt/**)의 형태. 교사가 JSON을 고칠 때 이 파일이 기준이 된다.

export type Level = "elementary" | "middle" | "high";

export interface Word {
  term: string;
  def: string;
  example?: string;
}

export interface Line {
  /** 말하는 사람. 없으면 이야기(서술) 문단 */
  speaker?: string;
  text: string;
}

export interface Table {
  headers: string[];
  rows: string[][];
}

export interface StoryScene {
  title?: string;
  lines: Line[];
  words?: Word[];
}

export type Block =
  | { type: "think"; questions: string[] }
  | { type: "story"; title: string; intro?: string; scenes: StoryScene[] }
  | {
      type: "explain";
      title: string;
      body?: string[];
      table?: Table;
      dialogue?: Line[];
      after?: string[];
      steps?: string[];
    }
  | { type: "words"; words: Word[] }
  | { type: "analogy"; title: string; body: string[]; icon?: string }
  | { type: "remember"; items: string[] }
  | { type: "promise"; title: string; items: { title: string; body: string }[]; note?: string }
  | {
      type: "activity";
      n: number | string;
      title: string;
      instruction?: string;
      situation?: string;
      component: string;
      props?: Record<string, unknown>;
    }
  | { type: "roleplay"; title: string; body?: string[]; steps?: string[]; minutes?: number }
  | { type: "selfcheck"; items: string[] }
  | { type: "todaySentence"; text: string }
  | { type: "note"; prompt: string };

/** 부록: 바로 쓰는 말/문장/요청문 카드 */
export interface CardsFile {
  level: Level;
  title: string;
  intro?: string;
  groups: { title: string; cards: { text: string; lesson?: number; when?: string }[] }[];
}

/** 부록: 낱말/개념 사전 */
export interface GlossaryFile {
  level: Level;
  title: string;
  words: { term: string; def: string; example?: string; lessons?: number[] }[];
}

/** 나의 AI 약속 / AI 사용 약속 / 나의 AI 협업 원칙 */
export interface PledgeFile {
  level: Level;
  title: string;
  intro?: string;
  items: { title: string; body?: string }[];
  source: string;
}

export interface Lesson {
  level: Level;
  lesson: number;
  title: string;
  subtitle?: string;
  source: string;
  minutes: number;
  goals: string[];
  blocks: Block[];
  /** 원문 대조 상태. "완료"가 아니면 화면에 검토 표시 */
  review?: string;
  /** 교사용 지도서 내용 (3단계 /teacher 화면, 예시 답 인쇄에 씀) */
  teacher?: TeacherNotes;
}

export interface TeacherNotes {
  goal?: string;
  prep?: string;
  flow?: { step: string; min: number; activity: string; note?: string }[];
  questions?: string[];
  /** 활동별 예시 답 — 교재 표기 그대로 ("활동 1: …") */
  answers?: string[];
  tip?: string;
  background?: string;
  extension?: string[];
  faq?: { q: string; a: string }[];
}

export interface LevelMeta {
  id: Level;
  name: string;
  short: string;
  subtitle: string;
  minutes: number;
  characters: string;
  lessons: { n: number; title: string }[];
}

export interface Rules {
  vague: { words: { word: string; tip: string }[] };
  elements: {
    elements: { id: string; label: string; hint: string; patterns: string[]; insert: string }[];
    bonus: { id: string; label: string; patterns: string[]; praise: string; tip: string }[];
  };
  privacy: { patterns: { label: string; regex: string }[]; message: string };
}

export type SentenceTag = "ok" | "wrong" | "extra" | "check";

export interface LabScenario {
  id: string;
  level: Level;
  title: string;
  summary: string;
  source: string;
  situation: string;
  hidden: string[];
  starter: string;
  /** 요소 수(0~4)에 따라 고를 응답 id. 앞에서부터 min 이상인 첫 항목 */
  pick: { min: number; response: string }[];
  responses: Record<
    string,
    {
      label: string;
      sentences: { text: string; tag: SentenceTag; why: string }[];
      restate: {
        text: string;
        parts: { text: string; correct: boolean; fix: string }[];
      };
    }
  >;
  corrected: string;
  correctionChecks: { label: string; patterns: string[] }[];
  /** 이 시나리오에서만 네 줄 요소로 볼 낱말 (예: 기준 ← "부산") */
  extraPatterns?: Partial<Record<"problem" | "criteria" | "boundary" | "done", string[]>>;
  /** "서윤이처럼 한 줄로 시작하기" 버튼 글자 */
  starterLabel?: string;
  /** 6. 검증 — 바로잡은 결과물에서 직접 확인할 사실 */
  verify?: { intro?: string; facts: { text: string; where: string }[] };
  /** 7. 판단권 — 추가 제안을 받을지 */
  extras?: { proposal: string; options: { id: string; label: string; effect: string }[] };
  /** 8. 선택 기록 다섯 줄 예시 */
  choiceExample?: Record<"chosen" | "why" | "dropped" | "unsure" | "revisit", string>;
  /** 9. 마무리 다섯 질문 예시 */
  closeExample?: Record<"problem" | "done" | "enough" | "gap" | "reopen", string>;
  review?: string;
}

/** 차시를 여는 이야기 — 수필 『다 된 줄 알았다』에서, 학교급별 문체 */
export interface StoryVersion {
  kicker: string;
  title: string;
  paragraphs: string[];
  closing: string;
}
export interface StoryFile {
  lesson: number;
  source: string;
  image: string;
  imageAlt: string;
  image2?: string;
  image2Alt?: string;
  /** 두 번째 그림을 몇 번째 문단 뒤에 둘지 (0부터) */
  image2After?: number;
  imagePrompt?: string;
  levels: Record<Level, StoryVersion>;
}

/** 교사용 지도서 앞부분 (지도 원칙·평가 계획 등) */
export interface TeacherGuideFile {
  level: Level;
  title: string;
  sections: { title: string; body?: string[]; list?: string[]; table?: Table }[];
  source: string;
}
