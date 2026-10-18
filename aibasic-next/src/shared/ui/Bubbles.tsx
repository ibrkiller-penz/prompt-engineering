// 대화(블록 t:"dialog") → 말풍선. 등장인물 이름·첫 글자·색은 data/characters.json 에서 가져와요.
// 색은 밝은/어두운 테마 두 벌을 CSS 변수로 넘기고, 어느 쪽을 쓸지는 CSS(html[data-theme])가 골라요.
import type { CSSProperties } from "react";
import type { Surface } from "../contracts.ts";
import CHARS from "../../../data/characters.json";
import { Rich } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

interface CharInfo {
  name: string;
  line?: string;
  initial?: string;
  shape?: "circle" | "square";
  color?: string;
  ink?: string;
  dark?: { color?: string; ink?: string };
}

const TABLE = CHARS as unknown as Record<string, CharInfo>;

export function characterOf(who: string): CharInfo {
  const c = TABLE[who];
  if (c) return c;
  return { name: who, initial: who ? who.charAt(0) : "?", shape: "circle", color: "#4b5563", ink: "#ffffff", dark: { color: "#cbd5e1", ink: "#0e1218" } };
}

export interface BubblesProps {
  lines: { who: string; text: string }[];
  surface?: Surface;
  /** 칠판 단계 공개: 앞에서부터 몇 줄을 보일지(없으면 모두) */
  shown?: number;
}

export function Avatar({ who }: { who: string }) {
  const c = characterOf(who);
  const style = {
    "--who-c": c.color || "#4b5563",
    "--who-ink": c.ink || "#ffffff",
    "--who-c-d": (c.dark && c.dark.color) || c.color || "#cbd5e1",
    "--who-ink-d": (c.dark && c.dark.ink) || "#0e1218",
  } as CSSProperties;
  return (
    <span className={"ui-avatar" + (c.shape === "square" ? " is-square" : "")} style={style} aria-hidden="true">
      {c.initial || c.name.charAt(0)}
    </span>
  );
}

export function Bubbles({ lines, surface, shown }: BubblesProps) {
  const sf = useUiSurface(surface);
  const n = typeof shown === "number" ? Math.max(0, Math.min(lines.length, shown)) : lines.length;
  return (
    <div className={"ui-bubbles is-" + sf} role="list" aria-label="대화">
      {lines.slice(0, n).map((l, i) => {
        const c = characterOf(l.who);
        return (
          <div key={i} className="ui-bubble-row" role="listitem">
            <Avatar who={l.who} />
            <div className="ui-bubble-col">
              <span className="speaker ui-speaker" title={c.line || undefined}>
                {c.name}
              </span>
              <div className="bubble ui-bubble">
                <Rich text={l.text} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
