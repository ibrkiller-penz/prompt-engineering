// 알림 상자(블록 t:"callout"). 색만이 아니라 아이콘과 이름표로도 종류를 알려요.
import type { Surface } from "../contracts.ts";
import { Icon, type IconName } from "../icons/index.ts";
import { Rich } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";

export type CalloutKind = "tip" | "warn" | "aha" | "try";

const META: Record<CalloutKind, { cls: string; name: string; icon: IconName }> = {
  tip: { cls: "info", name: "도움말", icon: "hint" },
  warn: { cls: "warn", name: "조심해요", icon: "flag" },
  aha: { cls: "aha", name: "아하!", icon: "badge" },
  try: { cls: "ok", name: "해 봐요", icon: "play" },
};

export interface CalloutProps {
  kind: CalloutKind;
  title?: string;
  text: string;
  surface?: Surface;
  chips?: string[];
}

export function Callout({ kind, title, text, surface, chips }: CalloutProps) {
  const sf = useUiSurface(surface);
  const m = META[kind] || META.tip;
  return (
    <aside className={"callout ui-callout " + m.cls + " is-" + sf} aria-label={m.name + (title ? ": " + title : "")}>
      <div className="callout-title ui-callout-title">
        <Icon name={m.icon} />
        <span className="ui-callout-kind">{m.name}</span>
        {title ? (
          <span className="ui-callout-name">
            <Rich text={title} />
          </span>
        ) : null}
      </div>
      <div className="ui-callout-body">
        <Rich text={text} chips={chips} />
      </div>
    </aside>
  );
}
