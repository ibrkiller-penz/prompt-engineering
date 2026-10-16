import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo } from "react";

/** KaTeX 로 수식을 HTML 로 바꾼다. 잘못된 수식이어도 화면이 깨지지 않게 오류를 글자로 보인다. */
export function texHtml(tex: string, display = false): string {
  return katex.renderToString(tex, { throwOnError: false, strict: "ignore", displayMode: display, output: "html" });
}

const MATH = /(?<!\\)\$([^$]+)\$/g;
// 굵게 안에 수식이 들어 있어도 되게: **… $수식$ …**
const BOLD = /(\*\*(?:[^*$]|\$[^$]+\$)+\*\*)/g;

/** 글자 서식: **굵게**, $수식$, 줄바꿈(\n). 그 밖의 HTML 은 해석하지 않는다. */
export default function RichMath({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    let k = 0;
    const pushPlain = (s: string, bold: boolean) => {
      const sink: React.ReactNode[] = [];
      let last = 0;
      const pushText = (t: string) => {
        t.split("\n").forEach((line, li, arr) => {
          if (line) sink.push(<Fragment key={k++}>{line}</Fragment>);
          if (li < arr.length - 1) sink.push(<br key={k++} />);
        });
      };
      for (const m of s.matchAll(MATH)) {
        pushText(s.slice(last, m.index));
        // 긴 수식은 줄바꿈이 안 되므로 좁은 화면에서는 그 자리에서 옆으로 스크롤되게 한다
        sink.push(<span key={k++} className={m[1].length > 26 ? "katex-inline katex-long" : "katex-inline"} dangerouslySetInnerHTML={{ __html: texHtml(m[1]) }} />);
        last = (m.index ?? 0) + m[0].length;
      }
      pushText(s.slice(last));
      if (bold) out.push(<strong key={k++} className="font-bold text-ink">{sink}</strong>);
      else out.push(...sink);
    };
    text.split(BOLD).forEach((part) => {
      if (!part) return;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) pushPlain(part.slice(2, -2), true);
      else pushPlain(part, false);
    });
    return out;
  }, [text]);
  return <span className={className}>{nodes}</span>;
}

/** 별도 줄로 보이는 수식 한 줄 */
export function MathLine({ tex }: { tex: string }) {
  return <div className="my-1 overflow-x-auto py-1 text-center" dangerouslySetInnerHTML={{ __html: texHtml(tex, true) }} />;
}
