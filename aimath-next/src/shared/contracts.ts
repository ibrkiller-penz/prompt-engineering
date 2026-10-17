// 인공지능 수학 고도화판(aimath-next)의 공용 약속(타입·경로 표·저장 키 타입).
// 모든 담당이 이 파일을 기준으로 일해요. 바꿀 때는 개발1(팀장)과 먼저 맞춰요.
// 이 파일은 DOM 을 쓰지 않고, 값(export const)도 순수 데이터만 둬요(node --test 에서 그대로 불러올 수 있어요).

import type { Block, Question, Text, WidgetId } from "@legacy/types";

// 옛 콘텐츠 형식(원본 JSON 의 모양)은 그대로 다시 내보내요. 원본은 고치지 않아요.
export type { Block, Lesson, Question, Section, Text, UnitContent, UnitMeta, WidgetId } from "@legacy/types";

/* ─────────────────────────── 사이트 축 ─────────────────────────── */

export type SiteMode = "student" | "teacher";
/** 화면 표면: 휴대폰(학생) · 준비 화면(교사 책상) · 칠판 무대(1920×1080) */
export type Surface = "phone" | "prep" | "board";
export type Theme = "light" | "dark" | "chalk"; // chalk 는 교사만
export type ThemePref = "auto" | Theme;
export type FontStep = 0 | 1 | 2 | 3; // html[data-fs]
export type UnitSlug = "u1" | "u2" | "u3" | "u4" | "u5";

/** html 요소에 거는 속성(값은 모두 문자열) */
export interface HtmlAxes {
  "data-site": SiteMode;
  "data-surface": Surface;
  "data-theme": Theme;
  "data-fs": `${FontStep}`;
  "data-unit"?: UnitSlug;
  "data-contrast"?: "more";
}

/* ─────────────────────────── 콘텐츠 색인 ───────────────────────────
 * tools/content-index.mjs 가 빌드할 때 content/aimath 를 읽어 만들어요(virtual:content-index).
 * 레슨 본문은 들어 있지 않아요. 본문은 src/content/load.ts 로 화면에 들어갈 때 불러와요.
 */

export type QType = Question["type"];

export interface SectionIndex {
  heading: Text;
  blocks: number; // 블록 수
  widgets: WidgetId[]; // 이 소제목 안의 체험 도구(나온 순서, 중복 포함)
  examples: number; // example 블록 수
  terms: number; // term 블록 수
}

export interface LessonIndex {
  id: string; // "u1-3"
  unit: number; // 1..5
  n: number; // units.json 배열 순서로 매긴 단원 안 화면 번호(1부터)
  code: string; // 화면 번호 표기 "Ⅰ-5"
  title: string;
  short: string; // units.json 의 짧은 제목
  subtitle: string;
  minutes: number;
  file: string; // "u1/lesson-3.json" (content/aimath 기준)
  question: Text; // 오늘의 핵심 질문
  sections: SectionIndex[];
  prereq: number; // 먼저 알고 가요 항목 수(없으면 0)
  story: number; // 이야기 문단 수
  summary: number; // 정리 줄 수
  aiStory: string; // AI 이야기 제목
  project: string; // 프로젝트 제목
  qids: string[]; // 연습 문제 id(원본 순서)
  basicIds: string[]; // 기본 문제(group 에 '실력'·'도전'이 없는 것) — 완료 기준
  checkIds: string[]; // group 이 '개념 확인'으로 시작하는 문제
  byGroup: Record<string, number>; // group 의 첫 마디(' · ' 앞)별 문제 수
  byType: Partial<Record<QType, number>>;
  widgetIds: WidgetId[]; // 중복 없이
  terms: number; // 용어 카드 수
  prev: string | null; // 전체 화면 순서 기준 앞뒤 레슨
  next: string | null;
}

