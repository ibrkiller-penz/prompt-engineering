import { useMemo } from "react";
import RichMath from "./RichMath";

// 긴 문단을 눈에 편한 덩어리로 나눠 보여 준다(내용은 바꾸지 않고 줄 나눔만 한다).
// - 따옴표 안의 말은 문장 중간에서 끊지 않는다. 수식($…$) 안에서도 끊지 않는다.
// - 대화(따옴표로 시작하는 문장)는 한 줄로 따로, 설명 문장은 한두 문장씩 묶는다.

const OPEN = "“‘「『";
const CLOSE = "”’」』";
const END = ".!?…";

export function sentences(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let depth = 0;
  let math = false;
  let bold = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "*" && text[i + 1] === "*") {
      bold = !bold; // **굵게** 도 문장 중간에서 끊지 않는다
      buf += "**";
      i++;
      continue;
    }
    buf += c;
    if (c === "$" && text[i - 1] !== "\\") math = !math;
    if (math || bold) continue;
    if (OPEN.includes(c)) depth++;
    else if (CLOSE.includes(c)) depth = Math.max(0, depth - 1);
    else if (c === '"') depth = depth ? depth - 1 : 1;
    if (depth === 0 && END.includes(c)) {
      const next = text[i + 1];
      const prev = text[i - 1] ?? "";
      const isDecimal = c === "." && /\d/.test(prev) && next !== undefined && /\d/.test(next);
      // 마침표 뒤에 공백이 오거나 글이 끝나면 한 문장
      if (!isDecimal && (next === undefined || /\s/.test(next))) {
        out.push(buf.trim());
        buf = "";
      }
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const isSpeech = (s: string) => OPEN.includes(s[0]) || s[0] === '"';

export function chunk(text: string, max = 100, maxSentences = 2): { text: string; speech: boolean }[] {
  const res: { text: string; speech: boolean }[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.length) res.push({ text: cur.join(" "), speech: false });
    cur = [];
  };
  for (const s of sentences(text)) {
    if (isSpeech(s)) {
      flush();
      res.push({ text: s, speech: true });
    } else {
      const len = cur.join(" ").length + s.length;
      if (cur.length >= maxSentences || (cur.length && len > max)) flush();
      cur.push(s);
    }
  }
  flush();
  return res;
}

/** 줄 나눔을 해 주는 본문. 한 문단(text)이 여러 덩어리로 보인다. */
export default function Prose({ text, story = false, essay = false, className = "" }: { text: string; story?: boolean; essay?: boolean; className?: string }) {
  const parts = useMemo(
    () =>
      text
        .split("\n")
        // 수필은 문단을 거의 그대로(아주 긴 문단만 둘로) 보여 주고, 이야기·설명은 더 잘게 나눈다
        .flatMap((line) => (line.trim() ? (essay ? chunk(line, 260, 5) : chunk(line, story ? 90 : 110)) : [])),
    [text, story, essay],
  );
  // 짧은 글은 그대로 한 덩어리
  if (parts.length <= 1) return <p className={`mt-4 ${className}`}><RichMath text={text} /></p>;
  return (
    <div className={`mt-4 space-y-2.5 ${className}`}>
      {parts.map((p, i) => (
        <p key={i} className={p.speech && story ? "border-l-[3px] border-accent/40 pl-3" : ""}>
          <RichMath text={p.text} />
        </p>
      ))}
    </div>
  );
}
