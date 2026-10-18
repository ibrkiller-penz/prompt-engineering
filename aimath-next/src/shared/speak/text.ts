// 읽어 주기용 글자 만들기(순수 함수, DOM 없음 — node --test 로 시험할 수 있어요).
// 콘텐츠 글자(**굵게**, $수식$)에서 서식을 빼고, 자주 쓰는 수식은 우리말로 바꿔 읽어요.
// 완벽한 수식 낭독기는 아니에요. 모르는 명령은 이름만 떼고 글자를 그대로 둬요.

const WORDS: Record<string, string> = {
  times: " 곱하기 ",
  cdot: " 곱하기 ",
  div: " 나누기 ",
  pm: " 플러스마이너스 ",
  le: " 이하 ",
  leq: " 이하 ",
  ge: " 이상 ",
  geq: " 이상 ",
  ne: " 같지 않음 ",
  neq: " 같지 않음 ",
  approx: " 약 ",
  pi: " 파이 ",
  theta: " 세타 ",
  alpha: " 알파 ",
  beta: " 베타 ",
  sigma: " 시그마 ",
  Sigma: " 시그마 ",
  sum: " 시그마 ",
  infty: " 무한대 ",
  to: " 에서 ",
  rightarrow: " 에서 ",
  Rightarrow: " 이면 ",
  land: " 그리고 ",
  wedge: " 그리고 ",
  lor: " 또는 ",
  vee: " 또는 ",
  oplus: " 배타적 또는 ",
  sim: " 부정 ",
  lnot: " 부정 ",
  neg: " 부정 ",
  in: " 의 원소 ",
  cap: " 교집합 ",
  cup: " 합집합 ",
  ldots: " 점점점 ",
  cdots: " 점점점 ",
  dots: " 점점점 ",
  quad: " ",
  qquad: " ",
  lim: " 극한 ",
  log: " 로그 ",
  vec: " 벡터 ",
  overrightarrow: " 벡터 ",
  hat: " 햇 ",
  bar: " 바 ",
};

/** 짝 맞는 { } 의 끝 위치 */
function closeOf(s: string, open: number): number {
  let d = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") d++;
    else if (s[i] === "}") {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}

function arg(s: string, i: number): { v: string; end: number } {
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    const e = closeOf(s, i);
    if (e < 0) return { v: s.slice(i + 1), end: s.length };
    return { v: s.slice(i + 1, e), end: e + 1 };
  }
  return { v: s[i] || "", end: i + 1 };
}

/** TeX 한 덩이를 읽을 말로 */
export function texToWords(tex: string): string {
  let s = String(tex || "");
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      const m = /^\\([A-Za-z]+)/.exec(s.slice(i));
      if (!m) {
        // \, \; \! \{ 같은 기호
        const nx = s[i + 1] || "";
        out += nx === "{" || nx === "}" || nx === "%" || nx === "$" ? nx : " ";
        i += 2;
        continue;
      }
      const name = m[1];
      i += m[0].length;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const a = arg(s, i);
        const b = arg(s, a.end);
        out += " " + texToWords(b.v) + " 분의 " + texToWords(a.v) + " ";
        i = b.end;
        continue;
      }
      if (name === "sqrt") {
        const a = arg(s, i);
        out += " 루트 " + texToWords(a.v) + " ";
        i = a.end;
        continue;
      }
      if (name === "text" || name === "mathrm" || name === "mathbf" || name === "textbf" || name === "operatorname" || name === "boldsymbol" || name === "mathit") {
        const a = arg(s, i);
        out += texToWords(a.v);
        i = a.end;
        continue;
      }
      if (name === "left" || name === "right" || name === "displaystyle" || name === "begin" || name === "end") {
        if (name === "begin" || name === "end") i = arg(s, i).end;
        continue;
      }
      out += WORDS[name] !== undefined ? WORDS[name] : " " + name + " ";
      continue;
    }
    if (ch === "^") {
      const a = arg(s, i + 1);
      const v = a.v.trim();
      out += v === "2" ? "의 제곱 " : v === "3" ? "의 세제곱 " : v === "T" ? " 전치 " : "의 " + texToWords(v) + "제곱 ";
      i = a.end;
      continue;
    }
    if (ch === "_") {
      const a = arg(s, i + 1);
      out += " " + texToWords(a.v) + " ";
      i = a.end;
      continue;
    }
    if (ch === "{" || ch === "}") {
      i++;
      continue;
    }
    if (ch === "&") {
      out += " ";
      i++;
      continue;
    }
    if (ch === "=") out += " 는 ";
    else if (ch === "+") out += " 더하기 ";
    else if (ch === "-") out += " 빼기 ";
    else if (ch === "<") out += " 보다 작다 ";
    else if (ch === ">") out += " 보다 크다 ";
    else if (ch === "|") out += " 절댓값 ";
    else out += ch;
    i++;
  }
  s = out.replace(/\s+/g, " ").trim();
  return s;
}

/** 콘텐츠 글자(**굵게**, $수식$, \n)를 읽을 글자로 */
export function speechText(text: string): string {
  const src = String(text == null ? "" : text).replace(/\\\$/g, "\u0000");
  let out = "";
  let i = 0;
  while (i < src.length) {
    const j = src.indexOf("$", i);
    if (j < 0) {
      out += src.slice(i);
      break;
    }
    const k = src.indexOf("$", j + 1);
    if (k < 0) {
      out += src.slice(i);
      break;
    }
    out += src.slice(i, j) + " " + texToWords(src.slice(j + 1, k)) + " ";
    i = k + 1;
  }
  return out
    .replace(/\u0000/g, "달러")
    .replace(/\*\*/g, "")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}