export interface UnitIndex {
  id: number;
  slug: UnitSlug;
  roman: string;
  title: string;
  short: string;
  icon: string;
  color: string;
  soft: string;
  file: string; // "u1/unit.json"
  lessonIds: string[]; // units.json 배열 순서
  testIds: string[]; // 단원 마무리 도전(학력진단 A·B회 뺀 것)
  diagIds: string[]; // 학력진단평가 A·B회
  stories: number;
}

export interface ContentIndex {
  v: 1;
  units: UnitIndex[]; // units.json 배열 순서
  lessons: Record<string, LessonIndex>;
  order: string[]; // 전체 레슨 화면 순서
  widgets: WidgetId[]; // 콘텐츠에 실제로 쓰인 체험 도구(중복 없이)
  totals: { lessons: number; practice: number; test: number; diag: number };
}

/** 사전 한 줄(virtual:content-terms, 사전 화면에서만 불러와요) */
export interface TermEntry {
  term: string;
  def: Text;
  lid: string; // 처음 나온 레슨
  unit: number;
  cho: string; // 초성 검색용(한글은 초성, 그 밖은 소문자 그대로)
}

/** 문제가 어디에 있는지 */
export type QWhere =
  | { kind: "practice"; lid: string; unit: number }
  | { kind: "test" | "diag"; lid: null; unit: number };

/* ─────────────────────────── 보조 데이터(aimath-next/data) ─────────────────────────── */

/** data/plan.json — scripts/gen-plan.mjs 가 초안을 만들고 사람이 다듬어요 */
export interface PlanPeriod {
  p: number; // 차시 번호(1부터)
  sections: number[]; // 이 차시에 다루는 소제목 번호(0부터)
  minutes: number;
  board?: string[]; // 없으면 레슨 전체 board 에서 이 차시 소제목에 해당하는 것
  exit?: string[];
  hw?: string[];
}
export interface PlanLesson {
  lid: string;
  sectionChecks: string[][]; // 소제목 i 끝 확인 문제 id(학생 카드·칠판 공용)
  corePath: string[]; // 학생 계단 문제 기본 길(1장 = 1문제)
  board: string[]; // 칠판 문제 후보 5~8개
  exit: string[]; // 수업 끝 확인
  hw: string[]; // 숙제
  periods: PlanPeriod[];
}
export interface Plan {
  v: 1;
  lessons: Record<string, PlanLesson>;
}

/** data/widget-guides.json */
export interface WidgetMission {
  text: Text;
  judge: string; // widgets/<id>/mission.ts 의 판정 함수 이름
}
export interface WidgetGuide {
  id: WidgetId;
  title: string;
  predict: Text; // 해 보기 전에 예상
  steps: [Text, Text, Text];
  ask: Text; // 알게 된 점 묻기
  reveal: Text; // 정리
  mission?: WidgetMission;
}
export type WidgetGuides = Partial<Record<WidgetId, WidgetGuide>>;

/** data/characters.json */
export interface Character {
  name: string;
  line: string; // 한 줄 소개
  color: string; // 배지 색(글자 대비 4.5 이상)
}
export type Characters = Record<string, Character>;

/** data/overrides/tone.json — 화면에 보일 때만 덧씌워요(원본은 그대로) */
export interface ToneRule {
  where: string; // 레슨 id "u2-1" 또는 단원 "u2"
  path?: string; // "sections.0.blocks.2.text" 처럼 점으로 이은 경로. 없으면 그 문서 전체
  from: string; // 정확히 이 문장이 들어 있을 때만
  to: string;
}
export interface ChipRule {
  where: string;
  path?: string;
  match: string; // 이 문장이 들어 있는 글자에
  label: string; // 붙일 칩 글자(예: "가상의 예")
}
export interface ToneFile {
  v: 1;
  replace?: ToneRule[];
  chips?: ChipRule[];
}

/** data/teacher/prep/uN.json — 교사 빌드에서만 import */
export interface PrepLesson {
  goal: Text;
  asks: [Text, Text, Text]; // 발문 3개
  stuck: Text[]; // 막히는 곳
  misconceptions: Text[];
  materials: Text[];
}
export interface PrepUnit {
  unit: number;
  lessons: Record<string, PrepLesson>;
}

