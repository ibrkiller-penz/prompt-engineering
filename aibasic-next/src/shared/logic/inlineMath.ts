// 콘텐츠 글자 서식 분해: **굵게**, 줄바꿈(\n). 그 밖의 HTML 은 해석하지 않아요.
//  - 인공지능 기초는 수식(KaTeX)을 쓰지 않아요. $ 는 늘 글자 '$' 예요(가격·변수 이름의 $ 가 수식으로 읽히지 않아요).
//  - 짝이 없는 ** 나 빈 굵게(****)는 글자 그대로 둬요.

export type InlineToken =
  | { t: "text"; v: string }
  | { t: "math"; v: string }
  | { t: "br" }
  | { t: "bold"; c: InlineToken[] };

type Piece = { t: "text"; v: string } | { t: "math"; v: string } | { t: "mark" };

/** 1단계: 글자 조각 만들기. 인공지능 기초에는 수식이 없어서 $ 는 늘 글자 그대로예요(KaTeX 를 쓰지 않아요) */
function splitMath(s: string): ({ t: "text"; v: string } | { t: "math"; v: string })[] {
  return s ? [{ t: "text", v: s }] : [];
}

function pushText(arr: InlineToken[], v: string) {
  if (!v) return;
  const lines = v.split("\n");
  lines.forEach((line, k) => {
    if (line) {
      const last = arr[arr.length - 1];
      if (last && last.t === "text") last.v += line;
      else arr.push({ t: "text", v: line });
    }
    if (k < lines.length - 1) arr.push({ t: "br" });
  });
}

function pushTok(arr: InlineToken[], tok: InlineToken) {
  if (tok.t === "text") pushText(arr, tok.v);
  else arr.push(tok);
}

export function parseInline(text: string): InlineToken[] {
  const src = text == null ? "" : String(text);
  // 2단계: 글자 조각 안의 ** 를 표시(mark)로
  const pieces: Piece[] = [];
  for (const p of splitMath(src)) {
    if (p.t === "math") {
      pieces.push(p);
      continue;
    }
    const parts = p.v.split("**");
    parts.forEach((part, k) => {
      if (part) pieces.push({ t: "text", v: part });
      if (k < parts.length - 1) pieces.push({ t: "mark" });
    });
  }
  // 3단계: 표시 짝 맞추기(첫째-둘째, 셋째-넷째 …)
  const marks: number[] = [];
  pieces.forEach((p, i) => {
    if (p.t === "mark") marks.push(i);
  });
  const pairOf: Record<number, number> = {};
  for (let k = 0; k + 1 < marks.length; k += 2) {
    const a = marks[k];
    const b = marks[k + 1];
    if (b === a + 1) continue; // 빈 굵게는 글자로
    pairOf[a] = b;
  }
  const out: InlineToken[] = [];
  let i = 0;
  while (i < pieces.length) {
    const p = pieces[i];
    if (p.t === "mark") {
      const end = pairOf[i];
      if (end !== undefined) {
        const c: InlineToken[] = [];
        for (let k = i + 1; k < end; k++) {
          const q = pieces[k];
          if (q.t === "mark") pushText(c, "**");
          else pushTok(c, q);
        }
        out.push({ t: "bold", c });
        i = end + 1;
        continue;
      }
      pushText(out, "**");
      i++;
      continue;
    }
    pushTok(out, p);
    i++;
  }
  return out;
}

/** 서식을 뺀 글자(읽어 주기·검색용). 수식은 TeX 원문을 그대로 둬요. */
export function inlineToPlain(tokens: InlineToken[]): string {
  let s = "";
  for (const t of tokens) {
    if (t.t === "text" || t.t === "math") s += t.v;
    else if (t.t === "br") s += "\n";
    else s += inlineToPlain(t.c);
  }
  return s;
}

export function plainText(text: string): string {
  return inlineToPlain(parseInline(text));
}
