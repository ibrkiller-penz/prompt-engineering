// 순서도 실행기 (React 없음, eval 없음)

export type Vars = Record<string, number>;
export type Kind = "start" | "end" | "proc" | "dec" | "io";
export type PresetId = "sum" | "prod" | "diff" | "max";

export interface FNode {
  id: string;
  kind: Kind;
  label: string;
  run?: (v: Vars) => Vars;
  test?: (v: Vars) => boolean;
  next?: string;
  yes?: string;
  no?: string;
}

export interface Program {
  start: string;
  nodes: Record<string, FNode>;
  /** 표에 보일 변수 이름 순서 */
  varNames: string[];
  /** 끝났을 때 출력값이 들어 있는 변수 */
  outKey: string;
}

export interface Step {
  node: string;
  kind: Kind;
  label: string;
  vars: Vars;
  branch?: "예" | "아니오";
}

export interface Trace {
  steps: Step[];
  output: number | null;
  truncated: boolean;
}

export const MAX_STEPS = 300;

export function run(prog: Program, maxSteps = MAX_STEPS): Trace {
  const steps: Step[] = [];
  let vars: Vars = {};
  let cur: string | undefined = prog.start;
  let truncated = false;
  while (cur !== undefined) {
    if (steps.length >= maxSteps) {
      truncated = true;
      break;
    }
    const n: FNode = prog.nodes[cur];
    let branch: Step["branch"];
    let nxt: string | undefined;
    if (n.kind === "dec") {
      const ok = n.test ? n.test(vars) : false;
      branch = ok ? "예" : "아니오";
      nxt = ok ? n.yes : n.no;
    } else {
      if (n.run) vars = n.run(vars);
      nxt = n.next;
    }
    steps.push({ node: n.id, kind: n.kind, label: n.label, vars: { ...vars }, branch });
    cur = nxt;
  }
  const last = steps[steps.length - 1];
  const output = !truncated && last && last.vars[prog.outKey] !== undefined ? last.vars[prog.outKey] : null;
  return { steps, output, truncated };
}

export interface CondOption {
  key: string;
  label: string;
  fn: (i: number, n: number) => boolean;
}

export const COND_OPTIONS: CondOption[] = [
  { key: "lt", label: "I<N", fn: (i, n) => i < n },
  { key: "le", label: "I≤N", fn: (i, n) => i <= n },
  { key: "gt", label: "I>N", fn: (i, n) => i > n },
  { key: "ge", label: "I≥N", fn: (i, n) => i >= n },
  { key: "ne", label: "I≠N", fn: (i, n) => i !== n },
];

export function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(x)));
}

export interface Inputs {
  n: number;
  a: number;
  b: number;
  c: number;
}

export const PRESET_INFO: Record<PresetId, { name: string; title: string; inputs: ("n" | "a" | "b" | "c")[]; min: number; max: number; defaults: Partial<Inputs> }> = {
  sum: { name: "① 1부터 N까지의 합", title: "1부터 N까지의 합", inputs: ["n"], min: 1, max: 12, defaults: { n: 5 } },
  prod: { name: "② 1×2×…×N", title: "1×2×…×N", inputs: ["n"], min: 1, max: 8, defaults: { n: 5 } },
  diff: { name: "③ 두 수의 차", title: "두 수 a, b의 차", inputs: ["a", "b"], min: 0, max: 99, defaults: { a: 7, b: 12 } },
  max: { name: "④ 세 수의 최댓값", title: "세 수의 최댓값", inputs: ["a", "b", "c"], min: 0, max: 99, defaults: { a: 4, b: 9, c: 6 } },
};

export const PRESET_ORDER: PresetId[] = ["sum", "prod", "diff", "max"];

function loopProgram(kind: "sum" | "prod", n: number, condLabel: string, cond: (i: number, n: number) => boolean): Program {
  const isSum = kind === "sum";
  const acc = isSum ? "S" : "P";
  return {
    start: "start",
    outKey: acc,
    varNames: ["N", "I", acc],
    nodes: {
      start: { id: "start", kind: "start", label: "시작", next: "init", run: (v) => v },
      init: {
        id: "init",
        kind: "proc",
        label: `${acc}←${isSum ? 0 : 1}, I←1`,
        run: () => ({ N: n, I: 1, [acc]: isSum ? 0 : 1 }),
        next: "dec",
      },
      dec: { id: "dec", kind: "dec", label: condLabel + " ?", test: (v) => cond(v.I, v.N), yes: "body", no: "out" },
      body: {
        id: "body",
        kind: "proc",
        label: isSum ? "S←S+I" : "P←P×I",
        run: (v) => ({ ...v, [acc]: isSum ? v.S + v.I : v.P * v.I }),
        next: "inc",
      },
      inc: { id: "inc", kind: "proc", label: "I←I+1", run: (v) => ({ ...v, I: v.I + 1 }), next: "dec" },
      out: { id: "out", kind: "io", label: `${acc} 출력`, next: "end" },
      end: { id: "end", kind: "end", label: "끝" },
    },
  };
}