/* ─────────────────────────── 칠판 장면 ─────────────────────────── */

export type SceneStage = "open" | "prereq" | "concept" | "tool" | "practice" | "wrap" | "end";
export type SceneKind =
  | "question" // 오늘의 핵심 질문
  | "story" // 이야기(기본 꺼짐)
  | "prereq" // 먼저 알고 가요
  | "concept" // 개념 블록 묶음
  | "example" // 예제(단독 장면)
  | "widget" // 체험 도구
  | "problem" // 칠판 문제 1개
  | "aiStory" // AI 이야기(기본 꺼짐)
  | "summary" // 정리
  | "qr"; // 수업 끝 QR

/** 장면 안에 놓이는 것: 원본 블록 + 장면 전용 조각 */
export type SceneBlock =
  | Block
  | { t: "heading"; text: Text } // 소제목
  | { t: "q"; id: string } // 문제(본문은 레슨에서 찾아요)
  | { t: "lines"; items: Text[] }; // 이야기·정리 문단 여러 줄

export interface Scene {
  id: string; // 레슨 안에서 유일·안정(예 "c2-1", "ex2-0", "q:u1-1-q06")
  stage: SceneStage;
  kind: SceneKind;
  title?: Text;
  blocks: SceneBlock[];
  reveal: number; // 단계 공개 횟수(0 이면 한 번에 다 보임). '다음'은 남은 공개부터 써요
  required: boolean; // true 면 끌 수 없어요
  on: boolean; // 기본 켜짐 여부
  estMin: number; // 예상 분
  section?: number; // 개념 장면이면 소제목 번호
  part?: { i: number; n: number }; // "이어서" 장면 나눔(1부터)
  fsDown?: 0 | 1; // 넘쳐서 글자를 한 단계 줄였으면 1
}

/* ─────────────────────────── 학생 기록 v2 ─────────────────────────── */

/** 문제 하나의 기록(aimn:s1:q 의 값) */
export interface QRec {
  first: boolean | null; // 첫 시도에 맞혔나(풀이를 먼저 봤으면 false, 아직이면 null)
  wrong: number; // 틀린 횟수
  hints: 0 | 1 | 2; // 연 힌트 단계(최대)
  sol: boolean; // 풀이를 봤나
  ok: boolean; // 맞힘으로 셈(풀이를 본 뒤 맞힌 것은 false)
  lastWrong: number | null; // 마지막으로 틀린 때(ms)
  t0: number; // 처음 시도(ms)
  t1: number; // 마지막 시도(ms)
  rv?: { step: 0 | 1 | 2 | 3; due: number }; // 오늘의 복습(1·3·7일) 단계와 다음 날짜(ms). step 3 = 졸업
}
export type QMap = Record<string, QRec>;

/** 카드 넘기기 위치 */
export type LessonStep = "story" | "prereq" | `c${number}` | "wrap";
export interface CardPos {
  step: LessonStep;
  card: number; // 1부터
  ts: number;
}

export interface Prefs {
  fs: FontStep;
  theme: ThemePref;
  motion: "auto" | "reduce";
  speak: boolean; // 읽어 주기(지원 안 하면 화면에서 숨김)
  contrast: boolean; // 대비 높이기
}
export const DEFAULT_PREFS: Prefs = { fs: 1, theme: "auto", motion: "auto", speak: false, contrast: false };

/** 학생 저장 값의 모양(키 → 값). 키 목록과 설명은 src/shared/storage/keys.ts */
export interface StudentData {
  q: QMap;
  read: Record<string, number[]>; // 레슨 → 읽음으로 센 소제목 번호
  pos: Record<string, CardPos>; // 레슨 → 마지막 카드 위치
  last: { path: string; title: string; ts: number } | null; // 이어서 공부하기
  prefs: Prefs;
  prereq: Record<string, Record<string, "know" | "unsure">>; // 레슨 → 용어 → 알아요/헷갈려요
  assigned: Record<string, { hw: string[]; ex: string[]; ts: number }>; // QR 로 받은 선생님 숙제(문제 id 만)
  tools: Partial<Record<WidgetId, { done: boolean; ts: number }>>; // 체험 미션 완료
}

