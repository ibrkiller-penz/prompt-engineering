// 칠판 도구 아이콘(교사 전용). src/teacher 에서만 import 해요 — 학생 화면·src/student·다른 shared 파일은 이 파일을 쓰지 않아요.
// 이 파일이 학생 빌드에 섞이면 스프라이트의 __AIMN_TEACHER_ONLY__ 표식 때문에 check-leak 가 실패해요.
//
//   <TIcon name="pen" />                                   칠판 도구 + 공용 아이콘 모두 쓸 수 있어요
//   <TIconButton icon="curtain" pressed={on} onClick={…} />  이름표를 안 주면 ICON_LABELS 기본값
import spriteTeacher from "./icons-teacher.svg?raw";
import { IconButtonBase, mountCommonIcons, SvgIcon, type IconButtonBaseProps, type SvgIconProps } from "./Icon.tsx";
import { ICON_LABELS, TEACHER_ICONS, type AnyIconName } from "./names.ts";
import { mountSprite } from "./sprite.ts";

const TEACHER_SET: Record<string, true> = {};
for (const n of TEACHER_ICONS) TEACHER_SET[n] = true;

/** 교사 스프라이트(공용 포함)를 문서에 넣어요 */
export function mountTeacherIcons(): void {
  mountCommonIcons();
  mountSprite("aimn-icons-teacher", spriteTeacher);
}

export interface TIconProps extends SvgIconProps {
  name: AnyIconName;
}

/** 교사 화면용 아이콘(공용 + 칠판 도구) */
export function TIcon(props: TIconProps) {
  if (TEACHER_SET[props.name]) mountTeacherIcons();
  else mountCommonIcons();
  return <SvgIcon {...props} />;
}

export interface TIconButtonProps extends Omit<IconButtonBaseProps, "label"> {
  icon: AnyIconName;
  label?: string;
}

/** 교사 화면용 아이콘 단추(칠판 도구띠 등). 칠판에서는 터치 영역이 64px 이상이에요 */
export function TIconButton(props: TIconButtonProps) {
  const { icon, label, iconSize, ...rest } = props;
  return <IconButtonBase {...rest} label={label || ICON_LABELS[icon]} iconEl={<TIcon name={icon} size={iconSize} />} />;
}

export { TEACHER_ICONS, type TeacherIconName, type AnyIconName } from "./names.ts";
