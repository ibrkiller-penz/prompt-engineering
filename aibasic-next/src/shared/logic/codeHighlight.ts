// 파이썬 코드 한 줄을 색칠할 조각으로 나눠요(순수 함수, DOM 없음).
// 조각을 이어 붙이면 원래 줄과 글자 하나까지 같아요. 완벽한 문법 분석기가 아니라 읽기 좋게 색만 입혀요.
export type CodeTokKind = "kw" | "str" | "com" | "num" | "fn" | "txt";
export interface CodeTok {
  k: CodeTokKind;
  v: string;
}

const KEYWORDS = new Set([
  "and", "as", "assert", "break", "class", "continue", "def", "del", "elif", "else", "except", "finally", "for", "from", "global", "if", "import", "in",
  "is", "lambda", "nonlocal", "not", "or", "pass", "raise", "return", "try", "while", "with", "yield", "True", "False", "None",
]);

const NUM = /^(?:0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*/;

/** 코드 한 줄 → 조각. 줄 끝까지 닫히지 않은 문자열은 줄 끝까지 문자열로 봐요 */
export function tokenizeLine(line: string): CodeTok[] {
  const out: CodeTok[] = [];
  const push = (k: CodeTokKind, v: string) => {
    if (!v) return;
    const last = out[out.length - 1];
    if (last && last.k === k && k === "txt") last.v += v;
    else out.push({ k, v });
  };
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (ch === "#") {
      push("com", line.slice(i));
      break;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === "\\" ? 2 : 1;
      j = Math.min(line.length, j + 1);
      push("str", line.slice(i, j));
      i = j;
      continue;
    }
    const rest = line.slice(i);
    const prev = i > 0 ? line[i - 1] : "";
    if (/[A-Za-z_]/.test(ch)) {
      const m = IDENT.exec(rest) as RegExpExecArray;
      const word = m[0];
      const after = line.slice(i + word.length).match(/^\s*\(/);
      if (KEYWORDS.has(word)) push("kw", word);
      else if (after && prev !== ".") push("fn", word);
      else push("txt", word);
      i += word.length;
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(line[i + 1] || ""))) {
      if (!/[A-Za-z0-9_]/.test(prev)) {
        const m = NUM.exec(rest);
        if (m) {
          push("num", m[0]);
          i += m[0].length;
          continue;
        }
      }
    }
    push("txt", ch);
    i++;
  }
  return out;
}

/** 코드 전체 → 줄마다 조각 목록(끝의 빈 줄은 버려요) */
export function tokenizeCode(code: string): CodeTok[][] {
  return code.replace(/\s+$/, "").split("\n").map(tokenizeLine);
}