/** 교사 저장 값의 모양. 학습 기록·판서·모둠 점수는 저장하지 않아요 */
export interface TeacherData {
  prefs: Prefs;
  last: { lid: string; p: number; s: number; ts: number } | null; // 이어서 하기
  duration: 45 | 50 | 70;
  flow: Record<string, { off: string[]; on: string[]; min: Record<string, number> }>; // "lid:p" → 장면 켜기/끄기·분
  pick: Record<string, { board: string[]; exit: string[]; hw: string[] }>; // "lid:p" → 문제 바구니 3개
  progress: Record<string, Record<string, "done" | "part">>; // 반 이름(예 "2-3") → 레슨 → 진도
  results: Record<string, { counts: number[]; ts: number }>; // "lid:qid" → 보기별 손든 수
}

export type StudentKey = keyof StudentData;
export type TeacherKey = keyof TeacherData;

/** 기록 파일(백업) */
export interface Backup {
  app: "aimath-next";
  site: SiteMode;
  v: 1;
  savedAt: string; // ISO 날짜
  data: Record<string, unknown>;
}

/* ─────────────────────────── 체험 도구 ─────────────────────────── */

export type WidgetEvent =
  | { type: "predict"; value: string }
  | { type: "interact"; what?: string }
  | { type: "mission"; ok: boolean }
  | { type: "learned"; value: string };

export interface WidgetProps {
  surface: Surface;
  mission?: WidgetMission;
  onEvent?: (e: WidgetEvent) => void;
}

/* ─────────────────────────── 경로 표(해시 라우터) ───────────────────────────
 * 모두 "#" 뒤의 경로예요. 패턴의 :이름 은 매개변수, ? 뒤 쿼리는 패턴에 넣지 않아요.
 * 쿼리에는 문제 id·차시·장면 번호 같은 값만 넣고 이름·반 같은 개인 정보는 넣지 않아요.
 */
export const STUDENT_ROUTES = {
  home: "/",
  unit: "/u/:n", // n = 단원 번호 1..5
  lesson: "/l/:lid", // ?hw=q06,q11&ex=q03 (교사 QR 이 들어오는 유일한 곳, 문제 id 만)
  card: "/l/:lid/s/:step/:card", // step = story|prereq|c1..cN|wrap, card = 1부터
  quiz: "/l/:lid/q",
  quizMore: "/l/:lid/q/more",
  note: "/note",
  review: "/review",
  dict: "/dict",
  me: "/me",
  privacy: "/privacy",
  answerCard: "/card",
} as const;

export const TEACHER_ROUTES = {
  today: "/",
  find: "/find",
  flow: "/flow/:lid", // ?p=1
  pick: "/pick/:lid", // ?p=1
  prep: "/prep/:lid",
  print: "/print/:lid", // ?set=board|exit|hw&key=1
  progress: "/progress",
  results: "/results",
  unitTest: "/unit/:n/test",
  privacy: "/privacy",
  board: "/board/:lid", // ?p=1&s=0
  boardQ: "/board/:lid/q/:qid",
  boardTool: "/board/:lid/tool/:wid",
  boardEnd: "/board/:lid/end",
} as const;

export type StudentRoute = keyof typeof STUDENT_ROUTES;
export type TeacherRoute = keyof typeof TEACHER_ROUTES;

/** 칠판 무대 크기(고정, scale 로 화면에 맞춰요) */
export const BOARD_W = 1920;
export const BOARD_H = 1080;
/** 장면 본문이 들어가야 하는 높이 */
export const BOARD_BODY_H = 896;

/** 수업 시간 선택지(분) */
export const DURATIONS = [45, 50, 70] as const;
