// 콘텐츠 글자(**굵게**, `코드`, 줄바꿈) 그리기. 인공지능 기초에는 수식이 없어서 KaTeX 를 쓰지 않아요.
// 혹시 math 블록·Tex 가 들어와도 오류 없이 원문을 코드 모양으로 보여 줘요.
import { useMemo, type ReactNode } from "react";
import "./ui.css";
import { parseInline, type InlineToken } from "../logic/inlineMath.ts";

/** 원문 그대로 보여 주는 작은 칸(수식 대신) */
export function Tex({ tex, display }: { tex: string; display?: boolean }) {
  if (display) return <div className="ui-tex-d"><code className="ui-tex-raw">{tex}</code></div>;
  return <code className="ui-tex-raw">{tex}</code>;
}

function render(ts: InlineToken[], key: string): ReactNode[] {
  return ts.map((t, i) => {
    const k = key + i;
    if (t.t === "text" || t.t === "math") return t.v;
    if (t.t === "code") return <code key={k} className="ui-icode">{t.v}</code>;
    if (t.t === "br") return <br key={k} />;
    return <strong key={k}>{render(t.c, k + ".")}</strong>;
  });
}

export interface RichProps {
  text: string | null | undefined;
  /** 글자 뒤에 붙일 칩(예: "가상의 예") */
  chips?: string[];
}

/** 콘텐츠 글자(**굵게**, `코드`, 줄바꿈 \n). 그 밖의 HTML 은 해석하지 않아요 */
export function Rich({ text, chips }: RichProps) {
  const nodes = useMemo(() => render(parseInline(text == null ? "" : String(text)), "r"), [text]);
  return (
    <>
      {nodes}
      {chips && chips.length
        ? chips.map((c) => (
            <span key={c} className="chip is-fiction ui-chip">
              {c}
            </span>
          ))
        : null}
    </>
  );
}
