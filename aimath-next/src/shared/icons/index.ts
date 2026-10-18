// 공용 아이콘 입구(학생·교사 모두). 칠판 도구 아이콘은 여기서 내보내지 않아요 — 교사 코드는 "@shared/icons/teacher.tsx" 를 따로 import 해요.
export { Icon, IconButton, IconButtonBase, SvgIcon, UnitIcon, mountCommonIcons } from "./Icon.tsx";
export type { IconButtonBaseProps, IconButtonLook, IconButtonProps, IconProps, IconSize, SvgIconProps } from "./Icon.tsx";
export { COMMON_ICONS, ICON_LABELS, UNIT_ICONS, iconId, unitIconName } from "./names.ts";
export type { CommonIconName, IconName, UnitIconName, UnitSlug } from "./names.ts";
