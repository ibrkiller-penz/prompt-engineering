// 숫자 입력판의 √ · π 가 들어간 답을 값으로 바꿔요(순수 함수, DOM 없음 — node --test 로 시험할 수 있어요).
// 받아 주는 꼴: 2√3, √(2)/2, 3π, π/4, -√2, 2(√3+1), 1/√2, 2^3, 0.5×4
// √·π 가 없는 답은 여기서 다루지 않고 logic/answer.ts 의 checkAnswer 에 그대로 넘겨요(분수·단위·쉼표 처리는 거기서).

/** 입력에 √ 또는 π 가 들어 있는지 */
export function hasSymbol(s: string): boolean {
  return /[√π]|sqrt|pi/i.test(s);
}

type Tok = { k: "n"; v: number } | { k: "op"; v: string };

function lex(src: string): Tok[] | null {
  const s = src
    .normalize("NFKC")
    .replace(/[−‒–—―‐‑﹣]/g, "-")
    .replace(/[×·∙⋅*]/g, "*")
    .replace(/[÷∕⁄]/g, "/")
    .replace(/sqrt/gi, "√")
    .replace(/pi/gi, "π")
    .replace(/\s+/g, "");
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (m) {
      out.push({ k: "n", v: Number(m[1]) });
      i += m[1].length;
      continue;
    }
    if ("+-*/^()√π".indexOf(ch) >= 0) {
      out.push({ k: "op", v: ch });
      i++;
      continue;
    }
    return null; // 모르는 글자
  }
  return out;
}

/** √·π 가 들어간 식의 값. 읽을 수 없으면 null */
export function evalNumeric(src: string): number | null {
  const t = lex(String(src == null ? "" : src));
  if (!t || !t.length) return null;
  let i = 0;
  const peek = () => t[i];
  const isOp = (v: string) => {
    const x = t[i];
    return !!x && x.k === "op" && x.v === v;
  };
  const startsAtom = () => {
    const x = t[i];
    return !!x && (x.k === "n" || x.v === "(" || x.v === "√" || x.v === "π");
  };

  function atom(): number {
    const x = peek();
    if (!x) throw new Error("끝");
    if (x.k === "n") {
      i++;
      return x.v;
    }
    if (x.v === "π") {
      i++;
      return Math.PI;
    }
    if (x.v === "√") {
      i++;
      const a = power();
      if (a < 0) throw new Error("음수 제곱근");
      return Math.sqrt(a);
    }
    if (x.v === "(") {
      i++;
      const v = expr();
      if (!isOp(")")) throw new Error("괄호");
      i++;
      return v;
    }
    throw new Error("뜻밖의 기호");
  }
  function power(): number {
    const b = atom();
    if (isOp("^")) {
      i++;
      return Math.pow(b, unary());
    }
    return b;
  }
  function unary(): number {
    if (isOp("-")) {
      i++;
      return -unary();
    }
    if (isOp("+")) {
      i++;
      return unary();
    }
    return power();
  }
  function term(): number {
    let v = unary();
    for (;;) {
      if (isOp("*")) {
        i++;
        v *= unary();
      } else if (isOp("/")) {
        i++;
        const d = unary();
        if (d === 0) throw new Error("0으로 나눔");
        v /= d;
      } else if (startsAtom()) {
        v *= power(); // 2√3, 3π, 2(…)
      } else return v;
    }
  }
  function expr(): number {
    let v = term();
    for (;;) {
      if (isOp("+")) {
        i++;
        v += term();
      } else if (isOp("-")) {
        i++;
        v -= term();
      } else return v;
    }
  }
  try {
    const v = expr();
    if (i !== t.length || !isFinite(v)) return null;
    return v;
  } catch {
    return null;
  }
}
