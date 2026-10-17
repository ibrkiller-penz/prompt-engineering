// 아이콘 이름과 기본 이름표(순수 데이터, DOM 없음 — node --test 로 시험할 수 있어요).
// 그림은 icons-common.svg(학생·교사 공용 + 단원 아이콘)와 icons-teacher.svg(칠판 도구, 교사 전용)에 symbol 로 있어요.
// symbol id 는 "i-" + 이름이에요. 이름을 더하거나 바꿀 때는 svg 파일의 symbol 도 같이 바꿔요.

/** 공용 아이콘(학생 빌드에도 들어가요) */
export const COMMON_ICONS = [
  "prev", "next", "home", "book", "progress", "dict", "note", "hint", "solution",
  "eye", "eye-off", "ok", "bad", "o", "x", "check", "reset", "play", "speak", "text",
  "teacher", "flag", "lock", "widget", "story", "question",
  "plus", "minus", "search", "gear", "download", "upload", "review", "link", "badge",
] as const;

/** 칠판 도구 아이콘(교사 전용. 학생 화면에서는 import 하지 않아요) */
export const TEACHER_ICONS = [
  "timer", "pen", "marker", "eraser", "undo", "trash", "zoom", "curtain", "full",
  "step", "qr", "group", "dice", "print", "theme",
] as const;

/** 단원 아이콘(공용 스프라이트에 들어 있어요) */
export const UNIT_ICONS = ["unit-u1", "unit-u2", "unit-u3", "unit-u4", "unit-u5"] as const;

export type CommonIconName = (typeof COMMON_ICONS)[number];
export type TeacherIconName = (typeof TEACHER_ICONS)[number];
export type UnitIconName = (typeof UNIT_ICONS)[number];
/** 학생·공용 화면에서 쓸 수 있는 이름 */
export type IconName = CommonIconName | UnitIconName;
/** 교사 화면에서 쓸 수 있는 이름(전부) */
export type AnyIconName = IconName | TeacherIconName;

export type UnitSlug = "u1" | "u2" | "u3" | "u4" | "u5";

/** symbol id */
export const iconId = (name: string): string => "i-" + name;

/** 단원 번호(1~5) 또는 slug("u1")를 단원 아이콘 이름으로 */
export function unitIconName(unit: number | string): UnitIconName {
  const n = typeof unit === "number" ? unit : parseInt(String(unit).replace(/^u/, ""), 10);
  const k = n >= 1 && n <= 5 ? n : 1;
  return ("unit-u" + k) as UnitIconName;
}

/** 아이콘만 있는 단추에 쓰는 기본 이름표(해요체 화면 문구와 맞춘 짧은 명사) */
export const ICON_LABELS: Record<AnyIconName, string> = {
  prev: "이전",
  next: "다음",
  home: "홈",
  book: "단원",
  progress: "내 기록",
  dict: "사전",
  note: "오답노트",
  hint: "힌트",
  solution: "풀이",
  eye: "보이기",
  "eye-off": "가리기",
  ok: "맞았어요",
  bad: "아쉬워요",
  o: "O",
  x: "X",
  check: "확인",
  reset: "처음부터",
  play: "시작",
  speak: "읽어 주기",
  text: "글자 크기",
  teacher: "교사용",
  flag: "목표",
  lock: "잠김",
  widget: "체험 도구",
  story: "이야기",
  question: "문제",
  plus: "늘리기",
  minus: "줄이기",
  search: "찾기",
  gear: "설정",
  download: "기록 저장",
  upload: "기록 불러오기",
  review: "오늘의 복습",
  link: "새 창으로 열기",
  badge: "완료 배지",
  timer: "타이머",
  pen: "펜",
  marker: "형광펜",
  eraser: "지우개",
  undo: "되돌리기",
  trash: "모두 지우기",
  zoom: "확대",
  curtain: "가림막",
  full: "전체 화면",
  step: "다음 공개",
  qr: "QR 코드",
  group: "모둠",
  dice: "번호 뽑기",
  print: "인쇄",
  theme: "테마",
  "unit-u1": "Ⅰ 인공지능과 빅데이터",
  "unit-u2": "Ⅱ 텍스트 데이터 처리",
  "unit-u3": "Ⅲ 이미지 데이터 처리",
  "unit-u4": "Ⅳ 예측과 최적화",
  "unit-u5": "Ⅴ 인공지능과 수학 탐구",
};
