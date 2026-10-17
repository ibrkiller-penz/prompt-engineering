// 인물 이니셜 배지. data/characters.json 의 첫 글자·모양·색(밝은/어두운 두 벌)을 써요.
// CSS 파일 없이 SVG 하나로 그려요. 테마는 html[data-theme] 를 지켜보다가 바뀌면 다시 칠해요.
//  - 이름을 함께 보이면(withName) 배지는 꾸밈(aria-hidden)이고 이름 글자가 읽혀요.
//  - 배지만 쓰면 role="img" + aria-label=이름이에요. 꾸밈으로만 쓸 때는 decorative.
import { useEffect, useState, type CSSProperties } from "react";
import type { Surface } from "../contracts.ts";
import CHARS from "../../../data/characters.json";
import { useUiSurface } from "../ui/surface.ts";

export interface Character {
  name: string;
  line?: string;
  initial?: string;
  shape?: "circle" | "square";
  color?: string;
  ink?: string;
  dark?: { color?: string; ink?: string };
}

const TABLE = CHARS as unknown as Record<string, Character>;

/** 이름으로 인물 찾기. 표에 없으면 회색 기본 배지 */
export function characterInfo(who: string): Character {
  const c = TABLE[who];
  if (c) return c;
  return { name: who, initial: who ? who.charAt(0) : "?", shape: "circle", color: "#4b5563", ink: "#ffffff", dark: { color: "#cbd5e1", ink: "#0e1218" } };
}

/** 등록된 인물 이름(characters.json 순서) */
export const CHARACTER_NAMES: string[] = Object.keys(TABLE);

type Tone = "light" | "dark";

function readTone(): Tone {
  try {
    const t = document.documentElement.getAttribute("data-theme");
    return t === "dark" || t === "chalk" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** html[data-theme] 가 어두운 쪽(dark·chalk)인지 지켜봐요 */
export function useDarkTone(): Tone {
  const [tone, setTone] = useState<Tone>(readTone);
  useEffect(() => {
    let mo: MutationObserver | null = null;
    try {
      mo = new MutationObserver(() => setTone(readTone()));
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    } catch {
      mo = null;
    }
    setTone(readTone());
    return () => {
      if (mo) mo.disconnect();
    };
  }, []);
  return tone;
}

const SIZE: Record<Surface, number> = { phone: 32, prep: 40, board: 56 };

export interface BadgeProps {
  /** 인물 이름(characters.json 의 키, 예: "서하", "유 선생님") */
  who: string;
  /** 지름(px). 없으면 표면마다 32 / 40 / 56 */
  size?: number;
  surface?: Surface;
  /** 배지 옆에 이름 글자를 함께 보여요 */
  withName?: boolean;
  /** 마우스를 올리면 한 줄 소개(title) */
  showLine?: boolean;
  /** 꾸밈으로만(스크린 리더가 읽지 않아요) */
  decorative?: boolean;
  className?: string;
}

export default function Badge(props: BadgeProps) {
  const sf = useUiSurface(props.surface);
  const tone = useDarkTone();
  const c = characterInfo(props.who);
  const d = props.size || SIZE[sf];
  const bg = tone === "dark" ? (c.dark && c.dark.color) || c.color || "#cbd5e1" : c.color || "#4b5563";
  const ink = tone === "dark" ? (c.dark && c.dark.ink) || "#0e1218" : c.ink || "#ffffff";
  const initial = c.initial || c.name.charAt(0) || "?";
  const hidden = props.decorative || props.withName;
  const svg = (
    <svg
      width={d}
      height={d}
      viewBox="0 0 40 40"
      focusable="false"
      role={hidden ? undefined : "img"}
      aria-label={hidden ? undefined : c.name}
      aria-hidden={hidden ? true : undefined}
      style={{ display: "inline-block", verticalAlign: "middle", flex: "none" }}
    >
      {hidden ? null : <title>{c.line ? c.name + " — " + c.line : c.name}</title>}
      {c.shape === "square" ? (
        <rect x={1.5} y={1.5} width={37} height={37} rx={9} style={{ fill: bg }} />
      ) : (
        <circle cx={20} cy={20} r={18.5} style={{ fill: bg }} />
      )}
      <text x={20} y={27} textAnchor="middle" fontSize={initial.length > 1 ? 15 : 20} fontWeight={700} style={{ fill: ink }}>
        {initial}
      </text>
    </svg>
  );
  const title = props.showLine && c.line ? c.name + " — " + c.line : undefined;
  if (!props.withName) {
    return title ? (
      <span className={"fig-badge" + (props.className ? " " + props.className : "")} title={title} style={{ display: "inline-block", lineHeight: 0 }}>
        {svg}
      </span>
    ) : (
      <span className={"fig-badge" + (props.className ? " " + props.className : "")} style={{ display: "inline-block", lineHeight: 0 }}>
        {svg}
      </span>
    );
  }
  const wrap: CSSProperties = { display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" };
  return (
    <span className={"fig-badge has-name" + (props.className ? " " + props.className : "")} style={wrap} title={title}>
      {svg}
      <span style={{ marginLeft: Math.round(d * 0.25), fontWeight: 700 }}>{c.name}</span>
    </span>
  );
}
