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
  | { type: "selfcheck"; items: string[] }
  | { type: "todaySentence"; text: string }
  | { type: "note"; prompt: string };

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
  review?: string;
}
