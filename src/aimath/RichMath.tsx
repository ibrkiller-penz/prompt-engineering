import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo } from "react";

/** KaTeX 로 수식을 HTML 로 바꾼다. 잘못된 수식이어도 화면이 깨지지 않게 오류를 글자로 보인다. */
export function texHtml(tex: string, display = false): string {
  return katex.renderToString(tex, { throwOnError: false, strict: "ignore", displayMode: display, output: "html" });
}

const MATH = /(?<!\\)\$([^$]+)\$/g;

/** 글자 서식: **굵게**, $수식$, 줄바꿈(\n). 그 밖의 HTML 은 해석하지 않는다. */
export default function RichMath({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    let last = 0;
    let k = 0;
    const pushText = (s: string) => {
      s.split("\n").forEach((line, li, arr) => {
        line.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
          if (part.startsWith("**") && part.endsWith("**") && part.length > 4) out.push(<strong key={k++} className="font-bold text-ink">{part.slice(2, -2)}</strong>);
          else if (part) out.push(<Fragment key={k++}>{part}</Fragment>);
        });
        if (li < arr.length - 1) out.push(<br key={k++} />);
      });
    };
    for (const m of text.matchAll(MATH)) {
      pushText(text.slice(last, m.index));
      out.push(<span key={k++} className="katex-inline" dangerouslySetInnerHTML={{ __html: texHtml(m[1]) }} />);
      last = (m.index ?? 0) + m[0].length;
    }
    pushText(text.slice(last));
    return out;
  }, [text]);
  return <span className={className}>{nodes}</span>;
}

/** 별도 줄로 보이는 수식 한 줄 */
export function MathLine({ tex }: { tex: string }) {
  return <div className="my-1 overflow-x-auto py-1 text-center" dangerouslySetInnerHTML={{ __html: texHtml(tex, true) }} />;
}
