// 수식 안에 그대로 들어온 한글 · 동그라미 글자(㉠, ①, 가 …)를 \text{…} 로 감싸요.
// KaTeX 는 수식 모드에서 이런 글자의 글꼴 크기 정보를 몰라서(unknownSymbol) 높이 · 간격이 어긋나요.
// 이미 \text{ } · \mathrm{ } 같은 글자 묶음 안에 있으면 건드리지 않아요. 원본 콘텐츠는 고치지 않고 그릴 때만 바꿔요.

const NEEDS_TEXT = /[ᄀ-ᇿ㄰-㆏㈀-㋿①-⓿가-힯]/;
const TEXT_CMDS = ["\\text", "\\textbf", "\\textrm", "\\textit", "\\mathrm", "\\mbox", "\\operatorname", "\\textsf", "\\texttt", "\\mathbf"];

/** 한글 · 동그라미 글자 묶음을 \text{} 로 감싼 TeX. 바꿀 것이 없으면 원래 문자열을 그대로 돌려줘요 */
export function wrapTextChars(tex: string): string {
  if (!NEEDS_TEXT.test(tex)) return tex;
  let out = "";
  let i = 0;
  // 글자 묶음 안이면 그 묶음이 시작된 중괄호 깊이, 아니면 -1
  let textDepth = -1;
  let depth = 0;
  let run = "";
  const flush = () => {
    if (run) {
      out += "\\text{" + run + "}";
      run = "";
    }
  };
  while (i < tex.length) {
    const ch = tex[i];
    if (ch === "\\") {
      flush();
      // 명령 이름 읽기
      let j = i + 1;
      while (j < tex.length && /[A-Za-z]/.test(tex[j])) j++;
      if (j === i + 1 && j < tex.length) j++; // \{ \$ 같은 한 글자 명령
      const cmd = tex.slice(i, j);
      out += cmd;
      i = j;
      if (textDepth < 0 && TEXT_CMDS.indexOf(cmd) >= 0) {
        // 뒤따르는 공백 건너뛰고 { 이면 글자 묶음 시작
        let k = i;
        while (k < tex.length && tex[k] === " ") k++;
        if (tex[k] === "{") {
          out += tex.slice(i, k + 1);
          i = k + 1;
          depth++;
          textDepth = depth;
        }
      }
      continue;
    }
    if (ch === "{") {
      flush();
      depth++;
      out += ch;
      i++;
      continue;
    }
    if (ch === "}") {
      flush();
      if (textDepth === depth) textDepth = -1;
      depth = Math.max(0, depth - 1);
      out += ch;
      i++;
      continue;
    }
    if (textDepth < 0 && NEEDS_TEXT.test(ch)) {
      run += ch;
      i++;
      continue;
    }
    flush();
    out += ch;
    i++;
  }
  flush();
  return out;
}
