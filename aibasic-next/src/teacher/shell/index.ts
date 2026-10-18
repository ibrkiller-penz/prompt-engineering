// 교사 화면 틀 묶음. 다른 교사 화면(board·flow 등)은 여기서 설정·반·대체 화면을 가져다 써요.
export { TeacherShell, KlassChips, TABS } from "./Shell.tsx";
export { KlassProvider, useKlass, cleanKlassName, sortKlasses, KLASS_RE, type ProgressMap, type ProgressMark } from "./klass.tsx";
export { useTeacherPrefs, THEME_OPTIONS, FS_LABELS, stepFs } from "./prefs.ts";
export { RoutedPage, hasPage, PAGE_DIR, type TeacherPageProps } from "./pages.tsx";
export { Loading, Soon, NotFound } from "./Fallbacks.tsx";
export { useLessonPlan, computePlan, planOf, flowKey, cleanDuration, todayHref, boardHref, type Duration, type LessonPlanView } from "./plan.ts";