export function buildProgram(id: PresetId, inp: Inputs, condKey = "le"): Program {
  if (id === "sum" || id === "prod") {
    const opt = COND_OPTIONS.find((o) => o.key === condKey) ?? COND_OPTIONS[1];
    return loopProgram(id, inp.n, opt.label, opt.fn);
  }
  if (id === "diff") {
    return {
      start: "start",
      outKey: "D",
      varNames: ["a", "b", "D"],
      nodes: {
        start: { id: "start", kind: "start", label: "시작", next: "in" },
        in: { id: "in", kind: "io", label: "a, b 입력", run: () => ({ a: inp.a, b: inp.b }), next: "dec" },
        dec: { id: "dec", kind: "dec", label: "a>b ?", test: (v) => v.a > v.b, yes: "ab", no: "ba" },
        ab: { id: "ab", kind: "proc", label: "D←a−b", run: (v) => ({ ...v, D: v.a - v.b }), next: "out" },
        ba: { id: "ba", kind: "proc", label: "D←b−a", run: (v) => ({ ...v, D: v.b - v.a }), next: "out" },
        out: { id: "out", kind: "io", label: "D 출력", next: "end" },
        end: { id: "end", kind: "end", label: "끝" },
      },
    };
  }
  return {
    start: "start",
    outKey: "M",
    varNames: ["a", "b", "c", "M"],
    nodes: {
      start: { id: "start", kind: "start", label: "시작", next: "in" },
      in: { id: "in", kind: "io", label: "a, b, c 입력", run: () => ({ a: inp.a, b: inp.b, c: inp.c }), next: "set" },
      set: { id: "set", kind: "proc", label: "M←a", run: (v) => ({ ...v, M: v.a }), next: "d1" },
      d1: { id: "d1", kind: "dec", label: "b>M ?", test: (v) => v.b > v.M, yes: "s1", no: "d2" },
      s1: { id: "s1", kind: "proc", label: "M←b", run: (v) => ({ ...v, M: v.b }), next: "d2" },
      d2: { id: "d2", kind: "dec", label: "c>M ?", test: (v) => v.c > v.M, yes: "s2", no: "out" },
      s2: { id: "s2", kind: "proc", label: "M←c", run: (v) => ({ ...v, M: v.c }), next: "out" },
      out: { id: "out", kind: "io", label: "M 출력", next: "end" },
      end: { id: "end", kind: "end", label: "끝" },
    },
  };
}

export interface BlankResult {
  ok: boolean;
  output: number | null;
  expected: number;
  truncated: boolean;
}

/** 빈칸에 고른 조건으로 ①(합)을 끝까지 돌려 정답(N(N+1)/2)과 비교 */
export function checkBlank(n: number, condKey: string): BlankResult {
  const t = run(buildProgram("sum", { n, a: 0, b: 0, c: 0 }, condKey));
  const expected = (n * (n + 1)) / 2;
  return { ok: t.output === expected, output: t.output, expected, truncated: t.truncated };
}

/** 끝난 뒤 보여 줄 수식(TeX) 한 줄 */
export function explainTex(id: PresetId, inp: Inputs, out: number): string {
  if (id === "sum") {
    const head = inp.n <= 3 ? Array.from({ length: inp.n }, (_, i) => i + 1).join("+") : `1+2+\\cdots+${inp.n}`;
    return `${head}=\\dfrac{${inp.n}\\times${inp.n + 1}}{2}=${out}`;
  }
  if (id === "prod") {
    const head = inp.n <= 4 ? Array.from({ length: inp.n }, (_, i) => i + 1).join("\\times ") : `1\\times 2\\times\\cdots\\times ${inp.n}`;
    return `${inp.n}!=${head}=${out}`;
  }
  if (id === "diff") return `|${inp.a}-${inp.b}|=${out}`;
  return `\\max(${inp.a},${inp.b},${inp.c})=${out}`;
}
