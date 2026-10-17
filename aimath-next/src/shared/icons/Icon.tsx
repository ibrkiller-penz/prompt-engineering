// 공용 아이콘 부품(학생·교사). 칠판 도구 아이콘은 ./teacher.tsx 에 따로 있어요(학생 화면은 그 파일을 import 하지 않아요).
//
//   <Icon name="next" />                         장식용(aria-hidden). 옆에 글자가 있을 때
//   <Icon name="ok" label="맞았어요" />           뜻이 있는 그림(role="img" + aria-label)
//   <UnitIcon unit={2} />                         단원 아이콘(Ⅱ)
//   <IconButton icon="prev" label="이전" onClick={…} />                  아이콘 + 글자(기본: 글자를 늘 보여요)
//   <IconButton icon="speak" label="읽어 주기" showLabel={false} />       아이콘만(예외. 이름표는 aria-label·title). 꼭 필요할 때만
//   <IconButton icon="hint" label="힌트" showLabel="stacked" />          아이콘 위, 글자 아래
//
// <use> 에 href 와 xlink:href 를 함께 달아요(구형 브라우저 대비). 크기·색은 visual.css 의 .ico-svg(--ico, currentColor).
import type { ButtonHTMLAttributes, ReactNode } from "react";
import spriteCommon from "./icons-common.svg?raw";
import { ICON_LABELS, iconId, unitIconName, type IconName } from "./names.ts";
import { mountSprite } from "./sprite.ts";

export type IconSize = "sm" | "md" | "lg" | "xl" | "em";

export interface SvgIconProps {
  /** 크기: sm 0.75배 · md 기본 · lg 1.5배 · xl 2.5배 · em 글자 크기 따라감 */
  size?: IconSize;
  /** 주면 뜻이 있는 그림(role="img")이 되고, 없으면 장식(aria-hidden)이에요 */
  label?: string;
  className?: string;
}

/** 스프라이트를 심지 않는 바탕 부품. 이름 검사는 감싸는 쪽(Icon·TIcon)이 해요 */
export function SvgIcon(props: SvgIconProps & { name: string }) {
  const { name, size, label, className } = props;
  let cls = "ico-svg";
  if (size && size !== "md") cls += " " + size;
  if (name.indexOf("unit-") === 0) cls += " is-unit";
  if (className) cls += " " + className;
  const href = "#" + iconId(name);
  if (label) {
    return (
      <svg className={cls} role="img" aria-label={label} focusable="false">
        <use href={href} xlinkHref={href} />
      </svg>
    );
  }
  return (
    <svg className={cls} aria-hidden="true" focusable="false">
      <use href={href} xlinkHref={href} />
    </svg>
  );
}

/** 공용 스프라이트를 문서에 넣어요(첫 아이콘을 그릴 때 저절로 불러요) */
export function mountCommonIcons(): void {
  mountSprite("aimn-icons-common", spriteCommon);
}

export interface IconProps extends SvgIconProps {
  name: IconName;
}

/** 공용 아이콘 */
export function Icon(props: IconProps) {
  mountCommonIcons();
  return <SvgIcon {...props} />;
}

/** 단원 아이콘. unit 은 1~5 또는 "u1"~"u5". badge 면 단원 옅은 바탕 칸(.unit-badge)에 담아요 */
export function UnitIcon(props: { unit: number | string; size?: IconSize; label?: string; badge?: boolean; className?: string }) {
  mountCommonIcons();
  const icon = <SvgIcon name={unitIconName(props.unit)} size={props.size} label={props.badge ? undefined : props.label} className={props.badge ? undefined : props.className} />;
  if (!props.badge) return icon;
  const cls = "unit-badge" + (props.className ? " " + props.className : "");
  if (props.label) {
    return (
      <span className={cls} role="img" aria-label={props.label}>
        {icon}
      </span>
    );
  }
  return (
    <span className={cls} aria-hidden="true">
      {icon}
    </span>
  );
}

export type IconButtonLook = "default" | "ghost" | "primary";

export interface IconButtonBaseProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> {
  /** 이름표(필수). 글자를 숨길 때도 화면 읽기·툴팁으로 쓰여요 */
  label: string;
  /** true(기본): 아이콘 옆에 글자 · "stacked": 아이콘 아래 글자 · false: 아이콘만(예외로만 써요 — 접근성 검수에서 아이콘만 있는 단추는 피해요) */
  showLabel?: boolean | "stacked";
  /** 켜짐/꺼짐 단추(펜·가림막 등)일 때 */
  pressed?: boolean;
  look?: IconButtonLook;
  /** 주 행동 크기(--tap-main) */
  main?: boolean;
  iconSize?: IconSize;
}

/** 아이콘 단추 바탕. 그림(iconEl)은 감싸는 쪽이 넣어요 */
export function IconButtonBase(props: IconButtonBaseProps & { iconEl: ReactNode }) {
  const { label, showLabel, pressed, look, main, iconEl, className, type, title, iconSize, ...rest } = props;
  void iconSize;
  let cls = "icon-btn";
  if (showLabel === "stacked") cls += " stacked";
  if (look && look !== "default") cls += " " + look;
  if (main) cls += " main";
  if (className) cls += " " + className;
  const hidden = showLabel === false;
  return (
    <button
      {...rest}
      type={type || "button"}
      className={cls}
      aria-label={hidden ? label : undefined}
      title={title !== undefined ? title : hidden ? label : undefined}
      aria-pressed={pressed === undefined ? undefined : pressed}
    >
      {iconEl}
      {hidden ? null : <span className="lbl">{label}</span>}
    </button>
  );
}

export interface IconButtonProps extends Omit<IconButtonBaseProps, "label"> {
  icon: IconName;
  /** 없으면 ICON_LABELS 의 기본 이름표를 써요 */
  label?: string;
}

/** 공용 아이콘 단추. 보이는 크기와 상관없이 터치 영역은 --tap 이상이에요 */
export function IconButton(props: IconButtonProps) {
  const { icon, label, iconSize, ...rest } = props;
  return <IconButtonBase {...rest} label={label || ICON_LABELS[icon]} iconEl={<Icon name={icon} size={iconSize} />} />;
}
