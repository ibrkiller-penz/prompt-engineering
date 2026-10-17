// 교사 전용 표식. 학생 빌드(dist-s)에 이 문자열이 들어 있으면 scripts/check-leak.mjs 가 실패해요.
// 교사 코드의 뿌리(App)에서 꼭 부르고, 교사 전용 모듈은 이 파일을 import 해 두면 누출을 잡기 쉬워요.
export const TEACHER_MARK = "__AIMN_TEACHER_ONLY__";

/** html 에 표식을 남겨요(압축해도 문자열이 지워지지 않게 실제로 써요) */
export function markTeacher(): void {
  try {
    document.documentElement.setAttribute("data-build", TEACHER_MARK);
  } catch {
    /* 무시 */
  }
}
