// 코드 블록(t:"code"): 파이썬 코드를 고정폭 글자로 보여 줘요. 줄이 길면 휴대폰·준비 화면은 옆으로 밀어 보고, 칠판은 줄을 바꿔요.
// 키보드로도 옆으로 밀 수 있게 tabIndex=0 이에요. 색은 보조 수단이라 색 없이도 코드가 그대로 읽혀요.
import { useMemo } from "react";
import type { Surface } from "../contracts.ts";
import { tokenizeCode } from "../logic/codeHighlight.ts";
import { useOverflowX, useUiSurface } from "./surface.ts";
import "./ui.css";

export interface CodeBlockProps {
  code: string;
  lang?: string;
  surface?: Surface;
}

export function CodeBlock(props: CodeBlockProps) {
  const sf = useUiSurface(props.surface);
  const lines = useMemo(() => tokenizeCode(props.code), [props.code]);
  const [preRef, over] = useOverflowX<HTMLPreElement>([props.code, sf]);
  const name = props.lang === "python" || !props.lang ? "파이썬 코드" : "코드";
  return (
    <figure className={"ui-code is-" + sf} data-noswipe="">
      <figcaption className="ui-code-tag">
        {name}
        {over ? <span className="ui-code-hint" aria-hidden="true">옆으로 밀어요 →</span> : null}
      </figcaption>
      <pre ref={preRef} className={"scroll-x ui-code-pre" + (over ? " is-overflow" : "")} tabIndex={0} role="group" aria-label={name}>
        <code>
          {lines.map((toks, i) => (
            <span key={i} className="ui-code-line">
              {toks.length ? toks.map((t, k) => (t.k === "txt" ? t.v : <span key={k} className={"ui-code-" + t.k}>{t.v}</span>)) : " "}
              {i < lines.length - 1 ? "\n" : ""}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
