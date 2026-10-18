// 교사 화면 설정(글자 크기·테마·움직임·대비). 저장·html 반영은 공용 src/shared/prefs 가 맡고, 여기는 교사 화면용 이름만 붙여요.
// 칠판 도구띠(A±·테마)도 useTeacherPrefs 를 쓰면 준비 화면과 같은 값을 나눠 써요.
import type { ThemePref } from "../../shared/contracts.ts";
import { FS_LABELS, THEME_LABELS, stepFs, themeChoices, usePrefs, type PrefsX } from "../../shared/prefs/index.ts";

export { FS_LABELS, stepFs };

/** 교사가 고를 수 있는 테마(기기 따라 · 밝게 · 어둡게 · 칠판) */
export const THEME_OPTIONS: { value: ThemePref; label: string }[] = themeChoices("teacher").map((v) => ({ value: v, label: THEME_LABELS[v] }));

/** [설정, 일부 바꾸기] — 바꾸면 aibn:t1:prefs 에 저장하고 html 에 바로 반영돼요 */
export function useTeacherPrefs(): [PrefsX, (patch: Partial<PrefsX>) => void] {
  return usePrefs();
}
